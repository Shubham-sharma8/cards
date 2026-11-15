import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(process.cwd(), "..");
const DATA_PATH = path.join(ROOT, "data", "master", "app_search_index.json");
const CARD_IMG_DIR = path.join(process.cwd(), "public", "card-images");
const OUT_DIR = path.join(process.cwd(), "public", "category-posters");

fs.mkdirSync(OUT_DIR, { recursive: true });

const raw = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const CARDS = raw.cards || raw;

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrapText(text, maxChars) {
  let clean = String(text || "—").replace(/\s+/g, " ").trim();
  if (clean.length > maxChars * 3.8) {
    clean = clean.slice(0, Math.floor(maxChars * 3.8) - 1).trimEnd() + "…";
  }
  const words = clean.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= maxChars) cur += " " + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}

function fmtInr(n) {
  if (n === 0) return "₹0 (LTF)";
  return "₹" + Number(n).toLocaleString("en-IN");
}

function fmtPct(v) {
  if (typeof v !== "number" || Number.isNaN(v)) return "—";
  const r = Math.round(v * 100) / 100;
  return `${r}%`;
}

function fmtFee(c) {
  if (c.filter_tags?.is_ltf) return "₹0 (LTF)";
  if (c.annual_fee_inr === 0) return c.filter_tags?.is_fyf ? "₹0 (FYF)" : "₹0";
  return fmtInr(c.annual_fee_inr);
}

function pickCards(pinnedIds, matcher, scorer, limit = 10) {
  const out = [];
  const used = new Set();
  for (const q of pinnedIds) {
    const m = CARDS.find((c) => !used.has(c.card_id) && (c.card_id === q || c.card_id.includes(q)));
    if (m) {
      out.push(m);
      used.add(m.card_id);
    }
  }
  const rest = CARDS.filter((c) => !used.has(c.card_id) && matcher(c)).sort(
    (a, b) => scorer(b) - scorer(a)
  );
  for (const c of rest) {
    if (out.length >= limit) break;
    out.push(c);
    used.add(c.card_id);
  }
  return out;
}

const POSTER_SPECS = [
  {
    id: "dining",
    title: "Best Credit Cards for Dining & Food Delivery (2026)",
    subtitle: "Compared on Swiggy, Zomato, EazyDiner Prime, fine dining & monthly post-cap rewards",
    accent: "#0F5C4D",
    cols: ["Dining Return", "Grocery & Online", "Monthly Cap & Notes"],
    cards: () =>
      pickCards(
        [
          "indusind_bank_indusind_bank_eazydiner_credit_card",
          "hsbc_bank_hsbc_live_plus_credit_card",
          "hsbc_bank_hsbc_rupay_cashback_credit_card",
          "hdfc_bank_swiggy_hdfc_bank_credit_card",
          "axis_bank_airtel_axis_bank_credit_card",
          "hdfc_bank_infinia_credit_card",
        ],
        (c) => (c.effective_return_pct_by_category?.dining_swiggy_zomato || 0) >= 2.5,
        (c) => (c.effective_return_pct_by_category?.dining_swiggy_zomato || 0) * 8 + c.overall_rating * 3
      ),
    rowCells: (c) => [
      `${fmtPct(c.effective_return_pct_by_category?.dining_swiggy_zomato)} Dining / Delivery`,
      `${fmtPct(c.effective_return_pct_by_category?.groceries_quick_commerce)} Grocery · ${fmtPct(c.effective_return_pct_by_category?.online_shopping_general)} Online`,
      c.capping_summary || c.best_for_short || "Check billing cycle cap",
    ],
  },
  {
    id: "groceries",
    title: "Best Credit Cards for Groceries & Quick Commerce (2026)",
    subtitle: "Blinkit, Zepto, BigBasket, Tata Neu Fresh, DMart & offline supermarket net rewards",
    accent: "#0F5C4D",
    cols: ["Grocery Yield", "Dining & UPI", "Cap & Partner Edge"],
    cards: () =>
      pickCards(
        [
          "hsbc_bank_hsbc_live_plus_credit_card",
          "hsbc_bank_hsbc_rupay_cashback_credit_card",
          "hdfc_bank_swiggy_hdfc_bank_credit_card",
          "hdfc_bank_tata_neu_infinity_hdfc_bank_credit_card",
          "sbi_bank_cashback_sbi_card",
          "axis_bank_airtel_axis_bank_credit_card",
        ],
        (c) => (c.effective_return_pct_by_category?.groceries_quick_commerce || 0) >= 2.5,
        (c) => (c.effective_return_pct_by_category?.groceries_quick_commerce || 0) * 8 + c.overall_rating * 3
      ),
    rowCells: (c) => [
      `${fmtPct(c.effective_return_pct_by_category?.groceries_quick_commerce)} Grocery / Quick-Comm`,
      `${fmtPct(c.effective_return_pct_by_category?.dining_swiggy_zomato)} Dining · ${fmtPct(c.effective_return_pct_by_category?.upi_scan_and_pay)} UPI`,
      c.capping_summary || c.best_for_short || "Check merchant MCC eligibility",
    ],
  },
  {
    id: "dining-groceries",
    title: "Best Dining, Groceries & Movies Credit Cards (2026)",
    subtitle: "All-in-one weekly household spenders across restaurants, quick commerce & BookMyShow BOGO",
    accent: "#0F5C4D",
    cols: ["Grocery & Dining", "UPI & Online Rate", "Monthly Cap & Notes"],
    cards: () =>
      pickCards(
        [
          "hsbc_bank_hsbc_live_plus_credit_card",
          "hdfc_bank_swiggy_hdfc_bank_credit_card",
          "axis_bank_airtel_axis_bank_credit_card",
          "indusind_bank_indusind_bank_eazydiner_credit_card",
          "hdfc_bank_tata_neu_infinity_hdfc_bank_credit_card",
        ],
        (c) => (c.categories || []).includes("Dining, Groceries & Movies"),
        (c) => (c.effective_return_pct_by_category?.groceries_quick_commerce || 0) * 5 + c.overall_rating * 4
      ),
    rowCells: (c) => [
      `${fmtPct(c.effective_return_pct_by_category?.groceries_quick_commerce)} Grocery · ${fmtPct(c.effective_return_pct_by_category?.dining_swiggy_zomato)} Dining`,
      `${fmtPct(c.effective_return_pct_by_category?.upi_scan_and_pay)} UPI · ${fmtPct(c.effective_return_pct_by_category?.online_shopping_general)} Online`,
      c.capping_summary || c.best_for_short || "Verify monthly cashback cap",
    ],
  },
  {
    id: "golf",
    title: "Best Credit Cards with Golf Benefits (Rounds & Lessons 2026)",
    subtitle: "Complimentary domestic & international green fee waivers, PGA coaching & spend rules",
    accent: "#1B5E20",
    cols: ["Complimentary Access", "Eligible Courses", "Booking & Spend Condition"],
    cards: () =>
      pickCards(
        [
          "hdfc_bank_infinia_credit_card",
          "hdfc_bank_diners_club_black_metal_edition",
          "icici_bank_emeralde_private_metal_credit_card",
          "axis_bank_axis_bank_magnus_credit_card_for_burgundy",
          "hsbc_bank_hsbc_travelone_credit_card",
          "idfc_first_bank_idfc_first_ashva_credit_card",
          "au_small_finance_bank_au_zenith_plus_credit_card",
          "amex_bank_american_express_platinum_reserve_credit_card",
        ],
        (c) => Boolean(c.filter_tags?.has_golf || c.golf_summary?.has_golf),
        (c) => (c.golf_summary?.eligible_courses?.includes("International") ? 10 : 0) + c.overall_rating * 4
      ),
    rowCells: (c) => [
      c.golf_summary?.complimentary_access || "Complimentary green fee rounds",
      c.golf_summary?.eligible_courses || "Domestic Courses",
      c.golf_summary?.spend_condition || "Book via RuPay Truztee / Visa TeePass / 1800-102-6263",
    ],
  },
  {
    id: "lounge",
    title: "Best Airport & Railway Lounge Credit Cards (No-Spend vs Gated)",
    subtitle: "Verified domestic airport, Priority Pass international & IRCTC railway quotas with spend rules",
    accent: "#1D4ED8",
    cols: ["Domestic Airport Lounge", "International Lounge", "Spend Condition & Waiver"],
    cards: () =>
      pickCards(
        [
          "hdfc_bank_infinia_credit_card",
          "hdfc_bank_diners_club_black_metal_edition",
          "icici_bank_emeralde_private_metal_credit_card",
          "federal_bank_scapia_scapia_federal_bank_credit_card",
          "indusind_bank_indusind_bank_tiger_credit_card",
          "axis_bank_atlas_credit_card",
          "hdfc_bank_regalia_gold_credit_card",
          "hdfc_bank_tata_neu_infinity_hdfc_bank_credit_card",
        ],
        (c) => Boolean(c.filter_tags?.has_domestic_lounge || c.filter_tags?.has_international_lounge),
        (c) => (c.filter_tags?.no_spend_domestic_lounge ? 12 : 0) + c.overall_rating * 4
      ),
    rowCells: (c) => [
      c.domestic_lounge_summary || "Domestic terminal access",
      c.international_lounge_summary || "No international lounge",
      c.lounge_spend_condition || (c.filter_tags?.no_spend_domestic_lounge ? "No Spend Condition Required" : "Quarterly spend rule applies"),
    ],
  },
  {
    id: "insurance",
    title: "Best Credit Cards for Insurance Premiums (2026)",
    subtitle: "Cards that bypass the industry-wide MCC 6300 zero-reward trap on LIC, term & health policies",
    accent: "#7C3AED",
    cols: ["Insurance Return %", "Utility & Base Rate", "Portal / Monthly Cap Notes"],
    cards: () =>
      pickCards(
        [
          "sbi_bank_phonepe_sbi_card_select_black",
          "hdfc_bank_tata_neu_infinity_hdfc_bank_credit_card",
          "sbi_bank_tata_neu_infinity_sbi_card",
          "idfc_first_bank_lic_select_credit_card",
          "hdfc_bank_biz_black_credit_card",
          "axis_bank_axis_bank_rewards_credit_cards",
        ],
        (c) => (c.effective_return_pct_by_category?.insurance || 0) >= 1.5,
        (c) => (c.effective_return_pct_by_category?.insurance || 0) * 9 + c.overall_rating * 3
      ),
    rowCells: (c) => [
      `${fmtPct(c.effective_return_pct_by_category?.insurance)} on Insurance`,
      `${fmtPct(c.effective_return_pct_by_category?.utilities_bills_telecom)} Util · ${fmtPct(c.effective_return_pct_by_category?.offline_general_other)} Base`,
      c.capping_summary || "Pay via Tata Neu / PhonePe / LIC Portal for full rate",
    ],
  },
  {
    id: "business-tax",
    title: "Best Credit Cards for Tax, Govt & GST Spends (2026)",
    subtitle: "Advance tax, GST challan, MCA govt fee & commercial vendor payouts with real rewards",
    accent: "#9A5B13",
    cols: ["Tax / Govt / GST %", "Utility & Travel Edge", "Monthly Cap & Waiver"],
    cards: () =>
      pickCards(
        [
          "hdfc_bank_biz_black_credit_card",
          "hdfc_bank_biz_power_credit_card",
          "icici_bank_emeralde_private_metal_credit_card",
          "hdfc_bank_infinia_credit_card",
          "hdfc_bank_diners_club_black_metal_edition",
          "standard_chartered_bank_standard_chartered_ultimate_credit_cards",
        ],
        (c) => (c.effective_return_pct_by_category?.education_rent_govt || 0) >= 1.75 || (c.categories || []).includes("Business & Tax"),
        (c) => (c.effective_return_pct_by_category?.education_rent_govt || 0) * 9 + c.overall_rating * 3
      ),
    rowCells: (c) => [
      `${fmtPct(c.effective_return_pct_by_category?.education_rent_govt)} Tax / Govt / GST`,
      `${fmtPct(c.effective_return_pct_by_category?.utilities_bills_telecom)} Util · ${fmtPct(c.effective_return_pct_by_category?.travel_flights_hotels)} Travel`,
      c.capping_summary || (c.fee_waiver_spend_inr ? `Fee Waiver @ ${fmtInr(c.fee_waiver_spend_inr)}` : "High business limit"),
    ],
  },
  {
    id: "fuel",
    title: "Best Fuel Credit Cards in India (HPCL, BPCL, IOCL 2026)",
    subtitle: "Net value after 1% fuel surcharge waiver & GST recovery across major oil marketing networks",
    accent: "#B45309",
    cols: ["Fuel Net Return", "Utility & Everyday", "Cap & Partner Pump"],
    cards: () =>
      pickCards(
        [
          "sbi_bank_bpcl_sbi_card_octane",
          "idfc_first_bank_idfc_first_power_plus_credit_card",
          "rbl_bank_indian_oil_rbl_bank_xtra_credit_card",
          "hdfc_bank_indian_oil_hdfc_bank_credit_card",
          "axis_bank_indian_oil_axis_bank_premium_credit_card",
          "icici_bank_hpcl_super_saver_icici_bank_credit_card",
        ],
        (c) => (c.categories || []).includes("Fuel") || (c.effective_return_pct_by_category?.fuel || 0) >= 3.5,
        (c) => (c.effective_return_pct_by_category?.fuel || 0) * 8 + c.overall_rating * 3
      ),
    rowCells: (c) => [
      `${fmtPct(c.effective_return_pct_by_category?.fuel)} Net Fuel Back`,
      `${fmtPct(c.effective_return_pct_by_category?.utilities_bills_telecom)} Util · ${fmtPct(c.effective_return_pct_by_category?.groceries_quick_commerce)} Grocery`,
      c.capping_summary || c.best_for_short || "Swipe at partner pump POS",
    ],
  },
  {
    id: "utilities",
    title: "Best Credit Cards for Utility & Bill Payments (2026)",
    subtitle: "Electricity, Wi-Fi broadband, mobile recharge, gas & FASTag returns via Airtel Thanks / Neu / BBPS",
    accent: "#0F5C4D",
    cols: ["Utilities & Bills %", "Insurance & UPI %", "Monthly Cap & App Route"],
    cards: () =>
      pickCards(
        [
          "axis_bank_airtel_axis_bank_credit_card",
          "hdfc_bank_biz_black_credit_card",
          "hsbc_bank_hsbc_live_plus_credit_card",
          "sbi_bank_phonepe_sbi_card_select_black",
          "hdfc_bank_tata_neu_infinity_hdfc_bank_credit_card",
          "axis_bank_ace_credit_card",
        ],
        (c) => (c.effective_return_pct_by_category?.utilities_bills_telecom || 0) >= 2.0,
        (c) => (c.effective_return_pct_by_category?.utilities_bills_telecom || 0) * 8 + c.overall_rating * 3
      ),
    rowCells: (c) => [
      `${fmtPct(c.effective_return_pct_by_category?.utilities_bills_telecom)} Utilities & Telecom`,
      `${fmtPct(c.effective_return_pct_by_category?.insurance)} Ins · ${fmtPct(c.effective_return_pct_by_category?.upi_scan_and_pay)} UPI`,
      c.capping_summary || c.best_for_short || "Route via official BBPS / partner app",
    ],
  },
  {
    id: "forex",
    title: "Best Zero & Low Forex Markup Credit Cards (2026)",
    subtitle: "0% to 1.99% forex markup plus international reward offsets — save 3%–4% on every foreign spend",
    accent: "#0369A1",
    cols: ["Forex Markup %", "Net Forex Gain/Cost", "Intl Lounge & Notes"],
    cards: () =>
      pickCards(
        [
          "federal_bank_scapia_scapia_federal_bank_credit_card",
          "au_small_finance_bank_au_ixigo_credit_card",
          "idfc_first_bank_mayura_credit_card",
          "au_small_finance_bank_au_zenith_plus_credit_card",
          "yes_bank_yes_bank_uni_credit_card",
          "hdfc_bank_infinia_credit_card",
        ],
        (c) => Boolean(c.filter_tags?.zero_or_low_forex),
        (c) => (c.filter_tags?.zero_forex ? 12 : 0) + (c.effective_return_pct_by_category?.international_forex_net_of_markup || 0) * 4 + c.overall_rating * 3
      ),
    rowCells: (c) => [
      `${c.forex_markup_pct ?? "≤1.99"}% Forex (+GST)`,
      `${fmtPct(c.effective_return_pct_by_category?.international_forex_net_of_markup)} Net Overseas Return`,
      c.international_lounge_summary || "Check Global Value / reward eligibility",
    ],
  },
  {
    id: "gold-jewellery",
    title: "Best Credit Cards for Gold & Jewellery Purchases (2026)",
    subtitle: "Tanishq co-brand rewards, uncapped metal cards & milestone strategies bypassing MCC 5944 blocks",
    accent: "#B45309",
    cols: ["Base / Jewellery Rate", "Milestone & Online Edge", "MCC 5944 / Jewellery Rule"],
    cards: () =>
      pickCards(
        [
          "sbi_bank_titan_sbi_credit_card",
          "hdfc_bank_tata_neu_infinity_hdfc_bank_credit_card",
          "sbi_bank_tata_neu_infinity_sbi_card",
          "hdfc_bank_infinia_credit_card",
          "amex_bank_american_express_platinum_travel_credit_cards",
          "icici_bank_emeralde_private_metal_credit_card",
        ],
        (c) => /\btitan\b|tata neu infinity|infinia|diners club black|emeralde private|magnus|platinum travel|hsbc premier/i.test(c.card_name) || (c.effective_return_pct_by_category?.offline_general_other || 0) >= 2.5,
        (c) => (/\btitan\b|tata neu infinity|platinum travel/i.test(c.card_name) ? 14 : 0) + (c.effective_return_pct_by_category?.offline_general_other || 0) * 5 + c.overall_rating * 3
      ),
    rowCells: (c) => [
      `${fmtPct(c.effective_return_pct_by_category?.offline_general_other)} Base · ${fmtPct(c.effective_return_pct_by_category?.online_shopping_general)} Online`,
      c.milestone_summary || (c.fee_waiver_spend_inr ? `Waiver @ ${fmtInr(c.fee_waiver_spend_inr)}` : "Premium rewards"),
      /\btitan\b/i.test(c.card_name)
        ? "3% cashback / Titan Tanishq Mia CaratLane perks"
        : /tata neu/i.test(c.card_name)
          ? "5% NeuCoins on Tanishq (verify monthly NeuCoin cap)"
          : /platinum travel/i.test(c.card_name)
            ? "Counts toward ₹4L Milestone (~48K+ Bonus Points)"
            : c.capping_summary || "Confirm jeweller MCC 5944 before large swipes",
    ],
  },
  {
    id: "entry-fd",
    title: "Best Credit Cards for Beginners & FD-Backed Starters (2026)",
    subtitle: "Build CIBIL from 0 with zero income proof via fixed deposits or simple ₹0-fee starter cards",
    accent: "#0F5C4D",
    cols: ["FD / Unsecured Path", "Peak Category Rate", "Starter Friendly Features"],
    cards: () =>
      pickCards(
        [
          "idfc_first_bank_idfc_first_wow_credit_card",
          "hdfc_bank_tata_neu_plus_hdfc_bank_fd_credit_card",
          "utkarsh_small_finance_bank_super_money_credit_card",
          "icici_bank_icici_bank_platinum_chip_credit_card",
          "onecard_onecard_credit_card",
          "hdfc_bank_freedom_credit_card",
        ],
        (c) => Boolean(c.filter_tags?.is_fd_backed || (c.categories || []).includes("Entry-Level & Secured (FD)")),
        (c) => (c.filter_tags?.is_ltf ? 8 : 0) + c.overall_rating * 4
      ),
    rowCells: (c) => [
      c.filter_tags?.is_fd_backed ? "FD-Backed (No Income Proof)" : "Beginner Unsecured",
      `Up to ${fmtPct(Math.max(...Object.values(c.effective_return_pct_by_category || { a: 1 })))} Peak Return`,
      c.best_for_short || c.capping_summary || "Builds CIBIL score cleanly",
    ],
  },
  {
    id: "cashback",
    title: "Best Direct Cashback Credit Cards in India (2026)",
    subtitle: "Transparent 1:1 statement cashback without airline transfer math or confusing reward multipliers",
    accent: "#0F5C4D",
    cols: ["Online Cashback", "Dining / Grocery / Util", "Monthly Cap & Waiver"],
    cards: () =>
      pickCards(
        [
          "sbi_bank_cashback_sbi_card",
          "hdfc_bank_millennia_credit_card",
          "hsbc_bank_hsbc_live_plus_credit_card",
          "hdfc_bank_swiggy_hdfc_bank_credit_card",
          "axis_bank_airtel_axis_bank_credit_card",
          "icici_bank_amazon_pay_icici_bank_credit_card",
        ],
        (c) => (c.categories || []).includes("Cashback"),
        (c) => (c.effective_return_pct_by_category?.online_shopping_general || 0) * 6 + c.overall_rating * 4
      ),
    rowCells: (c) => [
      `${fmtPct(c.effective_return_pct_by_category?.online_shopping_general)} Online`,
      `${fmtPct(c.effective_return_pct_by_category?.dining_swiggy_zomato)} Dining · ${fmtPct(c.effective_return_pct_by_category?.utilities_bills_telecom)} Util`,
      c.capping_summary || "Direct statement cashback credit",
    ],
  },
  {
    id: "online-shopping",
    title: "Best Online Shopping Credit Cards (Amazon, Flipkart & D2C 2026)",
    subtitle: "5%–10% across e-commerce marketplaces, electronics, Myntra & D2C brand checkouts",
    accent: "#0F5C4D",
    cols: ["Amazon / Flipkart / Myntra", "General Online %", "Monthly Cap & Waiver"],
    cards: () =>
      pickCards(
        [
          "sbi_bank_cashback_sbi_card",
          "icici_bank_amazon_pay_icici_bank_credit_card",
          "axis_bank_flipkart_axis_bank_credit_card",
          "hdfc_bank_millennia_credit_card",
          "hdfc_bank_swiggy_hdfc_bank_credit_card",
        ],
        (c) => (c.categories || []).includes("Online Shopping"),
        (c) => (c.effective_return_pct_by_category?.amazon_flipkart_myntra || 0) * 7 + c.overall_rating * 3
      ),
    rowCells: (c) => [
      `${fmtPct(c.effective_return_pct_by_category?.amazon_flipkart_myntra)} Marketplaces`,
      `${fmtPct(c.effective_return_pct_by_category?.online_shopping_general)} All Online`,
      c.capping_summary || "Applies across online merchant MCCs",
    ],
  },
  {
    id: "travel",
    title: "Best Travel & Air Miles Credit Cards in India (2026)",
    subtitle: "Top airline/hotel point transfer ratios, portal multipliers & complimentary airport lounge quotas",
    accent: "#1D4ED8",
    cols: ["Travel / Flights %", "Intl Lounge / Forex", "Milestone & Point Edge"],
    cards: () =>
      pickCards(
        [
          "axis_bank_atlas_credit_card",
          "hdfc_bank_infinia_credit_card",
          "hdfc_bank_diners_club_black_metal_edition",
          "hsbc_bank_hsbc_travelone_credit_card",
          "amex_bank_american_express_platinum_travel_credit_cards",
          "hdfc_bank_regalia_gold_credit_card",
        ],
        (c) => (c.categories || []).includes("Travel & Miles"),
        (c) => (c.effective_return_pct_by_category?.travel_flights_hotels || 0) * 6 + c.overall_rating * 4
      ),
    rowCells: (c) => [
      `${fmtPct(c.effective_return_pct_by_category?.travel_flights_hotels)} Flights & Hotels`,
      `${c.international_lounge_summary || "Check Priority Pass"} · ${c.forex_markup_pct ?? 3.5}% FX`,
      c.milestone_summary || c.best_for_short || "High-value airline & hotel partners",
    ],
  },
  {
    id: "rupay-upi",
    title: "Best RuPay UPI Credit Cards (GPay, PhonePe, BHIM 2026)",
    subtitle: "Scan & Pay merchant QR rewards with low/zero annual fee across daily kirana & retail spends",
    accent: "#0F5C4D",
    cols: ["UPI Scan & Pay %", "Utility & Grocery %", "Network & Cap Conditions"],
    cards: () =>
      pickCards(
        [
          "yes_bank_yes_bank_kiwi_credit_card",
          "hdfc_bank_tata_neu_infinity_hdfc_bank_credit_card",
          "indusind_bank_platinum_rupay_credit_card",
          "axis_bank_axis_bank_supermoney_rupay_credit_card",
          "hsbc_bank_hsbc_rupay_cashback_credit_card",
          "federal_bank_jupiter_edge_csb_rupay_credit_card",
        ],
        (c) => Boolean(c.filter_tags?.is_rupay_upi),
        (c) => (c.effective_return_pct_by_category?.upi_scan_and_pay || 0) * 8 + c.overall_rating * 3
      ),
    rowCells: (c) => [
      `${fmtPct(c.effective_return_pct_by_category?.upi_scan_and_pay)} Scan & Pay`,
      `${fmtPct(c.effective_return_pct_by_category?.utilities_bills_telecom)} Util · ${fmtPct(c.effective_return_pct_by_category?.groceries_quick_commerce)} Grocery`,
      c.capping_summary || "Min UPI ticket rules (₹50–₹100) may apply",
    ],
  },
  {
    id: "super-premium",
    title: "Best Super-Premium & Metal Credit Cards in India (2026)",
    subtitle: "Unlimited lounge access, low forex, golf & 10%–33% accelerated travel reward engines",
    accent: "#1F2937",
    cols: ["Travel & Portal Yield", "Lounge & Golf Access", "Income & Fee Waiver"],
    cards: () =>
      pickCards(
        [
          "hdfc_bank_infinia_credit_card",
          "icici_bank_emeralde_private_metal_credit_card",
          "hdfc_bank_diners_club_black_metal_edition",
          "axis_bank_axis_bank_magnus_credit_card_for_burgundy",
          "hsbc_bank_hsbc_premier_credit_card",
          "amex_bank_american_express_platinum_card",
        ],
        (c) => (c.categories || []).includes("Super-Premium"),
        (c) => (c.effective_return_pct_by_category?.travel_flights_hotels || 0) * 4 + c.overall_rating * 5
      ),
    rowCells: (c) => [
      `${fmtPct(c.effective_return_pct_by_category?.travel_flights_hotels)} Travel · ${fmtPct(c.effective_return_pct_by_category?.offline_general_other)} Base`,
      `${c.domestic_lounge_summary || "Unlimited"} · ${c.golf_summary?.complimentary_access || "Concierge"}`,
      c.fee_waiver_spend_inr ? `Waiver @ ${fmtInr(c.fee_waiver_spend_inr)}` : "Invite / Wealth Relationship",
    ],
  },
  {
    id: "ltf",
    title: "Best Lifetime Free (₹0) Credit Cards in India (2026)",
    subtitle: "Zero annual fee forever with real online shopping, UPI, forex & lounge value",
    accent: "#0F5C4D",
    cols: ["Online & UPI Yield", "Lounge & Zero-Forex", "Standout Perk"],
    cards: () =>
      pickCards(
        [
          "icici_bank_amazon_pay_icici_bank_credit_card",
          "federal_bank_scapia_scapia_federal_bank_credit_card",
          "au_small_finance_bank_au_ixigo_credit_card",
          "indusind_bank_indusind_bank_tiger_credit_card",
          "yes_bank_yes_bank_kiwi_credit_card",
          "idfc_first_bank_idfc_first_millennia_credit_card",
        ],
        (c) => Boolean(c.filter_tags?.is_ltf),
        (c) => (c.effective_return_pct_by_category?.online_shopping_general || 0) * 5 + (c.filter_tags?.no_spend_domestic_lounge ? 8 : 0) + c.overall_rating * 4
      ),
    rowCells: (c) => [
      `${fmtPct(c.effective_return_pct_by_category?.online_shopping_general)} Online · ${fmtPct(c.effective_return_pct_by_category?.upi_scan_and_pay)} UPI`,
      `${c.filter_tags?.has_domestic_lounge ? c.domestic_lounge_summary || "Dom Lounge" : "No Lounge"} · ${c.forex_markup_pct ?? 3.5}% FX`,
      c.best_for_short || "₹0 Joining & ₹0 Renewal Forever",
    ],
  },
];

async function cardThumbDataUri(localImagePath) {
  if (!localImagePath) return null;
  const rel = localImagePath.replace(/^\/+/, "");
  const stripped = rel.replace(/^data\/assets\/card_images\//, "");
  const candidates = [
    path.join(CARD_IMG_DIR, stripped),
    path.join(process.cwd(), "public", rel),
    path.join(CARD_IMG_DIR, path.basename(rel)),
  ];
  const filePath = candidates.find((p) => fs.existsSync(p));
  if (!filePath) return null;
  try {
    const buf = await sharp(filePath).resize(54, 34, { fit: "cover" }).png().toBuffer();
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

async function generatePoster(spec) {
  const rows = spec.cards();
  const width = 1360;
  const pad = 28;
  const tw = width - pad * 2;
  const colsW = [148, 290, 118, 232, 224, tw - (148 + 290 + 118 + 232 + 224)];
  const headerH = 92;
  const thH = 44;
  const lineH = 17;

  const thumbs = await Promise.all(rows.map((r) => cardThumbDataUri(r.local_image_path)));

  const measured = rows.map((c, idx) => {
    const bankL = wrapText(c.bank, 16);
    const cardL = wrapText(c.card_name, thumbs[idx] ? 24 : 30);
    const feeL = wrapText(`${fmtFee(c)} · ${c.overall_rating.toFixed(1)}★`, 14);
    const cells = spec.rowCells(c);
    const cL = [
      wrapText(cells[0], 26),
      wrapText(cells[1], 25),
      wrapText(cells[2], 32),
    ];
    const maxL = Math.max(bankL.length, cardL.length, feeL.length, ...cL.map((x) => x.length));
    const rowH = Math.max(52, 20 + maxL * lineH);
    return { c, bankL, cardL, feeL, cL, rowH, thumb: thumbs[idx] };
  });

  const rowsH = measured.reduce((s, r) => s + r.rowH, 0);
  const footerH = 46;
  const totalH = pad + headerH + 14 + thH + rowsH + footerH + pad;

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalH}" viewBox="0 0 ${width} ${totalH}">`);
  parts.push(`<rect width="${width}" height="${totalH}" fill="#FAF9F6"/>`);

  // Header panel
  let y = pad;
  parts.push(`<rect x="${pad}" y="${y}" width="${tw}" height="${headerH}" rx="12" fill="#FFFFFF" stroke="#E2E3DD" stroke-width="1"/>`);
  parts.push(`<rect x="${pad + tw - 236}" y="${y + 20}" width="214" height="34" rx="8" fill="${spec.accent}"/>`);
  parts.push(`<text x="${pad + tw - 129}" y="${y + 42}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="12.5" font-weight="bold" fill="#FFFFFF">CardLedger India · 2026</text>`);
  parts.push(`<text x="${pad + 22}" y="${y + 38}" font-family="Helvetica, Arial, sans-serif" font-size="22" font-weight="bold" fill="#1A1D21">${esc(spec.title)}</text>`);
  parts.push(`<text x="${pad + 22}" y="${y + 66}" font-family="Helvetica, Arial, sans-serif" font-size="13.5" fill="#4B525C">${esc(spec.subtitle)}</text>`);

  y += headerH + 14;
  const tableTop = y;

  // Header row
  parts.push(`<rect x="${pad}" y="${y}" width="${tw}" height="${thH}" rx="8" fill="#4A515E"/>`);
  parts.push(`<rect x="${pad}" y="${y}" width="${colsW[0]}" height="${thH}" rx="8" fill="${spec.accent}"/>`);
  parts.push(`<rect x="${pad + 10}" y="${y}" width="${colsW[0] - 10}" height="${thH}" fill="${spec.accent}"/>`);

  const heads = ["Provider", "Credit Card", "Annual Fee", spec.cols[0], spec.cols[1], spec.cols[2]];
  let hx = pad;
  for (let i = 0; i < heads.length; i++) {
    parts.push(`<text x="${hx + 12}" y="${y + 27}" font-family="Helvetica, Arial, sans-serif" font-size="12.5" font-weight="bold" fill="#FFFFFF">${esc(heads[i])}</text>`);
    hx += colsW[i];
  }

  y += thH;

  measured.forEach((mr, idx) => {
    const isAlt = idx % 2 === 1;
    parts.push(`<rect x="${pad}" y="${y}" width="${colsW[0]}" height="${mr.rowH}" fill="${isAlt ? "#E2ECE8" : "#EDF3F0"}"/>`);
    parts.push(`<rect x="${pad + colsW[0]}" y="${y}" width="${tw - colsW[0]}" height="${mr.rowH}" fill="${isAlt ? "#F6F5F8" : "#FFFFFF"}"/>`);
    parts.push(`<line x1="${pad}" y1="${y + mr.rowH}" x2="${pad + tw}" y2="${y + mr.rowH}" stroke="#E0E0E6" stroke-width="1"/>`);

    let vx = pad;
    for (let i = 0; i < colsW.length - 1; i++) {
      vx += colsW[i];
      parts.push(`<line x1="${vx}" y1="${y}" x2="${vx}" y2="${y + mr.rowH}" stroke="#E0E0E6" stroke-width="1"/>`);
    }

    let cx = pad;
    // Provider
    mr.bankL.forEach((ln, li) => {
      parts.push(`<text x="${cx + 12}" y="${y + 21 + li * lineH}" font-family="Helvetica, Arial, sans-serif" font-size="12.5" font-weight="bold" fill="#1A1D21">${esc(ln)}</text>`);
    });
    cx += colsW[0];

    // Thumb + Card Name
    let textX = cx + 12;
    if (mr.thumb) {
      const ty = y + Math.max(8, Math.round((mr.rowH - 34) / 2));
      parts.push(`<image href="${mr.thumb}" x="${cx + 10}" y="${ty}" width="54" height="34" preserveAspectRatio="xMidYMid slice"/>`);
      parts.push(`<rect x="${cx + 10}" y="${ty}" width="54" height="34" rx="4" fill="none" stroke="#D1D5DB" stroke-width="1"/>`);
      textX = cx + 72;
    }
    mr.cardL.forEach((ln, li) => {
      parts.push(`<text x="${textX}" y="${y + 21 + li * lineH}" font-family="Helvetica, Arial, sans-serif" font-size="13" font-weight="bold" fill="${spec.accent}">${esc(ln)}</text>`);
    });
    cx += colsW[1];

    // Fee + Rating
    mr.feeL.forEach((ln, li) => {
      parts.push(`<text x="${cx + 12}" y="${y + 21 + li * lineH}" font-family="Helvetica, Arial, sans-serif" font-size="12.5" font-weight="bold" fill="#1A1D21">${esc(ln)}</text>`);
    });
    cx += colsW[2];

    // 3 Metric Cols
    mr.cL.forEach((lines, cIdx) => {
      lines.forEach((ln, li) => {
        parts.push(`<text x="${cx + 12}" y="${y + 21 + li * lineH}" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="#2E333B">${esc(ln)}</text>`);
      });
      cx += colsW[3 + cIdx];
    });

    y += mr.rowH;
  });

  // Outer border
  parts.push(`<rect x="${pad}" y="${tableTop}" width="${tw}" height="${thH + rowsH}" rx="8" fill="none" stroke="#CBD2D9" stroke-width="1.2"/>`);

  // Footer
  parts.push(`<text x="${pad + 4}" y="${y + 28}" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="#717882">Benchmarked from ${rows.length} Verified Indian Credit Cards · CardLedger India</text>`);
  parts.push(`<text x="${pad + tw - 4}" y="${y + 28}" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="12" font-weight="bold" fill="${spec.accent}">cardledger.in · Objective Net-Return Research</text>`);
  parts.push(`</svg>`);

  const outFile = path.join(OUT_DIR, `${spec.id}.png`);
  await sharp(Buffer.from(parts.join("\n")))
    .png({ compressionLevel: 9, palette: true })
    .toFile(outFile);
  return outFile;
}

async function generateLoungeClaimPoster() {
  const width = 1360;
  const height = 740;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#FAF9F6"/>
  <rect x="28" y="28" width="1304" height="96" rx="14" fill="#FFFFFF" stroke="#E2E3DD"/>
  <text x="52" y="68" font-family="Helvetica, Arial, sans-serif" font-size="24" font-weight="bold" fill="#1A1D21">Claim Indian Airport Lounges Online — No Physical Card Needed (QR Guide)</text>
  <text x="52" y="96" font-family="Helvetica, Arial, sans-serif" font-size="14" fill="#4B525C">Pre-generate your digital lounge QR pass on the terminal operator portal before clearing security to skip desk queues &amp; OTP drops</text>
  <rect x="1084" y="48" width="224" height="36" rx="8" fill="#0F5C4D"/>
  <text x="1196" y="71" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="13" font-weight="bold" fill="#FFFFFF">CardLedger India · 2026</text>

  <!-- Step Flow Strip -->
  <rect x="28" y="142" width="312" height="122" rx="12" fill="#EEF5F2" stroke="#B7DDD0"/>
  <text x="48" y="172" font-family="Helvetica, Arial, sans-serif" font-size="12" font-weight="bold" fill="#0F5C4D">STEP 1 · CHECK ELIGIBILITY</text>
  <text x="48" y="198" font-family="Helvetica, Arial, sans-serif" font-size="15" font-weight="bold" fill="#1A1D21">Verify Card &amp; Spend Rule</text>
  <text x="48" y="222" font-family="Helvetica, Arial, sans-serif" font-size="12.5" fill="#4B525C">Confirm quarterly spend (e.g. ₹5k–₹75k)</text>
  <text x="48" y="242" font-family="Helvetica, Arial, sans-serif" font-size="12.5" fill="#4B525C">or No-Spend Free access on CardLedger</text>

  <rect x="358" y="142" width="312" height="122" rx="12" fill="#FFFFFF" stroke="#E2E3DD"/>
  <text x="378" y="172" font-family="Helvetica, Arial, sans-serif" font-size="12" font-weight="bold" fill="#1D4ED8">STEP 2 · PICK AIRPORT PORTAL</text>
  <text x="378" y="198" font-family="Helvetica, Arial, sans-serif" font-size="15" font-weight="bold" fill="#1A1D21">Open LoungeOne / TFS / HOI</text>
  <text x="378" y="222" font-family="Helvetica, Arial, sans-serif" font-size="12.5" fill="#4B525C">Match your departure city below</text>
  <text x="378" y="242" font-family="Helvetica, Arial, sans-serif" font-size="12.5" fill="#4B525C">(or Priority Pass / SmartBuy / Scapia)</text>

  <rect x="688" y="142" width="312" height="122" rx="12" fill="#FFFFFF" stroke="#E2E3DD"/>
  <text x="708" y="172" font-family="Helvetica, Arial, sans-serif" font-size="12" font-weight="bold" fill="#9A5B13">STEP 3 · TOKENIZE ONLINE</text>
  <text x="708" y="198" font-family="Helvetica, Arial, sans-serif" font-size="15" font-weight="bold" fill="#1A1D21">₹2 / ₹25 Refundable Auth</text>
  <text x="708" y="222" font-family="Helvetica, Arial, sans-serif" font-size="12.5" fill="#4B525C">Enter card + OTP at home before</text>
  <text x="708" y="242" font-family="Helvetica, Arial, sans-serif" font-size="12.5" fill="#4B525C">airport basement signal drops</text>

  <rect x="1018" y="142" width="314" height="122" rx="12" fill="#FEF6EA" stroke="#F2D7B4"/>
  <text x="1038" y="172" font-family="Helvetica, Arial, sans-serif" font-size="12" font-weight="bold" fill="#9A5B13">STEP 4 · SCAN AT LOUNGE</text>
  <text x="1038" y="198" font-family="Helvetica, Arial, sans-serif" font-size="15" font-weight="bold" fill="#1A1D21">Show QR + Boarding Pass</text>
  <text x="1038" y="222" font-family="Helvetica, Arial, sans-serif" font-size="12.5" fill="#4B525C">Valid up to 48 hrs · Skip POS swipe</text>
  <text x="1038" y="242" font-family="Helvetica, Arial, sans-serif" font-size="12.5" fill="#4B525C">Physical card not required at desk</text>

  <!-- 3 Official Portals Table (matching IL_lounge_one.heic reference cleanly) -->
  <rect x="28" y="286" width="420" height="390" rx="12" fill="#FFFFFF" stroke="#D1D5DB"/>
  <rect x="28" y="286" width="420" height="58" rx="12" fill="#0F5C4D"/>
  <rect x="28" y="330" width="420" height="14" fill="#0F5C4D"/>
  <text x="48" y="314" font-family="Helvetica, Arial, sans-serif" font-size="16" font-weight="bold" fill="#FFFFFF">1. LoungeOne (Adani Digital)</text>
  <text x="48" y="334" font-family="Helvetica, Arial, sans-serif" font-size="12.5" fill="#D1FAE5">https://www.loungeone.ai</text>
  <text x="48" y="374" font-family="Helvetica, Arial, sans-serif" font-size="13.5" font-weight="bold" fill="#1A1D21">Covered Airports:</text>
  <text x="48" y="400" font-family="Helvetica, Arial, sans-serif" font-size="13.5" fill="#2E333B">• Ahmedabad (AMD) · Mumbai T2 (BOM)</text>
  <text x="48" y="424" font-family="Helvetica, Arial, sans-serif" font-size="13.5" fill="#2E333B">• Navi Mumbai (NMI) · Bengaluru T1/T2 (BLR)</text>
  <text x="48" y="448" font-family="Helvetica, Arial, sans-serif" font-size="13.5" fill="#2E333B">• Jaipur (JAI) · Lucknow (LKO) · Nagpur (NAG)</text>
  <text x="48" y="472" font-family="Helvetica, Arial, sans-serif" font-size="13.5" fill="#2E333B">• Thiruvananthapuram (TRV) · Guwahati (GAU)</text>
  <text x="48" y="496" font-family="Helvetica, Arial, sans-serif" font-size="13.5" fill="#2E333B">• Amritsar (ATQ) · Coimbatore (CJB)</text>
  <text x="48" y="520" font-family="Helvetica, Arial, sans-serif" font-size="13.5" fill="#2E333B">• Gwalior · Jammu · Ranchi · Srinagar · Vadodara</text>
  <text x="48" y="566" font-family="Helvetica, Arial, sans-serif" font-size="12" font-weight="bold" fill="#0F5C4D">Accepts: Visa, Mastercard &amp; RuPay Online QR</text>
  <text x="48" y="590" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="#4B525C">Hold charge ₹2 (Visa/MC) or ₹25 — auto-reversed</text>

  <rect x="470" y="286" width="420" height="390" rx="12" fill="#FFFFFF" stroke="#D1D5DB"/>
  <rect x="470" y="286" width="420" height="58" rx="12" fill="#1D4ED8"/>
  <rect x="470" y="330" width="420" height="14" fill="#1D4ED8"/>
  <text x="490" y="314" font-family="Helvetica, Arial, sans-serif" font-size="16" font-weight="bold" fill="#FFFFFF">2. Travel Food Services (TFS)</text>
  <text x="490" y="334" font-family="Helvetica, Arial, sans-serif" font-size="12.5" fill="#DBEAFE">loungeaccess.travelfoodservices.com</text>
  <text x="490" y="374" font-family="Helvetica, Arial, sans-serif" font-size="13.5" font-weight="bold" fill="#1A1D21">Covered Airports:</text>
  <text x="490" y="400" font-family="Helvetica, Arial, sans-serif" font-size="13.5" fill="#2E333B">• Mumbai T1 (BOM) · Bengaluru T1 (BLR)</text>
  <text x="490" y="424" font-family="Helvetica, Arial, sans-serif" font-size="13.5" fill="#2E333B">• Chennai T1 &amp; T4 (MAA) · Kolkata (CCU)</text>
  <text x="490" y="448" font-family="Helvetica, Arial, sans-serif" font-size="13.5" fill="#2E333B">• Kochi (COK) · Goa Dabolim (GOI) · Kannur</text>
  <text x="490" y="472" font-family="Helvetica, Arial, sans-serif" font-size="13.5" fill="#2E333B">• Bhubaneswar · Bhopal · Indore · Varanasi</text>
  <text x="490" y="496" font-family="Helvetica, Arial, sans-serif" font-size="13.5" fill="#2E333B">• Ayodhya · Prayagraj · Bagdogra · Dehradun</text>
  <text x="490" y="520" font-family="Helvetica, Arial, sans-serif" font-size="13.5" fill="#2E333B">• Patna · Noida Intl (DXN) · Tiruchirappalli</text>
  <text x="490" y="566" font-family="Helvetica, Arial, sans-serif" font-size="12" font-weight="bold" fill="#1D4ED8">Best For: Checking Spend Criteria Pre-Flight</text>
  <text x="490" y="590" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="#4B525C">Travel Club &amp; Earth Lounge QR instant validation</text>

  <rect x="912" y="286" width="420" height="390" rx="12" fill="#FFFFFF" stroke="#D1D5DB"/>
  <rect x="912" y="286" width="420" height="58" rx="12" fill="#4A515E"/>
  <rect x="912" y="330" width="420" height="14" fill="#4A515E"/>
  <text x="932" y="314" font-family="Helvetica, Arial, sans-serif" font-size="16" font-weight="bold" fill="#FFFFFF">3. HOI Lounge Pass (GMR / Encalm)</text>
  <text x="932" y="334" font-family="Helvetica, Arial, sans-serif" font-size="12.5" fill="#E5E7EB">https://www.lms.hoi.in</text>
  <text x="932" y="374" font-family="Helvetica, Arial, sans-serif" font-size="13.5" font-weight="bold" fill="#1A1D21">Covered Airports:</text>
  <text x="932" y="400" font-family="Helvetica, Arial, sans-serif" font-size="13.5" fill="#2E333B">• Delhi T1, T2 &amp; T3 Encalm (DEL)</text>
  <text x="932" y="424" font-family="Helvetica, Arial, sans-serif" font-size="13.5" fill="#2E333B">• Hyderabad RGIA Encalm (HYD)</text>
  <text x="932" y="448" font-family="Helvetica, Arial, sans-serif" font-size="13.5" fill="#2E333B">• Goa Mopa (GOX) · Pune (PNQ) · Chandigarh</text>
  <text x="932" y="472" font-family="Helvetica, Arial, sans-serif" font-size="13.5" fill="#2E333B">• Amritsar (ATQ) · Vadodara · Dehradun · Kochi</text>
  <text x="932" y="496" font-family="Helvetica, Arial, sans-serif" font-size="13.5" fill="#2E333B">• Agartala · Madurai · Dibrugarh</text>
  <text x="932" y="566" font-family="Helvetica, Arial, sans-serif" font-size="12" font-weight="bold" fill="#1A1D21">Golf Bookings (Separate):</text>
  <text x="932" y="590" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="#4B525C">RuPay Select: rupayselect.truztee.com</text>
  <text x="932" y="612" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="#4B525C">Mastercard India Golf Desk: 1800-102-6263</text>

  <text x="32" y="712" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="#717882">Tip: Priority Pass Digital App (Infinia, DCB Metal, Emeralde Metal, Axis Reserve, Marquee) + Scapia App + Axis Open work 100% cardless</text>
</svg>`;
  const out = path.join(OUT_DIR, "lounge-claim-guide.png");
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true }).toFile(out);
  return out;
}

async function main() {
  for (const spec of POSTER_SPECS) {
    const file = await generatePoster(spec);
    const sz = Math.round(fs.statSync(file).size / 1024);
    console.log(`Generated ${path.basename(file)} (${sz} KB)`);
  }
  const lg = await generateLoungeClaimPoster();
  console.log(`Generated ${path.basename(lg)} (${Math.round(fs.statSync(lg).size / 1024)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
