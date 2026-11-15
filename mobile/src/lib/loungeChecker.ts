import type {
  CardSummaryItem,
  LoungeAccessMasterPayload,
  ParticipatingAirportLoungeSpot,
} from "./types";

export interface AirportDirectoryItem {
  airportCode: string;
  city: string;
  totalSpots: number;
  domesticCount: number;
  internationalCount: number;
  topRating: number | null;
  loungeNames: string[];
}

export interface QualifyingOwnedCardInfo {
  card: CardSummaryItem;
  matchedNetwork: string;
  accessType: "no_spend" | "spend_gated";
  quotaSummary: string;
  spendCondition: string | null;
}

export interface BlockedOwnedCardInfo {
  card: CardSummaryItem;
  reason: string;
}

export interface AirportClaimPortal {
  id: "loungeone" | "tfs" | "hoi" | "priority_pass";
  name: string;
  url: string;
  domain: string;
  operatorNote: string;
  cardlessHowTo: string;
}

export interface BestLoungeBadge {
  label: string;
  reason: string;
}

export interface AirportSpotEvaluation {
  spot: ParticipatingAirportLoungeSpot;
  verdict: "accessible_no_spend" | "spend_gated" | "not_covered";
  noSpendCards: QualifyingOwnedCardInfo[];
  spendGatedCards: QualifyingOwnedCardInfo[];
  blockedCards: BlockedOwnedCardInfo[];
  bestLoungeBadge: BestLoungeBadge | null;
  claimPortals: AirportClaimPortal[];
}

export interface AirportAccessReport {
  airportCode: string;
  city: string;
  totalSpots: number;
  accessibleNoSpendCount: number;
  spendGatedCount: number;
  notCoveredCount: number;
  spotEvaluations: AirportSpotEvaluation[];
  claimPortals: AirportClaimPortal[];
  bestTerminalTip: string | null;
}

export const PORTAL_CATALOG: Record<AirportClaimPortal["id"], AirportClaimPortal> = {
  loungeone: {
    id: "loungeone",
    name: "LoungeOne",
    url: "https://www.loungeone.ai",
    domain: "www.loungeone.ai",
    operatorNote: "Adani Digital Labs QR portal for Visa, Mastercard & RuPay cards",
    cardlessHowTo:
      "Save card details once (CVV + OTP) -> pay ₹2/₹25 hold -> show generated QR + boarding pass at reception (no physical card swipe needed).",
  },
  tfs: {
    id: "tfs",
    name: "TFS Lounge Access",
    url: "https://www.loungeaccess.travelfoodservices.com",
    domain: "www.loungeaccess.travelfoodservices.com",
    operatorNote: "Travel Food Services / Travel Club online eligibility & QR pass",
    cardlessHowTo:
      "Log in with OTP -> verify quarterly spend criteria -> generate digital Travel Club QR pass prior to arrival.",
  },
  hoi: {
    id: "hoi",
    name: "HOI Lounge Pass",
    url: "https://www.lms.hoi.in",
    domain: "www.lms.hoi.in",
    operatorNote: "HOI (GMR / Encalm & partner hubs) online QR & pre-booking portal",
    cardlessHowTo:
      "Verify card on lms.hoi.in or HOI app -> confirm ₹2 token auth -> scan dynamic QR directly at Encalm/Primus desk.",
  },
  priority_pass: {
    id: "priority_pass",
    name: "Priority Pass / Bank App",
    url: "https://www.prioritypass.com",
    domain: "prioritypass.com",
    operatorNote: "Digital membership card in Priority Pass, Amex, Scapia & Axis Open apps",
    cardlessHowTo:
      "Open Priority Pass digital barcode or bank app QR (Infinia/DCB SmartBuy, Scapia, Axis Open) — works fully cardless.",
  },
};

const LOUNGEONE_AIRPORTS = new Set([
  "AMD", "JAI", "LKO", "BOM", "NMI", "NAG", "TRV", "GAU", "BLR", "ATQ", "GWL", "IXJ", "IXR", "SXR", "VOX", "CJB",
]);
const TFS_AIRPORTS = new Set([
  "AYJ", "COK", "IXD", "IXB", "CCU", "BLR", "BHO", "IDR", "BBI", "CNN", "MAA", "GOI", "DED", "PAT", "VNS", "DXN", "TRZ", "BOM",
]);
const HOI_AIRPORTS = new Set([
  "ATQ", "DEL", "HYD", "GOX", "BDQ", "DED", "COK", "IXA", "IXC", "IXM", "PNQ", "DIB",
]);

const BEST_LOUNGE_MAP: Record<string, BestLoungeBadge> = {
  DEL_PRIVE_T3I: { label: "Best at T3 Int'l", reason: "Flagship ultra-quiet suites, champagne bar, showers & à-la-carte dining." },
  DEL_AMEX_T3: { label: "Best at T3 Dom", reason: "Amex Centurion curated hot kitchen; skips the main T3 crowd." },
  DEL03: { label: "Best Open-Network T3D", reason: "Largest domestic Encalm buffet & spa seating for Visa/MC/RuPay." },
  DEL01: { label: "Best at T1", reason: "Primary airside T1 departure lounge." },
  DEL02: { label: "Best at T2", reason: "Primary airside T2 departure lounge." },
  BOM_PRIVE_T2I: { label: "Best at T2 Int'l", reason: "Flagship Adani Business / Privé suites, live culinary bar & showers." },
  BOM_T2I: { label: "Adani T2 Int'l", reason: "Spacious Adani T2 International lounge with showers & warm buffet." },
  BOM_T2D: { label: "Best at T2 Dom", reason: "Modern Adani T2 Domestic lounge; calmer than T1 lounges." },
  BOM04: { label: "T2 Dom Travel Club", reason: "Fast-moving T2 Travel Club alternative near Gate 44 Post SHA." },
  BOM_AMEX_T2: { label: "Amex T2 Lounge", reason: "Exclusive American Express International lounge at CSMIA T2." },
  BOM01: { label: "Best at T1 (T1C)", reason: "Larger TFS hot food spread than T1B Adani / Good Times." },
  BLR9: { label: "Best at T2 Dom", reason: "Award-winning 080 garden-pavilion lounge with barista coffee & craft dining." },
  BLR_PRIVE_T2: { label: "Best VIP at BLR T2", reason: "Exclusive 080 VIP / Privé wing at Terminal 2." },
  BLR10: { label: "Best at T2 Int'l", reason: "Flagship 080 International lounge with showers & quiet zones." },
  BLR104: { label: "Best at T1 (East)", reason: "Often less queued than West PH1/PH2 during morning peaks." },
  HYD_PRIVE_I: { label: "Best at HYD Int'l", reason: "4.9★ Encalm Privé International with fine dining & private pods." },
  HYD02: { label: "Encalm T1 Int'l", reason: "24x7 Encalm International with full hot meals & bar." },
  HYD01: { label: "Best Domestic Lounge", reason: "Flagship Encalm T1 Domestic with quick QR lane via HOI." },
  MAA04: { label: "Best at MAA T4", reason: "Newer Travel Club T4 space; quieter than older T1 lounges." },
  MAA02: { label: "Best Int'l Lounge", reason: "Dedicated Travel Club International wing at Chennai." },
  CCU01: { label: "Best Domestic Lounge", reason: "Main Travel Club Domestic has a wider buffet than the Annex." },
  CCU02: { label: "Best Int'l Lounge", reason: "Main Travel Club International near main gates." },
  AMD02: { label: "Best Int'l Lounge", reason: "Adani Silver Lounge near Gate 8." },
  AMD04: { label: "Best T2 Domestic", reason: "Newer T2 Adani Lounge layout." },
  ATQ6: { label: "Best Int'l Lounge", reason: "Full Airr Lounge seating (far better than Costa Coffee F&B voucher)." },
  ATQ: { label: "Best Domestic Lounge", reason: "Full Primus Lounge (prefer over Costa Coffee F&B counters)." },
  NAG5: { label: "Best at Nagpur", reason: "The Airr Lounge Domestic near main gates." },
  GOX02: { label: "Best at Mopa (Dom)", reason: "Encalm T1 Domestic with HOI fast-track QR." },
  GOI01: { label: "Best at Dabolim", reason: "Travel Club Domestic inside Dabolim Terminal." },
};

const AIRPORT_TERMINAL_TIPS: Record<string, string> = {
  DEL: "At T3 International, Encalm Privé edges out regular Encalm; at T3 Domestic, Amex Centurion (Plat Charge) is calmest while Encalm T3D accepts all networks via lms.hoi.in QR.",
  BOM: "T2 houses Mumbai's superior Adani Lounge (claim online at loungeone.ai). T1 flyers: T1C Travel Club (via TFS portal) has better dining than T1B.",
  BLR: "Terminal 2's 080 Lounge is far more spacious than Terminal 1. Both LoungeOne and TFS QR portals work for BLR pre-generation.",
  HYD: "Encalm Domestic & International accept online QR pre-generation at lms.hoi.in so you skip reception queues.",
  MAA: "Prefer T4 Travel Club over T1 Lounges A/B whenever your gate permits; use TFS online portal before reaching the desk.",
  CCU: "Choose the main Travel Club Domestic/International before the Annex for full seating and hot food.",
};

export function getAirportClaimPortals(airportCode: string): AirportClaimPortal[] {
  const code = airportCode.toUpperCase();
  const portals: AirportClaimPortal[] = [];
  if (LOUNGEONE_AIRPORTS.has(code)) portals.push(PORTAL_CATALOG.loungeone);
  if (TFS_AIRPORTS.has(code)) portals.push(PORTAL_CATALOG.tfs);
  if (HOI_AIRPORTS.has(code)) portals.push(PORTAL_CATALOG.hoi);
  if (portals.length === 0) portals.push(PORTAL_CATALOG.loungeone, PORTAL_CATALOG.hoi);
  return portals;
}

export interface PortalLoungeMappingItem {
  portal: AirportClaimPortal;
  operators: string;
  airports: string[];
  loungeExamples: string;
  acceptedCards: string;
}

export function getPortalLoungeMappings(): PortalLoungeMappingItem[] {
  return [
    {
      portal: PORTAL_CATALOG.hoi,
      operators: "Encalm, Encalm Privé & Primus (GMR Hubs)",
      airports: Array.from(HOI_AIRPORTS),
      loungeExamples: "Delhi (DEL T1/T2/T3), Hyderabad (HYD), Goa Mopa (GOX), Pune (PNQ), Chandigarh (IXC), Kochi (COK)",
      acceptedCards: "Visa, Mastercard & RuPay domestic cards (₹2 OTP auth -> instant QR)",
    },
    {
      portal: PORTAL_CATALOG.loungeone,
      operators: "Adani Digital Labs, 080 Bangalore & Partner Lounges",
      airports: Array.from(LOUNGEONE_AIRPORTS),
      loungeExamples: "Mumbai (BOM T1B/T2 Adani), Bengaluru (BLR 080 T1/T2), Ahmedabad (AMD), Jaipur (JAI), Lucknow (LKO), Guwahati (GAU), Trivandrum (TRV), Nagpur (NAG)",
      acceptedCards: "Visa, Mastercard & RuPay domestic cards (₹2/₹25 hold auth -> instant QR)",
    },
    {
      portal: PORTAL_CATALOG.tfs,
      operators: "Travel Club / Travel Food Services (TFS)",
      airports: Array.from(TFS_AIRPORTS),
      loungeExamples: "Chennai (MAA T1/T4), Kolkata (CCU), Mumbai (BOM T1C & T2 Gate 44), Bengaluru (BLR Travel Club), Goa Dabolim (GOI), Bhubaneswar (BBI), Coimbatore (CJB)",
      acceptedCards: "Visa, Mastercard & RuPay cards — checks quarterly spend balance live",
    },
    {
      portal: PORTAL_CATALOG.priority_pass,
      operators: "International Concourses & Bank App QR",
      airports: ["INT'L", "DEL", "BOM", "BLR", "HYD", "MAA", "CCU", "COK"],
      loungeExamples: "International departures globally + Encalm Privé / Adani Int'l / 080 Int'l (plus SmartBuy / Axis Open / Scapia QR)",
      acceptedCards: "Priority Pass membership, Infinia, Emeralde Private, Burgundy Private, Amex Platinum, Scapia",
    },
  ];
}

/** Condenses verbose lounge quota strings into a scannable 1-line summary. */
export function getShortQuotaLabel(summary: string): string {
  const s = (summary || "").trim();
  if (!s) return "Complimentary visits";
  if (/unlimited/i.test(s)) return "Unlimited free";
  const m = s.match(/(\d+)\s*(?:complimentary\s*)?(?:domestic|international|airport)?\s*(?:lounge|visits?)[^\d]*(?:per|\/)\s*(month|quarter|qtr|6\s*months|half[- ]?year|year|annum|calendar\s*year)/i);
  if (m) {
    const unit = /month/i.test(m[2])
      ? "mo"
      : /quarter|qtr/i.test(m[2])
        ? "qtr"
        : /6\s*months|half/i.test(m[2])
          ? "6 mo"
          : "yr";
    return `${m[1]} visit${m[1] === "1" ? "" : "s"}/${unit}`;
  }
  const simple = s.match(/(\d+)\s*(?:complimentary\s*)?(?:visits?|lounges?)/i);
  if (simple) return `${simple[1]} visits included`;
  const clean = s.split(/[·(;]/)[0].trim();
  return clean.length > 36 ? `${clean.slice(0, 34).trim()}…` : clean;
}

/** Condenses spend requirement strings into a short badge-ready condition. */
export function getShortSpendLabel(cond: string | null): string {
  if (!cond) return "Quarterly spend applies";
  const m = cond.match(/(?:rs\.?|₹)\s*([\d,]+(?:\s*k|\s*lakh)?)/i);
  const per = /billing\s*cycle|month/i.test(cond)
    ? "/cycle"
    : /quarter|calendar/i.test(cond)
      ? "/qtr"
      : /year|annual/i.test(cond)
        ? "/yr"
        : "";
  if (m) {
    const amt = m[1].replace(/\s+/g, "").replace(/000$/, "k");
    return `Spend ₹${amt}${per}`;
  }
  const firstClause = cond.split(/[·(;]/)[0].trim();
  return firstClause.length > 34 ? `${firstClause.slice(0, 32).trim()}…` : firstClause;
}

export function getOnlineCardlessStatus(card: CardSummaryItem): {
  mode: "digital_app" | "online_qr" | "physical_preferred";
  badge: string;
  detail: string;
} {
  const hay = `${card.card_name} ${card.bank} ${card.domestic_lounge_summary || ""} ${card.international_lounge_summary || ""}`.toLowerCase();
  const net = (card.card_network || "").toLowerCase();
  if (/priority pass|amex|american express|scapia|infinia|diners club black|emeralde private|burgundy|marquee|aurum/.test(hay)) {
    return {
      mode: "digital_app",
      badge: "App / Cardless QR",
      detail: "Priority Pass app / Bank app (SmartBuy, Axis Open, Scapia) OR LoungeOne/HOI/TFS web QR works without physical swipe.",
    };
  }
  if (/visa|master|rupay/.test(net)) {
    return {
      mode: "online_qr",
      badge: "Portal QR Ready",
      detail: "Link card on loungeone.ai, TFS, or lms.hoi.in once to generate an instant QR pass (show QR + boarding pass at desk).",
    };
  }
  return {
    mode: "physical_preferred",
    badge: "Check App / Desk",
    detail: "Link on issuer app or carry physical card as backup.",
  };
}

const MAJOR_HUB_ORDER = [
  "DEL",
  "BOM",
  "BLR",
  "HYD",
  "MAA",
  "CCU",
  "AMD",
  "PNQ",
  "COK",
  "GOI",
  "ATQ",
  "JAI",
];

function extractCardNetworks(card: CardSummaryItem): string[] {
  const raw = card.card_network || "";
  const nets: string[] = [];
  if (/visa/i.test(raw)) nets.push("Visa");
  if (/master/i.test(raw)) nets.push("Mastercard");
  if (/rupay/i.test(raw)) nets.push("RuPay");
  if (/diners/i.test(raw)) nets.push("Diners Club");
  if (/amex|american express/i.test(raw) || /american express/i.test(card.bank)) {
    nets.push("Amex");
  }
  if (
    card.filter_tags.has_international_lounge &&
    /priority pass/i.test(card.international_lounge_summary || "")
  ) {
    nets.push("Priority Pass");
  }
  return Array.from(new Set(nets));
}

export function getAirportDirectory(
  master: LoungeAccessMasterPayload
): AirportDirectoryItem[] {
  const byCode = new Map<string, AirportDirectoryItem>();
  for (const spot of master.participating_indian_airport_lounges || []) {
    const existing = byCode.get(spot.airport_code);
    const isIntl = /international/i.test(spot.terminal_type);
    const rt = typeof spot.google_rating === 'number' ? spot.google_rating : null;
    if (existing) {
      existing.totalSpots += 1;
      if (isIntl) existing.internationalCount += 1;
      else existing.domesticCount += 1;
      if (rt !== null && (existing.topRating === null || rt > existing.topRating)) {
        existing.topRating = rt;
      }
      if (!existing.loungeNames.includes(spot.lounge_name)) {
        existing.loungeNames.push(spot.lounge_name);
      }
    } else {
      byCode.set(spot.airport_code, {
        airportCode: spot.airport_code,
        city: spot.city,
        totalSpots: 1,
        domesticCount: isIntl ? 0 : 1,
        internationalCount: isIntl ? 1 : 0,
        topRating: rt,
        loungeNames: [spot.lounge_name],
      });
    }
  }

  return Array.from(byCode.values()).sort((a, b) => {
    const ia = MAJOR_HUB_ORDER.indexOf(a.airportCode);
    const ib = MAJOR_HUB_ORDER.indexOf(b.airportCode);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.city.localeCompare(b.city);
  });
}

export function evaluateAirportForOwnedCards(
  airportCode: string,
  master: LoungeAccessMasterPayload,
  ownedCards: CardSummaryItem[]
): AirportAccessReport {
  const spots = (master.participating_indian_airport_lounges || []).filter(
    (s) => s.airport_code.toUpperCase() === airportCode.toUpperCase()
  );

  const city = spots[0]?.city ?? airportCode;
  const spotEvaluations: AirportSpotEvaluation[] = spots.map((spot) => {
    const isIntl = /international/i.test(spot.terminal_type);
    const noSpendCards: QualifyingOwnedCardInfo[] = [];
    const spendGatedCards: QualifyingOwnedCardInfo[] = [];
    const blockedCards: BlockedOwnedCardInfo[] = [];

    for (const card of ownedCards) {
      const hasRight = isIntl
        ? card.filter_tags.has_international_lounge
        : card.filter_tags.has_domestic_lounge;

      if (!hasRight) {
        blockedCards.push({
          card,
          reason: isIntl
            ? "No international / Priority Pass lounge access"
            : "0 complimentary domestic airport lounge visits",
        });
        continue;
      }

      const cardNets = extractCardNetworks(card);
      const matchedNet = cardNets.find((n) =>
        spot.accepted_networks.some((an) => an.toLowerCase() === n.toLowerCase())
      );

      if (!matchedNet) {
        blockedCards.push({
          card,
          reason: `Requires ${spot.accepted_networks.join(" / ")} network (card is ${card.card_network || "other"})`,
        });
        continue;
      }

      if (spot.lounge_code === "DEL_AMEX_T3") {
        const isPlatOrCenturion =
          /platinum card|centurion/i.test(card.card_name) ||
          card.card_id.includes("platinum_card") ||
          card.annual_fee_inr >= 50000;
        if (!isPlatOrCenturion) {
          blockedCards.push({
            card,
            reason: "Amex Centurion Lounge T3D requires Amex Platinum Charge or Centurion Card",
          });
          continue;
        }
      }

      if (spot.lounge_code === "DEL_PRIVE_T3I") {
        const isSuperPremium =
          card.annual_fee_inr >= 5000 ||
          /super-?premium|infinia|emeralde|magnus|burgundy|reserve|diners club black/i.test(
            `${card.card_name} ${card.card_tier}`
          );
        if (!isSuperPremium && matchedNet !== "Priority Pass") {
          blockedCards.push({
            card,
            reason: "Encalm Privé T3I normally requires Priority Pass or super-premium tier",
          });
          continue;
        }
      }

      const spendCond = card.lounge_spend_condition ?? null;
      const condLower = (spendCond || "").toLowerCase();
      const condExplicitNoSpend =
        (condLower.includes("no spend") || condLower.includes("zero spend")) &&
        !/\b(?:rs\.?|₹)\s*[\d,]+/i.test(condLower);
      const isNoSpend = isIntl
        ? !(
            spendCond &&
            /\d|quarterly|spend/i.test(spendCond) &&
            !condExplicitNoSpend
          )
        : Boolean(
            card.filter_tags.no_spend_domestic_lounge || condExplicitNoSpend
          );

      const quotaSummary = isIntl
        ? card.international_lounge_summary || "Complimentary international visits"
        : card.domestic_lounge_summary || "Complimentary domestic visits";

      if (isNoSpend) {
        noSpendCards.push({
          card,
          matchedNetwork: matchedNet,
          accessType: "no_spend",
          quotaSummary,
          spendCondition: null,
        });
      } else {
        spendGatedCards.push({
          card,
          matchedNetwork: matchedNet,
          accessType: "spend_gated",
          quotaSummary,
          spendCondition: spendCond || "Quarterly spend threshold applies",
        });
      }
    }

    const verdict: AirportSpotEvaluation["verdict"] =
      noSpendCards.length > 0
        ? "accessible_no_spend"
        : spendGatedCards.length > 0
          ? "spend_gated"
          : "not_covered";

    return {
      spot,
      verdict,
      noSpendCards,
      spendGatedCards,
      blockedCards,
      bestLoungeBadge: BEST_LOUNGE_MAP[spot.lounge_code] ?? null,
      claimPortals: getAirportClaimPortals(airportCode),
    };
  });

  spotEvaluations.sort((a, b) => {
    const ab = a.bestLoungeBadge ? 1 : 0;
    const bb = b.bestLoungeBadge ? 1 : 0;
    return bb - ab;
  });

  const codeUpper = airportCode.toUpperCase();
  return {
    airportCode: codeUpper,
    city,
    totalSpots: spots.length,
    accessibleNoSpendCount: spotEvaluations.filter((e) => e.verdict === "accessible_no_spend").length,
    spendGatedCount: spotEvaluations.filter((e) => e.verdict === "spend_gated").length,
    notCoveredCount: spotEvaluations.filter((e) => e.verdict === "not_covered").length,
    spotEvaluations,
    claimPortals: getAirportClaimPortals(codeUpper),
    bestTerminalTip: AIRPORT_TERMINAL_TIPS[codeUpper] ?? null,
  };
}

export interface CardLoungeAndGolfQuota {
  domesticTotal: number | null; // null => Unlimited when domesticEligible is true
  domesticPeriod: "quarter" | "6 months" | "year" | "unlimited" | "none";
  domesticEligible: boolean;
  domesticText: string;
  intlTotal: number | null;
  intlPeriod: "quarter" | "year" | "unlimited" | "none";
  intlEligible: boolean;
  intlText: string;
  golfEligible: boolean;
  golfGamesTotal: number | null;
  golfGamesPeriod: "month" | "quarter" | "year" | "unlimited" | "none";
  golfLessonsTotal: number | null;
  golfLessonsPeriod: "month" | "quarter" | "year" | "unlimited" | "none";
  golfSummaryText: string;
  noSpendDomestic: boolean;
  spendConditionText: string | null;
}

function parseQuotaFromSummary(
  text: string | null | undefined,
  flagEnabled: boolean
): { eligible: boolean; total: number | null; period: "quarter" | "6 months" | "year" | "unlimited" | "none" } {
  const s = (text || "").trim();
  const lower = s.toLowerCase();
  if (!flagEnabled && (!s || /\b(none|no lounge|not included|nil|n\/a)\b/i.test(lower))) {
    return { eligible: false, total: 0, period: "none" };
  }
  if (/\bunlimited\b/i.test(lower)) {
    return { eligible: true, total: null, period: "unlimited" };
  }
  // Detect period
  const period: "quarter" | "6 months" | "year" | "unlimited" =
    /6\s*month|semi-?annual|half-?year/i.test(lower)
      ? "6 months"
      : /\b(per\s*quarter|\/\s*qtr|\bqtr\b|quarterly|calendar\s*quarter)\b/i.test(lower)
        ? "quarter"
        : /\b(per\s*year|\/\s*yr|\byr\b|annual|calendar\s*year|annum)\b/i.test(lower)
          ? "year"
          : "quarter";

  const m =
    s.match(/(\d+)\s*(?:complimentary\s*)?(?:domestic|international|lounge|visits?|access|passes?|free)?/i) ||
    s.match(/up\s*to\s*(\d+)/i);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0 && n <= 60) {
      return { eligible: true, total: n, period };
    }
  }
  if (flagEnabled) {
    return { eligible: true, total: 2, period: "quarter" };
  }
  return { eligible: false, total: 0, period: "none" };
}

function parseGolfCount(
  raw: string,
  unitPattern: string
): { total: number | null; period: "month" | "quarter" | "year" | "unlimited" | "none" } {
  if (!raw.trim()) return { total: null, period: "none" };
  const lower = raw.toLowerCase();
  if (new RegExp(`unlimited[^,;]*${unitPattern}|${unitPattern}[^,;]*unlimited`, "i").test(lower) || /\bunlimited\s+rounds?\s*(?:&|\/|and)\s*lessons?\b/i.test(lower)) {
    return { total: null, period: "unlimited" };
  }
  const period: "month" | "quarter" | "year" =
    /\b(per\s*month|\/\s*mo\b|monthly)\b/i.test(lower)
      ? "month"
      : /\b(per\s*quarter|\/\s*qtr\b|quarterly)\b/i.test(lower)
        ? "quarter"
        : "year";
  const regex = new RegExp(`(\\d+)\\s*(?:complimentary\\s*)?(?:green\\s*fee\\s*)?${unitPattern}`, "i");
  const m = raw.match(regex);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0 && n <= 100) {
      return { total: n, period };
    }
  }
  return { total: null, period: "none" };
}

/**
 * Extracts domestic lounge, international lounge, golf round & golf coaching quotas
 * from a CardSummaryItem for live My Cards utilization tracking.
 */
export function parseCardLoungeAndGolfQuotas(card: CardSummaryItem): CardLoungeAndGolfQuota {
  const t = card.filter_tags;
  const dom = parseQuotaFromSummary(card.domestic_lounge_summary, Boolean(t?.has_domestic_lounge));
  const intl = parseQuotaFromSummary(card.international_lounge_summary, Boolean(t?.has_international_lounge));

  const golfRaw = [
    card.golf_summary?.complimentary_access || "",
    card.golf_summary?.eligible_courses || "",
    card.golf_summary?.spend_condition || "",
  ]
    .filter(Boolean)
    .join(" · ");

  const golfEligible = Boolean(
    t?.has_golf || card.golf_summary?.has_golf || card.categories.includes("Golf")
  );

  let golfGamesTotal: number | null = 0;
  let golfGamesPeriod: CardLoungeAndGolfQuota["golfGamesPeriod"] = "none";
  let golfLessonsTotal: number | null = 0;
  let golfLessonsPeriod: CardLoungeAndGolfQuota["golfLessonsPeriod"] = "none";

  if (golfEligible) {
    const acc = card.golf_summary?.complimentary_access || "";
    const games = parseGolfCount(acc, "(?:games?|rounds?|green\\s*fees?|access|visits?)");
    const lessons = parseGolfCount(acc, "(?:lessons?|coaching)");
    const bothUnlimited = /\bunlimited\b/i.test(acc);

    if (bothUnlimited && games.period === "unlimited") {
      golfGamesTotal = null;
      golfGamesPeriod = "unlimited";
    } else if (games.period !== "none") {
      golfGamesTotal = games.total;
      golfGamesPeriod = games.period;
    } else {
      golfGamesTotal = bothUnlimited ? null : 4;
      golfGamesPeriod = bothUnlimited ? "unlimited" : "year";
    }

    if (lessons.period === "unlimited" || /\bunlimited\s+coaching\b/i.test(acc)) {
      golfLessonsTotal = null;
      golfLessonsPeriod = "unlimited";
    } else if (lessons.period !== "none") {
      golfLessonsTotal = lessons.total;
      golfLessonsPeriod = lessons.period;
    } else if (/games?\s*&\s*lessons?|rounds?\s*\/\s*lessons?/i.test(acc)) {
      golfLessonsTotal = golfGamesTotal;
      golfLessonsPeriod = golfGamesPeriod;
    }
  }

  return {
    domesticTotal: dom.total,
    domesticPeriod: dom.period,
    domesticEligible: dom.eligible,
    domesticText: card.domestic_lounge_summary || (dom.eligible ? "Included" : "No domestic lounge"),
    intlTotal: intl.total,
    intlPeriod: intl.period === "6 months" ? "year" : intl.period,
    intlEligible: intl.eligible,
    intlText: card.international_lounge_summary || (intl.eligible ? "Included" : "No international lounge"),
    golfEligible,
    golfGamesTotal,
    golfGamesPeriod,
    golfLessonsTotal,
    golfLessonsPeriod,
    golfSummaryText: card.golf_summary?.complimentary_access || (golfEligible ? "Golf access included" : "No golf"),
    noSpendDomestic: Boolean(t?.no_spend_domestic_lounge),
    spendConditionText: card.lounge_spend_condition || null,
  };
}

