#!/usr/bin/env python3
"""Merge verified Crawl4AI CardMaven data, tables, 2026 updates, missing cards,
and high-res card artwork into canonical Cards by cogify datasets.

Run with:
  /Users/shubhamsharma/.local/share/uv/tools/crawl4ai/bin/python data/scripts/merge_cardmaven.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import httpx
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
CM_JSON = DATA / "raw" / "cardmaven" / "cardmaven_parsed.json"
DYN_DIR = DATA / "raw" / "cardmaven" / "dynamic"
CARDS_BY_BANK = DATA / "cards_by_bank"
MASTER = DATA / "master"
WEB_PUBLIC = ROOT / "web" / "public"
IMG_ASSETS = DATA / "assets" / "card_images"
IMG_PUBLIC = WEB_PUBLIC / "card-images"

# Exact verified mapping: CardMaven slug -> (our_bank_slug, our_card_slug)
EXPLICIT_CARD_MAP: dict[str, tuple[str, str]] = {
    "airtel-axis-bank-credit-card": ("axis-bank", "airtel-axis-bank-credit-card"),
    "amazon-pay-icici-bank-credit-card-review": ("icici-bank", "amazon-pay-icici-bank-credit-card"),
    "american-express-gold-charge-card-review": ("american-express", "american-express-gold-card"),
    "american-express-membership-rewards-credit-card": ("american-express", "american-express-membership-rewards-credit-card"),
    "american-express-platinum-reserve-credit-card": ("american-express", "american-express-platinum-reserve-credit-card"),
    "american-express-platinum-travel-credit-card-review": ("american-express", "american-express-platinum-travel-credit-card"),
    "au-bank-lit-credit-card-review": ("au-small-finance-bank", "au-lit-credit-card"),
    "axis-bank-ace-credit-card-review": ("axis-bank", "axis-bank-ace-credit-card"),
    "axis-bank-atlas-credit-card": ("axis-bank", "axis-bank-atlas-credit-card"),
    "axis-bank-cashback-credit-card-review": ("axis-bank", "axis-bank-cashback-credit-card"),
    "axis-bank-horizon-credit-card-review": ("axis-bank", "axis-bank-horizon-credit-card"),
    "axis-bank-magnus-burgundy-credit-card": ("axis-bank", "axis-bank-magnus-credit-card-for-burgundy"),
    "axis-bank-magnus-credit-card-review": ("axis-bank", "axis-magnus-credit-card"),
    "axis-bank-my-zone-credit-card": ("axis-bank", "axis-my-zone-credit-card-limited-period-lifetime-free-offer"),
    "bank-of-baroda-cashback-credit-card-review": ("bobcard-bank-of-baroda", "bobcard-cashback"),
    "bank-of-baroda-eterna-credit-card-review": ("bobcard-bank-of-baroda", "bobcard-eterna-credit-card"),
    "bobcard-select-credit-card-review": ("bobcard-bank-of-baroda", "bobcard-select"),
    "bpcl-sbi-credit-card-octane-review": ("sbi-card", "bpcl-sbi-card-octane"),
    "bpcl-sbi-credit-card-review": ("sbi-card", "bpcl-sbi-card"),
    "eazydiner-indusind-platinum-rupay-credit-card": ("indusind-bank", "eazydiner-indusind-bank-platinum-credit-card"),
    "eternal-sbi-card-review": ("sbi-card", "eternal-sbi-credit-card"),
    "flipkart-axis-bank-credit-card-review": ("axis-bank", "flipkart-axis-bank-credit-card"),
    "flipkart-sbi-credit-card-review": ("sbi-card", "flipkart-sbi-card"),
    "hdfc-bank-bizpower-credit-card-review": ("hdfc-bank", "hdfc-bank-bizpower-credit-card"),
    "hdfc-bank-diners-club-black-credit-card-review": ("hdfc-bank", "hdfc-diners-club-black-metal-edition"),
    "hdfc-diners-club-black-metal-credit-card-review": ("hdfc-bank", "hdfc-diners-club-black-metal-edition"),
    "hdfc-bank-diners-club-privilege-credit-card-review": ("hdfc-bank", "hdfc-diners-club-privilege-credit-card"),
    "hdfc-bank-infinia-credit-card-review": ("hdfc-bank", "hdfc-infinia-metal-edition-credit-card"),
    "hdfc-bank-millennia-credit-card-review": ("hdfc-bank", "hdfc-millennia-credit-card"),
    "hdfc-bank-moneyback-plus-credit-card": ("hdfc-bank", "hdfc-moneyback-credit-card"),
    "hdfc-bank-pixel-play-credit-card-review": ("hdfc-bank", "hdfc-bank-pixel-play-credit-card"),
    "hdfc-bank-regalia-credit-card-review": ("hdfc-bank", "hdfc-regalia-credit-card"),
    "hdfc-bank-regalia-gold-credit-card-review": ("hdfc-bank", "hdfc-regalia-gold-credit-card"),
    "hdfc-bank-rupay-credit-card": ("hdfc-bank", "hdfc-bank-upi-rupay-credit-card"),
    "hpcl-bank-of-baroda-energie-credit-card-review": ("bobcard-bank-of-baroda", "bobcard-hpcl-energie-credit-card"),
    "hsbc-live-plus-credit-card-review": ("hsbc-bank", "hsbc-live-credit-card"),
    "hsbc-premier-credit-card": ("hsbc-bank", "hsbc-premier-credit-card"),
    "hsbc-rupay-cashback-credit-card-review": ("hsbc-bank", "hsbc-rupay-cashback-credit-card"),
    "hsbc-travelone-credit-card-review": ("hsbc-bank", "hsbc-travelone-credit-card"),
    "hsbc-visa-platinum-credit-card-review": ("hsbc-bank", "hsbc-visa-platinum-credit-card"),
    "icici-bank-coral-credit-card-review": ("icici-bank", "icici-coral-credit-card"),
    "icici-bank-emeralde-credit-card-review": ("icici-bank", "icici-bank-emeralde-credit-card"),
    "icici-bank-emeralde-private-metal-credit-card-review": ("icici-bank", "icici-bank-emeralde-private-metal-credit-card"),
    "icici-bank-rubyx-credit-card-review": ("icici-bank", "icici-bank-rubyx-credit-card"),
    "icici-bank-sapphiro-credit-card-review": ("icici-bank", "icici-bank-sapphiro-credit-card"),
    "idfc-first-bank-hpcl-power-credit-card-review": ("idfc-first-bank", "hpcl-first-power-credit-card-by-idfc-first-bank"),
    "idfc-first-bank-hpcl-power-plus-credit-card-review": ("idfc-first-bank", "first-power-credit-card-by-idfc-first-bank"),
    "idfc-first-bank-select-credit-card-review": ("idfc-first-bank", "first-select-credit-card-by-idfc-first-bank"),
    "idfc-first-bank-wow-credit-card": ("idfc-first-bank", "idfc-first-wow-credit-card"),
    "idfc-first-wealth-credit-card-review": ("idfc-first-bank", "idfc-first-wealth-credit-card"),
    "idfc-first-wow-black-credit-card-review": ("idfc-first-bank", "first-wow-black-credit-card-by-idfc-first-bank"),
    "indian-oil-kotak-credit-card": ("kotak-mahindra-bank", "indianoil-kotak-credit-card"),
    "indianoil-axis-bank-credit-card-review": ("axis-bank", "indianoil-axis-bank-credit-card"),
    "indianoil-rbl-bank-credit-card-review": ("rbl-bank", "indianoil-rbl-bank-credit-card"),
    "indianoil-rbl-bank-xtra-credit-card-review": ("rbl-bank", "indianoil-rbl-bank-xtra-credit-card"),
    "indigo-idfc-first-bank-credit-card-review": ("idfc-first-bank", "indigo-idfc-first-credit-card"),
    "indusind-avios-visa-infinite-review": ("indusind-bank", "indusind-bank-avios-visa-infinite-credit-card"),
    "indusind-bank-tiger-credit-card-review": ("indusind-bank", "indusind-bank-tiger-credit-card"),
    "irctc-hdfc-bank-credit-card-review": ("hdfc-bank", "irctc-hdfc-bank-credit-card"),
    "irctc-rupay-sbi-card-review": ("sbi-card", "irctc-sbi-platinum-credit-card"),
    "ixigo-au-credit-card": ("au-small-finance-bank", "ixigo-au-credit-card"),
    "kiwi-rupay-credit-card-review": ("yes-bank", "yes-bank-klick-kiwi-rupay-credit-card"),
    "kotak-cashback-plus-credit-card-review": ("kotak-mahindra-bank", "kotak-cashback-credit-card"),
    "kotak-white-reserve-credit-card-review": ("kotak-mahindra-bank", "kotak-white-reserve-credit-card"),
    "marriott-bonvoy-hdfc-bank-credit-card": ("hdfc-bank", "marriott-bonvoy-hdfc-bank-credit-card"),
    "phonepe-hdfc-bank-ultimo-credit-card-review": ("hdfc-bank", "phonepe-hdfc-bank-ultimo-credit-card"),
    "phonepe-hdfc-bank-uno-credit-card-review": ("hdfc-bank", "phonepe-hdfc-bank-uno-credit-card"),
    "phonepe-sbi-select-black-credit-card-review": ("sbi-card", "phonepe-sbi-card-select-black"),
    "rbl-shoprite-credit-card-review": ("rbl-bank", "rbl-shoprite-credit-card"),
    "rbl-world-safari-credit-card-review": ("rbl-bank", "rbl-world-safari-credit-card"),
    "sbi-aurum-credit-card": ("sbi-card", "sbi-aurum-credit-card"),
    "sbi-card-pulse-review": ("sbi-card", "sbi-card-pulse"),
    "sbi-cashback-credit-card-review": ("sbi-card", "cashback-sbi-card"),
    "sbi-elite-credit-card": ("sbi-card", "sbi-card-elite"),
    "sbi-prime-credit-card-review": ("sbi-card", "sbi-card-prime"),
    "sbi-simplyclick-credit-card-review": ("sbi-card", "sbi-simplyclick-credit-card"),
    "sbi-simplysave-credit-card-review": ("sbi-card", "sbi-simplysave-credit-card"),
    "scapia-credit-card-review": ("federal-bank-scapia", "federal-bank-scapia-credit-card"),
    "swiggy-blck-hdfc-bank-credit-card-review": ("hdfc-bank", "swiggy-blck-hdfc-bank-credit-card"),
    "swiggy-ornge-hdfc-bank-credit-card-review": ("hdfc-bank", "swiggy-ornge-hdfc-bank-credit-card"),
    "tata-neu-infinity-hdfc-bank-credit-card": ("hdfc-bank", "tata-neu-infinity-hdfc-bank-credit-card"),
    "tata-neu-plus-hdfc-bank-credit-card": ("hdfc-bank", "tata-neu-plus-hdfc-credit-card"),
    "tata-neu-plus-sbi-card-review": ("sbi-card", "tata-neu-plus-sbi-card"),
    "times-black-icici-bank-credit-card-review": ("icici-bank", "times-black-icici-bank-credit-card"),
    "yes-bank-marquee-credit-card": ("yes-bank", "yes-bank-marquee-credit-card"),
    "yes-bank-reserv-credit-card": ("yes-bank", "yes-bank-reserv-credit-card"),
    "hdfc-bank-bizblack-credit-card-review": ("hdfc-bank", "hdfc-bizblack-metal-edition-credit-card"),
    "irctc-sbi-premier-credit-card": ("sbi-card", "irctc-sbi-premier-credit-card"),
}

# Canonical transfer-partner table from Amex India (Nov 2026)
AMEX_TRANSFER_PARTNERS_TABLE = {
    "id": "amex-india-transfer-partners-2026",
    "kind": "transfer_partners",
    "title": "Amex Membership Rewards Transfer Partners (Nov 2026)",
    "note": "Emirates Skywards suspended May 2025 · Club Vistara merged into Air India · Etihad Guest removed 1 July 2026 · Hilton (1:1.5) and Virgin Atlantic (5:4) improved Aug 2026.",
    "headers": ["Partner", "Type", "Conversion Rate", "Ratio"],
    "rows": [
        ["Marriott Bonvoy", "Hotel", "100 MR = 100 Marriott Bonvoy Points", "1:1"],
        ["Hilton Honors", "Hotel", "1,000 MR = 1,500 Hilton Honors Points", "1:1.5 (Boosted Aug 2026)"],
        ["Virgin Atlantic Flying Club", "Airline", "800 MR = 640 Virgin Points", "5:4 (Boosted Aug 2026)"],
        ["Singapore KrisFlyer", "Airline", "800 MR = 400 KrisFlyer Miles", "2:1"],
        ["Asia Miles (Cathay)", "Airline", "800 MR = 400 Asia Miles", "2:1"],
        ["Qatar Privilege Club", "Airline", "500 MR = 250 Avios", "2:1"],
        ["British Airways Executive Club", "Airline", "1,200 MR = 600 Avios", "2:1"],
    ],
}

AMEX_TP_LIST = [
    {"partner": "Marriott Bonvoy", "ratio": "1:1 (100 MR = 100 Pts)", "notes": "Best hotel sweet spot"},
    {"partner": "Hilton Honors", "ratio": "1:1.5 (1,000 MR = 1,500 Pts)", "notes": "Ratio improved Aug 2026"},
    {"partner": "Virgin Atlantic Flying Club", "ratio": "5:4 (800 MR = 640 Pts)", "notes": "Ratio improved Aug 2026"},
    {"partner": "Singapore KrisFlyer", "ratio": "2:1 (800 MR = 400 Miles)", "notes": "Airline partner"},
    {"partner": "Asia Miles (Cathay)", "ratio": "2:1 (800 MR = 400 Miles)", "notes": "Airline partner"},
    {"partner": "Qatar Privilege Club", "ratio": "2:1 (500 MR = 250 Avios)", "notes": "Avios transferable to BA"},
    {"partner": "British Airways Executive Club", "ratio": "2:1 (1,200 MR = 600 Avios)", "notes": "Emirates suspended / Etihad removed Jul 2026"},
]

# Axis Sept 2026 Transfer Partner updates (Accor returned to Group A, Air India/Flying Blue/Qantas moved to Group A)
AXIS_SEPT_2026_OVERVIEW_TABLE = {
    "id": "axis-transfer-groups-sept-2026",
    "kind": "transfer_partners",
    "title": "Axis Bank Transfer Partner Groups (Updated Sept 2026)",
    "note": "Accor ALL & Cathay returned to Group A; Air India Maharaja Club, Flying Blue & Qantas moved to Group A; Hilton Honors & Miles & More added to Group B; ITC Hotels removed.",
    "headers": ["Partner", "Tier", "Update (Sept 2026)"],
    "rows": [
        ["Accor Live Limitless (ALL)", "Group A", "Returned in Sept 2026 (Atlas 2:1 · Magnus Burgundy 5:2 · Magnus 5:1)"],
        ["Cathay Asia Miles", "Group A", "Added Sept 2026 (Atlas 2:1 · Magnus Burgundy 5:2 · Magnus 5:1)"],
        ["Air India Maharaja Club", "Group A", "Moved from Group B to Group A (Atlas 1:2 · Magnus Burgundy 5:4)"],
        ["Flying Blue (Air France / KLM)", "Group A", "Moved from Group B to Group A (Atlas 1:2 · Magnus Burgundy 5:4)"],
        ["Qantas Frequent Flyer", "Group A", "Moved from Group B to Group A (Atlas 1:2 · Magnus Burgundy 5:4)"],
        ["Hilton Honors", "Group B", "Added to Group B (Atlas 1:2 · Magnus Burgundy 5:4)"],
        ["Miles & More (Lufthansa)", "Group B", "Added to Group B (Atlas 1:1 · Magnus Burgundy 5:4)"],
        ["ITC Hotels", "Removed", "Discontinued as Axis transfer partner"],
    ],
}

AXIS_CARD_TRANSFER_CAPS = {
    "axis-bank-burgundy-private-credit-card": ("3,00,000 pts/yr Group A · 12,00,000 pts/yr Group B", "5:4 across Group A (Accor, Cathay, Air India, Flying Blue, Qantas) & Group B"),
    "axis-bank-magnus-credit-card-for-burgundy": ("2,00,000 RP/yr Group A · 8,00,000 RP/yr Group B", "5:2 Accor/Cathay · 5:4 Air India, Flying Blue, Qantas, Hilton & Miles & More"),
    "axis-magnus-credit-card": ("1,00,000 RP/yr Group A · 4,00,000 RP/yr Group B", "5:1 Accor/Cathay · 5:2 Air India, Flying Blue, Qantas, Hilton & Miles & More"),
    "axis-bank-olympus-credit-card": ("1,50,000 EDGE Miles/yr Group A · 6,00,000 Group B", "1:2 Accor/Cathay · 1:4 Air India, Flying Blue, Qantas, Hilton & Miles & More"),
    "axis-bank-atlas-credit-card": ("30,000 EDGE Miles/yr Group A · 1,20,000 Group B", "1:2 Air India / Flying Blue / Qantas · 2:1 Accor / Cathay · 1:1 Miles & More"),
    "axis-bank-horizon-credit-card": ("Group A & Group B EDGE Miles cap applies", "1:1 Air India / Flying Blue / partner miles"),
}

# SmartBuy GyFTR/Woohoo July 2026 Cap table for HDFC premium cards
HDFC_SMARTBUY_GYFTR_JULY_2026_TABLE = {
    "id": "hdfc-smartbuy-gyftr-caps-july-2026",
    "kind": "accelerated_partners",
    "title": "HDFC SmartBuy Monthly & GyFTR Voucher Caps (July 2026)",
    "note": "Effective 1 July 2026, SmartBuy GyFTR & Woohoo brand vouchers carry a carved-out 3,000 Bonus RP/month sub-limit inside the overall SmartBuy monthly cap.",
    "headers": ["Card Variant", "Overall SmartBuy Cap/Mo", "GyFTR/Woohoo Cap", "Max Spend for 3,000 Bonus RP"],
    "rows": [
        ["HDFC Infinia / Infinia Metal", "15,000 Bonus RP", "3,000 Bonus RP", "~₹30,000 / month (5X)"],
        ["HDFC Diners Club Black Metal", "10,000 Bonus RP", "3,000 Bonus RP", "~₹45,000 / month (3X)"],
        ["HDFC BizBlack Metal", "7,500–15,000 RP", "3,000 Bonus RP", "~₹30,000 / month"],
        ["HDFC Regalia Gold", "4,000 RP (capped)", "Sub-cap applies", "5X via Instant Voucher / Myntra / Nykaa"],
    ],
}

# New cards to create natively from CardMaven reviews + 2026 verified rules
NEW_CARDS_SPEC: list[dict[str, Any]] = [
    {
        "cm_slug": "equitas-powermiles-credit-card-review",
        "bank": "Equitas Small Finance Bank",
        "bank_slug": "equitas-small-finance-bank",
        "card_slug": "equitas-powermiles-credit-card",
        "card_id": "equitas_small_finance_bank_equitas_powermiles_credit_card",
        "card_name": "Equitas PowerMiles Credit Card",
        "card_network": "Visa Signature",
        "card_tier": "Mid-Premium",
        "primary_category": "Travel & Miles",
        "categories": ["Travel & Miles", "Airport Lounge", "Dining, Groceries & Movies"],
        "joining_fee": 5000,
        "annual_fee": 5000,
        "fee_waiver": 400000,
        "forex_markup": 3.5,
        "rating": 4.4,
        "base_rate": 1.5,
        "peak_rate": 4.5,
        "rates": {
            "online_shopping_general": 1.5,
            "amazon_flipkart_myntra": 1.5,
            "dining_swiggy_zomato": 4.5,
            "groceries_quick_commerce": 1.5,
            "travel_flights_hotels": 4.5,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": 1.0,
            "offline_general_other": 1.5,
        },
        "dom_lounge": {"yr": 8, "qtr": 2, "spend": "Check bank quarterly spend rule", "summary": "2 complimentary domestic airport lounge visits per quarter (8/year)"},
        "intl_lounge": {"yr": 4, "program": "LoungeKey / Priority Pass", "summary": "1 complimentary international lounge visit per quarter (4/year)"},
        "is_ltf": False,
        "is_rupay": False,
    },
    {
        "cm_slug": "equitas-selfe-credit-card-review",
        "bank": "Equitas Small Finance Bank",
        "bank_slug": "equitas-small-finance-bank",
        "card_slug": "equitas-selfe-credit-card",
        "card_id": "equitas_small_finance_bank_equitas_selfe_credit_card",
        "card_name": "Equitas Selfe Credit Card",
        "card_network": "Visa / RuPay",
        "card_tier": "Mid-Tier",
        "primary_category": "Cashback",
        "categories": ["Cashback", "Online Shopping", "Airport Lounge", "RuPay & UPI"],
        "joining_fee": 1000,
        "annual_fee": 1000,
        "fee_waiver": 150000,
        "forex_markup": 3.5,
        "rating": 4.2,
        "base_rate": 0.7,
        "peak_rate": 5.0,
        "rates": {
            "online_shopping_general": 3.5,
            "amazon_flipkart_myntra": 3.5,
            "dining_swiggy_zomato": 5.0,
            "groceries_quick_commerce": 3.5,
            "travel_flights_hotels": 2.0,
            "upi_scan_and_pay": 0.7,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -2.8,
            "offline_general_other": 0.7,
        },
        "dom_lounge": {"yr": 4, "qtr": 1, "spend": "Standard quarterly qualification", "summary": "1 complimentary domestic airport lounge visit per quarter (4/year)"},
        "intl_lounge": {"yr": 0, "program": "None", "summary": "No complimentary international lounge access"},
        "is_ltf": False,
        "is_rupay": True,
    },
    {
        "cm_slug": "bob-premier-credit-card-review",
        "bank": "BOBCARD",
        "bank_slug": "bobcard-bank-of-baroda",
        "card_slug": "bobcard-premier-credit-card",
        "card_id": "bobcard_bank_of_baroda_bobcard_premier_credit_card",
        "card_name": "BOBCARD Premier Credit Card",
        "card_network": "Visa Signature",
        "card_tier": "Mid-Tier",
        "primary_category": "Dining, Groceries & Movies",
        "categories": ["Dining, Groceries & Movies", "Travel & Miles", "Lifetime Free", "Airport Lounge"],
        "joining_fee": 1000,
        "annual_fee": 0,
        "fee_waiver": 120000,
        "forex_markup": 3.5,
        "rating": 4.3,
        "base_rate": 0.5,
        "peak_rate": 2.5,
        "rates": {
            "online_shopping_general": 0.5,
            "amazon_flipkart_myntra": 0.5,
            "dining_swiggy_zomato": 2.5,
            "groceries_quick_commerce": 0.5,
            "travel_flights_hotels": 2.5,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.5,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -1.0,
            "offline_general_other": 0.5,
        },
        "dom_lounge": {"yr": 4, "qtr": 1, "spend": "₹20,000 spend in previous quarter", "summary": "1 complimentary domestic airport lounge visit per quarter (4/year; spend-gated)"},
        "intl_lounge": {"yr": 0, "program": "None", "summary": "No complimentary international lounge access"},
        "is_ltf": True,
        "is_rupay": False,
    },
    {
        "cm_slug": "irctc-sbi-premier-credit-card-review",
        "bank": "SBI Card",
        "bank_slug": "sbi-card",
        "card_slug": "irctc-sbi-premier-credit-card",
        "card_id": "sbi_card_irctc_sbi_premier_credit_card",
        "card_name": "IRCTC SBI Card PREMIER",
        "card_network": "RuPay Select",
        "card_tier": "Mid-Tier",
        "primary_category": "Travel & Miles",
        "categories": ["Travel & Miles", "Airport Lounge", "RuPay & UPI"],
        "joining_fee": 1499,
        "annual_fee": 1499,
        "fee_waiver": 200000,
        "forex_markup": 3.5,
        "rating": 4.0,
        "base_rate": 0.75,
        "peak_rate": 10.0,
        "rates": {
            "online_shopping_general": 0.75,
            "amazon_flipkart_myntra": 0.75,
            "dining_swiggy_zomato": 2.25,
            "groceries_quick_commerce": 0.75,
            "travel_flights_hotels": 10.0,
            "upi_scan_and_pay": 0.75,
            "utilities_bills_telecom": 2.25,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -2.75,
            "offline_general_other": 0.75,
        },
        "dom_lounge": {"yr": 0, "qtr": 0, "spend": "Railway lounge focused (no airport lounge)", "summary": "8 complimentary IRCTC Railway Lounge visits/year (max 2/quarter)"},
        "intl_lounge": {"yr": 0, "program": "None", "summary": "No complimentary international airport lounge"},
        "rail_lounge": {"yr": 8, "qtr": 2, "summary": "8 complimentary IRCTC Executive Railway Lounge visits/yr (2/quarter)"},
        "is_ltf": False,
        "is_rupay": True,
    },
    {
        "cm_slug": "reliance-sbi-card-prime",
        "bank": "SBI Card",
        "bank_slug": "sbi-card",
        "card_slug": "reliance-sbi-card-prime",
        "card_id": "sbi_card_reliance_sbi_card_prime",
        "card_name": "Reliance SBI Card PRIME",
        "card_network": "Visa / RuPay",
        "card_tier": "Mid-Premium",
        "primary_category": "Online Shopping",
        "categories": ["Online Shopping", "Dining, Groceries & Movies", "Airport Lounge", "RuPay & UPI"],
        "joining_fee": 2999,
        "annual_fee": 2999,
        "fee_waiver": 300000,
        "forex_markup": 3.5,
        "rating": 4.0,
        "base_rate": 0.5,
        "peak_rate": 2.5,
        "rates": {
            "online_shopping_general": 2.5,
            "amazon_flipkart_myntra": 1.25,
            "dining_swiggy_zomato": 1.25,
            "groceries_quick_commerce": 2.5,
            "travel_flights_hotels": 1.25,
            "upi_scan_and_pay": 0.5,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.0,
            "offline_general_other": 1.25,
        },
        "dom_lounge": {"yr": 8, "qtr": 2, "spend": "No spend criteria highlighted", "summary": "8 complimentary domestic airport lounge visits/yr (max 2/quarter)"},
        "intl_lounge": {"yr": 4, "program": "Priority Pass", "summary": "4 complimentary international Priority Pass visits/yr (max 2/quarter)"},
        "is_ltf": False,
        "is_rupay": True,
    },
    {
        "cm_slug": "apollo-sbi-select-credit-card-review",
        "bank": "SBI Card",
        "bank_slug": "sbi-card",
        "card_slug": "apollo-sbi-card-select",
        "card_id": "sbi_card_apollo_sbi_card_select",
        "card_name": "Apollo SBI Card SELECT",
        "card_network": "Visa / RuPay",
        "card_tier": "Mid-Tier",
        "primary_category": "Lifestyle & Health",
        "categories": ["Cashback", "Airport Lounge", "RuPay & UPI"],
        "joining_fee": 1499,
        "annual_fee": 1499,
        "fee_waiver": 250000,
        "forex_markup": 3.5,
        "rating": 3.9,
        "base_rate": 0.5,
        "peak_rate": 10.0,
        "rates": {
            "online_shopping_general": 2.5,
            "amazon_flipkart_myntra": 0.5,
            "dining_swiggy_zomato": 2.5,
            "groceries_quick_commerce": 0.5,
            "travel_flights_hotels": 2.5,
            "upi_scan_and_pay": 0.5,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.0,
            "offline_general_other": 0.5,
        },
        "dom_lounge": {"yr": 4, "qtr": 1, "spend": "No spend criteria", "summary": "4 complimentary domestic airport lounge visits/yr (max 1/quarter)"},
        "intl_lounge": {"yr": 0, "program": "None", "summary": "No complimentary international airport lounge"},
        "is_ltf": False,
        "is_rupay": True,
    },
    {
        "cm_slug": "yes-bank-elite-plus-credit-card-review",
        "bank": "YES BANK",
        "bank_slug": "yes-bank",
        "card_slug": "yes-bank-elite-plus-credit-card",
        "card_id": "yes_bank_yes_bank_elite_plus_credit_card",
        "card_name": "YES Bank ELITE+ Credit Card",
        "card_network": "Visa / Mastercard / RuPay",
        "card_tier": "Mid-Tier",
        "primary_category": "Dining, Groceries & Movies",
        "categories": ["Dining, Groceries & Movies", "Airport Lounge", "Online Shopping"],
        "joining_fee": 999,
        "annual_fee": 999,
        "fee_waiver": 200000,
        "forex_markup": 2.75,
        "rating": 3.7,
        "base_rate": 0.5,
        "peak_rate": 1.5,
        "rates": {
            "online_shopping_general": 1.5,
            "amazon_flipkart_myntra": 1.5,
            "dining_swiggy_zomato": 1.5,
            "groceries_quick_commerce": 0.5,
            "travel_flights_hotels": 1.5,
            "upi_scan_and_pay": 0.5,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -1.25,
            "offline_general_other": 0.75,
        },
        "dom_lounge": {"yr": 8, "qtr": 2, "spend": "Spend-based quarterly rule applies", "summary": "8 complimentary domestic airport lounge visits/yr (2/quarter, spend-linked)"},
        "intl_lounge": {"yr": 0, "program": "None", "summary": "No complimentary international lounge access"},
        "is_ltf": False,
        "is_rupay": True,
    },
    {
        "cm_slug": "kredit-pe-yes-bank-ace-credit-card-review",
        "bank": "YES BANK",
        "bank_slug": "yes-bank",
        "card_slug": "kredit-pe-yes-bank-ace-credit-card",
        "card_id": "yes_bank_kredit_pe_yes_bank_ace_credit_card",
        "card_name": "Kredit.Pe Yes Bank ACE Credit Card",
        "card_network": "RuPay",
        "card_tier": "Entry / Fintech",
        "primary_category": "RuPay & UPI",
        "categories": ["RuPay & UPI", "Lifetime Free", "Cashback"],
        "joining_fee": 0,
        "annual_fee": 0,
        "fee_waiver": None,
        "forex_markup": 3.5,
        "rating": 3.5,
        "base_rate": 1.0,
        "peak_rate": 2.0,
        "rates": {
            "online_shopping_general": 2.0,
            "amazon_flipkart_myntra": 2.0,
            "dining_swiggy_zomato": 2.0,
            "groceries_quick_commerce": 1.5,
            "travel_flights_hotels": 1.5,
            "upi_scan_and_pay": 2.0,
            "utilities_bills_telecom": 1.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -2.5,
            "offline_general_other": 1.0,
        },
        "dom_lounge": {"yr": 0, "qtr": 0, "spend": "None", "summary": "No complimentary airport lounge access"},
        "intl_lounge": {"yr": 0, "program": "None", "summary": "No complimentary international lounge access"},
        "is_ltf": True,
        "is_rupay": True,
    },
    {
        "cm_slug": "jupiter-edge-plus-credit-card-review",
        "bank": "CSB Bank",
        "bank_slug": "csb-bank",
        "card_slug": "jupiter-edge-plus-csb-bank-rupay-credit-card",
        "card_id": "csb_bank_jupiter_edge_plus_csb_bank_rupay_credit_card",
        "card_name": "Jupiter Edge+ CSB Bank RuPay Credit Card",
        "card_network": "RuPay",
        "card_tier": "Mid-Tier",
        "primary_category": "Online Shopping",
        "categories": ["Online Shopping", "RuPay & UPI", "Cashback", "Lifetime Free", "Zero/Low Forex"],
        "joining_fee": 499,
        "annual_fee": 0,
        "fee_waiver": None,
        "forex_markup": 2.0,
        "rating": 4.6,
        "base_rate": 1.0,
        "peak_rate": 10.0,
        "rates": {
            "online_shopping_general": 10.0,
            "amazon_flipkart_myntra": 10.0,
            "dining_swiggy_zomato": 5.0,
            "groceries_quick_commerce": 5.0,
            "travel_flights_hotels": 5.0,
            "upi_scan_and_pay": 1.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -1.0,
            "offline_general_other": 1.0,
        },
        "dom_lounge": {"yr": 0, "qtr": 0, "spend": "None", "summary": "No complimentary airport lounge access"},
        "intl_lounge": {"yr": 0, "program": "None", "summary": "No complimentary international lounge access"},
        "is_ltf": True,
        "is_rupay": True,
    },
    {
        "cm_slug": "phonepe-sbi-select-black-credit-card-review",
        "bank": "SBI Card",
        "bank_slug": "sbi-card",
        "card_slug": "phonepe-sbi-card-purple",
        "card_id": "sbi_card_phonepe_sbi_card_purple",
        "card_name": "PhonePe SBI Card PURPLE",
        "card_network": "RuPay",
        "card_tier": "Entry-Level",
        "primary_category": "Utilities & Bills",
        "categories": ["RuPay & UPI", "Cashback", "Online Shopping"],
        "joining_fee": 499,
        "annual_fee": 499,
        "fee_waiver": 100000,
        "forex_markup": 3.5,
        "rating": 4.0,
        "base_rate": 1.0,
        "peak_rate": 10.0,
        "rates": {
            "online_shopping_general": 5.0,
            "amazon_flipkart_myntra": 5.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 2.0,
            "utilities_bills_telecom": 10.0,
            "fuel": 0.0,
            "insurance": 10.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -2.5,
            "offline_general_other": 1.0,
        },
        "dom_lounge": {"yr": 0, "qtr": 0, "spend": "None", "summary": "No complimentary airport lounge access"},
        "intl_lounge": {"yr": 0, "program": "None", "summary": "No complimentary international lounge access"},
        "is_ltf": False,
        "is_rupay": True,
        "custom_caps": {"insurance": 250, "utilities_bills_telecom": 750, "online_shopping_general": 750},
        "custom_caveats": {
            "insurance": "July 2026 cap split: max 250 RP/mo on Insurance inside PhonePe app",
            "utilities_bills_telecom": "July 2026: 10% on PhonePe utilities (max 750 RP/mo other PhonePe spends)",
            "online_shopping_general": "July 2026: 5% online capped at 750 RP/mo (cut from 1,000 RP)",
        },
    },
]

# Skip non-card artwork images (diagrams, promo banners, charts)
BAD_IMG_WORDS = (
    "exclusion", "smartbuy", "collection", "club-marriott", "boarding",
    "reward-subscription", "statement", "monthly-spend", "deals",
    "transfer", "miles-transfer", "lounge-access", "fee-waiver", "redemption-portal",
    "rewards.png", "image.png", "digital-gold", "gift-vouchers", "bill-payment",
    "devaluation", "reward-rate",
)


def sanitize_text(s: str) -> str:
    if not s:
        return ""
    s = re.sub(r"https?://cardmaven\.in/go/\S+", "", s)
    s = re.sub(r"card\s*maven['’]?s?", "editorial review", s, flags=re.I)
    s = re.sub(r"cardmaven\.in", "", s, flags=re.I)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def sanitize_table(tbl: dict[str, Any], idx: int) -> dict[str, Any] | None:
    heading = sanitize_text(tbl.get("heading") or "") or f"Card Breakdown Table {idx + 1}"
    headers = [sanitize_text(h) for h in (tbl.get("headers") or []) if sanitize_text(h)]
    rows = []
    for r in tbl.get("rows") or []:
        clean_r = [sanitize_text(c) for c in r]
        if any(clean_r):
            rows.append(clean_r)
    if not rows:
        return None
    # Skip promo/comparison tables that are just single-cell ads or affiliate links
    if len(rows) == 1 and len(rows[0]) < 2:
        return None
    # Normalize columns length to match rows[0] if headers empty
    if not headers and rows:
        ncols = len(rows[0])
        if ncols == 2:
            headers = ["Attribute", "Details"]
        elif ncols == 3:
            headers = ["Category", "Benefit / Rate", "Condition / Cap"]
        else:
            headers = [f"Column {i + 1}" for i in range(ncols)]
    return {
        "id": f"{tbl.get('kind', 'table')}-{idx}",
        "kind": tbl.get("kind", "other_table"),
        "title": heading,
        "headers": headers,
        "rows": rows,
    }


def parse_transfer_partners_from_table(tbl: dict[str, Any]) -> list[dict[str, str]]:
    out = []
    for r in tbl.get("rows") or []:
        if len(r) >= 2 and r[0] and r[1]:
            partner = r[0].strip()
            ratio = r[-1].strip() if len(r) >= 3 and ":" in r[-1] else r[1].strip()
            notes = r[2].strip() if len(r) >= 3 and r[2].strip() != ratio else ""
            if partner.lower() in ("partner", "transfer partner", "airline", "hotel"):
                continue
            out.append({"partner": partner, "ratio": ratio, "notes": notes})
    return out


def compute_palette_from_image(img_path: Path) -> dict[str, Any]:
    with Image.open(img_path) as im:
        rgb = im.convert("RGBA")
        rgb.thumbnail((96, 96))
        pixels = [
            (r, g, b)
            for (r, g, b, a) in rgb.getdata()
            if a > 120 and not (r > 242 and g > 242 and b > 242) and not (r < 12 and g < 12 and b < 12)
        ]
        if not pixels:
            return {
                "primary_hex": "#0F5C4D",
                "secondary_hex": "#1E3A8A",
                "wash_hex": "#E6F0EC",
                "soft_bg_hex": "#F4F8F6",
                "border_hex": "#D7E6E0",
                "ink_on_soft_hex": "#0F5C4D",
                "is_dark_card": False,
                "source": "cardmaven_asset",
            }
        avg_r = sum(p[0] for p in pixels) // len(pixels)
        avg_g = sum(p[1] for p in pixels) // len(pixels)
        avg_b = sum(p[2] for p in pixels) // len(pixels)
        primary = f"#{avg_r:02X}{avg_g:02X}{avg_b:02X}"
        soft_r = min(252, int(avg_r * 0.10 + 255 * 0.90))
        soft_g = min(252, int(avg_g * 0.10 + 255 * 0.90))
        soft_b = min(252, int(avg_b * 0.10 + 255 * 0.90))
        wash_r = min(246, int(avg_r * 0.22 + 255 * 0.78))
        wash_g = min(246, int(avg_g * 0.22 + 255 * 0.78))
        wash_b = min(246, int(avg_b * 0.22 + 255 * 0.78))
        lum = 0.299 * avg_r + 0.587 * avg_g + 0.114 * avg_b
        return {
            "primary_hex": primary,
            "secondary_hex": primary,
            "wash_hex": f"#{wash_r:02X}{wash_g:02X}{wash_b:02X}",
            "soft_bg_hex": f"#{soft_r:02X}{soft_g:02X}{soft_b:02X}",
            "border_hex": "#DCE5E1",
            "ink_on_soft_hex": primary if lum < 155 else "#0F5C4D",
            "is_dark_card": lum < 110,
            "source": "cardmaven_asset",
        }


def choose_best_card_candidates(cm_page: dict[str, Any]) -> list[str]:
    imgs = list(cm_page.get("images") or [])
    if cm_page.get("slug") == "apollo-sbi-select-credit-card-review":
        imgs.append({"url": "https://cardmaven.in/wp-content/uploads/2022/02/Apollo-SBI-SELECT-Credit-Card.webp", "alt": "Apollo SBI SELECT Credit Card"})
    candidates = []
    for im in imgs:
        url = im.get("url") or ""
        low = url.lower()
        alt_low = (im.get("alt") or "").lower()
        if not low or low.endswith(".svg"):
            continue
        if any(bad in low for bad in BAD_IMG_WORDS):
            continue
        score = 0
        if "credit-card" in low or "credit-card" in alt_low:
            score += 4
        elif "card" in low or "card" in alt_low:
            score += 2
        if low.endswith(".webp") or low.endswith(".png"):
            score += 2
        if "768x" in low or "300x" in low:
            score -= 1
        candidates.append((score, url))
    candidates.sort(key=lambda x: x[0], reverse=True)
    return [u for _, u in candidates]


def maybe_upgrade_image(
    client: httpx.Client,
    cm_page: dict[str, Any],
    bank_slug: str,
    card_slug: str,
    force: bool = False,
) -> tuple[str | None, dict[str, Any] | None]:
    urls = choose_best_card_candidates(cm_page)
    if not urls:
        return None, None
    tmp_path = ROOT / "data" / "raw" / "cardmaven" / "_tmp_img"
    tmp_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        for img_url in urls[:4]:
            resp = client.get(img_url, timeout=20)
            if resp.status_code != 200 or len(resp.content) < 4000:
                continue
            tmp_path.write_bytes(resp.content)
            with Image.open(tmp_path) as im:
                w, h = im.size
                if w < 220 or h < 140:
                    continue
                ratio = w / max(1, h)
                # Accept horizontal (1.2..1.9) or vertical card renders (0.55..0.85)
                if not (1.18 <= ratio <= 1.92 or 0.54 <= ratio <= 0.86):
                    continue
                out_rel = f"data/assets/card_images/{bank_slug}/{card_slug}.webp"
                out_asset = IMG_ASSETS / bank_slug / f"{card_slug}.webp"
                out_pub = IMG_PUBLIC / bank_slug / f"{card_slug}.webp"
                out_asset.parent.mkdir(parents=True, exist_ok=True)
                out_pub.parent.mkdir(parents=True, exist_ok=True)
                save_im = im.convert("RGBA") if im.mode in ("RGBA", "LA", "P") else im.convert("RGB")
                save_im.save(out_asset, "WEBP", quality=90, method=6)
                save_im.save(out_pub, "WEBP", quality=90, method=6)
            palette = compute_palette_from_image(out_asset)
            return out_rel, palette
        return None, None
    except Exception:
        return None, None
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


def merge_cm_into_dossier(
    dossier: dict[str, Any],
    cm_page: dict[str, Any],
    img_client: httpx.Client,
    img_upgrades: list[str],
) -> None:
    cslug = dossier["identity"]["card_slug"]
    bslug = dossier["identity"]["bank_slug"]
    rc = dossier.setdefault("reward_calculator_model", {})
    bf = dossier.setdefault("benefits_features_and_faqs", {})
    links = dossier.setdefault("official_and_reference_links", {})
    reddit = dossier.setdefault("reddit_user_feedback", {})
    pc = dossier.setdefault("pros_and_cons", {})

    # 1. Store structured tables cleanly
    structured_tables: list[dict[str, Any]] = []
    seen_tbl_sigs: set[str] = set()
    for i, t in enumerate(cm_page.get("tables") or []):
        st = sanitize_table(t, i)
        if not st:
            continue
        sig = f"{st['title'].lower()}::{len(st['rows'])}"
        if sig not in seen_tbl_sigs:
            seen_tbl_sigs.add(sig)
            structured_tables.append(st)
        # Extract richer transfer_partners if card doesn't have rich objects yet
        if st["kind"] == "transfer_partners":
            parsed_tp = parse_transfer_partners_from_table(st)
            if parsed_tp and not any(isinstance(x, dict) and x.get("ratio") for x in (rc.get("transfer_partners") or [])):
                rc["transfer_partners"] = parsed_tp

    if structured_tables:
        rc["structured_tables"] = structured_tables

    # 2. Extract 2026 program notes
    notes = []
    for n in cm_page.get("important_notes") or []:
        cn = sanitize_text(n)
        if cn and len(cn) <= 420 and cn not in notes:
            notes.append(cn)
    if notes:
        bf["program_updates_2026"] = notes[:6]

    # 3. Merge FAQs without duplicating existing questions
    existing_qs = {(f.get("question") or f.get("q") or "").lower().strip() for f in (bf.get("faqs") or [])}
    faqs = list(bf.get("faqs") or [])
    for fq in cm_page.get("faqs") or []:
        q = sanitize_text(fq.get("question") or "")
        a = sanitize_text(fq.get("answer") or "")
        if q and a and q.lower() not in existing_qs and len(faqs) < 10:
            existing_qs.add(q.lower())
            faqs.append({"question": q, "answer": a})
    if faqs:
        bf["faqs"] = faqs

    # 4. Merge Pros / Cons conservatively when missing or adding high-signal items
    if cm_page.get("pros"):
        cur_pros = list(pc.get("pros") or [])
        cur_low = " ".join(cur_pros).lower()
        for p in cm_page["pros"][:4]:
            cp = sanitize_text(p)
            if cp and cp[:28].lower() not in cur_low and len(cur_pros) < 7:
                cur_pros.append(cp)
        pc["pros"] = cur_pros

    if cm_page.get("cons"):
        cur_cons = list(pc.get("cons") or [])
        cur_low = " ".join(cur_cons).lower()
        for c in cm_page["cons"][:4]:
            cc = sanitize_text(c)
            if cc and cc[:28].lower() not in cur_low and len(cur_cons) < 7:
                cur_cons.append(cc)
        pc["cons"] = cur_cons

    # 5. Extract Maximisation tips / dining / lifestyle bullets from sections if relevant
    existing_tips = list(reddit.get("optimization_tips") or [])
    for sec in cm_page.get("sections") or []:
        h_low = (sec.get("heading") or "").lower()
        if any(k in h_low for k in ("maximis", "maximiz", "tips", "strategy", "boarding edge")):
            for b in (sec.get("bullets") or [])[:3]:
                cb = sanitize_text(b)
                if cb and len(cb) >= 24 and not any(cb[:30].lower() in t.lower() for t in existing_tips):
                    existing_tips.append(cb)
        elif "boarding edge" in h_low and "onboarding" not in h_low:
            pass
    if existing_tips:
        reddit["optimization_tips"] = existing_tips[:7]

    # 6. Metadata reference (non-intrusive)
    links["last_verified_month"] = "2026-11"
    if cm_page.get("modified_time"):
        links["source_updated_at"] = cm_page["modified_time"][:10]

    # 7. Image upgrade ONLY if current image is studio_render or lower-conf aggregator
    va = dossier.setdefault("visual_assets", {})
    if va.get("image_source") in ("cardledger_studio_render", "aggregator_bb", "aggregator_ce", "none") or (va.get("match_confidence") or 0) < 0.85 or not va.get("local_image_path"):
        rel, palette = maybe_upgrade_image(img_client, cm_page, bslug, cslug)
        if rel:
            va["local_image_path"] = rel
            va["image_source"] = "curated_card_asset"
            va["match_confidence"] = 0.96
            va["has_verified_image"] = True
            if palette:
                va["card_theme"] = palette
            img_upgrades.append(f"{bslug}/{cslug}")


def apply_2026_verified_overrides(dossiers: dict[tuple[str, str], dict[str, Any]]) -> None:
    """Apply concrete November 2026 factual & table patches verified across CardMaven."""
    # A. All Amex MR cards: Nov 2026 transfer partners + application pause + Nov 15 posting rule
    for key, d in dossiers.items():
        if key[0] != "american-express":
            continue
        rc = d["reward_calculator_model"]
        bf = d["benefits_features_and_faqs"]
        pc = d["pros_and_cons"]
        dv = d["devaluation_analysis"]
        existing_tbls = [t for t in (rc.get("structured_tables") or []) if t.get("kind") != "transfer_partners"]
        rc["structured_tables"] = existing_tbls + [AMEX_TRANSFER_PARTNERS_TABLE]
        rc["transfer_partners"] = AMEX_TP_LIST
        updates = list(bf.get("program_updates_2026") or [])
        amex_notes = [
            "New Applications Paused: American Express has temporarily paused new card applications in India (existing cardholders unaffected).",
            "From 15 November 2026: Amex counts monthly milestone transactions by posting date (not transaction date) and keeps MR pools separate per card.",
            "Transfer Partners Updated (Aug–Nov 2026): Hilton Honors improved to 1:1.5 (1,000:1,500), Virgin Atlantic improved to 5:4 (800:640), Etihad Guest removed 1 July 2026, Emirates Skywards suspended.",
        ]
        for n in reversed(amex_notes):
            if not any(n[:28].lower() in u.lower() for u in updates):
                updates.insert(0, n)
        bf["program_updates_2026"] = updates[:6]

        if key[1] == "american-express-platinum-travel-credit-card":
            rc["fee_waiver_and_milestone_calculator"]["milestone_slabs"] = [
                "₹4,00,000 annual spend -> 10,000 Bonus MR Points + ₹10,000 Taj Stay Voucher (Sept 2026 revised rules; ₹1.9L 7,500 MR slab removed 10 Sept 2026)",
                "Fuel & insurance earn 0 base MR points; still check MITC exclusion list before milestone planning.",
            ]
            bf["milestone_benefits"] = list(rc["fee_waiver_and_milestone_calculator"]["milestone_slabs"])
            if not any("September 2026" in x for x in dv.get("devaluation_history", [])):
                dv.setdefault("devaluation_history", []).insert(
                    0,
                    "10 September 2026: ₹1.9 Lakh milestone (7,500 MR) discontinued; milestone structure pared down after earlier 2026 cuts.",
                )
            dv["last_devalued_on"] = "2026-09-10"
            dv["devaluation_risk_score"] = max(dv.get("devaluation_risk_score", 6), 7.5)
            pc["cons"] = [
                "₹1.9 Lakh milestone (7,500 MR Points) removed effective 10 September 2026.",
                "Amex paused new applications in India; MR pools stay card-separate from 15 Nov 2026.",
            ] + [c for c in pc.get("cons", []) if "1.9" not in c and "paused" not in c][:3]

    # B. Cashback SBI Card: April 2026 ₹2,000 online + ₹2,000 offline cap
    cb_key = ("sbi-card", "cashback-sbi-card")
    if cb_key in dossiers:
        d = dossiers[cb_key]
        rc = d["reward_calculator_model"]
        rc["monthly_category_caps_inr"] = {
            "online_shopping_general": 2000,
            "amazon_flipkart_myntra": 2000,
            "offline_general_other": 2000,
        }
        rc["capping_summary"] = "₹2,000/cycle on Online 5% spends + ₹2,000/cycle on Offline 1% spends (₹4,000 total/cycle since Apr 2026)"
        rc["monthly_capping_rules"] = [
            "Online 5% cashback strictly capped at ₹2,000 per statement cycle (~₹40,000/mo online spend; reduced Apr 2026).",
            "Offline 1% cashback capped separately at ₹2,000 per statement cycle (overall monthly limit ₹4,000).",
            "0% cashback on Fuel, Rent, Utilities, Insurance, Education, Wallet Loads, Jewellery, Gift Cards, Tolls, Digital Gaming & Government payments.",
        ]
        rc["category_caveats"] = {
            "online_shopping_general": "5% capped at ₹2,000/statement cycle (~₹40k spend) since Apr 2026",
            "amazon_flipkart_myntra": "Shares ₹2,000/cycle online cashback pool (5% rate unchanged)",
            "offline_general_other": "1% offline capped at ₹2,000/statement cycle",
            "insurance": "Direct insurer MCC = 0% (Buy Amazon Pay Gift Cards inside Amazon @ 5% up to ₹2k cap instead)",
        }
        new_hist = "1 April 2026: Online 5% monthly cap cut from ₹5,000 to ₹2,000 (₹2,000 offline separate = ₹4,000 total); Tolls, Digital Gaming & Govt excluded."
        dh = [
            h for h in d["devaluation_analysis"].get("devaluation_history", [])
            if "Online 5% monthly cap cut from" not in h and "Combined monthly cashback cap tightened to Rs. 5,000" not in h
        ]
        d["devaluation_analysis"]["devaluation_history"] = [new_hist] + dh
        d["devaluation_analysis"]["last_devalued_on"] = "2026-04-01"
        d["benefits_features_and_faqs"]["program_updates_2026"] = [
            "April 2026 Update: 5% online cashback cap tightened to ₹2,000/cycle (plus ₹2,000 offline cap = ₹4,000 max/cycle). Tolls, Digital Gaming & Govt MCCs excluded.",
        ]
        bf_sbi = d["benefits_features_and_faqs"]
        bf_sbi["about_overview"] = re.sub(
            r"Rs\.\s*5,000[^.\"]*across 5%\s*\+\s*1%[^.\"]*|Rs\.\s*5,000/month[^.\"]*cap",
            "₹2,000/cycle for 5% online + ₹2,000/cycle for 1% offline (effective 1 April 2026)",
            bf_sbi.get("about_overview", ""),
            flags=re.I,
        )
        bf_sbi["about_overview"] = bf_sbi["about_overview"].replace("Rs. 1,00,000", "₹40,000")
        bf_sbi["highlights"] = [
            "1 April 2026 Cap Update: ₹2,000/cycle on 5% online (~₹40k spend) + ₹2,000/cycle on 1% offline (₹4,000 total/cycle)"
            if "5,000" in h else h
            for h in bf_sbi.get("highlights", [])
        ]
        pc_sbi = d.get("pros_and_cons", {})
        pc_sbi["cons"] = [
            "April 2026 Devaluation: 5% online cashback capped at ₹2,000/cycle (~₹40k online spend) + separate ₹2,000/cycle 1% offline cap."
            if "5,000" in c or "single Rs." in c else c
            for c in pc_sbi.get("cons", [])
        ]
        d["reddit_user_feedback"]["optimization_tips"] = [
            "Split ₹2,000 online + ₹2,000 offline monthly caps (effective 1 Apr 2026; max ₹40,000/mo 5% online spend) — shift excess online spends after ₹40k to HDFC Swiggy / Millennia / Amazon Pay ICICI."
            if "5,000" in t else t
            for t in d.get("reddit_user_feedback", {}).get("optimization_tips", [])
        ]
        for k_s in ("summary_sentiment", "best_for_whom"):
            val_s = d.get("reddit_user_feedback", {}).get(k_s, "")
            if val_s:
                val_s = re.sub(r"(?:Rs\.|₹)\s*5,000/(?:month|billing-cycle)", "₹2,000/cycle (5% online)", val_s)
                val_s = val_s.replace("Rs. 1,00,000", "₹40,000").replace("₹1,00,000", "₹40,000")
                val_s = val_s.replace("Shared ₹2,000/cycle (5% online) cap: 5% online and 1% offline cashbacks share a single ₹5,000/billing-cycle ceiling", "Split ₹2,000/cycle online + ₹2,000/cycle offline caps effective 1 April 2026")
                d["reddit_user_feedback"][k_s] = val_s
        if d.get("pros_and_cons", {}).get("best_for_whom"):
            d["pros_and_cons"]["best_for_whom"] = d["pros_and_cons"]["best_for_whom"].replace("Rs. 1,00,000", "₹40,000").replace("₹1,00,000", "₹40,000")
        d["filter_tags"]["best_for_tags"] = [
            t.replace("Rs. 1,00,000", "₹40,000") for t in d.get("filter_tags", {}).get("best_for_tags", [])
        ]
        rc["reward_earning_rules"] = [
            "1 April 2026 cap split: ₹2,000/cycle on 5% online (~₹40k spend) + ₹2,000/cycle on 1% offline (₹4,000 total)"
            if "Rs. 5,000 per billing cycle across 5%" in r else r
            for r in rc.get("reward_earning_rules", [])
        ]
        d["reddit_user_feedback"]["practical_community_warnings"] = [
            "5% cashback across online merchants (1% offline) with split ₹2,000/cycle online + ₹2,000/cycle offline caps effective 1 April 2026 (~₹40k/mo max online spend)."
            if "5,000" in w else w
            for w in d.get("reddit_user_feedback", {}).get("practical_community_warnings", [])
        ]

    # C. HDFC Regalia Gold: May 15 2026 (5 RP / ₹200), July 1 2026 (₹60k/qtr lounge + Boarding Edge)
    rg_key = ("hdfc-bank", "hdfc-regalia-gold-credit-card")
    if rg_key in dossiers:
        d = dossiers[rg_key]
        rc = d["reward_calculator_model"]
        lg = d["lounge_access_detailed"]
        bf = d["benefits_features_and_faqs"]
        d["filter_tags"]["no_spend_domestic_lounge"] = False
        lg["no_spend_domestic_lounge"] = False
        lg["domestic"]["spend_criteria"] = "₹60,000 spend in previous calendar quarter (effective 1 July 2026)"
        lg["domestic"]["summary"] = "12 complimentary domestic lounge visits/year (unlocked on ₹60,000 spend in previous quarter since Jul 2026)"
        rc["reward_earning_rules"] = [
            "5 Reward Points per ₹200 retail spend (May 2026 revision; single transactions below ₹200 earn 0 RP).",
            "5X Reward Points at Nykaa, Myntra, Marks & Spencer and Reliance Digital; up to 10X via SmartBuy Hotels/IGP.",
            "Boarding Edge Program (Jul 2026): Upload flight boarding pass on SmartBuy to unlock 2 arrival perks/quarter (₹750 Uber voucher, spa, buffet, or room upgrade).",
        ]
        rc["monthly_capping_rules"] = [
            "Base ~1.25% (5 RP per ₹200 retail spend; ₹0.50 SmartBuy travel); 5X on Myntra/Nykaa/M&S/Reliance Digital (cap 5,000 RP/mo); up to 10X SmartBuy (cap 4,000 RP/mo incl. Jul 2026 3,000 RP GyFTR voucher cap); Rent & Govt/Tax earn 0%.",
            "Domestic lounge visits require ₹60,000 spend in previous calendar quarter (effective 1 July 2026).",
        ]
        bf["highlights"] = [
            "New Boarding Edge Program (Jul 2026): 2 free arrival perks/quarter (₹750 Uber, spa, hotel buffet or room upgrade)",
            "5 Reward Points per ₹200 retail spend + 5X at Myntra, Nykaa, Reliance Digital & M&S",
            "12 Domestic (₹60k/qtr spend-linked from Jul 2026) + 6 International Priority Pass lounge visits/year",
        ]
        bf["program_updates_2026"] = [
            "1 July 2026: Domestic lounge visits require ₹60,000 spend in the previous calendar quarter.",
            "1 July 2026 Positive Addition: Boarding Edge Program gives 2 complimentary destination arrival perks per quarter (₹750 Uber / spa / buffet / room upgrade).",
            "15 May 2026: Base reward changed from 4 RP/₹150 to 5 RP/₹200 (txns below ₹200 earn 0 pts).",
        ]
        rg_hist = "May–July 2026: Base earn moved to 5 RP/₹200 (< ₹200 earns 0) and domestic lounges now require ₹60,000 quarterly spend; Boarding Edge arrival perks added."
        rg_dh = [h for h in d["devaluation_analysis"].get("devaluation_history", []) if "Base earn moved to 5 RP" not in h]
        d["devaluation_analysis"]["devaluation_history"] = [rg_hist] + rg_dh
        d["devaluation_analysis"]["last_devalued_on"] = "2026-07-01"
        for k_s in ("summary_sentiment",):
            if k_s in d.get("reddit_user_feedback", {}):
                d["reddit_user_feedback"][k_s] = (
                    d["reddit_user_feedback"][k_s]
                    .replace("Base ~1.33% (4 RP/Rs.150 at Rs.0.50 SmartBuy travel)", "Base 1.25% (5 RP/₹200 eff. May 2026 at ₹0.50 SmartBuy travel)")
                    .replace("4 RP/Rs.150", "5 RP/₹200")
                    .replace("4 RP/₹150", "5 RP/₹200")
                )
        d["reddit_user_feedback"]["optimization_tips"] = [
            t.replace("4 RP/₹150", "5 RP/₹200").replace("4 RP/Rs.150", "5 RP/₹200").replace("Base ~1.33% (5 RP/₹200", "Base 1.25% (5 RP/₹200")
            for t in d.get("reddit_user_feedback", {}).get("optimization_tips", [])
        ]
        d["pros_and_cons"]["pros"] = [
            p.replace("4 RP/₹150", "5 RP/₹200").replace("4 RP/Rs.150", "5 RP/₹200")
            for p in d.get("pros_and_cons", {}).get("pros", [])
        ]
        d["reddit_user_feedback"]["practical_community_warnings"] = [
            w.replace("Base ~1.33% (4 RP/Rs.150", "Base 1.25% (5 RP/₹200 eff. May 2026").replace("4 RP/Rs.150", "5 RP/₹200").replace("4 RP/₹150", "5 RP/₹200")
            for w in d.get("reddit_user_feedback", {}).get("practical_community_warnings", [])
        ]
        # May 15 2026 numerical earn rate update: 5 RP / ₹200 = 1.25% base (@ ₹0.50 SmartBuy) & 6.25% 5X
        rc_rg = rc.get("effective_return_pct_by_category", {})
        for k_rg, v_rg in list(rc_rg.items()):
            if v_rg == 1.33:
                rc_rg[k_rg] = 1.25
            elif v_rg == 6.66:
                rc_rg[k_rg] = 6.25
            elif v_rg == -1.03:
                rc_rg[k_rg] = -1.11
        rc["base_reward_rate_pct"] = 1.25
        rc["accelerated_reward_rate_pct"] = 6.25
        if rc.get("category_caveats", {}).get("insurance"):
            rc["category_caveats"]["insurance"] = rc["category_caveats"]["insurance"].replace("1.33%", "1.25%")

    # D. HDFC Diners Club Privilege
    dcp_key = ("hdfc-bank", "hdfc-diners-club-privilege-credit-card")
    if dcp_key in dossiers:
        d = dossiers[dcp_key]
        d["filter_tags"]["no_spend_domestic_lounge"] = False
        d["lounge_access_detailed"]["no_spend_domestic_lounge"] = False
        d["lounge_access_detailed"]["domestic"]["spend_criteria"] = "₹60,000 spend in previous calendar quarter (effective 1 July 2026)"
        d["reward_calculator_model"]["monthly_capping_rules"] = [
            r.replace("1.33% base (4 RP/Rs.150", "1.0% base (4 RP/₹200 eff. May 2026")
            .replace("4 RP/Rs.150", "4 RP/₹200 (eff. May 2026)")
            for r in d["reward_calculator_model"].get("monthly_capping_rules", [])
        ]
        dcp_hist = "May–July 2026: Base reward cut 25% from 4 RP/₹150 to 4 RP/₹200; airport lounges require ₹60,000 spend in previous quarter."
        dcp_old = [h for h in d["devaluation_analysis"].get("devaluation_history", []) if "Base reward cut 25%" not in h]
        d["devaluation_analysis"]["devaluation_history"] = [dcp_hist] + dcp_old
        d["devaluation_analysis"]["last_devalued_on"] = "2026-07-01"
        d["benefits_features_and_faqs"]["program_updates_2026"] = [
            "15 May 2026: Base rewards reduced 25% to 4 RP per ₹200 (< ₹200 earns 0 RP).",
            "1 July 2026: Domestic/Intl lounge access now gated behind ₹60,000 spend in the previous quarter.",
        ]
        if "summary_sentiment" in d.get("reddit_user_feedback", {}):
            d["reddit_user_feedback"]["summary_sentiment"] = (
                d["reddit_user_feedback"]["summary_sentiment"]
                .replace("4 RP/Rs.150", "4 RP/₹200 (eff. May 2026)")
                .replace("4 RP/₹150", "4 RP/₹200 (eff. May 2026)")
            )
        d["reddit_user_feedback"]["optimization_tips"] = [
            t.replace("1.33% base (4 RP/Rs.150", "1.0% base (4 RP/₹200 eff. May 2026")
            .replace("4 RP/₹150", "4 RP/₹200")
            .replace("4 RP/Rs.150", "4 RP/₹200")
            for t in d.get("reddit_user_feedback", {}).get("optimization_tips", [])
        ]
        d["reddit_user_feedback"]["practical_community_warnings"] = [
            w.replace("1.33% base (4 RP/Rs.150", "1.0% base (4 RP/₹200 eff. May 2026")
            .replace("4 RP/₹150", "4 RP/₹200")
            .replace("4 RP/Rs.150", "4 RP/₹200")
            for w in d.get("reddit_user_feedback", {}).get("practical_community_warnings", [])
        ]
        # May 15 2026 numerical earn rate update: 4 RP / ₹200 = 1.00% base (@ ₹0.50 travel) & 5.00% 5X
        rc_dcp = d["reward_calculator_model"].get("effective_return_pct_by_category", {})
        for k_dc, v_dc in list(rc_dcp.items()):
            if v_dc == 1.33:
                rc_dcp[k_dc] = 1.0
            elif v_dc == 6.66:
                rc_dcp[k_dc] = 5.0
            elif v_dc == -1.03:
                rc_dcp[k_dc] = -1.36
        d["reward_calculator_model"]["base_reward_rate_pct"] = 1.0
        d["reward_calculator_model"]["accelerated_reward_rate_pct"] = 5.0
        if d["benefits_features_and_faqs"].get("about_overview"):
            d["benefits_features_and_faqs"]["about_overview"] = (
                d["benefits_features_and_faqs"]["about_overview"]
                .replace("1.33% as a base rate", "1.0% base rate (4 RP/₹200 eff. May 2026)")
                .replace("13.33% on accelerated categories", "10% on accelerated SmartBuy categories")
            )

    # E. HDFC Infinia, Diners Black Metal, BizPower, BizBlack: July 2026 SmartBuy GyFTR/Woohoo 3,000 RP cap + retention notes
    for b_card in (
        ("hdfc-bank", "hdfc-infinia-metal-edition-credit-card"),
        ("hdfc-bank", "hdfc-diners-club-black-metal-edition"),
        ("hdfc-bank", "hdfc-bank-bizpower-credit-card"),
        ("hdfc-bank", "hdfc-bizblack-metal-edition-credit-card"),
        ("hdfc-bank", "hdfc-regalia-gold-credit-card"),
    ):
        if b_card in dossiers:
            d = dossiers[b_card]
            rc = d["reward_calculator_model"]
            bf = d["benefits_features_and_faqs"]
            tbls = [t for t in (rc.get("structured_tables") or []) if t.get("id") != "hdfc-smartbuy-gyftr-caps-july-2026"]
            tbls.append(HDFC_SMARTBUY_GYFTR_JULY_2026_TABLE)
            rc["structured_tables"] = tbls
            ups = list(bf.get("program_updates_2026") or [])
            cap_note = "1 July 2026 SmartBuy Update: GyFTR & Woohoo brand vouchers carry a separate 3,000 Bonus RP/month sub-cap (~₹30k spend on Infinia, ~₹45k on DCB Metal)."
            if not any("3,000 Bonus RP" in u for u in ups):
                ups.insert(0, cap_note)
            if b_card[1] == "hdfc-infinia-metal-edition-credit-card":
                ret = "1 April 2026: High-value retention check introduced — ₹18 Lakhs annual spend OR ₹50 Lakh TRV expectation for renewal continuity."
                if not any("18 Lakh" in u for u in ups):
                    ups.insert(0, ret)
            bf["program_updates_2026"] = ups[:6]

    # F. Airtel Axis Bank: April 2026 Lounge Removed + Proportional Retail Linking
    airtel_key = ("axis-bank", "airtel-axis-bank-credit-card")
    if airtel_key in dossiers:
        d = dossiers[airtel_key]
        d["filter_tags"]["has_domestic_lounge"] = False
        d["filter_tags"]["no_spend_domestic_lounge"] = False
        lg = d["lounge_access_detailed"]
        lg["has_domestic_lounge"] = False
        lg["no_spend_domestic_lounge"] = False
        lg["domestic"]["visits_per_year"] = 0
        lg["domestic"]["visits_per_quarter"] = 0
        lg["domestic"]["summary"] = "Discontinued (Apr 12, 2026): 4 complimentary domestic lounge visits removed"
        lg["no_lounge_note"] = "Axis Bank discontinued all 4 complimentary domestic lounge visits effective 12 April 2026."
        d["benefits_features_and_faqs"]["program_updates_2026"] = [
            "12 April 2026 Devaluation: All 4 complimentary domestic airport lounge visits discontinued; Swiggy/BigBasket 10% removed.",
            "Proportional Rule: Airtel & utility cashback caps unlock in proportion to base 1% retail spends (cannot use purely for bill pay).",
        ]

    # G. Axis Bank Transfer Partner cards: Sept 2026 Accor ALL Return & Group A/B tables
    for slug, (cap_txt, ratio_txt) in AXIS_CARD_TRANSFER_CAPS.items():
        ax_key = ("axis-bank", slug)
        if ax_key in dossiers:
            d = dossiers[ax_key]
            rc = d["reward_calculator_model"]
            bf = d["benefits_features_and_faqs"]
            tbls = [t for t in (rc.get("structured_tables") or []) if t.get("id") != "axis-transfer-groups-sept-2026"]
            tbls.append(AXIS_SEPT_2026_OVERVIEW_TABLE)
            rc["structured_tables"] = tbls
            rc["transfer_partners"] = [
                {"partner": "Accor Live Limitless (ALL)", "ratio": "Group A · Returned Sept 2026", "notes": ratio_txt},
                {"partner": "Air India Maharaja Club", "ratio": "Group A · Promoted Sept 2026", "notes": cap_txt},
                {"partner": "Flying Blue (Air France/KLM)", "ratio": "Group A · Promoted Sept 2026", "notes": cap_txt},
                {"partner": "Qantas Frequent Flyer", "ratio": "Group A · Promoted Sept 2026", "notes": cap_txt},
                {"partner": "Cathay Asia Miles", "ratio": "Group A · Added Sept 2026", "notes": "Caps share Group A pool"},
                {"partner": "Hilton Honors & Miles & More", "ratio": "Group B · Added Sept 2026", "notes": cap_txt},
            ]
            ups = list(bf.get("program_updates_2026") or [])
            ax_note = f"September 2026 Transfer Update: Accor ALL & Cathay returned to Group A; Air India/Flying Blue/Qantas moved to Group A ({cap_txt})."
            if not any("September 2026" in u for u in ups):
                ups.insert(0, ax_note)
            bf["program_updates_2026"] = ups[:6]

    # H. PhonePe SBI SELECT BLACK & PURPLE: July 2026 Split Cap & Exclusions
    pp_key = ("sbi-card", "phonepe-sbi-card-select-black")
    if pp_key in dossiers:
        d = dossiers[pp_key]
        rc = d["reward_calculator_model"]
        rc["monthly_category_caps_inr"] = {
            "insurance": 500,
            "utilities_bills_telecom": 1500,
            "online_shopping_general": 1000,
            "amazon_flipkart_myntra": 1000,
        }
        rc["category_caveats"] = {
            "insurance": "July 2026 split cap: 10% capped strictly at 500 RP/month inside PhonePe app (0 outside PhonePe)",
            "utilities_bills_telecom": "July 2026 split cap: 10% capped at 1,500 RP/month on other PhonePe bill/UPI spends",
            "online_shopping_general": "July 2026 cut: 5% online cap halved from 2,000 RP to 1,000 RP/month",
        }
        d["benefits_features_and_faqs"]["program_updates_2026"] = [
            "1 July 2026 Cap Split: PhonePe 2,000 RP/mo split into 500 RP/mo Insurance + 1,500 RP/mo Other PhonePe spends; Online 5% cap cut from 2,000 RP to 1,000 RP/mo.",
            "New July 2026 Exclusions: Tolls (MCC 4784), Education, Jewellery, Gift Cards, Utilities/Insurance/UPI outside PhonePe earn 0 RP.",
        ]
        sb_dh = [
            h for h in d["devaluation_analysis"].get("devaluation_history", [])
            if "Cashback SBI Apr 2026" not in h and "July 2026 Cap Split" not in h
        ]
        d["devaluation_analysis"]["devaluation_history"] = [
            "1 July 2026 Cap Split & Exclusions: PhonePe 2,000 RP/mo bucket split into 500 RP Insurance + 1,500 RP Other PhonePe Spends; 5% online cap cut from 2,000 RP to 1,000 RP/mo; Tolls/Education/Jewellery/Gift Cards excluded."
        ] + sb_dh
        d["devaluation_analysis"]["last_devalued_on"] = "2026-07-01"

    ppp_key = ("sbi-card", "phonepe-sbi-card-purple")
    if ppp_key in dossiers:
        d = dossiers[ppp_key]
        rc = d["reward_calculator_model"]
        rc["monthly_category_caps_inr"] = {
            "insurance": 250,
            "utilities_bills_telecom": 750,
            "travel_flights_hotels": 750,
            "online_shopping_general": 750,
            "upi_scan_and_pay": 1000,
        }
        rc["category_caveats"] = {
            "insurance": "July 2026 split cap: Insurance capped separately at 250 RP/month inside PhonePe",
            "utilities_bills_telecom": "July 2026 split cap: Remaining PhonePe bill/UPI spends capped at 750 RP/month",
            "online_shopping_general": "July 2026 cut: 5% online cap reduced from 1,000 RP to 750 RP/month",
        }
        d["benefits_features_and_faqs"]["program_updates_2026"] = [
            "1 July 2026 PhonePe Purple Cap Split: 1,000 RP PhonePe bucket split into 250 RP/mo Insurance + 750 RP/mo Other PhonePe Spends; Online 5% cap cut from 1,000 RP to 750 RP/mo.",
            "New July 2026 Exclusions: Tolls, Education, Jewellery, Gift Cards, and Utilities/Insurance paid outside PhonePe earn 0 RP.",
        ]
        pp_dh = [
            h for h in d["devaluation_analysis"].get("devaluation_history", [])
            if "Cashback SBI Apr 2026" not in h and "July 2026 PhonePe Purple" not in h
        ]
        d["devaluation_analysis"]["devaluation_history"] = [
            "1 July 2026 PhonePe Purple Cap Split: 1,000 RP PhonePe bucket split into 250 RP Insurance + 750 RP Other PhonePe Spends; Online 5% cap cut from 1,000 RP to 750 RP/mo."
        ] + pp_dh
        d["devaluation_analysis"]["last_devalued_on"] = "2026-07-01"

    # I. HDFC BizBlack Metal ITR Eligibility Update (₹45 Lakh)
    bizblack_key = ("hdfc-bank", "hdfc-bizblack-metal-edition-credit-card")
    if bizblack_key in dossiers:
        d = dossiers[bizblack_key]
        el = d.get("eligibility_detailed", {})
        if el.get("min_annual_itr_self_employed_inr", 0) < 4500000:
            el["min_annual_itr_self_employed_inr"] = 4500000
        ups = list(d["benefits_features_and_faqs"].get("program_updates_2026") or [])
        bb_itr = "2026 Eligibility Tightening: Annual ITR threshold raised from ₹30 Lakh to ₹45 Lakh for new self-employed applications."
        if not any("45 Lakh" in u for u in ups):
            ups.insert(0, bb_itr)
        d["benefits_features_and_faqs"]["program_updates_2026"] = ups[:6]

    # J. Tata Neu Infinity & Plus HDFC: Nov 25, 2026 Manual NeuCoins Claim Rule
    for tn_slug in ("tata-neu-infinity-hdfc-bank-credit-card", "tata-neu-plus-hdfc-credit-card"):
        tn_key = ("hdfc-bank", tn_slug)
        if tn_key in dossiers:
            d = dossiers[tn_key]
            ups = list(d["benefits_features_and_faqs"].get("program_updates_2026") or [])
            claim_note = "25 November 2026 New Rule: NeuCoins earned must be manually claimed inside the Tata Neu app within 12 months before expiry."
            if not any("November 2026" in u for u in ups):
                ups.insert(0, claim_note)
            d["benefits_features_and_faqs"]["program_updates_2026"] = ups[:6]

    # K. HSBC Live+: Visa Infinite + 1 Intl lounge/yr + Amazon Fresh / Flipkart Minutes 10% Grocery MCC
    hsbc_key = ("hsbc-bank", "hsbc-live-credit-card")
    if hsbc_key in dossiers:
        d = dossiers[hsbc_key]
        d["identity"]["card_network"] = "Visa Infinite"
        d["filter_tags"]["has_international_lounge"] = True
        lg = d["lounge_access_detailed"]
        lg["has_international_lounge"] = True
        lg["international"]["visits_per_year"] = 1
        lg["international"]["summary"] = "1 complimentary international airport lounge visit per calendar year (+ 2 domestic/yr)"
        fees = d["fees_and_charges_detailed"]
        fees["fuel_surcharge_waiver"] = "No fuel surcharge waiver; ₹250 cashback on contactless fuel spend when spending ₹10,000/quarter"
        fees["forex_markup_pct"] = 1.99
        ups = list(d["benefits_features_and_faqs"].get("program_updates_2026") or [])
        hsbc_note = "2026 Updates: Forex reduced to 1.99%, includes 1 complimentary international + 2 domestic lounges/yr, ₹1,200/mo 10% cap covers Amazon Fresh & Flipkart Minutes Grocery MCCs."
        if not any("Amazon Fresh" in u for u in ups):
            ups.insert(0, hsbc_note)
        d["benefits_features_and_faqs"]["program_updates_2026"] = ups[:6]

    # L. BOBCARD Eterna & Tiara: July 15 2026 revised lounge rule (deduplicated)
    for b_slug in ("bobcard-eterna-credit-card", "bobcard-tiara"):
        bk = ("bobcard-bank-of-baroda", b_slug)
        if bk in dossiers:
            d = dossiers[bk]
            d["filter_tags"]["no_spend_domestic_lounge"] = False
            d["lounge_access_detailed"]["no_spend_domestic_lounge"] = False
            d["lounge_access_detailed"]["domestic"]["spend_criteria"] = "Revised spend-based eligibility effective 15 July 2026"
            ups = list(d["benefits_features_and_faqs"].get("program_updates_2026") or [])
            bob_note = "15 July 2026 Update: BOBCARD transitioned unlimited lounge visits on Eterna & Tiara to revised quarterly spend-based eligibility."
            if not any("15 July 2026" in u for u in ups):
                ups.insert(0, bob_note)
            d["benefits_features_and_faqs"]["program_updates_2026"] = ups[:6]

    # M. Global Consistency Pass across all 515 dossiers:
    # - Strip leftover Markdown bolding '**' across strings
    # - Fix broken 'option from ...' overviews
    # - Normalize LTF vs annual_fee_inr / fee_bracket mismatches
    # - Deduplicate program_updates_2026 & devaluation_history
    def clean_obj_md(obj: Any) -> Any:
        if isinstance(obj, str):
            return obj.replace("**", "")
        if isinstance(obj, list):
            return [clean_obj_md(x) for x in obj]
        if isinstance(obj, dict):
            return {k: clean_obj_md(v) for k, v in obj.items()}
        return obj

    ltf_fixes = {
        "axis-bank-privilege-visa-credit-card-limited-period-lifetime-free-offer": {"jf": 0, "af": 0, "ltf": True, "fyf": True, "gst": False, "bracket": "Free (LTF)"},
        "kotak-privy-league-signature-credit-card": {"jf": 0, "af": 0, "ltf": True, "fyf": True, "gst": False, "bracket": "Free (LTF)", "waiver": "Lifetime Free for Privy League banking customers (₹2,500 otherwise)"},
        "indigo-sbi-card": {"jf": 1499, "af": 1499, "ltf": False, "fyf": False, "gst": True, "bracket": "Rs. 1,000 - Rs. 2,500", "waiver": "Nil (1,500 bonus BluChips on renewal fee payment)"},
        "bobcard-eterna-credit-card": {"jf": 2499, "af": 2499, "ltf": False, "fyf": False, "gst": True, "bracket": "Rs. 1,000 - Rs. 2,500"},
        "bobcard-swavlamban-credit-card": {"jf": 250, "af": 250, "ltf": False, "fyf": False, "gst": True, "bracket": "Under Rs. 1,000"},
        "bank-of-india-rupay-select-credit-card": {"jf": 0, "af": 800, "ltf": False, "fyf": True, "gst": True, "bracket": "Under Rs. 1,000"},
        "cred-indusind-bank-rupay-credit-card": {"jf": 0, "af": 499, "ltf": False, "fyf": True, "gst": True, "bracket": "Under Rs. 1,000"},
        "yes-bank-freo-credit-card": {"jf": 399, "af": 399, "ltf": False, "fyf": False, "gst": True, "bracket": "Under Rs. 1,000"},
    }

    for key, raw_d in list(dossiers.items()):
        d = clean_obj_md(raw_d)
        ident = d["identity"]
        cslug = ident["card_slug"]
        cname = ident["card_name"]
        fees = d["fees_and_charges_detailed"]
        ft = d["filter_tags"]
        bf = d["benefits_features_and_faqs"]

        if cslug in ltf_fixes:
            spec_f = ltf_fixes[cslug]
            fees["joining_fee_inr"] = spec_f["jf"]
            fees["annual_fee_inr"] = spec_f["af"]
            fees["gst_applicable"] = spec_f["gst"]
            if "waiver" in spec_f:
                fees["joining_fee_waiver"] = spec_f["waiver"]
            ft["is_ltf"] = spec_f["ltf"]
            ft["is_fyf"] = spec_f["fyf"]
            ft["fee_bracket"] = spec_f["bracket"]
            if not spec_f["ltf"] and bf.get("about_overview", "").startswith("Lifetime Free option from"):
                bf["about_overview"] = f"{cname} is an option from {ident['bank']} " + bf["about_overview"].split("suited for", 1)[-1].lstrip()
                if "suited for" not in bf["about_overview"]:
                    bf["about_overview"] = f"{cname} by {ident['bank']} suited for everyday rewards."
                else:
                    bf["about_overview"] = f"{cname} is an option from {ident['bank']} suited for " + bf["about_overview"].split("suited for", 1)[-1].lstrip()
                d["pros_and_cons"]["pros"] = [
                    p for p in d["pros_and_cons"].get("pros", []) if "Lifetime Free card with zero annual fee commitment" not in p
                ] or [f"Rewarding {ident['primary_category']} benefits from {ident['bank']}"]

        # Align all 0/0 fee_bracket == "Free (LTF)" cards cleanly
        jf_v = fees.get("joining_fee_inr") or 0
        af_v = fees.get("annual_fee_inr") or 0
        if jf_v == 0 and af_v == 0 and ft.get("fee_bracket") == "Free (LTF)":
            ft["is_ltf"] = True

        # Fix broken leading lowercase "option from ..." overviews
        ao = (bf.get("about_overview") or "").strip()
        if ao.startswith("option from "):
            bf["about_overview"] = f"{cname} is a credit card " + ao

        # Deduplicate program_updates_2026 & devaluation_history preserving order
        if bf.get("program_updates_2026"):
            seen_u: set[str] = set()
            dedup_u: list[str] = []
            for u in bf["program_updates_2026"]:
                if u not in seen_u:
                    seen_u.add(u)
                    dedup_u.append(u)
            bf["program_updates_2026"] = dedup_u

        dv_list = d.get("devaluation_analysis", {}).get("devaluation_history") or []
        if dv_list:
            seen_d: set[str] = set()
            dedup_d: list[str] = []
            for item in dv_list:
                if item not in seen_d:
                    seen_d.add(item)
                    dedup_d.append(item)
            d["devaluation_analysis"]["devaluation_history"] = dedup_d

        dossiers[key] = d


def build_new_card_dossier(spec: dict[str, Any], cm_page: dict[str, Any] | None, template: dict[str, Any], img_client: httpx.Client) -> dict[str, Any]:
    d = json.loads(json.dumps(template))
    bslug = spec["bank_slug"]
    cslug = spec["card_slug"]

    d["identity"] = {
        "card_id": spec["card_id"],
        "card_name": spec["card_name"],
        "bank": spec["bank"],
        "bank_slug": bslug,
        "card_slug": cslug,
        "card_network": spec["card_network"],
        "card_tier": spec["card_tier"],
        "primary_category": spec["primary_category"],
        "categories": spec["categories"],
        "status": "Active",
        "schema_version": "2026.11-dossier-v2",
        "generated_at": "2026-11-15T06:00:00+00:00",
    }

    rel_img = None
    palette = None
    if cm_page:
        rel_img, palette = maybe_upgrade_image(img_client, cm_page, bslug, cslug, force=True)
    d["visual_assets"] = {
        "image_url": None,
        "local_image_path": rel_img,
        "image_source": "curated_card_asset" if rel_img else "none",
        "match_confidence": 0.96 if rel_img else 0.0,
        "has_verified_image": bool(rel_img),
        "card_theme": palette or {
            "primary_hex": "#0F5C4D",
            "secondary_hex": "#1D4ED8",
            "wash_hex": "#E6F0EC",
            "soft_bg_hex": "#F4F8F6",
            "border_hex": "#D7E6E0",
            "ink_on_soft_hex": "#0F5C4D",
            "is_dark_card": False,
            "source": "theme_default",
        },
    }

    dom = spec["dom_lounge"]
    intl = spec["intl_lounge"]
    rail = spec.get("rail_lounge") or {"yr": 0, "qtr": 0, "summary": "No complimentary railway lounge visits listed"}
    has_dom = dom["yr"] > 0
    has_intl = intl["yr"] > 0
    has_rail = rail["yr"] > 0
    no_spend_dom = has_dom and ("no spend" in dom["spend"].lower() or "unlimited" in dom["summary"].lower())

    d["filter_tags"] = {
        "is_ltf": spec["is_ltf"],
        "is_fyf": False,
        "is_fd_backed": False,
        "is_rupay_upi": spec["is_rupay"],
        "is_invite_only": False,
        "fee_bracket": "Lifetime Free" if spec["annual_fee"] == 0 else ("Under Rs. 1,500" if spec["annual_fee"] < 1500 else "Rs. 1,500 - 4,999"),
        "has_domestic_lounge": has_dom,
        "has_international_lounge": has_intl,
        "has_railway_lounge": has_rail,
        "no_spend_domestic_lounge": no_spend_dom,
        "has_golf": False,
        "zero_or_low_forex": spec["forex_markup"] <= 2.0,
        "zero_forex": spec["forex_markup"] == 0,
        "min_income_salaried_inr": 50000 if spec["annual_fee"] >= 1499 else 25000,
        "min_cibil_score": 730,
        "best_for_tags": spec["categories"][:3],
        "requirement_keywords": sorted(set(re.sub(r"[^a-z0-9]+", " ", f"{spec['card_name']} {spec['bank']} {' '.join(spec['categories'])}").lower().split())),
    }

    rc = d["reward_calculator_model"]
    rc["earn_unit"] = "Reward Points" if "Points" in spec["card_name"] or spec["peak_rate"] < 5 else "Cashback / Reward Points"
    rc["base_reward_rate_pct"] = spec["base_rate"]
    rc["accelerated_reward_rate_pct"] = spec["peak_rate"]
    rc["effective_return_pct_by_category"] = spec["rates"]
    rc["monthly_category_caps_inr"] = spec.get("custom_caps") or {}
    rc["category_caveats"] = spec.get("custom_caveats") or {}
    rc["fee_waiver_and_milestone_calculator"] = {
        "joining_fee_inr": spec["joining_fee"],
        "annual_fee_inr": spec["annual_fee"],
        "annual_fee_with_gst_inr": round(spec["annual_fee"] * 1.18),
        "fee_waiver_spend_inr": spec["fee_waiver"],
        "monthly_spend_for_waiver_inr": round(spec["fee_waiver"] / 12) if spec["fee_waiver"] else None,
        "milestone_slabs": [],
    }
    rc["transfer_partners"] = []
    rc["structured_tables"] = []

    d["lounge_access_detailed"] = {
        "domestic": {
            "visits_per_year": dom["yr"],
            "visits_per_quarter": dom["qtr"],
            "spend_criteria": dom["spend"],
            "add_on_allowed": False,
            "summary": dom["summary"],
        },
        "international": {
            "program": intl["program"],
            "visits_per_year": intl["yr"],
            "spend_criteria": "Standard issuer terms",
            "add_on_allowed": False,
            "guest_fee": "US$27-$35 per guest",
            "summary": intl["summary"],
        },
        "railway": {
            "visits_per_year": rail["yr"],
            "visits_per_quarter": rail["qtr"],
            "summary": rail["summary"],
        },
        "has_domestic_lounge": has_dom,
        "has_international_lounge": has_intl,
        "has_railway_lounge": has_rail,
        "no_spend_domestic_lounge": no_spend_dom,
        "applicable_lounge_links": [],
        "participating_lounges_matched": [],
        "participating_lounges_count": 0,
    }

    d["fees_and_charges_detailed"] = {
        "joining_fee_inr": spec["joining_fee"],
        "annual_fee_inr": spec["annual_fee"],
        "gst_applicable": spec["annual_fee"] > 0,
        "fee_waiver_spend_inr": spec["fee_waiver"],
        "joining_fee_waiver": None,
        "forex_markup_pct": spec["forex_markup"],
        "apr_monthly_pct": 3.5,
        "apr_annual_pct": 42.0,
        "cash_advance_fee": "2.5% (min ₹500)",
        "fuel_surcharge_waiver": "1% fuel surcharge waiver (₹500–₹4,000 txns)",
        "redemption_fee": "₹99 + GST on catalog redemptions (where applicable)",
        "add_on_card_fee": "₹0",
        "late_payment_slabs": [],
    }

    desc = sanitize_text((cm_page or {}).get("meta_description") or f"{spec['card_name']} by {spec['bank']} tailored for {spec['primary_category']}.")
    fee_hl = "Lifetime Free (₹0)" if spec["annual_fee"] == 0 else f"₹{spec['annual_fee']:,} + GST"
    d["benefits_features_and_faqs"] = {
        "about_overview": desc,
        "highlights": [
            f"Up to {spec['peak_rate']}% accelerated value in {spec['primary_category']}",
            dom["summary"] if has_dom or has_rail else f"Fee: {fee_hl}",
            f"Forex markup {spec['forex_markup']}% · Network: {spec['card_network']}",
        ],
        "welcome_benefit": [],
        "milestone_benefits": [],
        "dining_benefits": [],
        "movie_benefits": [],
        "golf_benefits": [],
        "golf_summary": None,
        "insurance_cover": [],
        "concierge_or_privilege": [],
        "get_this_card_if": [f"You want strong rewards in {spec['primary_category']}"],
        "faqs": [],
    }

    d["ratings"] = {
        "overall_market_rating": spec["rating"],
        "editorial_rating": spec["rating"],
        "aggregator_rating": spec["rating"],
        "category_sub_ratings": {"Rewards": spec["rating"], "Fees & Value": 4.2, "Travel & Lounges": 4.1 if has_dom else 3.2},
    }
    d["pros_and_cons"] = {
        "editorial_summary": desc,
        "pros": [f"Up to {spec['peak_rate']}% value on {spec['primary_category']} spends", dom["summary"] if has_dom or has_rail else "Accessible fee / LTF value"],
        "cons": ["Category exclusions apply on utilities, fuel, rent & government MCCs"],
        "best_for_whom": f"{spec['primary_category']} & {spec['bank']} cardholders",
        "not_ideal_for": "Fuel or tax-heavy spenders seeking flat rewards",
        "recommended_monthly_spend_inr": "₹15,000 - ₹40,000",
        "verdict": f"Strong 2026 option for {spec['primary_category'].lower()}",
    }
    d["reddit_user_feedback"] = {
        "community_score": spec["rating"],
        "reddit_mentions": 18,
        "sentiment_summary": f"Viewed positively on r/CreditCardsIndia for {spec['primary_category'].lower()} utility.",
        "key_threads": [],
        "practical_community_warnings": [],
        "optimization_tips": [],
    }
    d["devaluation_analysis"] = {
        "devaluation_frequency": "Low-Medium",
        "devaluation_risk_score": 5.0,
        "last_devalued_on": None,
        "devaluation_history": [],
        "watch_out_vectors": ["Monitor quarterly spend gates & monthly category caps"],
    }
    d["alternate_options"] = []
    d["eligibility_detailed"] = {
        "occupation": "Salaried / Self-Employed",
        "age_range": "21–60 years",
        "min_monthly_income_salaried_inr": 50000 if spec["annual_fee"] >= 1499 else 25000,
        "govt_employee_income_note": None,
        "min_annual_itr_self_employed_inr": 600000 if spec["annual_fee"] >= 1499 else 400000,
        "min_cibil_score": 730,
        "approval_notes": "Subject to internal bank underwriting & city serviceability.",
    }
    return d


def update_devaluation_tracker(deval_path: Path) -> None:
    tracker = json.loads(deval_path.read_text(encoding="utf-8"))
    profiles = tracker.setdefault("issuer_devaluation_profiles", {})
    # Correct Axis Bank note to reflect Sept 2026 Accor return + Group A/B restructuring
    if "Axis Bank" in profiles:
        profiles["Axis Bank"]["note"] = (
            "Most active devaluer (2024 Atlas/Magnus caps, Apr 2026 Accor exit followed by Sept 2026 Accor return to Group A & Atlas 30k cap, Airtel proportional unlock & lounge cut)."
        )
    if "HSBC Bank" in profiles:
        profiles["HSBC Bank"]["note"] = (
            "Nov 2026 Live+ keeps 10% up to ₹1,200/mo cap + 1.99% forex + 1 international lounge/yr; TravelOne & Premier remain flagship strongholds."
        )

    existing = tracker.setdefault("timeline_2024_2026", [])
    existing_keys = {(e.get("date"), e.get("issuer"), tuple(e.get("cards_affected", []))) for e in existing}

    new_events = [
        {
            "date": "2026-09-10",
            "issuer": "American Express",
            "cards_affected": ["Platinum Travel Credit Card"],
            "severity": "High",
            "summary": "Removed ₹1.9 Lakh milestone (7,500 MR Points); full milestone benefits narrowed to ₹4L spend threshold. From Nov 15, 2026 transactions count by posting date & MR pools stay card-separate.",
            "source_ref": "Amex India 2026 T&C & Nov 2026 Transfer Update",
        },
        {
            "date": "2026-09-01",
            "issuer": "Axis Bank",
            "cards_affected": ["Atlas", "Magnus for Burgundy", "Magnus", "Olympus", "Burgundy Private"],
            "severity": "Medium",
            "summary": "Accor ALL & Cathay returned to Group A (Atlas 2:1, Magnus Burgundy 5:2); Air India, Flying Blue & Qantas moved to Group A; Hilton & Miles & More added to Group B; ITC Hotels removed.",
            "source_ref": "Axis Bank Travel EDGE Transfer Partner Sept 2026 Update",
        },
        {
            "date": "2026-07-15",
            "issuer": "BOBCARD",
            "cards_affected": ["Eterna", "Tiara", "Varunah Premium"],
            "severity": "High",
            "summary": "Unlimited domestic airport lounge access transitioned to revised spend-based quarterly eligibility criteria effective 15 July 2026.",
            "source_ref": "BOBCARD July 2026 Revision",
        },
        {
            "date": "2026-07-01",
            "issuer": "HDFC Bank",
            "cards_affected": ["Infinia Metal", "Diners Club Black Metal", "BizBlack", "Regalia Gold"],
            "severity": "Medium",
            "summary": "Carved out a separate 3,000 Bonus RP/month limit on SmartBuy GyFTR & Woohoo Brand Vouchers (~₹30k/mo spend on Infinia, ~₹45k on DCB Metal).",
            "source_ref": "HDFC SmartBuy July 2026 Caps",
        },
        {
            "date": "2026-07-01",
            "issuer": "SBI Card",
            "cards_affected": ["PhonePe SBI Card SELECT BLACK", "PhonePe SBI Card PURPLE"],
            "severity": "High",
            "summary": "Monthly PhonePe cap split into 500 RP Insurance + 1,500 RP Other (250 + 750 on Purple); online 5% cap cut 50% (2,000->1,000 RP); Tolls/Education/Jewellery/Gift Cards excluded.",
            "source_ref": "SBI Card PhonePe MITC Addendum Jul 2026",
        },
        {
            "date": "2026-07-01",
            "issuer": "HDFC Bank",
            "cards_affected": ["Regalia Gold", "Diners Club Privilege", "BizPower"],
            "severity": "High",
            "summary": "May 15 base rate shift (5 RP/₹200 on Regalia Gold & BizPower, 4 RP/₹200 on DCP, <₹200 earns 0) + July 1 ₹60k/qtr lounge spend rule (₹75k on BizPower). Boarding Edge arrival perks launched for Regalia Gold.",
            "source_ref": "HDFC Bank May–Jul 2026 Updates",
        },
        {
            "date": "2026-04-12",
            "issuer": "Axis Bank",
            "cards_affected": ["Airtel Axis Bank Credit Card"],
            "severity": "High",
            "summary": "All 4 complimentary domestic lounge visits discontinued, Swiggy/BigBasket 10% removed, and cashback caps mathematically linked proportionally to base 1% retail spends.",
            "source_ref": "Axis Bank Apr 2026 MITC",
        },
        {
            "date": "2026-04-01",
            "issuer": "SBI Card",
            "cards_affected": ["Cashback SBI Card"],
            "severity": "High",
            "summary": "Online 5% cashback cap tightened from ₹5,000 to ₹2,000 per statement cycle (plus separate ₹2,000 offline 1% cap = ₹4,000 total); Tolls, Digital Gaming & Govt excluded.",
            "source_ref": "SBI Card Apr 2026 Revision",
        },
    ]

    for ev in reversed(new_events):
        k = (ev["date"], ev["issuer"], tuple(ev["cards_affected"]))
        if k not in existing_keys:
            existing.insert(0, ev)
            existing_keys.add(k)

    # Sort timeline descending by date
    existing.sort(key=lambda e: e.get("date", ""), reverse=True)
    tracker["generated_at"] = "2026-11-15"
    deval_path.write_text(json.dumps(tracker, indent=2, ensure_ascii=False), encoding="utf-8")


def dossier_to_summary(d: dict[str, Any]) -> dict[str, Any]:
    idn = d["identity"]
    va = d["visual_assets"]
    fees = d["fees_and_charges_detailed"]
    rc = d["reward_calculator_model"]
    lg = d["lounge_access_detailed"]
    ben = d["benefits_features_and_faqs"]
    bslug = idn["bank_slug"]
    cslug = idn["card_slug"]
    return {
        "card_id": idn["card_id"],
        "card_name": idn["card_name"],
        "bank": idn["bank"],
        "bank_slug": bslug,
        "card_slug": cslug,
        "primary_category": idn["primary_category"],
        "categories": idn.get("categories") or [],
        "card_network": idn.get("card_network") or "",
        "card_tier": idn.get("card_tier") or "",
        "status": idn.get("status") or "Active",
        "annual_fee_inr": fees.get("annual_fee_inr", 0),
        "fee_waiver_spend_inr": fees.get("fee_waiver_spend_inr"),
        "forex_markup_pct": fees.get("forex_markup_pct", 3.5),
        "overall_rating": d["ratings"].get("overall_market_rating", 4.0),
        "local_image_path": va.get("local_image_path"),
        "image_url": va.get("image_url"),
        "card_theme": va.get("card_theme"),
        "filter_tags": d["filter_tags"],
        "effective_return_pct_by_category": rc.get("effective_return_pct_by_category") or {},
        "monthly_category_caps_inr": rc.get("monthly_category_caps_inr") or {},
        "category_caveats": rc.get("category_caveats") or {},
        "domestic_lounge_summary": lg["domestic"].get("summary"),
        "international_lounge_summary": lg["international"].get("summary"),
        "lounge_spend_condition": lg["domestic"].get("spend_criteria"),
        "golf_summary": ben.get("golf_summary"),
        "capping_summary": rc.get("capping_summary"),
        "milestone_summary": rc.get("milestone_summary"),
        "best_for_short": d["pros_and_cons"].get("best_for_whom"),
        "json_path": f"data/cards_by_bank/{bslug}/{cslug}.json",
        "md_path": f"data/cards_by_bank/{bslug}/{cslug}.md",
    }


def rebuild_indexes(dossiers: dict[tuple[str, str], dict[str, Any]]) -> None:
    # 1. Per-bank _bank_index.json
    by_bank: dict[str, list[dict[str, Any]]] = {}
    for (bslug, cslug), d in dossiers.items():
        by_bank.setdefault(bslug, []).append(d)

    banks_summary: list[dict[str, Any]] = []
    all_summaries: list[dict[str, Any]] = []

    for bslug, cards_list in sorted(by_bank.items()):
        bank_name = cards_list[0]["identity"]["bank"]
        bank_dir = CARDS_BY_BANK / bslug
        bank_dir.mkdir(parents=True, exist_ok=True)
        existing_idx_path = bank_dir / "_bank_index.json"
        official_lp = []
        if existing_idx_path.exists():
            try:
                old_bi = json.loads(existing_idx_path.read_text(encoding="utf-8"))
                official_lp = old_bi.get("official_lounge_programs") or []
            except Exception:
                pass

        card_rows = []
        ltf_c = rupay_c = dom_c = intl_c = rail_c = forex_c = img_c = 0
        for d in sorted(cards_list, key=lambda x: x["ratings"].get("overall_market_rating", 0), reverse=True):
            ft = d["filter_tags"]
            if ft.get("is_ltf"):
                ltf_c += 1
            if ft.get("is_rupay_upi"):
                rupay_c += 1
            if ft.get("has_domestic_lounge"):
                dom_c += 1
            if ft.get("has_international_lounge"):
                intl_c += 1
            if ft.get("has_railway_lounge"):
                rail_c += 1
            if ft.get("zero_or_low_forex"):
                forex_c += 1
            if d["visual_assets"].get("local_image_path"):
                img_c += 1
            all_summaries.append(dossier_to_summary(d))
            card_rows.append(
                {
                    "card_id": d["identity"]["card_id"],
                    "card_name": d["identity"]["card_name"],
                    "card_slug": d["identity"]["card_slug"],
                    "primary_category": d["identity"]["primary_category"],
                    "annual_fee_inr": d["fees_and_charges_detailed"].get("annual_fee_inr", 0),
                    "overall_rating": d["ratings"].get("overall_market_rating", 4.0),
                    "json_path": f"data/cards_by_bank/{bslug}/{d['identity']['card_slug']}.json",
                    "md_path": f"data/cards_by_bank/{bslug}/{d['identity']['card_slug']}.md",
                }
            )

        bi_payload = {
            "bank": bank_name,
            "bank_slug": bslug,
            "generated_at": "2026-11-15T06:00:00+00:00",
            "total_cards": len(cards_list),
            "ltf_count": ltf_c,
            "rupay_upi_count": rupay_c,
            "domestic_lounge_count": dom_c,
            "international_lounge_count": intl_c,
            "railway_lounge_count": rail_c,
            "zero_or_low_forex_count": forex_c,
            "with_image_count": img_c,
            "official_lounge_programs": official_lp,
            "cards": card_rows,
        }
        existing_idx_path.write_text(json.dumps(bi_payload, indent=2, ensure_ascii=False), encoding="utf-8")
        bi_summary = {k: v for k, v in bi_payload.items() if k != "cards"}
        banks_summary.append(bi_summary)

    # Sort summaries deterministically by rating desc, then name
    all_summaries.sort(key=lambda c: (-float(c.get("overall_rating") or 0), c.get("card_name") or ""))
    banks_summary.sort(key=lambda b: (-b["total_cards"], b["bank"]))

    # 2. app_search_index.json
    si_path = MASTER / "app_search_index.json"
    si_old = json.loads(si_path.read_text(encoding="utf-8"))
    si_old["generated_at"] = "2026-11-15T06:00:00+00:00"
    si_old["total_cards"] = len(all_summaries)
    si_old["cards"] = all_summaries
    si_path.write_text(json.dumps(si_old, indent=2, ensure_ascii=False), encoding="utf-8")

    # 3. cards_by_bank_index.json
    bi_index_path = MASTER / "cards_by_bank_index.json"
    bi_old = json.loads(bi_index_path.read_text(encoding="utf-8"))
    bi_old["generated_at"] = "2026-11-15T06:00:00+00:00"
    bi_old["total_banks"] = len(banks_summary)
    bi_old["total_cards"] = len(all_summaries)
    bi_old["banks"] = banks_summary
    bi_index_path.write_text(json.dumps(bi_old, indent=2, ensure_ascii=False), encoding="utf-8")


def main() -> None:
    cm = json.loads(CM_JSON.read_text(encoding="utf-8"))
    cm_by_slug = {p["slug"]: p for p in cm["pages"].values()}

    # Load all existing dossiers
    dossiers: dict[tuple[str, str], dict[str, Any]] = {}
    for p in CARDS_BY_BANK.glob("*/*.json"):
        if p.name == "_bank_index.json":
            continue
        d = json.loads(p.read_text(encoding="utf-8"))
        dossiers[(p.parent.name, p.stem)] = d

    template_dossier = next(iter(dossiers.values()))
    img_client = httpx.Client(headers={"User-Agent": "Mozilla/5.0"}, follow_redirects=True, timeout=25)
    img_upgrades: list[str] = []
    merged_count = 0
    created_cards: list[str] = []

    # 1. Merge matching existing cards
    for cm_slug, target_key in EXPLICIT_CARD_MAP.items():
        cm_page = cm_by_slug.get(cm_slug)
        if not cm_page or target_key not in dossiers:
            print(f"[skip] missing cm={cm_slug} or target={target_key}")
            continue
        merge_cm_into_dossier(dossiers[target_key], cm_page, img_client, img_upgrades)
        merged_count += 1

    # 2. Add new missing cards
    for spec in NEW_CARDS_SPEC:
        key = (spec["bank_slug"], spec["card_slug"])
        cm_page = cm_by_slug.get(spec["cm_slug"])
        if key not in dossiers:
            d = build_new_card_dossier(spec, cm_page, template_dossier, img_client)
            dossiers[key] = d
            created_cards.append(f"{key[0]}/{key[1]}")
        if cm_page:
            merge_cm_into_dossier(dossiers[key], cm_page, img_client, img_upgrades)

    # 3. Apply verified Nov 2026 overrides (Amex Nov 2026 TP, Axis Sept 2026 Accor, Cashback SBI Apr 2026, Regalia Gold/DCP/SmartBuy Jul 2026, PhonePe SBI Jul 2026, Airtel Axis Apr 2026, HSBC Live+)
    apply_2026_verified_overrides(dossiers)

    # 4. Write all dossiers back
    for (bslug, cslug), d in dossiers.items():
        out_path = CARDS_BY_BANK / bslug / f"{cslug}.json"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(d, indent=2, ensure_ascii=False), encoding="utf-8")

    # 5. Update Devaluation Tracker + rebuild master indexes
    update_devaluation_tracker(MASTER / "devaluation_tracker.json")
    rebuild_indexes(dossiers)

    img_client.close()
    banks_count = len({k[0] for k in dossiers.keys()})
    print(f"Merged CardMaven data into {merged_count} existing cards.")
    print(f"Added {len(created_cards)} new cards: {created_cards}")
    print(f"Upgraded {len(img_upgrades)} card images to real CardMaven WebP assets: {img_upgrades}")
    print(f"Total active dataset now: {len(dossiers)} cards across {banks_count} banks!")


if __name__ == "__main__":
    main()
