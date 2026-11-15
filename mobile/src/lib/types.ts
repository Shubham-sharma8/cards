export type RewardConversionStrategy =
  | 'default_inr'
  | 'cash_statement'
  | 'air_miles'
  | 'accor_all';

export type SpendCategoryKey =
  | 'online_shopping_general'
  | 'amazon_flipkart_myntra'
  | 'dining_swiggy_zomato'
  | 'groceries_quick_commerce'
  | 'travel_flights_hotels'
  | 'upi_scan_and_pay'
  | 'utilities_bills_telecom'
  | 'fuel'
  | 'insurance'
  | 'education_rent_govt'
  | 'international_forex_net_of_markup'
  | 'offline_general_other';

export interface CardFilterTags {
  is_ltf: boolean;
  is_fyf: boolean;
  is_fd_backed: boolean;
  is_rupay_upi: boolean;
  is_invite_only: boolean;
  fee_bracket: string;
  has_domestic_lounge: boolean;
  has_international_lounge: boolean;
  has_railway_lounge: boolean;
  no_spend_domestic_lounge: boolean;
  has_golf?: boolean;
  zero_or_low_forex: boolean;
  zero_forex: boolean;
  min_income_salaried_inr: number | null;
  min_cibil_score: number;
  best_for_tags: string[];
  requirement_keywords: string[];
}

export interface GolfSummary {
  has_golf: boolean;
  complimentary_access: string;
  eligible_courses: string;
  spend_condition: string;
}

export interface CardTheme {
  primary_hex: string;
  secondary_hex: string;
  wash_hex: string;
  soft_bg_hex: string;
  border_hex: string;
  ink_on_soft_hex: string;
  is_dark_card: boolean;
  source?: string;
}

export interface CardSummaryItem {
  card_id: string;
  card_name: string;
  bank: string;
  bank_slug: string;
  card_slug: string;
  primary_category: string;
  categories: string[];
  card_network: string;
  card_tier: string;
  status: string;
  annual_fee_inr: number;
  fee_waiver_spend_inr?: number | null;
  forex_markup_pct?: number;
  overall_rating: number;
  local_image_path: string | null;
  image_url: string | null;
  card_theme?: CardTheme | null;
  filter_tags: CardFilterTags;
  effective_return_pct_by_category: Record<SpendCategoryKey, number>;
  monthly_category_caps_inr?: Record<string, number>;
  category_caveats?: Record<string, string>;
  domestic_lounge_summary?: string | null;
  international_lounge_summary?: string | null;
  lounge_spend_condition?: string | null;
  golf_summary?: GolfSummary | null;
  capping_summary?: string | null;
  milestone_summary?: string | null;
  best_for_short?: string | null;
}

export type AdvisorPriorityMode =
  | 'balanced'
  | 'max_net'
  | 'low_fee_uncapped'
  | 'travel_lounge';

export interface AdvisorCardMeta {
  minIncomeSalariedInr: number | null;
  minItrAnnualInr: number | null;
  minCibilScore: number;
  approvalNotes: string | null;
  cappingRules: string[];
  excludedCategories: string[];
  pointValueDefault: number;
  pointValueMatrix: Record<string, string>;
  devaluationRiskScore: number;
  devaluationFrequency: string;
  lastDevaluedOn: string | null;
  communityScore: number;
  communityWarnings: string[];
  loungeSpendCriteria: string | null;
  domesticVisitsPerYear: number | string;
  domesticVisitsPerQuarter: number | string;
  internationalVisitsPerYear: number | string;
  milestoneSlabs: string[];
  feeWaiverSpendInr: number | null;
  fuelSurchargeWaiver: string | null;
}

export interface BankSummary {
  bank: string;
  bank_slug: string;
  total_cards: number;
  ltf_count: number;
  rupay_upi_count: number;
  domestic_lounge_count: number;
  international_lounge_count: number;
  zero_or_low_forex_count: number;
  official_lounge_programs: Array<{ title: string; url: string; parsed_lounges_count?: number }>;
}

export interface LoungeSpot {
  city: string;
  lounge_name: string;
  terminal: string;
  terminal_type: string;
}

export interface LoungeProgramEntry {
  program_id: string;
  bank: string;
  title: string;
  official_url: string;
  secondary_url?: string;
  source_type: string;
  parsed_lounges_count: number;
  parsed_lounges: LoungeSpot[];
}

export interface DevaluationEvent {
  date: string;
  issuer: string;
  cards_affected: string[];
  severity: string;
  summary: string;
  source_ref: string;
  pdf_url?: string;
  mitc_pdf_url?: string;
}

export interface IssuerDevaluationProfile {
  frequency: string;
  risk_score: number;
  note: string;
  mitc_pdf_url?: string;
  devaluation_pdf_url?: string;
  bank_page_url?: string;
}

export interface LatestOffer {
  offer_id: string;
  bank: string;
  title: string;
  summary: string;
  category: string;
  valid_till: string;
  offer_url: string;
  scope?: string;
  card_ids?: string[];
}

export interface LatestOffersPayload {
  total_offers: number;
  banks_covered: number;
  offers: LatestOffer[];
}

export interface MobileCardDossier {
  identity: {
    card_id: string;
    card_name: string;
    bank: string;
    bank_slug: string;
    card_slug: string;
    card_network: string;
    card_tier: string;
    primary_category: string;
    categories: string[];
    status: string;
  };
  visual_assets: {
    image_url: string | null;
    local_image_path: string | null;
    card_theme?: CardTheme | null;
  };
  official_and_reference_links: {
    bank_url: string | null;
    mitc_pdf_url: string | null;
    aggregator_urls?: string[];
  };
  filter_tags: CardFilterTags;
  reward_calculator_model: {
    earn_unit: string;
    base_reward_rate_pct: number;
    accelerated_reward_rate_pct: number;
    point_value_inr_default: number;
    point_value_inr_matrix: Record<string, string>;
    point_expiry: string;
    reward_earning_rules: string[];
    effective_return_pct_by_category: Record<SpendCategoryKey, number>;
    monthly_category_caps_inr?: Record<string, number>;
    category_caveats?: Record<string, string>;
    monthly_capping_rules: string[];
    excluded_categories: string[];
    transfer_partners: Array<string | { partner?: string; ratio?: string }>;
  };
  lounge_access_detailed: {
    domestic: {
      visits_per_year: number | string;
      visits_per_quarter: number | string;
      spend_criteria: string;
      add_on_allowed: boolean | string;
      summary: string;
    };
    international: {
      program: string;
      visits_per_year: number | string;
      spend_criteria: string;
      guest_fee: string;
      summary: string;
    };
    railway: {
      visits_per_year: number | string;
      visits_per_quarter: number | string;
      summary: string;
    };
    has_domestic_lounge: boolean;
    has_international_lounge: boolean;
    has_railway_lounge: boolean;
    no_spend_domestic_lounge: boolean;
    applicable_lounge_links: Array<{ title: string; url: string; parsed_lounges_count?: number }>;
    participating_lounges_count: number;
    program_ids: string[];
    no_lounge_note?: string | null;
  };
  fees_and_charges_detailed: {
    joining_fee_inr: number;
    annual_fee_inr: number;
    gst_applicable: boolean;
    fee_waiver_spend_inr: number | null;
    joining_fee_waiver: string | null;
    forex_markup_pct: number;
    apr_monthly_pct: number;
    apr_annual_pct: number;
    cash_advance_fee: string;
    fuel_surcharge_waiver: string;
    redemption_fee: string;
    add_on_card_fee: string;
    late_payment_slabs: Array<{
      statement_balance_slab?: string;
      late_fee_inr?: string;
      balance_range?: string;
      fee?: string;
    }>;
  };
  benefits_features_and_faqs: {
    about_overview: string;
    highlights: string[];
    welcome_benefit: string | string[] | null;
    milestone_benefits: string[];
    dining_benefits: string[];
    movie_benefits: string[];
    golf_benefits: string[];
    insurance_cover: string[];
    concierge_or_privilege: string[];
    golf_summary?: GolfSummary | null;
    get_this_card_if: string[];
    faqs: Array<{ question?: string; q?: string; answer?: string; a?: string }>;
  };
  ratings: {
    overall_market_rating: number;
    editorial_rating?: number | null;
    aggregator_rating?: number | null;
    category_sub_ratings: Record<string, number>;
  };
  pros_and_cons: {
    editorial_summary: string;
    pros: string[];
    cons: string[];
    best_for_whom: string;
    not_ideal_for: string;
    recommended_monthly_spend_inr: string;
    verdict: string;
  };
  reddit_user_feedback: {
    community_score: number;
    reddit_mentions: number;
    sentiment_summary: string;
    key_threads: Array<{ title: string; url: string }>;
    practical_community_warnings: string[];
    optimization_tips?: string[];
  };
  devaluation_analysis: {
    devaluation_frequency: string;
    devaluation_risk_score: number;
    last_devalued_on: string | null;
    devaluation_history: string[];
    watch_out_vectors: string[];
  };
  alternate_options: Array<{
    role: string;
    card_id: string;
    card_name: string;
    bank: string;
    bank_slug: string;
    card_slug: string;
    annual_fee_inr: number;
    overall_rating: number;
    reason: string;
  }>;
  eligibility_detailed: {
    occupation: string;
    age_range: string;
    min_monthly_income_salaried_inr: number | null;
    govt_employee_income_note: string | null;
    min_annual_itr_self_employed_inr: number | null;
    min_cibil_score: number;
    approval_notes: string | null;
  };
  latest_offers?: LatestOffer[];
}

export interface ParticipatingAirportLoungeSpot {
  sr: string;
  airport_city_and_lounge: string;
  lounge_code: string;
  terminal_type: 'Domestic' | 'International' | string;
  terminal_and_hours: string;
  airport_code: string;
  city: string;
  terminal: string;
  lounge_name: string;
  accepted_networks: string[];
  google_place_name?: string;
  google_rating?: number;
  google_review_count?: number;
  google_maps_url?: string;
  local_photo_path?: string;
}

export interface GolfClubSpot {
  slug: string;
  city: string;
  club_name: string;
  google_place_name?: string;
  google_rating?: number | null;
  google_review_count?: number | null;
  google_maps_url?: string | null;
  formatted_address?: string | null;
  local_photo_path?: string | null;
}

export interface GolfClubsMasterPayload {
  generated_at: string;
  clubs_count: number;
  clubs: GolfClubSpot[];
}

export interface LoungeAccessMasterPayload {
  generated_at: string;
  network_rules: {
    visa_validation_charge?: string;
    mastercard_validation_charge?: string;
    rupay_validation_charge?: string;
    priority_pass_guest_fee?: string;
    priority_pass_domestic_warning?: string;
    irctc_railway_lounge_terms?: {
      updated?: string;
      quota?: string;
      inclusions?: string[];
      validation_fee?: string;
    };
  };
  participating_indian_airport_lounges_count: number;
  participating_indian_airport_lounges: ParticipatingAirportLoungeSpot[];
}
