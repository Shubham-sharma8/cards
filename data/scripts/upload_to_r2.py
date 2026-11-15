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
    ("brand-logos", WEB_PUBLIC / "brand-logos"),
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
    ("meta/cards_by_bank_index.json", ROOT / "data" / "master" / "cards_by_bank_index.json"),
    ("meta/latest_offers.json", ROOT / "data" / "master" / "latest_offers.json"),
    ("meta/lounge_programs_catalog.json", ROOT / "data" / "master" / "lounge_programs_catalog.json"),
    ("meta/merchant_mcc_directory.json", WEB_PUBLIC / "data" / "merchant-mcc-directory.json"),
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


def put_object_api_token(
    *,
    account_id: str,
    api_token: str,
    bucket: str,
    object_key: str,
    payload: bytes,
    content_type: str,
    cache_control: str,
) -> tuple[int, str]:
    encoded_key = urllib.parse.quote(object_key.lstrip("/"), safe="/-_.~")
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/r2/buckets/{bucket}/objects/{encoded_key}"
    req = urllib.request.Request(url, data=payload, method="PUT")
    req.add_header("Authorization", f"Bearer {api_token}")
    req.add_header("Content-Type", content_type)
    req.add_header("Cache-Control", cache_control)
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
    search_index_path = MOBILE_DATA / "search_index.json"
    if dossiers_path.exists():
        dossiers = json.loads(dossiers_path.read_text(encoding="utf-8"))

        if search_index_path.exists():
            search_cards = json.loads(search_index_path.read_text(encoding="utf-8")).get("cards", [])
            need_fw = not prefix_filter or "meta/fee_waiver_map.json".startswith(prefix_filter)
            need_adv = not prefix_filter or "meta/advisor_meta_map.json".startswith(prefix_filter)
            need_calc = not prefix_filter or "meta/calculator_extra_meta.json".startswith(prefix_filter)
            if need_fw or need_adv or need_calc:
                fw_map: dict[str, object] = {}
                adv_map: dict[str, dict[str, object]] = {}
                calc_map: dict[str, dict[str, object]] = {}

                def _first(*vals: object) -> object:
                    for v in vals:
                        if v is not None:
                            return v
                    return None

                for c in search_cards:
                    cid = c.get("card_id")
                    if not cid:
                        continue
                    d = dossiers.get(cid) or {}
                    fees_det = d.get("fees_and_charges_detailed") or {}
                    rc = d.get("reward_calculator_model") or {}
                    elig = d.get("eligibility_detailed") or {}
                    deval = d.get("devaluation_analysis") or {}
                    comm = d.get("reddit_user_feedback") or {}
                    lng = d.get("lounge_access_detailed") or {}
                    lng_dom = lng.get("domestic") or {}
                    lng_intl = lng.get("international") or {}
                    ft = c.get("filter_tags") or {}
                    fw_calc = rc.get("fee_waiver_and_milestone_calculator") or {}
                    benefits_faq = d.get("benefits_features_and_faqs") or {}

                    fw_val = _first(fees_det.get("fee_waiver_spend_inr"), c.get("fee_waiver_spend_inr"))
                    fw_map[cid] = fw_val

                    adv_map[cid] = {
                        "minIncomeSalariedInr": _first(elig.get("min_monthly_income_salaried_inr"), ft.get("min_income_salaried_inr")),
                        "minItrAnnualInr": elig.get("min_annual_itr_self_employed_inr"),
                        "minCibilScore": _first(elig.get("min_cibil_score"), ft.get("min_cibil_score"), 730),
                        "approvalNotes": elig.get("approval_notes"),
                        "cappingRules": _first(rc.get("monthly_capping_rules"), [c["capping_summary"]] if c.get("capping_summary") else []),
                        "excludedCategories": _first(rc.get("excluded_categories"), []),
                        "pointValueDefault": _first(rc.get("point_value_inr_default"), 0.25),
                        "pointValueMatrix": _first(rc.get("point_value_inr_matrix"), {}),
                        "devaluationRiskScore": _first(deval.get("devaluation_risk_score"), 4),
                        "devaluationFrequency": _first(deval.get("devaluation_frequency"), "Moderate"),
                        "lastDevaluedOn": deval.get("last_devalued_on"),
                        "communityScore": _first(comm.get("community_score"), c.get("overall_rating")),
                        "communityWarnings": _first(comm.get("practical_community_warnings"), []),
                        "loungeSpendCriteria": _first(lng_dom.get("spend_criteria"), c.get("lounge_spend_condition")),
                        "domesticVisitsPerYear": _first(lng_dom.get("visits_per_year"), 0),
                        "domesticVisitsPerQuarter": _first(lng_dom.get("visits_per_quarter"), 0),
                        "internationalVisitsPerYear": _first(lng_intl.get("visits_per_year"), 0),
                        "milestoneSlabs": _first(fw_calc.get("milestone_slabs"), benefits_faq.get("milestone_benefits"), []),
                        "feeWaiverSpendInr": fw_val,
                        "fuelSurchargeWaiver": fees_det.get("fuel_surcharge_waiver"),
                    }

                    calc_map[cid] = {
                        "fee_waiver_spend_inr": fees_det.get("fee_waiver_spend_inr"),
                        "monthly_capping_rules": rc.get("monthly_capping_rules") or [],
                        "earn_unit": rc.get("earn_unit") or "Reward Points",
                        "point_value_inr_default": _first(rc.get("point_value_inr_default"), 1),
                    }

                for key, obj in [
                    ("meta/fee_waiver_map.json", fw_map),
                    ("meta/advisor_meta_map.json", adv_map),
                    ("meta/calculator_extra_meta.json", calc_map),
                ]:
                    if not prefix_filter or key.startswith(prefix_filter):
                        payload = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
                        jobs.append((key, payload, "application/json; charset=utf-8", "public, max-age=3600"))

        if not prefix_filter or "dossiers/".startswith(prefix_filter) or prefix_filter.startswith("dossiers"):
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

    account_id = (os.environ.get("R2_ACCOUNT_ID") or os.environ.get("CLOUDFLARE_ACCOUNT_ID") or "").strip()
    api_token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    access_key = os.environ.get("R2_ACCESS_KEY_ID", "").strip()
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY", "").strip()
    bucket = os.environ.get("R2_BUCKET_NAME", "").strip()

    use_api_token = bool(api_token and account_id and bucket)
    use_s3_keys = bool(account_id and access_key and secret_key and bucket)

    if not use_api_token and not use_s3_keys:
        print(
            "ERROR: Provide either (CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID/R2_ACCOUNT_ID + R2_BUCKET_NAME) "
            "or (R2_ACCOUNT_ID + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY + R2_BUCKET_NAME).",
            file=sys.stderr,
        )
        return 2

    ok = 0
    failed = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        future_map = {
            pool.submit(
                put_object_api_token if use_api_token else put_object_sigv4,
                **(
                    {
                        "account_id": account_id,
                        "api_token": api_token,
                        "bucket": bucket,
                        "object_key": key,
                        "payload": data,
                        "content_type": ctype,
                        "cache_control": cache_ctrl,
                    }
                    if use_api_token
                    else {
                        "account_id": account_id,
                        "access_key": access_key,
                        "secret_key": secret_key,
                        "bucket": bucket,
                        "object_key": key,
                        "payload": data,
                        "content_type": ctype,
                        "cache_control": cache_ctrl,
                    }
                ),
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
