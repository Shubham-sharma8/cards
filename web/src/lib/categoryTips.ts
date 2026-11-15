export interface CategoryProTip {
  title: string;
  detail: string;
  cards?: string[];
}

export const CATEGORY_PRO_TIPS: Record<string, CategoryProTip[]> = {
  insurance: [
    {
      title: "HSBC Live+ Zepto → Amazon Pay 10% Insurance Trick",
      detail:
        "Direct insurer MCCs earn 0% on HSBC Live+. Instead, buy Amazon Pay Gift Cards via Zepto (codes as Grocery MCC = 10% cashback up to ₹1,200/month across ₹12k spend), add to your Amazon Pay Wallet, and pay LIC/term/health insurance via Amazon Pay or Policybazaar.",
      cards: ["HSBC Live+"],
    },
    {
      title: "SBI Cashback Apay Gift Card Route (5% up to ₹2,000/mo)",
      detail:
        "Direct utility/insurance payments earn 0% on Cashback SBI. Buy Amazon Pay Gift Cards on Amazon.in for 5% cashback (Apr 2026 online cap ₹2,000/cycle = ₹40k spend), then settle policies via Amazon Pay.",
      cards: ["Cashback SBI Card"],
    },
    {
      title: "Tata Neu Infinity & PhonePe SBI In-App Routes",
      detail:
        "Pay via Tata Pay inside Tata Neu app for 5% NeuCoins (cap 2,000/month; net ~3.3% where ~1.7% fee applies) OR inside PhonePe app with PhonePe SBI Select Black for 10% RP (Jul 2026 sub-cap: 500 RP/month strictly for Insurance).",
      cards: ["Tata Neu Infinity HDFC", "PhonePe SBI Select Black"],
    },
  ],
  utilities: [
    {
      title: "Amazon Pay Gift Card Stack (5%–16.5%)",
      detail:
        "Load Amazon Pay Gift Cards via HDFC SmartBuy GyFTR (Infinia 5X ~12.3% net; note July 2026 3,000 Bonus RP/mo voucher sub-cap), HSBC Live+ on Zepto (10% up to ₹1,200/mo), or Cashback SBI on Amazon (5% up to ₹2,000/mo) before paying electricity, gas & FASTag bills.",
      cards: ["HDFC Infinia Metal", "HSBC Live+", "Cashback SBI Card"],
    },
    {
      title: "Airtel Axis Apr 2026 Proportional Rule",
      detail:
        "Airtel Thanks 25% recharge (₹250 cap) & 10% utility cashback (₹250 cap) require matching 1% retail spends after April 2026 — do not use it solely as a bill-pay card.",
      cards: ["Airtel Axis Bank"],
    },
  ],
  "dining-groceries": [
    {
      title: "Split Swiggy vs. Blinkit/Zepto Smartly",
      detail:
        "Swiggy HDFC earns 10% strictly on Swiggy Food/Instamart/Dineout (₹1,500/cycle cap). Use HSBC Live+ (10% up to ₹1,200/month) across Blinkit, Zepto, Zomato & offline dining restaurants.",
      cards: ["HSBC Live+", "Swiggy HDFC Bank"],
    },
    {
      title: "HSBC Live+ Grocery MCC Includes Zepto Vouchers",
      detail:
        "Buying eligible quick-commerce gift cards or groceries inside Zepto triggers HSBC Live+'s 10% grocery cap (max ₹12,000 spend/cycle across dining + groceries).",
      cards: ["HSBC Live+"],
    },
  ],
  dining: [
    {
      title: "Combine EazyDiner & Dineout App Discounts",
      detail:
        "Pay dine-out bills through Swiggy Dineout (Swiggy HDFC 10% cashback) or EazyDiner Prime (IndusInd EazyDiner Signature 25%–50% off) for layered savings on top of restaurant table discounts.",
      cards: ["Swiggy HDFC Bank", "IndusInd EazyDiner"],
    },
  ],
  groceries: [
    {
      title: "Max Out ₹12k Monthly Quick-Commerce Pool First",
      detail:
        "Spend the first ₹12,000/mo on Blinkit, Zepto & DMart via HSBC Live+ (₹1,200 back) and up to ₹15,000/mo on Swiggy Instamart via Swiggy HDFC (₹1,500 back) before falling back to 5%–10% Tata Neu BigBasket.",
      cards: ["HSBC Live+", "Swiggy HDFC Bank", "Tata Neu Infinity"],
    },
  ],
  cashback: [
    {
      title: "Pair Capped 10% / 5% Cards With Uncapped Amazon Pay ICICI",
      detail:
        "Exhaust high-rate capped cards first (HSBC Live+ ₹1,200/mo, Swiggy HDFC ₹1,500/mo, Cashback SBI ₹2,000/mo online cap effective Apr 2026), then route overflow online/Amazon orders to uncapped 5% Amazon Pay ICICI.",
      cards: ["Cashback SBI Card", "HSBC Live+", "Amazon Pay ICICI"],
    },
  ],
  "online-shopping": [
    {
      title: "Buy Brand Vouchers via Multiplier Portals First",
      detail:
        "On Infinia (SmartBuy GyFTR 5X), ICICI Emeralde Private (iShop 6X–12X), or Amex MRCC (Reward Multiplier 2X–3X), voucher checkout beats direct card swipe by 2X–4X.",
      cards: ["HDFC Infinia Metal", "ICICI Emeralde Private", "Cashback SBI Card"],
    },
  ],
  fuel: [
    {
      title: "Pay via HP Pay / IOCL XTRAREWARDS QR Over POS Swipe",
      detail:
        "On IDFC FIRST Power+, scan the HP Pay QR code inside the HP Pay App (~6.5% total savings including Happy Coins) rather than blind POS swipe; stay inside ₹10k–₹12k/month caps.",
      cards: ["IDFC FIRST Power+", "BPCL SBI Octane"],
    },
  ],
  "rupay-upi": [
    {
      title: "Native App QR Scan Unlocks Higher Rate",
      detail:
        "Tata Neu Infinity requires scanning inside Tata Neu App (1.5%, vs 0.5% on GPay/PhonePe). Kiwi YES Bank Neon unlocks 3%/4%/5% retroactively at ₹50k/₹1L/₹1.5L annual UPI milestones.",
      cards: ["YES Bank Kiwi", "Tata Neu Infinity", "Axis super.money"],
    },
  ],
  travel: [
    {
      title: "Compare Accor 1:2 Transfer Value Against Cash Portals",
      detail:
        "On Axis Atlas (1:2 to Group A Accor, 30,000 EDGE Miles/yr cap) & HDFC Infinia/DCB (SmartBuy Flights/Hotels ₹1/RP), travel redemptions deliver 2x–3x more value than statement cash credit.",
      cards: ["Axis Bank Atlas", "HDFC Infinia Metal", "HDFC Regalia Gold"],
    },
  ],
  lounge: [
    {
      title: "Pre-Generate QR & Verify 2026 Spend Gates Before Travel",
      detail:
        "Link your card once on LoungeOne.ai, travelFoodServices, or lms.hoi.in to generate an instant QR pass. Check 2026 quarterly spend gates (HDFC Regalia Gold / DCP ₹60k/qtr, Scapia ₹15k–₹20k/mo); Airtel Axis lounges were discontinued Apr 2026.",
      cards: ["HDFC Regalia Gold", "Federal Scapia", "AU ixigo"],
    },
    {
      title: "Railway Lounge & Boarding Edge Arrival Perks",
      detail:
        "Use IRCTC SBI Premier / IRCTC SBI Platinum for 8–4 complimentary IRCTC Executive Railway Lounge visits/year (₹2 auth), and unlock Regalia Gold Boarding Edge (2 free airport arrival perks/qtr).",
      cards: ["IRCTC SBI Premier", "HDFC Regalia Gold"],
    },
  ],
  forex: [
    {
      title: "Always Decline Dynamic Currency Conversion (DCC) Overseas",
      detail:
        "On abroad trips or USD SaaS tools, pay with 0% forex cards (Federal Scapia, AU ixigo, Uni GoldX) and always select the local foreign currency at POS/ATM — never INR.",
      cards: ["Federal Scapia", "AU ixigo", "HDFC Infinia (Global Value)"],
    },
  ],
  "super-premium": [
    {
      title: "Never Redeem Super-Premium Points for Statement Cash",
      detail:
        "Infinia, DCB Metal, Emeralde Private & Amex Platinum Travel drop 50%–70% in value when redeemed as cash credit — always convert via travel portals or 1:1 airline/hotel partners.",
      cards: ["HDFC Infinia Metal", "HDFC DCB Metal", "ICICI Emeralde Private"],
    },
  ],
  "business-tax": [
    {
      title: "Use Commercial Cards for GST & Advance Income Tax",
      detail:
        "Personal retail cards exclude Govt/Tax MCCs (9311/9399). HDFC BizBlack gives 5X (~16.5% value up to 7,500 RP/mo on ≥₹50k/cycle) on GST & Advance Tax via PayZapp/SmartPay; avoid triple-digit surcharge portals unless milestone-chasing.",
      cards: ["HDFC BizBlack Metal", "HDFC BizPower"],
    },
    {
      title: "Avoid 1% Education Surcharges via Direct School Apps",
      detail:
        "Since HDFC/Axis/ICICI add 1% fees on third-party education platforms (CRED/NoBroker) for MCC 8211/8220, pay directly on school/college portals with milestone cards (HDFC Infinia/DCB for milestone or SBI Vistara/Amex Plat Travel where eligible).",
      cards: ["HDFC Infinia Metal", "HDFC BizBlack Metal"],
    },
  ],
  golf: [
    {
      title: "Book 7–15 Days Ahead via Network Concierge",
      detail:
        "Most complimentary green-fee rounds & lessons require booking 4–14 days prior through Visa Infinite TeePass, Mastercard Concierge (1800-102-6263), or RuPay Truztee — walk-ins are billed full club rate.",
      cards: ["HDFC Infinia Metal", "HSBC Premier", "Swiggy HDFC Mastercard"],
    },
  ],
  ltf: [
    {
      title: "Stack Zero-Fee Backup Cards Without Fee Pressure",
      detail:
        "Combine an LTF 0% forex card (AU ixigo / Scapia) + LTF Amazon Pay ICICI + an LTF RuPay UPI card so idle months never cost ₹1,000+ in annual renewal fees.",
      cards: ["Amazon Pay ICICI", "Federal Scapia", "AU ixigo"],
    },
  ],
  "entry-fd": [
    {
      title: "Keep Utilization Below 30% for Rapid CIBIL Growth",
      detail:
        "Secured FD cards (IDFC FIRST WOW, Utkarsh SuperCard, Tata Neu FD) build score fastest when statement utilization stays under 20%–30% and auto-debit is enabled.",
      cards: ["IDFC FIRST WOW", "Utkarsh SuperCard"],
    },
  ],
  "gold-jewellery": [
    {
      title: "Use Uncapped Base Earners or Titan Co-Brand for Bullion",
      detail:
        "Verify MCC 5944/5094 exclusions before big wedding purchases: many cashback cards exclude jewellery, whereas ICICI Amazon Pay (1% unlimited), Infinia/DCB (3.3% base), and HDFC Tata Neu Plus/Infinity on Tanishq still reward it.",
      cards: ["HDFC Infinia Metal", "Tata Neu Infinity", "Amazon Pay ICICI"],
    },
  ],
};

export function getCategoryProTips(categoryId: string): CategoryProTip[] {
  return CATEGORY_PRO_TIPS[categoryId] || CATEGORY_PRO_TIPS.cashback || [];
}
