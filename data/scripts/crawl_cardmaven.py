#!/usr/bin/env python3
"""Comprehensive Crawl4AI scraper & structured parser for https://cardmaven.in/.

Crawls all card review pages, issuer pages, 2026 update/devaluation posts,
guide posts, comparison pages, and airport lounge directories via Crawl4AI
(`AsyncWebCrawler` + `arun_many`) and saves parsed structured JSON + markdown
under `data/raw/cardmaven/`.
"""

from __future__ import annotations

import asyncio
import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup, Tag
from crawl4ai import AsyncWebCrawler, BrowserConfig, CacheMode, CrawlerRunConfig

ROOT = Path(__file__).resolve().parents[2]
RAW_OUT = ROOT / "data" / "raw" / "cardmaven"
HTML_CACHE_DIR = RAW_OUT / "html"
MD_CACHE_DIR = RAW_OUT / "markdown"

SITEMAPS = [
    "credit-card-sitemap.xml",
    "post-sitemap.xml",
    "credit-card-update-sitemap.xml",
    "card-issuer-sitemap.xml",
    "airport-sitemap.xml",
    "compare-credit-cards-sitemap.xml",
    "page-sitemap.xml",
]

ISSUER_SEED_URLS = [
    "https://cardmaven.in/american-express-cards/",
    "https://cardmaven.in/au-bank-credit-cards/",
    "https://cardmaven.in/axis-bank-credit-cards/",
    "https://cardmaven.in/bank-of-baroda-credit-cards/",
    "https://cardmaven.in/equitas-bank-credit-cards/",
    "https://cardmaven.in/fintech-credit-cards/",
    "https://cardmaven.in/hdfc-bank-credit-cards/",
    "https://cardmaven.in/hsbc-credit-cards/",
    "https://cardmaven.in/icici-bank-credit-cards/",
    "https://cardmaven.in/idfc-first-bank-credit-cards/",
    "https://cardmaven.in/card-issuer/indusind-bank/",
    "https://cardmaven.in/card-issuer/kotak-bank/",
    "https://cardmaven.in/rbl-bank-credit-cards/",
    "https://cardmaven.in/sbi-card/",
    "https://cardmaven.in/yes-bank-credit-cards/",
]


def clean_text(text: str | None) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()


def classify_table(heading: str, headers: list[str], rows: list[list[str]]) -> str:
    blob = f"{heading} {' '.join(headers)}".lower()
    flat_rows = " ".join(" ".join(r[:2]) for r in rows[:6]).lower()
    if any(k in blob for k in ("transfer partner", "conversion rate", "transfer ratio", "airmiles", "miles/points")):
        return "transfer_partners"
    if any(k in blob for k in ("smartbuy", "multiplier", "accelerated", "gyftr", "isave", "edges")):
        return "accelerated_partners"
    if any(k in blob for k in ("gold collection", "e-voucher", "redemption", "value per reward point", "point value")):
        return "redemption_catalog"
    if any(k in blob for k in ("lounge", "priority pass", "dreamfolks")):
        return "lounge_access"
    if any(k in blob for k in ("milestone", "spend threshold")):
        return "milestone_benefits"
    if any(k in blob for k in ("eligibility", "salary", "income criteria")):
        return "eligibility"
    if (
        any(k in blob for k in ("fee", "charge", "at a glance", "joining", "annual"))
        or ("joining fee" in flat_rows and "annual fee" in flat_rows)
    ):
        return "fees_and_charges"
    if any(k in blob for k in ("reward", "cashback", "earn", "spend category", "type of spend", "cap")):
        return "reward_structure"
    return "other_table"


def extract_img_src(img: Tag) -> str:
    for attr in ("data-src", "data-lazy-src", "data-original", "src"):
        val = (img.get(attr) or "").strip()
        if val and not val.startswith("data:image/svg"):
            return val
    return ""


def classify_url(url: str, source_map: dict[str, str]) -> str:
    if url in source_map:
        return source_map[url]
    path = urlparse(url).path.lower()
    if "/airport-lounges/" in path:
        return "airport_lounge"
    if "-vs-" in path or "comparison" in path:
        return "comparison"
    if "card-issuer/" in path or path.endswith("-cards/") or path == "/sbi-card/":
        return "issuer_page"
    if "devaluation" in path or "update" in path:
        return "update_post"
    if "review" in path or "credit-card" in path or "sbi-card" in path:
        return "card_review"
    return "guide_post"


def parse_cardmaven_page(url: str, html: str, markdown: str, page_kind: str) -> dict[str, Any]:
    soup = BeautifulSoup(html or "", "lxml")

    title_el = soup.find("h1")
    title = clean_text(title_el.get_text(" ", strip=True)) if title_el else ""
    if not title and soup.title:
        title = clean_text(soup.title.get_text(" ", strip=True))

    meta_desc = ""
    md_tag = soup.find("meta", attrs={"name": "description"}) or soup.find("meta", attrs={"property": "og:description"})
    if md_tag and md_tag.get("content"):
        meta_desc = clean_text(md_tag["content"])

    modified_time = ""
    mod_tag = soup.find("meta", attrs={"property": "article:modified_time"})
    if mod_tag and mod_tag.get("content"):
        modified_time = mod_tag["content"]

    published_time = ""
    pub_tag = soup.find("meta", attrs={"property": "article:published_time"})
    if pub_tag and pub_tag.get("content"):
        published_time = pub_tag["content"]

    og_image = ""
    og_img_tag = soup.find("meta", attrs={"property": "og:image"})
    if og_img_tag and og_img_tag.get("content"):
        og_image = og_img_tag["content"].strip()

    # Main content container
    main_el = (
        soup.select_one("article")
        or soup.select_one(".entry-content")
        or soup.select_one("main")
        or soup.body
    )

    # Extract structured tables
    tables_out: list[dict[str, Any]] = []
    if main_el:
        for t_idx, table in enumerate(main_el.find_all("table")):
            # Skip comment/calendar tables
            if table.find_parent(id="comments") or table.find_parent(class_="comments-area"):
                continue
            prev_h = table.find_previous(["h1", "h2", "h3", "h4"])
            heading = clean_text(prev_h.get_text(" ", strip=True)) if prev_h else ""

            rows_raw: list[list[str]] = []
            headers: list[str] = []
            thead = table.find("thead")
            if thead:
                th_row = thead.find("tr")
                if th_row:
                    headers = [clean_text(c.get_text(" ", strip=True)) for c in th_row.find_all(["th", "td"])]
            for tr in table.find_all("tr"):
                if thead and tr.find_parent("thead"):
                    continue
                cells = [clean_text(c.get_text(" ", strip=True)) for c in tr.find_all(["th", "td"])]
                if not any(cells):
                    continue
                if not headers and tr.find_all("th") and len(tr.find_all("th")) == len(cells):
                    headers = cells
                else:
                    rows_raw.append(cells)

            if not headers and len(rows_raw) >= 2:
                # Two-column key/value tables on CardMaven (Joining Fee | ₹999 + GST) often use tbody without thead
                if len(rows_raw[0]) == 2 and rows_raw[0][0].lower() in (
                    "joining fee", "annual fee", "fee/benefit", "fee type", "category", "partner",
                    "transfer partner", "spend category", "type of spend", "e-voucher", "feature", "attribute"
                ):
                    if rows_raw[0][0].lower() in ("fee/benefit", "fee type", "category", "partner", "transfer partner", "spend category", "type of spend", "e-voucher", "feature", "attribute"):
                        headers = rows_raw[0]
                        rows_raw = rows_raw[1:]
                elif len(rows_raw[0]) >= 3 and any(
                    w in " ".join(rows_raw[0]).lower()
                    for w in ("category", "spend", "rate", "cap", "partner", "ratio", "network", "primary", "value", "voucher")
                ):
                    headers = rows_raw[0]
                    rows_raw = rows_raw[1:]

            if not rows_raw:
                continue

            t_kind = classify_table(heading, headers, rows_raw)
            tables_out.append(
                {
                    "index": t_idx,
                    "kind": t_kind,
                    "heading": heading,
                    "headers": headers,
                    "rows": rows_raw,
                }
            )

    # Extract "At a glance" summary card box metrics & rating
    at_a_glance: dict[str, str] = {}
    rating_val: float | None = None
    if main_el:
        top_text = clean_text(main_el.get_text(" ", strip=True)[:2500])
        m_rat = re.search(r"At a glance\s+(\d+(?:\.\d+)?)\s*/\s*5", top_text, re.I) or re.search(
            r"Rated\s+(\d+(?:\.\d+)?)\s*/\s*5", top_text, re.I
        )
        if m_rat:
            try:
                rating_val = float(m_rat.group(1))
            except ValueError:
                pass
        for label in ("Annual fee", "Joining fee", "Reward rate", "Forex markup", "Lounge access", "Best for"):
            pat = re.compile(rf"{label}\s*[:\n]?\s*([^\n|]{{1,80}}?)(?=(?:Annual fee|Joining fee|Reward rate|Forex markup|Lounge access|Best for|Jump to|$))", re.I)
            # Search in compact top block HTML text with newlines
            top_block = "\n".join(el.get_text(" ", strip=True) for el in main_el.find_all(["div", "p", "li", "span"], limit=60))
            m = pat.search(top_block)
            if m:
                val = clean_text(m.group(1))
                if val and len(val) < 70:
                    at_a_glance[label.lower().replace(" ", "_")] = val

    # Extract images (especially transparent PNG card artwork & tables/charts)
    images: list[dict[str, str]] = []
    seen_img_urls: set[str] = set()
    if main_el:
        for img in main_el.find_all("img"):
            if img.find_parent(id="comments") or img.find_parent(class_="comments-area"):
                continue
            src = extract_img_src(img)
            if not src or "cardmaven.in/wp-content/uploads/" not in src:
                continue
            low = src.lower()
            if any(skip in low for skip in ("cropped-card-maven-icon", "gravatar.com", "emoji", "card-maven-logo")):
                continue
            if src in seen_img_urls:
                continue
            seen_img_urls.add(src)
            images.append({"url": src, "alt": clean_text(img.get("alt", ""))})

    # Extract sectioned headings, bullets, update notes & pros/cons/FAQs
    sections: list[dict[str, Any]] = []
    important_notes: list[str] = []
    pros: list[str] = []
    cons: list[str] = []
    faqs: list[dict[str, str]] = []

    if main_el:
        for p in main_el.find_all(["p", "div", "li"]):
            if p.find_parent(id="comments") or p.find_parent(class_="comments-area"):
                continue
            txt = clean_text(p.get_text(" ", strip=True))
            if not txt or len(txt) < 25 or len(txt) > 550:
                continue
            low = txt.lower()
            if any(
                k in low
                for k in (
                    "note:", "update:", "effective from", "from 1 ", "since may 2025",
                    "from 15 november 2026", "has paused new card", "discontinued",
                    "suspended", "removed on", "devaluation", "july 2026", "august 2026",
                    "september 2026", "october 2026", "november 2026",
                )
            ):
                if txt not in important_notes and not any(bad in low for bad in ("affiliate", "cookie", "leave a reply", "card maven may earn")):
                    important_notes.append(txt)

        for heading_el in main_el.find_all(["h2", "h3"]):
            if heading_el.find_parent(id="comments") or heading_el.find_parent(class_="comments-area"):
                continue
            h_txt = clean_text(heading_el.get_text(" ", strip=True))
            if not h_txt or h_txt.lower() in ("leave a reply", "keep reading", "related posts"):
                continue
            bullets: list[str] = []
            paras: list[str] = []
            for sib in heading_el.find_next_siblings():
                if not isinstance(sib, Tag):
                    continue
                if sib.name in ("h2",):
                    break
                if heading_el.name == "h3" and sib.name == "h3":
                    break
                if sib.name in ("ul", "ol"):
                    for li in sib.find_all("li", recursive=False):
                        t = clean_text(li.get_text(" ", strip=True))
                        if t:
                            bullets.append(t)
                elif sib.name == "p":
                    t = clean_text(sib.get_text(" ", strip=True))
                    if t and "disclosure:" not in t.lower() and "affiliate" not in t.lower():
                        paras.append(t)
            sections.append({"level": heading_el.name, "heading": h_txt, "bullets": bullets[:25], "paragraphs": paras[:6]})

            low_h = h_txt.lower()
            if low_h in ("pros", "pros:", "advantages", "what we like"):
                pros.extend(bullets)
            elif low_h in ("cons", "cons:", "drawbacks", "limitations", "what we don't like"):
                cons.extend(bullets)

        # Parse JSON-LD FAQPage if present (Yoast/RankMath emits crisp FAQPage JSON-LD!)
        for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
            try:
                ld = json.loads(script.string or "")
            except Exception:
                continue
            nodes = ld.get("@graph", [ld]) if isinstance(ld, dict) else (ld if isinstance(ld, list) else [])
            for node in nodes:
                if not isinstance(node, dict):
                    continue
                if node.get("@type") == "FAQPage" and isinstance(node.get("mainEntity"), list):
                    for q_item in node["mainEntity"]:
                        q_text = clean_text(q_item.get("name", ""))
                        ans_obj = q_item.get("acceptedAnswer") or {}
                        a_html = ans_obj.get("text", "") if isinstance(ans_obj, dict) else ""
                        a_text = clean_text(BeautifulSoup(a_html, "lxml").get_text(" ", strip=True))
                        if q_text and a_text:
                            faqs.append({"question": q_text, "answer": a_text})

    # Links discovered inside issuer/post pages pointing to other cardmaven pages
    discovered_card_links: list[str] = []
    if main_el:
        for a in main_el.find_all("a", href=True):
            href = a["href"].split("#")[0].split("?")[0]
            if href.startswith("https://cardmaven.in/") and "/go/" not in href and "/wp-" not in href:
                if any(k in href for k in ("credit-card", "sbi-card", "review", "amex", "platinum", "gold", "infinia", "magnus", "atlas")):
                    discovered_card_links.append(href)

    slug = urlparse(url).path.strip("/").split("/")[-1] or "home"
    return {
        "url": url,
        "slug": slug,
        "page_kind": page_kind,
        "title": title,
        "meta_description": meta_desc,
        "published_time": published_time,
        "modified_time": modified_time,
        "og_image": og_image,
        "rating": rating_val,
        "at_a_glance": at_a_glance,
        "images": images,
        "tables": tables_out,
        "important_notes": important_notes[:20],
        "pros": pros,
        "cons": cons,
        "faqs": faqs,
        "sections": sections,
        "discovered_card_links": sorted(set(discovered_card_links)),
        "markdown_chars": len(markdown or ""),
    }


def collect_sitemap_urls() -> tuple[list[str], dict[str, str]]:
    client = httpx.Client(headers={"User-Agent": "Mozilla/5.0"}, timeout=25, follow_redirects=True)
    source_map: dict[str, str] = {}
    url_set: set[str] = set(ISSUER_SEED_URLS)
    for u in ISSUER_SEED_URLS:
        source_map[u] = "issuer_page"

    for sm in SITEMAPS:
        try:
            resp = client.get(f"https://cardmaven.in/{sm}")
            if resp.status_code != 200:
                continue
            locs = re.findall(r"<loc>([^<]+)</loc>", resp.text)
            for u in locs:
                clean_u = u.split("#")[0].strip()
                if not clean_u or clean_u.rstrip("/") == "https://cardmaven.in":
                    continue
                if clean_u.endswith("/credit-card/"):
                    continue
                if "/category/" in clean_u or "/author/" in clean_u:
                    continue
                url_set.add(clean_u)
                if sm == "credit-card-sitemap.xml":
                    source_map[clean_u] = "card_review"
                elif sm == "credit-card-update-sitemap.xml":
                    source_map[clean_u] = "update_post"
                elif sm == "card-issuer-sitemap.xml":
                    source_map[clean_u] = "issuer_page"
                elif sm == "airport-sitemap.xml":
                    source_map[clean_u] = "airport_lounge"
                elif sm == "compare-credit-cards-sitemap.xml":
                    source_map[clean_u] = "comparison"
                elif sm == "post-sitemap.xml":
                    if clean_u not in source_map:
                        source_map[clean_u] = classify_url(clean_u, {})
        except Exception as e:
            print(f"[warn] sitemap {sm} failed: {e}")
    return sorted(url_set), source_map


async def crawl_all() -> None:
    RAW_OUT.mkdir(parents=True, exist_ok=True)
    HTML_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    MD_CACHE_DIR.mkdir(parents=True, exist_ok=True)

    urls, source_map = collect_sitemap_urls()
    print(f"Discovered {len(urls)} initial unique URLs from CardMaven sitemaps & issuers.")

    browser_cfg = BrowserConfig(headless=True)
    run_cfg = CrawlerRunConfig(
        cache_mode=CacheMode.ENABLED,
        wait_until="domcontentloaded",
        page_timeout=45000,
        semaphore_count=6,
    )

    parsed_pages: dict[str, dict[str, Any]] = {}
    extra_links: set[str] = set()

    async with AsyncWebCrawler(config=browser_cfg) as crawler:
        # Phase 1: Crawl initial URLs in chunks of 35
        chunk_size = 35
        for start in range(0, len(urls), chunk_size):
            batch = urls[start : start + chunk_size]
            results = await crawler.arun_many(batch, config=run_cfg)
            for res in results:
                if not res.success or not res.html:
                    print(f"  [skip] {res.url}: {res.error_message}")
                    continue
                kind = classify_url(res.url, source_map)
                parsed = parse_cardmaven_page(res.url, res.html, str(res.markdown or ""), kind)
                parsed_pages[res.url] = parsed
                slug = parsed["slug"]
                if kind in ("card_review", "update_post", "guide_post", "issuer_page"):
                    md_text = str(res.markdown or "")
                    if md_text:
                        (MD_CACHE_DIR / f"{slug}.md").write_text(md_text, encoding="utf-8")
                for link in parsed.get("discovered_card_links", []):
                    if link not in parsed_pages and link not in source_map and "/tag/" not in link and "/category/" not in link:
                        extra_links.add(link)
            print(f"Phase 1 progress: {min(start + chunk_size, len(urls))}/{len(urls)} fetched (parsed={len(parsed_pages)})")

        # Phase 2: Crawl any extra linked card review/guide URLs discovered inside issuer/article pages
        extra_todo = sorted(u for u in extra_links if u not in parsed_pages)
        if extra_todo:
            print(f"Phase 2: crawling {len(extra_todo)} newly discovered internal links...")
            for start in range(0, len(extra_todo), chunk_size):
                batch = extra_todo[start : start + chunk_size]
                results = await crawler.arun_many(batch, config=run_cfg)
                for res in results:
                    if not res.success or not res.html:
                        continue
                    kind = classify_url(res.url, source_map)
                    parsed = parse_cardmaven_page(res.url, res.html, str(res.markdown or ""), kind)
                    parsed_pages[res.url] = parsed
                    if kind in ("card_review", "update_post", "guide_post", "issuer_page") and res.markdown:
                        (MD_CACHE_DIR / f"{parsed['slug']}.md").write_text(str(res.markdown), encoding="utf-8")

    # Summary & export
    by_kind: dict[str, int] = {}
    total_tables = 0
    total_images = 0
    for p in parsed_pages.values():
        k = p["page_kind"]
        by_kind[k] = by_kind.get(k, 0) + 1
        total_tables += len(p["tables"])
        total_images += len(p["images"])

    out_payload = {
        "source": "https://cardmaven.in/",
        "total_pages_parsed": len(parsed_pages),
        "counts_by_kind": by_kind,
        "total_tables_extracted": total_tables,
        "total_images_extracted": total_images,
        "pages": parsed_pages,
    }
    out_file = RAW_OUT / "cardmaven_parsed.json"
    out_file.write_text(json.dumps(out_payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nDONE! Saved {len(parsed_pages)} pages, {total_tables} tables, {total_images} image refs -> {out_file}")
    print("Breakdown:", by_kind)


if __name__ == "__main__":
    asyncio.run(crawl_all())
