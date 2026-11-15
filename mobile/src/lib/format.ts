import type { SpendCategoryKey } from './types';

export const SPEND_CATEGORY_META: Record<
  SpendCategoryKey,
  { label: string; shortLabel: string; defaultMonthlyInr: number; maxInr: number }
> = {
  online_shopping_general: {
    label: 'Online Shopping (General)',
    shortLabel: 'Online',
    defaultMonthlyInr: 8000,
    maxInr: 100000,
  },
  amazon_flipkart_myntra: {
    label: 'Amazon, Flipkart & Myntra',
    shortLabel: 'Marketplaces',
    defaultMonthlyInr: 7000,
    maxInr: 100000,
  },
  dining_swiggy_zomato: {
    label: 'Dining, Swiggy & Zomato',
    shortLabel: 'Dining',
    defaultMonthlyInr: 5000,
    maxInr: 60000,
  },
  groceries_quick_commerce: {
    label: 'Groceries & Quick Commerce',
    shortLabel: 'Groceries',
    defaultMonthlyInr: 6000,
    maxInr: 60000,
  },
  travel_flights_hotels: {
    label: 'Flights & Hotels',
    shortLabel: 'Travel',
    defaultMonthlyInr: 8000,
    maxInr: 150000,
  },
  upi_scan_and_pay: {
    label: 'UPI Scan & Pay (RuPay)',
    shortLabel: 'UPI QR',
    defaultMonthlyInr: 6000,
    maxInr: 50000,
  },
  utilities_bills_telecom: {
    label: 'Utilities & Telecom Bills',
    shortLabel: 'Utilities',
    defaultMonthlyInr: 4000,
    maxInr: 50000,
  },
  fuel: {
    label: 'Fuel (Petrol / Diesel)',
    shortLabel: 'Fuel',
    defaultMonthlyInr: 3500,
    maxInr: 40000,
  },
  insurance: {
    label: 'Insurance Premiums',
    shortLabel: 'Insurance',
    defaultMonthlyInr: 2000,
    maxInr: 50000,
  },
  education_rent_govt: {
    label: 'Education, Rent & Tax',
    shortLabel: 'Rent / Tax',
    defaultMonthlyInr: 0,
    maxInr: 100000,
  },
  international_forex_net_of_markup: {
    label: 'International / Forex Spend',
    shortLabel: 'Forex',
    defaultMonthlyInr: 0,
    maxInr: 150000,
  },
  offline_general_other: {
    label: 'Offline Retail & POS',
    shortLabel: 'Offline POS',
    defaultMonthlyInr: 5000,
    maxInr: 100000,
  },
};

export const SPEND_CATEGORY_KEYS = Object.keys(SPEND_CATEGORY_META) as SpendCategoryKey[];

export function formatInr(amount: number | null | undefined, freeIfZero = false): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return 'N/A';
  if (freeIfZero && amount === 0) return '₹0 (Free)';
  const sign = amount < 0 ? '-' : '';
  const abs = Math.round(Math.abs(amount));
  return `${sign}₹${abs.toLocaleString('en-IN')}`;
}

export function formatQuotaNumber(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '') return '0';
  if (typeof val === 'string') {
    const lower = val.toLowerCase();
    if (lower.includes('unlimited') || Number(val) >= 999) return 'Unlimited';
    return val;
  }
  if (val >= 999) return 'Unlimited';
  return String(val);
}

export function formatLoungeQuota(
  visitsPerYear: number | string | null | undefined,
  visitsPerQuarter?: number | string | null | undefined,
  hasAccess = true
): string {
  if (!hasAccess) return 'None';
  const yrStr = typeof visitsPerYear === 'string' ? visitsPerYear.toLowerCase() : '';
  const qtrStr = typeof visitsPerQuarter === 'string' ? visitsPerQuarter.toLowerCase() : '';
  const yrNum = typeof visitsPerYear === 'number' ? visitsPerYear : Number(visitsPerYear);
  const qtrNum = typeof visitsPerQuarter === 'number' ? visitsPerQuarter : Number(visitsPerQuarter);

  if (yrStr.includes('unlimited') || qtrStr.includes('unlimited') || yrNum >= 999 || qtrNum >= 999) {
    return 'Unlimited';
  }
  if (!Number.isNaN(yrNum) && yrNum > 0) {
    return `${yrNum}/yr`;
  }
  if (!Number.isNaN(qtrNum) && qtrNum > 0) {
    return `${qtrNum}/qtr`;
  }
  return 'Available';
}

export function roleLabel(role: string): string {
  const map: Record<string, string> = {
    better_ltf_alternative: 'Lifetime Free Alternative',
    same_tier_competitor: 'Same-Tier Competitor',
    upgrade_alternative: 'Upgrade Option',
    category_standout_alternative: 'Category Standout',
    current_card: 'This Card',
    category_peer: 'Category Peer',
  };
  return map[role] || role.replace(/_/g, ' ');
}

export function formatLoungeSourceType(sourceType?: string | null): string {
  if (!sourceType) return 'Official Source';
  const norm = sourceType.trim().toUpperCase();
  const map: Record<string, string> = {
    OFFICIAL_PDF: 'Official Bank PDF',
    OFFICIAL_BANK_PAGE: 'Official Bank Page',
    CARD_NETWORK_LIST: 'Card Network List',
    OFFICIAL_PARTNER_LIST: 'Official Partner List',
    NETWORK_PORTAL: 'Card Network List',
    ISSUER_PDF: 'Official Bank PDF',
  };
  return map[norm] || sourceType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Multi-word tokenized search: checks that every whitespace-separated token in `query`
 * appears in at least one of the provided fields or arrays.
 */
export function matchesTokenizedQuery(
  query: string,
  ...fields: Array<string | string[] | undefined | null>
): boolean {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return true;
  const hay = fields
    .flatMap((f) => (Array.isArray(f) ? f : f ? [f] : []))
    .join(' ')
    .toLowerCase();
  return tokens.every((tok) => hay.includes(tok));
}
