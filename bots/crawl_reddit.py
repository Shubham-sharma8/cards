import asyncio
import json
import re
from urllib.parse import urlparse

from crawl4ai import AsyncWebCrawler, CacheMode
from config import (
    RAW_DIR,
    REDDIT_SEED_URLS,
    get_browser_config,
    get_run_config,
)

OUT_DIR = RAW_DIR / "reddit"

CARD_PATTERNS = [
    ("HDFC Infinia", r"\binfinia\b"),
    ("HDFC Diners Club Black", r"\b(dcb|diners club black|diners black)\b"),
    ("HDFC Regalia Gold", r"\bregalia gold\b"),
    ("HDFC Millennia", r"\bmillennia\b"),
    ("HDFC Swiggy", r"\bswiggy\s*hdfc\b|\bhdfc\s*swiggy\b"),
    ("HDFC Tata Neu Infinity", r"\btata\s*neu\s*infinity\b"),
    ("HDFC Tata Neu Plus", r"\btata\s*neu\s*plus\b"),
    ("SBI Cashback", r"\bsbi\s*cashback\b"),
    ("SBI SimplyCLICK", r"\bsimply\s*click\b"),
    ("SBI SimplySAVE", r"\bsimply\s*save\b"),
    ("SBI Octane", r"\bsbi\b.*\boctane\b|\bbpcl\s*octane\b"),
    ("SBI Prime", r"\bsbi\s*prime\b"),
    ("SBI Elite", r"\bsbi\s*elite\b"),
    ("Axis Atlas", r"\baxis\s*atlas\b|\batlas\b"),
    ("Axis Magnus", r"\bmagnus\b"),
    ("Axis Airtel", r"\bairtel\s*axis\b|\baxis\s*airtel\b"),
    ("Axis Ace", r"\baxis\s*ace\b"),
    ("Axis Flipkart", r"\bflipkart\s*axis\b|\baxis\s*flipkart\b"),
    ("Axis My Zone", r"\bmy\s*zone\b"),
    ("Axis Neo", r"\baxis\s*neo\b"),
    ("Axis Olympus", r"\baxis\s*olympus\b|\bolympus\b"),
    ("Axis Horizon", r"\baxis\s*horizon\b"),
    ("ICICI Amazon Pay", r"\bamazon\s*pay\s*icici\b|\bapay\s*icici\b|\bicici\s*amazon\b"),
    ("ICICI Sapphiro", r"\bsapphiro\b"),
    ("ICICI Emeralde Private Metal", r"\bemeralde\s*private\b|\bepm\b"),
    ("ICICI Coral", r"\bicici\s*coral\b|\bcoral\s*rupay\b"),
    ("ICICI Rubyx", r"\brubyx\b"),
    ("HSBC Live+", r"\bhsbc\s*live\s*\+?|\blive\+\b"),
    ("HSBC TravelOne", r"\btravel\s*one\b|\btravelone\b"),
    ("HSBC Premier", r"\bhsbc\s*premier\b"),
    ("Amex Platinum Travel", r"\bplat\s*travel\b|\bplatinum\s*travel\b"),
    ("Amex MRCC", r"\bmrcc\b|\bmembership\s*rewards\b"),
    ("Amex Gold Charge", r"\bamex\s*gold\b"),
    ("Amex SmartEarn", r"\bsmartearn\b"),
    ("Amex Platinum Charge", r"\bplatinum\s*charge\b"),
    ("IDFC FIRST Wealth", r"\bidfc\s*(?:first\s*)?wealth\b"),
    ("IDFC FIRST Select", r"\bidfc\s*(?:first\s*)?select\b"),
    ("IDFC FIRST Millennia", r"\bidfc\s*(?:first\s*)?millennia\b"),
    ("IDFC FIRST WOW", r"\bidfc\s*(?:first\s*)?wow\b"),
    ("IDFC FIRST Power+", r"\bidfc\s*(?:first\s*)?power\s*\+"),
    ("IDFC FIRST Mayura", r"\bmayura\b"),
    ("IDFC FIRST Ashva", r"\bashva\b"),
    ("Federal Scapia", r"\bscapia\b"),
    ("AU Ixigo", r"\bixigo\s*au\b|\bau\s*ixigo\b"),
    ("AU Zenith+", r"\bzenith\s*\+|\bzenith\s*plus\b"),
    ("AU LIT", r"\bau\s*lit\b"),
    ("IndusInd Tiger", r"\bindusind\s*tiger\b"),
    ("IndusInd Eazydiner", r"\beazydiner\b"),
    ("IndusInd Legend", r"\bindusind\s*legend\b"),
    ("IndusInd Pinnacle", r"\bpinnacle\b"),
    ("YES Kiwi", r"\bkiwi\b"),
    ("YES Marquee", r"\bmarquee\b"),
    ("OneCard", r"\bonecard\b|\bone\s*card\b"),
    ("Kotak 811 Dream Different", r"\bdream\s*different\b"),
    ("RBL Shoprite", r"\bshoprite\b"),
    ("RBL World Safari", r"\bworld\s*safari\b"),
    ("BOBCARD Eterna", r"\beterna\b"),
    ("BOBCARD Tiara", r"\bbob\w*\s*tiara\b"),
    ("BOBCARD Premier", r"\bbob\w*\s*premier\b"),
    ("Standard Chartered Smart", r"\bsc\s*smart\b|\bsmart\s*credit\b"),
    ("Standard Chartered Ultimate", r"\bsc\s*ultimate\b"),
    ("Standard Chartered EaseMyTrip", r"\bsc\s*easemytrip\b|\beasemytrip\b"),
    ("SuperMoney SuperCard", r"\bsupercard\b|\bsuper\.money\b"),
    ("Roarbank", r"\broar\s*bank\b|\broarbank\b"),
    ("Jupiter Edge+", r"\bjupiter\s*edge\b"),
    ("Kotak Myntra", r"\bkotak\s*myntra\b"),
    ("Kotak Zen", r"\bkotak\s*zen\b"),
    ("Kotak Mojo", r"\bkotak\s*mojo\b"),
    ("Kotak IndianOil", r"\bkotak\s*indianoil\b"),
    ("YES Reserv", r"\byes\s*reserv\b"),
    ("YES Prosperity", r"\byes\s*prosperity\b"),
    ("IDFC FIRST Classic", r"\bidfc\s*(?:first\s*)?classic\b"),
    ("RBL Cookies", r"\brbl\s*cookies\b"),
    ("PNB RuPay", r"\bpnb\s*rupay\b"),
]


def slugify(text: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", text).strip("_")[:100]


def extract_thread_urls(md: str, links: dict) -> list[str]:
    urls = set()
    for lnk in links.get("internal", []) + links.get("external", []):
        href = (lnk.get("href") or "").split("?")[0].split("#")[0]
        if "/r/CreditCardsIndia/comments/" in href:
            if href.startswith("/"):
                href = "https://www.reddit.com" + href
            # Skip individual comment permalinks (have more than 7 path segments)
            parts = [p for p in urlparse(href).path.split("/") if p]
            if len(parts) >= 4 and parts[2] == "comments":
                canonical = f"https://www.reddit.com/r/CreditCardsIndia/comments/{parts[3]}/" + (f"{parts[4]}/" if len(parts) >= 5 else "")
                urls.add(canonical)
    # Also scan markdown text for comment links
    for m in re.findall(r"https?://(?:www\.|old\.)?reddit\.com/r/CreditCardsIndia/comments/[a-z0-9]+/[^\s\)\"']*", md):
        clean = m.split("?")[0].split("#")[0].replace("https://old.reddit.com", "https://www.reddit.com")
        urls.add(clean)
    return sorted(urls)


def analyze_reddit_content(url: str, title: str, md: str) -> dict:
    mentions = {}
    low = md.lower()
    for card_name, pat in CARD_PATTERNS:
        cnt = len(re.findall(pat, low))
        if cnt > 0:
            mentions[card_name] = cnt

    deval_snippets = []
    lounge_snippets = []
    rec_snippets = []

    for line in md.splitlines():
        s = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", line).strip()
        if len(s) < 25 or len(s) > 450:
            continue
        sl = s.lower()
        if any(w in sl for w in ("devalu", "nerf", "capping", "cap ", "excluded", "exclusion", "discontinued", "spend criteria", "spend-based")):
            if len(deval_snippets) < 20:
                deval_snippets.append(s)
        if "lounge" in sl or "priority pass" in sl or "dreamfolks" in sl:
            if len(lounge_snippets) < 20:
                lounge_snippets.append(s)
        if any(w in sl for w in ("best ", "recommend", "ltf", "worth", "goat", "must have", "cashback", "travel")):
            if len(rec_snippets) < 20:
                rec_snippets.append(s)

    return {
        "url": url,
        "title": title,
        "md_length": len(md),
        "card_mentions": mentions,
        "devaluation_snippets": deval_snippets,
        "lounge_snippets": lounge_snippets,
        "recommendation_snippets": rec_snippets,
    }


async def run_reddit_bot(max_threads: int = 120):
    b_cfg = get_browser_config()
    r_cfg = get_run_config(
        wait_until="domcontentloaded",
        page_timeout=25000,
        excluded_tags=["nav", "footer"],
        cache_mode=CacheMode.ENABLED,
        delay=1.2,
        scan_full_page=False,
    )

    feed_insights = []
    thread_urls = set()

    async with AsyncWebCrawler(config=b_cfg) as crawler:
        feed_urls = [u.replace("https://www.reddit.com", "https://old.reddit.com") for u in REDDIT_SEED_URLS]
        print(f"[Reddit] Crawling {len(feed_urls)} r/CreditCardsIndia feeds & searches...")
        # Crawl feeds in small batches to avoid rate limits
        for i in range(0, len(feed_urls), 4):
            batch = feed_urls[i : i + 4]
            results = await crawler.arun_many(batch, config=r_cfg)
            for res in results:
                if not res.success or not res.markdown or not res.markdown.raw_markdown:
                    print(f"[Reddit] Feed skip: {res.url} status={res.status_code} err={res.error_message}")
                    continue
                md = res.markdown.raw_markdown
                title = (res.metadata or {}).get("title", "") or ""
                canon_feed = res.url.replace("https://old.reddit.com", "https://www.reddit.com")
                fname = slugify(canon_feed.replace("https://www.reddit.com/r/CreditCardsIndia/", "")) or "feed"
                (OUT_DIR / "feeds" / f"{fname}.md").write_text(md, encoding="utf-8")
                feed_insights.append(analyze_reddit_content(canon_feed, title, md))
                for tu in extract_thread_urls(md, res.links):
                    tu_canon = tu.replace("https://old.reddit.com", "https://www.reddit.com")
                    if "weekly_voucher_exchange" not in tu_canon and "monthly_community_wins" not in tu_canon:
                        thread_urls.add(tu_canon)
            await asyncio.sleep(1.0)

        # Prioritize high-signal threads across all major issuers
        def priority_score(u: str) -> tuple[int, str]:
            ul = u.lower()
            score = 0
            for kw, wt in [
                ("master_index", -50), ("complete_guide", -45), ("megathread", -40),
                ("devalu", -30), ("lounge", -25), ("tier", -25), ("best", -20),
                ("cashback", -15), ("travel", -15), ("rupay", -15), ("upi", -15),
                ("ltf", -12), ("infinia", -10), ("atlas", -10), ("sbi_cashback", -10),
                ("hdfc", -8), ("axis", -8), ("icici", -8), ("amex", -8), ("hsbc", -8),
                ("idfc", -10), ("indusind", -10), ("yes_bank", -10), ("kiwi", -10),
                ("bobcard", -10), ("kotak", -10), ("rbl", -10), ("scapia", -10),
                ("onecard", -10), ("au_", -10), ("ixigo", -10), ("standard_chartered", -10),
            ]:
                if kw in ul:
                    score += wt
            return (score, ul)

        prioritized_threads = sorted(thread_urls, key=priority_score)[:max_threads]
        print(f"[Reddit] Discovered {len(thread_urls)} unique threads; crawling top {len(prioritized_threads)} high-signal threads...")

        thread_insights = []
        seen_thread_urls = set()
        for i in range(0, len(prioritized_threads), 5):
            batch = [u.replace("https://www.reddit.com", "https://old.reddit.com") for u in prioritized_threads[i : i + 5]]
            results = await crawler.arun_many(batch, config=r_cfg)
            for res in results:
                if not res.success or not res.markdown or not res.markdown.raw_markdown:
                    continue
                md = res.markdown.raw_markdown
                if len(md) < 800:
                    continue
                canon_u = res.url.replace("https://old.reddit.com", "https://www.reddit.com")
                title = (res.metadata or {}).get("title", "") or ""
                fname = slugify(urlparse(canon_u).path.replace("/r/CreditCardsIndia/comments/", "")) or "thread"
                (OUT_DIR / "threads" / f"{fname}.md").write_text(md, encoding="utf-8")
                thread_insights.append(analyze_reddit_content(canon_u, title, md))
                seen_thread_urls.add(canon_u.rstrip("/"))
            print(f"[Reddit] Thread progress: {min(i + 5, len(prioritized_threads))}/{len(prioritized_threads)}")
            await asyncio.sleep(1.0)

        # Preserve any previously cached thread insights not in this batch
        prev_json = OUT_DIR / "reddit_insights.json"
        if prev_json.exists():
            try:
                prev_data = json.loads(prev_json.read_text(encoding="utf-8"))
                for tr in prev_data.get("threads", []):
                    u = (tr.get("url") or "").rstrip("/")
                    if u and u not in seen_thread_urls:
                        thread_insights.append(tr)
                        seen_thread_urls.add(u)
            except Exception:
                pass

    out_json = OUT_DIR / "reddit_insights.json"
    out_json.write_text(
        json.dumps({"feeds": feed_insights, "threads": thread_insights}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"[Reddit] Saved {len(feed_insights)} feeds and {len(thread_insights)} threads to {out_json}")
    return {"feeds": feed_insights, "threads": thread_insights}


if __name__ == "__main__":
    asyncio.run(run_reddit_bot())
