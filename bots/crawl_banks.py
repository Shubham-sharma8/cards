import asyncio
import json
import re
from urllib.parse import urlparse

from crawl4ai import AsyncWebCrawler, CacheMode
from config import (
    RAW_DIR,
    OFFICIAL_BANK_PORTALS,
    FINTECH_CARD_PORTALS,
    get_browser_config,
    get_run_config,
)

OUT_DIR = RAW_DIR / "banks"


def slugify(text: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", text).strip("_")[:120]


def is_bank_card_subpage(bank_key: str, href: str) -> bool:
    u = href.lower().split("#")[0].split("?")[0]
    if not u.startswith("http"):
        return False
    # Exclude non-page assets and generic utility links
    if any(u.endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".svg", ".webp", ".mp4", ".css", ".js")):
        return False
    bad_tokens = (
        "login", "netbanking", "apply-now", "apply_now", "track", "faq", "customer-care",
        "block-card", "bill-pay", "locate", "branch", "atm", "career", "investor",
        "privacy", "disclaimer", "terms-and-conditions", "sitemap", "loan", "insurance",
        "mutual-fund", "fixed-deposit", "savings-account", "debit-card", "forex-card",
    )
    if any(t in u for t in bad_tokens):
        return False

    if bank_key == "hdfc":
        return ("hdfc.bank.in" in u or "hdfcbank.com" in u) and "credit-card" in u
    if bank_key == "sbi":
        return "sbicard.com" in u and ("/credit-cards/" in u or "lounge" in u or "mitc" in u)
    if bank_key == "icici":
        return "icicibank.com" in u and "credit-card" in u
    if bank_key == "axis":
        return ("axisbank.com" in u or "axis.bank.in" in u) and ("credit-card" in u or "lounge" in u)
    if bank_key == "kotak":
        return ("kotak.com" in u or "kotak.bank.in" in u) and "credit-card" in u
    if bank_key == "idfc":
        return ("idfcfirstbank.com" in u or "idfcfirst.bank.in" in u) and "credit-card" in u
    if bank_key == "indusind":
        return ("indusind.com" in u or "indusind.bank.in" in u) and "credit-card" in u
    if bank_key == "au":
        return ("aubank.in" in u or "au.bank.in" in u) and "credit-card" in u
    if bank_key == "hsbc":
        return "hsbc.co.in" in u and "credit-cards/" in u
    if bank_key == "rbl":
        return "rblbank.com" in u and "credit-card" in u
    if bank_key == "yes":
        return ("yes.bank.in" in u or "yesbank.in" in u) and "credit-card" in u
    if bank_key == "sc":
        return "sc.com/in" in u and "credit-cards/" in u
    if bank_key == "bobcard":
        return "bobcard.co.in" in u and ("card" in u or "lounge" in u)
    if bank_key == "amex":
        return "americanexpress.com" in u and "credit-cards" in u
    return "credit-card" in u


def extract_bank_card_facts(bank_key: str, url: str, title: str, md: str) -> dict:
    # Extract key fees, lounge lines, reward snippets, PDF links from official page
    lounge_lines = []
    fee_lines = []
    reward_lines = []
    forex_lines = []

    for line in md.splitlines():
        s = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", line).strip()
        if not s or len(s) < 12 or len(s) > 400:
            continue
        sl = s.lower()
        if "lounge" in sl or "priority pass" in sl or "dreamfolks" in sl:
            if s not in lounge_lines and len(lounge_lines) < 25:
                lounge_lines.append(s)
        if any(k in sl for k in ("joining fee", "annual fee", "renewal fee", "waiver", "lifetime free")):
            if s not in fee_lines and len(fee_lines) < 20:
                fee_lines.append(s)
        if any(k in sl for k in ("cashback", "reward point", "miles", "edge reward", "neucon", "supercoin", "multiplier")):
            if s not in reward_lines and len(reward_lines) < 25:
                reward_lines.append(s)
        if "forex" in sl or "foreign currency" in sl or "markup" in sl:
            if s not in forex_lines and len(forex_lines) < 10:
                forex_lines.append(s)

    pdf_links = sorted(set(re.findall(r"https?://[^\s\)\"']+\.pdf", md, re.IGNORECASE)))[:25]

    return {
        "bank_key": bank_key,
        "url": url,
        "title": title,
        "md_length": len(md),
        "fee_lines": fee_lines,
        "lounge_lines": lounge_lines,
        "reward_lines": reward_lines,
        "forex_lines": forex_lines,
        "pdf_links": pdf_links,
    }


async def run_banks_bot(max_subpages_per_bank: int = 18):
    b_cfg = get_browser_config()
    r_cfg = get_run_config(wait_until="domcontentloaded", page_timeout=30000, excluded_tags=["nav", "footer"], cache_mode=CacheMode.ENABLED)

    all_portals = {**OFFICIAL_BANK_PORTALS, **FINTECH_CARD_PORTALS}
    urls = list(all_portals.values())
    url_to_bank = {v: k for k, v in all_portals.items()}

    extracted = []
    subpage_targets: list[tuple[str, str]] = []

    async with AsyncWebCrawler(config=b_cfg) as crawler:
        print(f"[Banks] Crawling {len(urls)} official Indian bank & fintech portals...")
        hub_results = await crawler.arun_many(urls, config=r_cfg)

        for res in hub_results:
            # Match back to bank key
            b_key = url_to_bank.get(res.url)
            if not b_key:
                for orig_u, k in url_to_bank.items():
                    if urlparse(orig_u).netloc.replace("www.", "")[:8] in res.url:
                        b_key = k
                        break
            b_key = b_key or slugify(urlparse(res.url).netloc)

            bank_dir = OUT_DIR / b_key
            bank_dir.mkdir(parents=True, exist_ok=True)

            if not res.success or not res.markdown or not res.markdown.raw_markdown:
                print(f"[Banks] Warning: {b_key} ({res.url}) -> ok={res.success} status={res.status_code} err={res.error_message}")
                continue

            md = res.markdown.raw_markdown
            title = (res.metadata or {}).get("title", "") or ""
            (bank_dir / "_hub.md").write_text(md, encoding="utf-8")
            extracted.append(extract_bank_card_facts(b_key, res.url, title, md))

            # Collect subpages
            found = []
            for lnk in res.links.get("internal", []) + res.links.get("external", []):
                href = (lnk.get("href") or "").split("#")[0].split("?")[0]
                if href and href != res.url and is_bank_card_subpage(b_key, href):
                    if href not in found:
                        found.append(href)
            # Prioritize lounge pages & individual card pages
            found_sorted = sorted(found, key=lambda x: (0 if "lounge" in x.lower() else 1, len(x)))
            for sub_u in found_sorted[:max_subpages_per_bank]:
                subpage_targets.append((b_key, sub_u))

            print(f"[Banks] {b_key}: hub md={len(md)}, discovered {len(found)} subpages (queued {min(len(found), max_subpages_per_bank)})")

        # Deduplicate subpage URLs
        seen_sub = set()
        unique_subs = []
        for b_key, u in subpage_targets:
            if u not in seen_sub:
                seen_sub.add(u)
                unique_subs.append((b_key, u))

        print(f"[Banks] Crawling {len(unique_subs)} official bank card/lounge subpages...")
        batch_size = 25
        sub_url_to_bank = {u: b_key for b_key, u in unique_subs}
        sub_urls = [u for _, u in unique_subs]

        for i in range(0, len(sub_urls), batch_size):
            batch = sub_urls[i : i + batch_size]
            results = await crawler.arun_many(batch, config=r_cfg)
            for res in results:
                if not res.success or not res.markdown or not res.markdown.raw_markdown:
                    continue
                md = res.markdown.raw_markdown
                if len(md) < 400:
                    continue
                b_key = sub_url_to_bank.get(res.url, "other")
                bank_dir = OUT_DIR / b_key
                bank_dir.mkdir(parents=True, exist_ok=True)
                fname = slugify(urlparse(res.url).path.strip("/")) or "page"
                (bank_dir / f"{fname}.md").write_text(md, encoding="utf-8")
                title = (res.metadata or {}).get("title", "") or ""
                extracted.append(extract_bank_card_facts(b_key, res.url, title, md))
            print(f"[Banks] Subpages progress: {min(i + batch_size, len(sub_urls))}/{len(sub_urls)}")

    out_json = OUT_DIR / "banks_extracted.json"
    out_json.write_text(json.dumps(extracted, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[Banks] Saved {len(extracted)} official bank records to {out_json}")
    return extracted


if __name__ == "__main__":
    asyncio.run(run_banks_bot())
