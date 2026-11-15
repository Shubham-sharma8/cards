import asyncio
import json
import re
from pathlib import Path

from crawl4ai import AsyncWebCrawler, CacheMode
from config import RAW_DIR, get_browser_config, get_run_config
from crawl_paisabazaar import parse_paisabazaar_card, slugify_url

OUT_DIR = RAW_DIR / "paisabazaar"

SKIP_PATTERNS = re.compile(
    r"(payment|billdesk|change-address|update-address|customer-care|apply-online|"
    r"credit-card-insurance|loan-on-credit-card|virtual-credit-card|corporate-|corporate_|"
    r"/lifetime-free-credit-card|rupay-credit-cards?/$|/fd-credit-card/$|/business-credit-cards?/$|"
    r"jet-airways|jet-privilege|intermiles|british-airways|/air-miles-credit-cards/$|"
    r"central-travel-account|distributor-credit-card|sap-concur|nri-|unifare-|chennai-super-kings|"
    r"manchester-united|chelsea-fc|harley-davidson|h-o-g-|payback|how-to-check|preferred-credit-cards|"
    r"purchase-credit-card|purchase-control|mobile-credit-card-benefits|payless-credit-card|"
    r"etmoney-loanpass|hypercity|crossword|equitas-co-branded)"
)


async def run_rest():
    disc = json.loads((OUT_DIR / "discovered_urls.json").read_text(encoding="utf-8"))
    out_json = OUT_DIR / "paisabazaar_cards.json"
    existing = json.loads(out_json.read_text(encoding="utf-8"))
    existing_urls = {c["url"] for c in existing}

    targets = []
    for u in disc["all_card_urls"]:
        if u in existing_urls:
            continue
        if SKIP_PATTERNS.search(u):
            continue
        # Must look like a real card page
        if u.rstrip("/").endswith("/credit-card") or u.rstrip("/").endswith("/credit-cards"):
            continue
        targets.append(u)

    print(f"[Paisabazaar-Rest] Existing cards: {len(existing)} | Remaining filtered active card URLs: {len(targets)}", flush=True)
    b_cfg = get_browser_config()
    r_cfg = get_run_config(wait_until="domcontentloaded", page_timeout=22000, excluded_tags=["nav", "header", "footer"], cache_mode=CacheMode.ENABLED)

    sem = asyncio.Semaphore(5)
    added = 0
    async with AsyncWebCrawler(config=b_cfg) as crawler:
        async def fetch_card(u: str):
            async with sem:
                try:
                    return await asyncio.wait_for(crawler.arun(u, config=r_cfg), timeout=26)
                except Exception:
                    return None

        batch_size = 15
        for i in range(0, len(targets), batch_size):
            batch = targets[i : i + batch_size]
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
                if res.url not in existing_urls:
                    existing.append(parsed)
                    existing_urls.add(res.url)
                    added += 1
            out_json.write_text(json.dumps(existing, indent=2, ensure_ascii=False), encoding="utf-8")
            print(f"[Paisabazaar-Rest] Progress: {min(i + batch_size, len(targets))}/{len(targets)} | Added: {added} | Total: {len(existing)}", flush=True)

    print(f"[Paisabazaar-Rest] Finished! Total Paisabazaar cards: {len(existing)}", flush=True)


if __name__ == "__main__":
    asyncio.run(run_rest())
