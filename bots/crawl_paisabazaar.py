import asyncio
import json
import re
from pathlib import Path
from urllib.parse import urlparse

from crawl4ai import AsyncWebCrawler, AsyncUrlSeeder, SeedingConfig, CacheMode
from config import (
    RAW_DIR,
    PAISABAZAAR_HUB,
    PAISABAZAAR_CATEGORY_GUIDES,
    PAISABAZAAR_BANK_HUBS,
    get_browser_config,
    get_run_config,
)

OUT_DIR = RAW_DIR / "paisabazaar"

ACTIVE_BANK_SLUGS = {
    "hdfc-bank",
    "sbi-bank",
    "icici-bank",
    "axis-bank",
    "kotak-mahindra-bank",
    "idfc-first-bank",
    "idfc-bank",
    "indusind-bank",
    "amex-bank",
    "au-small-finance-bank",
    "hsbc-bank",
    "rbl-bank",
    "yes-bank",
    "standard-chartered-bank",
    "bank-of-baroda",
    "bobcard",
    "federal-bank",
    "bandhan-bank",
    "dbs-bank",
    "punjab-national-bank",
    "union-bank-of-india",
    "canara-bank",
    "sbm-bank",
    "south-indian-bank",
    "csb-bank",
    "karur-vysya-bank",
    "dcb-bank",
    "idbi-bank",
    "lic-cards",
    "unity-small-finance-bank",
    "utkarsh-bank",
    "bank-of-india",
    "indian-bank",
    "indian-overseas-bank",
    "uco-bank",
    "central-bank-of-india",
    "bank-of-maharashtra",
    "karnataka-bank",
    "tamilnad-mercantile-bank",
}

EXCLUDE_SLUG_TOKENS = (
    "customer-care",
    "bill-payment",
    "login",
    "status",
    "apply",
    "offers",
    "reward-points",
    "eligibility",
    "documents",
    "interest-rate",
    "limit",
    "statement",
    "cancel",
    "close",
    "pin",
    "activate",
    "netbanking",
    "comparison",
    "compare-",
    "best-",
    "vs-",
    "emi",
    "balance-enquiry",
    "balance-transfer",
    "fees-charges",
    "ifsc",
    "upgrade",
    "block-credit-card",
    "kisan-credit-card",
    "add-on-credit-card",
    "lounge-access",
    "debit-card",
    "credit-card/",
)


def is_card_detail_url(url: str) -> bool:
    if not url.startswith("https://www.paisabazaar.com/"):
        return False
    path = urlparse(url).path.strip("/")
    parts = path.split("/")
    if len(parts) != 2:
        return False
    bank_slug, page_slug = parts[0], parts[1]
    if bank_slug not in ACTIVE_BANK_SLUGS:
        if bank_slug == "credit-card" and page_slug in ("onecard", "axis-bank-reserve-credit-card"):
            return True
        return False
    if "credit-card" not in page_slug:
        return False
    for tok in EXCLUDE_SLUG_TOKENS:
        if tok in page_slug or page_slug == "credit-card":
            return False
    return True


def slugify_url(url: str) -> str:
    path = urlparse(url).path.strip("/")
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", path)


def extract_sections(md: str) -> dict[str, str]:
    sections: dict[str, list[str]] = {"_preamble": []}
    current = "_preamble"
    for line in md.splitlines():
        m = re.match(r"^(#{2,3})\s+(.+)$", line.strip())
        if m:
            heading = re.sub(r"\*+", "", m.group(2)).strip()
            current = heading
            if current not in sections:
                sections[current] = []
        else:
            sections[current].append(line)
    return {k: "\n".join(v).strip() for k, v in sections.items()}


def extract_bullets(text: str) -> list[str]:
    items = []
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("* ") or s.startswith("- "):
            clean = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", s[2:]).strip()
            clean = re.sub(r"\s+", " ", clean)
            if clean and not clean.startswith("!"):
                items.append(clean)
    return items


def extract_tables(md: str) -> list[list[dict[str, str]]]:
    tables = []
    lines = md.splitlines()
    i = 0
    while i < len(lines):
        if "|" in lines[i] and i + 1 < len(lines) and re.match(r"^\s*\|?[\s:-]+\|", lines[i + 1]):
            headers = [re.sub(r"\*+", "", h).strip() for h in lines[i].strip().strip("|").split("|")]
            i += 2
            rows = []
            while i < len(lines) and "|" in lines[i] and lines[i].strip():
                cols = [re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", re.sub(r"\*+", "", c)).strip() for c in lines[i].strip().strip("|").split("|")]
                if len(cols) == len(headers):
                    rows.append(dict(zip(headers, cols)))
                elif cols:
                    rows.append({"col_0": cols[0], "col_1": " | ".join(cols[1:])})
                i += 1
            if rows:
                tables.append(rows)
        else:
            i += 1
    return tables


def parse_paisabazaar_card(url: str, md: str) -> dict:
    sections = extract_sections(md)

    # Card Name from H1
    h1_match = re.search(r"^#\s+(.+)$", md, re.MULTILINE)
    card_name = re.sub(r"\*+", "", h1_match.group(1)).strip() if h1_match else slugify_url(url)

    # Bank from breadcrumb or URL
    bank_slug = urlparse(url).path.strip("/").split("/")[0]
    bank_name = bank_slug.replace("-", " ").title()
    bank_map = {
        "hdfc-bank": "HDFC Bank",
        "sbi-bank": "SBI Card",
        "icici-bank": "ICICI Bank",
        "axis-bank": "Axis Bank",
        "kotak-mahindra-bank": "Kotak Mahindra Bank",
        "idfc-first-bank": "IDFC FIRST Bank",
        "idfc-bank": "IDFC FIRST Bank",
        "indusind-bank": "IndusInd Bank",
        "amex-bank": "American Express",
        "au-small-finance-bank": "AU Small Finance Bank",
        "hsbc-bank": "HSBC India",
        "rbl-bank": "RBL Bank",
        "yes-bank": "YES Bank",
        "standard-chartered-bank": "Standard Chartered",
        "bank-of-baroda": "BOBCARD (Bank of Baroda)",
        "bobcard": "BOBCARD (Bank of Baroda)",
        "federal-bank": "Federal Bank",
        "bandhan-bank": "Bandhan Bank",
        "dbs-bank": "DBS Bank",
        "punjab-national-bank": "Punjab National Bank",
        "union-bank-of-india": "Union Bank of India",
        "canara-bank": "Canara Bank",
        "sbm-bank": "SBM Bank",
        "south-indian-bank": "South Indian Bank",
        "csb-bank": "CSB Bank",
        "karur-vysya-bank": "Karur Vysya Bank",
        "dcb-bank": "DCB Bank",
        "idbi-bank": "IDBI Bank",
        "lic-cards": "LIC Cards",
        "credit-card": "OneCard / Co-branded",
    }
    bank_name = bank_map.get(bank_slug, bank_name)

    # Updated date
    upd_m = re.search(r"Updated on\s+([^\n]+)", md)
    updated_on = upd_m.group(1).strip() if upd_m else ""

    # Rating & Subratings
    rating_m = re.search(r"(\d\.\d)/5\.0", md)
    overall_rating = float(rating_m.group(1)) if rating_m else None
    if overall_rating is None:
        rating_m2 = re.search(r"Overall Rating\s*\n+(\d\.\d)/5", md)
        overall_rating = float(rating_m2.group(1)) if rating_m2 else None

    subratings = {}
    for sr in re.finditer(r"([A-Za-z &]+?)(\d\.\d)/5(?!\.0)", md[:4000]):
        k = sr.group(1).strip()
        if len(k) < 35 and "\n" not in k:
            subratings[k] = float(sr.group(2))

    # Categories from icons
    pb_cats = re.findall(r"!\[cat name\]\([^)]+\)\s*([^\n]+)", md[:3000])
    pb_cats = [c.strip() for c in pb_cats if c.strip()]

    # First Year Fee snippet
    fy_m = re.search(r"1st Year Fee:\s*([^\n]+)", md)
    first_year_fee_snippet = re.sub(r"\*+", "", fy_m.group(1)).strip() if fy_m else ""

    # Section aggregation
    about_text = ""
    rewards_bullets = []
    other_benefits_bullets = []
    lounge_text = ""
    fees_rows = []
    get_card_if = []
    eligibility_lines = []
    pros = []
    cons = []
    review_like = ""
    conclusion = ""
    faqs = []

    for h, body in sections.items():
        hl = h.lower()
        if hl.startswith("about "):
            about_text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", body)
        elif "reward" in hl or "cashback" in hl or "feature" in hl or "benefit" in hl:
            if "other" in hl:
                other_benefits_bullets.extend(extract_bullets(body))
            else:
                rewards_bullets.extend(extract_bullets(body))
        if "lounge" in hl:
            lounge_text += "\n" + re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", body)
        if "fee" in hl and "charge" in hl:
            for tbl in extract_tables(body):
                fees_rows.extend(tbl)
        if "get this card if" in hl:
            get_card_if = [l.strip("-* ").strip() for l in body.splitlines() if l.strip() and not l.strip().startswith("!")]
        if "eligibility" in hl:
            eligibility_lines = [l.strip("-* ").strip() for l in body.splitlines() if l.strip() and not l.strip().startswith("!")]
        if hl == "pros":
            pros = extract_bullets(body) or [l.strip("-* ").strip() for l in body.splitlines() if l.strip()]
        if hl == "cons":
            cons = extract_bullets(body) or [l.strip("-* ").strip() for l in body.splitlines() if l.strip()]
        if "what do we like" in hl:
            review_like = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", body)
        if hl == "conclusion":
            conclusion = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", body)

    # Also grab FAQ questions & answers after "## Frequently Asked Questions"
    faq_idx = md.find("Frequently Asked Questions")
    if faq_idx != -1:
        faq_part = md[faq_idx:]
        for fm in re.finditer(r"###\s+([^\n]+)\n+([\s\S]*?)(?=\n###\s+|\n!\[img\]|\Z)", faq_part):
            q = fm.group(1).strip()
            a = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", fm.group(2)).strip()
            if q and a:
                faqs.append({"q": q, "a": a[:600]})

    # Parse fees dict
    fees_dict = {}
    for row in fees_rows:
        vals = list(row.values())
        if len(vals) >= 2:
            fees_dict[vals[0]] = vals[1]

    return {
        "source": "paisabazaar",
        "url": url,
        "slug": slugify_url(url),
        "card_name": card_name,
        "bank": bank_name,
        "updated_on": updated_on,
        "paisabazaar_categories": pb_cats,
        "overall_rating": overall_rating,
        "subratings": subratings,
        "first_year_fee_snippet": first_year_fee_snippet,
        "about": about_text[:1500],
        "rewards_and_benefits": rewards_bullets,
        "other_features_and_benefits": other_benefits_bullets,
        "lounge_access_text": lounge_text.strip()[:2500],
        "fees_table": fees_dict,
        "get_this_card_if": get_card_if,
        "eligibility_requirements": eligibility_lines,
        "pros": pros,
        "cons": cons,
        "review_summary": review_like[:1500],
        "conclusion": conclusion[:1500],
        "faqs": faqs[:15],
        "all_tables": extract_tables(md),
        "raw_md_length": len(md),
    }


async def crawl_bounded(crawler: AsyncWebCrawler, urls: list[str], r_cfg, concurrency: int = 5, label: str = "Batch"):
    sem = asyncio.Semaphore(concurrency)

    async def fetch_one(u: str):
        async with sem:
            try:
                return await asyncio.wait_for(crawler.arun(u, config=r_cfg), timeout=28)
            except Exception as e:
                return None

    results = []
    chunk = 10
    for i in range(0, len(urls), chunk):
        sub = urls[i : i + chunk]
        sub_res = await asyncio.gather(*(fetch_one(u) for u in sub))
        results.extend([r for r in sub_res if r is not None])
        print(f"[Paisabazaar] {label}: {min(i + chunk, len(urls))}/{len(urls)}", flush=True)
    return results


async def discover_paisabazaar_urls(crawler: AsyncWebCrawler) -> tuple[list[str], list[str]]:
    print("[Paisabazaar] Discovering URLs from sitemap + hub + bank hubs...", flush=True)
    sitemap_urls = []
    try:
        async with AsyncUrlSeeder() as seeder:
            seeds = await asyncio.wait_for(
                seeder.urls("www.paisabazaar.com", SeedingConfig(source="sitemap")),
                timeout=35,
            )
            sitemap_urls = [s["url"] for s in seeds if is_card_detail_url(s["url"])]
            print(f"[Paisabazaar] Sitemap yielded {len(sitemap_urls)} candidate card URLs.", flush=True)
    except Exception as e:
        print(f"[Paisabazaar] Sitemap seeding skipped/timed out ({e}); continuing with hubs.", flush=True)

    hub_urls = [PAISABAZAAR_HUB] + PAISABAZAAR_BANK_HUBS + PAISABAZAAR_CATEGORY_GUIDES
    r_cfg = get_run_config(wait_until="domcontentloaded", page_timeout=22000, cache_mode=CacheMode.ENABLED)

    results = await crawl_bounded(crawler, hub_urls, r_cfg, concurrency=4, label="Hubs crawled")

    discovered_cards = set(sitemap_urls)
    hub_data = []
    linked_cards = set()
    for res in results:
        if not res.success or not res.markdown:
            continue
        slug = slugify_url(res.url)
        folder = "guides" if "/credit-card/" in res.url and not res.url.endswith("/credit-card/") else "banks"
        (OUT_DIR / folder / f"{slug}.md").write_text(res.markdown.raw_markdown, encoding="utf-8")
        hub_data.append({"url": res.url, "slug": slug, "md_len": len(res.markdown.raw_markdown)})
        for lnk in res.links.get("internal", []):
            href = lnk.get("href", "").split("#")[0].split("?")[0]
            if href and not href.endswith("/"):
                href += "/"
            if is_card_detail_url(href):
                discovered_cards.add(href)
                linked_cards.add(href)

    ordered = sorted(linked_cards) + sorted(discovered_cards - linked_cards)
    print(f"[Paisabazaar] Found {len(linked_cards)} hub-linked cards, {len(ordered)} total candidate card URLs.", flush=True)
    return ordered, [h["url"] for h in hub_data]


async def run_paisabazaar_bot(max_cards: int = 300):
    b_cfg = get_browser_config()
    r_cfg = get_run_config(wait_until="domcontentloaded", page_timeout=22000, excluded_tags=["nav", "header", "footer"], cache_mode=CacheMode.ENABLED)

    async with AsyncWebCrawler(config=b_cfg) as crawler:
        card_urls, hub_urls = await discover_paisabazaar_urls(crawler)
        target_urls = card_urls[:max_cards]
        print(f"[Paisabazaar] Crawling {len(target_urls)} card detail pages...", flush=True)

        parsed_cards = []
        batch_size = 12
        out_json = OUT_DIR / "paisabazaar_cards.json"
        sem = asyncio.Semaphore(5)

        async def fetch_card(u: str):
            async with sem:
                try:
                    return await asyncio.wait_for(crawler.arun(u, config=r_cfg), timeout=26)
                except Exception:
                    return None

        for i in range(0, len(target_urls), batch_size):
            batch = target_urls[i : i + batch_size]
            results = await asyncio.gather(*(fetch_card(u) for u in batch))
            for res in results:
                if not res or not res.success or not res.markdown or not res.markdown.raw_markdown:
                    continue
                md = res.markdown.raw_markdown
                if len(md) < 1500:
                    continue
                slug = slugify_url(res.url)
                (OUT_DIR / "cards" / f"{slug}.md").write_text(md, encoding="utf-8")
                parsed = parse_paisabazaar_card(res.url, md)
                parsed_cards.append(parsed)
            out_json.write_text(json.dumps(parsed_cards, indent=2, ensure_ascii=False), encoding="utf-8")
            print(f"[Paisabazaar] Progress: {min(i + batch_size, len(target_urls))}/{len(target_urls)} | Parsed: {len(parsed_cards)}", flush=True)

        (OUT_DIR / "discovered_urls.json").write_text(json.dumps({"hub_urls": hub_urls, "all_card_urls": card_urls}, indent=2), encoding="utf-8")
        print(f"[Paisabazaar] Saved {len(parsed_cards)} parsed cards to {out_json}", flush=True)
        return parsed_cards


if __name__ == "__main__":
    asyncio.run(run_paisabazaar_bot())
