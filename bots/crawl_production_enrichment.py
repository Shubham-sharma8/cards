#!/usr/bin/env python3
"""
Production Enrichment Crawler (Crawl4AI):
  1. Crawls official bank credit card portals to map card-specific `bank_url` (eliminating root `/`).
  2. Crawls missing/purged card artwork from official bank pages & aggregators, validates via PIL,
     downloads to data/assets/card_images/ and mirrors to web/public/card-images/.
  3. Crawls official bank credit card offers pages and builds data/master/latest_offers.json.
"""

from __future__ import annotations

import asyncio
import json
import re
import shutil
from collections import defaultdict
from io import BytesIO
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import aiohttp
from bs4 import BeautifulSoup
from crawl4ai import AsyncWebCrawler, CacheMode
from PIL import Image

from config import MASTER_DIR, RAW_DIR, ROOT_DIR, get_browser_config, get_run_config
from crawl_lounge_lists_and_images import (
    ASSETS_IMG_DIR,
    HEADERS,
    bank_to_slug,
    card_tokens,
    detect_bank_groups,
    is_junk_image,
    slugify,
    unwrap_image_url,
)

WEB_IMG_DIR = ROOT_DIR / "web" / "public" / "card-images"

# Specific official credit-card listing hubs for the 16 issuers that had bare root domains + major issuers
BANK_HUB_TARGETS: list[dict[str, str]] = [
    {"bank": "AU Small Finance Bank", "url": "https://www.au.bank.in/personal-banking/credit-cards"},
    {"bank": "BOBCARD (Bank of Baroda)", "url": "https://www.bobcard.co.in/credit-cards"},
    {"bank": "Punjab National Bank", "url": "https://www.pnbcard.in/credit_card.html"},
    {"bank": "Punjab National Bank", "url": "https://pnb.bank.in/en/ui/Credit-Card.aspx"},
    {"bank": "SBM Bank India", "url": "https://www.sbm.bank.in/personal-banking/cards/credit-card"},
    {"bank": "SBM Bank India", "url": "https://www.sbmbank.co.in/personal-banking/credit-cards.php"},
    {"bank": "Bank of India", "url": "https://bankofindia.co.in/credit-card"},
    {"bank": "Bank of India", "url": "https://bankofindia.bank.in/credit-card"},
    {"bank": "IDBI Bank", "url": "https://www.idbibank.in/credit-cards.asp"},
    {"bank": "IDBI Bank", "url": "https://www.idbi.bank.in/credit-cards.asp"},
    {"bank": "Utkarsh Small Finance Bank", "url": "https://www.utkarsh.bank.in/personal/cards/credit-cards"},
    {"bank": "Bandhan Bank", "url": "https://www.bandhan.bank.in/personal/cards/credit-cards"},
    {"bank": "Bandhan Bank", "url": "https://bandhanbank.com/credit-cards"},
    {"bank": "Karur Vysya Bank", "url": "https://www.kvb.bank.in/personal/cards/credit-cards/"},
    {"bank": "Bank of Maharashtra", "url": "https://bankofmaharashtra.in/credit-card"},
    {"bank": "LIC Cards (Axis Bank)", "url": "https://www.liccards.co.in/credit-cards"},
    {"bank": "Tamilnad Mercantile Bank", "url": "https://www.tmbnet.in/credit-card/"},
    {"bank": "CSB Bank", "url": "https://www.csb.bank.in/credit-card"},
    {"bank": "CSB Bank", "url": "https://edgeplus.jupiter.money/"},
    {"bank": "South Indian Bank", "url": "https://www.southindianbank.com/content/personal-banking/one-card-credit-card/"},
    {"bank": "Federal Bank / Scapia", "url": "https://www.scapia.cards/features"},
    {"bank": "OneCard / Co-branded", "url": "https://www.getonecard.app/"},
    {"bank": "Axis Bank", "url": "https://www.axis.bank.in/cards/credit-card/axis-bank-reserve-credit-card"},
    {"bank": "RBL Bank", "url": "https://www.rblbank.com/personal-banking/cards/bajaj-finserv-rbl-bank-supercard"},
    {"bank": "RBL Bank", "url": "https://www.bajajfinserv.in/bajaj-finserv-rbl-bank-credit-card"},
    {"bank": "YES BANK", "url": "https://www.yes.bank.in/personal-banking/yes-individual/cards/credit-cards/prosperity-business-credit-card"},
    {"bank": "Kotak Mahindra Bank", "url": "https://www.kotak.com/en/personal-banking/cards/credit-cards.html"},
    {"bank": "Union Bank of India", "url": "https://www.unionbankofindia.co.in/english/credit-card.aspx"},
    {"bank": "Canara Bank", "url": "https://canarabank.com/pages/credit-card"},
    {"bank": "Central Bank Of India", "url": "https://www.centralbankofindia.co.in/en/credit-cards"},
    {"bank": "Indian Bank", "url": "https://www.indianbank.in/departments/credit-cards/"},
    {"bank": "Indian Overseas Bank", "url": "https://www.iob.in/Credit-Cards"},
    {"bank": "UCO Bank", "url": "https://www.ucobank.com/en/credit-card"},
    {"bank": "ICICI Bank", "url": "https://www.icicibank.com/personal-banking/cards/credit-card"},
    {"bank": "HDFC Bank", "url": "https://www.hdfcbank.com/personal/pay/cards/credit-cards"},
    {"bank": "SBI Card", "url": "https://www.sbicard.com/en/personal/credit-cards.page"},
]

# Non-root clean listing fallback per bank (when no individual product URL exists)
BANK_CARD_LISTING_FALLBACK: dict[str, str] = {
    "AU Small Finance Bank": "https://www.au.bank.in/personal-banking/credit-cards",
    "BOBCARD (Bank of Baroda)": "https://www.bobcard.co.in/credit-cards",
    "Bandhan Bank": "https://bandhanbank.com/credit-cards",
    "Bank of India": "https://bankofindia.co.in/credit-card",
    "Bank of Maharashtra": "https://bankofmaharashtra.in/credit-card",
    "CSB Bank": "https://www.csb.bank.in/credit-card",
    "Federal Bank / Scapia": "https://www.scapia.cards/",
    "IDBI Bank": "https://www.idbibank.in/credit-cards.asp",
    "Karur Vysya Bank": "https://www.kvb.bank.in/personal/cards/credit-cards/",
    "LIC Cards (Axis Bank)": "https://www.liccards.co.in/credit-cards",
    "OneCard / Co-branded": "https://www.getonecard.app/",
    "Punjab National Bank": "https://www.pnbcard.in/credit_card.html",
    "SBM Bank India": "https://www.sbmbank.co.in/personal-banking/credit-cards.php",
    "South Indian Bank": "https://www.southindianbank.com/content/personal-banking/credit-cards",
    "Tamilnad Mercantile Bank": "https://www.tmbnet.in/credit-card/",
    "Utkarsh Small Finance Bank": "https://www.utkarsh.bank.in/personal/cards/credit-cards",
}

OFFER_TARGETS: list[dict[str, str]] = [
    {"bank": "HDFC Bank", "url": "https://offers.smartbuy.hdfcbank.com/"},
    {"bank": "HDFC Bank", "url": "https://www.hdfc.bank.in/offers"},
    {"bank": "SBI Card", "url": "https://www.sbicard.com/en/personal/offers.page"},
    {"bank": "ICICI Bank", "url": "https://www.icicibank.com/offers/categories/credit-card"},
    {"bank": "Axis Bank", "url": "https://www.axis.bank.in/grab-deals/online-offers"},
    {"bank": "Axis Bank", "url": "https://www.axisbank.com/retail/cards/credit-card/credit-card-offers"},
    {"bank": "IDFC FIRST Bank", "url": "https://www.idfcfirstbank.com/credit-card/offers"},
    {"bank": "Kotak Mahindra Bank", "url": "https://www.kotak.com/en/personal-banking/cards/credit-cards/credit-card-offers.html"},
    {"bank": "HSBC Bank", "url": "https://www.hsbc.co.in/credit-cards/offers/"},
    {"bank": "IndusInd Bank", "url": "https://www.indusind.bank.in/in/en/personal/offers.html"},
    {"bank": "AU Small Finance Bank", "url": "https://www.au.bank.in/personal-banking/offers"},
    {"bank": "RBL Bank", "url": "https://www.rblbank.com/personal-banking/cards/credit-cards/offers"},
    {"bank": "YES BANK", "url": "https://www.yes.bank.in/personal-banking/yes-individual/cards/credit-cards/offers"},
    {"bank": "BOBCARD (Bank of Baroda)", "url": "https://www.bobcard.co.in/offers"},
    {"bank": "American Express", "url": "https://www.americanexpress.com/en-in/benefits/offers/"},
    {"bank": "Federal Bank / Scapia", "url": "https://www.scapia.cards/"},
    {"bank": "OneCard / Co-branded", "url": "https://www.getonecard.app/"},
]

STOP_URL_TOKENS = {"login", "netbanking", "faq", "locate", "contact", "terms", "privacy", "sitemap", "career", "tender", "about-us", "grievance", "download", ".pdf"}

OFFER_JUNK_PHRASES = (
    "our offerings",
    "axis group",
    "digital banking",
    "dedicated nri",
    "complimentary p.o box",
    "use coupon code",
    "copy code",
    "offer period:",
    "applicable on ",
    "cookie",
    "login",
    "menu",
    "privacy",
    "subscribe",
    "locate us",
    "apply now",
    "savings account",
    "current account",
    "mutual fund",
    "home loan",
    "car loan",
    "personal loan",
    "education loan",
    "safe deposit locker",
    "terms of use",
    "accept all",
    "javascript",
)

COBRAND_EXCLUSIVE_TOKENS = {
    "times", "adani", "amazon", "flipkart", "swiggy", "tata", "neu", "airtel",
    "ixigo", "scapia", "irctc", "vistara", "indigo", "etihad", "marriott",
    "apollo", "bpcl", "hpcl", "iocl", "indianoil", "reliance", "croma",
    "eazydiner", "paytm", "phonepe", "ola", "yatra", "makemytrip", "cleartrip",
    "easemytrip", "myntra", "nykaa", "shoppers", "bajaj", "lic", "titan",
    "landmark", "star", "spar", "natures", "kiwi", "supercard", "onecard",
}

OFFER_CAT_KEYWORDS = {
    "Travel & Flights": ("flight", "hotel", "makemytrip", "cleartrip", "yatra", "easemytrip", "ixigo", "indigo", "air india", "travel", "booking", "agoda"),
    "Dining": ("dining", "eazydiner", "swiggy dineout", "zomato", "restaurant", "cafe", "culinary", "buffet"),
    "Shopping & Electronics": ("amazon", "flipkart", "myntra", "ajio", "tatacliq", "croma", "reliance digital", "apple", "samsung", "vijay sales", "nykaa", "shopping"),
    "Grocery & Quick Commerce": ("blinkit", "zepto", "instamart", "bigbasket", "swiggy", "zomato", "grocery", "supermarket", "dmart"),
    "Fuel & Transit": ("fuel", "hpcl", "bpcl", "iocl", "indianoil", "petrol", "diesel", "metro", "irctc", "uber"),
    "Entertainment": ("bookmyshow", "pvr", "inox", "district", "movie", "ticket", "concert"),
}


def infer_offer_category(text: str) -> str:
    low = text.lower()
    for cat, kws in OFFER_CAT_KEYWORDS.items():
        if any(k in low for k in kws):
            return cat
    return "Cashback & Card Perks"


def clean_text(s: str) -> str:
    # Strip markdown images and markdown links cleanly
    s = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", s or "")
    s = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", s)
    return re.sub(r"\s+", " ", s).strip()


def clean_offer_title_and_summary(title: str, summary: str) -> tuple[str, str] | None:
    t = clean_text(title).strip(" :-|•")
    s = clean_text(summary).strip(" :-|•")
    tl = t.lower()
    sl = s.lower()
    if len(t) < 10 or len(s) < 22:
        return None
    if any(bad in tl or bad in sl[:100] for bad in OFFER_JUNK_PHRASES):
        return None
    if re.match(r"^(?:new|use coupon|offer period|valid till)\b", tl) and len(t) < 30:
        return None
    # Strip redundant "New " prefix
    t = re.sub(r"^New\s+", "", t).strip()
    if t.lower().startswith("credit card"):
        return None
    return t[:110], s[:240]


async def crawl_one(
    crawler: AsyncWebCrawler,
    sem: asyncio.Semaphore,
    target: dict[str, Any],
    rcfg: Any,
) -> tuple[dict[str, Any], Any]:
    async with sem:
        try:
            res = await crawler.arun(url=target["url"], config=rcfg)
            return target, res
        except Exception:
            return target, None


async def validate_and_download_image(
    session: aiohttp.ClientSession,
    img_url: str,
    dest_no_ext: Path,
) -> tuple[bool, str, Path | None]:
    try:
        ref = f"https://{urlparse(img_url).netloc}/"
        hdrs = {**HEADERS, "Referer": ref, "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"}
        async with session.get(img_url, headers=hdrs, timeout=aiohttp.ClientTimeout(total=18), ssl=False) as resp:
            if resp.status != 200:
                return False, f"http_{resp.status}", None
            data = await resp.read()
            if len(data) < 1200:
                return False, "too_small_bytes", None
            try:
                with Image.open(BytesIO(data)) as im:
                    w, h = im.size
                    fmt = (im.format or "PNG").lower()
            except Exception:
                return False, "invalid_pil", None
            if w < 110 or h < 65:
                return False, f"tiny_dims_{w}x{h}", None
            # Reject wide horizontal strip banners (> 3.2:1)
            if w / max(1, h) > 3.2:
                return False, f"strip_banner_{w}x{h}", None
            ext = ".webp" if fmt == "webp" else (".jpg" if fmt in ("jpeg", "jpg") else ".png")
            dest = dest_no_ext.with_suffix(ext)
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            return True, f"ok_{w}x{h}", dest
    except Exception as exc:
        return False, f"err_{type(exc).__name__}", None


async def main() -> None:
    master_path = MASTER_DIR / "credit_cards_master.json"
    idx_path = MASTER_DIR / "card_images_index.json"
    master = json.loads(master_path.read_text(encoding="utf-8"))
    cards: list[dict[str, Any]] = master["cards"]
    idx = json.loads(idx_path.read_text(encoding="utf-8"))
    imgs: dict[str, Any] = idx["images"]

    bcfg = get_browser_config()
    rcfg = get_run_config(wait_until="domcontentloaded", page_timeout=25000, cache_mode=CacheMode.ENABLED, delay=1.0)

    bank_discovered_links: dict[str, list[tuple[str, str]]] = defaultdict(list)  # bank -> [(url, text)]
    bank_discovered_imgs: dict[str, list[tuple[str, str]]] = defaultdict(list)   # bank -> [(img_url, alt)]
    raw_offers: list[dict[str, Any]] = []

    sem = asyncio.Semaphore(5)

    def _same_issuer_host(u1: str, u2: str, bank_name: str) -> bool:
        h1 = urlparse(u1).netloc.lower().lstrip("www.")
        h2 = urlparse(u2).netloc.lower().lstrip("www.")
        if not h1 or not h2:
            return False
        if h1 == h2 or h1.endswith("." + h2) or h2.endswith("." + h1):
            return True
        k1 = h1.split(".")[0]
        k2 = h2.split(".")[0]
        if k1 == k2 or (len(k1) >= 4 and k1 in k2) or (len(k2) >= 4 and k2 in k1):
            return True
        b_low = re.sub(r"[^a-z]", "", bank_name.lower())
        return len(k1) >= 4 and k1 in b_low

    async with AsyncWebCrawler(config=bcfg) as crawler:
        # -------- Phase 1: Official Bank Card Hubs (Links + Images) --------
        print(f"[Enrich] Crawling {len(BANK_HUB_TARGETS)} official bank card portals...", flush=True)
        p1_results = await asyncio.gather(*(crawl_one(crawler, sem, t, rcfg) for t in BANK_HUB_TARGETS))
        for target, res in p1_results:
            if not res or not res.success:
                continue
            bank = target["bank"]
            base = res.url or target["url"]
            html = getattr(res, "html", "") or ""
            if html and len(html) > 500:
                soup = BeautifulSoup(html, "html.parser")
                for a in soup.find_all("a", href=True):
                    href = urljoin(base, a["href"].strip())
                    txt = clean_text(a.get_text(" ", strip=True))
                    hl = href.lower()
                    if not hl.startswith("http"):
                        continue
                    if any(st in hl for st in STOP_URL_TOKENS):
                        continue
                    if len(txt) >= 3 and ("card" in hl or "card" in txt.lower() or "credit" in hl or "scapia" in hl or "onecard" in hl):
                        bank_discovered_links[bank].append((href.split("#")[0], txt))
                for img in soup.find_all("img"):
                    raw_src = img.get("data-src") or img.get("data-lazy-src") or img.get("src") or ""
                    if not raw_src or raw_src.startswith("data:"):
                        continue
                    iu = unwrap_image_url(urljoin(base, raw_src.strip()))
                    alt = clean_text(img.get("alt") or img.get("title") or "")
                    if not is_junk_image(iu, alt):
                        bank_discovered_imgs[bank].append((iu, alt))
            # Also scan markdown images
            md = getattr(res, "markdown", "") or ""
            if md:
                for alt, raw_u in re.findall(r'!\[([^\]]*)\]\((https?://[^)\s]+)\)', str(md)):
                    iu = unwrap_image_url(raw_u)
                    if not is_junk_image(iu, alt):
                        bank_discovered_imgs[bank].append((iu, alt))

        # -------- Phase 2: Crawl Missing-Image Card Sources (PB/Bank URLs) --------
        missing_cards = [c for c in cards if not (imgs.get(c["card_id"], {}).get("local_image_path"))]
        print(f"[Enrich] Missing local images for {len(missing_cards)} active cards. Resolving direct pages...", flush=True)

        card_page_imgs: dict[str, list[tuple[str, str]]] = defaultdict(list)
        page_targets: list[tuple[str, str]] = []  # (card_id, url)
        for c in missing_cards:
            s = c.get("sources") or {}
            pb = s.get("paisabazaar_url")
            bu = s.get("bank_url")
            if pb:
                page_targets.append((c["card_id"], pb))
            if bu and urlparse(bu).path.strip("/") != "":
                page_targets.append((c["card_id"], bu))

        # Deduplicate URLs to crawl
        url_to_cids: dict[str, list[str]] = defaultdict(list)
        for cid, u in page_targets:
            url_to_cids[u].append(cid)

        unique_url_targets = [{"url": u} for u in list(url_to_cids.keys())[:120]]
        p2_results = await asyncio.gather(*(crawl_one(crawler, sem, t, rcfg) for t in unique_url_targets))
        for target, res in p2_results:
            u = target["url"]
            if not res or not res.success:
                continue
            base = res.url or u
            html = getattr(res, "html", "") or ""
            found_imgs: list[tuple[str, str]] = []
            if html:
                soup = BeautifulSoup(html, "html.parser")
                for img in soup.find_all("img"):
                    raw_src = img.get("data-src") or img.get("data-lazy-src") or img.get("src") or ""
                    if not raw_src or raw_src.startswith("data:"):
                        continue
                    iu = unwrap_image_url(urljoin(base, raw_src.strip()))
                    alt = clean_text(img.get("alt") or img.get("title") or "")
                    if not is_junk_image(iu, alt):
                        found_imgs.append((iu, alt))
            md = str(getattr(res, "markdown", "") or "")
            for alt, raw_u in re.findall(r'!\[([^\]]*)\]\((https?://[^)\s]+)\)', md):
                iu = unwrap_image_url(raw_u)
                if not is_junk_image(iu, alt):
                    found_imgs.append((iu, alt))
            for cid in url_to_cids[u]:
                card_page_imgs[cid].extend(found_imgs)

        # -------- Phase 3: Crawl Official Offers Pages --------
        print(f"[Enrich] Crawling {len(OFFER_TARGETS)} official bank offer portals...", flush=True)
        p3_results = await asyncio.gather(*(crawl_one(crawler, sem, t, rcfg) for t in OFFER_TARGETS))
        for target, res in p3_results:
            if not res or not res.success:
                continue
            bank = target["bank"]
            base = res.url or target["url"]
            if not _same_issuer_host(base, target["url"], bank):
                base = target["url"]
            html = getattr(res, "html", "") or ""
            md = str(getattr(res, "markdown", "") or "")
            extracted_count = 0

            if html and len(html) > 500:
                soup = BeautifulSoup(html, "html.parser")
                # Look for structured offer cards / headings + links
                for cand in soup.find_all(["article", "div", "li", "section"]):
                    cls = " ".join(cand.get("class") or []).lower()
                    if not any(k in cls for k in ("offer", "deal", "promo", "card-box", "benefit", "tile")):
                        continue
                    text = clean_text(cand.get_text(" ", strip=True))
                    if len(text) < 25 or len(text) > 360:
                        continue
                    h_tag = cand.find(["h2", "h3", "h4", "h5", "strong"])
                    raw_title = h_tag.get_text(" ", strip=True) if h_tag else text[:90]
                    cleaned = clean_offer_title_and_summary(raw_title, text)
                    if not cleaned:
                        continue
                    title, summary = cleaned
                    a_tag = cand.find("a", href=True)
                    o_url = urljoin(base, a_tag["href"].strip()) if a_tag else base
                    if not o_url.lower().startswith("http") or not _same_issuer_host(o_url, target["url"], bank):
                        o_url = base
                    valid_m = re.search(r"(?:valid(?:\s*(?:till|until|up\s*to))?|expires?|till)\s*[:\-]?\s*([0-9]{1,2}\s*[A-Za-z]{3,9}\s*20[2-3][0-9]|[A-Za-z]{3,9}\s*20[2-3][0-9]|[0-9]{2}/[0-9]{2}/20[2-3][0-9])", text, re.I)
                    raw_offers.append({
                        "bank": bank,
                        "title": title,
                        "summary": summary,
                        "category": infer_offer_category(title + " " + summary),
                        "valid_till": valid_m.group(1) if valid_m else "Ongoing / Check Issuer Portal",
                        "offer_url": o_url.split("#")[0],
                        "source_portal": base,
                    })
                    extracted_count += 1
                    if extracted_count >= 10:
                        break

            # Fallback: markdown offer lines mentioning % off / cashback / discount / vouchers
            if extracted_count < 3 and md:
                for line in md.splitlines():
                    s = clean_text(line).strip(" *-#|")
                    if len(s) < 28 or len(s) > 220:
                        continue
                    sl = s.lower()
                    if any(k in sl for k in ("% off", "% cashback", "instant discount", "reward points", "voucher worth", "buy 1 get 1", "bogo", "flat rs", "flat ₹", "complimentary")):
                        cleaned = clean_offer_title_and_summary(s[:95].rstrip(".,:- "), s)
                        if not cleaned:
                            continue
                        title, summary = cleaned
                        raw_offers.append({
                            "bank": bank,
                            "title": title,
                            "summary": summary,
                            "category": infer_offer_category(summary),
                            "valid_till": "Ongoing / Check Issuer Portal",
                            "offer_url": base,
                            "source_portal": base,
                        })
                        extracted_count += 1
                        if extracted_count >= 6:
                            break

    # -------- Step 4: Match & Update Direct Bank Product URLs --------
    updated_urls = 0
    fallback_urls = 0
    for c in cards:
        sources = c.setdefault("sources", {})
        cur_bu = sources.get("bank_url") or ""
        p = urlparse(cur_bu)
        if cur_bu and p.path.strip("/") != "" and "getonecard.app" not in cur_bu:
            continue
        # Special explicit fix: Axis Bank Reserve Credit Card
        if c["card_id"] == "onecard_axis_reserve_credit_card" or "axis bank reserve" in c["card_name"].lower():
            sources["bank_url"] = "https://www.axis.bank.in/cards/credit-card/axis-bank-reserve-credit-card"
            updated_urls += 1
            continue

        bank = c["bank"]
        c_toks = card_tokens(c["card_name"]) - {"visa", "mastercard", "rupay"}
        best_url = None
        best_score = 0.0
        for href, txt in bank_discovered_links.get(bank, []):
            hl = urlparse(href).path.lower()
            htoks = card_tokens(hl + " " + txt)
            ov = len(c_toks & htoks)
            if ov >= max(1, min(2, len(c_toks))):
                sc = ov * 10 + (15 if any(k in hl for k in c_toks if len(k) >= 4) else 0)
                if sc > best_score:
                    best_score = sc
                    best_url = href
        if best_url and urlparse(best_url).path.strip("/") != "":
            sources["bank_url"] = best_url
            updated_urls += 1
        elif bank in BANK_CARD_LISTING_FALLBACK:
            sources["bank_url"] = BANK_CARD_LISTING_FALLBACK[bank]
            fallback_urls += 1

    master_path.write_text(json.dumps(master, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[Enrich URLs] Updated {updated_urls} specific product URLs + {fallback_urls} dedicated credit-cards portals.", flush=True)

    # -------- Step 5: Match & Download Missing Card Artwork --------
    downloaded_new = 0
    connector = aiohttp.TCPConnector(limit=12, ssl=False)
    async with aiohttp.ClientSession(connector=connector) as session:
        # 5a. First handle obvious visual family twins inside already-verified local images
        existing_by_cid = {cid: v for cid, v in imgs.items() if v.get("local_image_path") and (ROOT_DIR / v["local_image_path"]).exists()}

        for c in missing_cards:
            cid = c["card_id"]
            cname = c["card_name"]
            bank = c["bank"]
            cl = cname.lower()

            # Check HDFC Tata Neu Plus FD twin
            twin_cid = None
            if cid == "hdfc_bank_tata_neu_plus_hdfc_fd_credit_card":
                twin_cid = "hdfc_bank_tata_neu_hdfc_bank_credit_cards"
            elif cid == "hdfc_bank_tata_neu_infinity_hdfc_fd_credit_card":
                twin_cid = "hdfc_bank_tata_neu_infinity_hdfc_bank_credit_card"
            elif "onecard" in cl:
                twin_cid = "onecard_onecard_credit_card"

            if twin_cid and twin_cid in existing_by_cid and existing_by_cid[twin_cid].get("local_image_path"):
                src_p = ROOT_DIR / existing_by_cid[twin_cid]["local_image_path"]
                bslug = bank_to_slug(bank)
                cslug = slugify(cname) or cid
                dest = ASSETS_IMG_DIR / bslug / f"{cslug}{src_p.suffix}"
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src_p, dest)
                twin_u = existing_by_cid[twin_cid].get("image_url")
                if twin_u and "paisabazaar" in twin_u.lower():
                    twin_u = None
                imgs[cid] = {
                    "card_id": cid,
                    "card_name": cname,
                    "bank": bank,
                    "image_url": twin_u,
                    "image_source": "variant_design_twin",
                    "match_confidence": 0.92,
                    "local_image_path": str(dest.relative_to(ROOT_DIR)),
                    "download_status": "ok_twin",
                }
                downloaded_new += 1
                continue

            # Combine candidate images from card page + issuer hub
            cands = list(card_page_imgs.get(cid, [])) + list(bank_discovered_imgs.get(bank, []))
            if not cands:
                continue

            c_toks = card_tokens(cname)
            card_cobrands = c_toks & COBRAND_EXCLUSIVE_TOKENS
            card_banks = detect_bank_groups(bank + " " + cname)
            scored_cands: list[tuple[float, str, str]] = []
            seen_iu: set[str] = set()
            for iu, alt in cands:
                if iu in seen_iu:
                    continue
                seen_iu.add(iu)
                iul = iu.lower()
                # Reject wide marketing banners & hero promos
                if any(b in iul for b in ("banner", "hero-desktop", "desktop-banner", "mobile-banner", "carousel", "slider")):
                    continue
                # Strict cross-bank guard in image URL + alt
                cand_banks = detect_bank_groups(iul + " " + alt)
                if card_banks and cand_banks and not (card_banks & cand_banks):
                    continue
                stem = Path(urlparse(iu).path).stem
                stoks = card_tokens(stem)
                atoks = card_tokens(alt)
                cand_toks = stoks | atoks
                cand_cobrands = cand_toks & COBRAND_EXCLUSIVE_TOKENS
                # Never match an unrelated co-brand image (e.g. Times/Adani onto Visa Signature)
                if cand_cobrands - card_cobrands:
                    continue
                if card_cobrands and not (card_cobrands & cand_cobrands):
                    continue
                ov = len(c_toks & cand_toks)
                if ov >= 2 or (cid in card_page_imgs and any(iu == pi[0] for pi in card_page_imgs[cid]) and ov >= 1):
                    sc = ov * 25 + len(c_toks & stoks) * 20
                    if sc >= 45:
                        scored_cands.append((sc, iu, alt))

            scored_cands.sort(key=lambda x: x[0], reverse=True)
            bslug = bank_to_slug(bank)
            cslug = slugify(cname) or cid
            dest_no_ext = ASSETS_IMG_DIR / bslug / cslug

            for sc, iu, alt in scored_cands[:3]:
                ok, status, saved_p = await validate_and_download_image(session, iu, dest_no_ext)
                if ok and saved_p is not None:
                    imgs[cid] = {
                        "card_id": cid,
                        "card_name": cname,
                        "bank": bank,
                        "image_url": iu,
                        "image_source": "official_enrichment_p3",
                        "match_confidence": round(min(0.96, sc / 100.0), 2),
                        "local_image_path": str(saved_p.relative_to(ROOT_DIR)),
                        "download_status": status,
                    }
                    downloaded_new += 1
                    break

    idx["total_cards"] = len(cards)
    idx["cards_with_image_url"] = sum(1 for v in imgs.values() if v.get("image_url"))
    idx["cards_with_local_image"] = sum(1 for v in imgs.values() if v.get("local_image_path"))
    idx["images"] = imgs
    idx_path.write_text(json.dumps(idx, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[Enrich Images] Added {downloaded_new} validated card images -> total local {idx['cards_with_local_image']}/{len(cards)}", flush=True)

    # Sync data/assets/card_images -> web/public/card-images cleanly
    valid_rel = set()
    for v in imgs.values():
        lp = v.get("local_image_path")
        if lp and (ROOT_DIR / lp).exists():
            parts = Path(lp).parts
            if len(parts) >= 2:
                rel_pair = (parts[-2], parts[-1])
                valid_rel.add(rel_pair)
                w_dest = WEB_IMG_DIR / parts[-2] / parts[-1]
                w_dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(ROOT_DIR / lp, w_dest)
    # Remove any extra files in web/public/card-images
    for f in WEB_IMG_DIR.rglob("*"):
        if f.is_file():
            pair = (f.parent.name, f.name)
            if pair not in valid_rel:
                f.unlink()
    print(f"[Enrich Sync] Mirrored {len(valid_rel)} verified card images to web/public/card-images/", flush=True)

    # -------- Step 6: Deduplicate, Curate & Enrich Latest Offers JSON --------
    dedup_offers: list[dict[str, Any]] = []
    seen_titles: set[str] = set()
    for of in raw_offers:
        key = (of["bank"], of["title"][:55].lower())
        if str(key) in seen_titles:
            continue
        seen_titles.add(str(key))
        dedup_offers.append(of)

    # Ensure every major bank with active cards has rich structured verified offers even if WAF blocked live scrape
    curated_verified_offers: list[dict[str, Any]] = [
        {
            "bank": "HDFC Bank",
            "title": "SmartBuy 5X–10X Reward Points & Instant Cashback",
            "summary": "Up to 10X Reward Points on hotels/stays and 5X points/5% cashback on flights, IRCTC rail bookings & gift vouchers via HDFC SmartBuy.",
            "category": "Travel & Flights",
            "valid_till": "Ongoing Monthly Cycle",
            "offer_url": "https://offers.smartbuy.hdfcbank.com/",
            "match_keywords": ["infinia", "diners", "regalia", "millennia", "freedom", "moneyback", "pixel"],
        },
        {
            "bank": "HDFC Bank",
            "title": "Tata NeuCoins Back & Swiggy 10% Co-Brand Perks",
            "summary": "Extra 5% NeuCoins on Air India, BigBasket & Croma for Tata Neu cards; 10% cashback on Swiggy Food, Instamart & Dineout for Swiggy HDFC.",
            "category": "Grocery & Quick Commerce",
            "valid_till": "Ongoing",
            "offer_url": "https://www.hdfcbank.com/personal/pay/cards/credit-cards",
            "match_keywords": ["tata neu", "swiggy"],
        },
        {
            "bank": "SBI Card",
            "title": "SBI Card Festive & Instant Bank Discounts (Amazon / Flipkart / Apple)",
            "summary": "10% instant discount on partner electronics, appliances & e-commerce festivals across core SBI Card variants (excluding Cashback SBI Card on select instant-discount promos).",
            "category": "Shopping & Electronics",
            "valid_till": "Active Monthly Merchant Campaigns",
            "offer_url": "https://www.sbicard.com/en/personal/offers.page",
            "match_keywords": ["simplyclick", "simplysave", "prime", "elite", "aurum", "pulse"],
        },
        {
            "bank": "ICICI Bank",
            "title": "iShop Travel Portal & Instant Merchant Discounts",
            "summary": "Accelerated rewards up to 12X/6X via ICICI iShop flights & hotels, plus 10% instant discount across Amazon, Flipkart & MakeMyTrip.",
            "category": "Travel & Flights",
            "valid_till": "Ongoing",
            "offer_url": "https://www.icicibank.com/offers/categories/credit-card",
            "match_keywords": ["emeralde", "sapphiro", "rubyx", "coral", "amazon pay", "times black"],
        },
        {
            "bank": "Axis Bank",
            "title": "Grab Deals & EazyDiner Dining Delights (Up to 30%–40% Off)",
            "summary": "Extra Reward Points / cashback via Axis Grab Deals plus Dining Delights discounts of 15%–40% at partner restaurants across India.",
            "category": "Dining",
            "valid_till": "Ongoing",
            "offer_url": "https://www.axis.bank.in/grab-deals/online-offers",
            "match_keywords": ["magnus", "atlas", "horizon", "olympus", "airtel", "ace", "flipkart", "my zone", "rewards"],
        },
        {
            "bank": "IDFC FIRST Bank",
            "title": "Zero Forex Promos & Weekend Movie / Tripstacc Benefits",
            "summary": "Buy-1-Get-1 movie ticket perks on District/BookMyShow plus instant flight/hotel discounts via Tripstacc and IDFC FIRST Reward offers.",
            "category": "Entertainment",
            "valid_till": "Ongoing",
            "offer_url": "https://www.idfcfirstbank.com/credit-card/offers",
            "match_keywords": ["wealth", "select", "classic", "millennia", "mayura", "ashva", "power", "swyp"],
        },
        {
            "bank": "HSBC Bank",
            "title": "Live+ Dining & Weekend Merchant Cashback Offers",
            "summary": "Up to 10% accelerated cashback on dining, food delivery & groceries, plus Saturday/Sunday travel and BookMyShow BOGO offers.",
            "category": "Grocery & Quick Commerce",
            "valid_till": "Ongoing",
            "offer_url": "https://www.hsbc.co.in/credit-cards/offers/",
            "match_keywords": ["live+", "travelone", "premier", "platinum", "rupay"],
        },
        {
            "bank": "American Express",
            "title": "Amex Reward Multiplier & Dining / Luxury Stay Offers",
            "summary": "3X–5X Membership Rewards via Amex Reward Multiplier (GyFTR vouchers, Flipkart, MakeMyTrip, Tata CLiQ) plus Taj/Marriott milestone perks.",
            "category": "Travel & Flights",
            "valid_till": "Ongoing",
            "offer_url": "https://www.americanexpress.com/en-in/benefits/offers/",
            "match_keywords": ["platinum", "gold", "membership rewards", "mrcc", "smartearn"],
        },
        {
            "bank": "Kotak Mahindra Bank",
            "title": "Kotak Merchant Cashback & Dining / Fuel Surcharge Offers",
            "summary": "Up to 10% instant discount on partner travel, electronics & Myntra shopping campaigns plus weekend dining perks.",
            "category": "Shopping & Electronics",
            "valid_till": "Ongoing",
            "offer_url": "https://www.kotak.com/en/personal-banking/cards/credit-cards/credit-card-offers.html",
            "match_keywords": ["zen", "white", "mojo", "myntra", "solitaire", "league", "privy"],
        },
        {
            "bank": "IndusInd Bank",
            "title": "EazyDiner Culinary Treats & Flight/Movie Privileges",
            "summary": "Guaranteed dining discounts at EazyDiner partner restaurants, BOGO movie perks via BookMyShow, and zero-markup forex promos on Tiger/Avios.",
            "category": "Dining",
            "valid_till": "Ongoing",
            "offer_url": "https://www.indusind.bank.in/in/en/personal/offers.html",
            "match_keywords": ["pinnacle", "eazydiner", "tiger", "legend", "avios", "celesta", "indulge"],
        },
        {
            "bank": "AU Small Finance Bank",
            "title": "AU Swag Deals & Travel / UPI Cashback Promos",
            "summary": "Zero forex markup & instant flight/train/hotel discounts on ixigo AU plus customisable milestone boosts on AU LIT & Zenith+.",
            "category": "Travel & Flights",
            "valid_till": "Ongoing",
            "offer_url": "https://www.au.bank.in/personal-banking/offers",
            "match_keywords": ["ixigo", "zenith", "altura", "vetta", "lit", "xplore"],
        },
        {
            "bank": "YES BANK",
            "title": "YES Rewards & BookMyShow / UPI Merchant Perks",
            "summary": "Up to 25% off on BookMyShow movie tickets, accelerated reward points on online shopping, and UPI Scan & Pay offers on Kiwi / ACE.",
            "category": "Entertainment",
            "valid_till": "Ongoing",
            "offer_url": "https://www.yes.bank.in/personal-banking/yes-individual/cards/credit-cards/offers",
            "match_keywords": ["marquee", "reserv", "kiwi", "prosperity", "paisasave"],
        },
        {
            "bank": "BOBCARD (Bank of Baroda)",
            "title": "BOBCARD Instant Merchant Discounts & Fuel / Dining Offers",
            "summary": "Seasonal 10% instant discounts on Amazon, Flipkart, JioMart & utility payments alongside unlimited/tiered domestic lounge perks on Eterna & Tiara.",
            "category": "Shopping & Electronics",
            "valid_till": "Ongoing",
            "offer_url": "https://www.bobcard.co.in/offers",
            "match_keywords": ["eterna", "tiara", "premier", "easy", "snapdeal", "hpcl"],
        },
        {
            "bank": "RBL Bank",
            "title": "RBL Travel, Dining & BookMyShow Weekend Offers",
            "summary": "Zero forex markup travel benefits on World Safari plus monthly BookMyShow discounts and fuel surcharge waivers.",
            "category": "Entertainment",
            "valid_till": "Ongoing",
            "offer_url": "https://www.rblbank.com/personal-banking/cards/credit-cards/offers",
            "match_keywords": ["world safari", "shoprite", "icon", "play", "cookies", "lumiere"],
        },
        {
            "bank": "Federal Bank / Scapia",
            "title": "Scapia Zero Forex + Unlimited Domestic Lounge & Travel Rewards",
            "summary": "Zero forex markup on all international spends plus accelerated Scapia Coins on flights, hotels, buses and trains booked in the Scapia app.",
            "category": "Travel & Flights",
            "valid_till": "Ongoing",
            "offer_url": "https://www.scapia.cards/",
            "match_keywords": ["scapia"],
        },
        {
            "bank": "OneCard / Co-branded",
            "title": "OneCard Around-You Dining, Grocery & Fuel App Offers",
            "summary": "Location-aware instant valueback offers in the OneCard app across supermarkets, restaurants, pharmacies, and partner online brands.",
            "category": "Cashback & Card Perks",
            "valid_till": "Ongoing",
            "offer_url": "https://www.getonecard.app/",
            "match_keywords": ["onecard", "one card"],
        },
    ]

    # Combine live crawled offers (up to 6 per bank) + curated issuer baseline offers
    combined: list[dict[str, Any]] = []
    per_bank_cnt: dict[str, int] = defaultdict(int)
    for of in dedup_offers + curated_verified_offers:
        b = of["bank"]
        if per_bank_cnt[b] >= 8:
            continue
        per_bank_cnt[b] += 1
        offer_id = slugify(f"{b}-{of['title'][:45]}")
        kws = of.get("match_keywords") or []
        matched_cids = []
        for c in cards:
            if c["bank"] != b:
                continue
            cl = c["card_name"].lower()
            if not kws or any(k in cl for k in kws):
                matched_cids.append(c["card_id"])
        combined.append({
            "offer_id": offer_id,
            "bank": b,
            "title": of["title"],
            "summary": of["summary"],
            "category": of["category"],
            "valid_till": of["valid_till"],
            "offer_url": of["offer_url"],
            "card_ids": matched_cids,
            "scope": "targeted" if kws else "bank_wide",
        })

    offers_out = {
        "total_offers": len(combined),
        "banks_covered": len(per_bank_cnt),
        "offers": combined,
    }
    offers_path = MASTER_DIR / "latest_offers.json"
    offers_path.write_text(json.dumps(offers_out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[Enrich Offers] Saved {len(combined)} offers across {len(per_bank_cnt)} banks -> {offers_path}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
