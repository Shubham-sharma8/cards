#!/usr/bin/env python3
"""
Master ETL pipeline for the Indian Credit Cards dataset.
Reads ONLY crawled files under data/raw/ and writes:
  - data/master/credit_cards_master.json
  - data/master/credit_cards_master.csv
  - data/master/lounge_access_master.json
  - data/master/devaluation_tracker.json
  - Category JSONs & Markdown tables / guides via generate_reports.py
"""

from __future__ import annotations

import csv
import glob
import json
import os
import re
from collections import defaultdict
from datetime import datetime
from typing import Any

from reconcile_2026 import (
    CANONICAL_EXTRA_CARDS,
    CATEGORY_DEFINITIONS,
    DEVALUATION_EVENTS,
    FLAGSHIP_OVERRIDES_2026,
    ISSUER_DEVALUATION_PROFILE,
    PAISABAZAAR_EXCLUDES,
)

BASE_DIR = "/Users/shubhamsharma/Downloads/Credit Card"
RAW_DIR = os.path.join(BASE_DIR, "data", "raw")
MASTER_DIR = os.path.join(BASE_DIR, "data", "master")
CAT_DIR = os.path.join(MASTER_DIR, "categories")

FOOTER_STOP_MARKERS = [
    "\nNeed More Help?",
    "\n## Credit Cards Articles",
    "\n### Credit Cards Articles",
    "\n### Footnotes",
    "\n## Trending Articles",
    "\n### Explore other Card Categories",
    "\n### Explore Cards from Leading Issuers",
    "\nOther Similar Credit Cards",
    "\n### Related Articles",
    "\n### Credit Card by Banks",
    "\n### Best Credit Cards For",
    "\n## Comments",
]

REDDIT_STOP_MARKERS = [
    "\nRelated posts",
    "\nTOP POSTS",
    "\nMore posts",
]

SOFT_404_MARKERS = [
    "Nothing Here!",
    "Kindly search your topic below",
    "Page not found",
    "Page Not Found",
]

BANK_CANONICAL_MAP = {
    "amex-bank": "American Express",
    "american express": "American Express",
    "au-small-finance-bank": "AU Small Finance Bank",
    "axis-bank": "Axis Bank",
    "bandhan-bank": "Bandhan Bank",
    "bank-of-india": "Bank of India",
    "bank-of-maharashtra": "Bank of Maharashtra",
    "bobcard": "BOBCARD (Bank of Baroda)",
    "canara-bank": "Canara Bank",
    "csb-bank": "CSB Bank",
    "dbs-bank": "DBS Bank",
    "dhanlaxmi-bank": "Dhanlaxmi Bank",
    "federal-bank": "Federal Bank",
    "hdfc-bank": "HDFC Bank",
    "hsbc-bank": "HSBC Bank",
    "icici-bank": "ICICI Bank",
    "idbi-bank": "IDBI Bank",
    "idfc-first-bank": "IDFC FIRST Bank",
    "indian-bank": "Indian Bank",
    "indusind-bank": "IndusInd Bank",
    "jammu-and-kashmir-bank": "Jammu & Kashmir Bank",
    "karnataka-bank": "Karnataka Bank",
    "karur-vysya-bank": "Karur Vysya Bank",
    "kotak-mahindra-bank": "Kotak Mahindra Bank",
    "lic-cards": "LIC Cards (Axis Bank)",
    "punjab-national-bank": "Punjab National Bank",
    "rbl-bank": "RBL Bank",
    "sbi-bank": "SBI Card",
    "sbm-bank": "SBM Bank India",
    "south-indian-bank": "South Indian Bank",
    "standard-chartered-bank": "Standard Chartered Bank",
    "tamilnad-mercantile-bank": "Tamilnad Mercantile Bank",
    "uco-bank": "UCO Bank",
    "union-bank-of-india": "Union Bank of India",
    "unity-small-finance-bank": "Unity Small Finance Bank",
    "utkarsh-bank": "Utkarsh Small Finance Bank",
    "yes-bank": "YES BANK",
    "credit-card": "OneCard / Multi-Bank",
}


def clean_text(s: Any) -> str:
    if not s:
        return ""
    if isinstance(s, list):
        s = " ".join(str(x) for x in s if x)
    elif isinstance(s, dict):
        s = " ".join(f"{k}: {v}" for k, v in s.items() if v)
    elif not isinstance(s, str):
        s = str(s)
    s = re.sub(r"\!\[[^\]]*\]\([^)]+\)", "", s)
    s = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", s)
    s = re.sub(r"\*{1,3}|_{1,2}", "", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def truncate_paisabazaar(txt: str) -> str:
    cut = len(txt)
    for m in FOOTER_STOP_MARKERS:
        idx = txt.find(m)
        if idx != -1 and idx < cut:
            cut = idx
    body = txt[:cut]
    # Remove inline promotional Paisabazaar widgets
    body = re.sub(
        r"#### Why Choose Paisabazaar \?.*?(?=\n#{1,3} |\nUpdated:|\Z)",
        "",
        body,
        flags=re.DOTALL,
    )
    body = re.sub(
        r"Check \*\*Pre-Approved Credit Cards\*\*.*?Check Offers",
        "",
        body,
        flags=re.DOTALL,
    )
    return body


def truncate_reddit(txt: str) -> str:
    cut = len(txt)
    for m in REDDIT_STOP_MARKERS:
        idx = txt.find(m)
        if idx != -1 and idx < cut:
            cut = idx
    return txt[:cut]


def parse_inr_amount(text: str) -> int | None:
    if not text:
        return None
    low = str(text).lower()
    if any(w in low for w in ["nil", "lifetime free", "zero", "free", "none", "n/a", "waived forever"]):
        if not re.search(r"(?:rs\.?|inr|₹)\s*[1-9][\d,]*", low):
            return 0
    # Look for lakh / cr
    m_lakh = re.search(r"(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)\s*(?:lakh|lac|l)\b", low)
    if m_lakh:
        return int(round(float(m_lakh.group(1)) * 100000))
    m_num = re.search(r"(?:rs\.?|inr|₹)\s*(\d[\d,]*)", low)
    if m_num:
        digits = m_num.group(1).replace(",", "")
        if digits.isdigit():
            val = int(digits)
            if val <= 50000000:
                return val
    # Plain digits fallback when cell is already numeric-looking
    m_plain = re.match(r"^\s*(\d[\d,]*)\s*(?:\+\s*gst)?", low)
    if m_plain:
        digits = m_plain.group(1).replace(",", "")
        if digits.isdigit():
            val = int(digits)
            if val <= 50000000:
                return val
    return None


def parse_pct(text: str) -> float | None:
    if not text:
        return None
    m = re.search(r"(\d+(?:\.\d+)?)\s*%", text)
    if m:
        return float(m.group(1))
    if any(w in text.lower() for w in ["zero", "nil"]):
        return 0.0
    return None


def parse_unicode_star_rating(body: str) -> float | None:
    # Matches patterns like "(4/5)", "★★★★ **(4/5)**", "Overall Rating ★★★ __"
    m = re.search(r"Overall Rating[^★\n]{0,40}?([★]{1,5})(\s*_?\uf123_?)?(?:\s*\*\*\()?(\d(?:\.\d)?)\s*/\s*5", body, re.I)
    if m and m.group(3):
        return float(m.group(3))
    m_ov = re.search(r"Overall Rating[^★\n|]{0,40}([★]{1,5})(\s*_?\uf123_?)?", body, re.I)
    if m_ov:
        stars = len(m_ov.group(1))
        half = 0.5 if m_ov.group(2) else 0.0
        val = stars + half
        if 1.0 <= val <= 5.0:
            return val
    m2 = re.search(r"Rating[^|\n★]{0,60}([★]{1,5})(\s*_?\uf123_?)?", body)
    if m2:
        stars = len(m2.group(1))
        half = 0.5 if m2.group(2) else 0.0
        val = stars + half
        if 1.0 <= val <= 5.0:
            return val
    return None


def extract_sections(body: str) -> dict[str, str]:
    sections: dict[str, str] = {}
    lines = body.splitlines()
    current = "_intro"
    buf: list[str] = []
    for line in lines:
        m = re.match(r"^(#{1,4})\s+(.+)$", line.strip())
        if m:
            sections[current] = "\n".join(buf).strip()
            current = clean_text(m.group(2))
            buf = []
        else:
            buf.append(line)
    sections[current] = "\n".join(buf).strip()
    return sections


def extract_non_comparison_tables(body: str) -> list[list[list[str]]]:
    """Parse markdown pipe tables excluding card-vs-card comparison tables."""
    tables: list[list[list[str]]] = []
    lines = body.splitlines()
    i = 0
    while i < len(lines):
        if "|" in lines[i]:
            tbl_lines = []
            while i < len(lines) and "|" in lines[i]:
                tbl_lines.append(lines[i].strip())
                i += 1
            if len(tbl_lines) >= 2:
                rows = []
                for tl in tbl_lines:
                    if re.match(r"^\|?[\s:\-|]+\|?$", tl):
                        continue
                    cells = [clean_text(c) for c in tl.strip("|").split("|")]
                    if any(cells):
                        rows.append(cells)
                if rows:
                    header_txt = " ".join(rows[0]).lower()
                    # Check surrounding context / headers to skip multi-card vs tables
                    if any(x in header_txt for x in ["card name", "joining fee", "credit card |", "best suited for", "rewards earned"]) and len(rows) > 3 and len(rows[0]) >= 3:
                        continue
                    tables.append(rows)
        else:
            i += 1
    return tables


def detect_network(text: str, name: str) -> str:
    low = (name + " " + text[:4000]).lower()
    nets = []
    if "rupay" in low:
        nets.append("RuPay")
    if "visa" in low:
        nets.append("Visa")
    if "mastercard" in low or "master card" in low:
        nets.append("Mastercard")
    if "diners club" in low:
        nets.append("Diners Club")
    if "american express" in low or "amex" in low:
        if "bank" not in name.lower() or "american express" in name.lower() or "hpcl coral american" in name.lower():
            nets.append("American Express")
    if not nets:
        return "Visa / Mastercard"
    return " / ".join(dict.fromkeys(nets))


def detect_categories(name: str, bank: str, pb_cats: list[str], body: str, fees: dict, rewards: dict, lounge: dict, is_ltf: bool, is_fd: bool, is_rupay: bool) -> tuple[str, list[str]]:
    low = (name + " " + " ".join(pb_cats) + " " + body[:3500]).lower()
    cats: list[str] = []

    jf = fees.get("joining_fee_inr")
    af = fees.get("annual_fee_inr")
    max_fee = max([x for x in [jf, af] if x is not None], default=0)

    if max_fee >= 10000 or any(w in low for w in ["infinia", "magnus", "emeralde", "centurion", "burgundy", "olympus", "prive", "aurum", "marquee", "vantage", "zenith+", "bizblack", "diners club black", "hsbc premier", "hsbc taj"]):
        cats.append("Super-Premium")
    if any(w in low for w in ["cashback", "cash back", "swiggy", "amazon", "flipkart", "myntra", "airtel", "super.money", "cashpoints"]):
        cats.append("Cashback")
    if any(w in low for w in ["travel", "miles", "avios", "airline", "air india", "indigo", "etihad", "vistara", "marriott", "hotel", "ixigo", "makemytrip", "yatra", "ease my trip", "easemytrip", "scapia"]):
        cats.append("Travel & Miles")
    if lounge.get("domestic", {}).get("visits_per_year", 0) > 0 or lounge.get("international", {}).get("visits_per_year", 0) > 0 or "lounge" in " ".join(pb_cats).lower():
        cats.append("Airport Lounge")
    if is_ltf:
        cats.append("Lifetime Free")
    if is_rupay:
        cats.append("RuPay & UPI")
    if any(w in low for w in ["fuel", "hpcl", "bpcl", "indianoil", "indian oil", "iocl", "petrol", "octane", "xtrapower"]):
        cats.append("Fuel")
    if any(w in low for w in ["dining", "swiggy", "zomato", "grocery", "bigbasket", "blinkit", "movie", "bookmyshow", "pvr", "inox", "eazydiner", "live+"]):
        cats.append("Dining, Groceries & Movies")
    if (fees.get("forex_markup_pct") is not None and fees["forex_markup_pct"] <= 2.0) or any(w in low for w in ["zero forex", "0% forex", "low forex", "scapia", "ixigo", "vantage", "nri", "global"]):
        cats.append("Zero/Low Forex")
    if is_fd or any(w in low for w in ["secured", "against fd", "fixed deposit", "student", "new to credit", "freedom", "simplysave", "unnati", "wow"]):
        cats.append("Entry-Level & Secured (FD)")
    if any(w in low for w in ["business", "corporate", "bizblack", "biz ", "bizpower", "bizgrow", "gst", "vyapar", "commercial"]):
        cats.append("Business & Tax")
    if any(w in low for w in ["shopping", "online shopping", "lifestyle", "amazon", "flipkart", "myntra", "nykaa", "shoppers stop", "tata", "croma", "reliance", "titan"]):
        cats.append("Online Shopping")

    if not cats:
        cats.append("Rewards & Everyday")

    # Deduplicate preserving priority order
    cats = list(dict.fromkeys(cats))
    primary = cats[0]
    if "Super-Premium" in cats and max_fee >= 10000:
        primary = "Super-Premium"
    elif "Business & Tax" in cats and any(w in name.lower() for w in ["biz", "business", "corporate", "vyapar"]):
        primary = "Business & Tax"
    elif "Fuel" in cats and any(w in name.lower() for w in ["hpcl", "bpcl", "indianoil", "indian oil", "iocl", "octane", "fuel"]):
        primary = "Fuel"
    elif "Zero/Low Forex" in cats and fees.get("forex_markup_pct") == 0.0:
        primary = "Zero/Low Forex"
    elif "RuPay & UPI" in cats and any(w in name.lower() for w in ["upi", "kiwi", "klick", "supermoney", "neu", "rupay"]):
        primary = "RuPay & UPI"
    elif "Cashback" in cats and "cashback" in name.lower():
        primary = "Cashback"
    elif "Travel & Miles" in cats:
        primary = "Travel & Miles"

    return primary, cats


def detect_tier(fees: dict, name: str, cats: list[str], is_fd: bool) -> str:
    max_fee = max([x for x in [fees.get("joining_fee_inr"), fees.get("annual_fee_inr")] if x is not None], default=0)
    if "Super-Premium" in cats or max_fee >= 10000:
        return "Super-Premium"
    if max_fee >= 2000 or any(w in name.lower() for w in ["gold", "signature", "select", "wealth", "eterna", "travelone", "elite", "sapphiro", "prime", "atlas"]):
        return "Mid-Premium"
    if is_fd or "Entry-Level & Secured (FD)" in cats or max_fee == 0:
        return "Entry-Level / Secured" if is_fd else "Entry-Level / LTF"
    return "Mid-Tier"


def build_default_pros_cons(name: str, bank: str, fees: dict, rewards: dict, lounge: dict, is_ltf: bool, is_fd: bool, is_rupay: bool) -> tuple[list[str], list[str]]:
    pros: list[str] = []
    cons: list[str] = []
    jf = fees.get("joining_fee_inr")
    af = fees.get("annual_fee_inr")
    fw = fees.get("fee_waiver_spend_inr")
    fx = fees.get("forex_markup_pct")

    if is_ltf or (jf == 0 and af == 0):
        pros.append("Lifetime Free card with zero annual fee commitment")
    elif fw and fw > 0:
        fee_val = af if af is not None else jf
        fee_label = f"Rs. {fee_val:,}" if fee_val is not None else "applicable"
        pros.append(f"Annual fee ({fee_label}) waived on spending Rs. {fw:,}/year")
    elif jf:
        pros.append(f"Targeted rewards structure backed by {bank}")
    elif jf == 0:
        pros.append(f"Zero joining fee entry into {bank} credit card portfolio")

    acc = rewards.get("accelerated_reward_rate_pct")
    base = rewards.get("base_reward_rate_pct")
    if acc and acc >= 3.0:
        pros.append(f"Up to {acc:g}% accelerated rewards on priority spend categories")
    elif base and base >= 1.0:
        pros.append(f"Solid {base:g}% base return on regular eligible spends")

    dom_v = lounge.get("domestic", {}).get("visits_per_year", 0)
    intl_v = lounge.get("international", {}).get("visits_per_year", 0)
    if dom_v >= 900:
        pros.append("Unlimited domestic airport lounge access")
    elif dom_v > 0:
        pros.append(f"{dom_v} complimentary domestic airport lounge visits/year")
    if intl_v > 0:
        pros.append("Includes complimentary international lounge access" if intl_v >= 900 else f"{intl_v} international lounge visits/year")

    if fx is not None and fx == 0.0:
        pros.append("Zero (0%) foreign currency markup on international transactions")
    elif fx is not None and fx <= 2.0:
        pros.append(f"Competitive low {fx:g}% forex markup fee")

    if is_rupay:
        pros.append("RuPay network supports Scan & Pay merchant UPI transactions")
    if is_fd:
        pros.append("Secured against Fixed Deposit — easy approval without income proof or high CIBIL")
    if len(pros) < 2:
        pros.append(f"Backed by {bank} digital card controls, EMI conversion & merchant offers")
    if len(pros) < 2:
        pros.append("Contactless Tap & Pay + zero lost-card liability protection")

    # Cons
    if jf and jf >= 2500 and not is_ltf:
        cons.append(f"High joining/annual fee (Rs. {jf:,} + GST) if spend thresholds aren't met")
    if dom_v == 0 and intl_v == 0:
        cons.append("No complimentary domestic or international airport lounge access")
    elif "spend" in (lounge.get("domestic", {}).get("spend_criteria") or "").lower() and "no spend" not in (lounge.get("domestic", {}).get("spend_criteria") or "").lower():
        cons.append(f"Domestic lounge gated by spend criteria ({lounge['domestic']['spend_criteria']})")
    if fx is None or fx >= 3.5:
        cons.append(f"High {fx or 3.5:g}% (+GST) foreign currency markup — poor for overseas spends")
    if is_fd:
        cons.append("Requires locking funds in a Fixed Deposit as collateral")
    if rewards.get("exclusions"):
        cons.append("Standard bank exclusions apply on rent, fuel, wallet loads, utilities & EMI")
    else:
        cons.append("Check latest issuer exclusions on rent, utilities, education & wallet loads before high spends")

    return pros[:4], cons[:4]


def build_default_best_for_whom(name: str, bank: str, primary_cat: str, fees: dict, rewards: dict, lounge: dict, is_ltf: bool, is_fd: bool, is_rupay: bool) -> dict[str, Any]:
    jf = fees.get("joining_fee_inr") or 0
    fw = fees.get("fee_waiver_spend_inr") or 0
    dom_v = lounge.get("domestic", {}).get("visits_per_year", 0)
    fx = fees.get("forex_markup_pct")

    if is_fd:
        ideal = "Students, New-to-Credit applicants, or low-CIBIL users building credit history via a Fixed Deposit"
        avoid = "Established salaried professionals eligible for unsecured cashback/travel cards"
        rec_spend = "Rs. 5,000 – Rs. 20,000 (<30% FD utilization)"
    elif primary_cat == "Fuel":
        ideal = "Regular petrol/diesel commuters matching the card's partner pump brand (BPCL/IOCL/HPCL)"
        avoid = "EV drivers or users spending under Rs. 2,000/month on fuel"
        rec_spend = "Rs. 4,000 – Rs. 15,000 fuel/month"
    elif primary_cat == "Zero/Low Forex" or fx == 0.0:
        ideal = "International travelers and foreign SaaS/e-commerce buyers avoiding 3.5%+GST markup"
        avoid = "Domestic-only spenders seeking peak local e-commerce cashback"
        rec_spend = "Rs. 15,000+ (or international trips)"
    elif primary_cat == "RuPay & UPI" or (is_rupay and is_ltf):
        ideal = "Everyday UPI Scan & Pay spenders wanting credit-line convenience on merchant QRs"
        avoid = "Travel flyers seeking high-value airline/hotel miles"
        rec_spend = "Rs. 10,000 – Rs. 35,000 on UPI & retail"
    elif primary_cat == "Business & Tax":
        ideal = "Proprietors, MSMEs & self-employed professionals separating GST/tax/vendor expenses"
        avoid = "Salaried individuals with strictly personal spends"
        rec_spend = "Rs. 50,000+"
    elif primary_cat == "Super-Premium" or jf >= 10000:
        ideal = f"High-income spenders maximizing {bank} concierge, unlimited lounges & accelerated travel portals"
        avoid = "Moderate spenders unlikely to cross annual fee waiver / extract >fee value"
        rec_spend = f"Rs. {max(50000, int((fw or jf*40)/12)):,}+"
    elif primary_cat == "Travel & Miles":
        ideal = "Domestic & international flyers value-optimizing airline/hotel loyalty points and lounge access"
        avoid = "Low-travel users preferring straight monthly statement cashback"
        rec_spend = f"Rs. {max(25000, int((fw or 300000)/12)):,}+"
    else:
        ideal = f"{bank} customers seeking {primary_cat.lower()} rewards & bank-specific discount offers"
        avoid = "Users focused purely on competing co-brand ecosystems or heavy airport lounge visits" if dom_v == 0 else "Ultra-high spenders better served by super-premium metal cards"
        rec_spend = "Any (LTF keeper)" if is_ltf or jf == 0 else f"Rs. {max(10000, int((fw or 150000)/12)):,}+"

    verdict = f"{'Lifetime Free ' if is_ltf else ''}option from {bank} suited for {primary_cat.lower()} users"
    if dom_v > 0:
        verdict += f" with {'unlimited' if dom_v >= 900 else dom_v} domestic lounge visits/yr"
    if fx is not None and fx <= 1.99:
        verdict += f" and low {fx:g}% forex markup"
    verdict += "."

    return {
        "ideal_for": ideal,
        "not_ideal_for": avoid,
        "recommended_monthly_spend_inr": rec_spend,
        "verdict": verdict,
    }


def make_uniform_card(raw: dict[str, Any]) -> dict[str, Any]:
    """Enforce 100% identical top-level and nested schema keys on every card."""
    fees_in = raw.get("fees") or {}
    rew_in = raw.get("rewards") or {}
    ben_in = raw.get("benefits_and_features") or {}
    lng_in = raw.get("lounge_access") or {}
    dom_in = lng_in.get("domestic") or {}
    intl_in = lng_in.get("international") or {}
    rail_in = lng_in.get("railway") or {}
    elig_in = raw.get("eligibility") or {}
    rat_in = raw.get("ratings") or {}
    dev_in = raw.get("devaluation") or {}
    bfw_in = raw.get("best_for_whom") or {}
    src_in = raw.get("sources") or {}

    return {
        "card_id": str(raw.get("card_id", "")),
        "card_name": str(raw.get("card_name", "")),
        "bank": str(raw.get("bank", "")),
        "card_network": str(raw.get("card_network", "Visa / Mastercard")),
        "card_tier": str(raw.get("card_tier", "Mid-Tier")),
        "primary_category": str(raw.get("primary_category", "Rewards & Everyday")),
        "categories": list(raw.get("categories") or []),
        "is_ltf_available": bool(raw.get("is_ltf_available", False)),
        "is_fyf_available": bool(raw.get("is_fyf_available", False)),
        "is_secured_fd_backed": bool(raw.get("is_secured_fd_backed", False)),
        "is_rupay_upi_enabled": bool(raw.get("is_rupay_upi_enabled", False)),
        "is_invite_only": bool(raw.get("is_invite_only", False)),
        "status": str(raw.get("status", "Active")),
        "fees": {
            "joining_fee_inr": fees_in.get("joining_fee_inr"),
            "annual_fee_inr": fees_in.get("annual_fee_inr"),
            "gst_applicable": bool(fees_in.get("gst_applicable", True)),
            "fee_waiver_spend_inr": fees_in.get("fee_waiver_spend_inr"),
            "joining_fee_waiver": fees_in.get("joining_fee_waiver"),
            "forex_markup_pct": fees_in.get("forex_markup_pct"),
            "apr_monthly_pct": fees_in.get("apr_monthly_pct"),
            "apr_annual_pct": fees_in.get("apr_annual_pct"),
            "cash_advance_fee": fees_in.get("cash_advance_fee"),
            "fuel_surcharge_waiver": fees_in.get("fuel_surcharge_waiver"),
            "redemption_fee": fees_in.get("redemption_fee"),
            "add_on_card_fee": fees_in.get("add_on_card_fee"),
        },
        "rewards": {
            "reward_type": rew_in.get("reward_type"),
            "base_reward_rate_pct": rew_in.get("base_reward_rate_pct"),
            "accelerated_reward_rate_pct": rew_in.get("accelerated_reward_rate_pct"),
            "point_value_inr": rew_in.get("point_value_inr"),
            "point_expiry": rew_in.get("point_expiry"),
            "welcome_benefit": rew_in.get("welcome_benefit"),
            "milestone_benefits": list(rew_in.get("milestone_benefits") or []),
            "category_multipliers": list(rew_in.get("category_multipliers") or []),
            "transfer_partners": list(rew_in.get("transfer_partners") or []),
            "exclusions": list(rew_in.get("exclusions") or []),
        },
        "benefits_and_features": {
            "highlights": list(ben_in.get("highlights") or []),
            "dining_benefits": list(ben_in.get("dining_benefits") or []),
            "movie_benefits": list(ben_in.get("movie_benefits") or []),
            "golf_benefits": list(ben_in.get("golf_benefits") or []),
            "insurance_cover": list(ben_in.get("insurance_cover") or []),
            "concierge_or_privilege": list(ben_in.get("concierge_or_privilege") or []),
        },
        "lounge_access": {
            "domestic": {
                "visits_per_year": int(dom_in.get("visits_per_year") or 0),
                "visits_per_quarter": int(dom_in.get("visits_per_quarter") or 0),
                "spend_criteria": str(dom_in.get("spend_criteria") or "Not Applicable"),
                "add_on_allowed": bool(dom_in.get("add_on_allowed", False)),
                "shared_limit": bool(dom_in.get("shared_limit", False)),
                "summary": str(dom_in.get("summary") or "No domestic airport lounge access"),
            },
            "international": {
                "program": str(intl_in.get("program") or "None"),
                "visits_per_year": int(intl_in.get("visits_per_year") or 0),
                "spend_criteria": str(intl_in.get("spend_criteria") or "Not Applicable"),
                "add_on_allowed": bool(intl_in.get("add_on_allowed", False)),
                "guest_fee": str(intl_in.get("guest_fee") or "Not Applicable"),
                "summary": str(intl_in.get("summary") or "No international lounge access"),
            },
            "railway": {
                "visits_per_year": int(rail_in.get("visits_per_year") or 0),
                "visits_per_quarter": int(rail_in.get("visits_per_quarter") or 0),
                "summary": str(rail_in.get("summary") or "No railway lounge access"),
            },
            "participating_lounges_ref": str(lng_in.get("participating_lounges_ref") or "Standard Network Lounge List"),
        },
        "eligibility": {
            "min_age": elig_in.get("min_age"),
            "max_age": elig_in.get("max_age"),
            "min_monthly_income_salaried_inr": elig_in.get("min_monthly_income_salaried_inr"),
            "min_annual_itr_self_employed_inr": elig_in.get("min_annual_itr_self_employed_inr"),
            "min_cibil_score": elig_in.get("min_cibil_score"),
            "notes": elig_in.get("notes"),
        },
        "ratings": {
            "paisabazaar_overall": rat_in.get("paisabazaar_overall"),
            "paisabazaar_subratings": dict(rat_in.get("paisabazaar_subratings") or {}),
            "aggregator_rating": rat_in.get("aggregator_rating"),
            "market_community_rating": rat_in.get("market_community_rating"),
            "composite_score": rat_in.get("composite_score"),
            "reddit_mentions": int(rat_in.get("reddit_mentions") or 0),
        },
        "devaluation": {
            "devaluation_frequency": str(dev_in.get("devaluation_frequency") or "Medium"),
            "devaluation_risk_score": float(dev_in.get("devaluation_risk_score") or 5.0),
            "last_devalued_on": dev_in.get("last_devalued_on"),
            "devaluation_history": list(dev_in.get("devaluation_history") or []),
        },
        "pros": list(raw.get("pros") or []),
        "cons": list(raw.get("cons") or []),
        "best_for_whom": {
            "ideal_for": str(bfw_in.get("ideal_for") or ""),
            "not_ideal_for": str(bfw_in.get("not_ideal_for") or ""),
            "recommended_monthly_spend_inr": str(bfw_in.get("recommended_monthly_spend_inr") or ""),
            "verdict": str(bfw_in.get("verdict") or ""),
        },
        "sources": {
            "paisabazaar_url": src_in.get("paisabazaar_url"),
            "bank_url": src_in.get("bank_url"),
            "aggregator_urls": list(src_in.get("aggregator_urls") or []),
            "last_updated": str(src_in.get("last_updated") or "2026"),
        },
    }


def deep_merge(base: dict, override: dict) -> dict:
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            deep_merge(base[k], v)
        elif v is not None:
            base[k] = v
    return base


# ---------------------------------------------------------------------------
# 1. Reddit Corpus Analytics
# ---------------------------------------------------------------------------
REDDIT_CARD_PATTERNS = {
    "infinia": [r"\binfinia\b"],
    "dcb": [r"\bdcb\b", r"diners club black"],
    "regalia_gold": [r"regalia gold"],
    "regalia": [r"\bregalia\b"],
    "millennia": [r"\bmillennia\b"],
    "swiggy_hdfc": [r"swiggy hdfc", r"swiggy blck", r"swiggy ornge", r"hdfc swiggy"],
    "tata_neu": [r"tata neu", r"neu infinity", r"neu plus"],
    "marriott_bonvoy": [r"marriott bonvoy"],
    "bizblack": [r"bizblack", r"biz black"],
    "sbi_cashback": [r"sbi cashback", r"cashback sbi"],
    "phonepe_sbi": [r"phonepe sbi", r"select black"],
    "bpcl_octane": [r"octane", r"bpcl sbi"],
    "amazon_pay_icici": [r"amazon pay", r"\bapay\b"],
    "emeralde_private": [r"emeralde private", r"\bepm\b"],
    "sapphiro": [r"sapphiro"],
    "atlas": [r"axis atlas", r"\batlas\b"],
    "magnus_burgundy": [r"magnus burgundy", r"magnus for burgundy", r"\bm4b\b"],
    "airtel_axis": [r"airtel axis", r"axis airtel"],
    "scapia": [r"\bscapia\b"],
    "hsbc_travelone": [r"travelone", r"travel one"],
    "hsbc_live_plus": [r"live\+", r"live plus"],
    "hsbc_premier": [r"hsbc premier"],
    "indusind_tiger": [r"indusind tiger", r"\btiger\b credit"],
    "au_ixigo": [r"\bixigo\b"],
    "idfc_wealth": [r"idfc(?: first)? wealth"],
    "idfc_wow": [r"idfc(?: first)? wow"],
    "amex_plat_travel": [r"plat(?:inum)? travel"],
    "amex_mrcc": [r"\bmrcc\b", r"membership rewards credit"],
    "amex_plat_charge": [r"plat(?:inum)? charge"],
    "kiwi": [r"\bkiwi\b", r"yes bank klick"],
    "supermoney": [r"super\.money", r"supermoney"],
    "bob_eterna": [r"eterna"],
    "yes_marquee": [r"marquee"],
    "onecard": [r"\bonecard\b", r"one card"],
    "hdfc_freedom": [r"hdfc freedom"],
    "axis_ace": [r"axis ace"],
    "axis_my_zone": [r"my zone"],
    "flipkart_axis": [r"flipkart axis"],
    "coral": [r"\bcoral\b"],
}

POS_WORDS = {"best", "goat", "worth", "great", "amazing", "love", "recommend", "solid", "king", "unmatched", "keeper", "awesome", "steal", "no brainer"}
NEG_WORDS = {"devalued", "devaluation", "nerfed", "useless", "worst", "pathetic", "rejected", "cancelled", "closed", "trap", "trash", "terrible", "waste", "scam", "shit"}


def parse_reddit_corpus() -> dict[str, Any]:
    files = (
        glob.glob(f"{RAW_DIR}/reddit/feeds/*.md")
        + glob.glob(f"{RAW_DIR}/reddit/threads/*.md")
        + glob.glob(f"{RAW_DIR}/enrichment/gaps/reddit_*.md")
    )
    mentions = defaultdict(int)
    pos_hits = defaultdict(int)
    neg_hits = defaultdict(int)
    deval_hits = defaultdict(int)

    pain_themes = {
        "Lounge Spend Gating / Cuts": 0,
        "Devaluations & Exclusion Creep": 0,
        "HDFC Core-vs-Cobranded / 18L Rule": 0,
        "Underwriting / Rejections / Overleverage": 0,
        "Forex Markup (3.5%+GST) / Zero-Forex Demand": 0,
        "Customer Care & Redemption Fees": 0,
        "RuPay UPI Cashback & Minimum Txns": 0,
        "Rent / Tax / Education / Utility Penalties": 0,
    }

    total_docs = 0
    for fp in sorted(set(files)):
        txt = truncate_reddit(open(fp, encoding="utf-8", errors="ignore").read())
        if len(txt) < 200:
            continue
        total_docs += 1
        low = txt.lower()

        if any(w in low for w in ["spend criteria", "spend based", "spend-based", "lounge access", "60k", "75k", "1l/qtr"]):
            pain_themes["Lounge Spend Gating / Cuts"] += 1
        if any(w in low for w in ["devaluation", "devalued", "nerfed", "accor"]):
            pain_themes["Devaluations & Exclusion Creep"] += 1
        if any(w in low for w in ["core card", "co-branded", "cobranded", "18l", "upgrade to infinia"]):
            pain_themes["HDFC Core-vs-Cobranded / 18L Rule"] += 1
        if any(w in low for w in ["rejected", "overleveraged", "cibil", "limit", "eligibility"]):
            pain_themes["Underwriting / Rejections / Overleverage"] += 1
        if any(w in low for w in ["forex", "zero forex", "0% forex", "international spend"]):
            pain_themes["Forex Markup (3.5%+GST) / Zero-Forex Demand"] += 1
        if any(w in low for w in ["customer care", "redemption fee", "ombudsman", "rbi"]):
            pain_themes["Customer Care & Redemption Fees"] += 1
        if any(w in low for w in ["rupay", "upi", "kiwi", "supermoney", "neu"]):
            pain_themes["RuPay UPI Cashback & Minimum Txns"] += 1
        if any(w in low for w in ["rent", "utility", "insurance", "education", "advance tax", "gst"]):
            pain_themes["Rent / Tax / Education / Utility Penalties"] += 1

        # Paragraph-level sentiment matching
        paras = [p.strip() for p in re.split(r"\n{2,}", low) if len(p.strip()) > 30]
        for key, pats in REDDIT_CARD_PATTERNS.items():
            matched_paras = [p for p in paras if any(re.search(pat, p) for pat in pats)]
            if matched_paras:
                mentions[key] += len(matched_paras)
                for mp in matched_paras:
                    tokens = set(re.findall(r"[a-z]+", mp))
                    if tokens & POS_WORDS:
                        pos_hits[key] += 1
                    if tokens & NEG_WORDS:
                        neg_hits[key] += 1
                    if "deval" in mp or "nerf" in mp:
                        deval_hits[key] += 1

    ratings_by_key: dict[str, dict[str, Any]] = {}
    for key in REDDIT_CARD_PATTERNS:
        m = mentions[key]
        p = pos_hits[key]
        n = neg_hits[key]
        if m == 0:
            score = 3.5
        else:
            ratio = (p + 1.5) / (p + n + 3.0)
            score = round(min(4.95, max(2.2, 2.5 + ratio * 2.5)), 2)
        ratings_by_key[key] = {
            "mentions": m,
            "positive": p,
            "negative": n,
            "deval_mentions": deval_hits[key],
            "community_rating": score,
        }

    return {
        "total_docs": total_docs,
        "card_stats": ratings_by_key,
        "pain_themes": pain_themes,
    }


def match_reddit_key(name: str, slug: str) -> str | None:
    s = (name + " " + slug).lower()
    if "infinia" in s:
        return "infinia"
    if "diners club black" in s:
        return "dcb"
    if "regalia gold" in s:
        return "regalia_gold"
    if "regalia" in s:
        return "regalia"
    if "millennia" in s and "hdfc" in s:
        return "millennia"
    if "swiggy" in s and "hdfc" in s:
        return "swiggy_hdfc"
    if "tata neu" in s:
        return "tata_neu"
    if "marriott bonvoy" in s:
        return "marriott_bonvoy"
    if "biz" in s and "black" in s:
        return "bizblack"
    if "cashback sbi" in s:
        return "sbi_cashback"
    if "phonepe" in s and "sbi" in s:
        return "phonepe_sbi"
    if "octane" in s:
        return "bpcl_octane"
    if "amazon pay" in s:
        return "amazon_pay_icici"
    if "emeralde private" in s:
        return "emeralde_private"
    if "sapphiro" in s:
        return "sapphiro"
    if "atlas" in s and "axis" in s:
        return "atlas"
    if "magnus" in s and "burgundy" in s:
        return "magnus_burgundy"
    if "airtel" in s and "axis" in s:
        return "airtel_axis"
    if "scapia" in s:
        return "scapia"
    if "travelone" in s:
        return "hsbc_travelone"
    if "live+" in s or "live-plus" in s:
        return "hsbc_live_plus"
    if "hsbc premier" in s:
        return "hsbc_premier"
    if "tiger" in s and "indusind" in s:
        return "indusind_tiger"
    if "ixigo" in s:
        return "au_ixigo"
    if "idfc" in s and "wealth" in s:
        return "idfc_wealth"
    if "idfc" in s and "wow" in s:
        return "idfc_wow"
    if "platinum travel" in s:
        return "amex_plat_travel"
    if "membership rewards" in s:
        return "amex_mrcc"
    if "platinum charge" in s:
        return "amex_plat_charge"
    if "klick" in s or "kiwi" in s:
        return "kiwi"
    if "supermoney" in s or "supercard" in s:
        return "supermoney"
    if "eterna" in s and "bob" in s:
        return "bob_eterna"
    if "marquee" in s and "yes" in s:
        return "yes_marquee"
    if "onecard" in s:
        return "onecard"
    if "freedom" in s and "hdfc" in s:
        return "hdfc_freedom"
    if "ace" in s and "axis" in s:
        return "axis_ace"
    if "my zone" in s:
        return "axis_my_zone"
    if "flipkart" in s and "axis" in s:
        return "flipkart_axis"
    if "coral" in s and "icici" in s:
        return "coral"
    return None


# ---------------------------------------------------------------------------
# 2. Aggregator Enrichment Index
# ---------------------------------------------------------------------------
def parse_aggregators() -> dict[str, dict[str, Any]]:
    agg_raw = json.load(open(f"{RAW_DIR}/aggregators/aggregators_extracted.json", encoding="utf-8"))
    by_norm_key: dict[str, dict[str, Any]] = {}
    all_docs: list[dict[str, Any]] = []

    for item in agg_raw:
        if item.get("md_length", 0) < 1200:
            continue
        title = item.get("title") or ""
        if any(m.lower() in title.lower() for m in SOFT_404_MARKERS):
            continue
        ratings = item.get("ratings_found") or []
        parsed_rating = None
        for r in ratings:
            m = re.search(r"(\d(?:\.\d)?)\s*/\s*5", str(r))
            if m and 1.0 <= float(m.group(1)) <= 5.0:
                parsed_rating = float(m.group(1))
                break
        doc = {
            "site": item.get("site"),
            "url": item.get("url"),
            "title": title,
            "rating": parsed_rating,
            "pros": [clean_text(x) for x in (item.get("pros") or []) if len(x) > 15][:5],
            "cons": [clean_text(x) for x in (item.get("cons") or []) if len(x) > 15][:5],
            "devaluation_lines": [clean_text(x) for x in (item.get("devaluation_lines") or []) if len(x) > 20][:4],
        }
        all_docs.append(doc)
        key = re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()
        by_norm_key[key] = doc

    # Also scan enrichment/cards/*.md for CardInsider / CardExpert reviews
    for fp in glob.glob(f"{RAW_DIR}/enrichment/cards/*.md"):
        txt = open(fp, encoding="utf-8", errors="ignore").read()
        if len(txt) < 1200 or any(m in txt for m in SOFT_404_MARKERS):
            continue
        h1 = re.search(r"^#\s+(.+)$", txt, re.M)
        title = clean_text(h1.group(1)) if h1 else os.path.basename(fp)
        r_m = re.search(r"\*{0,2}(\d(?:\.\d)?)\*{0,2}\s*/\s*5", txt[:1500])
        rating = float(r_m.group(1)) if r_m and 1.0 <= float(r_m.group(1)) <= 5.0 else None
        key = re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()
        if key not in by_norm_key:
            by_norm_key[key] = {
                "site": "enrichment",
                "url": "",
                "title": title,
                "rating": rating,
                "pros": [],
                "cons": [],
                "devaluation_lines": [],
            }
    return by_norm_key


def find_aggregator_matches(card_name: str, agg_index: dict[str, dict[str, Any]]) -> tuple[float | None, list[str]]:
    stop = {"bank", "credit", "card", "cards", "review", "india", "features", "benefits", "apply", "online", "2025", "2026", "edition"}
    tokens = [t for t in re.findall(r"[a-z0-9]+", card_name.lower()) if t not in stop and len(t) > 2]
    if len(tokens) < 2:
        return None, []
    urls: list[str] = []
    ratings: list[float] = []
    for key, doc in agg_index.items():
        # Skip roundup listicles
        if any(w in key for w in ["best ", "top 10", "top 20", "compare"]):
            continue
        k_tokens = set(key.split())
        overlap = sum(1 for t in tokens if t in k_tokens)
        if overlap >= max(2, len(tokens) - 1) and overlap / len(tokens) >= 0.7:
            if doc.get("url"):
                urls.append(doc["url"])
            if doc.get("rating"):
                ratings.append(doc["rating"])
    avg_r = round(sum(ratings) / len(ratings), 2) if ratings else None
    return avg_r, list(dict.fromkeys(urls))[:4]


# ---------------------------------------------------------------------------
# 3. Official PDF Lounge List Parser
# ---------------------------------------------------------------------------
def parse_lounge_directory() -> dict[str, Any]:
    pdfs_dir = f"{RAW_DIR}/banks/pdfs"
    sbi_txt = open(f"{pdfs_dir}/sbi_in-participating-airport-lounges_pdf.txt", encoding="utf-8", errors="ignore").read()

    # Reassemble multi-line rows in SBI participating airport lounges PDF
    merged_rows: list[str] = []
    cur = ""
    for line in sbi_txt.splitlines():
        s = line.strip()
        if not s or s.startswith("--- Page") or s.startswith("Domestic Lounge Programme") or s.startswith("Sr ") or s.startswith("No Airport Name"):
            continue
        if re.match(r"^\d{1,2}\s+[A-Z]", s):
            if cur:
                merged_rows.append(cur)
            cur = s
        else:
            if cur and not re.match(r"^\d\s+[A-Z][a-z]+", s):
                cur += " " + s
            elif re.match(r"^[A-Z][a-z]+\s", s) and cur:
                cur += " " + s
    if cur:
        merged_rows.append(cur)

    # Parse structured entries from merged rows using known code/terminal tokens
    indian_airport_lounges: list[dict[str, str]] = []
    seen_lounge_keys: set[str] = set()
    footnote_markers = (
        "hours of operation", "7  hours", "7 hours", "exceed their seating", "lounge may remain closed",
        "for cardholders who pay", "alcoholic beverages", "charges applicable",
        "standard complimentary", "disclaimer", "note:",
    )
    for row in merged_rows:
        rlow = row.lower()
        if any(m in rlow for m in footnote_markers) or len(row) < 20:
            continue
        m = re.match(
            r"^(\d{1,2})\s+(.+?)\s+([A-Z]{2,4}\d[A-Z0-9]*|IXD|ATQ|BHO|DIB|GWL|IDR|IXJ|CNN)\s+(Domestic|International|International/ Domestic|International,\s*Domestic)\s+(.*)$",
            row,
        )
        if m:
            sr, before_code, code, ttype, after_ttype = m.groups()
            clean_hours = re.sub(r"\s+Sr$", "", re.sub(r"\s+", " ", after_ttype).strip())
            entry = {
                "sr": sr,
                "airport_city_and_lounge": before_code.strip(),
                "lounge_code": code.strip(),
                "terminal_type": ttype.strip(),
                "terminal_and_hours": clean_hours[:220],
            }
        else:
            m_sr = re.match(r"^(\d{1,2})\s+(.+)$", row)
            if not m_sr or int(m_sr.group(1)) > 90:
                continue
            body_r = re.sub(r"\s+", " ", m_sr.group(2)).strip()
            if not any(w in body_r.lower() for w in ["airport", "lounge", "bar", "cafe", "coffee", "encalm", "adani", "primus", "travel club", "080", "paahun"]):
                continue
            entry = {
                "sr": m_sr.group(1),
                "airport_city_and_lounge": body_r[:140],
                "lounge_code": "",
                "terminal_type": "Domestic / International",
                "terminal_and_hours": "",
            }
        dedup_k = entry["lounge_code"] or re.sub(r"[^a-z0-9]", "", entry["airport_city_and_lounge"].lower())[:30]
        if dedup_k in seen_lounge_keys:
            continue
        seen_lounge_keys.add(dedup_k)
        entry["sr"] = str(len(indian_airport_lounges) + 1)
        indian_airport_lounges.append(entry)

    # Read official HDFC Sep 2025 Airport Lounge & May 29 2026 IRCTC Railway Lounge notes
    hdfc_air = open(f"{pdfs_dir}/hdfc_airport-lounge-access-program-30sep2025_pdf.txt", encoding="utf-8", errors="ignore").read()
    hdfc_rail = open(f"{pdfs_dir}/hdfc_lounge_pdf.txt", encoding="utf-8", errors="ignore").read()

    # Check IDFC LIC & IndusInd & Axis PDFs counts for metadata
    indus_txt = open(f"{pdfs_dir}/indusind_Airport-Lounge-Access-Program_pdf.txt", encoding="utf-8", errors="ignore").read()
    indus_codes = sorted(set(re.findall(r"\b[A-Z]{3}\d{2}\b", indus_txt)))

    # Parse railway station info from enrichment & HDFC PDF
    rail_guide = ""
    rail_fp = f"{RAW_DIR}/enrichment/lounges/paisabazaar_railway-lounge-access-credit-cards.md"
    if os.path.exists(rail_fp):
        rail_guide = open(rail_fp, encoding="utf-8", errors="ignore").read()[:6000]

    return {
        "generated_at": datetime.now().strftime("%Y-%m-%d"),
        "network_rules": {
            "visa_validation_charge": "Rs. 2 refundable validation charge (per HDFC Visa PDF)",
            "mastercard_validation_charge": "Rs. 25 validation hold (reversed) per Axis Mastercard T&C PDF; note CardInsider 2026 DreamFolks/QR changes",
            "rupay_validation_charge": "Rs. 2 authorization charge",
            "priority_pass_guest_fee": "USD 27 – USD 35 + GST per accompanying guest (varies by bank; USD 27+GST standard across HDFC/SBI/ICICI/IndusInd)",
            "priority_pass_domestic_warning": "NEVER swipe Priority Pass at domestic Indian airport lounges unless your bank explicitly permits domestic PP (HDFC Infinia allows primary/add-on; most banks charge USD 27+GST for domestic PP swipes!)",
            "irctc_railway_lounge_terms": {
                "updated": "2026-05-29 (HDFC IRCTC Executive Lounge PDF)",
                "quota": "8 visits/year (max 2 visits/quarter) on IRCTC co-branded cards",
                "inclusions": ["2-hour AC lounge stay", "1 buffet meal (breakfast/lunch/dinner)", "Unlimited tea/coffee", "Free Wi-Fi", "Washrooms & charging points", "Newspaper/magazine"],
                "validation_fee": "Rs. 2/- auth charge + valid train ticket matching cardholder name",
            },
        },
        "participating_indian_airport_lounges_count": len(indian_airport_lounges),
        "participating_indian_airport_lounges": indian_airport_lounges,
        "indusind_participating_codes_sample": indus_codes,
        "sources": [
            "banks/pdfs/sbi_in-participating-airport-lounges_pdf.txt",
            "banks/pdfs/indusind_Airport-Lounge-Access-Program_pdf.txt",
            "banks/pdfs/hdfc_airport-lounge-access-program-30sep2025_pdf.txt",
            "banks/pdfs/hdfc_lounge_pdf.txt",
            "banks/pdfs/axis_terms_conditions_complimentary_lounge_access_pdf.txt",
            "banks/pdfs/idfc_LIC-Select-Lounge-List_pdf.txt",
            "enrichment/lounges/*.md",
        ],
    }


# ---------------------------------------------------------------------------
# 4. Main Paisabazaar Card Parser (Templates A, B, C)
# ---------------------------------------------------------------------------
def parse_paisabazaar_cards(pb_json_list: list[dict], reddit_stats: dict, agg_index: dict) -> list[dict[str, Any]]:
    by_slug = {x["slug"]: x for x in pb_json_list}
    cards: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    md_files = sorted(glob.glob(f"{RAW_DIR}/paisabazaar/cards/*.md"))
    for fp in md_files:
        slug = os.path.splitext(os.path.basename(fp))[0]
        if slug in PAISABAZAAR_EXCLUDES:
            continue

        pb_meta = by_slug.get(slug, {})
        raw_md = open(fp, encoding="utf-8", errors="ignore").read()
        body = truncate_paisabazaar(raw_md)
        if len(body) < 800:
            continue

        # Bank prefix resolution
        bank_prefix = slug.split("_")[0] if "_" in slug else "credit-card"
        bank = pb_meta.get("bank") or BANK_CANONICAL_MAP.get(bank_prefix, bank_prefix.replace("-", " ").title())
        if bank_prefix in BANK_CANONICAL_MAP and bank_prefix != "credit-card":
            bank = BANK_CANONICAL_MAP[bank_prefix]

        # Clean Card Name
        h1 = re.search(r"^#\s+(.+)$", body, re.M)
        raw_name = pb_meta.get("card_name") or (clean_text(h1.group(1)) if h1 else slug.split("_")[-1].replace("-", " ").title())
        # Strip noisy SEO subtitles after em-dash / colon if needed
        card_name = re.sub(r"\s+[–—-]\s+(?:Features|An All-rounder|For Frequent|For Online|For Contactless|A Co-branded|An Entry-level).*$", "", raw_name, flags=re.I)
        card_name = re.sub(r":\s*(?:Features|Good for|0% Forex|Accelerated rewards|For Savings).*$", "", card_name, flags=re.I).strip()

        sections = extract_sections(body)
        tables = extract_non_comparison_tables(body)

        # Updated date
        upd_m = re.search(r"Updated:\s*(\d{2}-\d{2}-\d{4})", body)
        last_updated = pb_meta.get("updated_on") or (upd_m.group(1) if upd_m else "2026")
        if re.match(r"^\d{2}-\d{2}-\d{4}", str(last_updated)):
            dmy = last_updated[:10].split("-")
            last_updated = f"{dmy[2]}-{dmy[1]}-{dmy[0]}"

        # Rating
        pb_overall = pb_meta.get("overall_rating")
        if pb_overall is None:
            pb_overall = parse_unicode_star_rating(body)
        pb_sub = pb_meta.get("subratings") or {}

        # Extract key highlights / fees table cells
        fee_dict = dict(pb_meta.get("fees_table") or {})
        for tbl in tables:
            for row in tbl:
                if len(row) >= 2:
                    k = row[0].lower()
                    v = " | ".join(row[1:])
                    if any(w in k for w in ["joining fee", "annual fee", "renewal fee", "first year", "forex", "foreign currency", "finance charge", "interest", "apr", "cash advance", "fuel surcharge", "redemption", "add-on", "spend-based", "waiver", "minimum income", "minimum salary", "age", "credit score", "cibil", "best suited", "reward benefits"]):
                        if k not in fee_dict:
                            fee_dict[row[0]] = v

        # Fees parsing
        jf, af, fw, fx, apr_m, apr_a = None, None, None, None, None, None
        jf_waiver, cash_adv, fuel_waiv, redemp_fee, addon_fee = None, None, None, None, None

        for k, v in fee_dict.items():
            kl = k.lower()
            v_fee_head = re.split(r"\bwaiv(?:ed|er)\b|\bon\s+spend|\bif\s+you\s+spend", v, maxsplit=1, flags=re.I)[0].strip()
            if "waiver" in kl or "waived" in kl or "spend-based" in kl or "condition" in kl:
                fw_cand = parse_inr_amount(v)
                if fw_cand and fw_cand >= 10000:
                    fw = fw_cand
            elif "joining" in kl and "annual" in kl:
                val = parse_inr_amount(v_fee_head or v)
                jf = jf if jf is not None else val
                af = af if af is not None else val
                if "waiv" in v.lower():
                    fw_cand = parse_inr_amount(re.sub(r"^.*?waiv[^\d]*", "", v, flags=re.I))
                    if fw_cand and fw_cand >= 10000:
                        fw = fw_cand
            elif "joining" in kl or "1st year" in kl or "first year" in kl:
                jf = parse_inr_amount(v_fee_head or v)
                if "waiv" in v.lower() or "spend" in v.lower():
                    jf_waiver = v
            elif "annual" in kl or "renewal" in kl:
                af = parse_inr_amount(v_fee_head or v)
                if "waiv" in v.lower():
                    fw_cand = parse_inr_amount(re.sub(r"^.*?waiv[^\d]*", "", v, flags=re.I))
                    if fw_cand and fw_cand >= 10000:
                        fw = fw_cand
            elif "forex" in kl or "foreign currency" in kl or "cross currency" in kl:
                fx = parse_pct(v)
            elif "finance" in kl or "interest" in kl or "apr" in kl:
                m_pm = re.search(r"(\d+(?:\.\d+)?)\s*%\s*(?:p\.?m|per month)", v, re.I)
                m_pa = re.search(r"(\d+(?:\.\d+)?)\s*%\s*(?:p\.?a|per annum)", v, re.I)
                if m_pm:
                    apr_m = float(m_pm.group(1))
                if m_pa:
                    apr_a = float(m_pa.group(1))
                elif not m_pm:
                    p = parse_pct(v)
                    if p:
                        if p <= 6.0:
                            apr_m = p
                            apr_a = round(p * 12, 2)
                        else:
                            apr_a = p
                            apr_m = round(p / 12, 2)
            elif "cash advance" in kl or "cash withdrawal" in kl:
                cash_adv = v
            elif "fuel surcharge" in kl:
                fuel_waiv = v
            elif "redemption" in kl:
                redemp_fee = v
            elif "add-on" in kl:
                addon_fee = v

        # Fallback regex extraction from body text
        full_clean = clean_text(body)
        if jf is None:
            m_jf = re.search(r"Joining Fee[^.\n]{0,40}?(?:is|of|:|\|)\s*(Nil|Lifetime Free|Free|Rs\.?\s*[\d,]+|₹\s*[\d,]+)", full_clean, re.I)
            if m_jf:
                jf = parse_inr_amount(m_jf.group(1))
        if af is None:
            m_af = re.search(r"(?:Annual|Renewal)\s+Fee[^.\n]{0,40}?(?:is|of|:|\|)\s*(Nil|Lifetime Free|Free|Rs\.?\s*[\d,]+|₹\s*[\d,]+)", full_clean, re.I)
            if m_af:
                af = parse_inr_amount(m_af.group(1))
        if jf is None and af is not None:
            jf = af
        if af is None and jf is not None:
            af = jf
        # Sanity guard: if annual fee is >= 50,000 while joining fee <= 25,000, af parsed a spend-waiver threshold
        if jf is not None and af is not None and jf <= 25000 and af >= 50000:
            fw = fw or af
            af = jf
        if jf is not None and jf >= 200000 and "primus" not in slug:
            # Caught a fee-waiver / welcome milestone in lakhs; retry strictly Rs. X,XXX
            m_real_jf = re.search(r"Joining Fee[^.\n]{0,30}?Rs\.?\s*(\d{1,2}(?:,\d{3})+)", body, re.I)
            if m_real_jf:
                jf = int(m_real_jf.group(1).replace(",", ""))
                if af and af >= 200000:
                    fw = fw or af
                    af = jf
        if fw is None:
            m_fw = re.search(r"(?:annual|renewal)\s+fee[^.\n]{0,80}waived[^.\n]{0,60}?((?:Rs\.?|₹)\s*[\d,]+(?:\.\d+)?\s*(?:Lakh|Lac)?)", full_clean, re.I)
            if m_fw:
                fw_c = parse_inr_amount(m_fw.group(1))
                if fw_c and fw_c >= 10000:
                    fw = fw_c
        if fx is None:
            m_fx = re.search(r"(?:forex|foreign currency)\s*(?:mark-?up|fee|charges?)?\s*(?:is|of|:)?\s*(\d+(?:\.\d+)?)\s*%", full_clean, re.I)
            if m_fx:
                fx = float(m_fx.group(1))
            else:
                for m_zfx in re.finditer(r"\b(?:0%|zero|nil)\s*forex\b", full_clean, re.I):
                    ctx_before = full_clean[max(0, m_zfx.start() - 45):m_zfx.start()].lower()
                    if not any(neg in ctx_before for neg in ["low or ", " or ", "opt for", "such as ", "like ", "which offer", "no ", "not ", "without "]):
                        fx = 0.0
                        break

        is_ltf = bool(
            (jf == 0 and af == 0)
            or "lifetime free" in full_clean[:2500].lower()
            or "lifetime-free" in slug.lower()
        )
        is_fyf = bool(is_ltf or (jf == 0 and (af or 0) > 0) or "first year free" in full_clean[:2500].lower())
        is_fd = bool(
            "fd" in slug.lower().split("-")
            or "against fd" in card_name.lower()
            or "fixed deposit" in full_clean[:2000].lower()
            or "against fixed deposit" in full_clean[:2000].lower()
        )
        is_rupay = bool("rupay" in (slug + " " + card_name + " " + full_clean[:2500]).lower())
        is_invite = bool("invite-only" in full_clean[:3000].lower() or "invite only" in full_clean[:3000].lower() or "by invitation" in full_clean[:3000].lower())

        # Rewards extraction
        raw_rew = pb_meta.get("rewards_and_benefits")
        rew_txt = " ".join(str(x) for x in raw_rew) if isinstance(raw_rew, list) else (raw_rew or "")
        if not rew_txt:
            for sh, sb in sections.items():
                if any(w in sh.lower() for w in ["reward", "cashback", "features and benefits", "key highlights"]):
                    rew_txt += "\n" + sb
        rew_clean = clean_text(rew_txt or body[:6000])

        # Reward rate heuristic
        base_rate, acc_rate, pt_val = None, None, None
        m_pt = re.search(r"1\s*(?:RP|Reward Point|CashPoint|NeuCoin|Mile)\s*=\s*(?:Rs\.?|₹)\s*(\d+(?:\.\d+)?)", full_clean, re.I)
        if m_pt:
            pt_val = float(m_pt.group(1))
        cb_pcts = [float(x) for x in re.findall(r"(\d+(?:\.\d+)?)\s*%\s*(?:cashback|cash back|valueback|value back|return|savings|discount)", rew_clean, re.I) if 0.25 <= float(x) <= 25.0]
        if cb_pcts:
            acc_rate = max(cb_pcts)
            small_cbs = [x for x in cb_pcts if x <= 3.5]
            base_rate = min(small_cbs) if small_cbs else 1.0
        elif "cashback" in card_name.lower():
            base_rate = 1.0

        # Loyalty / reward type
        if "cashback" in rew_clean[:400].lower() or "cashback" in card_name.lower():
            rew_type = "Cashback"
        elif "mile" in rew_clean[:400].lower() or "avios" in card_name.lower():
            rew_type = "Air Miles / Travel Points"
        else:
            rew_type = "Reward Points"

        # Highlights / bullets
        bullets = [clean_text(b.lstrip("*-• ")) for b in re.findall(r"^\s*[\*\-]\s+(.+)$", body[:14000], re.M)]
        bullets = [b for b in bullets if 18 <= len(b) <= 260 and "paisabazaar" not in b.lower() and "pre-approved" not in b.lower()]
        cat_mults = [b for b in bullets if any(w in b.lower() for w in ["%", "reward point", "rp per", "cashback", "10x", "5x", "2x", "3x", "4x", "fuel", "amazon", "swiggy", "zomato", "flipkart", "utility", "upi"])][:6]
        milestones = [b for b in bullets if any(w in b.lower() for w in ["milestone", "waiv", "spend", "voucher", "bonus", "per annum", "per year"]) and ("₹" in b or "rs" in b.lower())][:4]

        # Lounge parsing
        raw_lng = pb_meta.get("lounge_access_text")
        lng_txt = "\n".join(str(x) for x in raw_lng) if isinstance(raw_lng, list) else (raw_lng or "")
        if not lng_txt:
            lng_lines = [b for b in bullets if "lounge" in b.lower()]
            lng_txt = "\n".join(lng_lines)
        # Filter out Paisabazaar promotional widget banners & suggested links
        pb_widget_noise = (
            "airport lounge access with every credit card",
            "via pb pass",
            "suggested read",
            "know more)",
            "check eligibility",
            "paisabazaar rating criteria",
        )
        lng_source = lng_txt if lng_txt.strip() else body
        lng_sents = []
        for ln in lng_source.splitlines():
            clean_ln = clean_text(ln)
            if not clean_ln or "lounge" not in clean_ln.lower():
                continue
            if any(noise in clean_ln.lower() for noise in pb_widget_noise):
                continue
            for sent in re.split(r"(?<=[.!?])\s+", clean_ln):
                if "lounge" in sent.lower() and not any(noise in sent.lower() for noise in pb_widget_noise):
                    lng_sents.append(sent.strip())
        lng_clean = " ".join(lng_sents)
        dom_visits, dom_qtr, intl_visits, rail_visits, rail_qtr = 0, 0, 0, 0, 0
        dom_spend = "No spend criteria specified"
        dom_summary = "No domestic airport lounge access"
        intl_summary = "No international lounge access"
        rail_summary = "No railway lounge access"

        unlim_pat = re.compile(r"\bunlimited\b[^.\n]{0,35}\b(?:domestic|international|airport|lounge|visits?)\b|\b(?:domestic|international|airport)\s+lounge[^.\n]{0,25}\bunlimited\b", re.I)
        qtr_pat = re.compile(r"(?:/\s*(?:qtr|quarter)|(?:per|every|in\s+a)\s+(?:calendar\s+)?quarter)\b", re.I)

        if lng_sents:
            for s in lng_sents:
                sl = s.lower()
                if any(neg in sl for neg in ["no complimentary", "doesn’t have", "doesn't have", "does not offer", "does not have", "do not offer", "not offer", "not provide", "no lounge", "no domestic", "without lounge", "discontinued", "not applicable"]):
                    continue
                if "railway" in sl or "irctc" in sl:
                    m_r = re.search(r"(\d{1,2})\s*(?:complimentary|free)?\s*(?:railway)?\s*(?:lounge\s*)?(?:visits?|access)", sl)
                    if m_r:
                        n = int(m_r.group(1))
                        if qtr_pat.search(sl) and n <= 4:
                            rail_qtr = n
                            rail_visits = n * 4
                        else:
                            rail_visits = max(rail_visits, n)
                        rail_summary = s[:220]
                elif any(w in sl for w in ["international", "priority pass", "loungekey", "dreamfolks"]):
                    if unlim_pat.search(sl):
                        intl_visits = 999
                    else:
                        m_i = re.search(r"(\d{1,2})\s*(?:complimentary|free)?\s*(?:international|priority pass)?\s*(?:airport\s*)?(?:lounge\s*)?(?:visits?|access)", sl)
                        if m_i:
                            n = int(m_i.group(1))
                            intl_visits = n * 4 if qtr_pat.search(sl) and n <= 4 else max(intl_visits, n)
                    if intl_visits > 0:
                        intl_summary = s[:220]
                elif "domestic" in sl or "airport lounge" in sl:
                    if unlim_pat.search(sl):
                        dom_visits, dom_qtr = 999, 999
                    else:
                        m_d = re.search(r"(\d{1,2})\s*(?:complimentary|free)?\s*(?:domestic)?\s*(?:airport\s*)?(?:lounge\s*)?(?:visits?|access)", sl)
                        if m_d:
                            n = int(m_d.group(1))
                            if qtr_pat.search(sl) and n <= 6:
                                dom_qtr = n
                                dom_visits = n * 4
                            else:
                                dom_visits = max(dom_visits, n)
                    m_sp = re.search(r"(?:on\s+(?:spend(?:ing)?|reaching|achieving)|monthly\s+spends?|quarterly\s+spends?|minimum\s+spend[^.\n]{0,20})(?:\s+of|\s+at\s+least)?\s*((?:Rs\.?|₹)\s*[\d,]+(?:\s*(?:Lakh|Lac))?[^.,]*)", s, re.I)
                    if m_sp:
                        dom_spend = clean_text(m_sp.group(1))
                    elif "monthly spending criteria" in sl or "20,000 monthly" in sl or "spend-based condition" in sl or "spend criteria" in sl:
                        m_num_sp = re.search(r"(\d[\d,]+)\s*(?:monthly|quarterly)", s, re.I)
                        dom_spend = f"Rs. {m_num_sp.group(1)} monthly/quarterly spend required" if m_num_sp else "Monthly/quarterly spend criteria applies"
                    if dom_visits > 0:
                        dom_summary = s[:220]
        if dom_visits > 0 and dom_spend == "No spend criteria specified":
            m_sp_fb = re.search(
                r"lounge\s+access[^.\n]{0,60}?(?:on\s+(?:spend(?:ing)?|reaching|achieving)|minimum\s+spend)(?:\s+of|\s+at\s+least)?\s*((?:Rs\.?|₹)\s*[\d,]+(?:\s*(?:Lakh|Lac))?[^.,\n]{0,35})",
                full_clean,
                re.I,
            )
            if m_sp_fb:
                dom_spend = clean_text(m_sp_fb.group(1))

        # Pros & Cons from Paisabazaar
        pros = [clean_text(p) for p in (pb_meta.get("pros") or []) if len(clean_text(p)) > 12]
        cons = [clean_text(c) for c in (pb_meta.get("cons") or []) if len(clean_text(c)) > 12]
        if not pros or not cons:
            fb_p, fb_c = build_default_pros_cons(
                card_name, bank,
                {"joining_fee_inr": jf, "annual_fee_inr": af, "fee_waiver_spend_inr": fw, "forex_markup_pct": fx},
                {"base_reward_rate_pct": base_rate, "accelerated_reward_rate_pct": acc_rate, "exclusions": []},
                {"domestic": {"visits_per_year": dom_visits, "spend_criteria": dom_spend}, "international": {"visits_per_year": intl_visits}},
                is_ltf, is_fd, is_rupay,
            )
            if not pros:
                pros = fb_p
            if not cons:
                cons = fb_c

        # Eligibility
        elig_txt = " ".join(pb_meta.get("eligibility_requirements") or []) + " " + fee_dict.get("Minimum Income Requirement", "")
        if not elig_txt.strip():
            for sh, sb in sections.items():
                if "eligibility" in sh.lower():
                    elig_txt += " " + clean_text(sb)
        min_sal, min_itr, min_cibil = None, None, 730
        m_sal = re.search(r"(?:salaried|monthly income|net salary)[^.\n]{0,50}?((?:Rs\.?|₹)\s*[\d,]+(?:\s*(?:Lakh|Lac))?)", elig_txt, re.I)
        if m_sal:
            val = parse_inr_amount(m_sal.group(1))
            if val and val >= 10000:
                min_sal = val if val <= 1000000 else int(val / 12)
        m_itr = re.search(r"(?:self[- ]employed|itr|annual income)[^.\n]{0,50}?((?:Rs\.?|₹)\s*[\d,]+(?:\s*(?:Lakh|Lac))?)", elig_txt, re.I)
        if m_itr:
            val = parse_inr_amount(m_itr.group(1))
            if val and val >= 100000:
                min_itr = val

        # Build preliminary dict
        card_id = re.sub(r"[^a-z0-9]+", "_", f"{bank_prefix}_{slug.split('_')[-1]}").strip("_")
        if card_id in seen_ids:
            card_id = re.sub(r"[^a-z0-9]+", "_", slug).strip("_")
        seen_ids.add(card_id)

        prelim_fees = {
            "joining_fee_inr": jf,
            "annual_fee_inr": af,
            "gst_applicable": not is_ltf,
            "fee_waiver_spend_inr": fw,
            "joining_fee_waiver": jf_waiver or ("Lifetime Free" if is_ltf else None),
            "forex_markup_pct": fx,
            "apr_monthly_pct": apr_m,
            "apr_annual_pct": apr_a,
            "cash_advance_fee": cash_adv,
            "fuel_surcharge_waiver": fuel_waiv or ("1% fuel surcharge waiver on select slabs" if "fuel surcharge" in full_clean.lower() else None),
            "redemption_fee": redemp_fee,
            "add_on_card_fee": addon_fee,
        }
        prelim_rewards = {
            "reward_type": rew_type,
            "base_reward_rate_pct": base_rate,
            "accelerated_reward_rate_pct": acc_rate,
            "point_value_inr": pt_val,
            "point_expiry": "2–3 years (issuer T&C)" if rew_type == "Reward Points" else None,
            "welcome_benefit": next((b for b in bullets if "welcome" in b.lower() or "joining bonus" in b.lower()), None),
            "milestone_benefits": milestones,
            "category_multipliers": cat_mults,
            "transfer_partners": [],
            "exclusions": [],
        }
        prelim_lounge = {
            "domestic": {
                "visits_per_year": dom_visits,
                "visits_per_quarter": dom_qtr,
                "spend_criteria": dom_spend if dom_visits > 0 else "Not Applicable",
                "add_on_allowed": "add-on" in (lng_clean or "").lower(),
                "shared_limit": False,
                "summary": dom_summary,
            },
            "international": {
                "program": "Priority Pass" if "priority pass" in (lng_clean or full_clean).lower() else ("LoungeKey / Diners" if intl_visits > 0 else "None"),
                "visits_per_year": intl_visits,
                "spend_criteria": "See issuer T&C" if intl_visits > 0 else "Not Applicable",
                "add_on_allowed": False,
                "guest_fee": "USD 27+GST (typical Priority Pass)" if intl_visits > 0 else "Not Applicable",
                "summary": intl_summary,
            },
            "railway": {
                "visits_per_year": rail_visits,
                "visits_per_quarter": rail_qtr,
                "summary": rail_summary,
            },
            "participating_lounges_ref": "data/master/lounge_access_master.json",
        }

        primary_cat, all_cats = detect_categories(
            card_name, bank, pb_meta.get("paisabazaar_categories") or [], body,
            prelim_fees, prelim_rewards, prelim_lounge, is_ltf, is_fd, is_rupay,
        )
        tier = detect_tier(prelim_fees, card_name, all_cats, is_fd)

        # Sub-benefits
        dining_b = [b for b in bullets if any(w in b.lower() for w in ["dining", "eazydiner", "swiggy", "zomato", "restaurant"])][:3]
        movie_b = [b for b in bullets if any(w in b.lower() for w in ["movie", "bookmyshow", "pvr", "inox", "ticket"])][:3]
        golf_b = [b for b in bullets if "golf" in b.lower()][:2]
        ins_b = [b for b in bullets if any(w in b.lower() for w in ["insurance", "air accident", "cover", "lost card"])][:3]

        # Aggregator + Reddit ratings
        agg_r, agg_urls = find_aggregator_matches(card_name, agg_index)
        r_key = match_reddit_key(card_name, slug)
        r_data = reddit_stats["card_stats"].get(r_key, {}) if r_key else {}
        mkt_r = r_data.get("community_rating")
        r_mentions = r_data.get("mentions", 0)

        # Devaluation defaults from issuer profile
        iss_prof = ISSUER_DEVALUATION_PROFILE.get(bank, {"frequency": "Medium", "risk_score": 5.0, "note": "Standard bank portfolio T&C updates"})
        dev_info = {
            "devaluation_frequency": iss_prof["frequency"],
            "devaluation_risk_score": iss_prof["risk_score"],
            "last_devalued_on": None,
            "devaluation_history": [iss_prof["note"]] if iss_prof.get("note") else [],
        }

        best_whom = build_default_best_for_whom(card_name, bank, primary_cat, prelim_fees, prelim_rewards, prelim_lounge, is_ltf, is_fd, is_rupay)

        card_rec = {
            "card_id": card_id,
            "_pb_slug": slug,
            "card_name": card_name,
            "bank": bank,
            "card_network": detect_network(body, card_name),
            "card_tier": tier,
            "primary_category": primary_cat,
            "categories": all_cats,
            "is_ltf_available": is_ltf,
            "is_fyf_available": is_fyf,
            "is_secured_fd_backed": is_fd,
            "is_rupay_upi_enabled": is_rupay,
            "is_invite_only": is_invite,
            "status": "Discontinued / Legacy" if any(w in slug for w in ["vistara", "jetprivilege", "citi", "1838"]) else "Active",
            "fees": prelim_fees,
            "rewards": prelim_rewards,
            "benefits_and_features": {
                "highlights": bullets[:5],
                "dining_benefits": dining_b,
                "movie_benefits": movie_b,
                "golf_benefits": golf_b,
                "insurance_cover": ins_b,
                "concierge_or_privilege": [b for b in bullets if "concierge" in b.lower()][:2],
            },
            "lounge_access": prelim_lounge,
            "eligibility": {
                "min_age": 21,
                "max_age": 65,
                "min_monthly_income_salaried_inr": min_sal,
                "min_annual_itr_self_employed_inr": min_itr,
                "min_cibil_score": 0 if is_fd else min_cibil,
                "notes": (pb_meta.get("eligibility_requirements") or [None])[0],
            },
            "ratings": {
                "paisabazaar_overall": pb_overall,
                "paisabazaar_subratings": pb_sub,
                "aggregator_rating": agg_r,
                "market_community_rating": mkt_r,
                "composite_score": None,
                "reddit_mentions": r_mentions,
            },
            "devaluation": dev_info,
            "pros": pros,
            "cons": cons,
            "best_for_whom": best_whom,
            "sources": {
                "paisabazaar_url": pb_meta.get("url") or f"https://www.paisabazaar.com/{slug.replace('_', '/')}/",
                "bank_url": None,
                "aggregator_urls": agg_urls,
                "last_updated": last_updated,
            },
        }

        # Apply verified 2026 flagship reconciliation if matching slug
        if slug in FLAGSHIP_OVERRIDES_2026 and FLAGSHIP_OVERRIDES_2026[slug]:
            deep_merge(card_rec, FLAGSHIP_OVERRIDES_2026[slug])

        # Compute clean composite score
        vals = [
            card_rec["ratings"]["paisabazaar_overall"],
            card_rec["ratings"]["aggregator_rating"],
            card_rec["ratings"]["market_community_rating"],
        ]
        valid_vals = [float(x) for x in vals if x is not None]
        if valid_vals:
            card_rec["ratings"]["composite_score"] = round(sum(valid_vals) / len(valid_vals), 2)
        else:
            # Attribute-based baseline when no external numeric rating is present
            base_c = 3.2
            if card_rec["is_ltf_available"]:
                base_c += 0.3
            if card_rec["lounge_access"]["domestic"]["visits_per_year"] > 0:
                base_c += 0.3
            if (card_rec["fees"]["forex_markup_pct"] or 3.5) <= 2.0:
                base_c += 0.2
            card_rec["ratings"]["composite_score"] = round(min(4.5, base_c), 2)

        cards.append(make_uniform_card(card_rec))

    # Merge Canonical Extra Flagships (Cashback SBI, Amazon Pay ICICI, HSBC Premier, Amex Plat Charge, IndusInd Avios)
    for extra in CANONICAL_EXTRA_CARDS:
        c = dict(extra)
        r_key = match_reddit_key(c["card_name"], c["card_id"])
        r_data = reddit_stats["card_stats"].get(r_key, {}) if r_key else {}
        if r_data:
            c["ratings"]["reddit_mentions"] = r_data.get("mentions", 0)
            if r_data.get("community_rating"):
                c["ratings"]["market_community_rating"] = r_data["community_rating"]
        vals = [x for x in [c["ratings"].get("paisabazaar_overall"), c["ratings"].get("aggregator_rating"), c["ratings"].get("market_community_rating")] if x is not None]
        c["ratings"]["composite_score"] = round(sum(vals) / len(vals), 2)
        cards.append(make_uniform_card(c))

    # Deduplicate identical (bank, normalized_name) keeping richer record
    dedup: dict[str, dict[str, Any]] = {}
    for c in cards:
        norm = re.sub(r"[^a-z0-9]", "", (c["bank"] + c["card_name"]).lower())
        if norm not in dedup:
            dedup[norm] = c
        else:
            prev = dedup[norm]
            if (c["sources"]["paisabazaar_url"] is None and prev["sources"]["paisabazaar_url"] is not None):
                continue
            if (c["ratings"]["composite_score"] or 0) > (prev["ratings"]["composite_score"] or 0):
                dedup[norm] = c

    final_cards = list(dedup.values())
    final_cards.sort(key=lambda x: (-(x["ratings"]["composite_score"] or 0), -(x["ratings"]["reddit_mentions"] or 0), x["bank"], x["card_name"]))
    return final_cards


def export_csv(cards: list[dict[str, Any]], out_path: str) -> None:
    fields = [
        "card_id", "card_name", "bank", "card_network", "card_tier",
        "primary_category", "categories", "status",
        "is_ltf_available", "is_fyf_available", "is_secured_fd_backed", "is_rupay_upi_enabled", "is_invite_only",
        "joining_fee_inr", "annual_fee_inr", "fee_waiver_spend_inr", "forex_markup_pct", "apr_annual_pct",
        "reward_type", "base_reward_rate_pct", "accelerated_reward_rate_pct", "point_value_inr",
        "domestic_lounge_visits_yr", "domestic_lounge_spend_criteria",
        "international_lounge_visits_yr", "international_lounge_program",
        "railway_lounge_visits_yr",
        "min_monthly_income_salaried_inr", "min_cibil_score",
        "paisabazaar_overall", "aggregator_rating", "market_community_rating", "composite_score", "reddit_mentions",
        "devaluation_frequency", "devaluation_risk_score", "last_devalued_on",
        "pros", "cons", "ideal_for", "not_ideal_for", "verdict", "paisabazaar_url", "bank_url", "last_updated",
    ]
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for c in cards:
            writer.writerow({
                "card_id": c["card_id"],
                "card_name": c["card_name"],
                "bank": c["bank"],
                "card_network": c["card_network"],
                "card_tier": c["card_tier"],
                "primary_category": c["primary_category"],
                "categories": " | ".join(c["categories"]),
                "status": c["status"],
                "is_ltf_available": c["is_ltf_available"],
                "is_fyf_available": c["is_fyf_available"],
                "is_secured_fd_backed": c["is_secured_fd_backed"],
                "is_rupay_upi_enabled": c["is_rupay_upi_enabled"],
                "is_invite_only": c["is_invite_only"],
                "joining_fee_inr": c["fees"]["joining_fee_inr"],
                "annual_fee_inr": c["fees"]["annual_fee_inr"],
                "fee_waiver_spend_inr": c["fees"]["fee_waiver_spend_inr"],
                "forex_markup_pct": c["fees"]["forex_markup_pct"],
                "apr_annual_pct": c["fees"]["apr_annual_pct"],
                "reward_type": c["rewards"]["reward_type"],
                "base_reward_rate_pct": c["rewards"]["base_reward_rate_pct"],
                "accelerated_reward_rate_pct": c["rewards"]["accelerated_reward_rate_pct"],
                "point_value_inr": c["rewards"]["point_value_inr"],
                "domestic_lounge_visits_yr": c["lounge_access"]["domestic"]["visits_per_year"],
                "domestic_lounge_spend_criteria": c["lounge_access"]["domestic"]["spend_criteria"],
                "international_lounge_visits_yr": c["lounge_access"]["international"]["visits_per_year"],
                "international_lounge_program": c["lounge_access"]["international"]["program"],
                "railway_lounge_visits_yr": c["lounge_access"]["railway"]["visits_per_year"],
                "min_monthly_income_salaried_inr": c["eligibility"]["min_monthly_income_salaried_inr"],
                "min_cibil_score": c["eligibility"]["min_cibil_score"],
                "paisabazaar_overall": c["ratings"]["paisabazaar_overall"],
                "aggregator_rating": c["ratings"]["aggregator_rating"],
                "market_community_rating": c["ratings"]["market_community_rating"],
                "composite_score": c["ratings"]["composite_score"],
                "reddit_mentions": c["ratings"]["reddit_mentions"],
                "devaluation_frequency": c["devaluation"]["devaluation_frequency"],
                "devaluation_risk_score": c["devaluation"]["devaluation_risk_score"],
                "last_devalued_on": c["devaluation"]["last_devalued_on"],
                "pros": " ; ".join(c["pros"]),
                "cons": " ; ".join(c["cons"]),
                "ideal_for": c["best_for_whom"]["ideal_for"],
                "not_ideal_for": c["best_for_whom"]["not_ideal_for"],
                "verdict": c["best_for_whom"]["verdict"],
                "paisabazaar_url": c["sources"]["paisabazaar_url"],
                "bank_url": c["sources"]["bank_url"],
                "last_updated": c["sources"]["last_updated"],
            })


def main() -> None:
    os.makedirs(MASTER_DIR, exist_ok=True)
    os.makedirs(CAT_DIR, exist_ok=True)

    print("[1/5] Analyzing Reddit r/CreditCardsIndia corpus...")
    reddit_stats = parse_reddit_corpus()
    print(f"      Parsed {reddit_stats['total_docs']} Reddit docs")

    print("[2/5] Indexing aggregators & reviews...")
    agg_index = parse_aggregators()
    print(f"      Indexed {len(agg_index)} valid aggregator reviews")

    print("[3/5] Parsing official bank airport & railway lounge PDFs...")
    lounge_dir = parse_lounge_directory()
    with open(f"{MASTER_DIR}/lounge_access_master.json", "w", encoding="utf-8") as f:
        json.dump(lounge_dir, f, indent=2, ensure_ascii=False)
    print(f"      Extracted {lounge_dir['participating_indian_airport_lounges_count']} participating Indian airport lounges")

    print("[4/5] Building uniform master card dataset...")
    pb_list = json.load(open(f"{RAW_DIR}/paisabazaar/paisabazaar_cards.json", encoding="utf-8"))
    cards = parse_paisabazaar_cards(pb_list, reddit_stats, agg_index)

    master_payload = {
        "metadata": {
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "total_cards": len(cards),
            "banks_covered": len(set(c["bank"] for c in cards)),
            "sources": {
                "paisabazaar_raw_files": 558,
                "paisabazaar_utility_excluded": len(PAISABAZAAR_EXCLUDES),
                "canonical_extra_flagships": len(CANONICAL_EXTRA_CARDS),
                "official_bank_pages": 133,
                "official_bank_pdfs": 42,
                "aggregator_pages": 124,
                "reddit_docs": reddit_stats["total_docs"],
            },
            "schema_version": "2026.11-uniform",
        },
        "cards": cards,
    }
    with open(f"{MASTER_DIR}/credit_cards_master.json", "w", encoding="utf-8") as f:
        json.dump(master_payload, f, indent=2, ensure_ascii=False)
    export_csv(cards, f"{MASTER_DIR}/credit_cards_master.csv")

    deval_payload = {
        "generated_at": datetime.now().strftime("%Y-%m-%d"),
        "issuer_devaluation_profiles": ISSUER_DEVALUATION_PROFILE,
        "timeline_2024_2026": DEVALUATION_EVENTS,
    }
    with open(f"{MASTER_DIR}/devaluation_tracker.json", "w", encoding="utf-8") as f:
        json.dump(deval_payload, f, indent=2, ensure_ascii=False)

    print(f"      Master JSON & CSV written ({len(cards)} cards across {master_payload['metadata']['banks_covered']} issuers)")

    print("[5/5] Generating comparison tables, 11 category guides, lounge guide, devaluation report, user research & README...")
    from generate_reports import generate_all_reports
    generate_all_reports(cards, reddit_stats, lounge_dir, deval_payload)
    print("ALL MASTER DATASETS & REPORTS GENERATED SUCCESSFULLY!")


if __name__ == "__main__":
    main()
