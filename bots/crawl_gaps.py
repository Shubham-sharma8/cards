import asyncio
import json
import re
from crawl4ai import AsyncWebCrawler, CacheMode
from config import RAW_DIR, get_browser_config, get_run_config

GAP_URLS = [
    # High-signal Reddit devaluation & market shift threads discovered via related links
    ("reddit", "https://www.reddit.com/r/CreditCardsIndia/comments/1sc5zwl/regalia_gold_devaluation/"),
    ("reddit", "https://www.reddit.com/r/CreditCardsIndia/comments/1xhnw5i/yes_first_credit_card_revalued/"),
    ("reddit", "https://www.reddit.com/r/CreditCardsIndia/comments/1wg2e0q/sir_a_second_news_has_hit_the_forex_cards_market/"),
    ("reddit", "https://www.reddit.com/r/CreditCardsIndia/comments/1xti092/devaluation_season_starting_as_expected_as_we/"),
    ("reddit", "https://www.reddit.com/r/CreditCardsIndia/comments/1urj84b/look_how_the_mighty_have_fallen/"),
    ("reddit", "https://www.reddit.com/r/CreditCardsIndia/comments/1tjtqc9/credit_card_devaluation_is_about_to_get_a_lot/"),
    ("reddit", "https://www.reddit.com/r/CreditCardsIndia/comments/1rh3juy/what_is_happening_to_credit_card_why_so_many/"),
    ("reddit", "https://www.reddit.com/r/CreditCardsIndia/comments/1vnkf4j/indian_banks_biggest_failure_customer_loss_and/"),
    ("reddit", "https://www.reddit.com/r/CreditCardsIndia/comments/1u6q7h9/"),
    # CardInsider / CardExpert key 2025-2026 cards & devaluation hubs
    ("cardexpert", "https://www.cardexpert.in/category/credit-card-devaluation/"),
    ("cardexpert", "https://www.cardexpert.in/phonepe-sbi-card-select-black-review/"),
    ("cardexpert", "https://www.cardexpert.in/sbi-phonepe-select-black-credit-card-review/"),
    ("cardinsider", "https://cardinsider.com/sbi-card/phonepe-sbi-card-select-black/"),
    ("cardinsider", "https://cardinsider.com/fintech-cards/supermoney-credit-card/"),
    ("cardinsider", "https://cardinsider.com/yes-bank/kiwi-yes-bank-credit-card/"),
    ("cardinsider", "https://cardinsider.com/equitas-small-finance-bank/equitas-powermiles-credit-card/"),
    ("cardinsider", "https://cardinsider.com/hdfc-bank/hdfc-bank-diners-club-black-metal-edition-credit-card/"),
    ("paisabazaar", "https://www.paisabazaar.com/credit-card/best-rupay-credit-card/"),
]


async def main():
    out_dir = RAW_DIR / "enrichment" / "gaps"
    out_dir.mkdir(parents=True, exist_ok=True)
    b_cfg = get_browser_config()
    records = []

    async with AsyncWebCrawler(config=b_cfg) as crawler:
        for src, url in GAP_URLS:
            if src == "reddit":
                r_cfg = get_run_config(wait_until="networkidle", page_timeout=35000, delay=2.0, scan_full_page=True, cache_mode=CacheMode.ENABLED)
            else:
                r_cfg = get_run_config(wait_until="domcontentloaded", page_timeout=25000, excluded_tags=["nav", "header", "footer"], cache_mode=CacheMode.ENABLED)
            try:
                res = await asyncio.wait_for(crawler.arun(url, config=r_cfg), timeout=38)
                md = res.markdown.raw_markdown if (res and res.success and res.markdown) else ""
                if len(md) > 1500 and "page not found" not in md[:500].lower():
                    slug = re.sub(r"[^a-zA-Z0-9_-]+", "_", url.split("://", 1)[1].strip("/"))[:120]
                    fpath = out_dir / f"{src}_{slug}.md"
                    fpath.write_text(md, encoding="utf-8")
                    records.append({"source": src, "url": res.url or url, "file": str(fpath), "len": len(md)})
                    print(f"[Gaps] OK {src}: {slug} ({len(md)} chars)", flush=True)
                else:
                    print(f"[Gaps] SKIP {src}: {url} (len={len(md)})", flush=True)
            except Exception as e:
                print(f"[Gaps] ERR {src}: {url} -> {e}", flush=True)

    (out_dir / "gaps_index.json").write_text(json.dumps(records, indent=2), encoding="utf-8")
    print(f"[Gaps] Saved {len(records)} gap records.", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
