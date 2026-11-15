import { fetchRemoteCardDossier } from './mediaCdn';
import type {
  AdvisorCardMeta,
  BankSummary,
  CardSummaryItem,
  DevaluationEvent,
  GolfClubsMasterPayload,
  IssuerDevaluationProfile,
  LatestOffer,
  LatestOffersPayload,
  LoungeAccessMasterPayload,
  LoungeProgramEntry,
  LoungeSpot,
  MobileCardDossier,
} from './types';

/* eslint-disable @typescript-eslint/no-require-imports */
const searchIndexRaw = require('../data/search_index.json') as {
  total_cards: number;
  cards: CardSummaryItem[];
};
const banksIndexRaw = require('../data/banks_index.json') as {
  total_banks: number;
  total_cards: number;
  banks: BankSummary[];
};
const loungeCatalogRaw = require('../data/lounge_catalog.json') as {
  total_programs: number;
  network_rules: {
    visa_validation_charge?: string;
    mastercard_validation_charge?: string;
    rupay_validation_charge?: string;
    priority_pass_guest_fee?: string;
    priority_pass_domestic_warning?: string;
    irctc_railway_lounge_terms?: {
      quota?: string;
      inclusions?: string[];
    };
  };
  programs: Record<string, LoungeProgramEntry>;
};
const devalTrackerRaw = require('../data/devaluation_tracker.json') as {
  issuer_devaluation_profiles: Record<string, IssuerDevaluationProfile>;
  timeline_2024_2026: DevaluationEvent[];
};
const calcMetaRaw = require('../data/calc_meta.json') as Record<
  string,
  { waiver: number | null; gst: boolean; caps: string[] }
>;
const latestOffersRaw = require('../data/latest_offers.json') as LatestOffersPayload;
const loungeAccessMasterRaw = require('../data/lounge_access_master.json') as LoungeAccessMasterPayload;
const golfClubsMasterRaw = require('../data/golf_clubs_master.json') as GolfClubsMasterPayload;

let cachedDossiersMap: Record<string, MobileCardDossier> | null = null;
export function getDossiersMap(): Record<string, MobileCardDossier> {
  if (!cachedDossiersMap) {
    // Lazily parsed on first dossier/advisor access to keep app startup fast
    cachedDossiersMap = require('../data/dossiers_map.json') as Record<string, MobileCardDossier>;
  }
  return cachedDossiersMap;
}

export const ALL_CARDS: CardSummaryItem[] = searchIndexRaw.cards;
export const TOTAL_CARDS = searchIndexRaw.total_cards;
export const ALL_BANKS: BankSummary[] = banksIndexRaw.banks;
export const TOTAL_BANKS = banksIndexRaw.total_banks;
export const LOUNGE_CATALOG = loungeCatalogRaw;
export const LOUNGE_ACCESS_MASTER = loungeAccessMasterRaw;
export const GOLF_CLUBS_MASTER = golfClubsMasterRaw;
export const TOTAL_LOUNGE_PROGRAMS = Object.keys(loungeCatalogRaw.programs || {}).length;
export const DEVALUATION_TRACKER = devalTrackerRaw;
export const CALC_META = calcMetaRaw;
export const LATEST_OFFERS: LatestOffer[] = latestOffersRaw.offers || [];

let cachedAdvisorMetaMap: Record<string, AdvisorCardMeta> | null = null;

export function getAdvisorMetaMap(): Record<string, AdvisorCardMeta> {
  if (cachedAdvisorMetaMap) return cachedAdvisorMetaMap;
  const dossiersMap = getDossiersMap();
  const map: Record<string, AdvisorCardMeta> = {};
  for (const c of ALL_CARDS) {
    const d = dossiersMap[c.card_id];
    const rc = d?.reward_calculator_model as (MobileCardDossier['reward_calculator_model'] & {
      fee_waiver_and_milestone_calculator?: { milestone_slabs?: string[] };
    }) | undefined;
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
      devaluationFrequency: deval?.devaluation_frequency ?? 'Moderate',
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

export function getDossierById(cardId: string): MobileCardDossier | null {
  return getDossiersMap()[cardId] ?? null;
}

export function getDossierBySlugs(bankSlug: string, cardSlug: string): MobileCardDossier | null {
  const dossiersMap = getDossiersMap();
  const direct = dossiersMap[`${bankSlug}_${cardSlug}`];
  if (direct) return direct;
  const match = ALL_CARDS.find((c) => c.bank_slug === bankSlug && c.card_slug === cardSlug);
  return match ? dossiersMap[match.card_id] ?? null : null;
}

/**
 * Fetches an individual card dossier on demand from Cloudflare R2 when
 * EXPO_PUBLIC_R2_PUBLIC_URL is set, falling back cleanly to the local store.
 */
export async function getCardDossierAsync(
  bankSlug: string,
  cardSlug: string
): Promise<MobileCardDossier | null> {
  const match = ALL_CARDS.find((c) => c.bank_slug === bankSlug && c.card_slug === cardSlug);
  const cardId = match?.card_id ?? `${bankSlug}_${cardSlug}`;
  const remote = await fetchRemoteCardDossier(cardId);
  if (remote) return remote;
  return getDossierBySlugs(bankSlug, cardSlug);
}

export function getMatchedLoungesForProgramIds(programIds: string[]): LoungeSpot[] {
  const seen = new Set<string>();
  const spots: LoungeSpot[] = [];
  for (const pid of programIds) {
    const prog = loungeCatalogRaw.programs[pid];
    if (!prog) continue;
    for (const s of prog.parsed_lounges || []) {
      const k = `${s.city}|${s.lounge_name}|${s.terminal}`;
      if (!seen.has(k)) {
        seen.add(k);
        spots.push(s);
      }
    }
  }
  return spots;
}

export function getAccessibleIndianLoungesForCard(cardId: string) {
  const card = ALL_CARDS.find((c) => c.card_id === cardId);
  const codeSet = new Set((card?.accessible_lounge_codes || []).map((c) => c.toUpperCase()));
  return (LOUNGE_ACCESS_MASTER.participating_indian_airport_lounges || []).filter((spot) => {
    if (spot.lounge_code && codeSet.has(spot.lounge_code.toUpperCase())) return true;
    const allIds = [
      ...(spot.eligible_no_spend_card_ids || []),
      ...(spot.eligible_low_spend_card_ids || []),
      ...(spot.eligible_high_spend_card_ids || []),
      ...(spot.verified_cardmaven_card_ids || []),
    ];
    return allIds.includes(cardId);
  });
}

export function getAccessibleGolfClubsForCard(cardId: string) {
  const card = ALL_CARDS.find((c) => c.card_id === cardId);
  const slugSet = new Set(card?.accessible_golf_slugs || []);
  return (GOLF_CLUBS_MASTER.clubs || []).filter((club) => {
    if (slugSet.has(club.slug)) return true;
    const allIds = [
      ...(club.eligible_no_spend_card_ids || []),
      ...(club.eligible_high_spend_card_ids || []),
    ];
    return allIds.includes(cardId);
  });
}
