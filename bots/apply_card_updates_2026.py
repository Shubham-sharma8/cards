#!/usr/bin/env python3
"""
Apply verified 2026 MITC & community updates across dossiers, app_search_index.json,
credit_cards_master.json, and devaluation_tracker.json, then run sync_mobile_data.py.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT_DIR = Path("/Users/shubhamsharma/Downloads/Credit Card")
MASTER_DIR = ROOT_DIR / "data" / "master"
CARDS_BY_BANK_DIR = ROOT_DIR / "data" / "cards_by_bank"
SEARCH_INDEX_PATH = MASTER_DIR / "app_search_index.json"
MASTER_PATH = MASTER_DIR / "credit_cards_master.json"
DEVAL_TRACKER_PATH = MASTER_DIR / "devaluation_tracker.json"


def dedup_preserve(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for x in items:
        s = str(x or "").strip()
        if not s:
            continue
        k = s.lower()
        if k not in seen:
            seen.add(k)
            out.append(s)
    return out


def upsert_table_row(
    tables: list[dict[str, Any]],
    table_id_substr: str,
    match_key_substr: str,
    new_row: list[str],
    append_if_missing: bool = False,
) -> None:
    for t in tables:
        if table_id_substr in str(t.get("id", "")).lower() or table_id_substr in str(t.get("title", "")).lower():
            rows = t.setdefault("rows", [])
            for idx, r in enumerate(rows):
                if r and match_key_substr.lower() in str(r[0]).lower():
                    rows[idx] = new_row
                    return
            if append_if_missing:
                rows.append(new_row)
                return


def load_dossier(si_card: dict[str, Any]) -> tuple[Path, dict[str, Any]]:
    dp = CARDS_BY_BANK_DIR / si_card["bank_slug"] / f"{si_card['card_slug']}.json"
    return dp, json.loads(dp.read_text(encoding="utf-8"))


def save_dossier(dp: Path, dossier: dict[str, Any]) -> None:
    dp.write_text(json.dumps(dossier, indent=2, ensure_ascii=False), encoding="utf-8")


def sync_item_from_dossier(item: dict[str, Any], dossier: dict[str, Any]) -> None:
    rc = dossier.get("reward_calculator_model") or {}
    item["effective_return_pct_by_category"] = rc.get("effective_return_pct_by_category") or {}
    item["monthly_category_caps_inr"] = rc.get("monthly_category_caps_inr") or {}
    item["category_caveats"] = rc.get("category_caveats") or {}
    if rc.get("capping_summary") is not None:
        item["capping_summary"] = rc["capping_summary"]
    elig = dossier.get("eligibility_detailed") or {}
    ft = item.setdefault("filter_tags", {})
    if elig.get("min_monthly_income_salaried_inr") is not None:
        ft["min_income_salaried_inr"] = elig["min_monthly_income_salaried_inr"]
    if elig.get("min_cibil_score") is not None:
        ft["min_cibil_score"] = elig["min_cibil_score"]
    lng = dossier.get("lounge_access_detailed") or {}
    for k in ("has_domestic_lounge", "no_spend_domestic_lounge", "has_international_lounge"):
        if k in lng:
            ft[k] = lng[k]
    dom = lng.get("domestic") or {}
    if isinstance(dom, dict):
        if dom.get("summary"):
            item["domestic_lounge_summary"] = dom["summary"]
        if dom.get("spend_criteria"):
            item["lounge_spend_condition"] = dom["spend_criteria"]


def update_hsbc_live_plus(item: dict[str, Any], dossier: dict[str, Any]) -> None:
    rc = dossier.setdefault("reward_calculator_model", {})
    rc["effective_return_pct_by_category"] = {
        "online_shopping_general": 1.5,
        "amazon_flipkart_myntra": 1.5,
        "dining_swiggy_zomato": 10.0,
        "groceries_quick_commerce": 10.0,
        "travel_flights_hotels": 1.5,
        "upi_scan_and_pay": 0.0,
        "utilities_bills_telecom": 10.0,
        "fuel": 0.0,
        "insurance": 0.0,
        "education_rent_govt": 0.0,
        "international_forex_net_of_markup": -2.35,
        "offline_general_other": 1.5,
    }
    rc["monthly_category_caps_inr"] = {
        "dining_swiggy_zomato": 1200,
        "groceries_quick_commerce": 1200,
        "utilities_bills_telecom": 1200,
    }
    rc["monthly_capping_rules"] = [
        "10% cashback on Dining, Food Delivery (Swiggy/Zomato), Groceries (DMart/Zepto/Blinkit/Instamart — MCC 5411/5499), eligible Utility Bills (MCC 4900) & select apparel/departmental MCCs — shared monthly cap of ₹1,000–₹1,200/billing cycle.",
        "Amazon, Flipkart & Myntra are EXCLUDED from 10% and earn unlimited 1.5% base cashback (same 1.5% across general online/offline retail & travel).",
        "MCC Caveat: Direct state electricity portals billed under Govt MCC 9399 yield 0%; use Zepto Amazon Pay Gift Card route (codes as Grocery 10% up to cap) -> Amazon Pay / PolicyBazaar for bills & insurance.",
    ]
    rc["category_caveats"] = {
        "online_shopping_general": "1.5% base across general online portals (only select departmental/apparel MCCs qualify for 10% pool).",
        "amazon_flipkart_myntra": "1.5% unlimited base (Amazon, Flipkart & Myntra explicitly excluded from 10%).",
        "dining_swiggy_zomato": "10% on restaurants, Swiggy & Zomato (shares ₹1,000–₹1,200/mo combined cap).",
        "groceries_quick_commerce": "10% on Zepto, Blinkit, Instamart, DMart & supermarkets (MCC 5411/5499; shares ₹1,000–₹1,200/mo combined cap).",
        "utilities_bills_telecom": "10% on eligible utility MCC 4900 & Zepto Amazon Pay Gift Card route (govt portals MCC 9399 excluded).",
        "insurance": "0% direct insurer MCC — Pro Hack: buy Amazon Pay Gift Cards on Zepto (10% up to ₹1,200/mo) and pay via Amazon Pay / PolicyBazaar.",
    }
    rc["capping_summary"] = "₹1,000–₹1,200/mo combined 10% cap (Dining, Groceries, Utilities, select MCCs); 1.5% uncapped on Amazon/Flipkart/other"

    tables = rc.get("structured_tables") or []
    upsert_table_row(
        tables,
        "reward_structure-2",
        "Grocery, Dining",
        [
            "Dining, Food Delivery, Groceries, Eligible Utility Bills & Select Apparel/Dept MCCs",
            "10%",
            "₹1,000–₹1,200/cycle combined (1.5% after)",
        ],
    )
    upsert_table_row(
        tables,
        "reward_structure-2",
        "Amazon, Flipkart",
        [
            "Amazon, Flipkart, Myntra & General Online Shopping",
            "1.5%",
            "No cap (excluded from 10% tier)",
        ],
        append_if_missing=True,
    )
    upsert_table_row(
        tables,
        "reward_structure-2",
        "Excluded Categories",
        [
            "Excluded Categories (0% Cashback)",
            "Fuel, Rent, Wallet Loads (MCC 6540), EMI, Direct Insurance, Education, Govt (MCC 9399), Jewellery, Hospitals (MCC 8062) & Local Transit (MCC 4111)",
            "–",
        ],
    )

    red = dossier.setdefault("reddit_user_feedback", {})
    red["practical_community_warnings"] = dedup_preserve([
        "10% cashback applies strictly by MCC (Dining MCC 5811/5812/5814, Grocery/Supermarket MCC 5411/5499, Utilities MCC 4900 & select retail) — Amazon, Flipkart & Myntra explicitly earn 1.5% base.",
        "Hospitals (MCC 8062), Local Transport (MCC 4111), Rent, Govt (MCC 9399), Fuel, Wallets & Direct Insurance earn 0% (Nov 2026 T&C).",
        "Domestic lounges cut in Nov 2026 to 2/year (max 1 per 6 months); 1.99% forex markup with 0% international cashback.",
    ])


def update_airtel_axis(item: dict[str, Any], dossier: dict[str, Any]) -> None:
    rc = dossier.setdefault("reward_calculator_model", {})
    rc["effective_return_pct_by_category"] = {
        "online_shopping_general": 1.0,
        "amazon_flipkart_myntra": 1.0,
        "dining_swiggy_zomato": 5.0,
        "groceries_quick_commerce": 5.0,
        "travel_flights_hotels": 1.0,
        "upi_scan_and_pay": 1.0,
        "utilities_bills_telecom": 25.0,
        "fuel": 0.0,
        "insurance": 0.0,
        "education_rent_govt": 0.0,
        "international_forex_net_of_markup": -3.13,
        "offline_general_other": 1.0,
    }
    rc["monthly_category_caps_inr"] = {
        "utilities_bills_telecom": 500,
        "dining_swiggy_zomato": 200,
        "groceries_quick_commerce": 200,
    }
    rc["monthly_capping_rules"] = [
        "April 12, 2026 MITC Overhaul: 25% Airtel cashback (up to ₹250/mo) is capped at 2× your 1% base cashback, and 10% Utility cashback via Airtel Thanks (up to ₹250/mo) is capped at 1× your 1% base cashback.",
        "You must spend ₹12,500/mo on regular 1% retail spends to unlock the full ₹250 Airtel cap (and ₹25,000/mo to also unlock the full ₹250 utility cap). With ₹0 other spend, accelerated Airtel/Utility cashback drops to ₹0.",
        "Swiggy & BigBasket 10% direct cashback discontinued — replaced by 10% partner wallet credits on Zomato, Blinkit & District Movies (min ₹499 txn, ₹200/partner/mo cap).",
        "All 4 complimentary domestic airport lounge visits/yr completely discontinued effective April 12, 2026.",
    ]
    rc["category_caveats"] = {
        "utilities_bills_telecom": "25% Airtel (2× base cashback, max ₹250) + 10% Utility (1× base cashback, max ₹250) — requires 1% regular retail spend in the same cycle; ₹0 base spend = ₹0 cashback.",
        "dining_swiggy_zomato": "10% Zomato partner wallet credit only (min order ₹499, max ₹200/mo); Swiggy & offline dining earn 1%.",
        "groceries_quick_commerce": "10% Blinkit partner wallet credit only (min order ₹499, max ₹200/mo); BigBasket & supermarkets earn 1%.",
    }
    rc["capping_summary"] = "Conditional Apr 2026 cap: 25% Airtel (2× base, ₹250 max) + 10% Utility (1× base, ₹250 max); Zomato/Blinkit ₹200 wallet credit (₹499 MOV); 0 lounges"

    lng = dossier.setdefault("lounge_access_detailed", {})
    lng["has_domestic_lounge"] = False
    lng["no_spend_domestic_lounge"] = False
    lng["has_international_lounge"] = False
    if isinstance(lng.get("domestic"), dict):
        lng["domestic"]["visits_per_year"] = 0
        lng["domestic"]["visits_per_quarter"] = 0
        lng["domestic"]["spend_criteria"] = "Discontinued effective April 12, 2026"
        lng["domestic"]["summary"] = "Discontinued (Apr 12, 2026): 0 complimentary domestic airport lounge visits"
    item["domestic_lounge_accessible_count"] = 0
    item["accessible_lounge_codes"] = []

    red = dossier.setdefault("reddit_user_feedback", {})
    red["practical_community_warnings"] = dedup_preserve([
        "April 12, 2026 MITC Devaluation: 25% Airtel cashback is capped at 2× your 1% base cashback & 10% Utility is capped at 1× base cashback — ₹0 regular other spends = ₹0 Airtel/Utility cashback!",
        "Swiggy & BigBasket 10% removed (replaced by Zomato/Blinkit/District partner wallet credits with ₹499 minimum order and ₹200/mo cap).",
        "4 complimentary domestic airport lounge visits discontinued effective April 12, 2026; 3.5%+GST forex markup.",
    ])
    red["optimization_tips"] = dedup_preserve([
        "Math check before keeping after Apr 2026: To unlock the full ₹250 Airtel (25%) cap you need ₹12,500 in 1% regular spends (~₹125 base), and ₹25,000 in 1% spends for the full ₹250 utility cap. If you hold SBI Cashback or HDFC Infinia for 3.3%–5% retail spends, shifting ₹12.5k–₹25k away just to unlock Airtel Axis loses opportunity cost!",
        "Only swipe Airtel Axis on Zomato/Blinkit/District above ₹499 where it earns 10% wallet credits (up to ₹200 each/mo).",
    ])


def update_hdfc_infinia(item: dict[str, Any], dossier: dict[str, Any]) -> None:
    elig = dossier.setdefault("eligibility_detailed", {})
    elig["min_monthly_income_salaried_inr"] = 500000
    elig["min_annual_itr_self_employed_inr"] = 4800000
    elig["approval_notes"] = (
        "Strictly invite-only flagship: HDFC requires ₹18 Lakh/yr retail card spend OR ₹50 Lakh Total Relationship Value (RLV) for mandatory annual retention (to avoid downgrade to Diners Club Black Metal); ₹10 Lakh/yr spend waives the ₹12,500+GST fee. Fresh/upgrade benchmark ~₹5L/mo net salary or ₹48L–₹60L+ ITR / Imperia-Private HNI AUM."
    )

    rc = dossier.setdefault("reward_calculator_model", {})
    rc["capping_summary"] = "15,000 RP/mo SmartBuy bonus cap | ₹18L/yr spend or ₹50L RLV mandatory retention (₹10L fee waiver)"
    rc["monthly_capping_rules"] = [
        "Base 3.33% (5 RP/₹150 at ₹1/RP on SmartBuy flights/hotels/Apple/Tanishq); 16.5% (5X) on flights & GyFTR vouchers and 33% (10X) on hotels via SmartBuy.",
        "SmartBuy accelerated RP capped at 15,000 RP/month; Insurance capped at 10,000 RP/month (5,000 RP/day); Utilities capped at 2,000 RP/month; Rent & Govt/Tax earn 0%.",
        "Mandatory 2026 Retention & Upgrade Thresholds: Spend ₹10L/yr to waive ₹12,500+GST fee, AND satisfy ≥ ₹18L/yr eligible retail spend OR ≥ ₹50L HDFC Total Relationship Value (RLV) to retain Infinia and avoid downgrade to Diners Club Black Metal (₹48L–₹60L+ ITR / ₹5L+ net monthly salary upgrade tier).",
    ]

    tables = rc.get("structured_tables") or []
    upsert_table_row(
        tables,
        "fees_and_charges-0",
        "Retention",
        ["Mandatory Retention Criteria (2026)", "₹18 Lakh annual eligible retail spend OR ₹50 Lakh Total Relationship Value (RLV) with HDFC Bank"],
        append_if_missing=True,
    )
    upsert_table_row(
        tables,
        "fees_and_charges-0",
        "Upgrade / Income Benchmark",
        ["Invite / Upgrade Benchmark", "₹48L–₹60L+ annual ITR / ₹5L+ net monthly salary / Imperia-Private Banking AUM"],
        append_if_missing=True,
    )

    deval = dossier.setdefault("devaluation_analysis", {})
    hist = list(deval.get("devaluation_history") or [])
    ret_entry = "2026 Retention Rule: Enforced ₹18 Lakh/yr card retail spend OR ₹50 Lakh RLV retention threshold (risk of forced downgrade to Diners Club Black Metal if unmet; ₹48L–₹60L+ ITR benchmark)."
    if not any("18 lakh" in h.lower() or "50 lakh" in h.lower() for h in hist):
        hist.insert(0, ret_entry)
    deval["devaluation_history"] = dedup_preserve(hist)

    red = dossier.setdefault("reddit_user_feedback", {})
    red["practical_community_warnings"] = dedup_preserve([
        "Mandatory 2026 Retention Gate: ₹10L/yr spend waives the ₹12,500+GST annual fee, but keeping Infinia active requires ≥ ₹18L/yr retail spend OR ≥ ₹50L HDFC RLV (otherwise HDFC may downgrade to DCB Metal).",
        "SmartBuy accelerated RP strictly capped at 15,000 RP/month; Insurance capped at 10,000 RP/mo (5,000/day); Utilities capped at 2,000 RP/mo; Rent & Govt/Tax earn 0%.",
        "Exclusion of rent, wallet, fuel, and government spends from both reward points and annual ₹18L retention calculations.",
    ])


def update_axis_travel_cards(cid: str, item: dict[str, Any], dossier: dict[str, Any]) -> None:
    rc = dossier.setdefault("reward_calculator_model", {})
    deval = dossier.setdefault("devaluation_analysis", {})
    red = dossier.setdefault("reddit_user_feedback", {})
    if cid == "axis_bank_atlas_credit_card":
        rc["capping_summary"] = "2026 Deval: Accor cut 1:2 -> 2:1 (halved+ value), ITC dropped; 30k Group A EM/yr cap; fresh apps restricted"
        rc.setdefault("category_caveats", {})["travel_flights_hotels"] = (
            "5 EDGE Miles/₹100 direct airlines/hotels (capped ₹2L/mo Travel); Accor transfer heavily devalued to 2:1 in 2026 & ITC removed."
        )
        deval["last_devalued_on"] = "2026 (Accor cut to 2:1, ITC dropped, Group A partner purge)"
        hist = list(deval.get("devaluation_history") or [])
        hist.insert(0, "2026 EDGE Miles Overhaul: Accor cut to 2:1 (from 1:2), ITC Hotels removed, Group A partners restructured, fresh applications paused/restricted.")
        deval["devaluation_history"] = dedup_preserve(hist)
        red["practical_community_warnings"] = dedup_preserve(
            ["2026 Major Overhaul: Accor transfer slashed to 2:1 & ITC dropped; HSBC TravelOne/HDFC Regalia Gold often beat Atlas on hotel value."]
            + list(red.get("practical_community_warnings") or [])
        )
    elif cid == "axis_bank_magnus_burgundy_credit_card":
        rc["capping_summary"] = "2026 Deval: Accor ratio cut 5:4 -> 5:2, ITC removed; 2L Group A RP/yr cap; 12–35 EDGE RP on >₹1.5L/mo"
        hist = list(deval.get("devaluation_history") or [])
        hist.insert(0, "2026 EDGE Rewards Update: Accor transfer halved from 5:4 to 5:2; ITC Hotels removed.")
        deval["devaluation_history"] = dedup_preserve(hist)
    elif cid == "axis_bank_magnus_credit_card":
        rc["capping_summary"] = "2026 Deval: Accor ratio cut 5:2 -> 5:1, ITC removed; 1L Group A RP/yr cap; 35 RP on >₹1.5L/mo"
        hist = list(deval.get("devaluation_history") or [])
        hist.insert(0, "2026 EDGE Rewards Update: Accor transfer cut to 5:1; ITC Hotels removed.")
        deval["devaluation_history"] = dedup_preserve(hist)


def update_swiggy_hdfc(item: dict[str, Any], dossier: dict[str, Any]) -> None:
    rc = dossier.setdefault("reward_calculator_model", {})
    rc["capping_summary"] = "10% Swiggy (≥ ₹249 min txn, ₹1,500/cycle cap) · 5% Cleartrip/online (₹1,500 cap) · 1% other (₹500 cap)"
    cav = rc.setdefault("category_caveats", {})
    cav["dining_swiggy_zomato"] = "10% strictly on Swiggy Food/Dineout txns ≥ ₹249 (2026 min order update; ₹1,500/mo cap) · <₹249 & Zomato earn 1%."
    cav["groceries_quick_commerce"] = "10% strictly on Swiggy Instamart txns ≥ ₹249 (₹1,500/mo cap) · non-Swiggy earns 1%."
    cav["travel_flights_hotels"] = "5% cashback on Cleartrip bookings (shared ₹1,500/cycle cap); 1% on other travel."
    red = dossier.setdefault("reddit_user_feedback", {})
    red["practical_community_warnings"] = dedup_preserve([
        "2026 Update: Minimum transaction value raised from ₹100 to ₹249 for 10% Swiggy cashback (orders under ₹249 earn lower base rate); Cleartrip 5% added.",
    ] + list(red.get("practical_community_warnings") or []))


def main() -> None:
    si = json.loads(SEARCH_INDEX_PATH.read_text(encoding="utf-8"))
    master = json.loads(MASTER_PATH.read_text(encoding="utf-8"))
    by_master = {c["card_id"]: c for c in master.get("cards", [])}

    updated_ids = {
        "hsbc_bank_live_plus_credit_card": update_hsbc_live_plus,
        "axis_bank_airtel_axis_bank_credit_card": update_airtel_axis,
        "hdfc_bank_infinia_credit_card": update_hdfc_infinia,
        "axis_bank_atlas_credit_card": lambda it, dos: update_axis_travel_cards("axis_bank_atlas_credit_card", it, dos),
        "axis_bank_magnus_burgundy_credit_card": lambda it, dos: update_axis_travel_cards("axis_bank_magnus_burgundy_credit_card", it, dos),
        "axis_bank_magnus_credit_card": lambda it, dos: update_axis_travel_cards("axis_bank_magnus_credit_card", it, dos),
        "hdfc_bank_swiggy_credit_card": update_swiggy_hdfc,
    }

    for item in si.get("cards", []):
        cid = item["card_id"]
        fn = updated_ids.get(cid)
        if not fn:
            continue
        dp, dossier = load_dossier(item)
        fn(item, dossier)
        sync_item_from_dossier(item, dossier)
        save_dossier(dp, dossier)
        print(f"Updated {cid} -> {dp.name}")

        mc = by_master.get(cid)
        if mc:
            if cid == "hdfc_bank_infinia_credit_card":
                mc.setdefault("eligibility", {})["min_annual_itr_self_employed_inr"] = 4800000
                mc["eligibility"]["notes"] = dossier["eligibility_detailed"]["approval_notes"]
                mc["devaluation"] = dossier.get("devaluation_analysis") or mc.get("devaluation")
            elif cid == "axis_bank_airtel_axis_bank_credit_card":
                mc["lounge_access"] = dossier.get("lounge_access_detailed") or mc.get("lounge_access")
                mc["devaluation"] = dossier.get("devaluation_analysis") or mc.get("devaluation")
            elif cid in ("axis_bank_atlas_credit_card", "axis_bank_magnus_burgundy_credit_card", "axis_bank_magnus_credit_card"):
                mc["devaluation"] = dossier.get("devaluation_analysis") or mc.get("devaluation")

    SEARCH_INDEX_PATH.write_text(json.dumps(si, indent=2, ensure_ascii=False), encoding="utf-8")
    MASTER_PATH.write_text(json.dumps(master, indent=2, ensure_ascii=False), encoding="utf-8")

    # Update devaluation_tracker.json if present
    if DEVAL_TRACKER_PATH.exists():
        dt = json.loads(DEVAL_TRACKER_PATH.read_text(encoding="utf-8"))
        events = dt if isinstance(dt, list) else dt.get("events", [])
        if isinstance(events, list):
            for ev in events:
                if "airtel" in json.dumps(ev).lower():
                    ev["summary"] = (
                        "Effective Apr 12, 2026: 25% Airtel capped at 2× 1% base cashback, 10% Utility capped at 1× 1% base cashback; "
                        "Swiggy/BigBasket replaced by Zomato/Blinkit/District ₹499 MOV wallet credits; 4 domestic lounges removed."
                    )
            DEVAL_TRACKER_PATH.write_text(json.dumps(dt, indent=2, ensure_ascii=False), encoding="utf-8")

    print("[DONE] Master + search_index + dossiers updated.")


if __name__ == "__main__":
    main()
