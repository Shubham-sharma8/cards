import type { CardSummaryItem } from './types';

/**
 * Split a dense devaluation event summary string into crisp bullet clauses.
 */
export function splitDevalSummaryClauses(summary: string): string[] {
  return summary
    .split(/;\s+|\.\s+(?=[A-Z0-9])/)
    .map((s) => s.trim().replace(/\.$/, ''))
    .filter(Boolean);
}

/**
 * Resolve an affected card mention (e.g. "Emeralde Private Metal", "Magnus") under an issuer to a real card record.
 */
export function matchCardForDevalMention(
  issuer: string,
  mention: string,
  allCards: CardSummaryItem[]
): CardSummaryItem | null {
  const issuerLower = issuer.toLowerCase();
  const mentionLower = mention.toLowerCase().trim();
  const bankPool = allCards.filter(
    (c) =>
      c.bank.toLowerCase().includes(issuerLower) ||
      issuerLower.includes(c.bank.toLowerCase().split(' ')[0])
  );
  const pool = bankPool.length > 0 ? bankPool : allCards;

  const cleanMention = mentionLower.replace(/\bcredit\s*card\b/g, '').trim();
  const exact = pool.find((c) => {
    const cn = c.card_name.toLowerCase();
    return cn === mentionLower || cn.includes(cleanMention);
  });
  if (exact) return exact;

  const tokens = cleanMention.split(/[\s/&+-]+/).filter((t) => t.length >= 2);
  let best: CardSummaryItem | null = null;
  let bestScore = 0;
  for (const c of pool) {
    const hay = `${c.card_name} ${c.card_slug}`.toLowerCase();
    const hits = tokens.filter((t) => hay.includes(t)).length;
    if (hits > bestScore) {
      bestScore = hits;
      best = c;
    }
  }
  return bestScore > 0 ? best : null;
}
