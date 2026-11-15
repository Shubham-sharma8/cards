import fs from "node:fs";
import path from "node:path";
import siteMeta from "./siteMeta.json";
import merchantDirectoryJson from "../../public/data/merchant-mcc-directory.json";
import type { MerchantDirectoryPayload } from "./merchants";
import type {
  AdvisorCardMeta,
  BanksIndexPayload,
  CardDossier,
  CardSummaryItem,
  CategoryStatsItem,
  DevaluationTrackerPayload,
  GolfClubsMasterPayload,
  LatestOffersPayload,
  LoungeAccessMasterPayload,
  LoungeCatalogPayload,
  RelatedCardFeatureRow,
  SearchIndexPayload,
} from "./types";
import { CATEGORY_META, formatLoungeQuota } from "./format";
import { isValidCardId, isValidSlug } from "./security";

const DATA_ROOT = path.resolve(process.cwd(), "..", "data");
const DEFAULT_R2_BASE = "https://pub-8a560aaca6404206b9adcd66799b1cee.r2.dev";

function getR2BaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim();
  return (envUrl && envUrl.length > 0 ? envUrl : DEFAULT_R2_BASE).replace(/\/+$/, "");
}

function hasLocalDataFs(): boolean {
  try {
    return fs.existsSync(path.join(DATA_ROOT, "master", "app_search_index.json"));
  } catch {
    return false;
  }
}

async function fetchR2Json<T>(relPath: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`${getR2BaseUrl()}/${relPath.replace(/^\/+/, "")}`, {
      signal: controller.signal,
      next: { revalidate: 3600 },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function getSiteCounts(): { totalCards: number; totalBanks: number } {
  if (hasLocalDataFs()) {
    return {
      totalCards: getAllCards().length,
      totalBanks: getBanksIndex().total_banks,
    };
  }
  return {
    totalCards: siteMeta.total_cards,
    totalBanks: siteMeta.total_banks,
  };
}

let cachedSearchIndex: SearchIndexPayload | null = null;
let cachedBanksIndex: BanksIndexPayload | null = null;
let cachedLoungeCatalog: LoungeCatalogPayload | null = null;
let cachedLoungeMaster: LoungeAccessMasterPayload | null = null;
let cachedGolfClubsMaster: GolfClubsMasterPayload | null = null;
let cachedDevaluationTracker: DevaluationTrackerPayload | null = null;
let cachedLatestOffers: LatestOffersPayload | null = null;

function readJsonFile<T>(relPath: string): T {
  const fullPath = path.join(DATA_ROOT, relPath);
  const raw = fs.readFileSync(fullPath, "utf-8");
  return JSON.parse(raw) as T;
}

export function getSearchIndex(): SearchIndexPayload {
  if (!cachedSearchIndex) {
    if (hasLocalDataFs()) {
      cachedSearchIndex = readJsonFile<SearchIndexPayload>("master/app_search_index.json");
    } else {
      return { total_cards: siteMeta.total_cards, cards: [] } as unknown as SearchIndexPayload;
    }
  }
  return cachedSearchIndex;
}

export async function getSearchIndexAsync(): Promise<SearchIndexPayload> {
  if (hasLocalDataFs()) return getSearchIndex();
  if (cachedSearchIndex) return cachedSearchIndex;
  const remote = await fetchR2Json<SearchIndexPayload>("meta/search_index.json");
  if (remote) {
    cachedSearchIndex = remote;
    return remote;
  }
  return { total_cards: siteMeta.total_cards, cards: [] } as unknown as SearchIndexPayload;
}

export function getAllCards(): CardSummaryItem[] {
  return getSearchIndex().cards;
}

export function getBanksIndex(): BanksIndexPayload {
  if (!cachedBanksIndex) {
    if (hasLocalDataFs()) {
      cachedBanksIndex = readJsonFile<BanksIndexPayload>("master/cards_by_bank_index.json");
    } else {
      return { total_banks: siteMeta.total_banks, banks: [] } as unknown as BanksIndexPayload;
    }
  }
  return cachedBanksIndex;
}

export function getLoungeCatalog(): LoungeCatalogPayload {
  if (!cachedLoungeCatalog) {
    cachedLoungeCatalog = readJsonFile<LoungeCatalogPayload>("master/lounge_programs_catalog.json");
  }
  return cachedLoungeCatalog;
}

export function getLoungeAccessMaster(): LoungeAccessMasterPayload {
  if (!cachedLoungeMaster) {
    if (hasLocalDataFs()) {
      cachedLoungeMaster = readJsonFile<LoungeAccessMasterPayload>("master/lounge_access_master.json");
    } else {
      return { total_lounges: 0, airports: [], lounges: [] } as unknown as LoungeAccessMasterPayload;
    }
  }
  return cachedLoungeMaster;
}

export async function getLoungeAccessMasterAsync(): Promise<LoungeAccessMasterPayload> {
  if (hasLocalDataFs()) return getLoungeAccessMaster();
  if (cachedLoungeMaster) return cachedLoungeMaster;
  const remote = await fetchR2Json<LoungeAccessMasterPayload>("meta/lounge_access_master.json");
  if (remote) {
    cachedLoungeMaster = remote;
    return remote;
  }
  return { total_lounges: 0, airports: [], lounges: [] } as unknown as LoungeAccessMasterPayload;
}

export function getGolfClubsMaster(): GolfClubsMasterPayload {
  if (!cachedGolfClubsMaster) {
    if (hasLocalDataFs()) {
      try {
        cachedGolfClubsMaster = readJsonFile<GolfClubsMasterPayload>("master/golf_clubs_master.json");
      } catch {
        cachedGolfClubsMaster = { generated_at: "", clubs_count: 0, clubs: [] };
      }
    } else {
      return { generated_at: "", clubs_count: 0, clubs: [] };
    }
  }
  return cachedGolfClubsMaster;
}

export async function getGolfClubsMasterAsync(): Promise<GolfClubsMasterPayload> {
  if (hasLocalDataFs()) return getGolfClubsMaster();
  if (cachedGolfClubsMaster) return cachedGolfClubsMaster;
  const remote = await fetchR2Json<GolfClubsMasterPayload>("meta/golf_clubs_master.json");
  if (remote) {
    cachedGolfClubsMaster = remote;
    return remote;
  }
  return { generated_at: "", clubs_count: 0, clubs: [] };
}

export function getDevaluationTracker(): DevaluationTrackerPayload {
  if (!cachedDevaluationTracker) {
    if (hasLocalDataFs()) {
      cachedDevaluationTracker = readJsonFile<DevaluationTrackerPayload>("master/devaluation_tracker.json");
    } else {
      return { generated_at: "", total_events: 0, timeline_2024_2026: [], issuer_devaluation_profiles: {} } as unknown as DevaluationTrackerPayload;
    }
  }
  return cachedDevaluationTracker;
}

export async function getDevaluationTrackerAsync(): Promise<DevaluationTrackerPayload> {
  if (hasLocalDataFs()) return getDevaluationTracker();
  if (cachedDevaluationTracker) return cachedDevaluationTracker;
  const remote = await fetchR2Json<DevaluationTrackerPayload>("meta/devaluation_tracker.json");
  if (remote) {
    cachedDevaluationTracker = remote;
    return remote;
  }
  return getDevaluationTracker();
}

export function getLatestOffers(): LatestOffersPayload {
  if (!cachedLatestOffers) {
    try {
      cachedLatestOffers = readJsonFile<LatestOffersPayload>("master/latest_offers.json");
    } catch {
      cachedLatestOffers = { total_offers: 0, banks_covered: 0, offers: [] };
    }
  }
  return cachedLatestOffers;
}

const cachedDossiers = new Map<string, CardDossier | null>();

export function getCardDossier(bankSlug: string, cardSlug: string): CardDossier | null {
  if (!isValidSlug(bankSlug) || !isValidSlug(cardSlug)) {
    return null;
  }
  const cacheKey = `${bankSlug}/${cardSlug}`;
  if (cachedDossiers.has(cacheKey)) {
    return cachedDossiers.get(cacheKey) ?? null;
  }
  if (!hasLocalDataFs()) {
    return null;
  }
  const cardsRoot = path.resolve(DATA_ROOT, "cards_by_bank");
  const resolvedTarget = path.resolve(cardsRoot, bankSlug, `${cardSlug}.json`);
  if (!resolvedTarget.startsWith(cardsRoot + path.sep)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(resolvedTarget, "utf-8");
    const parsed = JSON.parse(raw) as CardDossier;
    cachedDossiers.set(cacheKey, parsed);
    return parsed;
  } catch {
    cachedDossiers.set(cacheKey, null);
    return null;
  }
}

export async function getCardDossierAsync(bankSlug: string, cardSlug: string): Promise<CardDossier | null> {
  if (!isValidSlug(bankSlug) || !isValidSlug(cardSlug)) return null;
  if (hasLocalDataFs()) return getCardDossier(bankSlug, cardSlug);
  const idx = await getSearchIndexAsync();
  const match = idx.cards.find((c) => c.bank_slug === bankSlug && c.card_slug === cardSlug);
  if (!match) return null;
  const remote = await fetchR2Json<CardDossier>(`dossiers/${match.card_id}.json`);
  if (remote) cachedDossiers.set(`${bankSlug}/${cardSlug}`, remote);
  return remote;
}

export function getCardsByIds(ids: string[]): CardDossier[] {
  const cards = getAllCards();
  const byId = new Map(cards.map((c) => [c.card_id, c]));
  const result: CardDossier[] = [];
  for (const id of ids.slice(0, 3)) {
    if (!isValidCardId(id)) continue;
    const summary = byId.get(id);
    if (!summary) continue;
    const dossier = getCardDossier(summary.bank_slug, summary.card_slug);
    if (dossier) result.push(dossier);
  }
  return result;
}

export async function getCardsByIdsAsync(ids: string[]): Promise<CardDossier[]> {
  if (hasLocalDataFs()) return getCardsByIds(ids);
  const cleanIds = ids.slice(0, 3).filter((id) => isValidCardId(id));
  const fetched = await Promise.all(cleanIds.map((id) => fetchR2Json<CardDossier>(`dossiers/${id}.json`)));
  return fetched.filter((d): d is CardDossier => Boolean(d));
}

let cachedFeeWaiverMap: Record<string, number | null> | null = null;
let cachedAdvisorMetaMap: Record<string, AdvisorCardMeta> | null = null;

export function getFeeWaiverMap(): Record<string, number | null> {
  if (cachedFeeWaiverMap) return cachedFeeWaiverMap;
  const map: Record<string, number | null> = {};
  for (const c of getAllCards()) {
    const d = getCardDossier(c.bank_slug, c.card_slug);
    map[c.card_id] = d?.fees_and_charges_detailed?.fee_waiver_spend_inr ?? c.fee_waiver_spend_inr ?? null;
  }
  cachedFeeWaiverMap = map;
  return map;
}

export function getAdvisorMetaMap(): Record<string, AdvisorCardMeta> {
  if (cachedAdvisorMetaMap) return cachedAdvisorMetaMap;
  const map: Record<string, AdvisorCardMeta> = {};
  for (const c of getAllCards()) {
    const d = getCardDossier(c.bank_slug, c.card_slug);
    const rc = d?.reward_calculator_model;
    const elig = d?.eligibility_detailed;
    const deval = d?.devaluation_analysis;
    const comm = d?.reddit_user_feedback;
    const lng = d?.lounge_access_detailed;
    const fees = d?.fees_and_charges_detailed;
    map[c.card_id] = {
      minIncomeSalariedInr:
        elig?.min_monthly_income_salaried_inr ?? c.filter_tags?.min_income_salaried_inr ?? null,
      minItrAnnualInr: elig?.min_annual_itr_self_employed_inr ?? null,
      minCibilScore: elig?.min_cibil_score ?? c.filter_tags?.min_cibil_score ?? 730,
      approvalNotes: elig?.approval_notes ?? null,
      cappingRules: rc?.monthly_capping_rules ?? (c.capping_summary ? [c.capping_summary] : []),
      excludedCategories: rc?.excluded_categories ?? [],
      pointValueDefault: rc?.point_value_inr_default ?? 0.25,
      pointValueMatrix: rc?.point_value_inr_matrix ?? {},
      devaluationRiskScore: deval?.devaluation_risk_score ?? 4,
      devaluationFrequency: deval?.devaluation_frequency ?? "Moderate",
      lastDevaluedOn: deval?.last_devalued_on ?? null,
      communityScore: comm?.community_score ?? c.overall_rating,
      communityWarnings: comm?.practical_community_warnings ?? [],
      loungeSpendCriteria: lng?.domestic?.spend_criteria ?? c.lounge_spend_condition ?? null,
      domesticVisitsPerYear: lng?.domestic?.visits_per_year ?? 0,
      domesticVisitsPerQuarter: lng?.domestic?.visits_per_quarter ?? 0,
      internationalVisitsPerYear: lng?.international?.visits_per_year ?? 0,
      milestoneSlabs:
        rc?.fee_waiver_and_milestone_calculator?.milestone_slabs ??
        d?.benefits_features_and_faqs?.milestone_benefits ??
        [],
      feeWaiverSpendInr: fees?.fee_waiver_spend_inr ?? c.fee_waiver_spend_inr ?? null,
      fuelSurchargeWaiver: fees?.fuel_surcharge_waiver ?? null,
    };
  }
  cachedAdvisorMetaMap = map;
  return map;
}

function buildFeatureRow(
  dossier: CardDossier,
  isCurrent: boolean,
  relationLabel: string
): RelatedCardFeatureRow {
  const rates = dossier.reward_calculator_model?.effective_return_pct_by_category;
  const peak = Math.max(
    0,
    ...Object.entries(rates || {})
      .filter(([k]) => k !== "international_forex_net_of_markup")
      .map(([, v]) => (typeof v === "number" ? v : 0))
  );
  return {
    card_id: dossier.identity.card_id,
    card_name: dossier.identity.card_name,
    bank: dossier.identity.bank,
    bank_slug: dossier.identity.bank_slug,
    card_slug: dossier.identity.card_slug,
    primary_category: dossier.identity.primary_category,
    is_current: isCurrent,
    relation_label: relationLabel,
    annual_fee_inr: dossier.fees_and_charges_detailed.annual_fee_inr,
    fee_waiver_spend_inr: dossier.fees_and_charges_detailed.fee_waiver_spend_inr,
    gst_applicable: dossier.fees_and_charges_detailed.gst_applicable,
    peak_return_pct: peak,
    fuel_pct: rates?.fuel ?? 0,
    grocery_pct: rates?.groceries_quick_commerce ?? 0,
    online_pct: Math.max(rates?.online_shopping_general ?? 0, rates?.amazon_flipkart_myntra ?? 0),
    travel_pct: rates?.travel_flights_hotels ?? 0,
    upi_pct: rates?.upi_scan_and_pay ?? 0,
    dom_lounge: formatLoungeQuota(
      dossier.lounge_access_detailed.domestic.visits_per_year,
      dossier.lounge_access_detailed.domestic.visits_per_quarter,
      dossier.lounge_access_detailed.has_domestic_lounge
    ),
    intl_lounge: formatLoungeQuota(
      dossier.lounge_access_detailed.international.visits_per_year,
      0,
      dossier.lounge_access_detailed.has_international_lounge
    ),
    forex_markup_pct: dossier.fees_and_charges_detailed.forex_markup_pct,
    min_income_inr: dossier.eligibility_detailed.min_monthly_income_salaried_inr,
    min_cibil: dossier.eligibility_detailed.min_cibil_score || 700,
    market_rating: dossier.ratings.overall_market_rating,
    reddit_score: dossier.reddit_user_feedback.community_score,
    deval_risk_score: dossier.devaluation_analysis.devaluation_risk_score,
    is_ltf: dossier.filter_tags.is_ltf,
    is_rupay_upi: dossier.filter_tags.is_rupay_upi,
    no_spend_domestic_lounge: dossier.filter_tags.no_spend_domestic_lounge,
    card_theme: dossier.visual_assets?.card_theme ?? null,
  };
}

export function getRelatedCardFeatureRows(dossier: CardDossier): RelatedCardFeatureRow[] {
  const rows: RelatedCardFeatureRow[] = [
    buildFeatureRow(dossier, true, "This Card"),
  ];
  const seen = new Set<string>([dossier.identity.card_id]);

  // 1. Add explicit alternate options
  for (const alt of dossier.alternate_options || []) {
    if (seen.has(alt.card_id) || rows.length >= 6) continue;
    const altDossier = getCardDossier(alt.bank_slug, alt.card_slug);
    if (altDossier) {
      seen.add(alt.card_id);
      rows.push(buildFeatureRow(altDossier, false, alt.role));
    }
  }

  // 2. Fill remaining slots up to 5–6 with highest-rated peers in the same primary category
  if (rows.length < 5) {
    const peers = getAllCards()
      .filter(
        (c) =>
          !seen.has(c.card_id) &&
          (c.primary_category === dossier.identity.primary_category ||
            c.categories.includes(dossier.identity.primary_category))
      )
      .sort((a, b) => b.overall_rating - a.overall_rating);

    for (const p of peers) {
      if (rows.length >= 5) break;
      const peerDossier = getCardDossier(p.bank_slug, p.card_slug);
      if (peerDossier) {
        seen.add(p.card_id);
        rows.push(buildFeatureRow(peerDossier, false, "category_peer"));
      }
    }
  }

  return rows;
}

export function getCategoryStats(): CategoryStatsItem[] {
  const cards = getAllCards();
  return CATEGORY_META.map((meta) => {
    const matched = (() => {
      if (meta.id === "golf") {
        return cards.filter(
          (c) => Boolean(c.filter_tags.has_golf) || (c.categories || []).includes("Golf")
        );
      }
      if (meta.id === "dining") {
        return cards.filter(
          (c) =>
            (c.effective_return_pct_by_category?.dining_swiggy_zomato ?? 0) >= 2.0 ||
            /eazydiner|swiggy|zomato|dining/i.test(c.card_name)
        );
      }
      if (meta.id === "groceries") {
        return cards.filter(
          (c) =>
            (c.effective_return_pct_by_category?.groceries_quick_commerce ?? 0) >= 2.0 ||
            /live\+|blinkit|zepto|neu|smart/i.test(c.card_name)
        );
      }
      if (meta.id === "utilities") {
        return cards.filter(
          (c) => (c.effective_return_pct_by_category?.utilities_bills_telecom ?? 0) >= 2.0
        );
      }
      if (meta.id === "insurance") {
        return cards.filter(
          (c) =>
            (c.effective_return_pct_by_category?.insurance ?? 0) >= 1.5 ||
            /\blic\b|phonepe|tata neu|bizblack/i.test(c.card_name)
        );
      }
      if (meta.id === "gold-jewellery") {
        return cards.filter(
          (c) =>
            /\btitan\b|goldx|tata neu infinity|infinia|diners club black|emeralde private|magnus|platinum travel|hsbc premier/i.test(
              c.card_name
            ) || (c.effective_return_pct_by_category?.offline_general_other ?? 0) >= 2.5
        );
      }
      return cards.filter(
        (c) =>
          c.primary_category === meta.datasetCategory ||
          (c.categories || []).includes(meta.datasetCategory)
      );
    })();
    const ltfCount = matched.filter((c) => c.filter_tags.is_ltf).length;
    const peakReturnPct = matched.reduce((best, c) => {
      const catPct = c.effective_return_pct_by_category?.[meta.keyReturnKey] ?? 0;
      return catPct > best ? catPct : best;
    }, 0);
    const topCards = [...matched]
      .sort((a, b) => {
        if (meta.datasetCategory === "Golf") {
          const ga = a.golf_summary?.eligible_courses?.includes("International") ? 0.3 : 0;
          const gb = b.golf_summary?.eligible_courses?.includes("International") ? 0.3 : 0;
          return b.overall_rating + gb - (a.overall_rating + ga);
        }
        if (meta.datasetCategory === "Airport Lounge") {
          const la = (a.filter_tags.no_spend_domestic_lounge ? 0.3 : 0) + (a.filter_tags.has_international_lounge ? 0.2 : 0);
          const lb = (b.filter_tags.no_spend_domestic_lounge ? 0.3 : 0) + (b.filter_tags.has_international_lounge ? 0.2 : 0);
          return b.overall_rating + lb - (a.overall_rating + la);
        }
        const ra = a.effective_return_pct_by_category?.[meta.keyReturnKey] ?? 0;
        const rb = b.effective_return_pct_by_category?.[meta.keyReturnKey] ?? 0;
        return rb * 0.6 + b.overall_rating - (ra * 0.6 + a.overall_rating);
      })
      .slice(0, 6);

    return {
      ...meta,
      totalCards: matched.length,
      ltfCount,
      peakReturnPct,
      topCards,
    };
  });
}

export function getMerchantDirectory(): MerchantDirectoryPayload {
  return merchantDirectoryJson as MerchantDirectoryPayload;
}
