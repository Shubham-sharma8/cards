#!/usr/bin/env python3
"""
Sync master datasets & per-bank dossiers to web/public/data and mobile/src/data.
Run after `python3 bots/build_cards_by_bank.py`.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

ROOT_DIR = Path("/Users/shubhamsharma/Downloads/Credit Card")
MASTER_DIR = ROOT_DIR / "data" / "master"
CARDS_BY_BANK_DIR = ROOT_DIR / "data" / "cards_by_bank"
WEB_SEARCH_OUT = ROOT_DIR / "web" / "public" / "data" / "search-index.json"
MOBILE_DATA_DIR = ROOT_DIR / "mobile" / "src" / "data"


def main() -> None:
    MOBILE_DATA_DIR.mkdir(parents=True, exist_ok=True)
    WEB_SEARCH_OUT.parent.mkdir(parents=True, exist_ok=True)

    # 1. Copy web search index + shared mobile JSON files verbatim
    search_index_path = MASTER_DIR / "app_search_index.json"
    banks_index_path = MASTER_DIR / "cards_by_bank_index.json"
    lounge_catalog_path = MASTER_DIR / "lounge_programs_catalog.json"
    lounge_master_path = MASTER_DIR / "lounge_access_master.json"
    deval_tracker_path = MASTER_DIR / "devaluation_tracker.json"
    latest_offers_path = MASTER_DIR / "latest_offers.json"

    shutil.copy2(search_index_path, WEB_SEARCH_OUT)
    shutil.copy2(search_index_path, MOBILE_DATA_DIR / "search_index.json")
    shutil.copy2(banks_index_path, MOBILE_DATA_DIR / "banks_index.json")
    shutil.copy2(lounge_catalog_path, MOBILE_DATA_DIR / "lounge_catalog.json")
    if lounge_master_path.exists():
        shutil.copy2(lounge_master_path, MOBILE_DATA_DIR / "lounge_access_master.json")
    shutil.copy2(deval_tracker_path, MOBILE_DATA_DIR / "devaluation_tracker.json")
    if latest_offers_path.exists():
        shutil.copy2(latest_offers_path, MOBILE_DATA_DIR / "latest_offers.json")

    search_index = json.loads(search_index_path.read_text(encoding="utf-8"))
    lounge_catalog = json.loads(lounge_catalog_path.read_text(encoding="utf-8"))
    valid_program_ids = set((lounge_catalog.get("programs") or {}).keys())

    calc_meta: dict[str, Any] = {}
    dossiers_map: dict[str, Any] = {}

    for item in search_index.get("cards", []):
        cid = item["card_id"]
        bslug = item["bank_slug"]
        cslug = item["card_slug"]
        dossier_path = CARDS_BY_BANK_DIR / bslug / f"{cslug}.json"
        if not dossier_path.exists():
            continue

        d = json.loads(dossier_path.read_text(encoding="utf-8"))
        fees = d.get("fees_and_charges_detailed") or {}
        rc = d.get("reward_calculator_model") or {}
        calc_meta[cid] = {
            "waiver": fees.get("fee_waiver_spend_inr"),
            "gst": bool(fees.get("gst_applicable", True)),
            "caps": rc.get("monthly_capping_rules") or [],
            "caps_inr": rc.get("monthly_category_caps_inr") or {},
        }

        lounge_det = dict(d.get("lounge_access_detailed") or {})
        lounge_det.pop("participating_lounges_matched", None)
        app_links = lounge_det.get("applicable_lounge_links") or []
        lounge_det["program_ids"] = [
            lnk["program_id"]
            for lnk in app_links
            if lnk.get("program_id") and lnk["program_id"] in valid_program_ids
        ]
        d["lounge_access_detailed"] = lounge_det
        dossiers_map[cid] = d

    (MOBILE_DATA_DIR / "calc_meta.json").write_text(
        json.dumps(calc_meta, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    (MOBILE_DATA_DIR / "dossiers_map.json").write_text(
        json.dumps(dossiers_map, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    print(
        f"[Sync DONE] web search-index + 6 mobile JSONs written "
        f"(calc_meta={len(calc_meta)}, dossiers_map={len(dossiers_map)})."
    )


if __name__ == "__main__":
    main()
