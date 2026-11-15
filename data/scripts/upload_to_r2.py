#!/usr/bin/env python3
"""Upload CardLedger media assets and split JSON metadata to Cloudflare R2.

Reads credentials strictly from environment variables:
  R2_ACCOUNT_ID
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY
  R2_BUCKET_NAME

Usage:
  export R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET_NAME=...
  python3 data/scripts/upload_to_r2.py
  python3 data/scripts/upload_to_r2.py --dry-run
"""

from __future__ import annotations

import argparse
import concurrent.futures
import datetime
import hashlib
import hmac
import json
import mimetypes
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WEB_PUBLIC = ROOT / "web" / "public"
MOBILE_DATA = ROOT / "mobile" / "src" / "data"

IMAGE_DIRS = [
    ("card-images", WEB_PUBLIC / "card-images"),
    ("lounge-photos", WEB_PUBLIC / "lounge-photos"),
    ("golf-photos", WEB_PUBLIC / "golf-photos"),
    ("category-posters", WEB_PUBLIC / "category-posters"),
    ("open-media", WEB_PUBLIC / "open-media"),
    ("icons/canva", WEB_PUBLIC / "icons" / "canva"),
    ("logos", WEB_PUBLIC / "logos"),
    ("illustrations", WEB_PUBLIC / "illustrations"),
]

META_FILES = [
    ("meta/lounge_access_master.json", ROOT / "data" / "master" / "lounge_access_master.json"),
    ("meta/golf_clubs_master.json", ROOT / "data" / "master" / "golf_clubs_master.json"),
    ("meta/devaluation_tracker.json", ROOT / "data" / "master" / "devaluation_tracker.json"),
    ("meta/search_index.json", MOBILE_DATA / "search_index.json"),
]


def _hmac_sha256(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def _signing_key(secret_key: str, date_stamp: str, region: str = "auto", service: str = "s3") -> bytes:
    k_date = _hmac_sha256(("AWS4" + secret_key).encode("utf-8"), date_stamp)
    k_region = _hmac_sha256(k_date, region)
    k_service = _hmac_sha256(k_region, service)
    return _hmac_sha256(k_service, "aws4_request")


def put_object_sigv4(
    *,
    account_id: str,
    access_key: str,
    secret_key: str,
    bucket: str,
    object_key: str,
    payload: bytes,
    content_type: str,
    cache_control: str,
) -> tuple[int, str]:
    host = f"{account_id}.r2.cloudflarestorage.com"
    encoded_key = urllib.parse.quote(object_key.lstrip("/"), safe="/-_.~")
    canonical_uri = f"/{bucket}/{encoded_key}"
    url = f"https://{host}{canonical_uri}"

    now = datetime.datetime.now(datetime.timezone.utc)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")
    payload_hash = hashlib.sha256(payload).hexdigest()

    headers = {
        "cache-control": cache_control,
        "content-type": content_type,
        "host": host,
        "x-amz-content-sha256": payload_hash,
        "x-amz-date": amz_date,
    }
    signed_headers = ";".join(sorted(headers.keys()))
    canonical_headers = "".join(f"{k}:{headers[k]}\n" for k in sorted(headers.keys()))
    canonical_request = "\n".join(
        ["PUT", canonical_uri, "", canonical_headers, signed_headers, payload_hash]
    )

    scope = f"{date_stamp}/auto/s3/aws4_request"
    string_to_sign = "\n".join(
        [
            "AWS4-HMAC-SHA256",
            amz_date,
            scope,
            hashlib.sha256(canonical_request.encode("utf-8")).hexdigest(),
        ]
    )
    sig = hmac.new(
        _signing_key(secret_key, date_stamp),
        string_to_sign.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    auth_header = (
        f"AWS4-HMAC-SHA256 Credential={access_key}/{scope}, "
        f"SignedHeaders={signed_headers}, Signature={sig}"
    )

    req = urllib.request.Request(url, data=payload, method="PUT")
    req.add_header("Authorization", auth_header)
    req.add_header("Content-Type", content_type)
    req.add_header("Cache-Control", cache_control)
    req.add_header("x-amz-content-sha256", payload_hash)
    req.add_header("x-amz-date", amz_date)

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, ""
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", errors="replace")[:250]
        return err.code, body
    except Exception as exc:  # noqa: BLE001
        return 0, str(exc)


def collect_jobs(prefix_filter: str | None = None) -> list[tuple[str, bytes, str, str]]:
    jobs: list[tuple[str, bytes, str, str]] = []

    for remote_prefix, local_dir in IMAGE_DIRS:
        if not local_dir.exists():
            continue
        for file_path in sorted(local_dir.rglob("*")):
            if not file_path.is_file() or file_path.name.startswith("."):
                continue
            rel = file_path.relative_to(local_dir).as_posix()
            key = f"{remote_prefix}/{rel}"
            if prefix_filter and not key.startswith(prefix_filter):
                continue
            mime, _ = mimetypes.guess_type(file_path.name)
            ctype = mime or "application/octet-stream"
            jobs.append((key, file_path.read_bytes(), ctype, "public, max-age=31536000, immutable"))

    for key, file_path in META_FILES:
        if not file_path.exists():
            continue
        if prefix_filter and not key.startswith(prefix_filter):
            continue
        jobs.append((key, file_path.read_bytes(), "application/json; charset=utf-8", "public, max-age=3600"))

    dossiers_path = MOBILE_DATA / "dossiers_map.json"
    if dossiers_path.exists() and (not prefix_filter or "dossiers/".startswith(prefix_filter) or prefix_filter.startswith("dossiers")):
        dossiers = json.loads(dossiers_path.read_text(encoding="utf-8"))
        for card_id, dossier in dossiers.items():
            key = f"dossiers/{card_id}.json"
            if prefix_filter and not key.startswith(prefix_filter):
                continue
            payload = json.dumps(dossier, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            jobs.append((key, payload, "application/json; charset=utf-8", "public, max-age=86400"))

    return jobs


def main() -> int:
    parser = argparse.ArgumentParser(description="Upload CardLedger media and JSON metadata to Cloudflare R2.")
    parser.add_argument("--dry-run", action="store_true", help="List object count and total bytes without uploading.")
    parser.add_argument("--prefix", type=str, default=None, help="Only upload keys matching this prefix.")
    parser.add_argument("--workers", type=int, default=8, help="Concurrent upload workers.")
    args = parser.parse_args()

    jobs = collect_jobs(args.prefix)
    total_bytes = sum(len(j[1]) for j in jobs)
    print(f"Prepared {len(jobs)} objects ({total_bytes / (1024 * 1024):.2f} MB) for R2 upload.")

    if args.dry_run:
        for key, data, ctype, _ in jobs[:15]:
            print(f"  [dry-run] {key} ({len(data)} bytes, {ctype})")
        if len(jobs) > 15:
            print(f"  ... and {len(jobs) - 15} more objects.")
        return 0

    account_id = os.environ.get("R2_ACCOUNT_ID", "").strip()
    access_key = os.environ.get("R2_ACCESS_KEY_ID", "").strip()
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY", "").strip()
    bucket = os.environ.get("R2_BUCKET_NAME", "").strip()

    missing = [
        name
        for name, val in [
            ("R2_ACCOUNT_ID", account_id),
            ("R2_ACCESS_KEY_ID", access_key),
            ("R2_SECRET_ACCESS_KEY", secret_key),
            ("R2_BUCKET_NAME", bucket),
        ]
        if not val
    ]
    if missing:
        print(f"ERROR: Missing required environment variables: {', '.join(missing)}", file=sys.stderr)
        print("Set R2_BUCKET_NAME to your Cloudflare R2 bucket name (and ensure key has Object Write access).", file=sys.stderr)
        return 2

    ok = 0
    failed = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        future_map = {
            pool.submit(
                put_object_sigv4,
                account_id=account_id,
                access_key=access_key,
                secret_key=secret_key,
                bucket=bucket,
                object_key=key,
                payload=data,
                content_type=ctype,
                cache_control=cache_ctrl,
            ): key
            for key, data, ctype, cache_ctrl in jobs
        }
        for fut in concurrent.futures.as_completed(future_map):
            key = future_map[fut]
            status, msg = fut.result()
            if 200 <= status < 300:
                ok += 1
            else:
                failed += 1
                if failed <= 5:
                    print(f"FAIL [{status}] {key}: {msg}", file=sys.stderr)

    print(f"R2 upload finished: {ok} succeeded, {failed} failed (bucket={bucket}).")
    if failed == 0:
        print("Next: set NEXT_PUBLIC_R2_PUBLIC_URL (web) and EXPO_PUBLIC_R2_PUBLIC_URL (mobile) to your public r2.dev/CDN URL.")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
