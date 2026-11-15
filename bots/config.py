import os
from pathlib import Path
from crawl4ai import BrowserConfig, CrawlerRunConfig, CacheMode

os.environ["CRAWL4AI_NO_CLOUD_NOTICE"] = "1"

ROOT_DIR = Path("/Users/shubhamsharma/Downloads/Credit Card")
RAW_DIR = ROOT_DIR / "data" / "raw"
MASTER_DIR = ROOT_DIR / "data" / "master"

for sub in [
    RAW_DIR / "paisabazaar" / "cards",
    RAW_DIR / "paisabazaar" / "guides",
    RAW_DIR / "paisabazaar" / "banks",
    RAW_DIR / "banks",
    RAW_DIR / "reddit" / "threads",
    RAW_DIR / "reddit" / "feeds",
    RAW_DIR / "aggregators" / "cardinsider",
    RAW_DIR / "aggregators" / "cardexpert",
    RAW_DIR / "aggregators" / "bankbazaar",
    RAW_DIR / "aggregators" / "fintechs",
    MASTER_DIR / "categories",
]:
    sub.mkdir(parents=True, exist_ok=True)


def get_browser_config(user_agent_mode: str | None = None) -> BrowserConfig:
    kwargs = dict(
        headless=True,
        viewport_width=1440,
        viewport_height=900,
        ignore_https_errors=True,
        verbose=False,
    )
    if user_agent_mode:
        kwargs["user_agent_mode"] = user_agent_mode
    return BrowserConfig(**kwargs)


def get_run_config(
    wait_until: str = "domcontentloaded",
    page_timeout: int = 35000,
    excluded_tags: list[str] | None = None,
    cache_mode: CacheMode = CacheMode.ENABLED,
    delay: float = 0.3,
    scan_full_page: bool = False,
) -> CrawlerRunConfig:
    return CrawlerRunConfig(
        wait_until=wait_until,
        page_timeout=page_timeout,
        excluded_tags=excluded_tags or ["nav", "footer"],
        cache_mode=cache_mode,
        delay_before_return_html=delay,
        scan_full_page=scan_full_page,
        remove_overlay_elements=True,
        verbose=False,
    )


PAISABAZAAR_HUB = "https://www.paisabazaar.com/credit-cards/"

PAISABAZAAR_CATEGORY_GUIDES = [
    "https://www.paisabazaar.com/credit-card/25-best-credit-cards-india/",
    "https://www.paisabazaar.com/credit-card/best-cashback-credit-cards-india/",
    "https://www.paisabazaar.com/credit-card/5-best-rewards-credit-cards/",
    "https://www.paisabazaar.com/credit-card/7-best-premium-credit-cards-in-india/",
    "https://www.paisabazaar.com/credit-card/top-10-credit-cards-airport-lounge-access/",
    "https://www.paisabazaar.com/credit-card/travel-credit-cards/",
    "https://www.paisabazaar.com/credit-card/zero-forex-markup-credit-cards/",
    "https://www.paisabazaar.com/credit-card/best-international-credit-card-in-india/",
    "https://www.paisabazaar.com/credit-card/best-fuel-credit-cards/",
    "https://www.paisabazaar.com/credit-card/best-lifetime-free-credit-cards-in-india/",
    "https://www.paisabazaar.com/credit-card/best-lifetime-free-rupay-credit-cards/",
    "https://www.paisabazaar.com/credit-card/best-entry-level-credit-cards-india/",
    "https://www.paisabazaar.com/credit-card/best-secured-credit-cards-india/",
    "https://www.paisabazaar.com/credit-card/best-co-branded-credit-cards-in-india/",
    "https://www.paisabazaar.com/credit-card/best-credit-cards-online-shopping/",
    "https://www.paisabazaar.com/credit-card/top-7-shopping-credit-cards-india/",
    "https://www.paisabazaar.com/credit-card/entertainment-credit-card/",
    "https://www.paisabazaar.com/credit-card/best-business-credit-card-in-india/",
    "https://www.paisabazaar.com/credit-card/latest-axis-bank-credit-card-updates-2026/",
    "https://www.paisabazaar.com/credit-card/idfc-first-credit-card-zero-forex-markup-update/",
]

PAISABAZAAR_BANK_HUBS = [
    "https://www.paisabazaar.com/hdfc-bank/credit-card/",
    "https://www.paisabazaar.com/sbi-bank/credit-card/",
    "https://www.paisabazaar.com/icici-bank/credit-card/",
    "https://www.paisabazaar.com/axis-bank/credit-card/",
    "https://www.paisabazaar.com/kotak-mahindra-bank/credit-card/",
    "https://www.paisabazaar.com/idfc-first-bank/credit-card/",
    "https://www.paisabazaar.com/indusind-bank/credit-card/",
    "https://www.paisabazaar.com/amex-bank/credit-card/",
    "https://www.paisabazaar.com/au-small-finance-bank/credit-card/",
    "https://www.paisabazaar.com/hsbc-bank/credit-card/",
    "https://www.paisabazaar.com/rbl-bank/credit-card/",
    "https://www.paisabazaar.com/yes-bank/credit-card/",
    "https://www.paisabazaar.com/standard-chartered-bank/credit-card/",
    "https://www.paisabazaar.com/bank-of-baroda/credit-card/",
    "https://www.paisabazaar.com/bobcard/credit-card/",
    "https://www.paisabazaar.com/federal-bank/credit-card/",
    "https://www.paisabazaar.com/bandhan-bank/credit-card/",
    "https://www.paisabazaar.com/dbs-bank/credit-card/",
    "https://www.paisabazaar.com/punjab-national-bank/credit-card/",
    "https://www.paisabazaar.com/union-bank-of-india/credit-card/",
    "https://www.paisabazaar.com/canara-bank/credit-card/",
    "https://www.paisabazaar.com/sbm-bank/credit-card/",
    "https://www.paisabazaar.com/south-indian-bank/credit-card/",
    "https://www.paisabazaar.com/csb-bank/credit-card/",
    "https://www.paisabazaar.com/axis-bank/credit-card-lounge-access/",
    "https://www.paisabazaar.com/hdfc-bank/credit-card-lounge-access/",
    "https://www.paisabazaar.com/sbi-bank/credit-card-lounge-access/",
    "https://www.paisabazaar.com/icici-bank/credit-card-lounge-access/",
]

OFFICIAL_BANK_PORTALS = {
    "hdfc": "https://www.hdfcbank.com/personal/pay/cards/credit-cards",
    "sbi": "https://www.sbicard.com/en/personal/credit-cards.page",
    "icici": "https://www.icicibank.com/personal-banking/cards/credit-card",
    "axis": "https://www.axisbank.com/retail/cards/credit-card",
    "kotak": "https://www.kotak.com/en/personal-banking/cards/credit-cards.html",
    "idfc": "https://www.idfcfirstbank.com/credit-card",
    "indusind": "https://www.indusind.com/in/en/personal/cards/credit-card.html",
    "au": "https://www.aubank.in/personal-banking/credit-cards",
    "hsbc": "https://www.hsbc.co.in/credit-cards/",
    "rbl": "https://www.rblbank.com/personal-banking/cards/credit-cards",
    "yes": "https://www.yes.bank.in/personal-banking/yes-individual/cards/credit-cards",
    "sc": "https://www.sc.com/in/credit-cards/",
    "bobcard": "https://www.bobcard.co.in/",
    "amex": "https://www.americanexpress.com/en-in/credit-cards/",
    "pnb": "https://www.pnbcard.in/",
    "canara": "https://canarabank.com/pages/credit-card",
    "union": "https://www.unionbankofindia.co.in/english/credit-card.aspx",
}

FINTECH_CARD_PORTALS = {
    "onecard": "https://www.getonecard.app/",
    "scapia": "https://www.scapia.cards/",
    "kiwi": "https://www.gokiwi.in/",
}

REDDIT_SEED_URLS = [
    "https://www.reddit.com/r/CreditCardsIndia/top/?t=year",
    "https://www.reddit.com/r/CreditCardsIndia/top/?t=all",
    "https://www.reddit.com/r/CreditCardsIndia/hot/",
    "https://www.reddit.com/r/CreditCardsIndia/comments/1l5eqda/master_index_your_goto_resource/",
    "https://www.reddit.com/r/CreditCardsIndia/comments/1j9bd4e/hdfc_credit_cards_a_complete_guide_please_read/",
    "https://www.reddit.com/r/CreditCardsIndia/search/?q=devaluation&restrict_sr=1&sort=top&t=all",
    "https://www.reddit.com/r/CreditCardsIndia/search/?q=lounge+access+list&restrict_sr=1&sort=top&t=year",
    "https://www.reddit.com/r/CreditCardsIndia/search/?q=best+cashback+card&restrict_sr=1&sort=top&t=year",
    "https://www.reddit.com/r/CreditCardsIndia/search/?q=best+travel+card&restrict_sr=1&sort=top&t=year",
    "https://www.reddit.com/r/CreditCardsIndia/search/?q=rupay+upi+card&restrict_sr=1&sort=top&t=year",
    "https://www.reddit.com/r/CreditCardsIndia/search/?q=lifetime+free+LTF&restrict_sr=1&sort=top&t=year",
    "https://www.reddit.com/r/CreditCardsIndia/search/?q=tier+list+ranking&restrict_sr=1&sort=top&t=all",
    "https://www.reddit.com/r/CreditCardsIndia/search/?q=zero+forex&restrict_sr=1&sort=top&t=year",
    "https://www.reddit.com/r/CreditCardsIndia/search/?q=fuel+credit+card&restrict_sr=1&sort=top&t=year",
    "https://www.reddit.com/r/CreditCardsIndia/search/?q=idfc+credit+card&restrict_sr=1&sort=top&t=year",
    "https://www.reddit.com/r/CreditCardsIndia/search/?q=au+ixigo+zenith+lit&restrict_sr=1&sort=top&t=year",
    "https://www.reddit.com/r/CreditCardsIndia/search/?q=indusind+tiger+eazydiner+pinnacle&restrict_sr=1&sort=top&t=year",
    "https://www.reddit.com/r/CreditCardsIndia/search/?q=yes+bank+marquee+kiwi+reserv&restrict_sr=1&sort=top&t=year",
    "https://www.reddit.com/r/CreditCardsIndia/search/?q=bobcard+eterna+tiara&restrict_sr=1&sort=top&t=year",
    "https://www.reddit.com/r/CreditCardsIndia/search/?q=kotak+zen+mojo+myntra+811&restrict_sr=1&sort=top&t=year",
    "https://www.reddit.com/r/CreditCardsIndia/search/?q=rbl+world+safari+shoprite+icon&restrict_sr=1&sort=top&t=year",
    "https://www.reddit.com/r/CreditCardsIndia/search/?q=federal+scapia+celesta&restrict_sr=1&sort=top&t=year",
    "https://www.reddit.com/r/CreditCardsIndia/search/?q=onecard+supercard+roarbank&restrict_sr=1&sort=top&t=year",
    "https://www.reddit.com/r/CreditCardsIndia/search/?q=icici+sapphiro+emeralde+coral&restrict_sr=1&sort=top&t=year",
    "https://www.reddit.com/r/CreditCardsIndia/search/?q=hdfc+diners+millennia+regalia&restrict_sr=1&sort=top&t=year",
    "https://www.reddit.com/r/CreditCardsIndia/search/?q=hsbc+live+travelone+premier&restrict_sr=1&sort=top&t=year",
    "https://www.reddit.com/r/CreditCardsIndia/search/?q=standard+chartered+smart+ultimate&restrict_sr=1&sort=top&t=year",
    "https://www.reddit.com/r/CreditCardsIndia/search/?q=amex+mrcc+platinum+travel&restrict_sr=1&sort=top&t=year",
]

AGGREGATOR_URLS = {
    "cardinsider": [
        "https://cardinsider.com/",
        "https://cardinsider.com/best-credit-cards-in-india/",
        "https://cardinsider.com/best-cashback-credit-cards-india/",
        "https://cardinsider.com/best-travel-credit-cards-india/",
        "https://cardinsider.com/best-lifetime-free-credit-cards-india/",
        "https://cardinsider.com/best-forex-cards-india/",
        "https://cardinsider.com/best-fuel-credit-cards-india/",
        "https://cardinsider.com/best-rewards-credit-cards-india/",
        "https://cardinsider.com/blog/airport-lounge-access-credit-cards-in-india/",
        "https://cardinsider.com/blog/railway-lounge-access-credit-cards-in-india/",
    ],
    "cardexpert": [
        "https://www.cardexpert.in/",
        "https://www.cardexpert.in/best-credit-cards-india-2026/",
        "https://www.cardexpert.in/category/airport-lounges/",
        "https://www.cardexpert.in/category/best-credit-cards/",
        "https://www.cardexpert.in/category/credit-card-devaluation/",
    ],
    "bankbazaar": [
        "https://www.bankbazaar.com/credit-card.html",
        "https://www.bankbazaar.com/credit-card/best-credit-cards-in-india.html",
        "https://www.bankbazaar.com/credit-card/lifetime-free-credit-cards.html",
        "https://www.bankbazaar.com/credit-card/airport-lounge-access-credit-cards.html",
        "https://www.bankbazaar.com/credit-card/cashback-credit-cards.html",
        "https://www.bankbazaar.com/credit-card/fuel-credit-cards.html",
        "https://www.bankbazaar.com/credit-card/travel-credit-cards.html",
    ],
}
