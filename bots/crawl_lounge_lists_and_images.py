#!/usr/bin/env python3
"""
Phase 2 Crawler & Asset Harvester:
  1. Downloads card-specific & network official Lounge List PDFs into data/raw/lounges/pdfs/
     and extracts text using pypdf.
  2. Crawls bank/network/aggregator live lounge portals & missing flagship/issuer card pages
     using Crawl4AI into data/raw/lounges/pages/ and data/raw/enrichment/cards_p2/.
  3. Parses all lounge PDFs & crawled lounge tables into data/master/lounge_programs_catalog.json.
  4. Matches & downloads verified card artwork images for all 516 cards into
     data/assets/card_images/<bank_slug>/<card_slug>.<ext> + data/master/card_images_index.json.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
import ssl
from collections import defaultdict
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

import aiohttp
from pypdf import PdfReader
from crawl4ai import AsyncWebCrawler, CacheMode

from config import RAW_DIR, MASTER_DIR, ROOT_DIR, get_browser_config, get_run_config

os.environ["CRAWL4AI_NO_CLOUD_NOTICE"] = "1"

LOUNGE_DIR = RAW_DIR / "lounges"
LOUNGE_PDF_DIR = LOUNGE_DIR / "pdfs"
LOUNGE_PAGE_DIR = LOUNGE_DIR / "pages"
P2_CARDS_DIR = RAW_DIR / "enrichment" / "cards_p2"
ASSETS_IMG_DIR = ROOT_DIR / "data" / "assets" / "card_images"

for d in (LOUNGE_PDF_DIR, LOUNGE_PAGE_DIR, P2_CARDS_DIR, ASSETS_IMG_DIR):
    d.mkdir(parents=True, exist_ok=True)

PERMANENT_SKIP_DOMAINS = {
    "technofino.in",
    "federalbank.co.in",
    "pnbcard.in",
    "unionbankofindia.co.in",
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "*/*",
    "Accept-Language": "en-IN,en-US;q=0.9,en;q=0.8",
}

# Official PDFs discovered across raw crawl + bank portals
LOUNGE_PDF_TARGETS: list[dict[str, str]] = [
    {
        "program_id": "hdfc_regalia_gold",
        "bank": "HDFC Bank",
        "title": "HDFC Regalia Gold Participating Airport Lounge List",
        "url": "https://www.hdfcbank.com/content/bbp/repositories/723fb80a-2dde-42a3-9793-7ae1be57c87f/?path=/Personal/Pay/Cards/Credit%20Card/Credit%20Card%20Landing%20Page/Credit%20Cards/Super%20Premium/Regalia%20Gold%20Credit%20Card/Lounge-List-Regalia-Gold.pdf",
    },
    {
        "program_id": "hdfc_diners_black_intl",
        "bank": "HDFC Bank",
        "title": "HDFC Diners Club Black International Lounge List",
        "url": "https://www.hdfcbank.com/content/bbp/repositories/723fb80a-2dde-42a3-9793-7ae1be57c87f/?path=/Personal/Pay/Cards/Credit%20Card/Credit%20Card%20Landing%20Page/Credit%20Cards/Super%20Premium/Diners%20Club%20Black/International-Lounge-List.pdf",
    },
    {
        "program_id": "hdfc_infinia",
        "bank": "HDFC Bank",
        "title": "HDFC Infinia Airport Lounge Access Program",
        "url": "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/personal-banking/discover-products/cards/credit-cards/infinia-credit-card/airport-lounge-access-program-30sep2025.pdf",
    },
    {
        "program_id": "hdfc_tata_neu_infinity",
        "bank": "HDFC Bank",
        "title": "HDFC Tata Neu Infinity Domestic Airport Lounge List",
        "url": "https://www.hdfcbank.com/content/bbp/repositories/723fb80a-2dde-42a3-9793-7ae1be57c87f/?path=/Personal/Pay/Cards/Credit%20Card/Credit%20Card%20Landing%20Page/Credit%20Cards/Complimentary-Domestic-Airport-Lounge-Access-Tata-Neu-Infinity.pdf",
    },
    {
        "program_id": "hdfc_tata_neu_plus",
        "bank": "HDFC Bank",
        "title": "HDFC Tata Neu Plus Domestic Airport Lounge List",
        "url": "https://www.hdfcbank.com/content/bbp/repositories/723fb80a-2dde-42a3-9793-7ae1be57c87f/?path=/Personal/Pay/Cards/Credit%20Card/Credit%20Card%20Landing%20Page/Credit%20Cards/Complimentary-Domestic-Airport-Lounge-Access-Tata-Neu-Plus.pdf",
    },
    {
        "program_id": "hdfc_tata_neu_milestone",
        "bank": "HDFC Bank",
        "title": "HDFC Tata Neu Milestone Lounge Program",
        "url": "https://www.hdfcbank.com/content/bbp/repositories/723fb80a-2dde-42a3-9793-7ae1be57c87f/?path=/Personal/Pay/Cards/Credit%20Card/Credit%20Card%20Landing%20Page/Credit%20Cards/TATA%20Neu%20Plus%20HDFC%20Bank%20Credit%20Card/Milestone_Lounge_TataNeuCC.pdf",
    },
    {
        "program_id": "hdfc_irctc_railway",
        "bank": "HDFC Bank",
        "title": "HDFC IRCTC Executive Railway Lounge List",
        "url": "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/personal-banking/discover-products/cards/credit-cards/irctc-credit-card/lounge.pdf",
    },
    {
        "program_id": "sbi_elite",
        "bank": "SBI Card",
        "title": "SBI Card ELITE Domestic Airport Lounge List",
        "url": "https://www.sbicard.com/sbi-card-en/assets/docs/pdf/elite-lounge-list.pdf",
    },
    {
        "program_id": "sbi_prime",
        "bank": "SBI Card",
        "title": "SBI Card PRIME Domestic Airport Lounge List",
        "url": "https://www.sbicard.com/sbi-card-en/assets/docs/pdf/prime-lounge-list.pdf",
    },
    {
        "program_id": "axis_lounge_program",
        "bank": "Axis Bank",
        "title": "Axis Bank Airport Lounge Access Program PDF",
        "url": "https://www.axis.bank.in/docs/default-source/default-document-library/axis-bank-airport-lounge-access-program.pdf",
    },
    {
        "program_id": "axis_lounge_tnc",
        "bank": "Axis Bank",
        "title": "Axis Bank Complimentary Lounge Access Terms & Airport List",
        "url": "https://www.axis.bank.in/docs/default-source/default-document-library/terms_conditions_complimentary_lounge_access.pdf",
    },
    {
        "program_id": "hsbc_lounge_tnc",
        "bank": "HSBC Bank",
        "title": "HSBC India Airport Lounge List & Terms",
        "url": "https://www.hsbc.co.in/content/dam/hsbc/in/documents/lounge-list-tnc.pdf",
    },
    {
        "program_id": "idfc_dc_lounge",
        "bank": "IDFC FIRST Bank",
        "title": "IDFC FIRST Bank Domestic Airport Lounge List",
        "url": "https://www.idfcfirst.bank.in/content/dam/idfcfirstbank/pdf/DC-Lounge-Airport-List-01.pdf",
    },
    {
        "program_id": "idfc_lic_select",
        "bank": "IDFC FIRST Bank",
        "title": "IDFC FIRST / LIC Select Airport Lounge List",
        "url": "https://www.idfcfirst.bank.in/content/dam/idfcfirstbank/pdf/credit-card/LIC-Select-Lounge-List.pdf",
    },
    {
        "program_id": "indusind_lounge_program",
        "bank": "IndusInd Bank",
        "title": "IndusInd Bank Airport Lounge Access Program PDF",
        "url": "https://www.indusind.bank.in/content/dam/indusind-corporate/Other/Airport-Lounge-Access-Program.pdf",
    },
    {
        "program_id": "yes_domestic_lounge",
        "bank": "YES BANK",
        "title": "YES BANK Domestic Airport Lounge Access List",
        "url": "https://www.yes.bank.in/pdf?name=ybl_yes_bank_domestic_lounge_access.pdf",
    },
    {
        "program_id": "idbi_mastercard_lounge",
        "bank": "IDBI Bank",
        "title": "IDBI Bank Mastercard Exclusive Airport Lounge List",
        "url": "https://www.idbibank.in/pdf/MASTERCARD-EXCLUSIVE-AIRPORT-LOUNGE-ACCESS.pdf",
    },
    {
        "program_id": "idbi_visa_lounge",
        "bank": "IDBI Bank",
        "title": "IDBI Bank Visa Airport Lounge List",
        "url": "https://www.idbibank.in/pdf/VISA-Airport-Lounge-Access.pdf",
    },
    {
        "program_id": "scapia_federal_lounge",
        "bank": "Federal Bank / Scapia",
        "title": "Scapia Federal Credit Card Updated Unlimited Lounge List",
        "url": "https://res.cloudinary.com/scapiacards/raw/upload/v1741259974/spitha_prod_uploads/2025_03/Updatedloungelist_1741259972146.pdf",
    },
    {
        "program_id": "visa_india_lounges",
        "bank": "Visa Network",
        "title": "Visa Participating Airport Lounges India PDF",
        "url": "https://www.visa.co.in/content/dam/VCOM/regional/ap/india/global-elements/documents/in-participating-airport-lounges.pdf",
    },
    {
        "program_id": "mastercard_india_lounges_pdf",
        "bank": "Mastercard Network",
        "title": "Mastercard Participating Domestic Airport Lounges India PDF",
        "url": "https://specials.priceless.com/mastercard/images/0fd470d4-1ff1-4666-a2bf-63945bde0a25.pdf",
    },
    {
        "program_id": "priority_pass_directory",
        "bank": "Priority Pass Global",
        "title": "Priority Pass Global Airport Lounge Directory PDF",
        "url": "https://d2llguf9uoxb71.cloudfront.net/pp/pdf/Lounge_Directory.pdf",
    },
]

LOUNGE_PAGE_TARGETS: list[dict[str, str]] = [
    {"id": "hoi_hdfc_infinia", "bank": "HDFC Bank", "source_type": "official_partner_page", "url": "https://lms.hoi.in/lounge-list/hdfc-infinia"},
    {"id": "hoi_hdfc_regalia_gold", "bank": "HDFC Bank", "source_type": "official_partner_page", "url": "https://lms.hoi.in/lounge-list/hdfc-regalia-gold"},
    {"id": "hoi_au_cards", "bank": "AU Small Finance Bank", "source_type": "official_partner_page", "url": "https://lms.hoi.in/lounge-list/au-credit-card"},
    {"id": "hdfc_lounge_guide", "bank": "HDFC Bank", "source_type": "official_bank_page", "url": "https://www.hdfc.bank.in/blogs/credit-cards/what-is-airport-lounge-access-credit-card"},
    {"id": "sbi_lounge_page", "bank": "SBI Card", "source_type": "official_bank_page", "url": "https://www.sbicard.com/en/personal/benefits/airport-lounge-access.page"},
    {"id": "axis_lounge_page", "bank": "Axis Bank", "source_type": "official_bank_page", "url": "https://www.axis.bank.in/cards/credit-card/airport-lounge-access-credit-card"},
    {"id": "hsbc_lounge_page", "bank": "HSBC Bank", "source_type": "official_bank_page", "url": "https://www.hsbc.bank.in/credit-cards/airport-lounge-access-credit-card/"},
    {"id": "hsbc_travelone_lk", "bank": "HSBC Bank", "source_type": "official_partner_page", "url": "https://www.loungekey.com/en/hsbctravelone"},
    {"id": "indusind_pp_tnc", "bank": "IndusInd Bank", "source_type": "official_bank_page", "url": "https://www.indusind.bank.in/in/en/personal/tnc-airport-lounges-with-priority-pass.html"},
    {"id": "indusind_tiger_pp", "bank": "IndusInd Bank", "source_type": "official_bank_page", "url": "https://www.indusind.bank.in/in/en/personal/tnc-priority-pass-programme-tiger.html"},
    {"id": "bobcard_lounge_blog", "bank": "BOBCARD (Bank of Baroda)", "source_type": "official_bank_page", "url": "https://www.bobcard.co.in/blogs/choose-the-best-credit-card-for-lounge-access"},
    {"id": "rupay_lounges", "bank": "RuPay Network", "source_type": "official_network_page", "url": "https://www.rupay.co.in/lounges"},
    {"id": "mastercard_priceless", "bank": "Mastercard Network", "source_type": "official_network_page", "url": "https://specials.priceless.com/en-in/offers/Mastercard_India_Lounge_Program?Oid=201902180040&issuerId=&productId="},
    {"id": "visa_lounge_offer", "bank": "Visa Network", "source_type": "official_network_page", "url": "https://www.visa.co.in/en_in/visa-offers-and-perks/visa-airport-lounge-access-program/146561"},
    {"id": "dreamfolks_hdfc_irctc", "bank": "HDFC Bank", "source_type": "official_partner_page", "url": "https://info.dreamfolks.in/partner-outlet-list?filter=YTdnaXh2ZGhKUWIzVFQyVGd6SitIUT09&program_id=dUFUaUZSSStSZFVRb2VwOE9idFAxZz09&service_id=VEhLUGxiZUJ2TkN3OUgyNlJxZUhSQT09"},
]

# Pages specifically for missing flagship & issuer card images / deep product details
EXTRA_CARD_PAGES: list[dict[str, str]] = [
    {"id": "amazon_pay_icici_ci", "url": "https://cardinsider.com/icici-bank/amazon-pay-icici-bank-credit-card/"},
    {"id": "amazon_pay_icici_bank", "url": "https://www.icicibank.com/personal-banking/cards/credit-card/amazon-pay-credit-card"},
    {"id": "cashback_sbi_ci", "url": "https://cardinsider.com/sbi-card/sbi-cashback-credit-card/"},
    {"id": "cashback_sbi_bank", "url": "https://www.sbicard.com/en/personal/credit-cards/cashback-sbi-card.html"},
    {"id": "hsbc_premier_ci", "url": "https://cardinsider.com/hsbc-bank/hsbc-premier-credit-card/"},
    {"id": "hsbc_premier_bank", "url": "https://www.hsbc.co.in/credit-cards/products/premier/"},
    {"id": "indusind_avios_ci", "url": "https://cardinsider.com/indusind-bank/indusind-bank-avios-visa-infinite-credit-card/"},
    {"id": "amex_plat_charge_ci", "url": "https://cardinsider.com/american-express/american-express-platinum-card/"},
    {"id": "amex_plat_charge_bank", "url": "https://www.americanexpress.com/in/credit-cards/platinum-card/"},
    {"id": "onecard_ci", "url": "https://cardinsider.com/onecard-credit-card/"},
    {"id": "bb_rbl", "url": "https://www.bankbazaar.com/credit-card/rbl-credit-card.html"},
    {"id": "bb_icici", "url": "https://www.bankbazaar.com/credit-card/icici-credit-card.html"},
    {"id": "bb_hdfc", "url": "https://www.bankbazaar.com/credit-card/hdfc-credit-card.html"},
    {"id": "bb_sbi", "url": "https://www.bankbazaar.com/credit-card/sbi-credit-card.html"},
    {"id": "bb_indusind", "url": "https://www.bankbazaar.com/credit-card/indusind-credit-card.html"},
    {"id": "bb_yes", "url": "https://www.bankbazaar.com/credit-card/yes-bank-credit-card.html"},
    {"id": "bb_kotak", "url": "https://www.bankbazaar.com/credit-card/kotak-mahindra-credit-card.html"},
    {"id": "bb_bob", "url": "https://www.bankbazaar.com/credit-card/bank-of-baroda-credit-card.html"},
    {"id": "bb_au", "url": "https://www.bankbazaar.com/credit-card/au-small-finance-bank-credit-card.html"},
    {"id": "bb_idfc", "url": "https://www.bankbazaar.com/credit-card/idfc-first-bank-credit-card.html"},
    {"id": "bb_sc", "url": "https://www.bankbazaar.com/credit-card/standard-chartered-credit-card.html"},
    {"id": "bb_hsbc", "url": "https://www.bankbazaar.com/credit-card/hsbc-credit-card.html"},
    {"id": "bb_idbi", "url": "https://www.bankbazaar.com/credit-card/idbi-bank-credit-card.html"},
    {"id": "bb_canara", "url": "https://www.bankbazaar.com/credit-card/canara-bank-credit-card.html"},
    {"id": "bb_boi", "url": "https://www.bankbazaar.com/credit-card/bank-of-india-credit-card.html"},
    {"id": "bb_cbi", "url": "https://www.bankbazaar.com/credit-card/central-bank-of-india-credit-card.html"},
    {"id": "bb_indian", "url": "https://www.bankbazaar.com/credit-card/indian-bank-credit-card.html"},
    {"id": "bb_federal", "url": "https://www.bankbazaar.com/credit-card/federal-bank-credit-card.html"},
    {"id": "ci_rbl", "url": "https://cardinsider.com/rbl-bank/"},
    {"id": "ci_bob", "url": "https://cardinsider.com/bank-of-baroda/"},
    {"id": "ci_idbi", "url": "https://cardinsider.com/idbi-bank/"},
    {"id": "ci_au", "url": "https://cardinsider.com/au-small-finance-bank/"},
    {"id": "ci_kotak", "url": "https://cardinsider.com/kotak-mahindra-bank/"},
    {"id": "ci_icici", "url": "https://cardinsider.com/icici-bank/"},
    {"id": "ci_hdfc", "url": "https://cardinsider.com/hdfc-bank/"},
    {"id": "ci_sbi", "url": "https://cardinsider.com/sbi-card/"},
    {"id": "ci_axis", "url": "https://cardinsider.com/axis-bank/"},
    {"id": "ci_yes", "url": "https://cardinsider.com/yes-bank/"},
]


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def bank_to_slug(bank: str) -> str:
    return slugify(bank.replace("&", "and").replace("/", " "))


def unwrap_image_url(url: str) -> str:
    url = url.strip()
    if "/_next/image/" in url and "url=" in url:
        try:
            qs = parse_qs(urlparse(url).query)
            if "url" in qs and qs["url"]:
                inner = unquote(qs["url"][0])
                if inner.startswith("/"):
                    inner = "https://www.paisabazaar.com" + inner
                return inner
        except Exception:
            pass
    return url


def is_junk_image(url: str, alt: str = "") -> bool:
    ul = url.lower()
    al = alt.lower()
    bad_sub = (
        "themes/impreza",
        "india-flag",
        "customer-support",
        "pb-pass",
        "card-categories",
        "cc-free",
        "logo",
        "favicon",
        "avatar",
        "author",
        "150x150",
        "youtube",
        "googleplay",
        "app-store",
        "appstore",
        "play-store",
        "play_store",
        "bat.bing",
        "scanner",
        "chatbot",
        "menu-link-arrow",
        "accordion",
        "megamenu",
        "mega-menu",
        "compare-cards-icon",
        "digital_loan",
        "quick_approval",
        "creditbanner",
        "facebook",
        "twitter",
        "instagram",
        "linkedin",
        "whatsapp",
        "cross-header",
        "login-icon",
        ".svg",
        "-features.webp",
        "lepakshi",
        "rupanshi",
        "sumit-kumar",
        "shruti",
        "data:image",
        "/pixel.",
        "_pixel.",
        "pixel?",
        "1x1",
        "tracking",
        "debitcard",
        "debit-card",
        "debit_card",
        "forex-card",
        "forex_card",
        "forexplus",
        "forex-prepaid",
        "credit-cards-list",
        "top-kotak-mahindra-credit-cards",
        "invite-only-credit-cards",
        "thumbs.redditmedia",
        "redditstatic",
        "redd.it/",
        "/footer/",
        "blog-assets/images/footer",
        "diners-club.png",
        "benefit_",
        "img_3742",
        "phonewithlogo",
        "google-play-badge",
        "lifestyle-credit-cards",
        "paytm-card-business",
        "coa-meter",
        "cc-assurance",
        "strip-banner",
        "idfc-first-earn-banner",
        "blog-assets/images/en/",
        "meter.png",
        "gauge",
    )
    if any(b in ul for b in bad_sub):
        return True
    if any(b in al for b in ("logo", "icon image of", "author", "scanner", "flag", "qr code", "arrow", "debit card", "forex card")):
        return True
    if not any(ext in ul for ext in (".png", ".jpg", ".jpeg", ".webp", "scene7", "uploads", "cc-image")):
        return True
    return False


async def download_lounge_pdfs(session: aiohttp.ClientSession) -> dict[str, dict[str, Any]]:
    print(f"[Phase2-PDFs] Processing {len(LOUNGE_PDF_TARGETS)} lounge list PDFs...", flush=True)
    sem = asyncio.Semaphore(6)
    results: dict[str, dict[str, Any]] = {}

    async def fetch_one(item: dict[str, str]):
        pid = item["program_id"]
        url = item["url"]
        pdf_path = LOUNGE_PDF_DIR / f"{pid}.pdf"
        txt_path = LOUNGE_PDF_DIR / f"{pid}.txt"

        # Check existing valid txt
        if txt_path.exists() and txt_path.stat().st_size > 200 and pdf_path.exists() and pdf_path.stat().st_size > 1000:
            txt = txt_path.read_text(encoding="utf-8", errors="ignore")
            results[pid] = {
                **item,
                "status": "cached",
                "pdf_path": str(pdf_path.relative_to(ROOT_DIR)),
                "txt_path": str(txt_path.relative_to(ROOT_DIR)),
                "text_length": len(txt),
            }
            return

        async with sem:
            try:
                async with session.get(url, headers=HEADERS, timeout=aiohttp.ClientTimeout(total=35), ssl=False) as resp:
                    if resp.status != 200:
                        results[pid] = {**item, "status": f"http_{resp.status}"}
                        return
                    raw = await resp.read()
                    if not raw.startswith(b"%PDF") and b"%PDF-" not in raw[:1024]:
                        results[pid] = {**item, "status": "non_pdf_payload"}
                        return
                    pdf_path.write_bytes(raw)
                    reader = PdfReader(str(pdf_path))
                    max_p = 80 if "priority_pass" not in pid else 120
                    pages = []
                    for i, page in enumerate(reader.pages[:max_p], 1):
                        t = page.extract_text() or ""
                        if "priority_pass" in pid and "india" not in t.lower() and i > 5:
                            continue
                        if t.strip():
                            pages.append(f"--- Page {i} ---\n{t.strip()}")
                    full_txt = "\n\n".join(pages)
                    txt_path.write_text(full_txt, encoding="utf-8")
                    results[pid] = {
                        **item,
                        "status": "ok" if len(full_txt) > 50 else "ocr_or_empty_pdf",
                        "num_pages": len(reader.pages),
                        "pdf_path": str(pdf_path.relative_to(ROOT_DIR)),
                        "txt_path": str(txt_path.relative_to(ROOT_DIR)),
                        "text_length": len(full_txt),
                    }
                    print(f"  [PDF OK] {pid}: {len(reader.pages)} pages, {len(full_txt)} chars", flush=True)
            except Exception as exc:
                results[pid] = {**item, "status": f"error: {type(exc).__name__}"}

    await asyncio.gather(*(fetch_one(x) for x in LOUNGE_PDF_TARGETS))
    return results


async def crawl_pages_batch(targets: list[dict[str, str]], out_dir: Path, label: str) -> dict[str, dict[str, Any]]:
    print(f"[{label}] Crawling {len(targets)} pages via Crawl4AI...", flush=True)
    sem = asyncio.Semaphore(5)
    bcfg = get_browser_config()
    rcfg = get_run_config(wait_until="domcontentloaded", page_timeout=35000, cache_mode=CacheMode.ENABLED, delay=0.5)
    outcomes: dict[str, dict[str, Any]] = {}

    to_fetch = []
    for t in targets:
        host = urlparse(t["url"]).netloc.lower().lstrip("www.")
        if any(host == d or host.endswith("." + d) for d in PERMANENT_SKIP_DOMAINS):
            continue
        md_file = out_dir / f"{t['id']}.md"
        if md_file.exists() and md_file.stat().st_size > 400:
            outcomes[t["id"]] = {**t, "status": "cached", "md_path": str(md_file.relative_to(ROOT_DIR))}
        else:
            to_fetch.append(t)

    if not to_fetch:
        print(f"[{label}] All {len(outcomes)} pages cached.", flush=True)
        return outcomes

    async with AsyncWebCrawler(config=bcfg) as crawler:
        async def run_one(t: dict[str, str]):
            async with sem:
                try:
                    res = await crawler.arun(url=t["url"], config=rcfg)
                    if res and res.success and res.markdown and len(res.markdown) > 250:
                        md_file = out_dir / f"{t['id']}.md"
                        md_file.write_text(res.markdown, encoding="utf-8")
                        outcomes[t["id"]] = {**t, "status": "ok", "md_path": str(md_file.relative_to(ROOT_DIR)), "chars": len(res.markdown)}
                        print(f"  [{label} OK] {t['id']}: {len(res.markdown)} chars", flush=True)
                    else:
                        outcomes[t["id"]] = {**t, "status": "empty_or_failed"}
                except Exception as exc:
                    outcomes[t["id"]] = {**t, "status": f"error: {type(exc).__name__}"}

        await asyncio.gather(*(run_one(t) for t in to_fetch))
    return outcomes


# ----------------- Lounge Parser -----------------

INDIAN_CITIES = [
    "Agartala", "Agra", "Ahmedabad", "Aizawl", "Allahabad", "Amritsar", "Aurangabad", "Ayodhya",
    "Bagdogra", "Bangalore", "Bengaluru", "Belgaum", "Bhopal", "Bhubaneswar", "Calicut",
    "Chandigarh", "Chennai", "Cochin", "Kochi", "Coimbatore", "Dehradun", "Delhi", "New Delhi",
    "Dibrugarh", "Dimapur", "Durgapur", "Gaya", "Goa", "Dabolim", "Mopa", "Gorakhpur",
    "Guwahati", "Gwalior", "Hubli", "Hyderabad", "Imphal", "Indore", "Jabalpur", "Jaipur",
    "Jammu", "Jodhpur", "Jorhat", "Kannur", "Kanpur", "Khajuraho", "Kolkata", "Kozhikode",
    "Leh", "Lucknow", "Madurai", "Mangalore", "Mangaluru", "Mumbai", "Nagpur", "Nashik",
    "Patna", "Port Blair", "Prayagraj", "Pune", "Raipur", "Rajahmundry", "Rajkot", "Ranchi",
    "Shillong", "Silchar", "Srinagar", "Surat", "Thiruvananthapuram", "Trivandrum",
    "Tiruchirappalli", "Trichy", "Tirupati", "Udaipur", "Vadodara", "Varanasi", "Vijayawada",
    "Visakhapatnam", "Vizag",
]
CITY_RE = re.compile(r"\b(" + "|".join(re.escape(c) for c in INDIAN_CITIES) + r")\b", re.I)


def parse_lounge_entries_from_text(text: str, default_type: str = "Domestic") -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    seen = set()

    # 1. Markdown table lines first
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("|") and s.endswith("|") and not re.match(r"^\|\s*[-:]+", s):
            cols = [c.strip() for c in s.strip("|").split("|")]
            if len(cols) >= 3 and any(CITY_RE.search(c) for c in cols):
                # skip header rows
                joined = " ".join(cols).lower()
                if "city" in joined and ("lounge" in joined or "terminal" in joined):
                    continue
                city_m = None
                for c in cols:
                    m = CITY_RE.search(c)
                    if m:
                        city_m = m.group(1)
                        break
                # find lounge name column
                non_num = [c for c in cols if c and not re.match(r"^\d+\.?$", c)]
                if len(non_num) >= 2:
                    city = city_m or non_num[0]
                    lounge_name = non_num[1] if len(non_num) >= 2 else non_num[0]
                    term = non_num[2] if len(non_num) >= 3 else ""
                    if city.lower() == lounge_name.lower() and len(non_num) >= 3:
                        lounge_name = non_num[2]
                        term = non_num[3] if len(non_num) >= 4 else ""
                    ltype = "International" if "international" in (term + " " + lounge_name).lower() else (
                        "Railway" if "railway" in (term + " " + lounge_name + " " + default_type).lower() else default_type
                    )
                    key = (city.lower(), lounge_name[:40].lower(), term[:25].lower())
                    if key not in seen and len(lounge_name) >= 4:
                        seen.add(key)
                        entries.append({
                            "city": city,
                            "lounge_name": lounge_name[:120],
                            "terminal": term[:80],
                            "terminal_type": ltype,
                        })

    # 2. PDF / plain text line patterns containing Airport/Lounge + known City
    for line in text.splitlines():
        s = re.sub(r"\s+", " ", line).strip()
        if len(s) < 15 or len(s) > 220:
            continue
        m_city = CITY_RE.search(s)
        if not m_city:
            continue
        sl = s.lower()
        if any(k in sl for k in ("lounge", "encalm", "adani", "travel club", "080 ", "primus", "earth ", "bird ", "plaza premium", "executive lounge", "club one", "irctc", "cip lounge", "pranaam")):
            if any(skip in sl for skip in ("click here", "terms and condition", "applicable", "maximum stay", "validation fee", "cardholder")):
                continue
            city = m_city.group(1)
            ltype = "International" if "international" in sl else ("Railway" if ("railway" in sl or "irctc" in sl or "station" in sl) else default_type)
            key = (city.lower(), s[:45].lower(), "")
            if key not in seen:
                seen.add(key)
                tm = re.search(r"\b(T\d+[A-Z]?|Terminal\s*\d+[A-Z]?|Domestic|International)\b", s, re.I)
                entries.append({
                    "city": city,
                    "lounge_name": s[:140],
                    "terminal": tm.group(1) if tm else "",
                    "terminal_type": ltype,
                })

    # 3. Directory link blocks (e.g. CardInsider Airports & Railway Stations listings)
    rail_re = re.compile(
        r"\[\s*([^\[\]!]+?)\s*!\[[^\]]*\]\([^)]+\)\s*([^\[\]]+?)\s+\b([A-Z]{2,5})\b\s+([^\[\]]+?)\s*\]\((https://lounges\.cardinsider\.com/(?:railway-stations|airports)/[A-Z]{2,5})\)"
    )
    for m in rail_re.finditer(text):
        station_or_airport = re.sub(r"\s+", " ", m.group(2)).strip()
        code = m.group(3).strip()
        city = re.sub(r"\s+", " ", m.group(4)).strip().rstrip(",")
        url_link = m.group(5).strip()
        ltype = "Railway" if "/railway-stations/" in url_link else default_type
        key = (city.lower(), station_or_airport[:45].lower(), code.lower())
        if key not in seen:
            seen.add(key)
            entries.append({
                "city": city,
                "lounge_name": f"{station_or_airport} ({code})",
                "terminal": code,
                "terminal_type": ltype,
                "directory_url": url_link,
            })

    return entries[:250]


def build_lounge_programs_catalog(pdf_results: dict, page_results: dict) -> dict[str, Any]:
    lounge_master = json.loads((MASTER_DIR / "lounge_access_master.json").read_text(encoding="utf-8"))
    base_india_lounges = lounge_master.get("participating_indian_airport_lounges", [])

    programs: dict[str, Any] = {}

    # Seed from PDFs + existing data/raw/banks/pdfs
    for item in LOUNGE_PDF_TARGETS:
        pid = item["program_id"]
        res = pdf_results.get(pid, {})
        txt = ""
        txt_rel = res.get("txt_path")
        if txt_rel and (ROOT_DIR / txt_rel).exists():
            txt = (ROOT_DIR / txt_rel).read_text(encoding="utf-8", errors="ignore")
        default_t = "Railway" if "railway" in pid or "irctc" in pid else ("International" if "intl" in pid or "priority_pass" in pid else "Domestic")
        parsed = parse_lounge_entries_from_text(txt, default_type=default_t)
        programs[pid] = {
            "program_id": pid,
            "bank": item["bank"],
            "title": item["title"],
            "official_url": item["url"],
            "source_type": "official_pdf",
            "local_pdf_path": res.get("pdf_path"),
            "local_text_path": txt_rel,
            "crawl_status": res.get("status", "unknown"),
            "parsed_lounges_count": len(parsed),
            "parsed_lounges": parsed,
        }

    # Enrich from SBI Set A & Set B official page + Axis + HSBC + HOI + CardInsider + RuPay/Mastercard/Visa
    sbi_page = RAW_DIR / "banks" / "sbi" / "en_personal_benefits_airport-lounge-access_page.md"
    if not sbi_page.exists():
        sbi_page = LOUNGE_PAGE_DIR / "sbi_lounge_page.md"
    if sbi_page.exists():
        sbi_txt = sbi_page.read_text(encoding="utf-8", errors="ignore")
        if "Set A: List of participating Domestic Airport Lounges" in sbi_txt:
            part_a = sbi_txt.split("Set A: List of participating Domestic Airport Lounges")[1].split("**Set B:")[0]
            parsed_a = parse_lounge_entries_from_text(part_a)
            programs["sbi_set_a"] = {
                "program_id": "sbi_set_a",
                "bank": "SBI Card",
                "title": "SBI Card Set A Participating Domestic Airport Lounges (w.e.f. Jan 2026)",
                "official_url": "https://www.sbicard.com/en/personal/benefits/airport-lounge-access.page",
                "source_type": "official_bank_page",
                "local_text_path": str(sbi_page.relative_to(ROOT_DIR)),
                "crawl_status": "ok",
                "parsed_lounges_count": len(parsed_a),
                "parsed_lounges": parsed_a,
            }
        if "Set B: List of participating Domestic Airport Lounges" in sbi_txt:
            part_b = sbi_txt.split("Set B: List of participating Domestic Airport Lounges")[1]
            parsed_b = parse_lounge_entries_from_text(part_b)
            programs["sbi_set_b"] = {
                "program_id": "sbi_set_b",
                "bank": "SBI Card",
                "title": "SBI Card Set B Participating Domestic Airport Lounges (PRIME / Platinum / Select)",
                "official_url": "https://www.sbicard.com/en/personal/benefits/airport-lounge-access.page",
                "source_type": "official_bank_page",
                "local_text_path": str(sbi_page.relative_to(ROOT_DIR)),
                "crawl_status": "ok",
                "parsed_lounges_count": len(parsed_b),
                "parsed_lounges": parsed_b,
            }

    # Fallback enrichment for any scanned PDF whose OCR failed (e.g. HDFC Regalia Gold -> HOI portal + parsed tables)
    for pt in LOUNGE_PAGE_TARGETS:
        pid = pt["id"]
        md_p = LOUNGE_PAGE_DIR / f"{pid}.md"
        if md_p.exists():
            txt = md_p.read_text(encoding="utf-8", errors="ignore")
            default_t = "Railway" if ("railway" in pid or "ndls" in pid) else "Domestic"
            parsed = parse_lounge_entries_from_text(txt, default_type=default_t)
            programs[f"page_{pid}"] = {
                "program_id": f"page_{pid}",
                "bank": pt["bank"],
                "title": f"{pt['bank']} — {pid.replace('_', ' ').title()}",
                "official_url": pt["url"],
                "source_type": pt.get("source_type", "official_bank_page"),
                "local_text_path": str(md_p.relative_to(ROOT_DIR)),
                "crawl_status": "ok",
                "parsed_lounges_count": len(parsed),
                "parsed_lounges": parsed,
            }
            # Attach HOI Regalia Gold / Infinia / AU parsed entries if PDF was sparse
            if pid == "hoi_hdfc_regalia_gold" and programs.get("hdfc_regalia_gold", {}).get("parsed_lounges_count", 0) < len(parsed):
                programs["hdfc_regalia_gold"]["secondary_url"] = pt["url"]
                programs["hdfc_regalia_gold"]["parsed_lounges"] = parsed
                programs["hdfc_regalia_gold"]["parsed_lounges_count"] = len(parsed)
            if pid == "hoi_hdfc_infinia" and programs.get("hdfc_infinia", {}).get("parsed_lounges_count", 0) < len(parsed):
                programs["hdfc_infinia"]["secondary_url"] = pt["url"]
                programs["hdfc_infinia"]["parsed_lounges"] = parsed
                programs["hdfc_infinia"]["parsed_lounges_count"] = len(parsed)
            if pid == "dreamfolks_hdfc_irctc":
                programs["hdfc_irctc_railway"]["secondary_url"] = pt["url"]
                if programs.get("hdfc_irctc_railway", {}).get("parsed_lounges_count", 0) < len(parsed):
                    programs["hdfc_irctc_railway"]["parsed_lounges"] = parsed
                    programs["hdfc_irctc_railway"]["parsed_lounges_count"] = len(parsed)

    # Also ensure LIC Select existing PDF is linked cleanly
    idfc_lic_txt = RAW_DIR / "banks" / "pdfs" / "idfc_LIC-Select-Lounge-List_pdf.txt"
    if idfc_lic_txt.exists() and programs.get("idfc_lic_select", {}).get("parsed_lounges_count", 0) == 0:
        parsed_lic = parse_lounge_entries_from_text(idfc_lic_txt.read_text(encoding="utf-8", errors="ignore"))
        programs["idfc_lic_select"]["parsed_lounges"] = parsed_lic
        programs["idfc_lic_select"]["parsed_lounges_count"] = len(parsed_lic)

    # IndusInd fallback from banks/pdfs/
    ind_txt = RAW_DIR / "banks" / "pdfs" / "indusind_Airport-Lounge-Access-Program_pdf.txt"
    if ind_txt.exists() and programs.get("indusind_lounge_program", {}).get("parsed_lounges_count", 0) == 0:
        parsed_ind = parse_lounge_entries_from_text(ind_txt.read_text(encoding="utf-8", errors="ignore"))
        programs["indusind_lounge_program"]["parsed_lounges"] = parsed_ind
        programs["indusind_lounge_program"]["parsed_lounges_count"] = len(parsed_ind)

    # Always ensure Visa India / baseline India 73 lounges is clean when PDF had partial table
    if programs.get("visa_india_lounges", {}).get("parsed_lounges_count", 0) < len(base_india_lounges):
        programs["visa_india_lounges"]["parsed_lounges"] = [
            {
                "city": row.get("airport_city_and_lounge", "").split(" Airport ")[0],
                "lounge_name": row.get("airport_city_and_lounge", ""),
                "terminal": row.get("terminal_and_hours", "")[:80],
                "terminal_type": row.get("terminal_type", "Domestic"),
                "lounge_code": row.get("lounge_code", ""),
            }
            for row in base_india_lounges
        ]
        programs["visa_india_lounges"]["parsed_lounges_count"] = len(base_india_lounges)

    catalog = {
        "generated_at": lounge_master.get("generated_at"),
        "total_programs": len(programs),
        "network_rules": lounge_master.get("network_rules", {}),
        "baseline_indian_airport_lounges_count": len(base_india_lounges),
        "programs": programs,
    }
    out_file = MASTER_DIR / "lounge_programs_catalog.json"
    out_file.write_text(json.dumps(catalog, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[Catalog] Saved {len(programs)} lounge programs -> {out_file}", flush=True)
    return catalog


# ----------------- Card Image Resolver & Downloader -----------------

STOPWORDS = {
    "credit", "card", "cards", "bank", "the", "for", "and", "of", "with", "in", "india",
    "ltd", "limited", "financial", "services", "small", "finance", "co", "branded",
    "contactless", "benefits", "features", "apply", "online", "best", "plus", "new",
}


def card_tokens(text: str) -> set[str]:
    toks = set(re.findall(r"[a-z0-9]+", text.lower()))
    return {t for t in toks if t not in STOPWORDS and len(t) >= 2}


BANK_MARKER_PATTERNS: dict[str, tuple[str, ...]] = {
    "hdfc": ("hdfc",),
    "sbi": ("sbi", "state bank of india"),
    "icici": ("icici",),
    "axis": ("axis",),
    "kotak": ("kotak",),
    "idfc": ("idfc",),
    "indusind": ("indusind",),
    "amex": ("amex", "american express", "american-express"),
    "hsbc": ("hsbc",),
    "rbl": ("rbl",),
    "yes": ("yes bank", "yes-bank", "yes_bank", "yesbank", "yes-prosperity", "yes-marquee", "yes-private", "yes-first", "yes-reserv"),
    "bob": ("bobcard", "bank of baroda", "bank-of-baroda", "bob "),
    "au": ("au small", "au bank", "au-bank", "au-small", "au-credit", "au-", "aubank", "aditya birla au"),
    "pnb": ("pnb", "punjab national"),
    "boi": ("bank of india", "bank-of-india", "boi "),
    "cbi": ("central bank of india", "central-bank-of-india", "cbi "),
    "union": ("union bank", "union-bank"),
    "canara": ("canara",),
    "idbi": ("idbi",),
    "federal": ("federal", "scapia"),
    "onecard": ("onecard", "one-card", "one card"),
    "standard_chartered": ("standard chartered", "standard-chartered", "stanchart", "scb "),
    "indian_bank": ("indian bank", "indian-bank"),
    "iob": ("indian overseas", "indian-overseas", "iob"),
    "karur": ("karur vysya", "karur-vysya", "kvb"),
    "uco": ("uco bank", "uco-bank"),
    "maharashtra": ("bank of maharashtra", "bank-of-maharashtra", "mahabank"),
    "dbs": ("dbs",),
    "sbm": ("sbm",),
    "bandhan": ("bandhan",),
    "utkarsh": ("utkarsh",),
    "tmb": ("tamilnad", "tmb"),
    "south_indian": ("south indian", "south-indian"),
    "csb": ("csb",),
    "unity": ("unity",),
    "lic": ("lic ", "lic-"),
}

STRICT_BANK_REQUIRED = {
    "pnb", "boi", "cbi", "union", "canara", "idbi", "indian_bank", "iob",
    "karur", "uco", "maharashtra", "dbs", "sbm", "bandhan", "utkarsh",
    "tmb", "south_indian", "csb", "unity", "federal", "standard_chartered",
}

GENERIC_NETWORK_TOKENS = {
    "visa", "mastercard", "rupay", "amex", "platinum", "gold", "select",
    "classic", "signature", "world", "business", "corporate", "supercard",
    "infinite", "titanium", "rewards", "reward", "exclusive", "plus", "edge",
}

DISTINCTIVE_PRODUCT_TOKENS = {
    "air", "irctc", "adani", "swiggy", "flipkart", "amazon", "tata", "neu",
    "indigo", "6e", "marriott", "eazydiner", "hpcl", "bpcl", "iocl", "indianoil",
    "phonepe", "bharatpe", "kiwi", "supermoney", "pvr", "inox", "shoppers",
    "times", "delight", "essentia", "veer", "league", "aurum", "elite", "prime",
    "cashback", "safari", "zenith", "privilege", "rewardz", "clubmiles",
    "intermiles", "vistara", "explorer", "coral", "rubyx", "sapphiro",
    "emeralde", "magnus", "atlas", "olympus", "horizon", "scapia", "onecard",
    "uni", "pixel", "millennia", "regalia", "infinia", "diners", "moneyback",
    "freedom", "bharat", "giga", "winnings", "eclat", "lumine", "royale",
    "euphoria", "manhattan", "landmark", "advantage", "choice", "maxima",
    "supercard", "play", "go", "premier", "avios", "icai", "icsi",
    "makemytrip", "mmt", "samsung", "feast", "cma", "paytm", "black",
    "rewardz", "myzone", "signature", "plum", "wings",
}


def detect_bank_groups(text: str) -> set[str]:
    low = " " + re.sub(r"[_/]+", " ", text.lower()) + " "
    found: set[str] = set()
    for bkey, pats in BANK_MARKER_PATTERNS.items():
        if any(p in low for p in pats):
            if bkey == "indian_bank" and "south indian" in low:
                continue
            if bkey == "boi" and ("central bank of india" in low or "state bank of india" in low or "union bank of india" in low):
                if "boi" not in low:
                    continue
            found.add(bkey)
    return found


def collect_raw_image_candidates() -> list[dict[str, Any]]:
    """Collect candidate card image entries across raw corpus without parent-file token pollution."""
    img_re = re.compile(r'!\[([^\]]*)\]\((https?://[^)\s]+)\)')
    candidates: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    # 1. Paisabazaar card pages (highest fidelity when present in header lines)
    for md in sorted((RAW_DIR / "paisabazaar" / "cards").glob("*.md")):
        txt = md.read_text(encoding="utf-8", errors="ignore")
        head = "\n".join(txt.splitlines()[:95])
        for alt, raw_u in img_re.findall(head):
            u = unwrap_image_url(raw_u)
            if is_junk_image(u, alt):
                continue
            if u not in seen_urls or "Image of " in alt:
                seen_urls.add(u)
                url_stem = Path(urlparse(u).path).stem
                alt_toks = card_tokens(alt)
                stem_toks = card_tokens(url_stem)
                candidates.append({
                    "url": u,
                    "alt": alt,
                    "source": "paisabazaar_card",
                    "pb_stem": md.stem,
                    "url_stem_tokens": stem_toks,
                    "own_tokens": stem_toks | alt_toks,
                    "tokens": stem_toks | alt_toks | card_tokens(md.stem),
                    "bank_groups": detect_bank_groups(url_stem + " " + alt + " " + md.stem),
                })
                break

    # 2. All other crawled directories (use URL stem + alt text ONLY, not page stem!)
    other_dirs = [
        ("enrichment_p2", P2_CARDS_DIR),
        ("enrichment", RAW_DIR / "enrichment"),
        ("bank_official", RAW_DIR / "banks"),
        ("aggregator_bb", RAW_DIR / "aggregators" / "bankbazaar"),
        ("aggregator_ci", RAW_DIR / "aggregators" / "cardinsider"),
        ("aggregator_ce", RAW_DIR / "aggregators" / "cardexpert"),
        ("aggregator_fin", RAW_DIR / "aggregators" / "fintechs"),
        ("pb_banks", RAW_DIR / "paisabazaar" / "banks"),
        ("pb_guides", RAW_DIR / "paisabazaar" / "guides"),
    ]
    for src_name, d in other_dirs:
        if not d.exists():
            continue
        for md in sorted(d.rglob("*.md")):
            txt = md.read_text(encoding="utf-8", errors="ignore")
            for alt, raw_u in img_re.findall(txt):
                u = unwrap_image_url(raw_u)
                if is_junk_image(u, alt):
                    continue
                if u in seen_urls:
                    continue
                seen_urls.add(u)
                url_stem = Path(urlparse(u).path).stem
                stem_toks = card_tokens(url_stem)
                alt_toks = card_tokens(alt)
                own_toks = stem_toks | alt_toks
                if not own_toks:
                    continue
                candidates.append({
                    "url": u,
                    "alt": alt,
                    "source": src_name,
                    "pb_stem": "",
                    "url_stem_tokens": stem_toks,
                    "own_tokens": own_toks,
                    "tokens": own_toks,
                    "bank_groups": detect_bank_groups(url_stem + " " + alt),
                })
    return candidates


def resolve_images_for_cards(cards: list[dict[str, Any]], candidates: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    pb_stem_map = {c["pb_stem"]: c for c in candidates if c.get("pb_stem")}

    # Index other candidates by own_tokens (url_stem + alt) for fast strict matching
    token_idx: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for cand in candidates:
        if cand["source"] == "paisabazaar_card":
            continue
        for tok in cand["own_tokens"]:
            token_idx[tok].append(cand)

    src_priority = {
        "paisabazaar_card": 100,
        "enrichment_p2": 50,
        "enrichment": 45,
        "bank_official": 40,
        "aggregator_bb": 35,
        "aggregator_ci": 30,
        "pb_banks": 25,
        "pb_guides": 20,
        "aggregator_ce": 15,
        "aggregator_fin": 15,
    }

    matched: dict[str, dict[str, Any]] = {}
    for card in cards:
        cid = card["card_id"]
        cname = card["card_name"]
        bank = card["bank"]
        pb_url = (card.get("sources") or {}).get("paisabazaar_url") or ""
        pb_stem = ""
        if pb_url:
            parts = [p for p in pb_url.strip("/").split("/") if p]
            if len(parts) >= 2:
                pb_stem = f"{parts[-2]}_{parts[-1]}"

        if pb_stem and pb_stem in pb_stem_map:
            hit = pb_stem_map[pb_stem]
            matched[cid] = {
                "card_id": cid,
                "card_name": cname,
                "bank": bank,
                "image_url": hit["url"],
                "image_source": "paisabazaar_card",
                "match_confidence": 1.0,
            }
            continue

        c_toks = card_tokens(cname)
        b_toks = card_tokens(bank)
        full_toks = c_toks | b_toks
        card_banks = detect_bank_groups(bank + " " + cname)
        card_distinct = DISTINCTIVE_PRODUCT_TOKENS & c_toks
        card_specific = c_toks - GENERIC_NETWORK_TOKENS

        scored: dict[str, tuple[float, dict[str, Any]]] = {}
        seen_cands: set[str] = set()
        for tok in c_toks:
            for cand in token_idx.get(tok, []):
                u = cand["url"]
                if u in seen_cands:
                    continue
                seen_cands.add(u)

                cand_banks = cand["bank_groups"]
                # Hard cross-bank guard
                if card_banks and cand_banks and not (card_banks & cand_banks):
                    continue
                # Strict bank requirement for PSU/regional/uncommon banks so generic network images never leak across issuers
                if (card_banks & STRICT_BANK_REQUIRED) and not (card_banks & cand_banks):
                    continue

                stem_toks = cand["url_stem_tokens"]
                own_toks = cand["own_tokens"]

                # Hard distinctive-product guard (avoid e.g. Adani/Delight/IRCTC/Air-India leaking onto sibling cards)
                cand_distinct = DISTINCTIVE_PRODUCT_TOKENS & stem_toks
                if cand_distinct and not cand_distinct.issubset(c_toks):
                    continue
                if card_distinct and not card_distinct.intersection(own_toks):
                    continue

                overlap = len(c_toks & own_toks)
                if not c_toks:
                    continue
                specific_overlap = len(card_specific & own_toks)
                if specific_overlap == 0 and len(card_specific) >= 1 and not (card_banks & cand_banks):
                    continue

                ratio = overlap / max(1, len(c_toks))
                stem_overlap = len(c_toks & stem_toks)
                score = ratio * 60 + stem_overlap * 25 + src_priority.get(cand["source"], 10) * 0.4
                extra = (stem_toks - full_toks - {"card", "credit", "cc", "image", "png", "jpg", "webp", "new", "art", "large", "mobile"})
                score -= len(extra) * 5

                if overlap >= 2 and (specific_overlap >= 1 or (card_banks & cand_banks)) or (len(c_toks) == 1 and overlap == 1 and (card_banks & cand_banks)):
                    scored[u] = (score, cand)

        if scored:
            best_score, best_cand = max(scored.values(), key=lambda x: x[0])
            if best_score >= 60:
                matched[cid] = {
                    "card_id": cid,
                    "card_name": cname,
                    "bank": bank,
                    "image_url": best_cand["url"],
                    "image_source": best_cand["source"],
                    "match_confidence": round(min(0.98, best_score / 100.0), 2),
                }
                continue

        matched[cid] = {
            "card_id": cid,
            "card_name": cname,
            "bank": bank,
            "image_url": None,
            "image_source": None,
            "match_confidence": 0.0,
        }
    return matched


async def download_card_images(session: aiohttp.ClientSession, matched: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    sem = asyncio.Semaphore(12)
    targets = [m for m in matched.values() if m.get("image_url")]
    print(f"[Images] Downloading verified card artwork for {len(targets)}/{len(matched)} cards...", flush=True)

    async def dl_one(entry: dict[str, Any]):
        url = entry["image_url"]
        bslug = bank_to_slug(entry["bank"])
        cslug = slugify(entry["card_name"]) or entry["card_id"]
        bank_dir = ASSETS_IMG_DIR / bslug
        bank_dir.mkdir(parents=True, exist_ok=True)

        # Guess ext from url
        path_lower = urlparse(url).path.lower()
        ext = ".png"
        for e in (".webp", ".jpg", ".jpeg", ".png"):
            if path_lower.endswith(e):
                ext = e
                break
        dest = bank_dir / f"{cslug}{ext}"

        if dest.exists() and dest.stat().st_size > 800:
            entry["local_image_path"] = str(dest.relative_to(ROOT_DIR))
            entry["download_status"] = "cached"
            return

        async with sem:
            try:
                ref = f"https://{urlparse(url).netloc}/"
                hdrs = {**HEADERS, "Referer": ref, "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"}
                async with session.get(url, headers=hdrs, timeout=aiohttp.ClientTimeout(total=20), ssl=False) as resp:
                    if resp.status != 200:
                        entry["local_image_path"] = None
                        entry["download_status"] = f"http_{resp.status}"
                        return
                    ctype = (resp.headers.get("Content-Type") or "").lower()
                    data = await resp.read()
                    if len(data) < 800 or ("image" not in ctype and not data[:4] in (b"\x89PNG", b"\xff\xd8\xff\xe0", b"\xff\xd8\xff\xe1", b"RIFF")):
                        entry["local_image_path"] = None
                        entry["download_status"] = "invalid_image_payload"
                        return
                    if "webp" in ctype:
                        ext = ".webp"
                    elif "jpeg" in ctype or "jpg" in ctype:
                        ext = ".jpg"
                    elif "png" in ctype:
                        ext = ".png"
                    dest = bank_dir / f"{cslug}{ext}"
                    dest.write_bytes(data)
                    entry["local_image_path"] = str(dest.relative_to(ROOT_DIR))
                    entry["download_status"] = "ok"
            except Exception as exc:
                entry["local_image_path"] = None
                entry["download_status"] = f"error: {type(exc).__name__}"

    await asyncio.gather(*(dl_one(e) for e in targets))
    return matched


async def main():
    connector = aiohttp.TCPConnector(limit=16, ssl=False)
    async with aiohttp.ClientSession(connector=connector) as session:
        # 1 & 2. Download Lounge PDFs + Crawl Lounge Pages & Missing Card Art Pages concurrently-clean
        pdf_results = await download_lounge_pdfs(session)
        lounge_page_results = await crawl_pages_batch(LOUNGE_PAGE_TARGETS, LOUNGE_PAGE_DIR, "Phase2-LoungePages")
        p2_card_results = await crawl_pages_batch(EXTRA_CARD_PAGES, P2_CARDS_DIR, "Phase2-CardPages")

        # 3. Build Lounge Programs Catalog
        build_lounge_programs_catalog(pdf_results, lounge_page_results)

        # 4. Resolve & Download Card Artwork Images for all 516 cards
        master = json.loads((MASTER_DIR / "credit_cards_master.json").read_text(encoding="utf-8"))
        cards = master["cards"]
        candidates = collect_raw_image_candidates()
        print(f"[Images] Collected {len(candidates)} unique raw image candidates across corpus.", flush=True)
        matched = resolve_images_for_cards(cards, candidates)

        # Invalidate any previously downloaded artwork if resolved image_url changed or became None
        idx_path = MASTER_DIR / "card_images_index.json"
        if idx_path.exists():
            try:
                prev_imgs = json.loads(idx_path.read_text(encoding="utf-8")).get("images", {})
                for cid, prev in prev_imgs.items():
                    prev_path = prev.get("local_image_path")
                    cur = matched.get(cid, {})
                    if prev_path and prev.get("image_url") != cur.get("image_url"):
                        p_abs = ROOT_DIR / prev_path
                        if p_abs.exists():
                            p_abs.unlink()
            except Exception:
                pass

        matched = await download_card_images(session, matched)

        # Prune any orphan files under ASSETS_IMG_DIR not referenced in card_images_index.json
        valid_paths = {v["local_image_path"] for v in matched.values() if v.get("local_image_path")}
        for f in ASSETS_IMG_DIR.rglob("*"):
            if f.is_file() and str(f.relative_to(ROOT_DIR)) not in valid_paths:
                f.unlink()

        with_url = sum(1 for v in matched.values() if v.get("image_url"))
        with_local = sum(1 for v in matched.values() if v.get("local_image_path"))
        out_idx = {
            "total_cards": len(cards),
            "cards_with_image_url": with_url,
            "cards_with_local_image": with_local,
            "images": matched,
        }
        idx_path.write_text(json.dumps(out_idx, indent=2, ensure_ascii=False), encoding="utf-8")
        print(
            f"[Images DONE] url={with_url}/{len(cards)}, local_cached={with_local}/{len(cards)} -> {idx_path}",
            flush=True,
        )


if __name__ == "__main__":
    asyncio.run(main())
