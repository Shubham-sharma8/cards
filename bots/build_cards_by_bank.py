#!/usr/bin/env python3
"""
Phase 2 Builder: Per-Bank Folders, 516 Enriched Card Dossiers (JSON + MD),
Card-Specific Applicable Lounge Links & Lists, Cashback Calculator Matrix,
Reddit Community Feedback, Devaluation Analysis, Smart Alternates, and App Indices.

Strict Scope: Data files & master indices ONLY — NO React Native / UI app code.
"""

from __future__ import annotations

import json
import math
import re
import shutil
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from card_audit_rules import (
    CURATED_CALC_OVERRIDES as AUDIT_CALC_OVERRIDES,
    _PROMO_LINE_RE,
    calibrate_overall_rating,
    extract_fallback_rates_and_caps,
    extract_golf_summary,
)

ROOT_DIR = Path("/Users/shubhamsharma/Downloads/Credit Card")
DATA_DIR = ROOT_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
MASTER_DIR = DATA_DIR / "master"
OUT_DIR = DATA_DIR / "cards_by_bank"

PB_CARDS_DIR = RAW_DIR / "paisabazaar" / "cards"
REDDIT_THREADS_DIR = RAW_DIR / "reddit" / "threads"

CALC_CATEGORIES = [
    "online_shopping_general",
    "amazon_flipkart_myntra",
    "dining_swiggy_zomato",
    "groceries_quick_commerce",
    "travel_flights_hotels",
    "upi_scan_and_pay",
    "utilities_bills_telecom",
    "fuel",
    "insurance",
    "education_rent_govt",
    "international_forex_net_of_markup",
    "offline_general_other",
]

BOILERPLATE_LINE_MARKERS = (
    "need more help?",
    "leave a comment or ask a question",
    "[ask your question]",
    "### footnotes",
    "## trending articles on credit cards",
    "### explore other card categories",
    "### explore cards from leading issuers",
    "## similar credit cards",
    "+91",
    "check eligibility",
    "check my offers",
    "pb-pass-chip",
    "cc-pb-pass-illustration",
    "pb pass",
    "paisabazaar.com",
    "not available on paisabazaar",
    "paisabazaar score",
    "paisabazaar app",
    "please enter a valid full name",
    "the entered number doesn't seem to be correct",
    "related posts",
    "nothing here!",
    "bat.bing.com",
    "view all articles",
    "compare india",
)

BAD_PHRASES_INLINE = [
    "View More",
    "Also Read:",
    "Suggested Read:",
    "Read more",
]

MITC_BANK_FALLBACKS: dict[str, str] = {
    "HDFC Bank": "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/personal-banking/discover-products/cards/credit-cards/mitc-in-english.pdf",
    "Axis Bank": "https://www.axis.bank.in/docs/default-source/default-document-library/mitc-credit-cards.pdf",
    "AU Small Finance Bank": "https://www.au.bank.in/credit-cards/mitc(with-schedule-of-charges).pdf",
    "ICICI Bank": "https://www.icici.bank.in/content/dam/icicibank/india/managed-assets/docs/personal/cards/mitc_cc.pdf",
    "IndusInd Bank": "https://www.indusind.bank.in/content/dam/indusind-platform-images/pdfs/credit-card/MITC_Premium.pdf",
    "RBL Bank": "https://webassets.rbl.bank.in/document/Credit%20Cards/RBL-MITC-final.pdf",
    "IDFC FIRST Bank": "https://www.idfcfirst.bank.in/content/dam/idfcfirstbank/pdf/credit-card/MITC-Document-Customer.pdf",
    "YES BANK": "https://www.yes.bank.in/pdf?name=ybl_mitc_pdf.pdf",
    "SBI Card": "https://www.sbicard.com/sbi-card-en/assets/docs/pdf/personal/fees-and-charges/mitc.pdf",
    "HSBC Bank": "https://www.hsbc.bank.in/content/dam/hsbc/in/documents/credit-cards/hsbc-credit-cards-mitc.pdf",
    "Kotak Mahindra Bank": "https://www.kotak.bank.in/content/dam/Kotak/others/credit-card-mitc.pdf",
    "BOBCARD (Bank of Baroda)": "https://www.bobcard.co.in/docs/default-source/mitc/mitc.pdf",
    "Federal Bank": "https://www.federal.bank.in/credit-cards",
    "Punjab National Bank": "https://www.pnbcard.in/login/Terms.html",
    "Standard Chartered Bank": "https://av.sc.com/in/content/docs/in-credit-card-mitc.pdf",
    "Slice Small Finance Bank": "https://www.sliceit.com/",
    "CSB Bank": "https://www.csb.bank.in/credit-card",
}


def sanitize_mitc_url(url: str | None, bank: str) -> str | None:
    u = (url or "").strip()
    if u:
        if u.startswith("http://"):
            u = "https://" + u[len("http://"):]
        low = u.lower()
        if "paisabazaar" in low or "indusind.coget" in low or not u.startswith("https://"):
            u = ""
        elif "lounge" in low and "lounge-list-tnc.pdf" in low:
            # Known old broken HSbC path -> keep HSBC official lounge T&C or swap if outdated
            u = "https://www.hsbc.bank.in/content/dam/hsbc/in/documents/lounge-list-tnc.pdf"
    if not u:
        u = MITC_BANK_FALLBACKS.get(bank, "")
    return u or None


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")


def bank_to_slug(bank: str) -> str:
    return slugify((bank or "").replace("&", "and").replace("/", " "))


def strip_md_links_preserve_text(s: str) -> str:
    # Remove embedded markdown images first
    s = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", s)
    # Replace markdown links [label](url) -> label
    s = re.sub(r"\[([^\]]+)\]\((?:https?://|/)[^)]+\)", r"\1", s)
    # Remove stray footnote markers or trailing '=' artifacts
    s = re.sub(r"\s+", " ", s).strip()
    s = s.rstrip("=").strip()
    return s


def scrub_editorial_mentions(s: str) -> str:
    if not s:
        return ""
    s = re.sub(r"Note\s*:?\s*This\s+card\s+is\s+not\s+available\s+on\s+Paisabazaar(?:\.com)?\.?", "", s, flags=re.I)
    s = re.sub(r"\bPaisabazaar\s+(?:Score|Review|Pass|App|website)\b", "Editorial Review", s, flags=re.I)
    s = re.sub(r"\bon\s+Paisabazaar(?:\.com)?\b(?!(?:\s+(?:PaisaSave|PaisaBack|StepUP)))", "on issuer portals", s, flags=re.I)
    s = re.sub(r"\bvia\s+Paisabazaar(?:\.com)?\b(?!(?:\s+(?:PaisaSave|PaisaBack|StepUP)))", "via issuer channels", s, flags=re.I)
    s = re.sub(r"\bPaisabazaar\.com\b", "issuer portal", s, flags=re.I)
    s = re.sub(r"\bPaisabazaar\b(?!(?:\s+(?:PaisaSave|PaisaBack|StepUP)))", "Issuer / Market", s)
    s = re.sub(r"\s*per\s+[a-z]+\s+\d{4}\s+CardInsider\s+data", "", s, flags=re.I)
    s = re.sub(r"\bCardInsider\b", "issuer disclosures", s, flags=re.I)
    return re.sub(r"\s+", " ", s).strip()


def clean_text_item(s: str, card_name: str = "", bank_name: str = "") -> str:
    if not s:
        return ""
    s = strip_md_links_preserve_text(s)
    for bp in BAD_PHRASES_INLINE:
        s = re.sub(r"\b" + re.escape(bp.rstrip(":")) + r"\s*:?", "", s, flags=re.I)
    s = re.sub(r"^[*_\-\u2022]+\s*", "", s).strip()
    s = scrub_editorial_mentions(s)
    # Strip trailing Paisabazaar footnote superscript markers ("more1", "Cashback2", "spends3", "Lakh1")
    s = re.sub(
        r"\b(?!tier[123]\b|level[123]\b|part[123]\b|phase[123]\b|web3\b|pass3\b)([A-Za-z][a-z]{2,})([123])\b",
        r"\1",
        s,
    )
    # Strip trailing breadcrumb slashes like "HSBC Credit Card /" or "AU Small Finance Bank /"
    if re.search(r"(?:credit\s+cards?|bank(?:\s+of\s+\w+)?|cards?)\s*/\s*$", s, re.I):
        return ""
    s = re.sub(r"\s*/\s*$", "", s).strip()
    low = s.lower()
    if any(m in low for m in BOILERPLATE_LINE_MARKERS):
        return ""
    if card_name and low == card_name.strip().lower():
        return ""
    if bank_name and low in {bank_name.strip().lower(), f"{bank_name.strip().lower()} credit card", f"{bank_name.strip().lower()} credit cards"}:
        return ""
    if (
        len(s) <= 55
        and not re.search(r"[0-9%₹]", s)
        and re.search(r"\b(?:credit\s+card|debit\s+card|metal\s+edition|card)\s*$", low)
    ):
        return ""
    if len(s) < 3 or s in {".", "-", ":", "|", "/"}:
        return ""
    return s


def clean_list_items(items: list[Any] | None, card_name: str = "", bank_name: str = "") -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for x in items or []:
        c = clean_text_item(str(x), card_name=card_name, bank_name=bank_name)
        if c and c.lower() not in seen:
            seen.add(c.lower())
            out.append(c)
    return out


# ---------------- Cached Editorial Raw Card File Parser ----------------

def pb_stem_from_url(pb_url: str | None) -> str:
    if not pb_url:
        return ""
    parts = [p for p in pb_url.strip("/").split("/") if p]
    if len(parts) >= 2:
        return f"{parts[-2]}_{parts[-1]}"
    return ""


def parse_pb_card_markdown(md_path: Path) -> dict[str, Any]:
    """Extract clean structured fields from a cached raw card markdown page."""
    result: dict[str, Any] = {
        "about_overview": None,
        "mitc_pdf_url": None,
        "late_payment_slabs": [],
        "point_value_inr_matrix": {},
        "get_this_card_if": [],
        "faqs": [],
        "eligibility_raw": {},
        "dining_benefits": [],
        "movie_benefits": [],
        "golf_benefits": [],
        "insurance_cover": [],
        "concierge_or_privilege": [],
        "sub_ratings": {},
    }
    if not md_path.exists():
        return result

    raw_text = md_path.read_text(encoding="utf-8", errors="ignore")
    lines = raw_text.splitlines()

    # Extract MITC PDF URL even if in Footnotes before stripping footer (supports balanced parens in linear time)
    for line in lines:
        m_mitc = re.search(
            r"\[(Terms and Conditions|MITC[^\]]*|Most Important Terms[^\]]*)\]\((https?://[^()\s]*(?:\([^()\s]*\)[^()\s]*)*)\)",
            line,
            re.I,
        )
        if m_mitc:
            cand = m_mitc.group(2).strip()
            if "paisabazaar" not in cand.lower() and "indusind.coget" not in cand.lower():
                result["mitc_pdf_url"] = cand
                break
    if not result["mitc_pdf_url"]:
        for line in lines:
            for m_pdf in re.finditer(
                r"\((https?://[^()\s]*(?:\([^()\s]*\)[^()\s]*)*)\)",
                line,
                re.I,
            ):
                cand = m_pdf.group(1).strip()
                low_c = cand.lower()
                if (
                    ("mitc" in low_c or "terms-and-conditions" in low_c or "tnc" in low_c)
                    and low_c.endswith(".pdf")
                    and "paisabazaar" not in low_c
                    and "indusind.coget" not in low_c
                ):
                    result["mitc_pdf_url"] = cand
                    break
            if result["mitc_pdf_url"]:
                break

    # Extract header sub-ratings e.g. "Travel4.0/5", "Rewards4.0/5"
    for line in lines[:35]:
        m_sr = re.match(r"^(Travel|Rewards|Lifestyle Benefits|Milestone Benefits|Fuel|Dining|Cashback|Shopping|Movies)\s*([0-5](?:\.\d+)?)/5", line.strip(), re.I)
        if m_sr:
            key = slugify(m_sr.group(1)).replace("-", "_")
            result["sub_ratings"][key] = float(m_sr.group(2))

    # Trim header nav/OTP widget (< ## About ) and footer noise
    start_idx = 0
    for idx, line in enumerate(lines):
        if re.match(r"^##\s+About\b", line.strip(), re.I):
            start_idx = idx
            break
    if start_idx == 0:
        for idx, line in enumerate(lines):
            if re.match(r"^##\s+", line.strip()) and idx >= 15:
                start_idx = idx
                break

    end_idx = len(lines)
    for idx in range(start_idx, len(lines)):
        low = lines[idx].strip().lower()
        if any(marker in low for marker in (
            "need more help?",
            "leave a comment or ask a question",
            "[ask your question]",
            "### footnotes",
            "## trending articles on credit cards",
            "### explore other card categories",
            "### explore cards from leading issuers",
            "## similar credit cards",
            "related posts",
            "nothing here!",
        )):
            end_idx = idx
            break

    body_lines = lines[start_idx:end_idx]

    # Walk sections cleanly
    section = ""
    subsec = ""
    about_paras: list[str] = []
    current_faq_q: str | None = None
    current_faq_a: list[str] = []
    in_late_payment = False

    def flush_faq():
        nonlocal current_faq_q, current_faq_a
        if current_faq_q and current_faq_a:
            ans = clean_text_item(" ".join(current_faq_a))
            q_clean = clean_text_item(current_faq_q)
            if q_clean and ans and len(ans) > 10:
                result["faqs"].append({"q": q_clean, "a": ans})
        current_faq_q = None
        current_faq_a = []

    for raw_line in body_lines:
        s = raw_line.strip()
        if not s:
            continue
        low = s.lower()

        # Skip inline image / Also Read / View More / Suggested Read noise
        if s.startswith("![") or re.match(r"^\[?\s*View More\s*\]?", s, re.I):
            continue
        if low.startswith("_**also read") or low.startswith("**also read") or low.startswith("**suggested read"):
            continue
        if any(m in low for m in BOILERPLATE_LINE_MARKERS):
            continue

        # Top-level H2 sections
        if s.startswith("## "):
            flush_faq()
            in_late_payment = False
            sec_title = clean_text_item(s.lstrip("#").strip()).lower()
            if sec_title.startswith("about"):
                section = "about"
            elif "fees & charges" in sec_title or "fees and charges" in sec_title:
                section = "fees"
            elif "features and benefits" in sec_title or "other features" in sec_title:
                section = "benefits"
            elif "reward" in sec_title and "program" in sec_title:
                section = "rewards"
            elif "things to know" in sec_title or "eligibility" in sec_title:
                section = "know"
            elif "paisabazaar review" in sec_title:
                section = "review"
            elif "frequently asked questions" in sec_title or "faq" in sec_title:
                section = "faq"
            elif "reward" in sec_title:
                section = "rewards"
            else:
                section = "other"
            subsec = ""
            continue

        # H3 sections
        if s.startswith("### "):
            sec3 = clean_text_item(s.lstrip("#").strip())
            sec3_low = sec3.lower()
            if section == "faq":
                flush_faq()
                current_faq_q = sec3
                continue
            if "fees & charges" in sec3_low or "fees and charges" in sec3_low:
                section = "fees"
                subsec = ""
                continue
            if "get this card if" in sec3_low:
                subsec = "get_this_card_if"
            elif "eligibility" in sec3_low:
                subsec = "eligibility"
            elif "what do we like" in sec3_low:
                subsec = "editorial"
            elif "pros" in sec3_low:
                subsec = "pros"
            elif "cons" in sec3_low:
                subsec = "cons"
            else:
                subsec = sec3_low
            continue

        # Bold subsection headers like **Reward Redemption**, **Dining Benefits**, etc.
        if re.match(r"^\*\*[^*]{3,60}:?\*\*$", s):
            hdr = s.strip("* :").lower()
            if "reward redemption" in hdr:
                subsec = "reward_redemption"
            elif "reward earning" in hdr:
                subsec = "reward_earning"
            elif "dining" in hdr:
                subsec = "dining"
            elif "movie" in hdr or "entertainment" in hdr:
                subsec = "movie"
            elif "golf" in hdr:
                subsec = "golf"
            elif "insurance" in hdr:
                subsec = "insurance"
            elif "concierge" in hdr or "privilege" in hdr or "lifestyle" in hdr:
                subsec = "concierge"
            elif "lounge" in hdr:
                subsec = "lounge"
            elif "milestone" in hdr:
                subsec = "milestone"
            elif "welcome" in hdr:
                subsec = "welcome"
            else:
                subsec = hdr
            continue

        # Late payment charges extraction (across Fees section or any fee table in doc)
        if "late payment" in low and s.startswith("|"):
            in_late_payment = True
            cols_lp = [clean_text_item(c) for c in s.strip("|").split("|")]
            cols_lp = [c for c in cols_lp if c]
            if len(cols_lp) >= 2:
                val_col = cols_lp[1]
                # Case A: Inline slabs inside cell ("On Statement Balance of: Up to Rs. 100: Nil Above Rs. 100 to Rs. 500: Rs. 100...")
                slab_matches = re.findall(r"((?:Up to|Above|More than)[^:]{3,40}):\s*((?:Nil|Rs\.?\s*[\d,]+|₹\s*[\d,]+))", val_col, re.I)
                if slab_matches:
                    for sb, fee_v in slab_matches:
                        result["late_payment_slabs"].append({
                            "statement_balance_slab": sb.strip(),
                            "late_fee_inr": fee_v.strip(),
                        })
                    in_late_payment = False
                elif any(k in val_col.lower() for k in ("rs", "%", "nil", "due")):
                    result["late_payment_slabs"].append({
                        "statement_balance_slab": "All Statement Balances",
                        "late_fee_inr": val_col,
                    })
                    in_late_payment = False
            continue
        if in_late_payment and s.startswith("|") and "---" not in s:
            cols = [clean_text_item(c) for c in s.strip("|").split("|")]
            cols = [c for c in cols if c]
            if len(cols) >= 2 and not any(h in cols[0].lower() for h in ("statement balance", "outstanding balance", "balance")):
                result["late_payment_slabs"].append({
                    "statement_balance_slab": cols[0].rstrip(":").strip(),
                    "late_fee_inr": cols[1],
                })
            elif len(cols) >= 2 and ("rs." in cols[1].lower() or "nil" in cols[1].lower()):
                result["late_payment_slabs"].append({
                    "statement_balance_slab": cols[0].rstrip(":").strip(),
                    "late_fee_inr": cols[1],
                })
            continue
        elif in_late_payment and not s.startswith("|"):
            in_late_payment = False

        # Section-specific extraction
        if section == "about":
            c = clean_text_item(s)
            if c and len(c) > 25:
                about_paras.append(c)

        elif section == "rewards" and subsec == "reward_redemption":
            # Match bullet lines like "* Gold Catalogue: Rs. 0.65" or "1 RP = Rs. 0.25"
            c = clean_text_item(s)
            m_kv = re.match(r"^([^:]{2,50}):\s*(.+)$", c)
            if m_kv and ("rs" in m_kv.group(2).lower() or "₹" in m_kv.group(2) or "mile" in m_kv.group(2).lower() or "cash" in m_kv.group(2).lower()):
                k = slugify(m_kv.group(1)).replace("-", "_")
                result["point_value_inr_matrix"][k] = m_kv.group(2).strip()

        elif section == "benefits":
            c = clean_text_item(s)
            if c and len(c) > 6:
                if subsec == "dining":
                    result["dining_benefits"].append(c)
                elif subsec == "movie":
                    result["movie_benefits"].append(c)
                elif subsec == "golf":
                    result["golf_benefits"].append(c)
                elif subsec == "insurance":
                    result["insurance_cover"].append(c)
                elif subsec == "concierge":
                    result["concierge_or_privilege"].append(c)

        elif section == "know":
            c = clean_text_item(s)
            if not c:
                continue
            if subsec == "get_this_card_if" and len(c) > 10:
                result["get_this_card_if"].append(c)
            elif subsec == "eligibility":
                m_el = re.match(r"^([^:]{3,65}):\s*(.+)$", c)
                if m_el:
                    ek = m_el.group(1).strip().lower()
                    ev = m_el.group(2).strip()
                    result["eligibility_raw"][ek] = ev

        elif section == "faq":
            if current_faq_q:
                if s.lower().startswith("everything you need to know"):
                    continue
                current_faq_a.append(s)

    flush_faq()
    if about_paras:
        result["about_overview"] = " ".join(about_paras[:4])
    return result


# ---------------- Cashback / Reward Rate Calculator Model ----------------

# Benchmark overrides, monthly caps, golf rules, and AI ratings live in card_audit_rules.py

def sanitize_forex_markup(forex_val: Any, card_name: str, categories: list[str] | None = None) -> float:
    """Normalize forex markup percentage, guarding against bad Phase-1 regex parses (>5% or <0%)."""
    name_low = (card_name or "").lower()
    cats_low = " ".join(categories or []).lower()
    forex_overrides = (
        ("hsbc rupay cashback", 3.5),
        ("kotak 811", 3.5),
        ("kotak infinite", 2.0),
        ("samsung axis bank infinite", 3.5),
        ("bandhan bank ignite", 3.5),
        ("priority visa infinite", 3.5),
    )
    for key, val in forex_overrides:
        if key in name_low:
            return val
    if forex_val is not None:
        try:
            fval = float(forex_val)
            if 0.0 <= fval <= 5.0:
                return round(fval, 2)
        except (TypeError, ValueError):
            pass
    if "onecard" in name_low or "one card" in name_low:
        return 1.0
    if re.search(r"\b(?:scapia|zero forex|ixigo|uni nx|nre)\b", name_low):
        return 0.0
    if "zero/low forex" in cats_low and "simplifi" not in name_low and "dream" not in name_low:
        return 2.0
    return 3.5


def _parse_inr_amount(raw_num: str, unit: str | None) -> float | None:
    try:
        val = float(raw_num.replace(",", "").strip())
    except (TypeError, ValueError):
        return None
    u = (unit or "").strip().lower()
    if u in ("lakh", "lakhs", "lac", "lacs", "l"):
        val *= 100000.0
    elif u in ("cr", "crore", "crores"):
        val *= 10000000.0
    elif u == "k":
        val *= 1000.0
    return val


def extract_fee_waiver_spend_inr(card: dict[str, Any], pb_parsed: dict[str, Any]) -> int | None:
    fees = card.get("fees") or {}
    existing = fees.get("fee_waiver_spend_inr")
    try:
        if existing is not None and int(existing) >= 10000:
            return int(existing)
    except (TypeError, ValueError):
        pass

    if card.get("is_ltf_available") or int(fees.get("annual_fee_inr") or 0) == 0:
        return None

    rw = card.get("rewards") or {}
    bf = card.get("benefits_and_features") or {}
    candidates: list[str] = []
    candidates.extend(str(x) for x in (rw.get("milestone_benefits") or []))
    candidates.extend(str(x) for x in (bf.get("highlights") or []))
    if pb_parsed.get("about_overview"):
        candidates.append(str(pb_parsed["about_overview"]))
    for fq in (pb_parsed.get("faqs") or []):
        if isinstance(fq, dict):
            candidates.append(f"{fq.get('q', '')} {fq.get('a', '')}")
        else:
            candidates.append(str(fq))
    if fees.get("joining_fee_waiver"):
        candidates.append(str(fees["joining_fee_waiver"]))

    waiver_pat = re.compile(
        r"(?:rs\.?|₹|inr)\s*([\d,]+(?:\.\d+)?)\s*(lakhs?|lacs?|cr|crores?|k)?",
        re.IGNORECASE,
    )
    for raw in candidates:
        for seg in re.split(r"[;\n]|(?<![Rr][Ss])(?<!\d)\.(?=\s+[A-Z])", raw):
            low = seg.lower()
            if not low.strip():
                continue
            if any(bad in low for bad in ("fuel", "surcharge", "petrol", "late payment", "cash advance")):
                continue
            has_waiver_kw = bool(
                re.search(
                    r"(?:annual|renewal|membership)\s+(?:card\s+)?fee\s+(?:is\s+|will\s+be\s+)?(?:waiv|revers)|waiv\w*\s*(?:off)?\s*on\s*(?:annual\s*|yearly\s*)?spend|spend[- ]based\s+(?:annual\s+)?fee\s+waiv|fee\s+waiv\w*\s+on\s+spend",
                    low,
                )
            )
            if not has_waiver_kw:
                continue
            for m in waiver_pat.finditer(seg):
                val = _parse_inr_amount(m.group(1), m.group(2))
                if val is not None and 20000 <= val <= 5000000:
                    return int(round(val))
    return None


def extract_min_salaried_income_inr(card: dict[str, Any], pb_parsed: dict[str, Any]) -> int | None:
    elig_raw = card.get("eligibility") or {}
    existing = elig_raw.get("min_monthly_income_salaried_inr")
    try:
        if existing is not None and 10000 <= int(existing) <= 2500000:
            return int(existing)
    except (TypeError, ValueError):
        pass

    pb_elig = pb_parsed.get("eligibility_raw") or {}
    texts: list[str] = []
    for k, v in pb_elig.items():
        kl = str(k).lower()
        if any(tok in kl for tok in ("income", "salaried", "salary", "itr", "earning")):
            texts.append(f"{k}: {v}")
    if elig_raw.get("notes"):
        texts.append(str(elig_raw["notes"]))

    amt_pat = re.compile(
        r"(?:rs\.?|₹|inr)\s*([\d,]+(?:\.\d+)?)\s*(lakhs?|lacs?|lpa|cr|crores?|k)?",
        re.IGNORECASE,
    )
    for txt in texts:
        low = txt.lower()
        is_annual = bool(re.search(r"\b(?:lpa|p\.?a\.?|annum|annual|per\s+year|itr)\b", low))
        is_monthly = bool(re.search(r"\b(?:p\.?m\.?|per\s+month|monthly)\b", low))
        m = amt_pat.search(txt)
        if not m:
            continue
        unit = m.group(2)
        if unit and unit.lower() == "lpa":
            is_annual = True
            unit = "lakh"
        val = _parse_inr_amount(m.group(1), unit)
        if val is None:
            continue
        if is_annual or (not is_monthly and val >= 200000):
            monthly = val / 12.0
        else:
            monthly = val
        if 10000 <= monthly <= 2500000:
            return int(round(monthly))

    itr = elig_raw.get("min_annual_itr_self_employed_inr")
    try:
        if itr is not None and float(itr) >= 120000:
            monthly = float(itr) / 12.0
            if 10000 <= monthly <= 2500000:
                return int(round(monthly))
    except (TypeError, ValueError):
        pass
    return None


def compute_calculator_model(
    card: dict[str, Any],
    pb_parsed: dict[str, Any],
    waiver_spend_override: int | None = None,
) -> dict[str, Any]:
    cid = card["card_id"]
    fees = card.get("fees") or {}
    rewards = card.get("rewards") or {}
    bf = card.get("benefits_and_features") or {}
    name_low = (card.get("card_name") or "").lower()
    cats_low = " ".join(card.get("categories") or []).lower()

    raw_mults = clean_list_items(rewards.get("category_multipliers"))
    non_promo_mults = [m for m in raw_mults if not _PROMO_LINE_RE.search(m.lower())]
    mult_text = " ".join(non_promo_mults).lower()

    excl_list = clean_list_items(rewards.get("exclusions"))
    excl_seen = {x.lower() for x in excl_list}
    # Auto-detect explicit exclusions from capping/highlights/multipliers/milestones
    scan_excl_lines = (
        clean_list_items(bf.get("highlights"))
        + clean_list_items(rewards.get("milestone_benefits"))
        + raw_mults
    )
    excl_kw_labels = [
        ("rent", "Rent payments"),
        ("fuel", "Fuel transactions (reward points excluded)"),
        ("wallet", "Wallet loads"),
        ("utility", "Utility bill payments"),
        ("utilities", "Utility bill payments"),
        ("government", "Government / tax payments"),
        ("education", "Education fee payments"),
        ("insurance", "Insurance premium payments"),
        ("emi", "EMI / Cash withdrawal transactions"),
        ("jewellery", "Jewellery & gold purchases"),
        ("jewelry", "Jewellery & gold purchases"),
    ]
    for line in scan_excl_lines:
        ll = line.lower()
        if any(trigger in ll for trigger in ("exclud", "no reward", "will not earn", "not eligible for reward", "except on")):
            for kw, label in excl_kw_labels:
                if re.search(rf"\b{kw}\b", ll) and not any(kw in ex for ex in excl_seen):
                    excl_list.append(label)
                    excl_seen.add(label.lower())
    excl_low = " ".join(excl_seen)

    fb_base, fb_accel, fb_caps = extract_fallback_rates_and_caps(card)
    base = float(rewards.get("base_reward_rate_pct") if rewards.get("base_reward_rate_pct") is not None else fb_base)
    raw_accel = rewards.get("accelerated_reward_rate_pct")
    if raw_accel is not None:
        raw_accel_f = float(raw_accel)
        # If non-curated card's raw accelerated rate came from a promo/discount line and exceeds fallback, use fb_accel bound
        if cid not in AUDIT_CALC_OVERRIDES and raw_accel_f > max(base, fb_accel, 6.0) and fb_accel < raw_accel_f:
            accel = float(max(base, fb_accel))
        else:
            accel = raw_accel_f
    else:
        accel = float(max(base, fb_accel))
    # Cap outlier bad parses defensively for generic model
    if base > 10.0:
        base = round(min(base, 5.0), 2)
    if accel > 35.0:
        accel = round(min(accel, 25.0), 2)

    pt_val = float(rewards.get("point_value_inr") or 0.25)
    forex = sanitize_forex_markup(fees.get("forex_markup_pct"), card.get("card_name") or "", card.get("categories") or [])

    rates: dict[str, float]
    monthly_caps: dict[str, int] = {}
    capping_notes: list[str] = []

    category_caveats: dict[str, str] = {}
    if cid in AUDIT_CALC_OVERRIDES:
        ov = AUDIT_CALC_OVERRIDES[cid]
        rates = dict(ov["rates"])
        monthly_caps = dict(ov.get("monthly_caps_inr") or {})
        capping_notes = list(ov["capping"])
        category_caveats = dict(ov.get("category_caveats") or {})
    else:
        monthly_caps = dict(fb_caps)
        primary_low = (card.get("primary_category") or "").lower()
        bank_low = (card.get("bank") or "").lower()
        online_r = base
        ecom_r = base
        dining_r = base
        groc_r = base
        travel_r = base
        upi_r = base if card.get("is_rupay_upi_enabled") else 0.0
        util_r = 0.0
        fuel_r = 0.0
        ins_r = 0.0
        edu_rent_r = 0.0
        intl_net = round(base - (forex * 1.18), 2)
        offline_r = base

        def _line_earn_pct(line: str) -> float | None:
            low = line.lower()
            if any(bad in low for bad in ("exclud", "no reward", "will not earn", "not eligible", "surcharge", "waiver")):
                return None
            # 1. Explicit points per Rs formula on this line
            pts_rates: list[float] = []
            for rp_s, rs_s in re.findall(
                r"(\d+(?:\.\d+)?)\s*(?:reward\s*points?|points?|rp|coins?|neucoins?|mycash|jewels)\s*(?:per|for\s+every|on\s+every|/)\s*(?:rs\.?|₹)\s*(\d+)",
                line,
                re.I,
            ):
                rs_num = float(rs_s)
                if rs_num > 0:
                    val = round((float(rp_s) * pt_val / rs_num) * 100.0, 2)
                    if 0.1 <= val <= 15.0:
                        pts_rates.append(val)
            if pts_rates:
                return max(pts_rates)

            # 2. Explicit percentage earn rate on this line (reject discount/off promo phrasing)
            if not any(p in low for p in ("discount", " off ", "% off", "save up to", "bogo", "instant off", "flat off")):
                pct_vals: list[float] = []
                has_earn_cue = any(w in low for w in ("cashback", "reward", "point", "neucoin", "coin", "mile", "jewel", "value", "return", "back", "earn"))
                for m in re.findall(r"(\d+(?:\.\d+)?)\s*%", line):
                    v = float(m)
                    if 0.1 <= v <= 15.0 and (has_earn_cue or v <= 5.0):
                        pct_vals.append(v)
                if pct_vals:
                    return max(pct_vals)

            # 3. NX multiplier on this line (e.g., 5X on dining)
            mx = re.search(r"\b(\d+(?:\.\d+)?)\s*x\b", low)
            if mx and any(w in low for w in ("reward", "point", "multiplier", "accelerate", "bonus", "earn", "travel", "dining", "shop", "online")):
                mult = float(mx.group(1))
                if 1.5 <= mult <= 12.0:
                    return round(min(base * mult, 12.0), 2)
            return None

        scan_lines = list(non_promo_mults)
        for h_line in clean_list_items(bf.get("highlights")):
            if not _PROMO_LINE_RE.search(h_line.lower()):
                scan_lines.append(h_line)

        def _conservative_boost(line_rate: float | None, max_cap: float) -> float:
            if line_rate is not None:
                return round(min(line_rate, max_cap), 2)
            return round(min(max(base * 1.5, 1.5), min(accel, 3.0)), 2)

        for raw_line in scan_lines:
            ll = raw_line.lower()
            if _PROMO_LINE_RE.search(ll):
                continue
            if any(bad in ll for bad in ("exclud", "no reward", "will not earn", "not eligible")):
                continue
            lr = _line_earn_pct(raw_line)
            has_earn_intent = lr is not None or any(w in ll for w in ("cashback", "reward", "point", "earn", "accelerate", "bonus", "multiplier", "neucoin", "jewel", "mile"))

            if ("online" in ll or "e-com" in ll or "ecommerce" in ll) and has_earn_intent and not ("surcharge" in ll or "waiver" in ll):
                online_r = max(online_r, _conservative_boost(lr, 6.0))
            if any(k in ll for k in ("amazon", "flipkart", "myntra", "nykaa", "shopping")) and has_earn_intent:
                ecom_r = max(ecom_r, _conservative_boost(lr, 8.0))
            if any(k in ll for k in ("dining", "swiggy", "zomato", "eazydiner", "restaurant", "food")) and has_earn_intent:
                dining_r = max(dining_r, _conservative_boost(lr, 10.0))
            if any(k in ll for k in ("grocer", "bigbasket", "blinkit", "zepto", "instamart", "departmental", "neu")) and has_earn_intent:
                groc_r = max(groc_r, _conservative_boost(lr, 10.0))
            if any(k in ll for k in ("flight", "hotel", "ixigo", "indigo", "air india", "miles", "etihad", "marriott", "yatra", "easemytrip", "irctc", "travel")) and has_earn_intent:
                travel_r = max(travel_r, _conservative_boost(lr, 12.0))
            if card.get("is_rupay_upi_enabled") and any(k in ll for k in ("upi", "scan & pay", "scan and pay", "kiwi", "supercard", "neu", "rupay")) and has_earn_intent:
                upi_r = max(upi_r, _conservative_boost(lr, 5.0))
            if (
                not ("utility" in excl_low or "utilities" in excl_low)
                and not any(b in bank_low for b in ("axis", "hsbc", "yes bank", "kotak"))
                and any(k in ll for k in ("utility", "utilities", "airtel", "telecom", "electricity", "bill"))
                and has_earn_intent
                and lr is not None
            ):
                util_r = max(util_r, _conservative_boost(lr, 5.0))
            # Strictly require non-waiver, non-surcharge explicit fuel reward line
            if (
                any(k in ll for k in ("fuel", "hpcl", "bpcl", "iocl", "indianoil", "petrol"))
                and not ("surcharge" in ll or "waiver" in ll)
                and lr is not None
            ):
                fuel_r = max(fuel_r, round(min(lr, 7.5), 2))
            if (
                not ("insurance" in excl_low)
                and not any(b in bank_low for b in ("axis", "hsbc", "yes bank", "rbl", "kotak"))
                and any(k in ll for k in ("lic", "insurance"))
                and has_earn_intent
                and lr is not None
            ):
                ins_r = max(ins_r, _conservative_boost(lr, 5.0))

        # Apply co-branded card identity fallbacks ONLY when card name / primary category itself is specific
        if any(k in name_low for k in ("amazon", "flipkart", "myntra", "nykaa")):
            ecom_r = max(ecom_r, round(min(max(fb_accel, 3.0), 5.0), 2))
        if any(k in name_low for k in ("swiggy", "zomato", "eazydiner")):
            dining_r = max(dining_r, round(min(max(fb_accel, 3.0), 10.0), 2))
        if any(k in name_low for k in ("bigbasket", "blinkit", "zepto", "instamart")):
            groc_r = max(groc_r, round(min(max(fb_accel, 3.0), 10.0), 2))
        if any(k in name_low for k in ("ixigo", "indigo", "air india", "etihad", "marriott", "yatra", "easemytrip", "irctc")) or ("travel" == primary_low and fb_accel >= 3.0):
            travel_r = max(travel_r, round(min(max(fb_accel, 2.5), 10.0), 2))
        if card.get("is_rupay_upi_enabled") and any(k in name_low for k in ("upi", "kiwi", "supercard", "supermoney", "neu", "klick")):
            upi_r = max(upi_r, round(min(max(fb_accel, 1.5), 5.0), 2))
        is_explicit_fuel_card = ("fuel" == primary_low) or any(
            k in name_low for k in ("fuel", "hpcl", "bpcl", "iocl", "indianoil", "octane", "xtrapower", "turbo")
        )
        if is_explicit_fuel_card:
            fuel_r = max(fuel_r, round(min(max(fb_accel, 3.0), 6.5), 2))
        elif fuel_r == 0.0 and "fuel" in excl_low:
            fuel_r = 0.0
        if (
            not ("insurance" in excl_low)
            and not any(b in bank_low for b in ("axis", "hsbc", "yes bank", "rbl", "kotak"))
            and any(k in name_low for k in ("lic", "insurance"))
        ):
            ins_r = max(ins_r, round(min(max(fb_accel, 2.0), 5.0), 2))

        rates = {
            "online_shopping_general": round(online_r, 2),
            "amazon_flipkart_myntra": round(ecom_r, 2),
            "dining_swiggy_zomato": round(dining_r, 2),
            "groceries_quick_commerce": round(groc_r, 2),
            "travel_flights_hotels": round(travel_r, 2),
            "upi_scan_and_pay": round(upi_r, 2),
            "utilities_bills_telecom": round(util_r, 2),
            "fuel": round(fuel_r, 2),
            "insurance": round(ins_r, 2),
            "education_rent_govt": round(edu_rent_r, 2),
            "international_forex_net_of_markup": round(intl_net, 2),
            "offline_general_other": round(offline_r, 2),
        }
        # Detect monthly caps from non-promo multipliers text
        for line in non_promo_mults:
            if any(w in line.lower() for w in ("cap", "max", "upto", "up to", "limit", "per month", "per cycle")):
                capping_notes.append(line)

        # Prevent un-curated cards with >= 4% accelerated rates from looking uncapped
        fallback_capped_cats: list[str] = []
        for ck, cr in rates.items():
            if ck == "international_forex_net_of_markup":
                continue
            if cr >= 4.0 and ck not in monthly_caps:
                monthly_caps[ck] = 1000 if cr >= 6.0 else 1500
                fallback_capped_cats.append(ck.replace("_", " "))
        if fallback_capped_cats:
            capping_notes.append(
                "Conservative monthly cap estimate (Rs. 1,000-1,500/mo) applied on accelerated categories pending explicit issuer cap verification."
            )

    if not capping_notes:
        capping_notes = ["Subject to monthly category/accelerated caps and standard MCC exclusions under issuer T&C."]

    ann_fee = int(fees.get("annual_fee_inr") or 0)
    join_fee = int(fees.get("joining_fee_inr") or 0)
    waiver_spend = waiver_spend_override if waiver_spend_override is not None else fees.get("fee_waiver_spend_inr")
    gst_mult = 1.18 if fees.get("gst_applicable", True) else 1.0

    # Matrix merge: PB parsed matrix + default INR fallback
    matrix = dict(pb_parsed.get("point_value_inr_matrix") or {})
    if not matrix:
        matrix = {"default_redemption": f"Rs. {pt_val:.2f}"}

    return {
        "earn_unit": rewards.get("reward_type") or "Reward Points",
        "base_reward_rate_pct": base,
        "accelerated_reward_rate_pct": accel,
        "point_value_inr_default": pt_val,
        "point_value_inr_matrix": matrix,
        "point_expiry": rewards.get("point_expiry") or "Check issuer T&C (typically 2-3 years)",
        "reward_earning_rules": clean_list_items(rewards.get("category_multipliers"))[:12],
        "effective_return_pct_by_category": rates,
        "monthly_category_caps_inr": monthly_caps,
        "monthly_capping_rules": capping_notes[:6],
        "category_caveats": category_caveats,
        "excluded_categories": excl_list[:10],
        "transfer_partners": clean_list_items(rewards.get("transfer_partners")),
        "fee_waiver_and_milestone_calculator": {
            "joining_fee_inr": join_fee,
            "annual_fee_inr": ann_fee,
            "annual_fee_with_gst_inr": round(ann_fee * gst_mult, 2),
            "fee_waiver_spend_inr": waiver_spend,
            "monthly_spend_for_waiver_inr": round(waiver_spend / 12) if isinstance(waiver_spend, (int, float)) and waiver_spend > 0 else None,
            "milestone_slabs": clean_list_items(rewards.get("milestone_benefits"))[:8],
        },
    }


# ---------------- Card-Specific Lounge Matching Engine ----------------

def build_lounge_mapper(lounge_catalog: dict[str, Any], lounge_master: dict[str, Any]):
    programs: dict[str, dict[str, Any]] = lounge_catalog.get("programs", {})
    base_airports = lounge_master.get("participating_indian_airport_lounges", [])

    def _lounge_quota_active(val: Any) -> bool:
        if isinstance(val, dict):
            v_yr = val.get("visits_per_year") or 0
            v_qtr = val.get("visits_per_quarter") or 0
            if v_yr > 0 or v_qtr > 0:
                return True
            summ = str(val.get("summary") or "").lower()
            if "unlimited" in summ and "no " not in summ:
                return True
            return False
        s_low = str(val or "").strip().lower()
        return not any(s_low.startswith(x) for x in ("nil", "none", "0 ", "no ")) and len(s_low) > 3

    def match_card_lounge_programs(card: dict[str, Any]) -> dict[str, Any]:
        la = card.get("lounge_access") or {}
        dom = la.get("domestic") or {}
        intl = la.get("international") or {}
        rail = la.get("railway") or {}

        dom_summary = (dom.get("summary") or "") if isinstance(dom, dict) else str(dom)
        dom_criteria = (dom.get("spend_criteria") or "") if isinstance(dom, dict) else ""
        dom_low = (dom_summary + " " + dom_criteria).lower()

        intl_summary = (intl.get("summary") or "") if isinstance(intl, dict) else str(intl)
        intl_criteria = (intl.get("spend_criteria") or "") if isinstance(intl, dict) else ""
        intl_low = (intl_summary + " " + intl_criteria + " " + str(intl.get("program", "") if isinstance(intl, dict) else "")).lower()

        cname_low = (card.get("card_name") or "").lower()
        bank = card.get("bank") or ""
        bank_low = bank.lower()
        net_low = (card.get("card_network") or "").lower()

        has_dom = _lounge_quota_active(dom)
        has_intl = _lounge_quota_active(intl)
        has_rail = _lounge_quota_active(rail)

        if not (has_dom or has_intl or has_rail):
            return {
                "domestic": dom,
                "international": intl,
                "railway": rail,
                "has_domestic_lounge": False,
                "has_international_lounge": False,
                "has_railway_lounge": False,
                "no_spend_domestic_lounge": False,
                "applicable_lounge_links": [],
                "participating_lounges_matched": [],
                "participating_lounges_count": 0,
                "no_lounge_note": "This card does not provide complimentary domestic airport, international airport, or railway lounge access.",
            }

        selected_pids: list[str] = []

        def add_pid(pid: str):
            if pid in programs and pid not in selected_pids:
                selected_pids.append(pid)

        # Bank-specific mapping for Domestic & International (strictly valid catalog PIDs)
        if has_dom:
            if "hdfc" in bank_low:
                if "infinia" in cname_low:
                    add_pid("page_hoi_hdfc_infinia")
                    add_pid("hdfc_infinia")
                elif "regalia" in cname_low:
                    add_pid("hdfc_regalia_gold")
                elif "diners" in cname_low:
                    add_pid("hdfc_diners_black_intl")
                elif "tata neu infinity" in cname_low:
                    add_pid("hdfc_tata_neu_infinity")
                elif "tata neu" in cname_low:
                    add_pid("hdfc_tata_neu_plus")
                add_pid("page_hdfc_lounge_guide")

            elif "sbi" in bank_low:
                if "elite" in cname_low or "aurum" in cname_low:
                    add_pid("sbi_elite")
                elif any(k in cname_low for k in ("prime", "pulse", "miles", "vistara", "air india")):
                    add_pid("sbi_prime")
                else:
                    add_pid("sbi_set_b")
                add_pid("page_sbi_lounge_page")

            elif "axis" in bank_low or "lic" in bank_low:
                add_pid("axis_lounge_program")
                add_pid("axis_lounge_tnc")
                add_pid("page_axis_lounge_page")

            elif "idfc" in bank_low:
                if "lic" in cname_low:
                    add_pid("idfc_lic_select")
                add_pid("idfc_dc_lounge")

            elif "au small finance" in bank_low:
                add_pid("page_hoi_au_cards")

            elif "indusind" in bank_low:
                if "tiger" in cname_low:
                    add_pid("page_indusind_tiger_pp")
                add_pid("indusind_lounge_program")

            elif "hsbc" in bank_low:
                add_pid("hsbc_lounge_tnc")
                add_pid("page_hsbc_lounge_page")
                if "travelone" in cname_low:
                    add_pid("page_hsbc_travelone_lk")

            elif "bobcard" in bank_low or "bank of baroda" in bank_low:
                add_pid("page_bobcard_lounge_blog")

            elif "scapia" in bank_low or "scapia" in cname_low:
                add_pid("scapia_federal_lounge")

            elif "yes" in bank_low:
                add_pid("yes_domestic_lounge")

            elif "american express" in bank_low:
                add_pid("page_amex_platinum_lounge")

            elif "idbi" in bank_low:
                if "mastercard" in net_low:
                    add_pid("idbi_mastercard_lounge")
                if "visa" in net_low or not selected_pids:
                    add_pid("idbi_visa_lounge")

            # Network-based programs for RuPay / Visa / Mastercard / Diners
            if "rupay" in net_low:
                add_pid("page_rupay_lounge_directory")
            if "visa" in net_low:
                add_pid("visa_india_lounges")
                add_pid("page_visa_lounge_offer")
            if "mastercard" in net_low:
                add_pid("mastercard_india_lounges_pdf")
            if not selected_pids:
                add_pid("visa_india_lounges")

        # International Priority Pass / LoungeKey / DreamFolks links
        if has_intl:
            if "hsbc" in bank_low and ("loungekey" in intl_low or "travelone" in cname_low):
                add_pid("page_hsbc_travelone_lk")
            if "indusind" in bank_low:
                add_pid("page_indusind_pp_tnc")
                if "tiger" in cname_low:
                    add_pid("page_indusind_tiger_pp")
            if "american express" in bank_low:
                add_pid("page_amex_platinum_lounge")
            if "rupay" in net_low:
                add_pid("page_rupay_lounge_directory")
            add_pid("priority_pass_directory")

        # Railway lounge programs
        if has_rail:
            if "hdfc" in bank_low or "irctc" in cname_low:
                add_pid("hdfc_irctc_railway")
                add_pid("page_dreamfolks_hdfc_irctc")

        applicable_links: list[dict[str, Any]] = []
        seen_urls: set[str] = set()
        lounges_combined: list[dict[str, Any]] = []
        seen_lounges: set[tuple[str, str]] = set()

        for pid in selected_pids:
            p = programs[pid]
            u = (p.get("official_url") or "").strip()
            norm_u = re.sub(r"^http://", "https://", u.rstrip("/").lower())
            if u and norm_u not in seen_urls:
                seen_urls.add(norm_u)
                applicable_links.append({
                    "program_id": pid,
                    "title": p.get("title"),
                    "url": u,
                    "secondary_url": p.get("secondary_url"),
                    "source_type": p.get("source_type"),
                    "parsed_lounges_count": p.get("parsed_lounges_count", 0),
                    "local_pdf_path": p.get("local_pdf_path"),
                })
            for item in p.get("parsed_lounges") or []:
                lname = (item.get("lounge_name") or "").strip()
                city = (item.get("city") or "").strip()
                k = (city.lower(), lname[:50].lower())
                if lname and k not in seen_lounges:
                    seen_lounges.add(k)
                    lounges_combined.append({**item, "source_program_id": pid})

        # If a domestic-lounge card's linked PDFs returned 0 parsed entries, backfill from verified India airport master
        dom_parsed = [l for l in lounges_combined if l.get("terminal_type") != "Railway"]
        if has_dom and len(dom_parsed) < 8:
            for item in base_airports[:60]:
                lname = (item.get("lounge_name") or "").strip()
                city = (item.get("city") or "").strip()
                k = (city.lower(), lname[:50].lower())
                if lname and k not in seen_lounges:
                    seen_lounges.add(k)
                    lounges_combined.append({
                        "city": city,
                        "lounge_name": lname,
                        "terminal": item.get("terminal", ""),
                        "terminal_type": item.get("terminal_type", "Domestic"),
                        "source_program_id": "baseline_india_airports",
                    })

        # Keep cap reasonable (~95 total entries, keeping railway entries prioritized if has_rail)
        rail_entries = [x for x in lounges_combined if x.get("terminal_type") == "Railway"]
        air_entries = [x for x in lounges_combined if x.get("terminal_type") != "Railway"]
        final_lounges = (rail_entries[:30] + air_entries[:80]) if has_rail else air_entries[:80]

        dom_crit_low = dom_criteria.lower()
        dom_combined_low = dom_crit_low + " " + dom_low
        has_spend_blocker = bool(
            re.search(
                r"rs\.?\s*\d[\d,]*|/month|/qtr|/quarter|lakh|\blac\b|spend\s+rs|spend\s+of|previous\s+(?:quarter|month|year)|quarterly\s+spend|preceding|flight\s+booking|spend-based|spend\s+requirement|spend\s+threshold|min\.?\s*spend|paid.*membership|see\s+.*\s*t&c|criteria\s+apply|check\s+.*spend|specified",
                dom_combined_low,
            )
        )
        explicit_no_spend = (
            ("no spend criteria" in dom_crit_low and "specified" not in dom_crit_low)
            or "zero spend" in dom_crit_low
            or "unconditional" in dom_crit_low
            or ("unlimited" in dom_summary.lower() and "spend" not in dom_crit_low and "see " not in dom_crit_low)
        )
        no_spend = bool(has_dom and explicit_no_spend and not has_spend_blocker)

        return {
            "domestic": dom,
            "international": intl,
            "railway": rail,
            "has_domestic_lounge": has_dom,
            "has_international_lounge": has_intl,
            "has_railway_lounge": has_rail,
            "no_spend_domestic_lounge": no_spend,
            "applicable_lounge_links": applicable_links,
            "participating_lounges_matched": final_lounges,
            "participating_lounges_count": len(final_lounges),
        }

    return match_card_lounge_programs


# ---------------- Reddit Corpus Indexer & Matcher ----------------

REDDIT_ALIAS_MAP: dict[str, tuple[str, ...]] = {
    "HDFC Infinia": ("infinia",),
    "HDFC Diners Club Black": ("diners club black", "dcb metal", "diners black"),
    "HDFC Diners Club Privilege": ("diners club privilege", "dcp "),
    "HDFC BizBlack": ("bizblack", "biz black"),
    "HDFC BizPower": ("bizpower", "biz power"),
    "HDFC Regalia Gold": ("regalia gold",),
    "HDFC Millennia": ("millennia",),
    "HDFC Swiggy": ("swiggy hdfc", "hdfc swiggy"),
    "HDFC Tata Neu Infinity": ("tata neu infinity", "neu infinity"),
    "HDFC Tata Neu Plus": ("tata neu plus", "neu plus"),
    "SBI Cashback": ("cashback sbi", "sbi cashback"),
    "SBI Elite": ("sbi card elite", "sbi elite"),
    "SBI SimplyCLICK": ("simplyclick",),
    "SBI SimplySAVE": ("simplysave",),
    "Axis Atlas": ("axis atlas", "axis bank atlas"),
    "Axis Airtel": ("airtel axis", "axis airtel"),
    "Axis Flipkart": ("flipkart axis", "axis flipkart"),
    "Axis Ace": ("axis bank ace", "axis ace"),
    "Axis Magnus": ("axis bank magnus", "axis magnus", "magnus burgundy"),
    "Axis Horizon": ("axis horizon", "axis bank horizon"),
    "Axis My Zone": ("my zone", "myzone"),
    "Axis Neo": ("axis neo", "axis bank neo"),
    "Axis Privilege": ("axis privilege",),
    "Axis Select": ("axis select",),
    "ICICI Amazon Pay": ("amazon pay icici",),
    "ICICI Emeralde Private Metal": ("emeralde private",),
    "ICICI Sapphiro": ("sapphiro",),
    "ICICI Rubyx": ("rubyx",),
    "ICICI Coral": ("icici coral", "coral credit card"),
    "HSBC Live+": ("hsbc live+", "hsbc live plus"),
    "HSBC TravelOne": ("travelone", "travel one"),
    "HSBC Premier": ("hsbc premier",),
    "AU Ixigo": ("au ixigo", "ixigo au"),
    "Federal Scapia": ("scapia",),
    "Federal Celesta": ("federal celesta", "celesta", "federal signet"),
    "Kotak Zen Signature": ("kotak zen", "zen signature"),
    "Kotak PVR": ("kotak pvr",),
    "OneCard": ("onecard",),
    "IndusInd Tiger": ("indusind tiger", "indusind bank tiger"),
    "IndusInd Eazydiner": ("eazydiner",),
    "IndusInd Pinnacle": ("pinnacle",),
    "Amex Platinum Travel": ("amex platinum travel", "platinum travel"),
    "Amex Platinum Charge": ("amex platinum charge", "american express platinum card"),
    "Amex Gold Charge": ("american express gold", "amex gold"),
    "Amex MRCC": ("membership rewards", "mrcc"),
    "IDFC FIRST Wealth": ("idfc first wealth", "first wealth"),
    "IDFC FIRST Mayura": ("mayura",),
    "IDFC FIRST Ashva": ("ashva",),
    "RBL World Safari": ("world safari",),
    "YES Kiwi": ("kiwi yes bank", "kiwi rupay"),
    "SuperMoney SuperCard": ("supermoney", "supercard"),
}

# If a thread title explicitly spotlights a flagship/specific card below,
# do NOT match that thread to unrelated cards just because comments/body mention comparisons.
FLAGSHIP_TITLE_LOCKS: dict[str, tuple[str, ...]] = {
    "infinia": ("infinia",),
    "diners club black": ("diners club black", "diners black"),
    "dcb": ("diners club black", "diners black"),
    "diners club privilege": ("diners club privilege",),
    "regalia gold": ("regalia gold",),
    "millennia": ("millennia",),
    "bizblack": ("bizblack", "biz black"),
    "bizpower": ("bizpower", "biz power"),
    "tata neu": ("tata neu",),
    "swiggy hdfc": ("swiggy",),
    "hdfc swiggy": ("swiggy",),
    "sbi cashback": ("cashback sbi",),
    "cashback sbi": ("cashback sbi",),
    "axis magnus": ("magnus",),
    "axis atlas": ("atlas",),
    "airtel axis": ("airtel",),
    "axis airtel": ("airtel",),
    "amazon pay icici": ("amazon pay",),
    "emeralde": ("emeralde",),
    "kotak zen": ("zen",),
    "kotak pvr": ("pvr",),
    "world safari": ("world safari",),
    "eazydiner": ("eazydiner",),
    "scapia": ("scapia",),
    "kiwi": ("kiwi",),
    "american express gold": ("gold",),
    "amex gold": ("gold",),
    "platinum travel": ("platinum travel",),
    "supercard": ("supermoney", "supercard"),
    "axis neo": ("neo",),
}


def load_reddit_corpus(reddit_insights: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    """Build clean deduplicated thread list from all raw threads/*.md and structured snippets."""
    records_by_url: dict[str, dict[str, Any]] = {}

    insights_by_url: dict[str, dict[str, Any]] = {}
    for item in (reddit_insights.get("threads") or []) + (reddit_insights.get("feeds") or []):
        u = item.get("url")
        if u:
            insights_by_url[u.split("?")[0].rstrip("/") + "/"] = item

    for md in sorted(REDDIT_THREADS_DIR.glob("*.md")):
        txt = md.read_text(encoding="utf-8", errors="ignore")
        lines = txt.splitlines()
        title = ""
        summary_parts: list[str] = []
        op_parts: list[str] = []
        in_body = False
        url = ""

        stem = md.stem
        tid = ""
        m_id = re.match(r"^(?:mi_comments_)?([a-z0-9]{5,9})_", stem, re.I)
        if m_id:
            tid = m_id.group(1)
        else:
            # Resolve post ID from permalink inside mi_s_*.md or other shortened exports
            for l in lines[:160]:
                mu = re.search(r"https://www\.reddit\.com/r/CreditCardsIndia/comments/([a-z0-9]{5,9})(?:/|$|\?)", l, re.I)
                if mu:
                    tid = mu.group(1)
                    break

        if tid == "1l5eqda":
            # Exclude mega master-index from attaching to individual cards
            continue

        if tid:
            url = f"https://www.reddit.com/r/CreditCardsIndia/comments/{tid}/"

        for l in lines:
            s = l.strip()
            if not s:
                continue
            if s.startswith("# ") and not title:
                title = clean_text_item(s.lstrip("# "))
                in_body = True
                continue
            if in_body:
                low = s.lower()
                if low in {"read more", "share", "sort by:", "related answers section"} or "open comment sort options" in low or "[ ad ]" in low:
                    break
                if s.startswith("![") or re.match(r"^\[[^\]]+\]\(https://www\.reddit\.com/r/CreditCardsIndia/\?f=flair", s):
                    continue
                c = clean_text_item(s)
                if c and len(c) > 10:
                    op_parts.append(c)
                    if len(" ".join(summary_parts)) <= 450:
                        summary_parts.append(c)

        if not url:
            continue
        ins = insights_by_url.get(url, {})
        summary = " ".join(summary_parts)[:380].strip()
        op_full = " ".join(op_parts)[:4000].strip()
        title_clean = title or stem.replace("_", " ").title()
        title_low = title_clean.lower()

        # Compute flagship card & bank title locks active for this thread title
        locked_targets: list[str] = []
        for t_phrase, card_kws in FLAGSHIP_TITLE_LOCKS.items():
            if t_phrase in title_low:
                locked_targets.extend(card_kws)

        bank_lock_map = {
            "hdfc": "hdfc",
            "sbi": "sbi",
            "axis": "axis",
            "icici": "icici",
            "kotak": "kotak",
            "hsbc": "hsbc",
            "indusind": "indusind",
            "amex": "american express",
            "american express": "american express",
            "idfc": "idfc",
            "federal": "federal",
            "au bank": "au small finance",
            "au ixigo": "au small finance",
            "yes bank": "yes bank",
            "kiwi yes": "yes bank",
            "rbl": "rbl",
            "onecard": "onecard",
            "bobcard": "bobcard",
        }
        locked_banks: list[str] = []
        for b_kw, b_target in bank_lock_map.items():
            if re.search(r"\b" + re.escape(b_kw) + r"\b", title_low):
                locked_banks.append(b_target)

        rec = {
            "thread_id": tid,
            "title": title_clean,
            "title_lower": title_low,
            "url": url,
            "summary": summary or op_full[:260],
            "op_lower": (title_clean + " " + op_full).lower(),
            "locked_card_kws": list(dict.fromkeys(locked_targets)),
            "locked_banks": list(dict.fromkeys(locked_banks)),
        }
        prev = records_by_url.get(url)
        if not prev or len(rec["op_lower"]) > len(prev["op_lower"]):
            records_by_url[url] = rec

    thread_records = list(records_by_url.values())

    # Map aggregate mention stats & snippets per alias key
    alias_stats: dict[str, dict[str, Any]] = defaultdict(lambda: {"mentions": 0, "deval": [], "lounge": [], "rec": []})
    for item in (reddit_insights.get("feeds") or []) + (reddit_insights.get("threads") or []):
        for key, cnt in (item.get("card_mentions") or {}).items():
            alias_stats[key]["mentions"] += int(cnt)
        # Attach card-specific snippets lightly
        for snip_list, target_key in (
            (item.get("devaluation_snippets") or [], "deval"),
            (item.get("lounge_snippets") or [], "lounge"),
            (item.get("recommendation_snippets") or [], "rec"),
        ):
            for sn in snip_list[:30]:
                sn_clean = clean_text_item(sn)
                if not sn_clean or len(sn_clean) < 25:
                    continue
                sn_low = sn_clean.lower()
                for alias_name, triggers in REDDIT_ALIAS_MAP.items():
                    if any(tr in sn_low for tr in triggers):
                        if len(alias_stats[alias_name][target_key]) < 4 and sn_clean not in alias_stats[alias_name][target_key]:
                            alias_stats[alias_name][target_key].append(sn_clean[:240])

    return thread_records, alias_stats


# ---------------- Devaluation Risk & Alternates Builder ----------------

def enrich_devaluation(card: dict[str, Any], deval_tracker: dict[str, Any]) -> dict[str, Any]:
    deval = dict(card.get("devaluation") or {})
    bank = card.get("bank") or ""
    profiles = deval_tracker.get("issuer_devaluation_profiles") or {}
    timeline = deval_tracker.get("timeline_2024_2026") or []

    # Match bank profile
    prof = profiles.get(bank)
    if not prof:
        for k, v in profiles.items():
            if k.split()[0].lower() in bank.lower():
                prof = v
                break

    hist = clean_list_items(deval.get("devaluation_history"))
    for ev in timeline:
        if (ev.get("bank") or "").lower() in bank.lower() or bank.lower() in (ev.get("bank") or "").lower():
            cname_tok = slugify(card.get("card_name") or "").split("-")[0]
            line = f"{ev.get('date')}: {ev.get('event')}"
            if (cname_tok in line.lower() or "all" in line.lower() or "cards" in line.lower()) and line not in hist:
                hist.append(line)

    freq = deval.get("devaluation_frequency") or (prof.get("frequency") if prof else "Low to Moderate")
    risk = int(deval.get("devaluation_risk_score") or (prof.get("risk_score") if prof else 3))

    watch = clean_list_items(deval.get("watch_out_vectors"))
    if not watch:
        watch = [
            "Quarterly spend thresholds for domestic airport lounge access",
            "Exclusion of rent, wallet, utilities, education, and government spends from reward points",
        ]
        if prof and prof.get("summary"):
            watch.append(clean_text_item(prof["summary"]))

    return {
        "devaluation_frequency": freq,
        "devaluation_risk_score": risk,
        "last_devalued_on": deval.get("last_devalued_on"),
        "devaluation_history": hist[:8],
        "watch_out_vectors": watch[:5],
    }


def _card_score(card: dict[str, Any]) -> float | None:
    if card.get("_calibrated_rating") is not None:
        try:
            return round(float(card["_calibrated_rating"]), 2)
        except (TypeError, ValueError):
            pass
    r = card.get("ratings") or {}
    for k in ("composite_score", "overall_market_rating", "editorial_rating", "paisabazaar_overall", "aggregator_rating", "market_community_rating"):
        v = r.get(k)
        if v is not None:
            try:
                return round(float(v), 2)
            except (TypeError, ValueError):
                pass
    return None


def select_alternate_options(
    card: dict[str, Any],
    all_cards: list[dict[str, Any]],
    slug_map: dict[str, tuple[str, str]],
) -> list[dict[str, Any]]:
    cid = card["card_id"]
    pcat = card.get("primary_category") or "Rewards"
    cats = set(card.get("categories") or [])
    ann_fee = int((card.get("fees") or {}).get("annual_fee_inr") or 0)
    score_self = _card_score(card) or 3.5

    # Active preferred pool
    pool = [c for c in all_cards if c["card_id"] != cid and "discontinued" not in (c.get("status") or "").lower()]
    if len(pool) < 10:
        pool = [c for c in all_cards if c["card_id"] != cid]

    selected: list[dict[str, Any]] = []
    used_ids: set[str] = {cid}

    def pick_best(cands: list[dict[str, Any]], role: str, reason_fn):
        if not cands:
            return
        best = max(
            cands,
            key=lambda x: (
                len(cats & set(x.get("categories") or [])),
                _card_score(x) or 3.0,
                1 if x.get("bank") != card.get("bank") else 0,
            ),
        )
        bid = best["card_id"]
        used_ids.add(bid)
        bslug, cslug = slug_map[bid]
        selected.append({
            "role": role,
            "card_id": bid,
            "card_name": best["card_name"],
            "bank": best["bank"],
            "bank_slug": bslug,
            "card_slug": cslug,
            "annual_fee_inr": int((best.get("fees") or {}).get("annual_fee_inr") or 0),
            "overall_rating": _card_score(best),
            "reason": reason_fn(best),
        })

    # 1. Better LTF Alternative
    ltf_cands = [
        x for x in pool
        if x["card_id"] not in used_ids
        and x.get("is_ltf_available")
        and (x.get("primary_category") == pcat or (cats & set(x.get("categories") or [])))
    ]
    pick_best(
        ltf_cands,
        "better_ltf_alternative",
        lambda b: f"Lifetime-free (Rs. 0 annual fee) alternative in {b.get('primary_category')} with strong value retention.",
    )

    # 2. Same-Tier / Category Competitor (prefer different bank)
    comp_cands = [
        x for x in pool
        if x["card_id"] not in used_ids
        and x.get("bank") != card.get("bank")
        and (x.get("primary_category") == pcat or (cats & set(x.get("categories") or [])))
        and abs(int((x.get("fees") or {}).get("annual_fee_inr") or 0) - ann_fee) <= max(2000, ann_fee * 0.8)
    ]
    pick_best(
        comp_cands,
        "same_tier_competitor",
        lambda b: f"Direct competitor from {b['bank']} at similar fee tier (Rs. {int((b.get('fees') or {}).get('annual_fee_inr') or 0):,}/yr).",
    )

    # 3. Upgrade Alternative
    upg_cands = [
        x for x in pool
        if x["card_id"] not in used_ids
        and int((x.get("fees") or {}).get("annual_fee_inr") or 0) > ann_fee
        and (_card_score(x) or 3.0) >= max(4.0, score_self)
        and (x.get("primary_category") == pcat or (cats & set(x.get("categories") or [])))
    ]
    pick_best(
        upg_cands,
        "upgrade_alternative",
        lambda b: f"Higher-reward / enhanced-lounge step-up option" + (f" rated {_card_score(b)}/5." if _card_score(b) else "."),
    )

    # 4. Category Standout Alternative (ensure >= 3 alternates total)
    standout_cands = [
        x for x in pool
        if x["card_id"] not in used_ids
        and (_card_score(x) or 3.0) >= 4.2
        and (x.get("primary_category") == pcat or (cats & set(x.get("categories") or [])))
    ]
    pick_best(
        standout_cands,
        "category_standout_alternative",
        lambda b: f"Top-rated {b.get('primary_category')} card in market" + (f" with rating {_card_score(b)}/5." if _card_score(b) else "."),
    )

    # Fallback fill up to at least 3 if narrow niche category
    while len(selected) < 3:
        rem = [x for x in pool if x["card_id"] not in used_ids and (x.get("primary_category") == pcat or (_card_score(x) or 0) >= 4.2)]
        if not rem:
            rem = [x for x in pool if x["card_id"] not in used_ids]
        if not rem:
            break
        pick_best(rem, "popular_alternative", lambda b: f"Widely recommended alternative in {b.get('primary_category')}.")

    return selected[:5]


# ---------------- Markdown Dossier Renderer ----------------

def render_card_markdown(dossier: dict[str, Any]) -> str:
    id_ = dossier["identity"]
    vis = dossier["visual_assets"]
    links = dossier["official_and_reference_links"]
    calc = dossier["reward_calculator_model"]
    lng = dossier["lounge_access_detailed"]
    fees = dossier["fees_and_charges_detailed"]
    ben = dossier["benefits_features_and_faqs"]
    rat = dossier["ratings"]
    pc = dossier["pros_and_cons"]
    red = dossier["reddit_user_feedback"]
    dev = dossier["devaluation_analysis"]
    alts = dossier["alternate_options"]
    elig = dossier["eligibility_detailed"]
    ft = dossier["filter_tags"]

    lines: list[str] = []
    lines.append(f"# {id_['card_name']}")
    lines.append("")
    lines.append(f"**Issuer:** {id_['bank']} | **Network:** {id_['card_network']} | **Tier:** {id_['card_tier']} | **Category:** {id_['primary_category']} | **Status:** {id_['status']}")
    lines.append("")

    if vis.get("image_url") or vis.get("local_image_path"):
        lines.append("## Card Artwork & Visual Identity")
        if vis.get("local_image_path"):
            lines.append(f"- **Local Cached Image:** `{vis['local_image_path']}`")
        if vis.get("image_url"):
            lines.append(f"- **Verified Source Image URL:** {vis['image_url']}")
        lines.append("")

    def fmt_score(val: Any, denom: str = "5") -> str:
        return f"{val}/{denom}" if val is not None else "N/A"

    lines.append("## Snapshot & Market Ratings")
    lines.append("| Attribute | Value |")
    lines.append("|---|---|")
    lines.append(f"| Card ID | `{id_['card_id']}` |")
    lines.append(f"| Bank / Issuer | {id_['bank']} (`{id_['bank_slug']}`) |")
    lines.append(f"| Categories | {', '.join(id_['categories'])} |")
    lines.append(f"| Overall Market Rating | **{fmt_score(rat.get('overall_market_rating'), '5.0')}** |")
    lines.append(f"| Editorial Score / Community Score | {fmt_score(rat.get('editorial_rating'))} | {fmt_score(red.get('community_score'))} |")
    lines.append(f"| Joining Fee / Annual Fee | Rs. {fees['joining_fee_inr']:,} / Rs. {fees['annual_fee_inr']:,} (+GST) |")
    waiver_txt = f"Rs. {fees['fee_waiver_spend_inr']:,}/yr" if fees.get("fee_waiver_spend_inr") else "None / Spend-based N/A"
    lines.append(f"| Annual Fee Waiver Spend | {waiver_txt} |")
    lines.append(f"| Forex Markup | {fees.get('forex_markup_pct')}% |")
    lines.append(f"| Card Flags | LTF={ft['is_ltf']}, FYF={ft['is_fyf']}, FD-Backed={ft['is_fd_backed']}, RuPay-UPI={ft['is_rupay_upi']}, Invite-Only={ft['is_invite_only']} |")
    lines.append("")

    lines.append("## About the Card")
    lines.append(ben.get("about_overview") or pc.get("editorial_summary") or f"{id_['card_name']} is issued by {id_['bank']} under {id_['primary_category']}.")
    lines.append("")

    lines.append("## Good, Bad & Best For Whom")
    lines.append(f"**Summary:** {pc.get('editorial_summary')}")
    lines.append(f"\n**Best For:** {pc.get('best_for_whom')}")
    if pc.get("not_ideal_for"):
        lines.append(f"\n**Not Ideal For:** {pc['not_ideal_for']}")
    if pc.get("recommended_monthly_spend_inr"):
        lines.append(f"\n**Recommended Monthly Spend:** {pc['recommended_monthly_spend_inr']}")
    lines.append("")
    lines.append("### Pros (Good)")
    for p in pc.get("pros") or []:
        lines.append(f"- {p}")
    lines.append("\n### Cons (Bad)")
    for c in pc.get("cons") or []:
        lines.append(f"- {c}")
    lines.append("")

    lines.append("## Reward Calculator & Effective Return Rate by Spend Category")
    lines.append(f"- **Earn Unit:** {calc['earn_unit']} | **Base Rate:** {calc['base_reward_rate_pct']}% | **Accelerated Up To:** {calc['accelerated_reward_rate_pct']}% | **Point Value Default:** Rs. {calc['point_value_inr_default']}")
    lines.append("")
    lines.append("| Standardized Spend Category | Effective Net Return (%) |")
    lines.append("|---|---|")
    for k in CALC_CATEGORIES:
        v = calc["effective_return_pct_by_category"].get(k, 0.0)
        lines.append(f"| `{k}` | {v:.2f}% |")
    lines.append("")
    if calc.get("point_value_inr_matrix"):
        lines.append("**Point Redemption Value Matrix:** " + "; ".join(f"{k}: {v}" for k, v in calc["point_value_inr_matrix"].items()))
        lines.append("")
    if calc.get("monthly_capping_rules"):
        lines.append("**Monthly Capping & Exclusions:**")
        for cap in calc["monthly_capping_rules"]:
            lines.append(f"- {cap}")
        if calc.get("excluded_categories"):
            lines.append(f"- Excluded Categories: {', '.join(calc['excluded_categories'])}")
        lines.append("")

    def fmt_lounge_val(v: Any, kind: str) -> str:
        if isinstance(v, dict):
            summ = v.get("summary") or "Not Applicable"
            extras = []
            if v.get("program") and v.get("program") != "None":
                extras.append(f"Program: {v['program']}")
            if v.get("spend_criteria") and "not applicable" not in str(v.get("spend_criteria")).lower():
                extras.append(f"Condition: {v['spend_criteria']}")
            if v.get("guest_fee") and "not applicable" not in str(v.get("guest_fee")).lower():
                extras.append(f"Guest/Extra Fee: {v['guest_fee']}")
            return f"{summ} ({'; '.join(extras)})" if extras else summ
        return str(v)

    lines.append("## Airport & Railway Lounge Access + Applicable Official Lists")
    lines.append(f"- **Domestic Airport Lounge:** {fmt_lounge_val(lng['domestic'], 'dom')}")
    lines.append(f"- **International Airport Lounge:** {fmt_lounge_val(lng['international'], 'intl')}")
    lines.append(f"- **Railway Lounge:** {fmt_lounge_val(lng['railway'], 'rail')}")
    lines.append("")
    if lng.get("applicable_lounge_links"):
        lines.append("### Applicable Official Lounge Links")
        for al in lng["applicable_lounge_links"]:
            sec_note = f" (Secondary: {al['secondary_url']})" if al.get("secondary_url") else ""
            lines.append(f"- **{al['title']}** [{al['source_type']}, {al['parsed_lounges_count']} parsed]: {al['url']}{sec_note}")
        lines.append("")
        if lng.get("participating_lounges_matched"):
            lines.append(f"### Sample Participating Lounges ({lng['participating_lounges_count']} matched)")
            lines.append("| City | Lounge Name | Terminal / Code | Type |")
            lines.append("|---|---|---|---|")
            for item in lng["participating_lounges_matched"][:25]:
                lines.append(f"| {item.get('city', '')} | {item.get('lounge_name', '')} | {item.get('terminal', '')} | {item.get('terminal_type', '')} |")
            if lng["participating_lounges_count"] > 25:
                lines.append(f"\n*Showing 25 of {lng['participating_lounges_count']} matched entries; see `{id_['card_slug']}.json` for complete list.*")
            lines.append("")
    else:
        lines.append(f"*{lng.get('no_lounge_note', 'No complimentary lounge access provided.')}*")
        lines.append("")

    lines.append("## Fees, Charges & Late Payment Slabs")
    lines.append("| Charge Type | Details |")
    lines.append("|---|---|")
    lines.append(f"| Joining Fee | Rs. {fees['joining_fee_inr']:,} |")
    lines.append(f"| Annual / Renewal Fee | Rs. {fees['annual_fee_inr']:,} (Rs. {calc['fee_waiver_and_milestone_calculator']['annual_fee_with_gst_inr']:,.2f} incl. GST) |")
    lines.append(f"| Finance / Interest Charge (APR) | {fees.get('apr_monthly_pct')}% p.m. ({fees.get('apr_annual_pct')}% p.a.) |")
    lines.append(f"| Cash Advance Fee | {fees.get('cash_advance_fee')} |")
    lines.append(f"| Fuel Surcharge Waiver | {fees.get('fuel_surcharge_waiver')} |")
    lines.append(f"| Redemption / Add-on Card Fee | {fees.get('redemption_fee')} / {fees.get('add_on_card_fee')} |")
    lines.append("")
    if fees.get("late_payment_slabs"):
        lines.append("**Late Payment Fee Slabs:**")
        lines.append("| Statement Balance | Late Fee |")
        lines.append("|---|---|")
        for slab in fees["late_payment_slabs"]:
            lines.append(f"| {slab['statement_balance_slab']} | {slab['late_fee_inr']} |")
        lines.append("")

    lines.append("## Benefits, Milestones & Insurance")
    if ben.get("welcome_benefit"):
        lines.append(f"- **Welcome Benefit:** {ben['welcome_benefit']}")
    for label, key in (
        ("Milestone Benefits", "milestone_benefits"),
        ("Dining Benefits", "dining_benefits"),
        ("Movie / Entertainment", "movie_benefits"),
        ("Golf Privileges", "golf_benefits"),
        ("Insurance Cover", "insurance_cover"),
        ("Get This Card If", "get_this_card_if"),
    ):
        vals = ben.get(key) or []
        if vals:
            lines.append(f"\n### {label}")
            for v in vals[:8]:
                lines.append(f"- {v}")
    lines.append("")

    lines.append("## Reddit Community Feedback & Devaluation Tracker")
    lines.append(f"- **Community Score:** {fmt_score(red.get('community_score'))} | **Captured Mentions:** {red.get('reddit_mentions')}")
    lines.append(f"- **Devaluation Frequency:** {dev['devaluation_frequency']} | **Devaluation Risk Score:** {dev['devaluation_risk_score']}/10 | **Last Devalued:** {dev.get('last_devalued_on') or 'No major recent slash recorded'}")
    if dev.get("devaluation_history"):
        lines.append("\n**Devaluation History:**")
        for h in dev["devaluation_history"]:
            lines.append(f"- {h}")
    if red.get("key_threads"):
        lines.append("\n**Relevant r/CreditCardsIndia Discussions:**")
        for th in red["key_threads"][:5]:
            lines.append(f"- [{th['title']}]({th['url']})")
    lines.append("")

    lines.append("## Alternate Card Options")
    lines.append("| Role | Card Name | Bank | Annual Fee | Rating | Why Consider |")
    lines.append("|---|---|---|---|---|---|")
    for a in alts:
        lines.append(f"| {a['role']} | {a['card_name']} | {a['bank']} | Rs. {a['annual_fee_inr']:,} | {fmt_score(a.get('overall_rating'))} | {a['reason']} |")
    lines.append("")

    lines.append("## Eligibility Criteria")
    lines.append(f"- **Occupation:** {elig.get('occupation')}")
    lines.append(f"- **Age:** {elig.get('age_range')}")
    lines.append(f"- **Min. Salaried Income:** Rs. {elig.get('min_monthly_income_salaried_inr'):,}/month" if elig.get("min_monthly_income_salaried_inr") else "- **Min. Salaried Income:** As per bank policy / relationship")
    if elig.get("govt_employee_income_note"):
        lines.append(f"- **Govt. Employee Note:** {elig['govt_employee_income_note']}")
    if elig.get("min_annual_itr_self_employed_inr"):
        lines.append(f"- **Self-Employed Min. ITR:** Rs. {elig['min_annual_itr_self_employed_inr']:,}/annum")
    lines.append(f"- **Min. CIBIL Score:** {elig.get('min_cibil_score')}")
    if elig.get("approval_notes"):
        lines.append(f"- **Approval Notes:** {elig['approval_notes']}")
    lines.append("")

    if ben.get("faqs"):
        lines.append("## Frequently Asked Questions")
        for fq in ben["faqs"][:10]:
            lines.append(f"### {fq['q']}")
            lines.append(fq["a"])
            lines.append("")

    if dossier.get("latest_offers"):
        lines.append("## Latest Card & Bank Offers")
        for off in dossier["latest_offers"][:6]:
            lines.append(f"- **{off['title']}** ({off.get('category', 'Card Offer')}) — {off.get('summary', '')} [{off.get('valid_till', 'Check Issuer Portal')}]: {off.get('offer_url', '')}")
        lines.append("")

    lines.append("## Official & Reference Links")
    if links.get("bank_url"):
        lines.append(f"- **Official Bank Page:** {links['bank_url']}")
    if links.get("mitc_pdf_url"):
        lines.append(f"- **MITC / Terms PDF:** {links['mitc_pdf_url']}")
    lines.append("")
    return "\n".join(lines)


# ---------------- Main Builder Pipeline ----------------

def main():
    print("[Build] Loading master datasets...", flush=True)
    master = json.loads((MASTER_DIR / "credit_cards_master.json").read_text(encoding="utf-8"))
    cards: list[dict[str, Any]] = [
        c for c in master["cards"]
        if "discontinued" not in (c.get("status") or "").lower()
    ]
    lounge_catalog = json.loads((MASTER_DIR / "lounge_programs_catalog.json").read_text(encoding="utf-8"))
    lounge_master = json.loads((MASTER_DIR / "lounge_access_master.json").read_text(encoding="utf-8"))
    images_idx = json.loads((MASTER_DIR / "card_images_index.json").read_text(encoding="utf-8")).get("images", {})
    deval_tracker = json.loads((MASTER_DIR / "devaluation_tracker.json").read_text(encoding="utf-8"))
    reddit_insights = json.loads((RAW_DIR / "reddit" / "reddit_insights.json").read_text(encoding="utf-8"))
    stem_map_path = MASTER_DIR / "raw_md_stem_map.json"
    stem_map: dict[str, str] = json.loads(stem_map_path.read_text(encoding="utf-8")) if stem_map_path.exists() else {}
    themes_path = MASTER_DIR / "card_themes_index.json"
    card_themes: dict[str, Any] = json.loads(themes_path.read_text(encoding="utf-8")).get("themes", {}) if themes_path.exists() else {}

    offers_path = MASTER_DIR / "latest_offers.json"
    raw_offers = json.loads(offers_path.read_text(encoding="utf-8")).get("offers", []) if offers_path.exists() else []
    offers_by_card: dict[str, list[dict[str, Any]]] = defaultdict(list)
    offers_by_bank: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for off in raw_offers:
        clean_off = {k: v for k, v in off.items() if k != "card_ids"}
        for ocid in off.get("card_ids") or []:
            offers_by_card[ocid].append(clean_off)
        if off.get("scope") != "card_specific":
            offers_by_bank[bank_to_slug(off.get("bank") or "")].append(clean_off)

    print("[Build] Indexing Reddit threads & alias feedback...", flush=True)
    reddit_threads, alias_stats = load_reddit_corpus(reddit_insights)
    match_lounge = build_lounge_mapper(lounge_catalog, lounge_master)

    # Pre-assign strictly unique (bank_slug, card_slug) per card_id
    slug_map: dict[str, tuple[str, str]] = {}
    used_per_bank: dict[str, set[str]] = defaultdict(set)
    for c in cards:
        bslug = bank_to_slug(c["bank"])
        base_cslug = slugify(c["card_name"]) or c["card_id"]
        cslug = base_cslug
        n = 2
        while cslug in used_per_bank[bslug]:
            cslug = f"{base_cslug}-{n}"
            n += 1
        used_per_bank[bslug].add(cslug)
        slug_map[c["card_id"]] = (bslug, cslug)

    # Clean wipe of stale OUT_DIR before writing fresh tree
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    bank_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    app_search_index: list[dict[str, Any]] = []

    now_iso = datetime.now(timezone.utc).isoformat()
    stats = {
        "total_cards": len(cards),
        "cards_with_pb_enrichment": 0,
        "cards_with_mitc_pdf": 0,
        "cards_with_late_slabs": 0,
        "cards_with_lounge_links": 0,
        "cards_with_golf": 0,
        "cards_with_images": 0,
        "cards_with_reddit_threads": 0,
    }

    # Pass 1: Precompute calculator, lounge, golf, devaluation, and calibrated AI ratings
    # so select_alternate_options and Golf category tags see accurate cross-card scores.
    precomputed: dict[str, dict[str, Any]] = {}
    for card in cards:
        cid = card["card_id"]
        srcs = card.get("sources") or {}
        pb_stem = stem_map.get(cid) or pb_stem_from_url(srcs.get("paisabazaar_url"))
        pb_md_path = PB_CARDS_DIR / f"{pb_stem}.md" if pb_stem else Path("/nonexistent")
        pb_parsed = parse_pb_card_markdown(pb_md_path)
        if pb_md_path.exists():
            stats["cards_with_pb_enrichment"] += 1

        mitc_url = sanitize_mitc_url(srcs.get("mitc_pdf_url") or pb_parsed.get("mitc_pdf_url"), card["bank"])
        if mitc_url:
            stats["cards_with_mitc_pdf"] += 1

        img = images_idx.get(cid) or {}
        if img.get("local_image_path"):
            stats["cards_with_images"] += 1

        lng = match_lounge(card)
        if lng["applicable_lounge_links"]:
            stats["cards_with_lounge_links"] += 1

        waiver_spend = extract_fee_waiver_spend_inr(card, pb_parsed)
        min_sal = extract_min_salaried_income_inr(card, pb_parsed)
        calc = compute_calculator_model(card, pb_parsed, waiver_spend_override=waiver_spend)
        fees_raw = card.get("fees") or {}
        forex_val = fees_raw.get("forex_markup_pct")
        forex_num = sanitize_forex_markup(forex_val, card.get("card_name") or "", card.get("categories") or [])
        deval_block = enrich_devaluation(card, deval_tracker)
        golf_summary = extract_golf_summary(card, pb_parsed)

        cats_list = list(card.get("categories") or [])
        if golf_summary and golf_summary.get("has_golf"):
            stats["cards_with_golf"] += 1
            if "Golf" not in cats_list:
                cats_list.append("Golf")
        card["categories"] = cats_list

        calibrated_rating = calibrate_overall_rating(
            card=card,
            rates=calc["effective_return_pct_by_category"],
            monthly_caps=calc.get("monthly_category_caps_inr") or {},
            lng=lng,
            forex_num=forex_num,
            golf_summary=golf_summary,
            deval_block=deval_block,
        )
        card["_calibrated_rating"] = calibrated_rating

        precomputed[cid] = {
            "pb_parsed": pb_parsed,
            "mitc_url": mitc_url,
            "img": img,
            "lng": lng,
            "waiver_spend": waiver_spend,
            "min_sal": min_sal,
            "calc": calc,
            "forex_num": forex_num,
            "deval_block": deval_block,
            "golf_summary": golf_summary,
            "overall_rating": calibrated_rating,
        }

    # Pass 2: Build full dossiers, alternates, and enriched search index
    for card in cards:
        cid = card["card_id"]
        bslug, cslug = slug_map[cid]
        bank_dir = OUT_DIR / bslug
        bank_dir.mkdir(parents=True, exist_ok=True)

        srcs = card.get("sources") or {}
        pre = precomputed[cid]
        pb_parsed = pre["pb_parsed"]
        mitc_url = pre["mitc_url"]
        img = pre["img"]
        lng = pre["lng"]
        calc = pre["calc"]
        forex_num = pre["forex_num"]
        deval_block = pre["deval_block"]
        golf_summary = pre["golf_summary"]
        overall_rating = pre["overall_rating"]

        fees_raw = card.get("fees") or {}
        late_slabs = pb_parsed.get("late_payment_slabs") or []
        if late_slabs:
            stats["cards_with_late_slabs"] += 1

        ann_fee = int(fees_raw.get("annual_fee_inr") or 0)
        if card.get("is_ltf_available") or ann_fee == 0:
            fee_bracket = "Free (LTF)"
        elif ann_fee < 1000:
            fee_bracket = "Under Rs. 1,000"
        elif ann_fee < 3000:
            fee_bracket = "Rs. 1,000 - 2,999"
        elif ann_fee < 10000:
            fee_bracket = "Rs. 3,000 - 9,999"
        else:
            fee_bracket = "Rs. 10,000+"

        elig_raw = card.get("eligibility") or {}
        pb_elig = pb_parsed.get("eligibility_raw") or {}
        min_sal = pre["min_sal"]
        waiver_spend = pre["waiver_spend"]
        min_cibil = elig_raw.get("min_cibil_score") or 730

        # Reddit match
        rat_raw = card.get("ratings") or {}
        red_raw = rat_raw.get("reddit_community_sentiment") or {}
        editorial_rating = rat_raw.get("editorial_rating") or rat_raw.get("paisabazaar_overall") or rat_raw.get("paisabazaar_rating")
        agg_rating = rat_raw.get("aggregator_rating")
        comm_score = rat_raw.get("market_community_rating") or red_raw.get("community_score") or overall_rating
        combined_subratings = {**(rat_raw.get("category_sub_ratings") or rat_raw.get("paisabazaar_subratings") or {}), **(pb_parsed.get("sub_ratings") or {})}
        editorial_review_text = clean_text_item(rat_raw.get("editorial_review_summary") or rat_raw.get("paisabazaar_review_summary") or "")

        cname_low = (card["card_name"] or "").lower()
        matched_aliases: list[str] = []
        for al_name, triggers in REDDIT_ALIAS_MAP.items():
            if any(tr in cname_low for tr in triggers):
                matched_aliases.append(al_name)

        matched_threads: list[dict[str, str]] = []
        seen_thread_urls: set[str] = set()
        search_terms: list[str] = []
        for al in matched_aliases:
            search_terms.extend(REDDIT_ALIAS_MAP[al])
        # Specific core product keywords for general thread fallback
        generic_card_words = {
            "hdfc", "icici", "sbi", "axis", "bank", "credit", "card", "cards", "rupay", "visa",
            "mastercard", "indian", "plus", "gold", "platinum", "rewards", "select", "prime",
            "classic", "signature", "business", "corporate", "money", "simply", "smart", "first",
            "world", "advantage", "club", "cashback", "india", "express", "super", "privilege",
            "metal", "eternal", "empower", "freedom", "miles", "travel", "prosperity", "wealth",
            "value", "essential", "basic", "infinite", "preferred", "titanium",
        }
        core_words = [
            w for w in slugify(card["card_name"]).split("-")
            if w not in generic_card_words and len(w) >= 4
        ]
        bank_low_full = (card["bank"] or "").lower()
        bank_match_key = (
            "yes bank" if "yes" in bank_low_full
            else "union bank" if "union bank" in bank_low_full
            else "indian bank" if bank_low_full == "indian bank"
            else slugify(card["bank"]).split("-")[0]
        )

        def _passes_title_lock(tr_obj: dict[str, Any]) -> bool:
            bank_locks = tr_obj.get("locked_banks") or []
            if bank_locks and not any(bl in bank_low_full for bl in bank_locks):
                return False
            locks = tr_obj.get("locked_card_kws") or []
            if locks and not any(lk in cname_low for lk in locks):
                return False
            return True

        if matched_aliases:
            for tr in reddit_threads:
                if not _passes_title_lock(tr):
                    continue
                if any(term in tr["op_lower"] for term in search_terms):
                    if tr["url"] not in seen_thread_urls:
                        seen_thread_urls.add(tr["url"])
                        matched_threads.append({"title": tr["title"], "url": tr["url"], "snippet": tr["summary"][:260]})
        elif core_words:
            for tr in reddit_threads:
                if not _passes_title_lock(tr):
                    continue
                if re.search(r"\b" + re.escape(bank_match_key) + r"\b", tr["op_lower"]) and any(
                    re.search(r"\b" + re.escape(w) + r"\b", tr["op_lower"]) for w in core_words
                ):
                    if tr["url"] not in seen_thread_urls:
                        seen_thread_urls.add(tr["url"])
                        matched_threads.append({"title": tr["title"], "url": tr["url"], "snippet": tr["summary"][:260]})
        matched_threads = matched_threads[:6]
        if matched_threads:
            stats["cards_with_reddit_threads"] += 1

        warnings: list[str] = []
        total_mentions = int(rat_raw.get("reddit_mentions") or red_raw.get("reddit_mentions") or 0)
        for al in matched_aliases:
            st = alias_stats.get(al)
            if st:
                total_mentions = max(total_mentions, st["mentions"])
                warnings.extend(st["deval"][:2])
                warnings.extend(st["rec"][:2])
        if not warnings:
            if ann_fee >= 2500 and not lng["no_spend_domestic_lounge"]:
                warnings.append("Verify quarterly spend threshold before relying on complimentary lounge entry.")
            if forex_num >= 3.5:
                warnings.append(f"High {forex_num}% (+GST) forex markup makes international swipes net negative.")

        alternates = select_alternate_options(card, cards, slug_map)

        bf = card.get("benefits_and_features") or {}
        rw = card.get("rewards") or {}

        bfw_raw = card.get("best_for_whom")
        if isinstance(bfw_raw, dict):
            best_for_ideal = clean_text_item(str(bfw_raw.get("ideal_for") or ""))
            best_for_not_ideal = clean_text_item(str(bfw_raw.get("not_ideal_for") or "")) or None
            best_for_spend = clean_text_item(str(bfw_raw.get("recommended_monthly_spend_inr") or "")) or None
            best_for_verdict = clean_text_item(str(bfw_raw.get("verdict") or "")) or None
        else:
            best_for_ideal = clean_text_item(str(bfw_raw or ""))
            best_for_not_ideal = None
            best_for_spend = None
            best_for_verdict = None

        if forex_num > 2.0 and "international travelers" in best_for_ideal.lower():
            rates_map = calc.get("effective_return_pct_by_category") or {}
            if card.get("is_rupay_upi_enabled") and max(rates_map.get("dining_swiggy_zomato", 0), rates_map.get("groceries_quick_commerce", 0)) >= 5:
                best_for_ideal = "UPI cashback, Dining, and Grocery shoppers (monthly cap applies)"
                best_for_not_ideal = "Users expecting international reward earnings or high monthly caps"
            else:
                best_for_ideal = f"{card.get('primary_category') or 'Everyday'} & domestic retail cardholders"
            if best_for_verdict and "zero/low forex" in best_for_verdict.lower():
                best_for_verdict = f"{card['card_name']} for everyday domestic {str(card.get('primary_category') or 'rewards').lower()} spends ({forex_num}% standard forex markup)."

        raw_tags = [
            t.strip()
            for t in re.split(r"(?<!\d),(?!\d)|[;/]+", best_for_ideal)
            if len(t.strip()) > 3
        ]
        if best_for_spend:
            raw_tags.append(best_for_spend)
        best_for_tags = list(dict.fromkeys(raw_tags))[:6]

        min_age = elig_raw.get("min_age")
        max_age = elig_raw.get("max_age")
        elig_age_range = pb_elig.get("age") or elig_raw.get("age_range") or (f"{min_age} to {max_age} years" if min_age and max_age else "21 to 65 years")

        # Search requirement keywords
        req_kw = set()
        for tok in slugify(card["card_name"] + " " + card["bank"] + " " + (card.get("primary_category") or "") + " " + " ".join(card.get("categories") or [])).split("-"):
            if len(tok) >= 2:
                req_kw.add(tok)
        if card.get("is_ltf_available"):
            req_kw.update(["ltf", "lifetime-free", "zero-fee"])
        if card.get("is_rupay_upi_enabled"):
            req_kw.update(["upi", "rupay", "scan-and-pay"])
        if lng["has_domestic_lounge"]:
            req_kw.add("lounge")
        if lng["has_railway_lounge"]:
            req_kw.update(["railway", "irctc"])
        if forex_num <= 2.0:
            req_kw.add("low-forex")
        if forex_num == 0.0:
            req_kw.add("zero-forex")
        if golf_summary and golf_summary.get("has_golf"):
            req_kw.add("golf")

        has_golf = bool(golf_summary and golf_summary.get("has_golf"))

        card_offers: list[dict[str, Any]] = []
        seen_offer_ids: set[str] = set()
        for off in offers_by_card.get(cid, []) + offers_by_bank.get(bslug, []):
            oid = off.get("offer_id")
            if oid and oid not in seen_offer_ids:
                seen_offer_ids.add(oid)
                card_offers.append(off)
                if len(card_offers) >= 6:
                    break

        dossier: dict[str, Any] = {
            "identity": {
                "card_id": cid,
                "card_name": card["card_name"],
                "bank": card["bank"],
                "bank_slug": bslug,
                "card_slug": cslug,
                "card_network": card.get("card_network") or "Unknown",
                "card_tier": card.get("card_tier") or "Standard",
                "primary_category": card.get("primary_category") or "Rewards",
                "categories": card.get("categories") or [],
                "status": card.get("status") or "Active",
                "schema_version": "2026.11-dossier-v2",
                "generated_at": now_iso,
            },
            "visual_assets": {
                "image_url": None if (img.get("image_url") and any(d in str(img.get("image_url")).lower() for d in ("paisabazaar", "bankbazaar", "cardinsider"))) else img.get("image_url"),
                "local_image_path": img.get("local_image_path"),
                "image_source": "curated_card_asset" if (img.get("image_source") and any(d in str(img.get("image_source")).lower() for d in ("paisabazaar", "bankbazaar", "cardinsider"))) else img.get("image_source"),
                "match_confidence": img.get("match_confidence", 0.0),
                "has_verified_image": bool(img.get("local_image_path")),
                "card_theme": card_themes.get(cid),
            },
            "official_and_reference_links": {
                "bank_url": srcs.get("bank_url"),
                "mitc_pdf_url": mitc_url,
                "aggregator_urls": [u for u in (srcs.get("aggregator_urls") or []) if u and not any(d in str(u).lower() for d in ("paisabazaar", "bankbazaar", "cardinsider"))],
                "applicable_lounge_list_urls": [
                    {"title": al["title"], "url": al["url"], "source_type": al["source_type"]}
                    for al in lng["applicable_lounge_links"]
                ],
            },
            "filter_tags": {
                "is_ltf": bool(card.get("is_ltf_available")),
                "is_fyf": bool(card.get("is_fyf_available")),
                "is_fd_backed": bool(card.get("is_secured_fd_backed")),
                "is_rupay_upi": bool(card.get("is_rupay_upi_enabled")),
                "is_invite_only": bool(card.get("is_invite_only")),
                "fee_bracket": fee_bracket,
                "has_domestic_lounge": lng["has_domestic_lounge"],
                "has_international_lounge": lng["has_international_lounge"],
                "has_railway_lounge": lng["has_railway_lounge"],
                "no_spend_domestic_lounge": lng["no_spend_domestic_lounge"],
                "has_golf": has_golf,
                "zero_or_low_forex": forex_num <= 2.0,
                "zero_forex": forex_num == 0.0,
                "min_income_salaried_inr": min_sal,
                "min_cibil_score": min_cibil,
                "best_for_tags": best_for_tags,
                "requirement_keywords": sorted(req_kw),
            },
            "reward_calculator_model": calc,
            "lounge_access_detailed": lng,
            "fees_and_charges_detailed": {
                "joining_fee_inr": int(fees_raw.get("joining_fee_inr") or 0),
                "annual_fee_inr": ann_fee,
                "gst_applicable": bool(fees_raw.get("gst_applicable", True)),
                "fee_waiver_spend_inr": waiver_spend,
                "joining_fee_waiver": fees_raw.get("joining_fee_waiver"),
                "forex_markup_pct": forex_num,
                "apr_monthly_pct": fees_raw.get("apr_monthly_pct") or 3.5,
                "apr_annual_pct": fees_raw.get("apr_annual_pct") or 42.0,
                "cash_advance_fee": fees_raw.get("cash_advance_fee") or "2.5% or Rs. 500 whichever is higher",
                "fuel_surcharge_waiver": fees_raw.get("fuel_surcharge_waiver") or "1% waiver at eligible fuel pumps",
                "redemption_fee": fees_raw.get("redemption_fee") or "Check issuer T&C",
                "add_on_card_fee": fees_raw.get("add_on_card_fee") or "Nil / Per issuer T&C",
                "late_payment_slabs": late_slabs,
            },
            "benefits_features_and_faqs": {
                "about_overview": pb_parsed.get("about_overview") or editorial_review_text or best_for_verdict or "",
                "highlights": clean_list_items(bf.get("highlights"), card_name=card["card_name"], bank_name=card["bank"]),
                "welcome_benefit": clean_text_item(str(rw.get("welcome_benefit") or ""), card_name=card["card_name"], bank_name=card["bank"]) or None,
                "milestone_benefits": clean_list_items(rw.get("milestone_benefits")),
                "dining_benefits": clean_list_items((bf.get("dining_benefits") or bf.get("dining") or []) + (pb_parsed.get("dining_benefits") or [])),
                "movie_benefits": clean_list_items((bf.get("movie_benefits") or bf.get("movies_entertainment") or []) + (pb_parsed.get("movie_benefits") or [])),
                "golf_benefits": clean_list_items((bf.get("golf_benefits") or bf.get("golf") or []) + (pb_parsed.get("golf_benefits") or []))
                or (
                    [
                        f"{golf_summary['complimentary_access']} ({golf_summary['eligible_courses']})"
                        + (f" — {golf_summary['spend_condition']}" if golf_summary.get("spend_condition") else "")
                    ]
                    if has_golf and golf_summary
                    else []
                ),
                "golf_summary": golf_summary,
                "insurance_cover": clean_list_items((bf.get("insurance_cover") or []) + (pb_parsed.get("insurance_cover") or [])),
                "concierge_or_privilege": clean_list_items((bf.get("concierge_or_privilege") or bf.get("concierge_and_lifestyle") or []) + (pb_parsed.get("concierge_or_privilege") or [])),
                "get_this_card_if": pb_parsed.get("get_this_card_if") or [],
                "faqs": pb_parsed.get("faqs") or [],
            },
            "ratings": {
                "overall_market_rating": overall_rating,
                "editorial_rating": editorial_rating,
                "aggregator_rating": agg_rating,
                "category_sub_ratings": combined_subratings,
            },
            "pros_and_cons": {
                "editorial_summary": editorial_review_text or best_for_verdict or f"{card['card_name']} is positioned for {best_for_ideal or card.get('primary_category')}.",
                "pros": clean_list_items(card.get("pros")),
                "cons": clean_list_items(card.get("cons")),
                "best_for_whom": best_for_ideal or best_for_verdict or card.get("primary_category"),
                "not_ideal_for": best_for_not_ideal,
                "recommended_monthly_spend_inr": best_for_spend,
                "verdict": best_for_verdict,
            },
            "reddit_user_feedback": {
                "community_score": comm_score,
                "reddit_mentions": total_mentions,
                "sentiment_summary": clean_text_item(str(red_raw.get("sentiment_summary") or "")) or f"Community discussions around {card['bank']} {card.get('primary_category')} cards.",
                "key_threads": matched_threads,
                "practical_community_warnings": clean_list_items(warnings)[:5],
            },
            "devaluation_analysis": deval_block,
            "alternate_options": alternates,
            "eligibility_detailed": {
                "occupation": pb_elig.get("occupation") or "Salaried or Self-Employed",
                "age_range": elig_age_range,
                "min_monthly_income_salaried_inr": min_sal,
                "govt_employee_income_note": pb_elig.get("minimum income for salaried govt. employees"),
                "min_annual_itr_self_employed_inr": elig_raw.get("min_annual_itr_self_employed_inr"),
                "min_cibil_score": min_cibil,
                "approval_notes": clean_text_item(str(elig_raw.get("notes") or "")) or None,
            },
            "latest_offers": card_offers,
        }

        # Write per-card JSON & Markdown
        json_path = bank_dir / f"{cslug}.json"
        md_path = bank_dir / f"{cslug}.md"
        json_path.write_text(json.dumps(dossier, indent=2, ensure_ascii=False), encoding="utf-8")
        md_path.write_text(render_card_markdown(dossier), encoding="utf-8")

        bank_groups[bslug].append(dossier)

        milestone_list = dossier["benefits_features_and_faqs"]["milestone_benefits"]
        capping_rules = calc.get("monthly_capping_rules") or []
        app_search_index.append({
            "card_id": cid,
            "card_name": card["card_name"],
            "bank": card["bank"],
            "bank_slug": bslug,
            "card_slug": cslug,
            "primary_category": card.get("primary_category"),
            "categories": card.get("categories") or [],
            "card_network": card.get("card_network"),
            "card_tier": card.get("card_tier"),
            "status": card.get("status"),
            "joining_fee_inr": int(fees_raw.get("joining_fee_inr") or 0),
            "joining_fee_waiver": fees_raw.get("joining_fee_waiver"),
            "annual_fee_inr": ann_fee,
            "fee_waiver_spend_inr": waiver_spend,
            "forex_markup_pct": forex_num,
            "overall_rating": overall_rating,
            "local_image_path": img.get("local_image_path"),
            "image_url": None if (img.get("image_url") and any(d in str(img.get("image_url")).lower() for d in ("paisabazaar", "bankbazaar", "cardinsider"))) else img.get("image_url"),
            "card_theme": card_themes.get(cid),
            "filter_tags": dossier["filter_tags"],
            "effective_return_pct_by_category": calc["effective_return_pct_by_category"],
            "monthly_category_caps_inr": calc.get("monthly_category_caps_inr") or {},
            "category_caveats": calc.get("category_caveats") or {},
            "domestic_lounge_summary": lng["domestic"].get("summary"),
            "international_lounge_summary": lng["international"].get("summary"),
            "lounge_spend_condition": lng["domestic"].get("spend_criteria"),
            "golf_summary": golf_summary,
            "capping_summary": capping_rules[0][:140] if capping_rules else None,
            "milestone_summary": milestone_list[0][:140] if milestone_list else None,
            "best_for_short": (best_for_ideal or best_for_verdict or "")[:120] or None,
            "json_path": f"data/cards_by_bank/{bslug}/{cslug}.json",
            "md_path": f"data/cards_by_bank/{bslug}/{cslug}.md",
        })

    # Write _bank_index.json per bank and master cards_by_bank_index.json
    master_banks_summary: list[dict[str, Any]] = []
    lounge_progs = lounge_catalog.get("programs", {})

    def _prog_matches_bank(prog_bank: str, target_bank: str) -> bool:
        pb = (prog_bank or "").strip().lower()
        tb = (target_bank or "").strip().lower()
        if not pb or pb in ("general", "all", "visa", "mastercard", "rupay"):
            return False
        if pb == tb or pb in tb or tb in pb:
            return True
        if "sbi" in pb and "sbi" in tb:
            return True
        if "bob" in pb and "bobcard" in tb:
            return True
        if "scapia" in pb and "scapia" in tb:
            return True
        if "standard chartered" in pb and "standard chartered" in tb:
            return True
        if "american express" in pb and "american express" in tb:
            return True
        if "au" == pb.split()[0] and "au small finance" in tb:
            return True
        return False

    for bslug, dossiers in sorted(bank_groups.items()):
        bank_name = dossiers[0]["identity"]["bank"]
        bank_progs = [
            {
                "program_id": pid,
                "title": p.get("title"),
                "url": p.get("official_url"),
                "parsed_lounges_count": p.get("parsed_lounges_count", 0),
            }
            for pid, p in lounge_progs.items()
            if _prog_matches_bank(p.get("bank") or "", bank_name)
        ]
        b_idx = {
            "bank": bank_name,
            "bank_slug": bslug,
            "generated_at": now_iso,
            "total_cards": len(dossiers),
            "ltf_count": sum(1 for d in dossiers if d["filter_tags"]["is_ltf"]),
            "rupay_upi_count": sum(1 for d in dossiers if d["filter_tags"]["is_rupay_upi"]),
            "domestic_lounge_count": sum(1 for d in dossiers if d["filter_tags"]["has_domestic_lounge"]),
            "international_lounge_count": sum(1 for d in dossiers if d["filter_tags"]["has_international_lounge"]),
            "railway_lounge_count": sum(1 for d in dossiers if d["filter_tags"]["has_railway_lounge"]),
            "golf_count": sum(1 for d in dossiers if d["filter_tags"]["has_golf"]),
            "zero_or_low_forex_count": sum(1 for d in dossiers if d["filter_tags"]["zero_or_low_forex"]),
            "with_image_count": sum(1 for d in dossiers if d["visual_assets"]["has_verified_image"]),
            "official_lounge_programs": bank_progs,
            "cards": [
                {
                    "card_id": d["identity"]["card_id"],
                    "card_name": d["identity"]["card_name"],
                    "card_slug": d["identity"]["card_slug"],
                    "primary_category": d["identity"]["primary_category"],
                    "card_network": d["identity"]["card_network"],
                    "annual_fee_inr": d["fees_and_charges_detailed"]["annual_fee_inr"],
                    "overall_rating": d["ratings"]["overall_market_rating"],
                    "has_domestic_lounge": d["filter_tags"]["has_domestic_lounge"],
                    "has_railway_lounge": d["filter_tags"]["has_railway_lounge"],
                    "local_image_path": d["visual_assets"]["local_image_path"],
                    "json_file": f"{d['identity']['card_slug']}.json",
                    "md_file": f"{d['identity']['card_slug']}.md",
                }
                for d in sorted(dossiers, key=lambda x: -(x["ratings"]["overall_market_rating"] or 0))
            ],
        }
        (OUT_DIR / bslug / "_bank_index.json").write_text(json.dumps(b_idx, indent=2, ensure_ascii=False), encoding="utf-8")
        master_banks_summary.append({k: v for k, v in b_idx.items() if k != "cards"})

    master_by_bank = {
        "schema_version": "2026.11-dossier-v2",
        "generated_at": now_iso,
        "total_banks": len(bank_groups),
        "total_cards": len(cards),
        "build_stats": stats,
        "banks": master_banks_summary,
    }
    (MASTER_DIR / "cards_by_bank_index.json").write_text(json.dumps(master_by_bank, indent=2, ensure_ascii=False), encoding="utf-8")
    (MASTER_DIR / "app_search_index.json").write_text(
        json.dumps({"schema_version": "2026.11-app-index", "generated_at": now_iso, "total_cards": len(app_search_index), "calculator_categories": CALC_CATEGORIES, "cards": app_search_index}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print(f"[Build DONE] {len(bank_groups)} bank folders, {len(cards)} JSON + {len(cards)} MD files created.", flush=True)
    print(f"[Stats] {json.dumps(stats, indent=2)}", flush=True)


if __name__ == "__main__":
    main()
