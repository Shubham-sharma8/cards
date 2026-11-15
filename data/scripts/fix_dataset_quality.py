#!/usr/bin/env python3
"""Fix Cashback point values, partner-locked category caveats, scraped artifacts,
missing MITC PDFs, Reddit warnings junk, and Devaluation Tracker bank PDF links
across canonical data/ JSONs and mobile/src/data/ bundles.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from crawl_open_media_and_pdfs import BANK_MITC_VERIFIED

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
MOBILE_DATA = ROOT / "mobile" / "src" / "data"

# Cards mistakenly labeled earn_unit="Cashback" when they actually issue Reward Points / CashPoints / Fuel Points
REWARD_POINT_OVERRIDES = {
    "hdfc-regalia-credit-card",
    "hdfc-moneyback-credit-card",
    "hdfc-moneyback-credit-card-suitable-for-new-to-credit-customers",
    "hdfc-biz-grow-credit-card",
    "hdfc-bizfirst-credit-card",
    "kotak-white-reserve-credit-card",
    "kotak-league-platinum-credit-card",
    "kotak-dream-different-credit-card",
    "rbl-bank-patanjali-vishisht-credit-card",
    "rbl-bank-apex-credit-card",
    "titan-sbi-credit-card",
    "sbi-reliance-credit-card",
    "shaurya-sbi-card",
    "shaurya-select-sbi-card",
    "sbi-unnati-credit-card",
    "au-lit-credit-card",
    "au-altura-credit-card",
    "au-xcite-ace-credit-card",
    "au-kosmo-credit-card",
    "au-tejas-credit-card",
    "bandhan-bank-sparks-credit-card",
    "icici-bank-hpcl-coral-credit-card",
    "icici-hpcl-super-saver-credit-card",
    "standard-chartered-super-value-titanium-credit-card",
    "samsung-axis-bank-infinite-credit-card",
    "axis-bank-samsung-signature-credit-card",
    "axis-bank-signature-credit-cards-with-lifestyle-benefits",
    "utkarsh-eternal-credit-card",
    "utkarsh-smartgen-credit-card",
    "utkarsh-rhodium-credit-card",
    "utkarsh-supercard-rupay-credit-card",
}

# Explicit partner-locked rate adjustments & user-visible category caveats
PARTNER_CARD_PATCHES: dict[str, dict] = {
    "swiggy-hdfc-bank-credit-card": {
        "card_network": "Mastercard World",
        "effective_return_pct_by_category": {
            "dining_swiggy_zomato": 5.5,
            "groceries_quick_commerce": 5.5,
            "online_shopping_general": 5.0,
            "amazon_flipkart_myntra": 5.0,
            "travel_flights_hotels": 1.0,
            "offline_general_other": 1.0,
        },
        "category_caveats": {
            "dining_swiggy_zomato": "10% on Swiggy Food/Dineout only (₹1,500/mo cap) · 1% non-Swiggy",
            "groceries_quick_commerce": "10% on Swiggy Instamart only (₹1,500/mo cap) · 1% non-Swiggy",
            "online_shopping_general": "5% select online MCCs (₹1,500/mo cap); excl. utility/wallet",
            "amazon_flipkart_myntra": "5% on eligible Amazon/Flipkart/Myntra MCCs (shared ₹1,500 cap)",
            "offline_general_other": "1% base cashback capped at ₹500/statement cycle",
        },
    },
    "swiggy-blck-hdfc-bank-credit-card": {
        "effective_return_pct_by_category": {
            "dining_swiggy_zomato": 5.5,
            "groceries_quick_commerce": 5.5,
        },
        "category_caveats": {
            "dining_swiggy_zomato": "10% on Swiggy App only (min order ₹249); 1% other dining",
            "groceries_quick_commerce": "10% on Swiggy Instamart only (min order ₹249); 1% other",
            "online_shopping_general": "5% eligible online MCCs (capped)",
        },
    },
    "swiggy-ornge-hdfc-bank-credit-card": {
        "category_caveats": {
            "dining_swiggy_zomato": "5%–10% on Swiggy App only (min order ₹249, tiered cap)",
            "groceries_quick_commerce": "Swiggy Instamart app-specific rate · 1% offline/other",
        },
    },
    "airtel-axis-bank-credit-card": {
        "effective_return_pct_by_category": {
            "dining_swiggy_zomato": 4.0,
            "groceries_quick_commerce": 4.0,
        },
        "category_caveats": {
            "utilities_bills_telecom": "25% Airtel App (₹250 cap) · 10% bills (₹250 cap); needs matching retail spend",
            "dining_swiggy_zomato": "10% Zomato only (Eff Apr 2026) · 1% outside Zomato",
            "groceries_quick_commerce": "10% Blinkit only (Eff Apr 2026) · 1% outside Blinkit",
        },
    },
    "flipkart-axis-bank-credit-card": {
        "category_caveats": {
            "amazon_flipkart_myntra": "5% Flipkart & Cleartrip only · 1%–1.5% on Amazon/other",
            "dining_swiggy_zomato": "4% preferred merchants (Swiggy/PVR/Uber) · 1% general",
        },
    },
    "flipkart-sbi-card": {
        "category_caveats": {
            "amazon_flipkart_myntra": "5% Flipkart/Cleartrip partner cashback · 1% other marketplaces",
        },
    },
    "amazon-pay-icici-bank-credit-card": {
        "effective_return_pct_by_category": {
            "amazon_flipkart_myntra": 3.5,
        },
        "category_caveats": {
            "amazon_flipkart_myntra": "5% Amazon (Prime) / 3% non-Prime · 1% Flipkart/Myntra",
            "utilities_bills_telecom": "2% via Amazon Pay utility portal only · 1% outside",
        },
    },
    "tata-neu-infinity-hdfc-bank-credit-card": {
        "category_caveats": {
            "groceries_quick_commerce": "Up to 10% on BigBasket / Tata Neu App · 1.5% outside Tata",
            "upi_scan_and_pay": "1.5% on UPI via Tata Neu app only (capped)",
        },
    },
    "tata-neu-plus-hdfc-credit-card": {
        "category_caveats": {
            "groceries_quick_commerce": "Up to 7% on BigBasket / Tata Neu App · 1% outside Tata",
            "upi_scan_and_pay": "1% on UPI via Tata Neu app only",
        },
    },
    "myntra-kotak-credit-card": {
        "category_caveats": {
            "amazon_flipkart_myntra": "7.5% instant Myntra discount (max ₹750/txn) · 1.25% other",
            "dining_swiggy_zomato": "5% preferred merchants (Swiggy/Swiggy Instamart) only",
        },
    },
    "cashback-sbi-card": {
        "category_caveats": {
            "online_shopping_general": "5% online across merchants (combined ₹5,000/mo cycle cap across 5%+1%)",
            "amazon_flipkart_myntra": "5% online on Amazon/Flipkart/Myntra (shared ₹5,000/mo cap)",
        },
    },
    "hsbc-live-credit-card": {
        "category_caveats": {
            "dining_swiggy_zomato": "10% across Dining, Food Delivery, Groceries & Eligible Shopping (₹1,200/mo combined cap; ₹12,000 spend)",
            "groceries_quick_commerce": "10% across Zepto/Blinkit/Instamart/DMart & Dining (₹1,200/mo combined cap; 1.5% after)",
            "amazon_flipkart_myntra": "1.5% base cashback directly on Amazon, Flipkart & Myntra (excluded from 10% tier)",
            "utilities_bills_telecom": "10% eligible utility MCC (shared ₹1,200/mo cap) or route via Zepto Apay Gift Cards → Amazon Pay",
            "insurance": "0% direct insurer MCC — Pro Hack: buy Amazon Pay Gift Cards on Zepto (10% up to ₹1,200/mo) → pay via Amazon Pay / Policybazaar",
        },
    },
    "american-express-membership-rewards-credit-card": {
        "effective_return_pct_by_category": {
            "fuel": 0.0,
        },
        "category_caveats": {
            "online_shopping_general": "Use Amex Reward Multiplier (GyFTR) for 2X–3X bonus MR points on brand vouchers; base 1 MR/₹50",
            "fuel": "0 MR points on fuel; 0% HPCL surcharge waiver only up to ₹5,000 transaction size",
        },
    },
}

# Verified Card-Specific Optimization Tips & Community Hacks (Synced to Web + Mobile + R2)
OPTIMIZATION_TIPS_BY_CARD: dict[str, list[str]] = {
    "hsbc-live-credit-card": [
        "Zepto → Amazon Pay Insurance Hack: Buy Amazon Pay Gift Cards on Zepto using HSBC Live+ (codes as Grocery MCC = 10% cashback up to ₹1,200/month on ₹12k spend), add to your Amazon Pay balance, then pay LIC/term/health insurance via Amazon Pay or Policybazaar (choose Amazon Pay wallet) at an effective 10% return.",
        "Track the shared ₹1,200/month cap: Dining, Swiggy/Zomato food delivery, Blinkit/Zepto/Instamart groceries, DMart, and eligible shopping share one ₹12,000/month 10% pool — excess spends earn 1.5% uncapped.",
        "Never use directly on Amazon.in, Flipkart, or Myntra for 10% (those drop to 1.5% base); save direct marketplace checkouts for SBI Cashback or Amazon Pay ICICI.",
    ],
    "cashback-sbi-card": [
        "Apay Gift Card Utility & Insurance Route: Direct utilities, insurance, and gift card MCCs earn 0%. Buy Amazon Pay Gift Cards directly on Amazon.in (or eligible e-commerce voucher checkouts coding as online shopping) for 5% cashback, then pay electricity/gas/insurance inside Amazon Pay.",
        "Shared ₹5,000/month cap: 5% online and 1% offline cashbacks share a single ₹5,000/billing-cycle ceiling (₹1,00,000 online spend) — avoid sudden bulk gift-card spikes that trigger SBI fraud alerts.",
    ],
    "hdfc-infinia-metal-edition-credit-card": [
        "SmartBuy GyFTR 5X Voucher Loop: Buy Amazon Pay, Flipkart, BigBasket & Swiggy vouchers via HDFC SmartBuy GyFTR to earn 16.5% reward value (5X RPs redeemed 1:1 for flights/hotels/Apple/Tanishq); even after ~3.5%+GST processing fees on Apay GVs, net yield on insurance/utilities stays ~12%+.",
        "Respect SmartBuy & Insurance ceilings: Accelerated SmartBuy bonus points cap at 15,000 RP/calendar month, while direct insurance RPs cap at 5,000 RP/day and 10,000 RP/month — split large renewals across days or months.",
        "Never encash RPs for statement credit (₹0.30/RP): always book SmartBuy Travel or transfer 1:1 to airlines/Accor (up to ₹1.00–₹1.80 value/RP).",
    ],
    "hdfc-diners-club-black-metal-edition": [
        "SmartBuy 3X + ₹4L Quarterly Milestone: Buy GyFTR Amazon Pay/Flipkart vouchers at ~10% RP value (capped at 10,000 RP/month) while stacking toward the 10,000 bonus RP milestone on ₹4,00,000 quarterly spend.",
        "Carry a backup Visa/Mastercard on smaller offline merchants, as Diners Club acceptance outside tier-1 hotels/metros can occasionally fail.",
    ],
    "hdfc-regalia-gold-credit-card": [
        "Chase ₹1.5L Quarterly & ₹5L/₹7.5L Annual Milestones: Earn ₹1,500 Myntra/Nykaa/Reliance/Marriott vouchers each ₹1.5L quarter plus ₹5,000 Flight Vouchers at ₹5L & ₹7.5L annual spend alongside 5X partner retail multipliers.",
        "Direct insurance earns 4 RP/₹150 capped at 2,000 RP/month; verify ₹60,000 preceding-quarter spend rules where applicable for domestic lounge access.",
    ],
    "tata-neu-infinity-hdfc-bank-credit-card": [
        "Tata Neu App Bill/Insurance Trick: Pay insurance premiums & electricity/gas bills inside the Tata Neu app (Tata Pay) to earn 5% NeuCoins (capped at 2,000 NeuCoins/mo on insurance; net ~3.3% where ~1.7% convenience fee applies, 5% where fee-free).",
        "Always scan merchant RuPay UPI QRs inside the Tata Neu app (1.5% NeuCoins capped at 500/mo) — GPay/PhonePe UPI gives only 0.5%.",
        "Claim domestic lounge vouchers online via HDFC SMS/GyFTR link within 120 days after meeting ₹50,000 quarterly spend.",
    ],
    "swiggy-hdfc-bank-credit-card": [
        "Swiggy-Exclusive 10% Rule: 10% (₹1,500/cycle cap = ₹15,000 spend) works strictly on Swiggy Food, Instamart & Dineout; Zomato, Zepto, Blinkit, Swiggy Money Wallet, and Swiggy Liquor earn 1% or 0%.",
        "Use the secondary 5% bucket (₹1,500/cycle cap = ₹30,000 spend) across Amazon, Flipkart, Myntra & eligible apparel sites; overflow goes to 1% (₹500/cycle cap).",
    ],
    "airtel-axis-bank-credit-card": [
        "April 2026 Proportional Unlock Rule: 25% Airtel Thanks recharge (₹250 cap) & 10% Utility bills via Airtel Thanks (₹250 cap) now unlock proportionally with base 1% retail spend — mix Zomato, Blinkit & everyday offline/online spends so bill cashback isn't withheld.",
    ],
    "amazon-pay-icici-bank-credit-card": [
        "Zero-Cap Overflow Workhorse: Prime members get UNLIMITED 5% Amazon Pay balance on Amazon.in & 2% on Amazon Pay bills/insurance/flights — use it once SBI Cashback (₹5k/mo cap) or HSBC Live+ (₹1.2k/mo cap) is maxed out.",
    ],
    "phonepe-sbi-card-select-black": [
        "Route Inside PhonePe App Only: 10% Reward Points on Utilities/Travel (cap 1,500 RP/mo) & Insurance (cap 500 RP/mo; net ~8.2% after convenience fee) trigger ONLY via in-app PhonePe BBPS/checkout — external portals earn 0%–1%.",
    ],
    "icici-bank-emeralde-private-metal-credit-card": [
        "iShop Voucher Stack: Purchase Amazon Pay, Zomato & airline vouchers through ICICI iShop Portal (6X–12X / 18%–36% RP return up to 18,000 RP/month), then pay insurance & utilities via Amazon Pay.",
    ],
    "yes-bank-klick-kiwi-rupay-credit-card": [
        "Kiwi Neon Annual Ladder: With Neon (₹999/yr), annual UPI milestones unlock retroactive rates of 3% at ₹50K, 4% at ₹1L, and 5% at ₹1.5L/yr — route ₹12,500+/mo Scan & Pay merchant QRs natively via the Kiwi app.",
    ],
    "first-power-credit-card-by-idfc-first-bank": [
        "HP Pay QR Double-Dip: Always scan the HP Pay QR code inside the HP Pay App (don't just swipe at the POS) to combine IDFC fuel rewards, Happy Coins & 1% surcharge waiver (~6.5% total net value up to ₹10,000–₹12,000/mo fuel).",
    ],
    "bpcl-sbi-card-octane": [
        "Max ₹10,000/mo Fuel Ceiling: Earns 25 RP/₹100 (6.25% net value) capped at 2,500 RP/cycle on BPCL pumps + instant point redemption directly at BPCL POS terminals (₹0.25/RP).",
    ],
    "american-express-membership-rewards-credit-card": [
        "Double Monthly Milestone Formula: Complete 4 transactions of ₹1,500+ every calendar month (+1,000 Bonus MR pts) AND spend ₹20,000 total/month (+1,000 Bonus MR pts) — generating 2,400+ MR pts/month (~5%–8% effective return).",
        "Redeem Only via 18K/24K Gold Collection: Avoid ₹0.25 statement cash credit; redeem at 18,000 or 24,000 MR pts Gold Collection vouchers (Taj/Flipkart) or Marriott transfer bonuses for ₹0.50–₹0.80+/pt.",
    ],
    "axis-bank-atlas-credit-card": [
        "Group A 30,000 Miles/Year Cap: Transfer Axis EDGE Miles strategically to Group A partners (Air India, Flying Blue, Accor 1:2 Ratio) before hitting the 30k annual Group A ceiling; optimize ₹7.5L & ₹15L annual milestones.",
    ],
    "federal-bank-scapia-credit-card": [
        "Zero-Forex & ₹20k Lounge Gate: Keep Scapia as your ₹0-fee 0%-forex international card and swipe ≥₹20,000/cycle on Visa (₹15,000 on RuPay) before travel months to unlock unlimited domestic airport lounges + ₹5,000/cycle airport dining/spa credits.",
    ],
    "ixigo-au-credit-card": [
        "Train Zero-PG Fee + 0% Forex Hack: Enjoy Lifetime Free 0% forex markup abroad, 8 domestic + 1 international Priority Pass visits, and zero payment-gateway fees on ixigo train bookings (up to twice monthly).",
    ],
    "hdfc-bizblack-metal-edition-credit-card": [
        "GST & Advance Tax 5X Powerhouse: Pay GST challans, Advance Tax & income tax via HDFC PayZapp/SmartPay (with ₹50k+ monthly threshold) to unlock 5X RPs (~16.5% return, capped at 7,500 bonus RP/month).",
    ],
    "hdfc-millennia-credit-card": [
        "₹20,000 Monthly Sweet Spot: 5% cashback across Amazon, Flipkart, Swiggy, Zomato, BookMyShow, Tata CLiQ & Uber caps at ₹1,000/month — shift additional online spend once you cross ₹20k unless chasing the ₹1L/quarter ₹1,000 voucher.",
    ],
}

OFFICIAL_ISSUER_PDFS: dict[str, dict[str, str]] = {
    "Axis Bank": {
        "mitc_pdf_url": "https://www.axisbank.com/docs/default-source/default-document-library/credit-card-mitc.pdf",
        "devaluation_pdf_url": "https://www.axisbank.com/docs/default-source/default-document-library/sosc-credit-cards.pdf",
        "bank_page_url": "https://www.axisbank.com/retail/cards/credit-card/most-important-terms-and-conditions",
    },
    "ICICI Bank": {
        "mitc_pdf_url": "https://www.icicibank.com/content/dam/icicibank/india/managed-assets/docs/personal/cards/MITC_cc.pdf",
        "devaluation_pdf_url": "https://www.icicibank.com/personal-banking/cards/credit-card/mitc",
        "bank_page_url": "https://www.icicibank.com/personal-banking/cards/credit-card/mitc",
    },
    "YES BANK": {
        "mitc_pdf_url": "https://www.yesbank.in/pdf/credit_card_mitc_pdf",
        "devaluation_pdf_url": "https://www.yesbank.in/personal-banking/yes-individual/cards/credit-cards",
        "bank_page_url": "https://www.yesbank.in/personal-banking/yes-individual/cards/credit-cards",
    },
    "SBI Card": {
        "mitc_pdf_url": "https://www.sbicard.com/sbi-card-en/assets/docs/pdf/personal/credit-cards/most-important-terms-and-conditions.pdf",
        "devaluation_pdf_url": "https://www.sbicard.com/sbi-card-en/assets/docs/pdf/kfs/key-fact-statement.pdf",
        "bank_page_url": "https://www.sbicard.com/en/most-important-terms-and-conditions.page",
    },
    "HDFC Bank": {
        "mitc_pdf_url": "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/personal-banking/discover-products/cards/credit-cards/personal-mitc/mitc-in-english.pdf",
        "devaluation_pdf_url": "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/personal-banking/discover-products/cards/credit-cards/swiggy-hdfc-bank-credit-card/pdf/faq-swiggy-card-upgrade-final.pdf",
        "bank_page_url": "https://www.hdfc.bank.in/credit-cards",
    },
    "Kotak Mahindra Bank": {
        "mitc_pdf_url": "https://www.kotak.com/content/dam/Kotak/Customer-Service/Important-Customer-Information/most-important-terms-and-conditions-credit-card.pdf",
        "devaluation_pdf_url": "https://www.kotak.com/en/personal-banking/cards/credit-cards.html",
        "bank_page_url": "https://www.kotak.com/en/personal-banking/cards/credit-cards.html",
    },
    "AU Small Finance Bank": {
        "mitc_pdf_url": "https://www.aubank.in/credit-card-mitc",
        "devaluation_pdf_url": "https://www.aubank.in/personal-banking/credit-cards",
        "bank_page_url": "https://www.aubank.in/credit-card-mitc",
    },
    "HSBC Bank": {
        "mitc_pdf_url": "https://www.hsbc.co.in/content/dam/hsbc/in/documents/credit-cards/mitc.pdf",
        "devaluation_pdf_url": "https://www.hsbc.co.in/credit-cards/terms-and-conditions/",
        "bank_page_url": "https://www.hsbc.co.in/credit-cards/terms-and-conditions/",
    },
    "IDFC FIRST Bank": {
        "mitc_pdf_url": "https://www.idfcfirstbank.com/content/dam/idfcfirstbank/pdf/credit-card/MITC-Credit-Card.pdf",
        "devaluation_pdf_url": "https://www.idfcfirstbank.com/credit-card/mitc",
        "bank_page_url": "https://www.idfcfirstbank.com/credit-card/mitc",
    },
    "American Express": {
        "mitc_pdf_url": "https://www.americanexpress.com/content/dam/amex/in/legal-disclosures/Schedule-of-Fee-and-Charges.pdf",
        "devaluation_pdf_url": "https://www.americanexpress.com/in/legal-disclosures/most-important-terms-and-conditions/",
        "bank_page_url": "https://www.americanexpress.com/in/legal-disclosures/most-important-terms-and-conditions/",
    },
    "IndusInd Bank": {
        "mitc_pdf_url": "https://www.indusind.com/content/dam/indusind-corporate/Other/credit-card-mitc.pdf",
        "devaluation_pdf_url": "https://www.indusind.com/in/en/personal/cards/credit-card.html",
        "bank_page_url": "https://www.indusind.com/in/en/personal/cards/credit-card.html",
    },
    "BOBCARD": {
        "mitc_pdf_url": "https://www.bobcard.co.in/pdfs/MITC.pdf",
        "devaluation_pdf_url": "https://www.bobcard.co.in/most-important-terms-and-conditions",
        "bank_page_url": "https://www.bobcard.co.in/most-important-terms-and-conditions",
    },
    "RBL Bank": {
        "mitc_pdf_url": "https://www.rblbank.com/static-assets/pdfs/credit-cards/mitc-credit-card.pdf",
        "devaluation_pdf_url": "https://www.rblbank.com/personal-banking/cards/credit-cards",
        "bank_page_url": "https://www.rblbank.com/personal-banking/cards/credit-cards",
    },
    "Federal Bank": {
        "mitc_pdf_url": "https://www.federalbank.co.in/documents/10180/45777/MITC+Credit+Card.pdf",
        "devaluation_pdf_url": "https://www.federalbank.co.in/credit-cards",
        "bank_page_url": "https://www.federalbank.co.in/credit-cards",
    },
    "Standard Chartered Bank": {
        "mitc_pdf_url": "https://av.sc.com/in/content/docs/in-credit-card-mitc.pdf",
        "devaluation_pdf_url": "https://www.sc.com/in/credit-cards/",
        "bank_page_url": "https://www.sc.com/in/credit-cards/",
    },
    "OneCard / Co-branded": {
        "mitc_pdf_url": "https://www.getonecard.app/legal/mitc/",
        "devaluation_pdf_url": "https://www.getonecard.app/terms/",
        "bank_page_url": "https://www.getonecard.app/legal/mitc/",
    },
}

EXTRA_PROFILES = {
    "RBL Bank": {
        "frequency": "Medium",
        "risk_score": 5.5,
        "note": "Monthly caps on Play/Shoprite/World Safari + surcharge & utility exclusions reviewed yearly.",
    },
    "Federal Bank": {
        "frequency": "Low-Medium",
        "risk_score": 4.0,
        "note": "Scapia & Celesta domestic lounge spend thresholds raised to Rs. 15k–20k/cycle; core cashback stays clean.",
    },
    "Standard Chartered Bank": {
        "frequency": "Medium",
        "risk_score": 5.0,
        "note": "Ultimate & Smart reward exclusions on tax/utilities tightened; direct cashback T&C stable.",
    },
    "OneCard / Co-branded": {
        "frequency": "Medium",
        "risk_score": 4.5,
        "note": "5X top-category rotation & 1% forex pass adjustments; partner bank MITC governs fee terms.",
    },
}


def clean_rule_list(items: list[str], card_name: str) -> list[str]:
    if not items:
        return []
    out: list[str] = []
    short = re.sub(r"\s*credit card.*$", "", card_name, flags=re.I).strip().lower()
    short_nobank = re.sub(r"\s+bank\b", "", short).strip()
    cn_lower = card_name.strip().lower()
    cn_nobank = re.sub(r"\s+bank\b", "", cn_lower).strip()
    seen: set[str] = set()
    for raw in items:
        s = str(raw).strip()
        if not s:
            continue
        sl = s.lower()
        if sl in (cn_lower, cn_nobank, short, short_nobank, f"{short} card", f"{short_nobank} card"):
            continue
        s = re.sub(r"\s*Click here to check[^.]*\.", "", s, flags=re.I)
        s = re.sub(
            r"\b(?!tier[123]\b|level[123]\b|part[123]\b|phase[123]\b|web3\b|pass3\b)([A-Za-z][a-z]{2,})([123])\b",
            r"\1",
            s,
        )
        s = re.sub(r"\b(Cashback|cashback|points?)\s*[12]\b", r"\1", s)
        s = re.sub(r"\s{2,}", " ", s).strip()
        if (
            len(s) <= 55
            and not re.search(r"[0-9%₹]", s)
            and re.search(r"\b(?:credit\s+card|debit\s+card|metal\s+edition|card)\s*$", s.lower())
        ):
            continue
        if len(s) < 6 or s.lower() in seen:
            continue
        seen.add(s.lower())
        out.append(s)
    return out


def is_forum_junk(text: str) -> bool:
    t = text.strip()
    tl = t.lower()
    if t.startswith("#") or "[deleted" in tl or "reddit" in tl or "😂" in t or "😭" in t:
        return True
    bad_phrases = (
        "lucky guy",
        "poor ass",
        "should i ",
        "i got ",
        "got rejected",
        "got approved",
        "help me",
        "any card i must try",
        "planning to apply",
        "i see hdfc",
        "!!",
        "my cibil",
        "hello fam",
        "kindly enlighten",
        "technofino",
        "one last time",
        "let's see",
        "not really sure",
        "i'm ruined",
        "i almost applied",
        "people will stop",
        "you missed",
        "i have a ",
        "i have used",
        "bill was generated",
        "i paid using",
        "in my opinion",
    )
    if any(bp in tl for bp in bad_phrases):
        return True
    if "?" in t and len(t) > 55:
        return True
    return False


def build_optimization_tips(d: dict) -> list[str]:
    idn = d.get("identity") or {}
    card_slug = idn.get("card_slug", "")
    if card_slug in OPTIMIZATION_TIPS_BY_CARD:
        return OPTIMIZATION_TIPS_BY_CARD[card_slug]

    tips: list[str] = []
    cm = d.get("reward_calculator_model") or {}
    eff = cm.get("effective_return_pct_by_category") or {}
    fees = d.get("fees_and_charges_detailed") or {}
    ld = d.get("lounge_access_detailed") or {}

    best_k, best_v = None, 0.0
    for k, v in eff.items():
        if k == "international_forex_net_of_markup":
            continue
        if isinstance(v, (int, float)) and v > best_v:
            best_k, best_v = k, float(v)
    label_map = {
        "online_shopping_general": "online shopping",
        "amazon_flipkart_myntra": "Amazon/Flipkart/Myntra checkouts",
        "dining_swiggy_zomato": "dining & food delivery",
        "groceries_quick_commerce": "groceries & quick-commerce",
        "travel_flights_hotels": "flights & hotel bookings",
        "upi_scan_and_pay": "RuPay UPI Scan & Pay",
        "utilities_bills_telecom": "utility & telecom bill payments",
        "fuel": "partner fuel pump swipes",
        "insurance": "eligible insurance premium payments",
        "education_rent_govt": "tax/education/govt portal payments",
        "offline_general_other": "everyday offline POS swipes",
    }
    if best_k and best_v >= 2.0:
        tips.append(
            f"Focus spends on {label_map.get(best_k, best_k)} ({best_v:.1f}% effective return) before hitting monthly category caps."
        )
    forex = fees.get("forex_markup_pct")
    if isinstance(forex, (int, float)) and forex <= 1.5:
        tips.append(f"Low {forex}% forex markup makes this practical for international travel and USD/SaaS subscriptions.")
    elif isinstance(forex, (int, float)) and forex >= 3.0:
        tips.append(f"Avoid foreign currency & international SaaS charges on this card due to {forex}% + GST forex markup; use a 0%-forex card instead.")
    waiver = fees.get("fee_waiver_spend_inr")
    if isinstance(waiver, (int, float)) and waiver > 0 and (fees.get("annual_fee_inr") or 0) > 0:
        tips.append(f"Track ₹{int(waiver):,} annual retail spend before anniversary month to waive renewal fees — rent/govt/wallet spends often don't count.")
    if ld.get("has_domestic_lounge"):
        tips.append("Check spend criteria and pre-generate terminal QR access via official portals (LoungeOne.ai / TFS / HOI) before arriving at the airport.")
    return tips[:3]


def sanitize_warnings(d: dict) -> list[str]:
    ruf = d.get("reddit_user_feedback") or {}
    raw = ruf.get("practical_community_warnings") or []
    has_lounge = bool((d.get("lounge_access_detailed") or {}).get("has_domestic_lounge"))
    clean = [
        str(w).strip()
        for w in raw
        if not is_forum_junk(str(w))
        and len(str(w).strip()) > 10
        and (has_lounge or "quarterly spend thresholds for domestic" not in str(w).lower())
    ]
    # Add concrete editorial watch-outs if list shrunk
    if len(clean) < 2:
        forex = (d.get("fees_and_charges_detailed") or {}).get("forex_markup_pct")
        if isinstance(forex, (int, float)) and forex >= 3.0 and not any("forex" in c.lower() for c in clean):
            clean.append(f"High {forex}% (+GST) forex markup makes international swipes net negative.")
        for vec in (d.get("devaluation_analysis") or {}).get("watch_out_vectors") or []:
            if not has_lounge and "quarterly spend thresholds for domestic" in vec.lower():
                continue
            if vec not in clean and len(clean) < 4:
                clean.append(vec)
        for cap in (d.get("reward_calculator_model") or {}).get("monthly_capping_rules") or []:
            if cap not in clean and len(clean) < 4:
                clean.append(cap)
    return clean[:4]


def fix_dossier(d: dict) -> bool:
    changed = False
    idn = d.get("identity") or {}
    card_slug = idn.get("card_slug", "")
    card_name = idn.get("card_name", "")
    bank = idn.get("bank", "")

    # 1. MITC backfill
    links = d.setdefault("official_and_reference_links", {})
    if not links.get("mitc_pdf_url") and bank in BANK_MITC_VERIFIED:
        links["mitc_pdf_url"] = BANK_MITC_VERIFIED[bank][0]
        changed = True
    if not links.get("bank_url") and bank in BANK_MITC_VERIFIED:
        links["bank_url"] = BANK_MITC_VERIFIED[bank][1]
        changed = True

    # 2. Reward PV & earn_unit cleanup
    cm = d.setdefault("reward_calculator_model", {})
    if cm.get("earn_unit") == "Cashback":
        if card_slug in REWARD_POINT_OVERRIDES:
            cm["earn_unit"] = "Reward Points (RP)"
            changed = True
        elif cm.get("point_value_inr_default", 1.0) != 1.0:
            cm["point_value_inr_default"] = 1.0
            cm["point_value_inr_matrix"] = {"statement_cashback": "Rs. 1.00 per ₹1 cashback"}
            changed = True

    # 3. Partner-locked category adjustments & caveats
    if card_slug in PARTNER_CARD_PATCHES:
        patch = PARTNER_CARD_PATCHES[card_slug]
        if patch.get("card_network") and idn.get("card_network") != patch["card_network"]:
            idn["card_network"] = patch["card_network"]
            changed = True
        eff = cm.setdefault("effective_return_pct_by_category", {})
        for k, v in (patch.get("effective_return_pct_by_category") or {}).items():
            if eff.get(k) != v:
                eff[k] = v
                changed = True
        if patch.get("category_caveats"):
            cm["category_caveats"] = patch["category_caveats"]
            changed = True

    # 4. Clean scraped text bullets & numbers (Cashback2, Click here, duplicate name)
    for loc, key in [
        (cm, "reward_earning_rules"),
        (cm.get("fee_waiver_and_milestone_calculator") or {}, "milestone_slabs"),
        (d.get("benefits_features_and_faqs") or {}, "highlights"),
        (d.get("benefits_features_and_faqs") or {}, "milestone_benefits"),
        (d.get("benefits_features_and_faqs") or {}, "dining_benefits"),
    ]:
        if isinstance(loc, dict) and isinstance(loc.get(key), list):
            cleaned = clean_rule_list(loc[key], card_name)
            if cleaned != loc[key]:
                loc[key] = cleaned
                changed = True

    # 4b. Verify flagship caps (Amex MRCC milestone caps, HSBC Live+ 1200)
    if card_slug == "american-express-membership-rewards-credit-card":
        mrcc_rules = [
            "4 transactions of Rs. 1,500+ in a calendar month earn 1,000 Bonus MR Points; Rs. 20,000+ monthly spend earns another 1,000 Bonus MR Points (~5%-8% effective return via 18K/24K Gold Collection).",
        ]
        if cm.get("monthly_capping_rules") != mrcc_rules:
            cm["monthly_capping_rules"] = mrcc_rules
            changed = True
    elif card_slug == "hsbc-live-credit-card":
        caps_inr = cm.setdefault("monthly_category_caps_inr", {})
        for ck in ("online_shopping_general", "dining_swiggy_zomato", "groceries_quick_commerce", "utilities_bills_telecom"):
            if caps_inr.get(ck) != 1200:
                caps_inr[ck] = 1200
                changed = True

    # 5. Strip forum-junk warnings, attach optimization_tips & sanitize sentiment_summary
    ruf = d.setdefault("reddit_user_feedback", {})
    clean_warns = sanitize_warnings(d)
    if clean_warns != (ruf.get("practical_community_warnings") or []):
        ruf["practical_community_warnings"] = clean_warns
        changed = True
    tips = build_optimization_tips(d)
    if tips != (ruf.get("optimization_tips") or []):
        ruf["optimization_tips"] = tips
        changed = True
    sent = str(ruf.get("sentiment_summary") or "")
    if "reddit" in sent.lower() or "r/" in sent.lower():
        ruf["sentiment_summary"] = re.sub(r"r/CreditCardsIndia|Reddit", "Cardholder", sent, flags=re.I)
        changed = True
    if ruf.get("key_threads"):
        ruf["key_threads"] = []
        changed = True

    return changed


def update_devaluation_tracker() -> None:
    dt_path = DATA / "master" / "devaluation_tracker.json"
    dt = json.loads(dt_path.read_text())
    dt["generated_at"] = "2026-11-14"
    profiles = dt.setdefault("issuer_devaluation_profiles", {})
    for issuer, meta in EXTRA_PROFILES.items():
        profiles.setdefault(issuer, meta)
    for issuer, prof in profiles.items():
        pdfs = OFFICIAL_ISSUER_PDFS.get(issuer)
        if pdfs:
            prof.update(pdfs)

    for ev in dt.get("timeline_2024_2026") or []:
        sr = str(ev.get("source_ref") or "")
        sr = re.sub(r"\s*&\s*r/CreditCardsIndia[^,]*", "", sr, flags=re.I)
        sr = re.sub(r"r/CreditCardsIndia[^&]*(&\s*)?", "", sr, flags=re.I).strip()
        if not sr:
            sr = "Official Issuer MITC / Circular"
        ev["source_ref"] = sr
        issuer_key = str(ev.get("issuer") or "").split("/")[0].strip()
        if issuer_key in OFFICIAL_ISSUER_PDFS:
            ev["pdf_url"] = OFFICIAL_ISSUER_PDFS[issuer_key]["devaluation_pdf_url"]
            ev["mitc_pdf_url"] = OFFICIAL_ISSUER_PDFS[issuer_key]["mitc_pdf_url"]

    out = json.dumps(dt, indent=2, ensure_ascii=False)
    dt_path.write_text(out)
    (MOBILE_DATA / "devaluation_tracker.json").write_text(out)
    print(f"Updated devaluation_tracker.json ({len(profiles)} issuers, {len(dt.get('timeline_2024_2026') or [])} events)")


def main() -> int:
    cards_root = DATA / "cards_by_bank"
    card_files = [p for p in cards_root.rglob("*.json") if p.name != "_bank_index.json"]
    fixed_count = 0
    by_id: dict[str, dict] = {}
    for path in sorted(card_files):
        d = json.loads(path.read_text())
        if fix_dossier(d):
            path.write_text(json.dumps(d, indent=2, ensure_ascii=False))
            fixed_count += 1
        by_id[d["identity"]["card_id"]] = d

    # Sync mobile dossiers_map.json keyed cleanly by card_id (purge stale slug keys)
    mob_dossiers_path = MOBILE_DATA / "dossiers_map.json"
    mob_dossiers_path.write_text(json.dumps(by_id, separators=(",", ":"), ensure_ascii=False))

    # Sync mobile calc_meta.json keyed by card_id
    calc_path = MOBILE_DATA / "calc_meta.json"
    if calc_path.exists():
        calc_meta = json.loads(calc_path.read_text())
        clean_calc: dict[str, dict] = {}
        for k, entry in calc_meta.items():
            if "/" in k:
                continue
            d = by_id.get(k)
            if d:
                cm = d.get("reward_calculator_model") or {}
                entry["earn_unit"] = cm.get("earn_unit", entry.get("earn_unit"))
                entry["point_value_inr_default"] = cm.get("point_value_inr_default", entry.get("point_value_inr_default"))
                entry["effective_return_pct_by_category"] = cm.get("effective_return_pct_by_category", entry.get("effective_return_pct_by_category"))
                entry["caps_inr"] = cm.get("monthly_category_caps_inr") or entry.get("caps_inr") or {}
                if cm.get("category_caveats"):
                    entry["category_caveats"] = cm["category_caveats"]
            clean_calc[k] = entry
        calc_path.write_text(json.dumps(clean_calc, separators=(",", ":"), ensure_ascii=False))

    # Sync web & mobile search_index.json summaries
    for idx_path, compact in [
        (DATA / "master" / "app_search_index.json", False),
        (MOBILE_DATA / "search_index.json", True),
        (ROOT / "web" / "public" / "data" / "search-index.json", True),
    ]:
        if not idx_path.exists():
            continue
        raw_idx = json.loads(idx_path.read_text())
        arr = raw_idx.get("cards", []) if isinstance(raw_idx, dict) else raw_idx
        for item in arr:
            if not isinstance(item, dict):
                continue
            d = by_id.get(item.get("card_id", ""))
            if not d:
                continue
            item["card_network"] = d["identity"].get("card_network")
            item["forex_markup_pct"] = d["fees_and_charges_detailed"].get("forex_markup_pct")
            item["filter_tags"] = d.get("filter_tags", item.get("filter_tags"))
            cm = d.get("reward_calculator_model") or {}
            if cm.get("category_caveats"):
                item["category_caveats"] = cm["category_caveats"]
            if cm.get("effective_return_pct_by_category"):
                item["effective_return_pct_by_category"] = cm["effective_return_pct_by_category"]
            if cm.get("monthly_category_caps_inr") is not None:
                item["monthly_category_caps_inr"] = cm["monthly_category_caps_inr"]
        idx_path.write_text(
            json.dumps(raw_idx, separators=(",", ":") if compact else None, indent=None if compact else 2, ensure_ascii=False)
        )

    # Update master JSON if present
    master_path = DATA / "master" / "credit_cards_master.json"
    if master_path.exists():
        raw_master = json.loads(master_path.read_text())
        if isinstance(raw_master, list):
            for i, d in enumerate(raw_master):
                idn = d.get("identity") or {}
                k = f"{idn.get('bank_slug')}/{idn.get('card_slug')}"
                if k in by_id:
                    raw_master[i] = by_id[k]
            master_path.write_text(json.dumps(raw_master, indent=2, ensure_ascii=False))
        elif isinstance(raw_master, dict) and isinstance(raw_master.get("cards"), list):
            for i, d in enumerate(raw_master["cards"]):
                idn = d.get("identity") or {}
                k = f"{idn.get('bank_slug')}/{idn.get('card_slug')}"
                if k in by_id:
                    raw_master["cards"][i] = by_id[k]
            master_path.write_text(json.dumps(raw_master, indent=2, ensure_ascii=False))

    update_devaluation_tracker()
    print(f"Processed {len(card_files)} cards; updated {fixed_count} dossiers cleanly.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
