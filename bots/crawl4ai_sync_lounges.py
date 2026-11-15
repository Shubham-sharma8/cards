#!/usr/bin/env python3
"""
Batch-crawl missing CardMaven airport lounge dynamic pages, new sitemap posts,
and r/CreditCardsIndia lounge-portal/card update discussions using Crawl4AI.
"""

from __future__ import annotations

import asyncio
import json
import re
import urllib.request
from pathlib import Path

from crawl4ai import AsyncWebCrawler, BrowserConfig, CacheMode, CrawlerRunConfig
from crawl4ai.async_dispatcher import SemaphoreDispatcher

ROOT_DIR = Path("/Users/shubhamsharma/Downloads/Credit Card")
RAW_CM_DIR = ROOT_DIR / "data" / "raw" / "cardmaven"
DYNAMIC_DIR = RAW_CM_DIR / "dynamic"
DYNAMIC_DIR.mkdir(parents=True, exist_ok=True)
OUT_EXTRA = RAW_CM_DIR / "crawl4ai_extra_enrichment.json"


def discover_new_sitemap_urls(existing_urls: set[str]) -> list[str]:
    """Check CardMaven XML sitemaps for new lounge, golf, or card posts."""
    discovered: list[str] = []
    for sm_url in [
        "https://cardmaven.in/post-sitemap.xml",
        "https://cardmaven.in/post-sitemap2.xml",
        "https://cardmaven.in/airport-lounges-sitemap.xml",
        "https://cardmaven.in/page-sitemap.xml",
    ]:
        try:
            req = urllib.request.Request(
                sm_url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; CardifyBot/1.0)"},
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                xml_txt = resp.read().decode("utf-8", errors="ignore")
            locs = re.findall(r"<loc>(https://cardmaven\.in/[^<]+)</loc>", xml_txt)
            for u in locs:
                if u not in existing_urls and (
                    "lounge" in u.lower()
                    or "golf" in u.lower()
                    or "credit-card" in u.lower()
                    or "review" in u.lower()
                    or "2026" in u.lower()
                    or "devaluation" in u.lower()
                ):
                    discovered.append(u)
        except Exception:
            continue
    return list(dict.fromkeys(discovered))[:35]


def fetch_reddit_lounge_and_card_threads() -> list[dict]:
    """Fetch public JSON summaries from r/CreditCardsIndia for 2026 lounge portals & cards."""
    queries = [
        "lms.hoi.in OR loungeone OR Adani TFS lounge access QR 2026",
        "RuPay lounge portal Mastercard concierge golf lounge 2026",
        "credit card lounge access devaluation 2026 spend criteria",
    ]
    threads: list[dict] = []
    seen_ids: set[str] = set()
    for q in queries:
        url = (
            "https://www.reddit.com/r/CreditCardsIndia/search.json?q="
            + urllib.parse.quote(q)
            + "&restrict_sr=1&sort=relevance&t=year&limit=10"
        )
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "python:cardify-research:v1.0 (by /u/cogify_research)"},
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                payload = json.loads(resp.read().decode("utf-8", errors="ignore"))
            for child in (payload.get("data") or {}).get("children") or []:
                d = child.get("data") or {}
                pid = d.get("id")
                if not pid or pid in seen_ids:
                    continue
                seen_ids.add(pid)
                threads.append(
                    {
                        "id": pid,
                        "title": d.get("title", ""),
                        "url": "https://www.reddit.com" + str(d.get("permalink", "")),
                        "score": d.get("score", 0),
                        "num_comments": d.get("num_comments", 0),
                        "selftext": (d.get("selftext") or "")[:1800],
                    }
                )
        except Exception as e:
            threads.append({"error": str(e), "query": q})
    return threads


async def main() -> None:
    cm = json.loads((RAW_CM_DIR / "cardmaven_parsed.json").read_text(encoding="utf-8"))
    pages = cm.get("pages") or {}
    existing_urls = set(pages.keys())

    ap_urls = [u for u, p in pages.items() if p.get("page_kind") == "airport_lounge"]
    existing_dyn = {p.stem for p in DYNAMIC_DIR.glob("*.md")}
    target_ap_urls = [u for u in ap_urls if u.rstrip("/").split("/")[-1] not in existing_dyn]
    if "https://cardmaven.in/airport-lounges/" not in existing_urls:
        target_ap_urls.append("https://cardmaven.in/airport-lounges/")

    new_posts = discover_new_sitemap_urls(existing_urls)
    all_urls = target_ap_urls + new_posts
    print(f"Target CardMaven URLs to crawl: {len(target_ap_urls)} airports + {len(new_posts)} new sitemap posts")

    browser_cfg = BrowserConfig(headless=True, viewport_width=1440, viewport_height=900)
    run_cfg = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        wait_until="networkidle",
        page_timeout=60000,
    )
    dispatcher = SemaphoreDispatcher(max_session_permit=6)

    crawled_extra: list[dict] = []
    if all_urls:
        async with AsyncWebCrawler(config=browser_cfg) as crawler:
            results = await crawler.arun_many(
                urls=all_urls, config=run_cfg, dispatcher=dispatcher
            )
            for res in results:
                slug = res.url.rstrip("/").split("/")[-1] or "index"
                md_text = str(getattr(res, "markdown", "") or "")
                if res.success and md_text:
                    if "/airport-lounges/" in res.url:
                        out_slug = "airport_lounges_index" if res.url.rstrip("/").endswith("airport-lounges") else slug
                        (DYNAMIC_DIR / f"{out_slug}.md").write_text(md_text, encoding="utf-8")
                    else:
                        (RAW_CM_DIR / "markdown" / f"{slug}.md").write_text(md_text, encoding="utf-8")
                    crawled_extra.append(
                        {
                            "url": res.url,
                            "slug": slug,
                            "title": (res.metadata or {}).get("title", ""),
                            "chars": len(md_text),
                            "links_count": len((res.links or {}).get("internal", [])),
                        }
                    )
                else:
                    print(f"[WARN] Failed {res.url}: {res.error_message}")

    reddit_threads = fetch_reddit_lounge_and_card_threads()
    OUT_EXTRA.write_text(
        json.dumps(
            {
                "crawled_pages": crawled_extra,
                "reddit_threads": reddit_threads,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    print(
        f"[DONE] Crawled {len(crawled_extra)}/{len(all_urls)} CardMaven pages + "
        f"{len(reddit_threads)} Reddit threads."
    )


if __name__ == "__main__":
    import urllib.parse

    asyncio.run(main())
