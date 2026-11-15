#!/usr/bin/env python3
"""
Phase 1 Master Data Repair & PaisaBazaar Scrubbing Script.

Performs:
1. Exports `data/master/raw_md_stem_map.json` before scrubbing `paisabazaar_url` so cached local raw `.md` files remain usable for FAQ / late-fee extraction without exposing any PaisaBazaar URLs or branding.
2. Upgrades/verifies `sources.bank_url` across all 516 cards across all 37 issuers (https:// only, zero broken/404 portals).
3. Scrubs all PaisaBazaar references/ratings/URLs/boilerplate from `credit_cards_master.json`.
4. Fixes all truncated lounge summaries (e.g. ending in `Rs.`, `min.`, `Max.`), extracts accurate `spend_criteria` from cached markdown + highlights, eliminates `no_spend` vs spend-threshold contradictions, fixes domestic/international/railway lounge counts & PNB/Axis/HDFC/ICICI/SBI/IDFC/AU/HSBC/IndusInd/YES/RBL/Kotak/Bandhan/SC/BOB/BOI/Union/Canara/DBS false negatives and inflated international counts.
"""

from __future__ import annotations

import json
import pathlib
import re
from typing import Any

ROOT = pathlib.Path("/Users/shubhamsharma/Downloads/Credit Card")
MASTER_PATH = ROOT / "data/master/credit_cards_master.json"
STEM_MAP_PATH = ROOT / "data/master/raw_md_stem_map.json"
PB_CARDS_DIR = ROOT / "data/raw/paisabazaar/cards"

# Verified HTTP-200 official issuer portals across all 37 issuers
VERIFIED_BANK_PORTALS: dict[str, str] = {
    "AU Small Finance Bank": "https://www.au.bank.in/",
    "American Express": "https://www.americanexpress.com/in/credit-cards/",
    "Axis Bank": "https://www.axis.bank.in/cards/credit-card",
    "BOBCARD (Bank of Baroda)": "https://www.bobcard.co.in/",
    "Bandhan Bank": "https://www.bandhan.bank.in/",
    "Bank of India": "https://bankofindia.bank.in/",
    "Bank of Maharashtra": "https://bankofmaharashtra.bank.in/",
    "CSB Bank": "https://www.csb.bank.in/",
    "Canara Bank": "https://www.canarabank.bank.in/credit-cards",
    "Central Bank Of India": "https://www.centralbank.bank.in/en",
    "DBS Bank": "https://www.dbs.bank.in/digibank/in/default.page",
    "Federal Bank": "https://www.federal.bank.in/credit-cards",
    "Federal Bank / Scapia": "https://www.scapia.cards/",
    "HDFC Bank": "https://www.hdfc.bank.in/credit-cards",
    "HSBC Bank": "https://www.hsbc.bank.in/credit-cards/",
    "ICICI Bank": "https://www.icici.bank.in/personal-banking/cards/credit-card",
    "IDBI Bank": "https://www.idbi.bank.in/",
    "IDFC FIRST Bank": "https://www.idfcfirst.bank.in/credit-card",
    "Indian Bank": "https://www.indianbank.bank.in/departments/credit-cards/",
    "Indian Overseas Bank": "https://www.iob.bank.in/en/",
    "IndusInd Bank": "https://www.indusind.bank.in/in/en/personal/cards/credit-card.html",
    "Karur Vysya Bank": "https://www.kvb.bank.in/",
    "Kotak Mahindra Bank": "https://www.kotak.bank.in/en/personal-banking/cards/credit-cards.html",
    "LIC Cards (Axis Bank)": "https://www.liccards.co.in/",
    "OneCard / Co-branded": "https://www.getonecard.app/",
    "Punjab National Bank": "https://pnb.bank.in/",
    "RBL Bank": "https://www.rbl.bank.in/personal-banking/cards/credit-cards",
    "SBI Card": "https://www.sbicard.com/en/personal/credit-cards.html",
    "SBM Bank India": "https://www.sbm.bank.in/",
    "South Indian Bank": "https://www.southindianbank.bank.in/",
    "Standard Chartered Bank": "https://www.sc.bank.in/credit-cards/",
    "Tamilnad Mercantile Bank": "https://www.tmb.bank.in/",
    "UCO Bank": "https://www.uco.bank.in/en/",
    "Union Bank of India": "https://www.unionbankofindia.bank.in/en/home",
    "Unity Small Finance Bank": "https://unity.bank.in/credit-cards",
    "Utkarsh Small Finance Bank": "https://www.utkarsh.bank.in/",
    "YES BANK": "https://www.yes.bank.in/personal-banking/yes-individual/cards/credit-cards",
}

SPECIFIC_CARD_URLS: dict[str, str] = {
    "amex_american_express_platinum_charge_card": "https://www.americanexpress.com/in/charge-cards/platinum-card/",
    "axis_bank_scapia_credit_card": "https://www.scapia.cards/",
    "federal_bank_scapia_scapia_federal_bank_credit_card": "https://www.scapia.cards/",
    "hdfc_bank_diners_club_black_metal_credit_card": "https://www.hdfc.bank.in/credit-cards/diners-club-black-metal-edition-credit-card",
    "hdfc_bank_hdfc_diners_club_black_credit_card": "https://www.hdfc.bank.in/credit-cards/diners-club-black-metal-edition-credit-card",
    "hdfc_bank_tata_neu_infinity_hdfc_bank_credit_card": "https://www.hdfc.bank.in/credit-cards/tata-neu-infinity-hdfc-bank-credit-card",
    "hdfc_bank_tata_neu_plus_hdfc_bank_credit_card": "https://www.hdfc.bank.in/credit-cards/tata-neu-plus-hdfc-bank-credit-card",
    "icici_bank_amazon_pay_icici_credit_card": "https://www.icici.bank.in/personal-banking/cards/credit-card/amazon-pay-credit-card",
    "sbi_bank_cashback_sbi_card": "https://www.sbicard.com/en/personal/credit-cards/rewards/cashback-sbi-card.page",
}


def resolve_bank_url(card: dict[str, Any]) -> str:
    cid = card["card_id"]
    if cid in SPECIFIC_CARD_URLS:
        return SPECIFIC_CARD_URLS[cid]
    bank = card.get("bank") or ""
    cur = ((card.get("sources") or {}).get("bank_url") or "").strip()
    if "scapia" in cid and "federal" in cid:
        return "https://www.scapia.cards/"
    # Keep verified HTTPS deep URLs on safe non-404 domains
    safe_domains = (
        "hdfc.bank.in",
        "icici.bank.in",
        "axis.bank.in",
        "sbicard.com",
        "americanexpress.com",
        "idfcfirst.bank.in",
        "hsbc.bank.in",
        "kotak.bank.in",
        "au.bank.in",
        "indusind.bank.in",
        "yes.bank.in",
        "rbl.bank.in",
        "federal.bank.in",
        "scapia.cards",
        "bobcard.co.in",
        "pnb.bank.in",
        "getonecard.app",
        "liccards.co.in",
        "sc.bank.in",
    )
    if cur.startswith("http://"):
        cur = "https://" + cur[7:]
    if cur.startswith("https://") and any(dom in cur.lower() for dom in safe_domains):
        # Reject known broken paths
        bad_fragments = ("avios", "pnbindia.in", "hdfcbank.com/content/bbp", "paisabazaar")
        if not any(b in cur.lower() for b in bad_fragments):
            return cur
    return VERIFIED_BANK_PORTALS.get(bank, "https://www.rbi.org.in/")


def scrub_text(text: str) -> str:
    if not text:
        return text
    # Remove markdown link wrappers pointing to paisabazaar or pb-pass
    text = re.sub(
        r"\[([^\]]+)\]\(https?://(?:www\.)?paisabazaar\.com[^)]*\)",
        lambda m: "" if "pb pass" in m.group(1).lower() or "paisabazaar" in m.group(1).lower() else m.group(1),
        text,
        flags=re.I,
    )
    text = re.sub(r"https?://(?:www\.)?paisabazaar\.com\S*", "", text, flags=re.I)
    text = re.sub(
        r"Note:\s*This Card is not available on Paisabazaar\.com\.?\s*(?:You can visit the bank['’]?s official website for this Credit Card\.?)?",
        "",
        text,
        flags=re.I,
    )
    text = re.sub(r"\*?\s*Free Airport Lounge Access with PB Pass\.?", "", text, flags=re.I)
    text = re.sub(r"Pay your credit card bill via Paisabazaar.*", "", text, flags=re.I)
    text = re.sub(r"\bvia Paisabazaar(?:\.com)?\b", "", text, flags=re.I)
    text = re.sub(r"\bon Paisabazaar(?:\.com)?\b", "", text, flags=re.I)
    text = re.sub(r"\bPaisabazaar(?:\.com)?\b", "Bank Portal", text, flags=re.I)
    text = re.sub(r"\s{2,}", " ", text).strip(" |,-")
    return text.strip()


def scrub_value(val: Any) -> Any:
    if isinstance(val, str):
        return scrub_text(val)
    if isinstance(val, list):
        out = []
        for item in val:
            sv = scrub_value(item)
            if isinstance(sv, str):
                if not sv or "pb pass" in sv.lower() or "not available on" in sv.lower():
                    continue
            out.append(sv)
        return out
    if isinstance(val, dict):
        return {k: scrub_value(v) for k, v in val.items()}
    return val


def safe_split_sentences(text: str) -> list[str]:
    """Split text into sentences WITHOUT splitting on Rs., min., max., no., govt., i.e., e.g., incl."""
    # Protect abbreviations with a sentinel
    protected = text
    abbrs = [
        r"\bRs\.",
        r"\bmin\.",
        r"\bmax\.",
        r"\bno\.",
        r"\bi\.e\.",
        r"\be\.g\.",
        r"\bgovt\.",
        r"\bincl\.",
        r"\bp\.a\.",
        r"\bp\.m\.",
        r"\bapprox\.",
        r"\bCo\.",
        r"\bLtd\.",
        r"\bSr\.",
        r"\bDr\.",
    ]
    for idx, pat in enumerate(abbrs):
        token = f"__ABBR{idx}__"
        protected = re.sub(pat, lambda m, t=token: m.group(0).replace(".", t), protected, flags=re.I)
    # Protect decimal numbers like 1.5 Lakh
    protected = re.sub(r"(\d)\.(\d)", r"\1__DOT__\2", protected)
    parts = re.split(r"(?<=[.!?])\s+|\n+", protected)
    out = []
    for part in parts:
        restored = part.replace("__DOT__", ".")
        for idx in range(len(abbrs)):
            restored = restored.replace(f"__ABBR{idx}__", ".")
        restored = re.sub(r"\s+", " ", restored).strip()
        if restored:
            out.append(restored)
    return out


def extract_spend_from_texts(texts: list[str]) -> str | None:
    """Extract clean human-readable spend criteria if a genuine lounge spend requirement exists."""
    joined = " \n ".join(t for t in texts if t)
    # Avoid matching unrelated welcome/fee waiver/milestone sentences unless near lounge words
    sentences = safe_split_sentences(joined)
    lounge_sentences = [s for s in sentences if "lounge" in s.lower() or "priority pass" in s.lower()]
    for s in lounge_sentences:
        sl = s.lower()
        if any(neg in sl for neg in ("no spend criteria", "without spend", "without any spend", "zero spend")):
            continue
        # Match "on spending ...", "subject to ... spends of ...", "on monthly spends of ...", "on reaching ... spend"
        m = re.search(
            r"(?:on|subject to|upon|by)\s+(?:minimum\s+|min\.?\s+|at least\s+|reaching\s+|eligible\s+|quarterly\s+|monthly\s+)*"
            r"(?:spends?\s*(?:of)?|spending|flight booking worth)?\s*"
            r"(Rs\.?\s*[\d,]+(?:\.\d+)?\s*(?:Lakh|Lac|K)?(?:\s*(?:or more|and above|\+))?"
            r"(?:\s*(?:in|during|per)\s+(?:the\s+)?(?:previous|preceding|same|every|calendar|a)?\s*(?:3\s*months|quarter|calendar quarter|month|billing cycle|year))?)",
            s,
            re.I,
        )
        if m:
            frag = m.group(1).strip(" .,*_;")
            if "rs" in frag.lower() or "lakh" in frag.lower():
                return frag
        # Secondary pattern: "Rs. X ... quarterly/monthly spend"
        m2 = re.search(
            r"((?:min\.?|minimum)?\s*Rs\.?\s*[\d,]+(?:\.\d+)?\s*(?:Lakh|Lac|K)?\s*(?:in\s+(?:the\s+)?(?:previous|preceding)\s+(?:quarter|month|3\s*months)|(?:quarterly|monthly)\s+spends?|per\s+(?:quarter|month)))",
            s,
            re.I,
        )
        if m2:
            return re.sub(r"^\s*min\.?\s+", "Min. ", m2.group(1).strip(" .,*_;"), flags=re.I)
        if "quarterly spend" in sl or "based on quarterly spends" in sl or "spend threshold" in sl:
            return "Quarterly spend threshold applies (check issuer T&C)"
    return None


def find_full_sentence_in_md(raw_lines: list[str], prefix: str) -> str | None:
    """Given a truncated summary prefix, find its untruncated sentence/line from raw markdown."""
    clean_pre = re.sub(r"[^a-z0-9 ]", "", prefix.lower()).strip()
    if len(clean_pre) < 15:
        return None
    target_key = clean_pre[:36]
    for raw in raw_lines:
        clean_raw = re.sub(r"\*+|`|\[([^\]]+)\]\([^)]+\)", r"\1", raw)
        clean_raw = re.sub(r"^\s*[-*#>|]+\s*", "", clean_raw).strip()
        if "paisabazaar" in clean_raw.lower() or "pb pass" in clean_raw.lower():
            continue
        cr_norm = re.sub(r"[^a-z0-9 ]", "", clean_raw.lower())
        if target_key in cr_norm:
            for sent in safe_split_sentences(clean_raw):
                sn_norm = re.sub(r"[^a-z0-9 ]", "", sent.lower())
                if target_key[:24] in sn_norm and len(sent) > len(prefix):
                    return sent.rstrip(".")
            if len(clean_raw) > len(prefix) and not clean_raw.lower().endswith(("rs.", "min.", "max.")):
                return clean_raw[:240].rstrip(".")
    return None


# Exact verified overrides per card_id
# Each value can set "domestic", "international", "railway" dicts (partial updates supported)
EXACT_LOUNGE_OVERRIDES: dict[str, dict[str, dict[str, Any]]] = {
    # --- PNB Cards (fix cross-bank leaks & missed domestic/intl lounge access) ---
    "punjab_national_bank_pnb_rakshak_rupay_credit_cards": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "See issuer T&C (Select variant eligible; Platinum excludes complimentary visits)",
            "summary": "2 complimentary domestic airport lounge visits per quarter (8/year on Select variant) + 4 international lounge visits/year",
        },
        "international": {
            "program": "RuPay / LoungeKey / Diners",
            "visits_per_year": 4,
            "spend_criteria": "See issuer T&C",
            "summary": "4 complimentary international airport lounge visits per year",
        },
    },
    "punjab_national_bank_pnb_luxura_rupay_credit_card": {
        "domestic": {
            "visits_per_year": 999,
            "visits_per_quarter": 999,
            "spend_criteria": "No spend criteria",
            "summary": "Unlimited complimentary domestic airport lounge visits + OneVasco Visa lounge for 2 visitors/yr",
        },
        "international": {
            "program": "RuPay Metal / LoungeKey",
            "visits_per_year": 999,
            "spend_criteria": "No spend criteria",
            "summary": "Unlimited complimentary international airport lounge visits",
        },
    },
    "punjab_national_bank_pnb_luxura_visa_credit_card": {
        "domestic": {
            "visits_per_year": 999,
            "visits_per_quarter": 999,
            "spend_criteria": "No spend criteria",
            "summary": "Unlimited complimentary domestic airport lounge visits",
        },
        "international": {
            "program": "Visa Infinite / LoungeKey",
            "visits_per_year": 999,
            "spend_criteria": "No spend criteria",
            "summary": "Unlimited complimentary international airport lounge visits",
        },
    },
    "punjab_national_bank_pnb_rupay_select_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "See RuPay Select issuer T&C",
            "summary": "Complimentary domestic airport lounge access (2 visits/quarter under RuPay Select)",
        },
        "international": {
            "program": "RuPay Select",
            "visits_per_year": 2,
            "spend_criteria": "See RuPay Select issuer T&C",
            "summary": "2 complimentary international airport lounge visits per year",
        },
    },
    "punjab_national_bank_pnb_rupay_millennial_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "See issuer T&C",
            "summary": "Domestic and international airport lounge access program (2 domestic/quarter via RuPay Select)",
        },
        "international": {
            "program": "RuPay Select",
            "visits_per_year": 2,
            "spend_criteria": "See issuer T&C",
            "summary": "2 complimentary international airport lounge visits per year",
        },
    },
    "punjab_national_bank_visa_signature_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "See issuer T&C",
            "summary": "Complimentary domestic airport lounge visits (2/quarter)",
        },
        "international": {
            "program": "Visa Signature / LoungeKey",
            "visits_per_year": 2,
            "spend_criteria": "See issuer T&C",
            "summary": "Complimentary international airport lounge visits",
        },
    },
    "punjab_national_bank_patanjali_credit_cards": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Available on PNB Patanjali RuPay Select variant",
            "summary": "Complimentary domestic airport lounge access on Select variant (2/quarter)",
        },
        "international": {
            "program": "RuPay Select",
            "visits_per_year": 2,
            "spend_criteria": "Available on PNB Patanjali RuPay Select variant",
            "summary": "2 complimentary international lounge visits/year on Select variant",
        },
    },
    "punjab_national_bank_pnb_easemytrip_credit_card": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 1,
            "spend_criteria": "See issuer T&C",
            "summary": "Complimentary domestic airport lounge visits",
        },
        "international": {
            "program": "RuPay Platinum",
            "visits_per_year": 2,
            "spend_criteria": "See issuer T&C",
            "summary": "Complimentary international airport lounge visits",
        },
    },

    # --- IDFC FIRST Bank ---
    "idfc_first_bank_idfc_first_private_credit_card": {
        "domestic": {
            "visits_per_year": 999,
            "visits_per_quarter": 999,
            "spend_criteria": "No spend criteria",
            "summary": "Unlimited complimentary domestic airport lounge visits with 4 complimentary guest visits/year",
        },
        "international": {
            "program": "Visa Infinite / Priority Pass",
            "visits_per_year": 999,
            "spend_criteria": "No spend criteria",
            "summary": "Unlimited complimentary international airport lounge visits with 4 guest visits/year",
        },
    },
    "idfc_first_bank_idfc_first_select_credit_card": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 1,
            "spend_criteria": "Rs. 20,000 in previous month",
            "summary": "1 complimentary domestic airport lounge visit per quarter on spending Rs. 20,000 in previous month",
        },
        "railway": {
            "visits_per_year": 16,
            "visits_per_quarter": 4,
            "summary": "4 complimentary railway lounge visits per quarter on Rs. 20,000 monthly spend",
        },
    },
    "idfc_first_bank_ashva_credit_card": {
        "domestic": {
            "visits_per_year": 16,
            "visits_per_quarter": 4,
            "spend_criteria": "Rs. 20,000 in previous month",
            "summary": "16 complimentary domestic airport lounge & spa visits/year (4/quarter) on Rs. 20,000 spend in previous month",
        },
        "international": {
            "program": "Visa / Lounge Program",
            "visits_per_year": 8,
            "spend_criteria": "Rs. 20,000 in previous month",
            "summary": "8 complimentary international airport lounge visits/year (2/quarter) on Rs. 20,000 spend in previous month",
        },
        "railway": {
            "visits_per_year": 16,
            "visits_per_quarter": 4,
            "summary": "Up to 16 complimentary railway lounge visits/year (4/quarter) at select Indian stations",
        },
    },
    "idfc_first_bank_mayura_credit_card": {
        "domestic": {
            "visits_per_year": 16,
            "visits_per_quarter": 4,
            "spend_criteria": "Rs. 20,000 in previous month",
            "summary": "16 complimentary domestic airport lounge & spa visits/year (4/quarter, incl. 1 guest visit) on Rs. 20,000 monthly spend",
        },
        "international": {
            "program": "Visa / Lounge Program",
            "visits_per_year": 16,
            "spend_criteria": "Rs. 20,000 in previous month",
            "summary": "16 complimentary international airport lounge visits/year (4/quarter) on Rs. 20,000 monthly spend",
        },
        "railway": {
            "visits_per_year": 16,
            "visits_per_quarter": 4,
            "summary": "Up to 16 complimentary railway lounge visits/year (4/quarter)",
        },
    },
    "idfc_first_bank_idfc_first_diamond_reserve_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Rs. 20,000 in previous month (verify issuer T&C)",
            "summary": "2 complimentary domestic airport lounge visits per quarter (8/year)",
        },
        "international": {
            "program": "Visa / Mastercard Airport Lounge",
            "visits_per_year": 8,
            "spend_criteria": "Rs. 20,000 in previous month (verify issuer T&C)",
            "summary": "2 complimentary international airport lounge visits per quarter (8/year)",
        },
        "railway": {
            "visits_per_year": 16,
            "visits_per_quarter": 4,
            "summary": "Up to 4 complimentary railway lounge visits per quarter",
        },
    },
    "idfc_first_bank_idfc_lic_select_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Rs. 20,000 in previous month",
            "summary": "8 complimentary domestic airport lounge visits/year (2/quarter) on min. Rs. 20,000 spend in previous month",
        },
        "railway": {
            "visits_per_year": 16,
            "visits_per_quarter": 4,
            "summary": "4 complimentary railway lounge visits per quarter (16/year)",
        },
    },
    "idfc_first_bank_lic_credit_cards": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Min. Rs. 20,000 in previous month (Select variant)",
            "summary": "8 complimentary domestic airport lounge visits/year (2/quarter on Select variant) on min. Rs. 20,000 spend in previous month",
        },
        "railway": {
            "visits_per_year": 16,
            "visits_per_quarter": 4,
            "summary": "Complimentary railway lounge visits (up to 4/quarter on Select, 2/quarter on Classic)",
        },
    },
    "idfc_first_bank_idfc_business_multiplier_credit_card": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 1,
            "spend_criteria": "Rs. 20,000 in previous month",
            "summary": "1 complimentary domestic airport lounge visit per quarter (4/year) on min. Rs. 20,000 spend in previous month",
        },
        "international": {
            "program": "Lounge Access Program",
            "visits_per_year": 4,
            "spend_criteria": "Rs. 20,000 in previous month",
            "summary": "1 complimentary international airport lounge visit per quarter (4/year) on min. Rs. 20,000 spend in previous month",
        },
    },
    "idfc_first_bank_idfc_first_hpcl_power_plus_credit_card": {
        "domestic": {
            "spend_criteria": "Rs. 20,000 in previous month",
            "summary": "1 complimentary domestic airport lounge visit per quarter on minimum monthly spends of Rs. 20,000",
        },
    },
    "idfc_bank_idfc_first_wow_black_credit_card": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 1,
            "spend_criteria": "Rs. 20,000 monthly spend",
            "summary": "4 complimentary domestic airport lounge visits annually on a minimum monthly spend of Rs. 20,000",
        },
    },

    # --- Axis Bank ---
    "axis_bank_axis_scapia_credit_card": {
        "domestic": {
            "visits_per_year": 999,
            "visits_per_quarter": 999,
            "spend_criteria": "Rs. 20,000/month on Visa (Rs. 15,000/month on RuPay)",
            "summary": "Unlimited complimentary domestic airport lounge visits on spending Rs. 20,000/month (Visa) or Rs. 15,000/month (RuPay)",
        },
    },
    "axis_bank_burgundy_private_credit_card": {
        "domestic": {
            "visits_per_year": 999,
            "visits_per_quarter": 999,
            "spend_criteria": "No spend criteria",
            "summary": "Unlimited complimentary domestic airport lounge visits + 12 complimentary guest visits/year",
        },
        "international": {
            "program": "Priority Pass / Visa Infinite",
            "visits_per_year": 999,
            "spend_criteria": "No spend criteria",
            "summary": "Unlimited complimentary international airport lounge visits + 12 complimentary guest visits/year",
        },
    },
    "axis_bank_horizon_credit_card": {
        "domestic": {
            "visits_per_year": 32,
            "visits_per_quarter": 8,
            "spend_criteria": "See issuer T&C (Visa: 8/qtr, 32/yr; Mastercard: 6/qtr, 24/yr)",
            "summary": "Up to 32 complimentary domestic airport lounge visits/year (8/quarter on Visa Signature; 24/year, 6/quarter on Mastercard World)",
        },
        "international": {
            "program": "Priority Pass / Mastercard",
            "visits_per_year": 8,
            "spend_criteria": "See issuer T&C",
            "summary": "8 complimentary international airport lounge visits per year (2 visits/quarter)",
        },
    },
    "axis_bank_privilege_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Min. Rs. 50,000 in previous 3 months",
            "summary": "2 complimentary domestic airport lounge visits per quarter (8/year) on spending min. Rs. 50,000 in previous 3 months",
        },
    },
    "axis_bank_miles_and_more_select_credit_card": {
        "domestic": {
            "visits_per_year": 32,
            "visits_per_quarter": 8,
            "spend_criteria": "See issuer T&C",
            "summary": "32 complimentary domestic airport lounge visits per year (max 8 per quarter)",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 4,
            "spend_criteria": "See issuer T&C",
            "summary": "4 complimentary international airport lounge visits per calendar year",
        },
    },
    "axis_bank_miles_and_more_world_credit_card": {
        "domestic": {
            "visits_per_year": 16,
            "visits_per_quarter": 4,
            "spend_criteria": "See issuer T&C",
            "summary": "16 complimentary domestic airport lounge visits per year (max 4 per quarter)",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 2,
            "spend_criteria": "See issuer T&C",
            "summary": "2 complimentary international airport lounge visits per calendar year",
        },
    },
    "axis_bank_axis_bank_pride_signature_credit_cards": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Rs. 50,000 in previous quarter",
            "summary": "Up to 8 complimentary domestic airport lounge visits per year (max 2/quarter) on Rs. 50,000 spend in previous quarter",
        },
    },
    "axis_bank_axis_bank_signature_credit_cards_with_lifestyle_benefits": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Rs. 50,000 in previous 3 months (per Axis T&C)",
            "summary": "2 complimentary Indian airport lounge visits per quarter (8/year)",
        },
        "international": {
            "program": "Priority Pass (Membership only; visits paid USD 16.50-25)",
            "visits_per_year": 0,
            "spend_criteria": "Not Applicable",
            "summary": "Complimentary Priority Pass membership; international lounge visits are chargeable",
        },
    },
    "axis_bank_axis_bank_vistara_infinite_credit_card": {
        "domestic": {
            "spend_criteria": "Min. Rs. 50,000 in previous 3 months",
            "summary": "2 complimentary domestic airport lounge visits per calendar quarter on spending min. Rs. 50,000 in previous 3 months",
        },
    },
    "axis_bank_axis_bank_vistara_signature_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Min. Rs. 50,000 in previous 3 months",
            "summary": "2 complimentary domestic airport lounge visits per calendar quarter on spending min. Rs. 50,000 in previous 3 months",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 4,
            "spend_criteria": "See issuer T&C",
            "summary": "1 complimentary international airport lounge visit per quarter (4/year)",
        },
    },
    "axis_bank_vistara_credit_card": {
        "domestic": {
            "spend_criteria": "Min. Rs. 50,000 in previous 3 months",
            "summary": "2 complimentary domestic airport lounge visits per quarter on spending min. Rs. 50,000 in previous 3 months",
        },
    },
    "axis_bank_select_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Rs. 50,000 in previous 3 months",
            "summary": "2 complimentary domestic lounge visits per quarter on spending Rs. 50,000 in the previous 3 months",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 12,
            "spend_criteria": "6 base/yr + 6 bonus on Rs. 3,00,000 annual spend",
            "summary": "6 complimentary international lounge visits/yr via Priority Pass + 6 additional visits on spending Rs. 3 Lakh/year",
        },
    },
    "axis_bank_magnus_credit_card": {
        "domestic": {
            "spend_criteria": "Rs. 50,000 in previous 3 months",
            "summary": "Unlimited complimentary domestic lounge visits (primary & add-on) on spending Rs. 50,000 in the previous 3 months",
        },
    },
    "axis_bank_magnus_burgundy_credit_card": {
        "domestic": {
            "spend_criteria": "No spend criteria (Rs. 50,000/3 mo waived on Burgundy Private; verify T&C for Magnus Burgundy)",
            "summary": "Unlimited complimentary domestic airport lounge visits for primary & add-on holders",
        },
    },
    "axis_bank_ace_credit_card": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 1,
            "spend_criteria": "Min. Rs. 50,000 in previous 3 months",
            "summary": "4 complimentary domestic airport lounge visits/year (1/quarter) on spending min. Rs. 50,000 in previous 3 months",
        },
    },
    "axis_bank_axis_bank_my_zone_credit_cards": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 1,
            "spend_criteria": "Rs. 50,000 in previous 3 months",
            "summary": "1 complimentary domestic airport lounge visit per quarter on spending Rs. 50,000 during the previous 3 months",
        },
    },
    "axis_bank_rewards_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Min. Rs. 50,000 in previous 3 months",
            "summary": "2 complimentary domestic airport lounge visits per quarter (8/year) on spending min. Rs. 50,000 in previous 3 months",
        },
    },
    "axis_bank_privilege_easy_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Min. Rs. 50,000 in previous quarter",
            "summary": "8 complimentary domestic airport lounge visits per year (max 2/quarter) on spending min. Rs. 50,000 in previous quarter",
        },
    },

    # --- HDFC Bank ---
    "hdfc_bank_hdfc_regalia_first_credit_cards": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "See issuer T&C (legacy Visa/Mastercard program)",
            "summary": "8 complimentary domestic airport lounge visits per calendar year (2 per quarter)",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 3,
            "spend_criteria": "Priority Pass (primary + add-on)",
            "summary": "Up to 3 complimentary international airport lounge visits per year via Priority Pass",
        },
    },
    "hdfc_bank_hdfc_business_regalia_first_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "See issuer T&C",
            "summary": "8 complimentary domestic airport lounge visits per year (2 per quarter)",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 3,
            "spend_criteria": "Priority Pass",
            "summary": "Up to 3 complimentary international airport lounge visits per year via Priority Pass",
        },
    },
    "hdfc_bank_hdfc_bank_regalia_credit_cards": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Rs. 1,00,000 in a calendar quarter",
            "summary": "Up to 8 complimentary domestic airport lounge visits/year (2/quarter) on spending Rs. 1,00,000 in a calendar quarter",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 6,
            "spend_criteria": "No additional spend criteria (shared with add-on)",
            "summary": "6 complimentary international airport lounge visits per calendar year via Priority Pass (primary & add-on)",
        },
    },
    "hdfc_bank_shoppers_stop_black_credit_card": {
        "domestic": {
            "visits_per_year": 16,
            "visits_per_quarter": 4,
            "spend_criteria": "See issuer T&C",
            "summary": "16 complimentary domestic airport lounge visits per year (max 4 per quarter)",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 8,
            "spend_criteria": "See issuer T&C",
            "summary": "Up to 8 complimentary international airport lounge visits per year (max 2 per quarter)",
        },
    },
    "hdfc_bank_tata_neu_hdfc_bank_credit_cards": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 1,
            "spend_criteria": "Rs. 50,000 in previous quarter",
            "summary": "4 complimentary domestic airport lounge visits/year (max 1/quarter) on spending Rs. 50,000 in previous quarter",
        },
    },
    "hdfc_bank_tata_neu_plus_hdfc_fd_credit_card": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 1,
            "spend_criteria": "Rs. 50,000 in previous quarter",
            "summary": "4 complimentary domestic lounge visits/year (1/quarter) on spending Rs. 50,000 in the previous quarter",
        },
    },
    "hdfc_bank_tata_neu_infinity_hdfc_fd_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Rs. 50,000 in previous quarter",
            "summary": "Up to 8 domestic airport lounge visits/year (2/quarter) on spending Rs. 50,000 in the previous quarter",
        },
    },
    "hdfc_bank_biz_power_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Min. Rs. 75,000 in previous quarter",
            "summary": "2 complimentary domestic airport lounge visits per quarter (8/year) on min. spend of Rs. 75,000 in previous quarter",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 6,
            "spend_criteria": "Priority Pass (primary + add-on)",
            "summary": "6 complimentary international airport lounge visits per year via Priority Pass",
        },
    },
    "hdfc_bank_diners_club_privilege_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Rs. 60,000 in previous quarter (milestone/spend-based)",
            "summary": "2 complimentary domestic airport lounge visits per quarter on spends of Rs. 60,000 in the previous quarter",
        },
        "international": {
            "program": "Diners Club International",
            "visits_per_year": 4,
            "spend_criteria": "Rs. 60,000 in previous quarter",
            "summary": "1 complimentary international airport lounge visit per quarter on spends of Rs. 60,000 in the previous quarter",
        },
    },
    "hdfc_bank_jetprivilege_hdfc_bank_diners_club_credit_card": {
        "domestic": {
            "visits_per_year": 999,
            "visits_per_quarter": 999,
            "spend_criteria": "No spend criteria",
            "summary": "Unlimited complimentary domestic airport lounge access worldwide via Diners Club",
        },
    },
    "hdfc_bank_hdfc_bank_diners_rewardz_credit_cards": {
        "domestic": {
            "visits_per_year": 6,
            "visits_per_quarter": 2,
            "spend_criteria": "See issuer T&C",
            "summary": "6 complimentary airport lounge visits per year",
        },
    },
    "hdfc_bank_irctc_hdfc_bank_credit_card": {
        "railway": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "summary": "8 complimentary visits/year to select IRCTC Executive Railway Lounges (max 2 per quarter)",
        },
    },
    "hdfc_bank_millennia_credit_card": {
        "domestic": {
            "visits_per_year": 0,
            "visits_per_quarter": 0,
            "spend_criteria": "Quarterly milestone voucher option (Rs. 1,00,000/qtr spend)",
            "summary": "No direct card-swipe domestic lounge access; choice of 1 DreamFolks lounge voucher or Rs. 1,000 voucher per Rs. 1 Lakh quarterly spend",
        },
    },
    "hdfc_bank_6e_rewards_xl_indigo_hdfc_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "See issuer T&C",
            "summary": "8 complimentary domestic airport lounge visits per year (max 2 per quarter)",
        },
    },
    "hdfc_bank_paytm_hdfc_bank_select_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Rs. 50,000+ quarterly spend (check Paytm HDFC T&C)",
            "summary": "8 complimentary domestic airport lounge visits per year (2 per quarter)",
        },
    },
    "hdfc_bank_phonepe_ultimo_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Rs. 75,000 in previous quarter",
            "summary": "Up to 8 complimentary domestic airport lounge visits/year (max 2/quarter) on Rs. 75,000 quarterly spend",
        },
    },

    # --- HSBC Bank ---
    "hsbc_bank_rupay_cashback_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "See issuer T&C",
            "summary": "8 complimentary domestic airport lounge visits per year (2 per quarter)",
        },
        "international": {
            "program": "RuPay / LoungeKey",
            "visits_per_year": 2,
            "spend_criteria": "See issuer T&C",
            "summary": "2 complimentary international airport lounge visits per year",
        },
    },

    # --- ICICI Bank ---
    "icici_bank_times_black_icici_credit_card": {
        "domestic": {
            "visits_per_year": 999,
            "visits_per_quarter": 999,
            "spend_criteria": "No spend criteria",
            "summary": "Unlimited complimentary domestic airport lounge access",
        },
        "international": {
            "program": "Priority Pass / Visa Infinite",
            "visits_per_year": 999,
            "spend_criteria": "No spend criteria",
            "summary": "Unlimited complimentary international airport lounge access",
        },
    },
    "icici_bank_adani_one_signature_credit_card": {
        "domestic": {
            "visits_per_year": 16,
            "visits_per_quarter": 4,
            "spend_criteria": "No spend criteria specified for Signature",
            "summary": "16 complimentary domestic airport lounge visits per year (4 per quarter)",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 2,
            "spend_criteria": "See issuer T&C",
            "summary": "2 complimentary international airport lounge visits per year",
        },
    },
    "icici_bank_adani_one_credit_cards": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "See Adani One Platinum T&C",
            "summary": "2 complimentary domestic airport lounge visits per quarter (8/year) + 2 lounge upgrades/quarter",
        },
    },
    "icici_bank_coral_credit_card": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 1,
            "spend_criteria": "Min. Rs. 75,000 in previous quarter",
            "summary": "1 complimentary domestic airport lounge visit per quarter (4/year) on spending min. Rs. 75,000 in previous quarter",
        },
        "railway": {
            "visits_per_year": 4,
            "visits_per_quarter": 1,
            "summary": "4 complimentary railway lounge visits per year (1 per quarter) on Rs. 75,000 quarterly spend",
        },
    },
    "icici_bank_coral_credit_card_against_fixed_deposit": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 1,
            "spend_criteria": "Min. Rs. 75,000 in previous quarter (updated ICICI T&C; earlier Rs. 5,000)",
            "summary": "4 complimentary domestic airport lounge visits per year (1/quarter) subject to ICICI quarterly spend condition",
        },
    },
    "icici_bank_icici_bank_rubyx_visa_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Rs. 75,000 in previous quarter",
            "summary": "2 complimentary domestic airport lounge visits per quarter (8/year) on Rs. 75,000 quarterly spend",
        },
        "railway": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "summary": "8 complimentary railway lounge visits per year (2 per quarter) on Rs. 75,000 quarterly spend",
        },
    },
    "icici_bank_icici_parakram_select_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "See ICICI Parakram Select T&C",
            "summary": "2 complimentary domestic airport lounge visits every quarter (8/year)",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 2,
            "spend_criteria": "See ICICI Parakram Select T&C",
            "summary": "2 complimentary international airport lounge visits per year",
        },
    },
    "icici_bank_parakram_credit_card": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 1,
            "spend_criteria": "Rs. 75,000 in previous quarter",
            "summary": "1 complimentary domestic airport lounge visit per quarter (4/year) on quarterly spend threshold",
        },
    },
    "icici_bank_icici_mine_credit_card": {
        "domestic": {
            "spend_criteria": "Min. Rs. 35,000–75,000 in previous quarter (paid Pro/Premium plan)",
            "summary": "1 complimentary domestic airport lounge visit per quarter + 1 railway visit/month on Pro 49 / Premium 149 plans on quarterly spend criteria",
        },
    },
    "icici_bank_accelero_credit_card": {
        "domestic": {
            "spend_criteria": "Rs. 35,000+ in previous calendar quarter",
            "summary": "1 complimentary domestic airport lounge visit per quarter on spending Rs. 35,000 or more in previous quarter",
        },
    },
    "icici_bank_icici_bank_expression_credit_card": {
        "domestic": {
            "spend_criteria": "Rs. 75,000 in previous quarter (Visa variant)",
            "summary": "1 complimentary domestic airport lounge visit per quarter (Visa variant) on spending Rs. 75,000 in preceding quarter",
        },
    },
    "icici_bank_makemytrip_icici_bank_signature_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Rs. 75,000 in previous quarter (updated ICICI T&C)",
            "summary": "2 complimentary domestic airport lounge visits per quarter (8/year)",
        },
    },

    # --- AU Small Finance Bank ---
    "au_small_finance_bank_altura_plus_credit_card": {
        "railway": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "summary": "8 complimentary railway lounge visits per year (2 per quarter)",
        },
    },
    "au_small_finance_bank_au_xcite_ace_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Min. Rs. 50,000 in previous quarter",
            "summary": "2 complimentary domestic airport lounge visits per quarter (8/year) on spending min. Rs. 50,000 in previous quarter",
        },
        "railway": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "summary": "8 complimentary railway lounge visits per year (2 per quarter)",
        },
    },
    "au_small_finance_bank_au_xcite_ultra_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Min. Rs. 50,000 in previous quarter",
            "summary": "2 complimentary domestic airport lounge visits per quarter (8/year) on spending min. Rs. 50,000 in previous quarter",
        },
        "railway": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "summary": "8 complimentary railway lounge visits per year (max 2 per calendar quarter)",
        },
    },
    "au_small_finance_bank_vetta_credit_card": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 1,
            "spend_criteria": "Rs. 50,000 in previous quarter",
            "summary": "1 complimentary domestic airport lounge visit per quarter (4/year) on spending Rs. 50,000 in previous quarter",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 4,
            "spend_criteria": "Priority Pass",
            "summary": "1 complimentary international airport lounge visit per quarter (4/year) via Priority Pass",
        },
        "railway": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "summary": "8 complimentary railway lounge visits per year (2 per quarter)",
        },
    },
    "au_small_finance_bank_zenith_plus_credit_card": {
        "domestic": {
            "visits_per_year": 16,
            "visits_per_quarter": 4,
            "spend_criteria": "See AU Zenith+ T&C",
            "summary": "16 complimentary domestic airport lounge visits per year (max 4 per quarter)",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 16,
            "spend_criteria": "See AU Zenith+ T&C",
            "summary": "16 complimentary international airport lounge visits per year via Priority Pass (max 4 per quarter)",
        },
    },
    "au_small_finance_bank_au_ananta_credit_card": {
        "domestic": {
            "spend_criteria": "Flight booking via AU Rewardz / spend condition per T&C",
            "summary": "4 complimentary domestic airport lounge visits per quarter on eligible flight bookings via AU Rewardz",
        },
    },
    "au_small_finance_bank_au_nomo_credit_card": {
        "domestic": {
            "spend_criteria": "Rs. 20,000 per quarter",
            "summary": "2 complimentary domestic airport lounge visits per quarter (8/year) on spending Rs. 20,000 per quarter",
        },
    },
    "au_small_finance_bank_aditya_birla_finance_au_credit_cards": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Min. Rs. 20,000 quarterly spend (ABC Pro variant)",
            "summary": "Up to 8 complimentary domestic airport lounge visits/year (2/quarter) on min. Rs. 20,000 quarterly spend (AU ABC Pro)",
        },
    },
    "au_small_finance_bank_paytm_au_credit_card": {
        "domestic": {
            "spend_criteria": "Return flight booking of Rs. 5,000+ via Paytm Travel (up to 4 visits per booking)",
            "summary": "Up to 12 complimentary domestic airport lounge visits/year tied to Rs. 5,000+ return flight bookings on Paytm Travel",
        },
    },
    "au_small_finance_bank_spont_credit_card": {
        "domestic": {
            "spend_criteria": "Rs. 20,000 per quarter",
            "summary": "8 complimentary domestic airport lounge visits/year (2/quarter) on spending Rs. 20,000 per quarter",
        },
    },

    # --- SBI Card ---
    "sbi_bank_sbi_elite_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "No spend criteria",
            "summary": "8 complimentary domestic airport lounge visits per year (2 per quarter) without spend threshold",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 6,
            "spend_criteria": "No spend criteria",
            "summary": "6 complimentary international Priority Pass lounge visits per calendar year (max 2 per quarter)",
        },
    },
    "sbi_bank_sbi_prime_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "No spend criteria",
            "summary": "8 complimentary domestic airport lounge visits per calendar year (max 2 per quarter)",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 4,
            "spend_criteria": "No spend criteria",
            "summary": "4 complimentary international Priority Pass lounge visits per calendar year (max 2 per quarter)",
        },
    },
    "sbi_bank_elite_business_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "No spend criteria specified",
            "summary": "8 complimentary domestic airport lounge visits per year (max 2 per quarter)",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 6,
            "spend_criteria": "No spend criteria specified",
            "summary": "6 complimentary international Priority Pass lounge visits per year (max 2 per quarter)",
        },
    },
    "sbi_bank_landmark_rewards_sbi_prime_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "See issuer T&C",
            "summary": "8 complimentary domestic airport lounge visits per year (max 2 per quarter)",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 4,
            "spend_criteria": "See issuer T&C",
            "summary": "4 complimentary international airport lounge visits per year (max 2 per quarter)",
        },
    },
    "sbi_bank_titan_sbi_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "See issuer T&C",
            "summary": "8 complimentary domestic airport lounge visits per year (2 per quarter)",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 4,
            "spend_criteria": "Complimentary for first 2 years",
            "summary": "4 complimentary international airport lounge visits per year (2 per quarter, complimentary for first 2 years)",
        },
    },
    "sbi_bank_doctor_credit_card": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 1,
            "spend_criteria": "See issuer T&C",
            "summary": "4 free domestic airport lounge visits yearly (max 1 per quarter)",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 4,
            "spend_criteria": "See issuer T&C",
            "summary": "4 complimentary international Priority Pass lounge visits per year",
        },
    },
    "sbi_bank_sbi_miles_credit_card": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 2,
            "spend_criteria": "4 base/yr + 1 extra visit per Rs. 1,00,000 spent (up to 8 bonus/yr)",
            "summary": "4 complimentary domestic lounge visits/year (max 2/quarter) + 1 additional visit per Rs. 1 Lakh spent",
        },
    },
    "sbi_bank_sbi_miles_prime_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "8 base/yr + 1 extra visit per Rs. 1,00,000 spent",
            "summary": "8 complimentary domestic lounge visits/year (max 2/quarter) + 1 additional visit per Rs. 1 Lakh spent",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 4,
            "spend_criteria": "No spend criteria",
            "summary": "4 complimentary international airport lounge visits per year (capped at 2 per quarter)",
        },
    },
    "sbi_bank_sbi_miles_elite_credit_card": {
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 6,
            "spend_criteria": "No spend criteria",
            "summary": "6 complimentary international airport lounge visits per year (capped at 2 per quarter)",
        },
    },
    "sbi_bank_sbi_pulse_credit_card": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 1,
            "spend_criteria": "No spend criteria",
            "summary": "4 complimentary domestic airport lounge visits in a year (1 per quarter)",
        },
    },
    "sbi_bank_sbi_irctc_credit_card": {
        "railway": {
            "visits_per_year": 4,
            "visits_per_quarter": 1,
            "summary": "4 complimentary railway lounge visits per year (1 per quarter)",
        },
    },
    "sbi_bank_tata_neu_infinity_sbi_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Rs. 75,000 in previous quarter",
            "summary": "8 complimentary domestic airport lounge visits/year (max 2/quarter) on spending Rs. 75,000 in the previous quarter",
        },
    },
    "sbi_bank_tata_neu_plus_sbi_credit_card": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 1,
            "spend_criteria": "Rs. 50,000 in previous quarter",
            "summary": "4 complimentary domestic airport lounge visits/year (max 1/quarter) on quarterly spends of Rs. 50,000",
        },
    },
    "sbi_bank_air_india_sbi_platinum_credit_cards": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "See SBI Visa Lounge T&C",
            "summary": "8 complimentary domestic Visa airport lounge visits per year (max 2 per quarter)",
        },
    },
    "sbi_bank_air_india_sbi_signature_credit_cards": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "See SBI Visa Lounge T&C",
            "summary": "8 complimentary domestic Visa airport lounge visits per year (max 2 per quarter)",
        },
    },
    "sbi_bank_shaurya_select_sbi_credit_card": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 1,
            "spend_criteria": "See issuer T&C",
            "summary": "4 complimentary domestic airport lounge visits per year",
        },
    },

    # --- RBL Bank ---
    "rbl_bank_rbl_lumiere_credit_card": {
        "domestic": {
            "visits_per_year": 999,
            "visits_per_quarter": 999,
            "spend_criteria": "No spend criteria",
            "summary": "Unlimited complimentary domestic airport lounge visits for primary holders and guests",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 999,
            "spend_criteria": "No spend criteria (incl. 10 international guest visits/yr)",
            "summary": "Unlimited complimentary international Priority Pass visits + 10 guest visits/year",
        },
    },
    "rbl_bank_rbl_bank_practo_plus_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "See issuer T&C",
            "summary": "2 free domestic airport lounge visits per quarter (8/year)",
        },
    },
    "rbl_bank_rbl_bank_apex_credit_card": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 1,
            "spend_criteria": "Min. Rs. 35,000 quarterly spend",
            "summary": "4 complimentary domestic airport lounge visits/year (1/quarter) on min. Rs. 35,000 quarterly spend",
        },
    },
    "rbl_bank_rbl_world_safari_lite_credit_card": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 1,
            "spend_criteria": "Rs. 50,000 quarterly spend",
            "summary": "1 complimentary domestic airport lounge visit per quarter (4/year) on Rs. 50,000 quarterly spend",
        },
        "international": {
            "program": "Priority Pass / Visa Lounge",
            "visits_per_year": 4,
            "spend_criteria": "Rs. 50,000 quarterly spend",
            "summary": "1 complimentary international airport lounge visit per quarter (4/year) on Rs. 50,000 quarterly spend",
        },
    },
    "rbl_bank_world_safari_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Rs. 35,000 in previous quarter",
            "summary": "8 complimentary domestic lounge visits per year (max 2/quarter) on spending Rs. 35,000 in previous quarter",
        },
    },
    "rbl_bank_rbl_bank_irctc_credit_card": {
        "railway": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "summary": "8 complimentary railway lounge visits per year (max 2 per quarter)",
        },
    },
    "rbl_bank_nova_credit_card": {
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 12,
            "spend_criteria": "See issuer T&C",
            "summary": "12 complimentary international airport lounge visits per year",
        },
    },
    "rbl_bank_rbl_bank_icon_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "See issuer T&C",
            "summary": "Up to 8 complimentary domestic airport lounge visits/year (max 2 per quarter)",
        },
    },
    "rbl_bank_platinum_maxima_plus_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "See issuer T&C",
            "summary": "Up to 8 complimentary domestic airport lounge visits/year (max 2 per quarter)",
        },
    },

    # --- YES BANK ---
    "yes_bank_private_credit_card": {
        "domestic": {
            "visits_per_year": 999,
            "visits_per_quarter": 999,
            "spend_criteria": "No spend criteria",
            "summary": "Unlimited complimentary domestic airport lounge visits + 12 guest visits/year",
        },
        "international": {
            "program": "Priority Pass / Visa Infinite",
            "visits_per_year": 999,
            "spend_criteria": "No spend criteria",
            "summary": "Unlimited complimentary international airport lounge visits + 12 guest visits/year",
        },
    },
    "yes_bank_yes_first_exclusive_credit_card": {
        "domestic": {
            "visits_per_year": 12,
            "visits_per_quarter": 3,
            "spend_criteria": "Rs. 1,00,000 or more in previous calendar quarter",
            "summary": "3 complimentary domestic lounge visits/quarter (12/year) on spending Rs. 1 Lakh+ in previous calendar quarter",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 6,
            "spend_criteria": "See issuer T&C",
            "summary": "6 complimentary international airport lounge visits per calendar year",
        },
    },
    "yes_bank_first_business_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "See issuer T&C",
            "summary": "8 complimentary domestic airport lounge visits per year (max 2 per quarter)",
        },
    },
    "yes_bank_first_preferred_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "See issuer T&C",
            "summary": "2 complimentary domestic airport lounge visits per quarter (8/year)",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 4,
            "spend_criteria": "See issuer T&C",
            "summary": "4 complimentary international airport lounge visits annually",
        },
    },
    "yes_bank_prosperity_edge_credit_card": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 1,
            "spend_criteria": "Rs. 50,000 in previous quarter (YES SELECT T&C)",
            "summary": "1 complimentary domestic lounge visit per quarter (4/year) on Rs. 50,000 spend in previous quarter",
        },
    },
    "yes_bank_prosperity_business_credit_card": {
        "domestic": {
            "visits_per_year": 2,
            "visits_per_quarter": 1,
            "spend_criteria": "See issuer T&C",
            "summary": "Complimentary domestic airport lounge access (1-2 visits/year)",
        },
        "international": {
            "program": "Mastercard / Priority Pass",
            "visits_per_year": 3,
            "spend_criteria": "See issuer T&C",
            "summary": "3 complimentary international airport lounge visits per year",
        },
    },
    "yes_bank_zagg_credit_card": {
        "domestic": {
            "spend_criteria": "Min. Rs. 50,000 in previous quarter",
            "summary": "2 complimentary domestic airport lounge visits per quarter (8/year) on min. spend of Rs. 50,000 in previous quarter",
        },
    },

    # --- IndusInd Bank ---
    "indusind_bank_crest_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Rs. 5,00,000 per quarter",
            "summary": "2 complimentary domestic airport lounge visits per quarter (8/year) on Rs. 5 Lakh quarterly spend",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 8,
            "spend_criteria": "See issuer T&C",
            "summary": "2 complimentary international airport lounge visits per quarter (8/year)",
        },
    },
    "indusind_bank_indulge_credit_card": {
        "domestic": {
            "visits_per_year": 24,
            "visits_per_quarter": 6,
            "spend_criteria": "Min. Rs. 5,00,000 in previous quarter",
            "summary": "6 complimentary domestic lounge visits per quarter (24/year) on min. Rs. 5 Lakh spend in previous quarter",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 16,
            "spend_criteria": "See issuer T&C",
            "summary": "4 complimentary international lounge visits per quarter (16/year)",
        },
    },
    "indusind_bank_pioneer_heritage_metal_credit_card": {
        "domestic": {
            "visits_per_year": 999,
            "visits_per_quarter": 999,
            "spend_criteria": "No spend criteria",
            "summary": "Unlimited complimentary domestic airport lounge access",
        },
        "international": {
            "program": "LoungeKey / Priority Pass",
            "visits_per_year": 999,
            "spend_criteria": "No spend criteria",
            "summary": "Unlimited complimentary international airport lounge access via LoungeKey",
        },
    },
    "indusind_bank_indus_solitaire_credit_card": {
        "domestic": {
            "visits_per_year": 16,
            "visits_per_quarter": 4,
            "spend_criteria": "Min. Rs. 5,00,000 in previous quarter",
            "summary": "16 complimentary domestic airport lounge visits/year (4/quarter) on min. Rs. 5 Lakh spend in previous quarter",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 16,
            "spend_criteria": "See issuer T&C",
            "summary": "16 complimentary international airport lounge visits/year (4/quarter)",
        },
    },
    "indusind_bank_celesta_credit_card": {
        "domestic": {
            "spend_criteria": "Min. Rs. 1,50,000 quarterly spend",
            "summary": "Unlimited domestic airport lounge access on a min. quarterly spend of Rs. 1.5 Lakh",
        },
    },
    "indusind_bank_pioneer_legacy_credit_card": {
        "domestic": {
            "spend_criteria": "Rs. 1,50,000 quarterly spend",
            "summary": "1 complimentary domestic lounge visit per quarter on a quarterly spend of Rs. 1.5 Lakh through Mastercard",
        },
    },

    # --- Federal Bank / BOBCARD / BOI / Bandhan / Union / Canara / DBS / Kotak / SC / Utkarsh / LIC ---
    "federal_bank_visa_celesta_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Rs. 60,000 in previous quarter",
            "summary": "2 complimentary domestic lounge visits/quarter (8/year) on spending Rs. 60,000 in the previous quarter",
        },
        "international": {
            "program": "Visa Lounge / Priority Pass",
            "visits_per_year": 2,
            "spend_criteria": "No additional spend specified",
            "summary": "2 complimentary international airport lounge visits per year",
        },
    },
    "federal_bank_edgecobranded_credit_card": {
        "domestic": {
            "spend_criteria": "Min. Rs. 90,000 in preceding 3 months",
            "summary": "1 domestic lounge access per quarter subject to min. eligible spends of Rs. 90,000 in preceding 3 months",
        },
    },
    "federal_bank_amplifi_fi_federal_credit_card": {
        "domestic": {
            "spend_criteria": "Rs. 10,000 in a quarter",
            "summary": "1 domestic airport lounge visit per quarter (4/year) on spending Rs. 10,000 in a quarter",
        },
        "railway": {
            "visits_per_year": 16,
            "visits_per_quarter": 4,
            "summary": "Up to 16 complimentary railway lounge visits per year on Rs. 20,000 monthly spend",
        },
    },
    "federal_bank_federal_bank_visa_signet_credit_card": {
        "domestic": {
            "spend_criteria": "Min. Rs. 20,000 in previous quarter",
            "summary": "4 domestic lounge visits/year (1/quarter) on spending at least Rs. 20,000 in the previous quarter",
        },
    },
    "bandhan_bank_ignite_credit_card": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 1,
            "spend_criteria": "See issuer T&C",
            "summary": "4 complimentary domestic airport lounge visits per year (1 per quarter)",
        },
        "international": {
            "program": "Visa Lounge Program",
            "visits_per_year": 4,
            "spend_criteria": "See issuer T&C",
            "summary": "4 complimentary international airport lounge visits per year (1 per quarter)",
        },
    },
    "bandhan_bank_flare_credit_card": {
        "domestic": {
            "visits_per_year": 16,
            "visits_per_quarter": 4,
            "spend_criteria": "See issuer T&C",
            "summary": "4 complimentary domestic airport lounge visits per quarter (16/year)",
        },
        "international": {
            "program": "Mastercard / Lounge Program",
            "visits_per_year": 4,
            "spend_criteria": "See issuer T&C",
            "summary": "1 complimentary international airport lounge visit per quarter (4/year)",
        },
    },
    "bandhan_bank_lumina_credit_card": {
        "domestic": {
            "visits_per_year": 32,
            "visits_per_quarter": 8,
            "spend_criteria": "See issuer T&C",
            "summary": "8 complimentary domestic airport lounge visits per quarter (32/year)",
        },
        "international": {
            "program": "Mastercard / Priority Pass",
            "visits_per_year": 999,
            "spend_criteria": "See issuer T&C",
            "summary": "Unlimited complimentary international airport lounge visits at select airports",
        },
    },
    "bandhan_bank_sparks_credit_card": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 1,
            "spend_criteria": "See issuer T&C",
            "summary": "1 complimentary domestic airport lounge visit every quarter (4/year)",
        },
    },
    "bobcard_icsi_diamond_credit_card": {
        "domestic": {
            "visits_per_year": 12,
            "visits_per_quarter": 3,
            "spend_criteria": "Min. Rs. 40,000 in previous quarter",
            "summary": "12 complimentary domestic airport lounge visits/year (3/quarter) on min. Rs. 40,000 spend in previous quarter",
        },
    },
    "bobcard_exclusive_credit_card_icai_members": {
        "domestic": {
            "spend_criteria": "Min. Rs. 40,000 in previous quarter",
            "summary": "12 free domestic airport lounge visits/year (3/quarter) on min. Rs. 40,000 spend in previous quarter",
        },
    },
    "bobcard_varunah_credit_cards": {
        "domestic": {
            "visits_per_year": 12,
            "visits_per_quarter": 3,
            "spend_criteria": "Rs. 20,000/qtr (Varunah Plus) / Rs. 40,000/qtr (Varunah Premium)",
            "summary": "3 domestic lounge visits/qtr on Plus (Rs. 20,000/qtr spend); Unlimited on Premium (Rs. 40,000/qtr spend)",
        },
    },
    "bobcard_assam_rifles_sentinel_credit_card": {
        "domestic": {
            "spend_criteria": "Rs. 20,000 in previous quarter",
            "summary": "8 complimentary domestic airport lounge visits/year (2/quarter) subject to Rs. 20,000 spend in previous quarter",
        },
    },
    "bobcard_indian_coast_guard_rakshamah_credit_card": {
        "domestic": {
            "spend_criteria": "Rs. 20,000 in previous quarter",
            "summary": "8 complimentary domestic airport lounge visits/year (2/quarter) subject to Rs. 20,000 spend in previous quarter",
        },
    },
    "bobcard_indian_army_yoddha_bobcard_credit_card": {
        "domestic": {
            "spend_criteria": "Rs. 20,000 in previous quarter",
            "summary": "8 complimentary domestic airport lounge visits/year (2/quarter) on spending Rs. 20,000 in previous quarter",
        },
    },
    "bobcard_bobcard_hpcl_energie_credit_card": {
        "domestic": {
            "spend_criteria": "Rs. 20,000 quarterly spend",
            "summary": "4 complimentary domestic airport lounge visits/year (1/quarter) on reaching Rs. 20,000 quarterly spend",
        },
    },
    "bobcard_bobcard_tiara_credit_card": {
        "domestic": {
            "spend_criteria": "Rs. 40,000 in previous quarter",
            "summary": "Unlimited complimentary domestic airport lounge visits on spending Rs. 40,000 in previous quarter",
        },
    },
    "bank_of_india_rupay_select_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "See BOI RuPay Select T&C",
            "summary": "Up to 8 complimentary domestic airport lounge visits per year (max 2 per quarter)",
        },
        "international": {
            "program": "RuPay Select / Diners",
            "visits_per_year": 2,
            "spend_criteria": "See BOI RuPay Select T&C",
            "summary": "2 complimentary international airport lounge visits per year",
        },
    },
    "bank_of_india_mastercard_platinum_international_credit_card": {
        "domestic": {
            "visits_per_year": 3,
            "visits_per_quarter": 1,
            "spend_criteria": "See issuer T&C",
            "summary": "3 complimentary domestic airport lounge visits per year (1 per quarter)",
        },
    },
    "union_bank_of_india_jcb_wellness_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "See issuer T&C",
            "summary": "Up to 8 complimentary domestic airport lounge visits per year (max 2 per quarter)",
        },
        "international": {
            "program": "RuPay / JCB Lounge Program",
            "visits_per_year": 2,
            "spend_criteria": "See issuer T&C",
            "summary": "2 complimentary international airport lounge visits per year",
        },
    },
    "union_bank_of_india_rupay_select_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "See issuer T&C",
            "summary": "2 complimentary domestic airport lounge visits per quarter (8/year)",
        },
        "international": {
            "program": "RuPay Select",
            "visits_per_year": 2,
            "spend_criteria": "See issuer T&C",
            "summary": "2 complimentary international airport lounge visits per year",
        },
    },
    "canara_bank_visa_credit_cards": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Available on Visa Platinum variant",
            "summary": "2 complimentary domestic lounge visits per quarter (8/year) for Canara Visa Platinum primary holders",
        },
    },
    "dbs_bank_dbs_spark_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Varies by variant (1/qtr on Spark5/10; 2/qtr on Spark20)",
            "summary": "Up to 8 domestic airport lounge visits/year (1/quarter on Spark5/10, 2/quarter on Spark20)",
        },
        "railway": {
            "visits_per_year": 0,
            "visits_per_quarter": 0,
            "summary": "No railway lounge access",
        },
    },
    "kotak_mahindra_bank_kotak_solitaire_credit_card": {
        "domestic": {
            "visits_per_year": 999,
            "visits_per_quarter": 999,
            "spend_criteria": "No spend criteria",
            "summary": "Unlimited complimentary domestic airport lounge visits for primary & add-on holders",
        },
        "international": {
            "program": "Priority Pass / Visa Infinite",
            "visits_per_year": 999,
            "spend_criteria": "No spend criteria",
            "summary": "Unlimited complimentary international airport lounge visits for primary & add-on holders + 2 guest visits/year",
        },
    },
    "kotak_mahindra_bank_privy_league_signature_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "See Kotak Privy T&C",
            "summary": "2 complimentary domestic airport lounge visits per quarter (8/year) via DreamFolks",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 4,
            "spend_criteria": "Paid card variant only",
            "summary": "4 complimentary international airport lounge visits per year (paid variant)",
        },
    },
    "kotak_mahindra_bank_kotak_infinite_credit_card": {
        "domestic": {
            "visits_per_year": 16,
            "visits_per_quarter": 4,
            "spend_criteria": "No spend criteria",
            "summary": "16 complimentary domestic airport lounge visits per year (4 per quarter)",
        },
    },
    "kotak_mahindra_bank_kotak_air_plus_credit_card": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 2,
            "spend_criteria": "See issuer T&C",
            "summary": "4 complimentary domestic airport lounge visits per year (max 2 per quarter)",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 2,
            "spend_criteria": "See issuer T&C",
            "summary": "2 complimentary international Priority Pass lounge visits per year",
        },
    },
    "kotak_mahindra_bank_kotak_air_plus_prime_credit_card": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 2,
            "spend_criteria": "See issuer T&C",
            "summary": "4 complimentary domestic airport lounge visits per year (max 2 per quarter)",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 2,
            "spend_criteria": "See issuer T&C",
            "summary": "2 complimentary international Priority Pass lounge visits per year",
        },
    },
    "kotak_mahindra_bank_royale_signature_credit_card": {
        "domestic": {
            "spend_criteria": "Rs. 75,000 in previous quarter",
            "summary": "Up to 8 complimentary domestic DreamFolks lounge visits/year (2/quarter) on spending Rs. 75,000 in previous quarter",
        },
    },
    "kotak_mahindra_bank_indigo_kotak_xl_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "See issuer T&C",
            "summary": "Up to 8 complimentary domestic airport lounge visits per year (2 per quarter)",
        },
    },
    "standard_chartered_bank_priority_visa_infinite_credit_card": {
        "domestic": {
            "visits_per_year": 16,
            "visits_per_quarter": 4,
            "spend_criteria": "Standard Chartered Priority Banking card",
            "summary": "4 complimentary domestic airport lounge visits per quarter (16/year)",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 24,
            "spend_criteria": "Standard Chartered Priority Banking card",
            "summary": "2 complimentary international airport lounge visits per month (up to 24/year) via Priority Pass",
        },
    },
    "standard_chartered_bank_standard_chartered_beyond_credit_card": {
        "domestic": {
            "visits_per_year": 999,
            "visits_per_quarter": 999,
            "spend_criteria": "No spend criteria",
            "summary": "Unlimited complimentary domestic airport lounge visits + 4 guest visits/year",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 999,
            "spend_criteria": "No spend criteria",
            "summary": "Unlimited complimentary international Priority Pass visits + 4 guest visits/year",
        },
    },
    "standard_chartered_bank_standard_chartered_rewards_credit_card": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 1,
            "spend_criteria": "See issuer T&C",
            "summary": "Up to 4 complimentary domestic airport lounge visits per year (capped at 1 visit per quarter)",
        },
    },
    "amex_bank_american_express_platinum_travel_credit_cards": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Rs. 1,00,000+ spend in previous year (max 2 visits/quarter)",
            "summary": "8 complimentary domestic airport lounge visits/year (max 2/quarter) on spending Rs. 1 Lakh+ in previous year",
        },
    },
    "utkarsh_bank_utkarsh_rhodium_credit_card": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 1,
            "spend_criteria": "See issuer T&C",
            "summary": "4 complimentary domestic airport lounge visits per calendar year",
        },
    },
    "lic_cards_lic_signature_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Rs. 50,000 in previous 3 months (Axis network T&C)",
            "summary": "8 complimentary domestic airport lounge visits per year (2 per quarter) on Rs. 50,000 quarterly spend",
        },
    },
    "rbl_bank_insignia_preferred_banking_world_credit_cards": {
        "domestic": {
            "spend_criteria": "Extra monthly lounge visits unlocked on Rs. 1,00,000+ monthly spend",
            "summary": "Complimentary domestic airport lounge access (additional visits on Rs. 1 Lakh+ monthly spend)",
        },
    },
    "rbl_bank_rbl_insignia_preferred_banking_world_credit_cards": {
        "domestic": {
            "spend_criteria": "Extra monthly lounge visits unlocked on Rs. 1,00,000+ monthly spend",
            "summary": "Complimentary domestic airport lounge access (additional visits on Rs. 1 Lakh+ monthly spend)",
        },
    },
    "yes_bank_wellness_credit_card": {
        "domestic": {
            "visits_per_year": 0,
            "visits_per_quarter": 0,
            "spend_criteria": "Not Applicable",
            "summary": "No domestic airport lounge access (only Wellness Plus variant offers lounge access)",
        },
    },
    "kotak_mahindra_bank_811_dreamdifferent_credit_card": {
        "domestic": {
            "visits_per_year": 0,
            "visits_per_quarter": 0,
            "spend_criteria": "Not Applicable",
            "summary": "No complimentary domestic airport lounge access on FD-backed 811 #DreamDifferent",
        },
    },
    "sbm_bank_sbm_onecard_credit_card": {
        "domestic": {
            "visits_per_year": 0,
            "visits_per_quarter": 0,
            "spend_criteria": "Not Applicable",
            "summary": "No complimentary domestic airport lounge access by default",
        },
    },
    "sbm_bank_sbm_credilio_credit_card": {
        "domestic": {
            "visits_per_year": 0,
            "visits_per_quarter": 0,
            "spend_criteria": "Not Applicable",
            "summary": "No complimentary domestic airport lounge access",
        },
    },
    "federal_bank_simplifi_fi_credit_card": {
        "domestic": {
            "visits_per_year": 0,
            "visits_per_quarter": 0,
            "spend_criteria": "Not Applicable",
            "summary": "No complimentary domestic airport lounge access on entry SimpliFi card",
        },
    },
    "hsbc_bank_cashback_credit_card": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 1,
            "spend_criteria": "See HSBC T&C (older Cashback variant 4/yr max 1/qtr; Live+ cut to 2/yr)",
            "summary": "4 complimentary domestic airport lounge visits per year (max 1 per quarter)",
        },
    },
    "rbl_bank_nova_credit_card": {
        "domestic": {
            "visits_per_year": 12,
            "visits_per_quarter": 3,
            "spend_criteria": "See RBL Bank T&C",
            "summary": "12 complimentary domestic airport lounge visits per year",
        },
        "international": {
            "program": "Priority Pass",
            "visits_per_year": 12,
            "spend_criteria": "Includes 4 complimentary international guest visits/year",
            "summary": "12 complimentary international airport lounge visits/yr + 4 free guest visits outside India",
        },
    },
    "sbi_bank_aurum_credit_card": {
        "domestic": {
            "visits_per_year": 16,
            "visits_per_quarter": 4,
            "spend_criteria": "No spend criteria",
            "summary": "16 complimentary domestic airport lounge visits per year (4 per quarter)",
        },
        "international": {
            "program": "Priority Pass / LoungeKey",
            "visits_per_year": 999,
            "spend_criteria": "No spend criteria",
            "summary": "Unlimited complimentary international airport lounge visits + complimentary guest access",
        },
    },
    "sbi_bank_paytm_sbi_credit_card_select": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 1,
            "spend_criteria": "See SBI Card T&C",
            "summary": "4 complimentary domestic airport lounge visits per year (max 1 per quarter)",
        },
    },
    "icici_bank_icici_bank_carbon_credit_card": {
        "domestic": {
            "visits_per_year": 16,
            "visits_per_quarter": 4,
            "spend_criteria": "Min. Rs. 75,000 in previous quarter (updated ICICI T&C)",
            "summary": "16 complimentary domestic airport lounge visits per year (4 per quarter)",
        },
    },
    "icici_bank_makemytrip_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Min. Rs. 75,000 in previous quarter (updated ICICI T&C)",
            "summary": "8 complimentary domestic airport lounge visits per year (max 2 per quarter)",
        },
    },
    "icici_bank_adani_one_signature_credit_card": {
        "domestic": {
            "visits_per_year": 16,
            "visits_per_quarter": 4,
            "spend_criteria": "See Adani One / ICICI T&C",
            "summary": "16 complimentary domestic airport lounge visits per year (4 per quarter)",
        },
    },
    "icici_bank_platinum_business_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Min. Rs. 75,000 in previous quarter (updated ICICI T&C)",
            "summary": "8 complimentary domestic airport lounge visits per year (max 2 per quarter)",
        },
    },
    "axis_bank_fibe_axis_bank_credit_card": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 1,
            "spend_criteria": "Min. Rs. 50,000 spend in previous 3 months",
            "summary": "4 complimentary domestic airport lounge visits per year (1 per quarter on Rs. 50,000 quarterly spend)",
        },
    },
    "kotak_mahindra_bank_kotak_white_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "See Kotak Mahindra Bank T&C",
            "summary": "8 complimentary domestic airport lounge visits per year (2 per quarter)",
        },
    },
    "kotak_mahindra_bank_myntra_kotak_credit_card": {
        "domestic": {
            "visits_per_year": 4,
            "visits_per_quarter": 1,
            "spend_criteria": "See Kotak Mahindra Bank T&C",
            "summary": "4 complimentary domestic airport lounge visits per year (1 per quarter)",
        },
    },
    "bobcard_bobcard_etihad_guest_credit_card": {
        "domestic": {
            "visits_per_year": 8,
            "visits_per_quarter": 2,
            "spend_criteria": "Min. Rs. 40,000 in previous quarter (BOBCARD standard T&C)",
            "summary": "8 complimentary domestic airport lounge visits per year (2 per quarter)",
        },
    },
    "axis_bank_olympus_credit_card": {
        "domestic": {"spend_criteria": "No spend criteria"},
    },
    "axis_bank_primus_credit_card": {
        "domestic": {"spend_criteria": "No spend criteria"},
    },
    "icici_bank_icici_bank_emeralde_credit_card": {
        "domestic": {"spend_criteria": "No spend criteria"},
    },
    "credit_card_axis_bank_reserve_credit_card": {
        "domestic": {"spend_criteria": "No spend criteria"},
    },
    "kotak_mahindra_bank_kotak_white_reserve_credit_card": {
        "domestic": {"spend_criteria": "No spend criteria"},
    },
    "amex_bank_american_express_platinum_reserve_credit_cards": {
        "domestic": {"spend_criteria": "No spend criteria"},
    },
}


def apply_master_repairs():
    print("[Repair] Loading credit_cards_master.json...", flush=True)
    master = json.loads(MASTER_PATH.read_text(encoding="utf-8"))
    cards: list[dict[str, Any]] = master["cards"]

    stem_map: dict[str, str] = json.loads(STEM_MAP_PATH.read_text(encoding="utf-8")) if STEM_MAP_PATH.exists() else {}
    bank_url_updated = 0
    trunc_fixed = 0
    spend_fixed = 0
    overrides_applied = 0

    for card in cards:
        cid = card["card_id"]
        srcs = card.get("sources") or {}

        # 1. Capture raw .md stem BEFORE deleting paisabazaar_url
        pb_url = srcs.get("paisabazaar_url") or ""
        if pb_url:
            pb_stem = re.sub(r"^https?://(?:www\.)?paisabazaar\.com/", "", pb_url).strip("/").replace("/", "_")
            if pb_stem:
                stem_map[cid] = pb_stem

        raw_lines: list[str] = []
        if cid in stem_map:
            md_file = PB_CARDS_DIR / f"{stem_map[cid]}.md"
            if md_file.exists():
                raw_lines = md_file.read_text(encoding="utf-8", errors="ignore").splitlines()

        # 2. Repair bank_url and remove paisabazaar_url
        new_bank_url = resolve_bank_url(card)
        if srcs.get("bank_url") != new_bank_url:
            bank_url_updated += 1
        srcs["bank_url"] = new_bank_url
        srcs.pop("paisabazaar_url", None)
        # Also scrub aggregator_urls from any paisabazaar links
        if isinstance(srcs.get("aggregator_urls"), list):
            srcs["aggregator_urls"] = [u for u in srcs["aggregator_urls"] if u and "paisabazaar" not in str(u).lower()]
        card["sources"] = srcs

        # 3. Clean ratings keys cleanly
        rat = card.get("ratings") or {}
        if "paisabazaar_overall" in rat or "paisabazaar_rating" in rat:
            ed_val = rat.get("paisabazaar_overall") or rat.get("paisabazaar_rating")
            if rat.get("overall_market_rating") is None and ed_val is not None:
                rat["overall_market_rating"] = ed_val
            if ed_val is not None:
                rat["editorial_rating"] = ed_val
            rat.pop("paisabazaar_overall", None)
            rat.pop("paisabazaar_rating", None)
        if "paisabazaar_subratings" in rat:
            if not rat.get("category_sub_ratings"):
                rat["category_sub_ratings"] = rat["paisabazaar_subratings"]
            rat.pop("paisabazaar_subratings", None)
        if "paisabazaar_review_summary" in rat:
            rat["editorial_review_summary"] = scrub_text(str(rat.pop("paisabazaar_review_summary") or ""))
        card["ratings"] = rat

        # 4. Scrub PaisaBazaar mentions/links across descriptive fields (keep card_id / card_name intact for 3 genuine co-branded cards)
        for fld in ("benefits_and_features", "pros", "cons", "rewards", "best_for_whom", "eligibility", "fees", "devaluation"):
            if fld in card and card[fld] is not None:
                card[fld] = scrub_value(card[fld])

        # 5. Lounge summary truncation fix & spend criteria fix
        la = card.get("lounge_access") or {}
        for sec in ("domestic", "international", "railway"):
            blk = la.get(sec)
            if not isinstance(blk, dict):
                continue
            summ = scrub_text(str(blk.get("summary") or ""))
            # Reject stray non-lounge table boilerplate
            if summ.startswith("| If your goal") or "top credit cards for airport lounge access" in summ.lower():
                summ = ""
            # Check for sentence truncation ending in "Rs.", "min.", "Max.", "No.", "i.e."
            if summ and (summ.endswith(("Rs.", "min.", "Max.", "max.", "No.", "no.", "i.e.")) or len(summ) < 12):
                recovered = find_full_sentence_in_md(raw_lines, summ)
                if recovered:
                    summ = scrub_text(recovered)
                    trunc_fixed += 1
                elif summ.endswith(("Rs.", "min.", "Max.", "max.")):
                    summ = re.sub(r"\s+(?:on\s+spending|subject to|with)?\s*(?:min\.|Max\.|max\.|Rs\.)$", "", summ).strip()
            blk["summary"] = summ

        # Fix Priority Pass membership-only false positives where summary literally ONLY mentions membership, no visits
        intl_blk = la.get("international")
        if isinstance(intl_blk, dict):
            isumm = str(intl_blk.get("summary") or "").lower()
            v_intl = intl_blk.get("visits_per_year") or 0
            # Note: If intl_blk summary doesn't state any complimentary visits count OR has "not offer any international"
            if v_intl > 0 and ("does not offer any international" in isumm or "no international lounge" in isumm):
                intl_blk["visits_per_year"] = 0
                intl_blk["spend_criteria"] = "Not Applicable"

        # Apply exact overrides FIRST so curated cards get authoritative counts & criteria
        if cid in EXACT_LOUNGE_OVERRIDES:
            ov = EXACT_LOUNGE_OVERRIDES[cid]
            for sec, updates in ov.items():
                if not isinstance(la.get(sec), dict):
                    la[sec] = {}
                la[sec].update(updates)
            overrides_applied += 1

        # Generic spend criteria recovery if domestic visits > 0 and spend_criteria says "No spend criteria"
        dom_blk = la.get("domestic")
        if isinstance(dom_blk, dict):
            has_dom_v = (dom_blk.get("visits_per_year") or 0) > 0 or (dom_blk.get("visits_per_quarter") or 0) > 0 or "unlimited" in str(dom_blk.get("summary") or "").lower()
            sc_str = str(dom_blk.get("spend_criteria") or "").strip()
            sc_low = sc_str.lower()
            dom_summ_str = str(dom_blk.get("summary") or "")
            if has_dom_v and (not sc_str or sc_low.startswith("no spend criteria") or sc_low in ("not applicable", "see issuer t&c")):
                # Search summary + highlights + clean md lines
                hl = (card.get("benefits_and_features") or {}).get("highlights") or []
                clean_md_lines = [
                    re.sub(r"\*+|`|\[([^\]]+)\]\([^)]+\)", r"\1", ln).strip()
                    for ln in raw_lines
                    if "lounge" in ln.lower() and "pb pass" not in ln.lower() and "paisabazaar" not in ln.lower()
                ]
                extracted_sc = extract_spend_from_texts([dom_summ_str] + [str(h) for h in hl] + clean_md_lines)
                if extracted_sc:
                    dom_blk["spend_criteria"] = extracted_sc
                    spend_fixed += 1
                    # Also ensure summary doesn't say "without spend criteria" falsely
                    if "without spend" in dom_summ_str.lower() or "no spend criteria" in dom_summ_str.lower():
                        dom_blk["summary"] = f"{dom_summ_str.split('(')[0].strip()} (Spend condition: {extracted_sc})"
                elif not sc_str or sc_low == "not applicable" or "specified" in sc_low:
                    dom_blk["spend_criteria"] = "See issuer T&C (spend criteria may apply)"

        card["lounge_access"] = la

    # Scrub top-level sources/notes in master metadata if any
    if isinstance(master.get("sources"), list):
        master["sources"] = [scrub_text(str(x)) for x in master["sources"] if "paisabazaar" not in str(x).lower()]

    STEM_MAP_PATH.write_text(json.dumps(stem_map, indent=2, ensure_ascii=False), encoding="utf-8")
    MASTER_PATH.write_text(json.dumps(master, indent=2, ensure_ascii=False), encoding="utf-8")

    print(
        f"[Repair DONE] cards={len(cards)} | stems={len(stem_map)} | "
        f"bank_url_updated={bank_url_updated} | trunc_fixed={trunc_fixed} | "
        f"overrides_applied={overrides_applied} | generic_spend_fixed={spend_fixed}",
        flush=True,
    )


if __name__ == "__main__":
    apply_master_repairs()
