import type { AdvisorCardMeta, CardSummaryItem } from './types';
import { formatInr } from './format';

export interface CategoryStudyRow {
  cardId: string;
  bankSlug: string;
  cardSlug: string;
  bank: string;
  cardName: string;
  annualFee: string;
  rating: number;
  cells: string[];
}

export interface CategoryStudyTable {
  categoryId: string;
  title: string;
  subtitle: string;
  columns: string[];
  rows: CategoryStudyRow[];
}

interface DynamicCategorySpec {
  title: string;
  subtitle: string;
  columns: string[];
  maxRows: number;
  pinnedQueries: string[];
  matches: (card: CardSummaryItem) => boolean;
  score: (card: CardSummaryItem, meta?: AdvisorCardMeta) => number;
  buildCells: (card: CardSummaryItem, meta?: AdvisorCardMeta) => string[];
}

const AGGREGATOR_REGEX = /(?:paisabazaar\.com|paisabazaar|cardinsider\.com|cardinsider)/gi;

function cleanText(raw: string | null | undefined, maxLen = 115): string {
  if (!raw) return '';
  const text = raw
    .replace(AGGREGATOR_REGEX, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:)])/g, '$1')
    .trim();
  if (!text) return '';
  if (text.length <= maxLen) return text;
  const slice = text.slice(0, maxLen - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > maxLen * 0.55 ? slice.slice(0, lastSpace) : slice;
  return `${cut.replace(/[,;:\s]+$/, '')}…`;
}

function fmtPct(val: number | undefined | null): string {
  if (typeof val !== 'number' || !Number.isFinite(val) || val <= 0) return '—';
  const rounded = Math.round(val * 100) / 100;
  return `${rounded}%`;
}

function fmtSignedPct(val: number | undefined | null): string {
  if (typeof val !== 'number' || !Number.isFinite(val)) return '—';
  const rounded = Math.round(val * 100) / 100;
  if (rounded === 0) return '0.0% (At-par XE)';
  return rounded > 0 ? `+${rounded}% net` : `${rounded}% net`;
}

function fmtFee(card: CardSummaryItem): string {
  if (card.filter_tags.is_ltf) return '₹0 (LTF)';
  if (card.annual_fee_inr === 0) return card.filter_tags.is_fyf ? '₹0 (FYF)' : '₹0';
  return formatInr(card.annual_fee_inr);
}

function fmtWaiver(card: CardSummaryItem, meta?: AdvisorCardMeta): string {
  if (card.filter_tags.is_ltf || card.annual_fee_inr === 0) return 'Lifetime Free';
  const w = card.fee_waiver_spend_inr ?? meta?.feeWaiverSpendInr;
  if (typeof w === 'number' && w > 0) return `Waiver @ ${formatInr(w)}/yr`;
  return 'No standard waiver';
}

function fmtCap(
  card: CardSummaryItem,
  keys: Array<keyof NonNullable<CardSummaryItem['monthly_category_caps_inr']> | string>
): string {
  const caps = card.monthly_category_caps_inr || {};
  for (const k of keys) {
    const val = caps[k];
    if (typeof val === 'number' && val > 0) {
      return `${formatInr(val)}/mo benefit cap`;
    }
  }
  return 'No strict monthly sub-cap / check tier';
}

function firstRule(card: CardSummaryItem, meta?: AdvisorCardMeta, maxLen = 115): string {
  const full =
    meta?.cappingRules?.[0] || card.capping_summary || card.milestone_summary || card.best_for_short;
  return cleanText(full, maxLen) || 'Standard issuer terms apply';
}

function conciseLoungeDom(card: CardSummaryItem, meta?: AdvisorCardMeta): string {
  if (typeof meta?.domesticVisitsPerYear === 'string' && meta.domesticVisitsPerYear.trim()) {
    return cleanText(meta.domesticVisitsPerYear, 65);
  }
  if (typeof meta?.domesticVisitsPerYear === 'number' && meta.domesticVisitsPerYear > 0) {
    const q =
      typeof meta.domesticVisitsPerQuarter === 'number' && meta.domesticVisitsPerQuarter > 0
        ? ` (${meta.domesticVisitsPerQuarter}/qtr)`
        : '';
    return `${meta.domesticVisitsPerYear} visits/yr${q}`;
  }
  if (card.domestic_lounge_summary) {
    return cleanText(card.domestic_lounge_summary, 78);
  }
  return card.filter_tags.has_domestic_lounge
    ? 'Complimentary domestic visits'
    : 'No domestic lounge';
}

function conciseLoungeIntl(card: CardSummaryItem, meta?: AdvisorCardMeta): string {
  if (
    typeof meta?.internationalVisitsPerYear === 'string' &&
    meta.internationalVisitsPerYear.trim()
  ) {
    return cleanText(meta.internationalVisitsPerYear, 65);
  }
  if (typeof meta?.internationalVisitsPerYear === 'number' && meta.internationalVisitsPerYear > 0) {
    return `${meta.internationalVisitsPerYear} visits/yr`;
  }
  if (card.international_lounge_summary) {
    return cleanText(card.international_lounge_summary, 78);
  }
  return card.filter_tags.has_international_lounge
    ? 'Included via PP/network'
    : 'No international lounge';
}

function loungeCriteriaText(card: CardSummaryItem, meta?: AdvisorCardMeta): string {
  const crit = meta?.loungeSpendCriteria || card.lounge_spend_condition;
  if (crit && !/^\s*not applicable/i.test(crit)) {
    return cleanText(crit, 105);
  }
  return card.filter_tags.no_spend_domestic_lounge
    ? 'No prior spend condition'
    : 'Check quarterly/monthly spend rule';
}

function bestReturnSummary(card: CardSummaryItem): string {
  const entries = Object.entries(card.effective_return_pct_by_category || {}).filter(
    ([k, v]) => k !== 'international_forex_net_of_markup' && typeof v === 'number' && v > 0
  );
  if (entries.length === 0) return 'Base rewards';
  entries.sort((a, b) => b[1] - a[1]);
  const labels: Record<string, string> = {
    online_shopping_general: 'Online',
    amazon_flipkart_myntra: 'Amazon/Flipkart',
    dining_swiggy_zomato: 'Dining/Food',
    groceries_quick_commerce: 'Groceries',
    travel_flights_hotels: 'Travel',
    upi_scan_and_pay: 'UPI QR',
    utilities_bills_telecom: 'Utilities',
    fuel: 'Fuel',
    insurance: 'Insurance',
    education_rent_govt: 'Tax/Govt',
    offline_general_other: 'Offline',
  };
  return entries
    .slice(0, 2)
    .map(([k, v]) => `${fmtPct(v)} ${labels[k] || k}`)
    .join(' · ');
}

function findCardByQuery(
  allCards: CardSummaryItem[],
  query: string,
  usedIds: Set<string>
): CardSummaryItem | undefined {
  const exact = allCards.find((c) => c.card_id === query && !usedIds.has(c.card_id));
  if (exact) return exact;
  const tokens = query
    .toLowerCase()
    .split(/[\s_]+/)
    .filter((t) => t.length > 1);
  if (tokens.length === 0) return undefined;
  let best: CardSummaryItem | undefined;
  let bestScore = -1;
  for (const c of allCards) {
    if (usedIds.has(c.card_id)) continue;
    const hay = `${c.card_id} ${c.card_name} ${c.bank}`.toLowerCase();
    if (!tokens.every((t) => hay.includes(t))) continue;
    const score = c.overall_rating * 10 - c.card_name.length * 0.05;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

const CATEGORY_SPECS: Record<string, DynamicCategorySpec> = {
  golf: {
    title: 'Best Credit Cards with Golf Benefits (Live Dataset)',
    subtitle:
      'Verified green fee waivers, tee-offs, private coaching lessons, eligible courses & spend triggers across live golf cards.',
    columns: ['Complimentary Access', 'Eligible Courses', 'Spend Condition & Notes'],
    maxRows: 18,
    pinnedQueries: [
      'hdfc_bank_infinia_credit_card',
      'hdfc_bank_hdfc_diners_club_black_credit_card',
      'icici_bank_emeralde_private_metal_credit_card',
      'idfc_first_bank_idfc_first_private_credit_card',
      'amex_bank_american_express_platinum_reserve_credit_cards',
      'axis_bank_burgundy_private_credit_card',
      'axis_bank_select_credit_card',
      'hdfc_bank_marriott_bonvoy_hdfc_credit_card',
      'hdfc_bank_swiggy_credit_card',
      'hsbc_bank_travelone_credit_card',
      'icici_bank_icici_bank_sapphiro_visa_credit_card',
      'icici_bank_icici_bank_emeralde_credit_card',
      'idfc_first_bank_mayura_credit_card',
      'au_small_finance_bank_zenith_plus_credit_card',
      'indusind_celesta_credit_card',
      'hdfc_bank_biz_black_credit_card',
    ],
    matches: (c) =>
      Boolean(c.filter_tags.has_golf || c.golf_summary?.has_golf || c.categories.includes('Golf')),
    score: (c) =>
      (c.golf_summary?.has_golf ? 25 : 0) +
      ((c.golf_summary?.eligible_courses || '').toLowerCase().includes('international') ? 10 : 0) +
      c.overall_rating * 6 -
      (c.annual_fee_inr === 0 ? 0 : Math.min(8, c.annual_fee_inr / 10000)),
    buildCells: (c, meta) => {
      const g = c.golf_summary;
      const access =
        cleanText(g?.complimentary_access, 95) ||
        'Network / issuer golf rounds & green fee waivers';
      const courses = cleanText(g?.eligible_courses, 50) || 'Domestic';
      const cond = cleanText(g?.spend_condition, 70);
      const waiver = fmtWaiver(c, meta);
      const notes = [
        cond && cond !== 'None' ? cond : 'No minimum spend trigger',
        waiver !== 'Lifetime Free' ? waiver : null,
      ]
        .filter(Boolean)
        .join(' · ');
      return [access, courses, cleanText(notes, 125)];
    },
  },

  fuel: {
    title: 'Best Fuel Credit Cards — Net Return & Surcharge Study',
    subtitle:
      'Live net fuel value-back after surcharge adjustment, monthly reward caps, and fee waivers.',
    columns: ['Fuel Net Yield', 'Monthly Fuel Cap', 'Surcharge Waiver & Conditions'],
    maxRows: 14,
    pinnedQueries: [
      'rbl_bank_indianoil_rbl_xtra_credit_card',
      'sbi_bank_sbi_bpcl_credit_card_octane',
      'icici_bank_hpcl_super_saver_credit_card',
      'idfc_first_bank_idfc_first_hpcl_power_plus_credit_card',
      'axis_bank_indianoil_credit_card',
      'sbi_bank_sbi_bpcl_credit_card',
      'kotak_mahindra_bank_indianoil_kotak_credit_card',
      'hdfc_bank_indianoil_hdfc_bank_credit_card',
      'rbl_bank_indianoil_rbl_credit_cards',
      'axis_bank_indian_oil_axis_bank_rupay',
    ],
    matches: (c) =>
      c.primary_category === 'Fuel' ||
      c.categories.includes('Fuel') ||
      (c.effective_return_pct_by_category.fuel ?? 0) >= 2,
    score: (c) => (c.effective_return_pct_by_category.fuel ?? 0) * 14 + c.overall_rating * 4,
    buildCells: (c, meta) => {
      const y = fmtPct(c.effective_return_pct_by_category.fuel);
      const groc = c.effective_return_pct_by_category.groceries_quick_commerce ?? 0;
      const yieldCell =
        groc >= 1.5 ? `${y} Fuel · ${fmtPct(groc)} Groc/Dining` : `${y} at partner pumps`;
      const cap = fmtCap(c, ['fuel', 'utilities_bills_telecom']);
      const sw = cleanText(meta?.fuelSurchargeWaiver, 80);
      const cond = [sw || firstRule(c, meta, 85), fmtWaiver(c, meta)].filter(Boolean).join(' · ');
      return [yieldCell, cap, cleanText(cond, 125)];
    },
  },

  cashback: {
    title: 'Best Cashback Credit Cards — Real Net Value & Caps',
    subtitle:
      'Direct cashback & high-efficiency e-commerce cards ranked by live net yield and monthly caps.',
    columns: ['Online / Merchant Yield', 'Dining / Grocery / Utility', 'Monthly Cap & Conditions'],
    maxRows: 15,
    pinnedQueries: [
      'sbi_cashback_sbi_card',
      'hsbc_bank_live_plus_credit_card',
      'hdfc_bank_swiggy_credit_card',
      'hdfc_bank_millennia_credit_card',
      'icici_amazon_pay_icici_bank_credit_card',
      'axis_bank_airtel_axis_bank_credit_card',
      'axis_bank_ace_credit_card',
      'axis_bank_flipkart_axis_bank_credit_card',
      'hdfc_bank_tata_neu_infinity_hdfc_bank_credit_card',
      'hdfc_bank_phonepe_hdfc_bank_credit_card',
    ],
    matches: (c) =>
      c.primary_category === 'Cashback' ||
      c.categories.includes('Cashback') ||
      (c.effective_return_pct_by_category.online_shopping_general ?? 0) >= 3,
    score: (c) => {
      const r = c.effective_return_pct_by_category;
      const maxRate = Math.max(
        r.online_shopping_general || 0,
        r.amazon_flipkart_myntra || 0,
        r.dining_swiggy_zomato || 0,
        r.utilities_bills_telecom || 0
      );
      return maxRate * 6 + c.overall_rating * 5 - (c.annual_fee_inr > 3000 ? 6 : 0);
    },
    buildCells: (c, meta) => {
      const r = c.effective_return_pct_by_category;
      const online = `${fmtPct(r.online_shopping_general)} Online · ${fmtPct(r.amazon_flipkart_myntra)} Amz/Flp`;
      const dgu = `${fmtPct(r.dining_swiggy_zomato)} Dining · ${fmtPct(r.groceries_quick_commerce)} Groc · ${fmtPct(r.utilities_bills_telecom)} Util`;
      const cap = fmtCap(c, [
        'online_shopping_general',
        'amazon_flipkart_myntra',
        'dining_swiggy_zomato',
        'utilities_bills_telecom',
      ]);
      return [online, dgu, cleanText(`${cap} · ${firstRule(c, meta, 85)}`, 125)];
    },
  },

  'online-shopping': {
    title: 'Best Online Shopping & E-Commerce Cards (Live Caps)',
    subtitle: 'Amazon, Flipkart, Myntra, SmartBuy / GrabDeals multipliers, and monthly caps.',
    columns: ['General Online', 'Amazon / Flipkart / Myntra', 'Cap & Portal Rules'],
    maxRows: 14,
    pinnedQueries: [
      'sbi_cashback_sbi_card',
      'icici_amazon_pay_icici_bank_credit_card',
      'axis_bank_flipkart_axis_bank_credit_card',
      'hdfc_bank_millennia_credit_card',
      'hdfc_bank_swiggy_credit_card',
      'hdfc_bank_infinia_credit_card',
      'hdfc_bank_tata_neu_infinity_hdfc_bank_credit_card',
      'axis_bank_cashback_axis_bank_credit_card',
      'sbi_card_simplyclick_sbi_card',
    ],
    matches: (c) =>
      c.primary_category === 'Online Shopping' ||
      c.categories.includes('Online Shopping') ||
      (c.effective_return_pct_by_category.amazon_flipkart_myntra ?? 0) >= 3,
    score: (c) =>
      (c.effective_return_pct_by_category.online_shopping_general ?? 0) * 5 +
      (c.effective_return_pct_by_category.amazon_flipkart_myntra ?? 0) * 4 +
      c.overall_rating * 5,
    buildCells: (c, meta) => {
      const r = c.effective_return_pct_by_category;
      return [
        `${fmtPct(r.online_shopping_general)} online`,
        `${fmtPct(r.amazon_flipkart_myntra)} marketplace`,
        cleanText(
          `${fmtCap(c, ['online_shopping_general', 'amazon_flipkart_myntra'])} · ${firstRule(c, meta, 80)}`,
          125
        ),
      ];
    },
  },

  'dining-groceries': {
    title: 'Best Dining, Food Delivery & Quick-Commerce Cards',
    subtitle: 'Swiggy, Zomato, EazyDiner & supermarket/quick-commerce returns updated live.',
    columns: ['Dining & Food Delivery', 'Groceries & Q-Commerce', 'Monthly Cap & Notes'],
    maxRows: 14,
    pinnedQueries: [
      'hsbc_bank_live_plus_credit_card',
      'hdfc_bank_swiggy_credit_card',
      'hdfc_bank_swiggy_blck_hdfc_credit_card',
      'indusind_bank_eazydiner_indusind_bank_credit_card',
      'hdfc_bank_tata_neu_infinity_hdfc_bank_credit_card',
      'axis_bank_airtel_axis_bank_credit_card',
      'axis_bank_neo_credit_card',
      'hsbc_bank_rupay_cashback_credit_card',
      'sbi_cashback_sbi_card',
    ],
    matches: (c) =>
      c.primary_category === 'Dining, Groceries & Movies' ||
      c.categories.includes('Dining, Groceries & Movies') ||
      (c.effective_return_pct_by_category.dining_swiggy_zomato ?? 0) >= 3 ||
      (c.effective_return_pct_by_category.groceries_quick_commerce ?? 0) >= 3,
    score: (c) =>
      (c.effective_return_pct_by_category.dining_swiggy_zomato ?? 0) * 5 +
      (c.effective_return_pct_by_category.groceries_quick_commerce ?? 0) * 5 +
      c.overall_rating * 4,
    buildCells: (c, meta) => {
      const r = c.effective_return_pct_by_category;
      return [
        `${fmtPct(r.dining_swiggy_zomato)} Dining/Delivery`,
        `${fmtPct(r.groceries_quick_commerce)} Groceries`,
        cleanText(
          `${fmtCap(c, ['dining_swiggy_zomato', 'groceries_quick_commerce'])} · ${firstRule(c, meta, 80)}`,
          125
        ),
      ];
    },
  },

  travel: {
    title: 'Best Travel, Flights, Hotels & Air Miles Cards',
    subtitle: 'Accor/airline point transfers, portal multipliers, lounge access & forex markups.',
    columns: ['Flights & Hotels Yield', 'Lounge & Forex Markup', 'Transfer / Waiver Rules'],
    maxRows: 15,
    pinnedQueries: [
      'hdfc_bank_infinia_credit_card',
      'axis_bank_atlas_credit_card',
      'hsbc_bank_travelone_credit_card',
      'icici_bank_emeralde_private_metal_credit_card',
      'hdfc_bank_hdfc_diners_club_black_credit_card',
      'hdfc_bank_hdfc_regalia_gold_credit_card',
      'amex_bank_american_express_platinum_travel_credit_cards',
      'hdfc_bank_marriott_bonvoy_hdfc_credit_card',
      'axis_bank_horizon_credit_card',
      'sbi_card_sbi_card_miles_elite',
      'hsbc_premier_credit_card',
    ],
    matches: (c) =>
      c.primary_category === 'Travel & Miles' ||
      c.categories.includes('Travel & Miles') ||
      (c.effective_return_pct_by_category.travel_flights_hotels ?? 0) >= 3,
    score: (c, meta) =>
      (c.effective_return_pct_by_category.travel_flights_hotels ?? 0) * 5 +
      (c.filter_tags.has_international_lounge ? 8 : 0) +
      (meta && meta.pointValueDefault >= 0.7 ? 8 : 0) +
      c.overall_rating * 5,
    buildCells: (c, meta) => {
      const r = c.effective_return_pct_by_category;
      const pv = meta?.pointValueDefault ? ` · ~₹${meta.pointValueDefault}/pt` : '';
      const forex =
        typeof c.forex_markup_pct === 'number' ? `${c.forex_markup_pct}% forex` : '3.5% forex';
      return [
        `${fmtPct(r.travel_flights_hotels)} Travel · ${fmtPct(r.offline_general_other)} Base${pv}`,
        `${conciseLoungeDom(c, meta)} · ${forex}`,
        cleanText(`${fmtWaiver(c, meta)} · ${firstRule(c, meta, 80)}`, 125),
      ];
    },
  },

  'rupay-upi': {
    title: 'Best RuPay UPI Scan & Pay Credit Cards',
    subtitle: 'Live UPI merchant QR returns via Kiwi, super.money, Jupiter, Tata Neu & banks.',
    columns: ['UPI Scan & Pay', 'Online / Everyday Yield', 'Monthly Cap & UPI Notes'],
    maxRows: 15,
    pinnedQueries: [
      'yes_bank_klick_credit_card',
      'axis_bank_axis_supermoney_rupay_credit_card',
      'hdfc_bank_tata_neu_infinity_hdfc_bank_credit_card',
      'csb_bank_jupiter_edge_csb_rupay_credit_card',
      'indusind_bank_tiger_credit_card',
      'hsbc_bank_rupay_cashback_credit_card',
      'bob_card_bobcard_snapdeal',
      'slice_rupay_credit_card',
      'hdfc_bank_hdfc_upi_rupay_credit_card',
      'utkarsh_bank_utkarsh_supermoney_rupay_credit_card',
    ],
    matches: (c) =>
      c.filter_tags.is_rupay_upi ||
      c.primary_category === 'RuPay & UPI' ||
      c.categories.includes('RuPay & UPI'),
    score: (c) =>
      (c.effective_return_pct_by_category.upi_scan_and_pay ?? 0) * 14 +
      (c.filter_tags.is_ltf ? 6 : 0) +
      c.overall_rating * 5,
    buildCells: (c, meta) => {
      const r = c.effective_return_pct_by_category;
      return [
        `${fmtPct(r.upi_scan_and_pay)} UPI QR`,
        `${fmtPct(r.online_shopping_general)} Online · ${fmtPct(r.groceries_quick_commerce)} Groc`,
        cleanText(
          `${fmtCap(c, ['upi_scan_and_pay', 'groceries_quick_commerce'])} · ${firstRule(c, meta, 80)}`,
          125
        ),
      ];
    },
  },

  lounge: {
    title: 'Best Airport Lounge Access Cards — Zero/Low Spend Rules',
    subtitle:
      'Updated domestic & international visit quotas, ₹1L/quarter spend gates vs unconditional free cards.',
    columns: ['Domestic Lounge', 'International Lounge', 'Spend Criteria & Notes'],
    maxRows: 15,
    pinnedQueries: [
      'hdfc_bank_infinia_credit_card',
      'hdfc_bank_hdfc_diners_club_black_credit_card',
      'icici_bank_emeralde_private_metal_credit_card',
      'indusind_bank_tiger_credit_card',
      'federal_bank_scapia_credit_card',
      'au_small_finance_bank_ixigo_au_credit_card',
      'axis_bank_atlas_credit_card',
      'hdfc_bank_hdfc_regalia_gold_credit_card',
      'hdfc_bank_tata_neu_infinity_hdfc_bank_credit_card',
      'hsbc_bank_travelone_credit_card',
      'idfc_first_bank_idfc_first_select_credit_card',
    ],
    matches: (c) =>
      c.filter_tags.has_domestic_lounge ||
      c.filter_tags.has_international_lounge ||
      c.categories.includes('Airport Lounge'),
    score: (c) =>
      (c.filter_tags.no_spend_domestic_lounge ? 14 : 0) +
      (c.filter_tags.has_international_lounge ? 8 : 0) +
      (c.filter_tags.has_domestic_lounge ? 5 : 0) +
      c.overall_rating * 5,
    buildCells: (c, meta) => [
      conciseLoungeDom(c, meta),
      conciseLoungeIntl(c, meta),
      cleanText(`${loungeCriteriaText(c, meta)} · ${fmtWaiver(c, meta)}`, 125),
    ],
  },

  forex: {
    title: 'Best Zero & Low Forex Markup Credit Cards',
    subtitle: 'True 0% markup global cards vs premium points cards where rewards offset forex fees.',
    columns: ['Forex Markup', 'Net Intl Return', 'Lounge, Fee Waiver & Notes'],
    maxRows: 14,
    pinnedQueries: [
      'federal_bank_scapia_credit_card',
      'au_small_finance_bank_ixigo_au_credit_card',
      'idfc_first_bank_idfc_first_wow_credit_card',
      'idfc_first_bank_mayura_credit_card',
      'rbl_bank_world_safari_credit_card',
      'axis_bank_olympus_credit_card',
      'hdfc_bank_infinia_credit_card',
      'hsbc_bank_live_plus_credit_card',
      'icici_bank_emeralde_private_metal_credit_card',
      'yes_bank_uni_goldx_credit_card',
    ],
    matches: (c) =>
      c.filter_tags.zero_forex ||
      c.filter_tags.zero_or_low_forex ||
      (typeof c.forex_markup_pct === 'number' && c.forex_markup_pct <= 2),
    score: (c) => {
      const fx = typeof c.forex_markup_pct === 'number' ? c.forex_markup_pct : 3.5;
      const net = c.effective_return_pct_by_category.international_forex_net_of_markup ?? -3;
      return (c.filter_tags.zero_forex ? 25 : 0) + (3.5 - fx) * 10 + net * 3 + c.overall_rating * 4;
    },
    buildCells: (c, meta) => {
      const fx =
        typeof c.forex_markup_pct === 'number' ? `${c.forex_markup_pct}% + GST` : 'Low forex';
      const fxClean = c.forex_markup_pct === 0 ? '0% (True Zero Forex)' : fx;
      return [
        fxClean,
        fmtSignedPct(c.effective_return_pct_by_category.international_forex_net_of_markup),
        cleanText(`${conciseLoungeIntl(c, meta)} · ${fmtWaiver(c, meta)}`, 125),
      ];
    },
  },

  'super-premium': {
    title: 'Super-Premium & Invite-Only Metal Cards Study',
    subtitle: 'Flagship wealth cards benchmarked by travel multipliers, forex, lounge, and golf.',
    columns: ['Travel / Peak Yield', 'Base & Point Value', 'Lounge, Golf & Fee Waiver'],
    maxRows: 14,
    pinnedQueries: [
      'hdfc_bank_infinia_credit_card',
      'icici_bank_emeralde_private_metal_credit_card',
      'hdfc_bank_hdfc_diners_club_black_credit_card',
      'axis_bank_magnus_burgundy_credit_card',
      'axis_bank_burgundy_private_credit_card',
      'hsbc_premier_credit_card',
      'amex_american_express_platinum_charge_card',
      'hdfc_bank_biz_black_credit_card',
      'idfc_first_bank_idfc_first_private_credit_card',
      'axis_bank_reserve_credit_card',
    ],
    matches: (c) =>
      c.primary_category === 'Super-Premium' ||
      c.categories.includes('Super-Premium') ||
      c.filter_tags.is_invite_only ||
      c.annual_fee_inr >= 10000,
    score: (c) =>
      (c.effective_return_pct_by_category.travel_flights_hotels ?? 0) * 4 +
      (c.filter_tags.has_golf ? 6 : 0) +
      (c.filter_tags.has_international_lounge ? 6 : 0) +
      c.overall_rating * 6,
    buildCells: (c, meta) => {
      const r = c.effective_return_pct_by_category;
      const fx = typeof c.forex_markup_pct === 'number' ? `${c.forex_markup_pct}% forex` : '';
      const golfNote = c.golf_summary?.has_golf
        ? cleanText(c.golf_summary.complimentary_access, 48)
        : null;
      return [
        `${fmtPct(r.travel_flights_hotels)} Travel · ${fmtPct(r.amazon_flipkart_myntra)} Portals`,
        `${fmtPct(r.offline_general_other)} Base${meta?.pointValueDefault ? ` (~₹${meta.pointValueDefault}/pt)` : ''}${fx ? ` · ${fx}` : ''}`,
        cleanText(
          [conciseLoungeDom(c, meta), golfNote, fmtWaiver(c, meta)].filter(Boolean).join(' · '),
          130
        ),
      ];
    },
  },

  ltf: {
    title: 'Best Lifetime Free (₹0 Fee) Credit Cards',
    subtitle: 'True ₹0 fee cards delivering zero-forex, UPI cashback, Amazon Pay & lounge value.',
    columns: ['Top Category Yields', 'UPI / Lounge / Forex', 'Eligibility & Key Notes'],
    maxRows: 15,
    pinnedQueries: [
      'icici_amazon_pay_icici_bank_credit_card',
      'federal_bank_scapia_credit_card',
      'au_small_finance_bank_ixigo_au_credit_card',
      'yes_bank_klick_credit_card',
      'axis_bank_axis_supermoney_rupay_credit_card',
      'indusind_bank_tiger_credit_card',
      'csb_bank_jupiter_edge_csb_rupay_credit_card',
      'hsbc_bank_visa_platinum_credit_card',
      'idfc_first_bank_idfc_first_millennia_credit_card',
      'idfc_first_bank_idfc_first_select_credit_card',
    ],
    matches: (c) => c.filter_tags.is_ltf,
    score: (c) =>
      (c.filter_tags.no_spend_domestic_lounge ? 10 : 0) +
      (c.filter_tags.zero_forex ? 10 : 0) +
      (c.filter_tags.is_rupay_upi ? 5 : 0) +
      (c.effective_return_pct_by_category.online_shopping_general ?? 0) * 3 +
      c.overall_rating * 6,
    buildCells: (c, meta) => {
      const extras: string[] = [];
      if (c.filter_tags.is_rupay_upi) {
        extras.push(`RuPay UPI ${fmtPct(c.effective_return_pct_by_category.upi_scan_and_pay)}`);
      }
      if (c.filter_tags.zero_forex) extras.push('0% Forex');
      if (c.filter_tags.has_domestic_lounge) extras.push(conciseLoungeDom(c, meta));
      const inc = meta?.minIncomeSalariedInr
        ? `Min ${formatInr(meta.minIncomeSalariedInr)}/mo`
        : 'Accessible CIBIL/income';
      return [
        bestReturnSummary(c),
        extras.join(' · ') || 'Everyday base card',
        cleanText(`${inc} · ${firstRule(c, meta, 80)}`, 125),
      ];
    },
  },

  'entry-fd': {
    title: 'Best Entry-Level & FD-Backed Starter Cards',
    subtitle: 'Fixed-deposit backed & student-friendly cards for building CIBIL cleanly.',
    columns: ['Earn / UPI Yield', 'FD / Eligibility Baseline', 'Card Type & Highlights'],
    maxRows: 12,
    pinnedQueries: [
      'idfc_first_bank_idfc_first_wow_credit_card',
      'idfc_first_bank_idfc_first_earn_credit_card',
      'utkarsh_bank_utkarsh_supermoney_rupay_credit_card',
      'kotak_mahindra_bank_kotak_811_dream_different_credit_card',
      'sbi_card_sbi_card_unnati',
      'hdfc_bank_freedom_credit_card',
      'onecard_credit_card',
      'slice_rupay_credit_card',
    ],
    matches: (c) =>
      c.filter_tags.is_fd_backed ||
      c.primary_category === 'Entry-Level & Secured (FD)' ||
      c.categories.includes('Entry-Level & Secured (FD)'),
    score: (c) =>
      (c.filter_tags.is_fd_backed ? 12 : 0) +
      (c.filter_tags.is_rupay_upi ? 6 : 0) +
      (c.filter_tags.is_ltf ? 5 : 0) +
      c.overall_rating * 5,
    buildCells: (c, meta) => {
      const fdLabel = c.filter_tags.is_fd_backed
        ? `FD-backed · CIBIL ${c.filter_tags.min_cibil_score || 0}+`
        : `Min CIBIL ${c.filter_tags.min_cibil_score || 700}`;
      const upiRate = fmtPct(c.effective_return_pct_by_category.upi_scan_and_pay);
      const fx = c.filter_tags.zero_forex
        ? '0% Forex'
        : upiRate !== '—'
          ? `UPI ${upiRate}`
          : 'Standard retail';
      return [
        bestReturnSummary(c),
        fdLabel,
        cleanText(`${fx} · ${firstRule(c, meta, 90)}`, 125),
      ];
    },
  },

  'business-tax': {
    title: 'Best Business, GST & Advance Tax Credit Cards',
    subtitle: 'Live GST, advance tax, vendor billing & commercial utility earn rates.',
    columns: ['Tax / Govt / GST', 'Utility & Travel Yield', 'Monthly Cap & Fee Waiver'],
    maxRows: 12,
    pinnedQueries: [
      'hdfc_bank_biz_black_credit_card',
      'hdfc_bank_biz_power_credit_card',
      'hdfc_bank_biz_grow_credit_card',
      'hdfc_bank_biz_first_credit_card',
      'icici_bank_emeralde_private_metal_credit_card',
      'axis_bank_atlas_credit_card',
    ],
    matches: (c) =>
      c.primary_category === 'Business & Tax' ||
      c.categories.includes('Business & Tax') ||
      (c.effective_return_pct_by_category.education_rent_govt ?? 0) >= 2.5,
    score: (c) =>
      (c.primary_category === 'Business & Tax' || c.categories.includes('Business & Tax') ? 20 : 0) +
      (c.effective_return_pct_by_category.education_rent_govt ?? 0) * 8 +
      c.overall_rating * 4,
    buildCells: (c, meta) => {
      const r = c.effective_return_pct_by_category;
      return [
        `${fmtPct(r.education_rent_govt)} Tax/Govt/GST`,
        `${fmtPct(r.utilities_bills_telecom)} Util · ${fmtPct(r.travel_flights_hotels)} Travel`,
        cleanText(
          `${fmtCap(c, ['education_rent_govt', 'utilities_bills_telecom'])} · ${fmtWaiver(c, meta)}`,
          125
        ),
      ];
    },
  },
};

export function getCategoryStudyTable(
  categoryId: string,
  allCards: CardSummaryItem[],
  advisorMetaMap?: Record<string, AdvisorCardMeta>
): CategoryStudyTable | null {
  const spec = CATEGORY_SPECS[categoryId];
  if (!spec) return null;

  const picked: CardSummaryItem[] = [];
  const usedIds = new Set<string>();

  for (const q of spec.pinnedQueries) {
    const match = findCardByQuery(allCards, q, usedIds);
    if (match) {
      picked.push(match);
      usedIds.add(match.card_id);
    }
  }

  const candidates = allCards
    .filter((c) => !usedIds.has(c.card_id) && spec.matches(c))
    .sort((a, b) => {
      const sb = spec.score(b, advisorMetaMap?.[b.card_id]);
      const sa = spec.score(a, advisorMetaMap?.[a.card_id]);
      if (Math.abs(sb - sa) > 0.2) return sb - sa;
      return b.overall_rating - a.overall_rating;
    });

  for (const c of candidates) {
    if (picked.length >= spec.maxRows) break;
    picked.push(c);
    usedIds.add(c.card_id);
  }

  const rows: CategoryStudyRow[] = picked.map((card) => ({
    cardId: card.card_id,
    bankSlug: card.bank_slug,
    cardSlug: card.card_slug,
    bank: card.bank,
    cardName: card.card_name,
    annualFee: fmtFee(card),
    rating: card.overall_rating,
    cells: spec.buildCells(card, advisorMetaMap?.[card.card_id]),
  }));

  return {
    categoryId,
    title: spec.title,
    subtitle: spec.subtitle,
    columns: spec.columns,
    rows,
  };
}
