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
const DEFAULT_R2_BASE = "https://media.card.cogify.me";

export interface CalculatorCardExtraMeta {
  fee_waiver_spend_inr: number | null;
  monthly_capping_rules: string[];
  earn_unit: string;
  point_value_inr_default: number;
}

interface R2JsonBucket {
  get(key: string): Promise<{ json<J = unknown>(): Promise<J> } | null>;
}

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
  const cleanPath = relPath.replace(/^\/+/, "");
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext({ async: true });
    const bucket = (ctx?.env as unknown as { CARDLEDGER_MEDIA?: R2JsonBucket } | undefined)
      ?.CARDLEDGER_MEDIA;
    if (bucket) {
      const obj = await bucket.get(cleanPath);
      if (obj) {
        return (await obj.json()) as T;
      }
    }
  } catch {
    // Outside Cloudflare Workers context (local dev/build or Node runtime); fall back to public R2 HTTPS.
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${getR2BaseUrl()}/${cleanPath}`, {
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

/**
 * Selects a compact initial card subset across top ratings & flagship categories
 * so static SSR HTML/cache payloads stay well within Cloudflare Workers Free CPU/RAM limits,
 * while client hydration loads the full 515-card index from static/R2 CDN.
 */
export function selectSsrCardSlice(cards: CardSummaryItem[], limit = 36): CardSummaryItem[] {
  if (cards.length <= limit) return cards;
  const picked = new Map<string, CardSummaryItem>();
  const sorted = [...cards].sort((a, b) => b.overall_rating - a.overall_rating);

  const buckets: ((c: CardSummaryItem) => boolean)[] = [
    (c) => c.categories.includes("Cashback"),
    (c) => c.categories.includes("Online Shopping"),
    (c) => c.categories.includes("Travel & Miles"),
    (c) => Boolean(c.filter_tags.is_rupay_upi),
    (c) => c.categories.includes("Fuel"),
    (c) => Boolean(c.filter_tags.no_spend_domestic_lounge),
    (c) => Boolean(c.filter_tags.is_ltf),
    (c) => Boolean(c.filter_tags.has_golf),
  ];

  for (const pred of buckets) {
    let taken = 0;
    for (const c of sorted) {
      if (taken >= 4 || picked.size >= limit) break;
      if (!picked.has(c.card_id) && pred(c)) {
        picked.set(c.card_id, c);
        taken++;
      }
    }
  }

  for (const c of sorted) {
    if (picked.size >= limit) break;
    if (!picked.has(c.card_id)) picked.set(c.card_id, c);
  }

  return Array.from(picked.values());
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

export async function getAllCardsAsync(): Promise<CardSummaryItem[]> {
  return (await getSearchIndexAsync()).cards;
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

export async function getBanksIndexAsync(): Promise<BanksIndexPayload> {
  if (hasLocalDataFs()) return getBanksIndex();
  if (cachedBanksIndex) return cachedBanksIndex;
  const remote = await fetchR2Json<BanksIndexPayload>("meta/cards_by_bank_index.json");
  if (remote) {
    cachedBanksIndex = remote;
    return remote;
  }
  return getBanksIndex();
}

const EMPTY_LOUNGE_CATALOG: LoungeCatalogPayload = {
  generated_at: "",
  total_programs: 0,
  network_rules: {},
  baseline_indian_airport_lounges_count: 0,
  programs: {},
};

export function getLoungeCatalog(): LoungeCatalogPayload {
  if (!cachedLoungeCatalog) {
    if (hasLocalDataFs()) {
      cachedLoungeCatalog = readJsonFile<LoungeCatalogPayload>("master/lounge_programs_catalog.json");
    } else {
      return EMPTY_LOUNGE_CATALOG;
    }
  }
  return cachedLoungeCatalog;
}

export async function getLoungeCatalogAsync(): Promise<LoungeCatalogPayload> {
  if (hasLocalDataFs()) return getLoungeCatalog();
  if (cachedLoungeCatalog) return cachedLoungeCatalog;
  const remote = await fetchR2Json<LoungeCatalogPayload>("meta/lounge_programs_catalog.json");
  if (remote) {
    cachedLoungeCatalog = remote;
    return remote;
  }
  return EMPTY_LOUNGE_CATALOG;
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
    if (hasLocalDataFs()) {
      try {
        cachedLatestOffers = readJsonFile<LatestOffersPayload>("master/latest_offers.json");
      } catch {
        cachedLatestOffers = { total_offers: 0, banks_covered: 0, offers: [] };
      }
    } else {
      return { total_offers: 0, banks_covered: 0, offers: [] };
    }
  }
  return cachedLatestOffers;
}

export async function getLatestOffersAsync(): Promise<LatestOffersPayload> {
  if (hasLocalDataFs()) return getLatestOffers();
  if (cachedLatestOffers) return cachedLatestOffers;
  const remote = await fetchR2Json<LatestOffersPayload>("meta/latest_offers.json");
  if (remote) {
    cachedLatestOffers = remote;
    return remote;
  }
  return getLatestOffers();
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
  const cacheKey = `${bankSlug}/${cardSlug}`;
  if (cachedDossiers.has(cacheKey)) {
    return cachedDossiers.get(cacheKey) ?? null;
  }
  const idx = await getSearchIndexAsync();
  const match = idx.cards.find((c) => c.bank_slug === bankSlug && c.card_slug === cardSlug);
  if (!match) return null;
  const remote = await fetchR2Json<CardDossier>(`dossiers/${match.card_id}.json`);
  if (remote) cachedDossiers.set(cacheKey, remote);
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
let cachedCalculatorExtraMeta: Record<string, CalculatorCardExtraMeta> | null = null;

export function getFeeWaiverMap(): Record<string, number | null> {
  if (cachedFeeWaiverMap) return cachedFeeWaiverMap;
  if (!hasLocalDataFs()) return {};
  const map: Record<string, number | null> = {};
  for (const c of getAllCards()) {
    const d = getCardDossier(c.bank_slug, c.card_slug);
    map[c.card_id] = d?.fees_and_charges_detailed?.fee_waiver_spend_inr ?? c.fee_waiver_spend_inr ?? null;
  }
  cachedFeeWaiverMap = map;
  return map;
}

export async function getFeeWaiverMapAsync(): Promise<Record<string, number | null>> {
  if (hasLocalDataFs()) return getFeeWaiverMap();
  if (cachedFeeWaiverMap) return cachedFeeWaiverMap;
  const remote = await fetchR2Json<Record<string, number | null>>("meta/fee_waiver_map.json");
  if (remote) {
    cachedFeeWaiverMap = remote;
    return remote;
  }
  return {};
}

export function getAdvisorMetaMap(): Record<string, AdvisorCardMeta> {
  if (cachedAdvisorMetaMap) return cachedAdvisorMetaMap;
  if (!hasLocalDataFs()) return {};
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

export async function getAdvisorMetaMapAsync(): Promise<Record<string, AdvisorCardMeta>> {
  if (hasLocalDataFs()) return getAdvisorMetaMap();
  if (cachedAdvisorMetaMap) return cachedAdvisorMetaMap;
  const remote = await fetchR2Json<Record<string, AdvisorCardMeta>>("meta/advisor_meta_map.json");
  if (remote) {
    cachedAdvisorMetaMap = remote;
    return remote;
  }
  return {};
}

export function getCalculatorExtraMetaMap(): Record<string, CalculatorCardExtraMeta> {
  if (cachedCalculatorExtraMeta) return cachedCalculatorExtraMeta;
  if (!hasLocalDataFs()) return {};
  const map: Record<string, CalculatorCardExtraMeta> = {};
  for (const c of getAllCards()) {
    const dossier = getCardDossier(c.bank_slug, c.card_slug);
    if (dossier) {
      map[c.card_id] = {
        fee_waiver_spend_inr: dossier.fees_and_charges_detailed?.fee_waiver_spend_inr ?? null,
        monthly_capping_rules: dossier.reward_calculator_model?.monthly_capping_rules || [],
        earn_unit: dossier.reward_calculator_model?.earn_unit || "Reward Points",
        point_value_inr_default: dossier.reward_calculator_model?.point_value_inr_default ?? 1,
      };
    }
  }
  cachedCalculatorExtraMeta = map;
  return map;
}

export async function getCalculatorExtraMetaMapAsync(): Promise<Record<string, CalculatorCardExtraMeta>> {
  if (hasLocalDataFs()) return getCalculatorExtraMetaMap();
  if (cachedCalculatorExtraMeta) return cachedCalculatorExtraMeta;
  const remote = await fetchR2Json<Record<string, CalculatorCardExtraMeta>>("meta/calculator_extra_meta.json");
  if (remote) {
    cachedCalculatorExtraMeta = remote;
    return remote;
  }
  return {};
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

export async function getRelatedCardFeatureRowsAsync(
  dossier: CardDossier
): Promise<RelatedCardFeatureRow[]> {
  if (hasLocalDataFs()) return getRelatedCardFeatureRows(dossier);
  const rows: RelatedCardFeatureRow[] = [buildFeatureRow(dossier, true, "This Card")];
  const seen = new Set<string>([dossier.identity.card_id]);

  const wanted: { id: string; bankSlug: string; cardSlug: string; role: string }[] = [];
  for (const alt of dossier.alternate_options || []) {
    if (seen.has(alt.card_id) || wanted.length >= 5) continue;
    seen.add(alt.card_id);
    wanted.push({ id: alt.card_id, bankSlug: alt.bank_slug, cardSlug: alt.card_slug, role: alt.role });
  }

  if (wanted.length < 4) {
    const peers = (await getAllCardsAsync())
      .filter(
        (c) =>
          !seen.has(c.card_id) &&
          (c.primary_category === dossier.identity.primary_category ||
            c.categories.includes(dossier.identity.primary_category))
      )
      .sort((a, b) => b.overall_rating - a.overall_rating);

    for (const p of peers) {
      if (wanted.length >= 4) break;
      seen.add(p.card_id);
      wanted.push({ id: p.card_id, bankSlug: p.bank_slug, cardSlug: p.card_slug, role: "category_peer" });
    }
  }

  const resolved = await Promise.all(
    wanted.map(async (item) => ({
      role: item.role,
      dossier: await getCardDossierAsync(item.bankSlug, item.cardSlug),
    }))
  );
  for (const item of resolved) {
    if (item.dossier) rows.push(buildFeatureRow(item.dossier, false, item.role));
  }
  return rows;
}

function buildCategoryStats(cards: CardSummaryItem[]): CategoryStatsItem[] {
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

export function getCategoryStats(): CategoryStatsItem[] {
  return buildCategoryStats(getAllCards());
}

export async function getCategoryStatsAsync(): Promise<CategoryStatsItem[]> {
  return buildCategoryStats(await getAllCardsAsync());
}

export function getMerchantDirectory(): MerchantDirectoryPayload {
  return merchantDirectoryJson as MerchantDirectoryPayload;
}
