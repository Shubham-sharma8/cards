import asyncio
import json
import re
from urllib.parse import urlparse

from crawl4ai import AsyncWebCrawler, CacheMode
from config import (
    RAW_DIR,
    AGGREGATOR_URLS,
    get_browser_config,
    get_run_config,
)

OUT_DIR = RAW_DIR / "aggregators"


def slugify(text: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", text).strip("_")[:110]


def extract_aggregator_facts(site: str, url: str, title: str, md: str) -> dict:
    # Ratings (like 4.5/5, 4/5, Rating: 4.5)
    ratings = re.findall(r"(\d(?:\.\d)?)\s*/\s*5", md[:5000])
    pros = []
    cons = []
    deval_lines = []
    lounge_lines = []

    section_mode = None
    for line in md.splitlines():
        s = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", line).strip()
        sl = s.lower()
        if re.match(r"^#{1,4}\s*pros\b", sl) or sl == "pros" or sl.startswith("pros:"):
            section_mode = "pros"
            continue
        elif re.match(r"^#{1,4}\s*cons\b", sl) or sl == "cons" or sl.startswith("cons:"):
            section_mode = "cons"
            continue
        elif line.strip().startswith("#"):
            section_mode = None

        if section_mode == "pros" and (s.startswith("* ") or s.startswith("- ")):
            pros.append(s[2:].strip())
        elif section_mode == "cons" and (s.startswith("* ") or s.startswith("- ")):
            cons.append(s[2:].strip())

        if any(w in sl for w in ("devalu", "revised", "discontinued", "w.e.f", "effective from")):
            if 20 < len(s) < 350 and len(deval_lines) < 20:
                deval_lines.append(s)
        if "lounge" in sl and 20 < len(s) < 350 and len(lounge_lines) < 25:
            lounge_lines.append(s)

    return {
        "site": site,
        "url": url,
        "title": title,
        "md_length": len(md),
        "ratings_found": [float(r) for r in ratings[:5]],
        "pros": pros[:15],
        "cons": cons[:15],
        "devaluation_lines": deval_lines,
        "lounge_lines": lounge_lines,
    }


async def run_aggregators_bot(max_extra_per_site: int = 35):
    b_cfg = get_browser_config()
    r_cfg = get_run_config(wait_until="domcontentloaded", page_timeout=30000, excluded_tags=["nav", "footer"], cache_mode=CacheMode.ENABLED)

    records = []
    discovered_extras: list[tuple[str, str]] = []

    async with AsyncWebCrawler(config=b_cfg) as crawler:
        for site, seed_urls in AGGREGATOR_URLS.items():
            print(f"[Aggregators] Crawling {site} ({len(seed_urls)} seed pages)...")
            results = await crawler.arun_many(seed_urls, config=r_cfg)
            extra_links = set()
            for res in results:
                if not res.success or not res.markdown or not res.markdown.raw_markdown:
                    continue
                md = res.markdown.raw_markdown
                title = (res.metadata or {}).get("title", "") or ""
                fname = slugify(urlparse(res.url).path.strip("/")) or "home"
                (OUT_DIR / site / f"{fname}.md").write_text(md, encoding="utf-8")
                records.append(extract_aggregator_facts(site, res.url, title, md))

                for lnk in res.links.get("internal", []):
                    href = (lnk.get("href") or "").split("#")[0].split("?")[0]
                    hl = href.lower()
                    if site == "cardinsider" and ("credit-card" in hl or "lounge" in hl) and href not in seed_urls:
                        extra_links.add(href)
                    elif site == "cardexpert" and ("review" in hl or "devalu" in hl or "lounge" in hl or "best-credit" in hl) and "/category/" not in hl and "/tag/" not in hl and href not in seed_urls:
                        extra_links.add(href)
                    elif site == "bankbazaar" and "credit-card" in hl and href.endswith(".html") and "bill-payment" not in hl and "customer-care" not in hl and href not in seed_urls:
                        extra_links.add(href)

            # Prioritize review/lounge/devaluation links
            sorted_extra = sorted(
                extra_links,
                key=lambda u: (0 if any(k in u.lower() for k in ("devalu", "lounge", "review", "infinia", "atlas", "cashback", "magnus", "scapia", "hsbc", "amex")) else 1, len(u)),
            )[:max_extra_per_site]
            for u in sorted_extra:
                discovered_extras.append((site, u))
            print(f"[Aggregators] {site}: discovered {len(extra_links)} links, queued {len(sorted_extra)}")

        # Crawl discovered subpages
        if discovered_extras:
            print(f"[Aggregators] Crawling {len(discovered_extras)} extra review/lounge/devaluation pages...")
            url_to_site = {u: s for s, u in discovered_extras}
            urls = [u for _, u in discovered_extras]
            for i in range(0, len(urls), 20):
                batch = urls[i : i + 20]
                results = await crawler.arun_many(batch, config=r_cfg)
                for res in results:
                    if not res.success or not res.markdown or not res.markdown.raw_markdown:
                        continue
                    md = res.markdown.raw_markdown
                    if len(md) < 800:
                        continue
                    site = url_to_site.get(res.url, "other")
                    title = (res.metadata or {}).get("title", "") or ""
                    fname = slugify(urlparse(res.url).path.strip("/")) or "page"
                    (OUT_DIR / site / f"{fname}.md").write_text(md, encoding="utf-8")
                    records.append(extract_aggregator_facts(site, res.url, title, md))
                print(f"[Aggregators] Progress: {min(i + 20, len(urls))}/{len(urls)}")

    out_json = OUT_DIR / "aggregators_extracted.json"
    out_json.write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[Aggregators] Saved {len(records)} aggregator records to {out_json}")
    return records


if __name__ == "__main__":
    asyncio.run(run_aggregators_bot())
