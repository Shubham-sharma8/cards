export interface ReplacementCardLink {
  cardId: string;
  cardName: string;
  bankSlug: string;
  cardSlug: string;
  tierLabel: string;
  highlight: string;
}

export interface DiscontinuedNoticeInfo {
  badgeLabel: string;
  title: string;
  summary: string;
  replacements: ReplacementCardLink[];
}

export function isCardDiscontinuedForNewApplicants(input: {
  card_id?: string | null;
  status?: string | null;
}): boolean {
  if (input.card_id === "hdfc_bank_swiggy_credit_card") return true;
  const s = (input.status || "").toLowerCase();
  return s.includes("discontinued") || s.includes("closed");
}

const SWIGGY_REPLACEMENT_INFO: DiscontinuedNoticeInfo = {
  badgeLabel: "New Apps Closed · Ornge / BLCK",
  title: "Discontinued for New Applicants — Replaced by Swiggy Ornge & Swiggy BLCK",
  summary:
    "HDFC Bank closed fresh applications for the standard Swiggy HDFC Bank Credit Card and now offers new applicants two tiered variants: Swiggy Ornge (₹500/yr) and Swiggy BLCK (₹1,000/yr). We keep this legacy card in the database so existing cardholders can still check live offers, compare returns, and track rewards in Calculator & My Cards.",
  replacements: [
    {
      cardId: "hdfc_bank_swiggy_ornge_hdfc_credit_card",
      cardName: "Swiggy Ornge HDFC Bank Credit Card",
      bankSlug: "hdfc-bank",
      cardSlug: "swiggy-ornge-hdfc-bank-credit-card",
      tierLabel: "₹500/yr · Entry Tier",
      highlight: "5% on Swiggy & select online · 1% other spends",
    },
    {
      cardId: "hdfc_bank_swiggy_blck_hdfc_credit_card",
      cardName: "Swiggy BLCK HDFC Bank Credit Card",
      bankSlug: "hdfc-bank",
      cardSlug: "swiggy-blck-hdfc-bank-credit-card",
      tierLabel: "₹1,000/yr · Higher Tier",
      highlight: "10% Swiggy Food/Instamart/Dineout + 5% Amazon/Flipkart/Myntra",
    },
  ],
};

export function getDiscontinuedNotice(input: {
  card_id?: string | null;
  status?: string | null;
}): DiscontinuedNoticeInfo | null {
  if (input.card_id === "hdfc_bank_swiggy_credit_card") {
    return SWIGGY_REPLACEMENT_INFO;
  }
  if (isCardDiscontinuedForNewApplicants(input)) {
    return {
      badgeLabel: "New Apps Closed",
      title: "Discontinued for New Applicants",
      summary:
        "This card is no longer open for fresh applications. Retained in our database so existing cardholders can compute rewards, compare fees, and track My Cards.",
      replacements: [],
    };
  }
  return null;
}
