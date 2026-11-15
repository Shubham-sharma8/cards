"""
Generates human-readable Markdown comparison tables, 11 category datasets (JSON + MD),
Airport & Railway Lounge Guide, Devaluation Tracker, Indian User Needs Research Report,
and Workspace README.md from the uniform master dataset.
"""

from __future__ import annotations

import json
import os
from collections import defaultdict
from datetime import datetime
from typing import Any

from reconcile_2026 import CATEGORY_DEFINITIONS

ROOT_DIR = "/Users/shubhamsharma/Downloads/Credit Card"
MASTER_DIR = f"{ROOT_DIR}/data/master"
CAT_DIR = f"{MASTER_DIR}/categories"

FLAGSHIP_PRIORITY_NAMES = [
    "HDFC Infinia Metal Edition Credit Card",
    "ICICI Bank Emeralde Private Metal Credit Card",
    "Axis Bank Magnus Credit Card for Burgundy",
    "HDFC Diners Club Black Metal Edition",
    "HSBC Premier Credit Card",
    "American Express Platinum Charge Card",
    "HDFC BizBlack Metal Edition Credit Card",
    "HSBC TravelOne Credit Card",
    "Axis Bank Atlas Credit Card",
    "Cashback SBI Card",
    "Amazon Pay ICICI Bank Credit Card",
    "HSBC Live+ Credit Card",
    "Swiggy BLCK HDFC Bank Credit Card",
    "Airtel Axis Bank Credit Card",
    "PhonePe SBI Card SELECT BLACK",
    "Tata Neu Infinity HDFC Bank Credit Card",
    "IndusInd Bank Tiger Credit Card",
    "Federal Bank Scapia Credit Card",
    "ixigo AU Credit Card",
    "IDFC FIRST Wealth Credit Card",
    "IDFC FIRST WOW! Credit Card",
    "HDFC Regalia Gold Credit Card",
    "HDFC Millennia Credit Card",
    "Marriott Bonvoy HDFC Bank Credit Card",
    "BPCL SBI Card Octane",
    "BOBCARD Eterna Credit Card",
    "BOBCARD Etihad Guest Premium Credit Card",
    "YES BANK Marquee Credit Card",
    "YES BANK Klick (Kiwi) RuPay Credit Card",
    "Axis Bank super.money RuPay Credit Card",
    "American Express Platinum Travel Credit Card",
    "ICICI Bank Sapphiro Credit Card",
    "Standard Chartered Ultimate Credit Card",
    "DBS Vantage Credit Card",
    "Axis Bank Olympus Credit Card",
    "IndusInd Bank Avios Credit Card",
]


def md_cell(val: Any, max_len: int = 80) -> str:
    if val is None:
        return "N/A"
    s = str(val).replace("|", "/").replace("\n", " ").replace("\r", " ")
    s = " ".join(s.split())
    if len(s) > max_len:
        s = s[: max_len - 1].rstrip() + "…"
    return s or "N/A"


def fmt_fee(val: int | None, is_ltf: bool = False) -> str:
    if is_ltf or val == 0:
        return "Rs. 0 (LTF)"
    if val is None:
        return "Check T&C"
    return f"Rs. {val:,}"


def fmt_waiver(val: int | None) -> str:
    if val is None or val == 0:
        return "None / N/A"
    if val >= 100000:
        lakh = val / 100000
        return f"Rs. {lakh:g}L/yr"
    return f"Rs. {val:,}/yr"


def fmt_lounge(visits: int | None, criteria: str | None) -> str:
    if not visits:
        return "Nil"
    v_str = "Unlimited" if visits >= 999 else f"{visits}/yr"
    crit = (criteria or "").lower()
    if any(w in crit for w in ["no spend", "zero spend", "none", "not applicable"]):
        return f"{v_str} (Spend-Free)"
    if "rs." in crit or "₹" in crit or "spend" in crit:
        short_c = md_cell(criteria, 36)
        return f"{v_str} [{short_c}]"
    return v_str


def fmt_forex(fx: float | None) -> str:
    if fx is None:
        return "3.5% (std)"
    return f"{fx:g}%"


def fmt_rate(c: dict[str, Any]) -> str:
    b = c["rewards"]["base_reward_rate_pct"]
    a = c["rewards"]["accelerated_reward_rate_pct"]
    b_s = f"{b:g}%" if b is not None else "—"
    a_s = f"{a:g}%" if a is not None else "—"
    if b_s == "—" and a_s == "—":
        return md_cell(c["rewards"]["reward_type"], 28)
    if b_s == a_s:
        return b_s
    return f"{b_s} – {a_s}"


def card_matches_category(c: dict[str, Any], cat_slug: str, cat_name: str) -> bool:
    cats = set(c.get("categories") or [])
    if cat_name in cats:
        return True
    if cat_slug == "cashback-online-shopping":
        return "Cashback" in cats or "Online Shopping" in cats
    if cat_slug == "travel-miles":
        return "Travel & Miles" in cats
    if cat_slug == "airport-lounge-access":
        dom = c["lounge_access"]["domestic"]["visits_per_year"] or 0
        intl = c["lounge_access"]["international"]["visits_per_year"] or 0
        rail = c["lounge_access"]["railway"]["visits_per_year"] or 0
        return "Airport Lounge" in cats or dom > 0 or intl > 0 or rail > 0
    if cat_slug == "lifetime-free":
        return "Lifetime Free" in cats or bool(c.get("is_ltf_available"))
    if cat_slug == "rupay-upi":
        return "RuPay & UPI" in cats or bool(c.get("is_rupay_upi_enabled"))
    if cat_slug == "fuel":
        return "Fuel" in cats
    if cat_slug == "dining-groceries-movies":
        return "Dining, Groceries & Movies" in cats
    if cat_slug == "zero-low-forex":
        fx = c["fees"]["forex_markup_pct"]
        return "Zero/Low Forex" in cats or (fx is not None and fx <= 2.0)
    if cat_slug == "super-premium-hni":
        return "Super-Premium" in cats or c.get("card_tier") == "Super-Premium"
    if cat_slug == "entry-level-secured-fd":
        return (
            "Entry-Level & Secured (FD)" in cats
            or bool(c.get("is_secured_fd_backed"))
            or c.get("card_tier") in ("Entry-Level", "Entry-Level / Secured")
        )
    if cat_slug == "business-tax":
        return "Business & Tax" in cats
    return False


def category_sort_key(c: dict[str, Any], cat_slug: str) -> tuple:
    is_active = 0 if c["status"] == "Active" else 1
    comp = -(c["ratings"]["composite_score"] or 0)
    reddit = -(c["ratings"]["reddit_mentions"] or 0)
    flag_bonus = 0 if c["card_name"] in FLAGSHIP_PRIORITY_NAMES else 1
    pcat = c.get("primary_category") or ""

    if cat_slug == "zero-low-forex":
        fx = c["fees"]["forex_markup_pct"]
        fx_rank = fx if fx is not None else 9.9
        return (is_active, round(fx_rank, 2), flag_bonus, comp, reddit)
    if cat_slug == "airport-lounge-access":
        dom = c["lounge_access"]["domestic"]["visits_per_year"] or 0
        crit = (c["lounge_access"]["domestic"]["spend_criteria"] or "").lower()
        spend_free = 0 if ("no spend" in crit or "zero spend" in crit) and dom > 0 else 1
        return (is_active, spend_free, flag_bonus, -(min(dom, 99)), comp)
    if cat_slug == "lifetime-free":
        ltf = 0 if c["is_ltf_available"] else 1
        return (is_active, ltf, flag_bonus, comp, reddit)
    if cat_slug == "rupay-upi":
        prim = 0 if pcat == "RuPay & UPI" else 1
        return (is_active, prim, flag_bonus, comp, reddit)
    if cat_slug == "super-premium-hni":
        prim = 0 if pcat == "Super-Premium" else 1
        return (is_active, prim, flag_bonus, comp, reddit)
    if cat_slug == "fuel":
        prim = 0 if pcat == "Fuel" else 1
        return (is_active, prim, flag_bonus, comp, reddit)
    if cat_slug == "travel-miles":
        prim = 0 if pcat == "Travel & Miles" else 1
        return (is_active, prim, flag_bonus, comp, reddit)
    if cat_slug == "cashback-online-shopping":
        prim = 0 if pcat in ("Cashback", "Online Shopping") else 1
        return (is_active, prim, flag_bonus, comp, reddit)
    if cat_slug == "dining-groceries-movies":
        prim = 0 if pcat == "Dining, Groceries & Movies" or any(w in c["card_name"].lower() for w in ["live+", "swiggy", "eazydiner", "airtel", "sapphiro"]) else 1
        return (is_active, prim, flag_bonus, comp, reddit)
    if cat_slug == "business-tax":
        prim = 0 if pcat == "Business & Tax" else 1
        return (is_active, prim, flag_bonus, comp, reddit)
    if cat_slug == "entry-level-secured-fd":
        fd_b = 0 if c.get("is_secured_fd_backed") else 1
        return (is_active, flag_bonus, fd_b, comp, reddit)
    return (is_active, flag_bonus, comp, reddit, c["card_name"])


# ---------------------------------------------------------------------------
# 1. Master Comparison Tables (credit_cards_table.md)
# ---------------------------------------------------------------------------
def write_master_table(cards: list[dict[str, Any]]) -> None:
    by_name = {c["card_name"]: c for c in cards}
    flagships = [by_name[n] for n in FLAGSHIP_PRIORITY_NAMES if n in by_name]
    # Add any remaining top-scored active cards not in list up to 45
    seen = {c["card_id"] for c in flagships}
    for c in cards:
        if len(flagships) >= 45:
            break
        if c["card_id"] not in seen and c["status"] == "Active":
            flagships.append(c)
            seen.add(c["card_id"])

    lines: list[str] = []
    lines.append("# India Credit Cards Master Comparison Table (2026 Edition)\n")
    lines.append(
        f"> **Coverage:** **{len(cards)}** unique credit cards across **{len(set(c['bank'] for c in cards))}** Indian banks/issuers | "
        f"Synthesized from Paisabazaar (`558` raw pages cleaned), Official Bank Websites & PDFs (`133` pages + `42` PDFs), "
        f"`r/CreditCardsIndia` Reddit corpus, and Indian Aggregators.\n"
    )

    lines.append("## 1. Top 45 Flagship & Most-Recommended Cards in India (2026 Matrix)\n")
    lines.append(
        "| # | Card Name | Bank | Primary Category | Joining / Annual Fee | Waiver Spend | Reward Rate | Forex | Domestic Lounge | Int'l Lounge | Composite / Reddit | Deval Risk | Best For Whom |"
    )
    lines.append(
        "|---:|---|---|---|---|---|---|---|---|---|---|---|---|"
    )
    for idx, c in enumerate(flagships, 1):
        fees = c["fees"]
        jf_str = fmt_fee(fees["joining_fee_inr"], c["is_ltf_available"])
        af_str = fmt_fee(fees["annual_fee_inr"], c["is_ltf_available"])
        fee_col = jf_str if jf_str == af_str else f"{jf_str} / {af_str}"
        comp = c["ratings"]["composite_score"]
        mkt = c["ratings"]["market_community_rating"]
        rat_col = f"**{comp:.2f}**" if comp else "—"
        if mkt:
            rat_col += f" (Mkt {mkt:.1f})"
        deval_col = f"{c['devaluation']['devaluation_frequency']} ({c['devaluation']['devaluation_risk_score']}/10)"
        lines.append(
            f"| {idx} | **{md_cell(c['card_name'], 38)}** | {md_cell(c['bank'], 20)} | {md_cell(c['primary_category'], 22)} | "
            f"{fee_col} | {fmt_waiver(fees['fee_waiver_spend_inr'])} | {fmt_rate(c)} | {fmt_forex(fees['forex_markup_pct'])} | "
            f"{fmt_lounge(c['lounge_access']['domestic']['visits_per_year'], c['lounge_access']['domestic']['spend_criteria'])} | "
            f"{fmt_lounge(c['lounge_access']['international']['visits_per_year'], c['lounge_access']['international']['spend_criteria'])} | "
            f"{rat_col} | {deval_col} | {md_cell(c['best_for_whom']['ideal_for'], 58)} |"
        )

    lines.append("\n---\n")
    lines.append("## 2. Complete Issuer-by-Issuer Catalog Tables (All Cards)\n")
    by_bank: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for c in cards:
        by_bank[c["bank"]].append(c)

    for bank in sorted(by_bank.keys()):
        b_cards = sorted(by_bank[bank], key=lambda x: (0 if x["status"] == "Active" else 1, -(x["ratings"]["composite_score"] or 0), x["card_name"]))
        lines.append(f"\n### {bank} ({len(b_cards)} cards)\n")
        lines.append(
            "| Card Name | Category | Tier | Fee (Join/Annual) | Waiver | Reward Rate | Forex | Dom Lounge | Railway Lounge | Score | Deval Risk | Ideal For |"
        )
        lines.append(
            "|---|---|---|---|---|---|---|---|---|---:|---|---|"
        )
        for c in b_cards:
            fees = c["fees"]
            jf_str = fmt_fee(fees["joining_fee_inr"], c["is_ltf_available"])
            af_str = fmt_fee(fees["annual_fee_inr"], c["is_ltf_available"])
            fee_col = jf_str if jf_str == af_str else f"{jf_str} / {af_str}"
            rail_v = c["lounge_access"]["railway"]["visits_per_year"] or 0
            rail_col = f"{rail_v}/yr" if rail_v else "Nil"
            status_tag = "" if c["status"] == "Active" else f" `[{md_cell(c['status'], 18)}]`"
            lines.append(
                f"| {md_cell(c['card_name'], 38)}{status_tag} | {md_cell(c['primary_category'], 20)} | {md_cell(c['card_tier'], 14)} | "
                f"{fee_col} | {fmt_waiver(fees['fee_waiver_spend_inr'])} | {fmt_rate(c)} | {fmt_forex(fees['forex_markup_pct'])} | "
                f"{fmt_lounge(c['lounge_access']['domestic']['visits_per_year'], c['lounge_access']['domestic']['spend_criteria'])} | "
                f"{rail_col} | {c['ratings']['composite_score'] or '—'} | {c['devaluation']['devaluation_frequency']} | "
                f"{md_cell(c['best_for_whom']['ideal_for'], 52)} |"
            )

    out_path = f"{MASTER_DIR}/credit_cards_table.md"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


# ---------------------------------------------------------------------------
# 2. Category Splits (11 JSON + MD + Summary)
# ---------------------------------------------------------------------------
def write_categories(cards: list[dict[str, Any]]) -> None:
    summary_lines: list[str] = []
    summary_lines.append("# Credit Card Categories Guide — Which Card Is Best for Whom (2026)\n")
    summary_lines.append(
        "> All cards segmented into **11 consumer-intent categories** aligned with how Indians actually choose cards "
        "(Cashback/Online, Air Miles, Lounges, LTF, RuPay UPI, Fuel, Dining/Grocery/Movies, Zero/Low Forex, Super-Premium, Entry/FD Secured, Business/Tax).\n"
    )
    summary_lines.append("| Category | Total Cards | Active Top 3 Flagship Picks | Best For Whom | Avoid If | Full Guide |")
    summary_lines.append("|---|---:|---|---|---|---|")

    for cat in CATEGORY_DEFINITIONS:
        slug = cat["slug"]
        cname = cat["name"]
        matched = [c for c in cards if card_matches_category(c, slug, cname)]
        matched.sort(key=lambda c: category_sort_key(c, slug))

        # Write category JSON
        cat_json_path = f"{CAT_DIR}/{slug}.json"
        with open(cat_json_path, "w", encoding="utf-8") as fj:
            json.dump(
                {
                    "category_slug": slug,
                    "category_name": cname,
                    "best_for": cat["best_for"],
                    "avoid_if": cat["avoid_if"],
                    "total_cards": len(matched),
                    "cards": matched,
                },
                fj,
                indent=2,
                ensure_ascii=False,
            )

        # Write category Markdown
        ml: list[str] = []
        ml.append(f"# {cname} Credit Cards in India (2026)\n")
        ml.append(f"- **Total Matching Cards:** {len(matched)}")
        ml.append(f"- **Best For Whom:** {cat['best_for']}")
        ml.append(f"- **Avoid This Category If:** {cat['avoid_if']}\n")

        ml.append("## Top 5 Recommended Cards in This Category\n")
        top5 = [c for c in matched if c["status"] == "Active"][:5] or matched[:5]
        for i, tc in enumerate(top5, 1):
            fees = tc["fees"]
            ml.append(f"### {i}. {tc['card_name']} ({tc['bank']})")
            ml.append(
                f"- **Composite Score:** {tc['ratings']['composite_score']}/5 | "
                f"**Annual Fee:** {fmt_fee(fees['annual_fee_inr'], tc['is_ltf_available'])} (Waiver: {fmt_waiver(fees['fee_waiver_spend_inr'])}) | "
                f"**Forex:** {fmt_forex(fees['forex_markup_pct'])} | "
                f"**Domestic Lounge:** {tc['lounge_access']['domestic']['summary']}"
            )
            ml.append(f"- **Rewards:** {tc['rewards']['reward_type']} ({fmt_rate(tc)})")
            if tc["pros"]:
                ml.append(f"- **Pros:** {'; '.join(tc['pros'][:3])}")
            if tc["cons"]:
                ml.append(f"- **Cons:** {'; '.join(tc['cons'][:3])}")
            ml.append(f"- **Ideal For:** {tc['best_for_whom']['ideal_for']}")
            ml.append(f"- **Verdict:** {tc['best_for_whom']['verdict']}\n")

        ml.append(f"## Full {cname} Comparison Table ({len(matched)} Cards)\n")
        ml.append("| # | Card Name | Bank | Join/Annual Fee | Waiver | Reward Rate | Forex | Domestic Lounge | Score | Deval Risk | Verdict |")
        ml.append("|---:|---|---|---|---|---|---|---|---:|---|---|")
        for idx, c in enumerate(matched, 1):
            fees = c["fees"]
            jf_str = fmt_fee(fees["joining_fee_inr"], c["is_ltf_available"])
            af_str = fmt_fee(fees["annual_fee_inr"], c["is_ltf_available"])
            fee_col = jf_str if jf_str == af_str else f"{jf_str} / {af_str}"
            ml.append(
                f"| {idx} | **{md_cell(c['card_name'], 36)}** | {md_cell(c['bank'], 18)} | {fee_col} | "
                f"{fmt_waiver(fees['fee_waiver_spend_inr'])} | {fmt_rate(c)} | {fmt_forex(fees['forex_markup_pct'])} | "
                f"{fmt_lounge(c['lounge_access']['domestic']['visits_per_year'], c['lounge_access']['domestic']['spend_criteria'])} | "
                f"{c['ratings']['composite_score'] or '—'} | {c['devaluation']['devaluation_frequency']} | "
                f"{md_cell(c['best_for_whom']['verdict'], 55)} |"
            )

        with open(f"{CAT_DIR}/{slug}.md", "w", encoding="utf-8") as fm:
            fm.write("\n".join(ml) + "\n")

        top3_str = ", ".join(f"**{md_cell(c['card_name'], 30)}**" for c in top5[:3])
        summary_lines.append(
            f"| **{cname}** | {len(matched)} | {top3_str} | {md_cell(cat['best_for'], 75)} | {md_cell(cat['avoid_if'], 60)} | [`{slug}.md`](categories/{slug}.md) |"
        )

    with open(f"{MASTER_DIR}/categories_summary.md", "w", encoding="utf-8") as fs:
        fs.write("\n".join(summary_lines) + "\n")


# ---------------------------------------------------------------------------
# 3. Airport & Railway Lounge Guide (lounge_access_guide.md)
# ---------------------------------------------------------------------------
def write_lounge_guide(cards: list[dict[str, Any]], lounge_dir: dict[str, Any]) -> None:
    dom_cards = [c for c in cards if (c["lounge_access"]["domestic"]["visits_per_year"] or 0) > 0 and c["status"] == "Active"]
    spend_free = []
    spend_gated = []
    for c in dom_cards:
        crit = (c["lounge_access"]["domestic"]["spend_criteria"] or "").lower()
        if any(w in crit for w in ["no spend", "zero spend"]):
            spend_free.append(c)
        elif "rs." in crit or "₹" in crit or "spend" in crit:
            spend_gated.append(c)
        else:
            spend_free.append(c)

    spend_free.sort(key=lambda c: (0 if c["card_name"] in FLAGSHIP_PRIORITY_NAMES else 1, -(c["lounge_access"]["domestic"]["visits_per_year"] or 0), -(c["ratings"]["composite_score"] or 0)))
    spend_gated.sort(key=lambda c: (0 if c["card_name"] in FLAGSHIP_PRIORITY_NAMES else 1, -(c["ratings"]["composite_score"] or 0)))

    intl_cards = [c for c in cards if (c["lounge_access"]["international"]["visits_per_year"] or 0) > 0 and c["status"] == "Active"]
    intl_cards.sort(key=lambda c: (0 if c["card_name"] in FLAGSHIP_PRIORITY_NAMES else 1, -(c["lounge_access"]["international"]["visits_per_year"] or 0), -(c["ratings"]["composite_score"] or 0)))

    rail_cards = [c for c in cards if (c["lounge_access"]["railway"]["visits_per_year"] or 0) > 0 and c["status"] == "Active"]
    rail_cards.sort(key=lambda c: (0 if c["card_name"] in FLAGSHIP_PRIORITY_NAMES else 1, -(c["lounge_access"]["railway"]["visits_per_year"] or 0), -(c["ratings"]["composite_score"] or 0)))

    nr = lounge_dir["network_rules"]
    rail_terms = nr["irctc_railway_lounge_terms"]
    lounges = lounge_dir["participating_indian_airport_lounges"]

    lines: list[str] = []
    lines.append("# Complete Airport & Railway Lounge Access Guide — India (2026)\n")
    lines.append(
        "> Grounded directly in Official Bank Lounge PDFs (`HDFC Sep 2025 Airport & May 29 2026 IRCTC PDFs`, "
        "`SBI Participating Airport Lounges PDF`, `IndusInd Lounge Program PDF`, `Axis Mastercard Lounge T&C PDF`, `IDFC Select PDF`) "
        "plus 2026 community devaluation tracking.\n"
    )

    lines.append("## 1. Critical 2026 Rules, Swipes, Validation Charges & Traps\n")
    lines.append(f"- **Visa Validation Hold:** {nr['visa_validation_charge']}")
    lines.append(f"- **Mastercard Validation Hold:** {nr['mastercard_validation_charge']}")
    lines.append(f"- **RuPay Validation Charge:** {nr['rupay_validation_charge']}")
    lines.append(f"- **Priority Pass Guest Fee:** {nr['priority_pass_guest_fee']}")
    lines.append(f"- **WARNING — Domestic Priority Pass Trap:** {nr['priority_pass_domestic_warning']}")
    lines.append(
        "- **Spend-Gating Reality (2024–2026):** Most mid-tier banks (ICICI Core/Sapphiro `Rs. 75k/qtr`, HDFC Regalia Gold `Rs. 60k/qtr`, "
        "Tata Neu `Rs. 50k/qtr`, YES Marquee/Reserve `Rs. 1L/qtr`, Scapia `Rs. 20k/cycle`) now gate domestic lounges. **Check your previous quarter statement before travelling!**\n"
    )

    lines.append("## 2. Spend-Free Domestic Airport Lounge Kings (Zero Spend Criteria Verified / No Gate Detected)\n")
    lines.append("| Card Name | Bank | Annual Fee | Domestic Visits | Add-on Allowed? | Shared Limit? | Int'l Lounge | Summary |")
    lines.append("|---|---|---|---:|---|---|---|---|")
    for c in spend_free[:35]:
        d = c["lounge_access"]["domestic"]
        i = c["lounge_access"]["international"]
        v_s = "Unlimited" if d["visits_per_year"] >= 999 else f"{d['visits_per_year']}/yr"
        iv_s = "Unlimited" if (i["visits_per_year"] or 0) >= 999 else (f"{i['visits_per_year']}/yr" if i["visits_per_year"] else "Nil")
        lines.append(
            f"| **{md_cell(c['card_name'], 36)}** | {md_cell(c['bank'], 18)} | {fmt_fee(c['fees']['annual_fee_inr'], c['is_ltf_available'])} | "
            f"{v_s} | {'Yes' if d['add_on_allowed'] else 'No'} | {'Yes' if d['shared_limit'] else 'No'} | {iv_s} | {md_cell(d['summary'], 65)} |"
        )

    lines.append("\n## 3. Spend-Gated Domestic Airport Lounge Cards (Must Meet Quarterly/Monthly Spend)\n")
    lines.append("| Card Name | Bank | Annual Fee | Visits/Yr | Exact Spend Requirement | Summary |")
    lines.append("|---|---|---|---:|---|---|")
    for c in spend_gated[:35]:
        d = c["lounge_access"]["domestic"]
        v_s = "Unlimited" if d["visits_per_year"] >= 999 else f"{d['visits_per_year']}/yr"
        lines.append(
            f"| **{md_cell(c['card_name'], 36)}** | {md_cell(c['bank'], 18)} | {fmt_fee(c['fees']['annual_fee_inr'], c['is_ltf_available'])} | "
            f"{v_s} | {md_cell(d['spend_criteria'], 55)} | {md_cell(d['summary'], 60)} |"
        )

    lines.append("\n## 4. Top International Airport Lounge Cards (Priority Pass / LoungeKey / Diners)\n")
    lines.append("| Card Name | Bank | Annual Fee | Network / Program | Int'l Visits/Yr | Add-on Allowed? | Guest Policy | Summary |")
    lines.append("|---|---|---|---|---:|---|---|---|")
    for c in intl_cards[:35]:
        i = c["lounge_access"]["international"]
        iv_s = "Unlimited" if i["visits_per_year"] >= 999 else f"{i['visits_per_year']}/yr"
        lines.append(
            f"| **{md_cell(c['card_name'], 36)}** | {md_cell(c['bank'], 18)} | {fmt_fee(c['fees']['annual_fee_inr'], c['is_ltf_available'])} | "
            f"{md_cell(i['program'], 22)} | {iv_s} | {'Yes' if i['add_on_allowed'] else 'No'} | {md_cell(i['guest_fee'], 28)} | {md_cell(i['summary'], 58)} |"
        )

    lines.append("\n## 5. IRCTC Executive Railway Lounge Access Cards\n")
    lines.append(f"- **Official Terms ({rail_terms['updated']}):** {rail_terms['quota']}; {rail_terms['validation_fee']}")
    lines.append(f"- **Inclusions:** {', '.join(rail_terms['inclusions'])}\n")
    lines.append("| Card Name | Bank | Annual Fee | Railway Visits/Yr | Summary |")
    lines.append("|---|---|---|---:|---|")
    for c in rail_cards[:25]:
        r = c["lounge_access"]["railway"]
        lines.append(
            f"| **{md_cell(c['card_name'], 36)}** | {md_cell(c['bank'], 18)} | {fmt_fee(c['fees']['annual_fee_inr'], c['is_ltf_available'])} | "
            f"{r['visits_per_year']}/yr | {md_cell(r['summary'], 75)} |"
        )

    lines.append(f"\n## 6. Participating Indian Airport Lounges Directory ({len(lounges)} Verified Locations from Official Bank PDFs)\n")
    lines.append("> **Note:** Exact terminal eligibility varies slightly by network (Visa / Mastercard / RuPay / Diners). Always check your bank's live DreamFolks/QR portal before boarding.\n")
    lines.append("| Sr | Airport City & Lounge Name | Lounge Code | Terminal Type | Terminal & Operating Details |")
    lines.append("|---:|---|---|---|---|")
    for row in lounges:
        lines.append(
            f"| {row['sr']} | {md_cell(row['airport_city_and_lounge'], 65)} | `{md_cell(row['lounge_code'], 14)}` | "
            f"{md_cell(row['terminal_type'], 24)} | {md_cell(row['terminal_and_hours'], 70)} |"
        )

    with open(f"{MASTER_DIR}/lounge_access_guide.md", "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


# ---------------------------------------------------------------------------
# 4. Devaluation Tracker (devaluation_tracker.md)
# ---------------------------------------------------------------------------
def write_devaluation_tracker(cards: list[dict[str, Any]], deval_payload: dict[str, Any]) -> None:
    profiles = deval_payload["issuer_devaluation_profiles"]
    events = deval_payload["timeline_2024_2026"]

    lines: list[str] = []
    lines.append("# Indian Credit Card Devaluation Tracker & Frequency Index (2024–Nov 2026)\n")
    lines.append(
        "> Indian issuers aggressively reshaped reward economics in 2024–2026 around **three pillars**: "
        "(1) **Spend-gating airport lounges**, (2) **Excluding rent, utilities, insurance, education, tax, wallets, and jewelry** from rewards & annual fee waivers, and "
        "(3) **Transfer-partner exits & proportional spend-unlocks**.\n"
    )

    lines.append("## 1. Issuer Devaluation Frequency Ranking (Highest to Lowest Risk)\n")
    lines.append("| Rank | Issuer | Devaluation Frequency | Risk Score (1–10) | Key Pattern & Structural Notes |")
    lines.append("|---:|---|---|---:|---|")
    sorted_issuers = sorted(profiles.items(), key=lambda kv: (-kv[1]["risk_score"], kv[0]))
    for idx, (bank, p) in enumerate(sorted_issuers, 1):
        lines.append(f"| {idx} | **{bank}** | **{p['frequency']}** | {p['risk_score']}/10 | {md_cell(p['note'], 110)} |")

    lines.append("\n## 2. Verified 2024 – November 2026 Devaluation Timeline\n")
    lines.append("| Date | Issuer | Cards Affected | Severity | What Changed | Source Grounding |")
    lines.append("|---|---|---|---|---|---|")
    for ev in events:
        lines.append(
            f"| **{ev['date']}** | {ev['issuer']} | {md_cell(', '.join(ev['cards_affected']), 45)} | {ev['severity']} | "
            f"{md_cell(ev['summary'], 105)} | {md_cell(ev['source_ref'], 45)} |"
        )

    lines.append("\n## 3. Cards with Documented 2026 Devaluations or High Devaluation Risk (>= 6.5/10)\n")
    flagged = [c for c in cards if c["devaluation"]["last_devalued_on"] or c["devaluation"]["devaluation_risk_score"] >= 6.5]
    flagged.sort(key=lambda c: (0 if c["devaluation"]["last_devalued_on"] else 1, -c["devaluation"]["devaluation_risk_score"], -(c["ratings"]["reddit_mentions"] or 0)))
    lines.append("| Card Name | Bank | Deval Frequency | Risk Score | Last Devalued | Recent Changes |")
    lines.append("|---|---|---|---:|---|---|")
    for c in flagged[:40]:
        d = c["devaluation"]
        hist = d["devaluation_history"][-1] if d["devaluation_history"] else "High-risk issuer portfolio"
        lines.append(
            f"| **{md_cell(c['card_name'], 44)}** | {md_cell(c['bank'], 18)} | {d['devaluation_frequency']} | "
            f"{d['devaluation_risk_score']}/10 | {md_cell(d['last_devalued_on'] or 'Monitoring', 20)} | {md_cell(hist, 95)} |"
        )

    with open(f"{MASTER_DIR}/devaluation_tracker.md", "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


# ---------------------------------------------------------------------------
# 5. Indian User Needs & Product Research (indian_user_needs_research.md)
# ---------------------------------------------------------------------------
def write_user_needs_research(cards: list[dict[str, Any]], reddit_stats: dict[str, Any]) -> None:
    total_docs = reddit_stats["total_docs"]
    themes = reddit_stats["pain_themes"]
    cstats = reddit_stats["card_stats"]

    lines: list[str] = []
    lines.append("# What Indian Credit Cardholders Actually Want — Market & Community Research (2026)\n")
    lines.append(
        f"> Synthesized from **{total_docs} real community threads & feeds** on `r/CreditCardsIndia`, "
        f"**{len(cards)} normalized cards**, official bank MITCs/KFS (`Oct/Nov 2026`), and Indian review portals (`CardExpert`, `CardInsider`, `Paisabazaar`, `BankBazaar`). "
        "Designed to guide **card selection algorithms, filters, and recommendation logic** for a future React Native app.\n"
    )

    lines.append("## 1. Top Community Pain Points (Grounded in `r/CreditCardsIndia` Corpus Frequency)\n")
    lines.append("| Pain Point / User Friction Theme | Docs Mentioning | % of Corpus | App Recommendation Implication |")
    lines.append("|---|---:|---:|---|")
    theme_impl = {
        "Lounge Spend Gating / Cuts": "Must surface EXACT quarterly/monthly spend requirement prominently; distinguish true spend-free lounges.",
        "Devaluations & Exclusion Creep": "Track 'last devalued' date & MCC exclusions (rent/utilities/insurance/wallet) per card; alert users.",
        "HDFC Core-vs-Cobranded / 18L Rule": "Warn HDFC applicants NOT to start with Swiggy/Tata Neu before getting Millennia/Regalia Gold; model ITR upgrades.",
        "Underwriting / Rejections / Overleverage": "Ask user's CIBIL range, salaried/self-employed status, existing card limits & pincode serviceability upfront.",
        "Forex Markup (3.5%+GST) / Zero-Forex Demand": "Compute real 4.13% hidden forex cost vs 0% forex cards (Scapia, IDFC Wealth/WOW, AU Ixigo).",
        "Customer Care & Redemption Fees": "Deduct Rs. 50–Rs. 99 + GST redemption fees from effective cashback yield in calculators.",
        "RuPay UPI Cashback & Minimum Txns": "Filter by min-txn rules (e.g., Rs. 50/Rs. 100 minimum) & monthly caps across Kiwi / SuperMoney / Neu.",
        "Rent / Tax / Education / Utility Penalties": "Warn about 1% bank surcharge on rent/edu/utilities; recommend BizBlack, SC Ultimate, or Amex Plat Travel where applicable.",
    }
    for k, cnt in sorted(themes.items(), key=lambda x: -x[1]):
        pct = (cnt / max(1, total_docs)) * 100
        lines.append(f"| **{k}** | {cnt} | {pct:.1f}% | {theme_impl.get(k, '')} |")

    lines.append("\n## 2. Most Discussed Cards & Sentiment Leaderboard (`r/CreditCardsIndia`)\n")
    lines.append("| Card Key | Total Paragraph Mentions | Positive Hits | Negative Hits | Deval Mentions | Community Rating (/5) |")
    lines.append("|---|---:|---:|---:|---:|---:|")
    sorted_cstats = sorted(cstats.items(), key=lambda kv: (-kv[1]["mentions"], -kv[1]["community_rating"]))
    for key, st in sorted_cstats[:30]:
        if st["mentions"] == 0:
            continue
        lines.append(
            f"| `{key}` | {st['mentions']} | {st['positive']} | {st['negative']} | {st['deval_mentions']} | **{st['community_rating']:.2f}** |"
        )

    lines.append("\n## 3. Seven Archetypal Indian Credit Card Personas & Optimal Portfolios\n")
    personas = [
        (
            "1. The Beginner / Student / New-to-Credit (NTC)",
            "CIBIL 0 / <700, zero credit history or freelance/student income.",
            "Instant FD approval without income docs, LTF fee structure, 0% forex for college/SaaS subscriptions, CIBIL building.",
            "IDFC FIRST WOW! (FD) -> Amazon Pay ICICI (LTF via bank relationship) -> HDFC Millennia (Core starter).",
        ),
        (
            "2. The Daily UPI & Practical Cashback Salaried Earner",
            "Monthly spend Rs. 15,000–Rs. 45,000 across groceries, UPI kirana payments, Amazon/Flipkart, bills.",
            "Hard rupee cashback (>3–5% online, >1.5–3% UPI), zero complex air-miles math, simple Rs. 1L–2L fee waiver.",
            "Cashback SBI Card (5% online) + Amazon Pay ICICI (LTF) + YES Klick Kiwi / Axis super.money (UPI LTF).",
        ),
        (
            "3. The Urban Foodie & Quick-Commerce Family",
            "Monthly spend Rs. 15,000–Rs. 50,000 heavily weighted toward Swiggy, Zomato, Instamart, Blinkit, BigBasket, BookMyShow.",
            "10% instant savings on dining & 10-minute delivery + BOGO movies without juggling 5 different vouchers.",
            "HSBC Live+ (10% offline + online dining/grocery) + Swiggy BLCK HDFC (10% Swiggy) + Tata Neu Infinity (BigBasket/1mg/UPI).",
        ),
        (
            "4. The Domestic Flyer & Middle-Class Weekend Traveler",
            "Flies 4–12 domestic sectors/year + takes 2–4 trains/yr; spends Rs. 20,000–Rs. 50,000/month.",
            "Guaranteed domestic airport lounges WITHOUT failing a surprise Rs. 75k/quarter spend test + IRCTC railway lounges.",
            "IndusInd Tiger (LTF, 8 dom + 2 PP spend-free!) + ixigo AU Credit Card (0% forex + 8 railway + 8 dom).",
        ),
        (
            "5. The International Traveler / Remote SaaS Buyer",
            "Travels abroad 1–4x/yr or pays USD/EUR software, study-abroad, or international e-commerce bills.",
            "Zero 3.5%+GST (4.13% effective!) forex leakage PLUS base rewards on overseas swipes & Priority Pass backup.",
            "IDFC FIRST Wealth (LTF, 0% forex + rewards) or Federal Scapia / AU Ixigo + IndusInd Tiger (2 free PP visits).",
        ),
        (
            "6. The Miles, Accor & Luxury Travel Optimizer",
            "Annual spend Rs. 6L–Rs. 18L across flights, hotels, retail; willing to optimize 1:1 / 1:2 airline/hotel transfers.",
            "Accor Live Limitless 1:1 (Rs. 1.8–2/pt value), Singapore KrisFlyer, Qatar Avios, unlimited lounges for family/guests.",
            "HSBC TravelOne (2026 #1 Accor 1:1 mid-tier) or Axis Atlas (airline direct) -> Upgrade to HDFC Infinia / ICICI EPM.",
        ),
        (
            "7. The HNI / Business Owner / Tax & Insurance Payer",
            "Annual spend Rs. 15L–Rs. 60L+ incl. Income Tax, Advance Tax, GST, insurance, jewelry, luxury travel.",
            "Positive ROI on excluded categories (tax/insurance/school), high monthly limits, concierge, golf, unlimited family PP.",
            "HDFC BizBlack (16.6% tax/GST!) + ICICI Emeralde Private Metal (3% insurance/edu) + Amex Platinum Travel (Rs. 4L dead-spend milestone) or Axis Magnus Burgundy (Rs. 2.5L+/mo).",
        ),
    ]
    for title, prof, wants, stack in personas:
        lines.append(f"### {title}")
        lines.append(f"- **Profile:** {prof}")
        lines.append(f"- **Primary Needs:** {wants}")
        lines.append(f"- **Optimal 2026 Stack:** {stack}\n")

    lines.append("## 4. Critical Indian Bank Underwriting Rules & Hidden Traps (Must Encode in App Logic)\n")
    lines.append("1. **HDFC Core-Before-Co-Branded Rule:** Taking Swiggy HDFC or Tata Neu FIRST often triggers rejections for core HDFC cards (Millennia / Regalia Gold / Infinia). *Rule: Always get an HDFC Core card first!*")
    lines.append("2. **HDFC Infinia / DCB Metal Credit Limit + Spend Gate:** Even high-salary applicants are rejected without Rs. 8L–10L existing HDFC CL AND Rs. 7.5L–9L spend over the prior 6 months (official Infinia Reserve / Metal invites tighten further to ~Rs. 18L–60L/yr benchmarks).")
    lines.append("3. **Axis Bank 3-Card Limit & Oct 2026 KFS Exclusions:** Axis caps users at 3 active personal cards. Gift card purchases no longer count toward annual fee waivers eff Aug 28, 2026. Rent/edu/wallet/utility exceed thresholds attract 1% fee.")
    lines.append("4. **SBI Card 'Over-Leveraged' Rejection:** SBI declines applicants holding excessive cumulative unsecured credit limits across other banks relative to reported ITR/salary.")
    lines.append("5. **IDFC FIRST `<Rs. 200` Rounding Trap:** Official IDFC T&C awards **0 reward points on transactions below Rs. 200** (points accrue strictly in Rs. 200 blocks), though Wealth/Select deliver true 0% forex with rewards.")
    lines.append("6. **HSBC & AU City Serviceability Gate:** HSBC limits applications to major Tier-1/select Tier-2 metros; AU Ixigo maintains strict pincode lists.")
    lines.append("7. **Add-on Priority Pass Domestic Swipe Fee:** Outside HDFC Infinia/EPM exceptions, swiping a Priority Pass inside India charges **USD 27 + GST (~Rs. 2,700+)** — users MUST swipe the main Visa/Mastercard/RuPay card domestically.\n")

    lines.append("## 5. Recommended Filter & Selection Spec for Future React Native App (Data Architecture Only)\n")
    lines.append("> Per instructions, **no React Native code is written**. Below is the exact recommendation-engine filter spec enabled by `credit_cards_master.json`:\n")
    lines.append("- **Hard Eligibility Pre-Filters:** `monthly_income_inr` -> `eligibility.min_monthly_income_salaried_inr`, `cibil_bucket` (`NTC` -> `is_secured_fd_backed`), `city_serviceable`, `existing_bank_relationships`.")
    lines.append("- **Spend-Slider Input (Monthly INR Split):** Online Shopping, Swiggy/Dining/Grocery, Fuel, Domestic Flights/Yr, Int'l Travel/Forex Spend, Utilities/Bills, UPI Scan-and-Pay, Insurance/Tax/Rent.")
    lines.append("- **Reward & Net-Yield Formula per Card:** `(Spend_Cat * Effective_Rate - Monthly_Cap_Clamp) + Milestone_Value + Lounge_Value - Annual_Fee*(1.18 if Spend < Waiver else 0) - Redemption_Fee`.")
    lines.append("- **Risk & Friction Badges:** `Spend-Free Lounge` vs `Quarterly Spend Gate`, `0% Forex`, `True LTF`, `Recent 2026 Devaluation Alert`, `Core Bank Card` flag.")

    with open(f"{MASTER_DIR}/indian_user_needs_research.md", "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


# ---------------------------------------------------------------------------
# 6. Workspace README.md
# ---------------------------------------------------------------------------
def write_readme(cards: list[dict[str, Any]], lounge_dir: dict[str, Any], reddit_stats: dict[str, Any]) -> None:
    lines: list[str] = []
    lines.append("# India Credit Card Intelligence Dataset & Crawl4AI Research Pipeline (2026)\n")
    lines.append(
        "> Comprehensive, normalized multi-source dataset of Indian credit cards built using **Crawl4AI (`0.9.5`)** across "
        "Paisabazaar, 18 official Indian bank websites & MITC/Lounge PDFs, `r/CreditCardsIndia` Reddit community discussions, "
        "and Indian card portals (`CardExpert`, `CardInsider`, `BankBazaar`).\n"
    )
    lines.append("> **Project Phase:** Data Accumulation & Research Only *(no React Native / UI code has been written yet per user instructions)*.\n")

    lines.append("## 1. Verified Dataset Statistics\n")
    lines.append(f"- **Normalized Unique Credit Cards:** **{len(cards)}** across **{len(set(c['bank'] for c in cards))}** Indian banks & issuers")
    lines.append("- **Categories:** **11** standardized consumer-intent categories (`cashback-online-shopping`, `travel-miles`, `airport-lounge-access`, `lifetime-free`, `rupay-upi`, `fuel`, `dining-groceries-movies`, `zero-low-forex`, `super-premium-hni`, `entry-level-secured-fd`, `business-tax`)")
    lines.append(f"- **Official Airport Lounge Locations Parsed:** **{lounge_dir['participating_indian_airport_lounges_count']}** participating Indian airport lounges (from official SBI / IndusInd / HDFC PDFs)")
    lines.append(f"- **Community Discussions Analyzed:** **{reddit_stats['total_docs']}** `r/CreditCardsIndia` threads & feeds")
    lines.append("- **Raw Source Corpus:** `558` Paisabazaar card files + `28` bank hubs + `20` guides | `133` official bank pages + `42` MITC/KFS/lounge PDFs | `124` aggregator reviews/lists | `41` targeted enrichment & lounge articles\n")

    lines.append("## 2. Master Deliverables (`data/master/`)\n")
    lines.append("| File | Format | Description |")
    lines.append("|---|---|---|")
    lines.append("| [`credit_cards_master.json`](data/master/credit_cards_master.json) | JSON | Complete **uniform-schema** array of all cards + metadata |")
    lines.append("| [`credit_cards_master.csv`](data/master/credit_cards_master.csv) | CSV | Flat 45-column spreadsheet for Excel, SQLite, Pandas & filtering |")
    lines.append("| [`credit_cards_table.md`](data/master/credit_cards_table.md) | Markdown | Top 45 Flagships Matrix + full bank-by-bank Markdown tables |")
    lines.append("| [`categories_summary.md`](data/master/categories_summary.md) | Markdown | 11-category index explaining **which card is best for whom & why** |")
    lines.append("| `data/master/categories/*.json` & `*.md` | JSON + MD | 11 category-split ranked JSON files + Markdown comparison guides |")
    lines.append("| [`lounge_access_master.json`](data/master/lounge_access_master.json) | JSON | Network rules, IRCTC May 2026 terms, & participating Indian airport lounges |")
    lines.append("| [`lounge_access_guide.md`](data/master/lounge_access_guide.md) | Markdown | Spend-Free vs Spend-Gated lounges, Priority Pass warnings, IRCTC, & lounge directory |")
    lines.append("| [`devaluation_tracker.json`](data/master/devaluation_tracker.json) | JSON | Issuer devaluation risk scores & 2024–Nov 2026 timeline events |")
    lines.append("| [`devaluation_tracker.md`](data/master/devaluation_tracker.md) | Markdown | Issuer Devaluation Frequency Index & chronological 2026 breakdown |")
    lines.append("| [`indian_user_needs_research.md`](data/master/indian_user_needs_research.md) | Markdown | `r/CreditCardsIndia` pain points, 7 personas, bank underwriting traps & RN filter spec |")

    lines.append("\n## 3. Crawl4AI Bots & ETL Pipeline (`bots/`)\n")
    lines.append("| Script | Role |")
    lines.append("|---|---|")
    lines.append("| `bots/config.py` | Crawl4AI browser configs, headers, URLs & storage paths |")
    lines.append("| `bots/crawl_paisabazaar.py` & `crawl_paisabazaar_rest.py` | Crawled Paisabazaar catalog (558 card pages, 28 bank hubs, 20 guides) |")
    lines.append("| `bots/crawl_banks.py` & `crawl_pdfs.py` | Crawled 18 official Indian bank sites + downloaded & extracted 42 MITC/KFS/Lounge PDFs |")
    lines.append("| `bots/crawl_reddit.py` | Crawled `r/CreditCardsIndia` feeds & high-signal threads via `old.reddit.com` |")
    lines.append("| `bots/crawl_aggregators.py` | Crawled `CardExpert`, `CardInsider`, `BankBazaar` reviews & roundups |")
    lines.append("| `bots/crawl_enrichment.py` & `crawl_gaps.py` | Targeted enrichment for missing 2026 flagships, forex/lounge rules & devaluations |")
    lines.append("| `bots/reconcile_2026.py` | Utility exclusions, 5 missing flagship additions, 2026 flagship overrides, devaluation timeline & category definitions |")
    lines.append("| `bots/build_master_dataset.py` | Multi-template parser, normalizer, uniform schema enforcer, JSON/CSV builder |")
    lines.append("| `bots/generate_reports.py` | Generates Markdown comparison tables, 11 category guides, lounge guide, devaluation report & README |")

    lines.append("\n## 4. Uniform Card Schema (`credit_cards_master.json` -> `cards[]`)\n")
    lines.append("Every card record shares the exact same top-level and nested schema:")
    lines.append("- **Identity & Flags:** `card_id`, `card_name`, `bank`, `card_network`, `card_tier`, `primary_category`, `categories[]`, `is_ltf_available`, `is_fyf_available`, `is_secured_fd_backed`, `is_rupay_upi_enabled`, `is_invite_only`, `status`")
    lines.append("- **`fees`:** `joining_fee_inr`, `annual_fee_inr`, `gst_applicable`, `fee_waiver_spend_inr`, `joining_fee_waiver`, `forex_markup_pct`, `apr_monthly_pct`, `apr_annual_pct`, `cash_advance_fee`, `fuel_surcharge_waiver`, `redemption_fee`, `add_on_card_fee`")
    lines.append("- **`rewards`:** `reward_type`, `base_reward_rate_pct`, `accelerated_reward_rate_pct`, `point_value_inr`, `point_expiry`, `welcome_benefit`, `milestone_benefits[]`, `category_multipliers[]`, `transfer_partners[]`, `exclusions[]`")
    lines.append("- **`benefits_and_features`:** `highlights[]`, `dining_benefits[]`, `movie_benefits[]`, `golf_benefits[]`, `insurance_cover[]`, `concierge_or_privilege[]`")
    lines.append("- **`lounge_access`:** `domestic` (`visits_per_year`, `visits_per_quarter`, `spend_criteria`, `add_on_allowed`, `shared_limit`, `summary`), `international` (`program`, `visits_per_year`, `spend_criteria`, `add_on_allowed`, `guest_fee`, `summary`), `railway` (`visits_per_year`, `visits_per_quarter`, `summary`), `participating_lounges_ref`")
    lines.append("- **`eligibility`:** `min_age`, `max_age`, `min_monthly_income_salaried_inr`, `min_annual_itr_self_employed_inr`, `min_cibil_score`, `notes`")
    lines.append("- **`ratings`:** `paisabazaar_overall`, `paisabazaar_subratings`, `aggregator_rating`, `market_community_rating`, `composite_score`, `reddit_mentions`")
    lines.append("- **`devaluation`:** `devaluation_frequency`, `devaluation_risk_score`, `last_devalued_on`, `devaluation_history[]`")
    lines.append("- **Decision Guidance:** `pros[]`, `cons[]`, `best_for_whom` (`ideal_for`, `not_ideal_for`, `recommended_monthly_spend_inr`, `verdict`), `sources`\n")

    lines.append("## 5. Rebuilding the Master Dataset\n")
    lines.append("```bash\n/Users/shubhamsharma/.local/share/uv/tools/crawl4ai/bin/python \"/Users/shubhamsharma/Downloads/Credit Card/bots/build_master_dataset.py\"\n```")

    with open(f"{ROOT_DIR}/README.md", "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def generate_all_reports(
    cards: list[dict[str, Any]],
    reddit_stats: dict[str, Any],
    lounge_dir: dict[str, Any],
    deval_payload: dict[str, Any],
) -> None:
    os.makedirs(MASTER_DIR, exist_ok=True)
    os.makedirs(CAT_DIR, exist_ok=True)

    write_master_table(cards)
    write_categories(cards)
    write_lounge_guide(cards, lounge_dir)
    write_devaluation_tracker(cards, deval_payload)
    write_user_needs_research(cards, reddit_stats)
    write_readme(cards, lounge_dir, reddit_stats)
