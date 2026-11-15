import asyncio
import json
import re
from urllib.parse import urlparse

from crawl4ai import AsyncWebCrawler, CacheMode
from config import (
    RAW_DIR,
    get_browser_config,
    get_run_config,
)

ENRICH_DIR = RAW_DIR / "enrichment"
REDDIT_OUT = RAW_DIR / "reddit" / "threads"
LOUNGE_OUT = ENRICH_DIR / "lounges"
CARDS_OUT = ENRICH_DIR / "cards"

for d in (ENRICH_DIR, REDDIT_OUT, LOUNGE_OUT, CARDS_OUT):
    d.mkdir(parents=True, exist_ok=True)


EXTRA_LOUNGE_AND_GUIDE_URLS = [
    # Paisabazaar bank-specific lounge lists
    "https://www.paisabazaar.com/axis-bank/credit-card-lounge-access/",
    "https://www.paisabazaar.com/hdfc-bank/credit-card-lounge-access/",
    "https://www.paisabazaar.com/sbi-bank/credit-card-lounge-access/",
    "https://www.paisabazaar.com/icici-bank/credit-card-lounge-access/",
    "https://www.paisabazaar.com/idfc-first-bank/credit-card-lounge-access/",
    "https://www.paisabazaar.com/kotak-mahindra-bank/credit-card-lounge-access/",
    "https://www.paisabazaar.com/indusind-bank/credit-card-lounge-access/",
    "https://www.paisabazaar.com/yes-bank/credit-card-lounge-access/",
    "https://www.paisabazaar.com/rbl-bank/credit-card-lounge-access/",
    "https://www.paisabazaar.com/hsbc-bank/credit-card-lounge-access/",
    "https://www.paisabazaar.com/au-small-finance-bank/credit-card-lounge-access/",
    "https://www.paisabazaar.com/credit-card/railway-lounge-access-credit-cards/",
    "https://www.paisabazaar.com/credit-card/credit-cards-with-lounge-access-without-spend-criteria/",
    # CardExpert high-signal guides & flagship reviews
    "https://www.cardexpert.in/complimentary-lounge-access-on-visa-signature-infinite-cards-india/",
    "https://www.cardexpert.in/mastercard-airport-lounge-access-in-india-2016/",
    "https://www.cardexpert.in/priority-pass-by-hdfc-everything-you-need-to-know/",
    "https://www.cardexpert.in/diners-club-credit-cards-in-india-and-its-acceptance/",
    "https://www.cardexpert.in/yes-bank-marquee-credit-card-review/",
    "https://www.cardexpert.in/axis-bank-cashback-credit-card/",
    "https://www.cardexpert.in/hdfc-tata-neu-infinity-credit-card/",
    "https://www.cardexpert.in/american-express-platinum-travel-credit-card-review/",
    "https://www.cardexpert.in/american-express-membership-rewards-credit-card-review/",
    "https://www.cardexpert.in/american-express-gold-card-review/",
    "https://www.cardexpert.in/au-bank-ixigo-credit-card-review/",
    "https://www.cardexpert.in/axis-atlas-credit-card-review/",
    "https://www.cardexpert.in/icici-amazon-pay-credit-card-review/",
    "https://www.cardexpert.in/airtel-axis-bank-credit-card-review/",
    "https://www.cardexpert.in/hdfc-diners-club-black-metal-edition-credit-card-review/",
    "https://www.cardexpert.in/hdfc-millennia-credit-card-review/",
    "https://www.cardexpert.in/indusind-eazydiner-credit-card-review/",
    # CardInsider high-signal reviews & lounge lists
    "https://cardinsider.com/blog/credit-cards-with-airport-lounge-access-without-spend-criteria/",
    "https://cardinsider.com/hdfc-bank/hdfc-bank-millennia-credit-card/",
    "https://cardinsider.com/hdfc-bank/hdfc-bank-swiggy-credit-card/",
    "https://cardinsider.com/hdfc-bank/tata-neu-infinity-hdfc-bank-credit-card/",
    "https://cardinsider.com/axis-bank/axis-bank-atlas-credit-card/",
    "https://cardinsider.com/axis-bank/airtel-axis-bank-credit-card/",
    "https://cardinsider.com/axis-bank/axis-bank-ace-credit-card/",
    "https://cardinsider.com/axis-bank/flipkart-axis-bank-credit-card/",
    "https://cardinsider.com/icici-bank/amazon-pay-icici-credit-card/",
    "https://cardinsider.com/icici-bank/icici-bank-sapphiro-credit-card/",
    "https://cardinsider.com/icici-bank/icici-bank-coral-credit-card/",
    "https://cardinsider.com/idfc-first-bank/idfc-first-wealth-credit-card/",
    "https://cardinsider.com/idfc-first-bank/idfc-first-select-credit-card/",
    "https://cardinsider.com/idfc-first-bank/idfc-first-wow-credit-card/",
    "https://cardinsider.com/au-bank/ixigo-au-credit-card/",
    "https://cardinsider.com/indusind-bank/indusind-bank-tiger-credit-card/",
    "https://cardinsider.com/indusind-bank/eazydiner-indusind-bank-credit-card/",
    "https://cardinsider.com/yes-bank/kiwi-yes-bank-credit-card/",
    "https://cardinsider.com/yes-bank/yes-bank-marquee-credit-card/",
    "https://cardinsider.com/american-express/american-express-platinum-travel-credit-card/",
    "https://cardinsider.com/american-express/american-express-membership-rewards-credit-card/",
    "https://cardinsider.com/american-express/american-express-gold-card/",
    "https://cardinsider.com/sbi-card/sbi-card-prime/",
    "https://cardinsider.com/sbi-card/sbi-card-elite/",
    "https://cardinsider.com/sbi-card/bpcl-sbi-card-octane/",
    "https://cardinsider.com/bank-of-baroda/bobcard-eterna-credit-card/",
    "https://cardinsider.com/fintech-cards/one-credit-card/",
]


def slugify(text: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", text).strip("_")[:110]


def get_master_index_reddit_urls() -> list[str]:
    idx_file = RAW_DIR / "reddit" / "feeds" / "comments_1l5eqda_master_index_your_goto_resource.md"
    if not idx_file.exists():
        return []
    md = idx_file.read_text(encoding="utf-8")
    section = md.split("## Moderator Announcements")[0]
    links = re.findall(r"https://www\.reddit\.com/r/CreditCardsIndia/(?:comments|s)/[^\)\s]+", section)
    clean = []
    seen = set()
    for u in links:
        if "sticky" in u:
            continue
        base = u.split("?")[0]
        if base not in seen:
            seen.add(base)
            clean.append(base)
    return clean


async def run_enrichment_bot():
    b_cfg = get_browser_config()
    web_cfg = get_run_config(wait_until="domcontentloaded", page_timeout=30000, excluded_tags=["nav", "footer"], cache_mode=CacheMode.ENABLED)
    reddit_cfg = get_run_config(
        wait_until="networkidle",
        page_timeout=40000,
        excluded_tags=["nav", "footer"],
        cache_mode=CacheMode.ENABLED,
        delay=1.0,
        scan_full_page=True,
    )

    saved_lounge_guides = []
    saved_reddit_guides = []

    async with AsyncWebCrawler(config=b_cfg) as crawler:
        print(f"[Enrichment] Crawling {len(EXTRA_LOUNGE_AND_GUIDE_URLS)} lounge & flagship card pages...", flush=True)
        for i in range(0, len(EXTRA_LOUNGE_AND_GUIDE_URLS), 15):
            batch = EXTRA_LOUNGE_AND_GUIDE_URLS[i : i + 15]
            results = await crawler.arun_many(batch, config=web_cfg)
            for res in results:
                if not res.success or not res.markdown or not res.markdown.raw_markdown:
                    continue
                md = res.markdown.raw_markdown
                if len(md) < 800 or "nothing here" in md.lower()[:1200]:
                    continue
                is_lounge = "lounge" in res.url.lower() or "priority-pass" in res.url.lower() or "diners-club" in res.url.lower()
                folder = LOUNGE_OUT if is_lounge else CARDS_OUT
                fname = slugify(urlparse(res.url).netloc + "_" + urlparse(res.url).path.strip("/"))
                (folder / f"{fname}.md").write_text(md, encoding="utf-8")
                saved_lounge_guides.append({
                    "url": res.url,
                    "title": (res.metadata or {}).get("title", "") or "",
                    "type": "lounge_or_network_guide" if is_lounge else "flagship_card_review",
                    "md_length": len(md),
                    "file": str(folder / f"{fname}.md"),
                })
            print(f"[Enrichment] Web progress: {min(i + 15, len(EXTRA_LOUNGE_AND_GUIDE_URLS))}/{len(EXTRA_LOUNGE_AND_GUIDE_URLS)} | Saved: {len(saved_lounge_guides)}", flush=True)

        reddit_urls = get_master_index_reddit_urls()
        # Skip ones already saved
        existing = {p.name for p in REDDIT_OUT.glob("*.md")}
        print(f"[Enrichment] Crawling {len(reddit_urls)} Reddit Master Index guides & devaluation posts...", flush=True)
        for i in range(0, len(reddit_urls), 5):
            batch = reddit_urls[i : i + 5]
            results = await crawler.arun_many(batch, config=reddit_cfg)
            for res in results:
                if not res.success or not res.markdown or not res.markdown.raw_markdown:
                    continue
                md = res.markdown.raw_markdown
                if len(md) < 800:
                    continue
                final_url = res.url
                fname = "mi_" + slugify(urlparse(final_url).path.replace("/r/CreditCardsIndia/", "")) + ".md"
                if fname not in existing:
                    (REDDIT_OUT / fname).write_text(md, encoding="utf-8")
                saved_reddit_guides.append({
                    "url": final_url,
                    "title": (res.metadata or {}).get("title", "") or "",
                    "md_length": len(md),
                    "file": str(REDDIT_OUT / fname),
                })
            print(f"[Enrichment] Reddit progress: {min(i + 5, len(reddit_urls))}/{len(reddit_urls)} | Saved: {len(saved_reddit_guides)}", flush=True)

    summary = {
        "lounge_and_flagship_reviews": saved_lounge_guides,
        "reddit_master_index_threads": saved_reddit_guides,
    }
    (ENRICH_DIR / "enrichment_index.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[Enrichment] Done! Saved {len(saved_lounge_guides)} web guides + {len(saved_reddit_guides)} Reddit threads.", flush=True)


if __name__ == "__main__":
    asyncio.run(run_enrichment_bot())
