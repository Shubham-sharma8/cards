const SLUG_RE = /^[a-z0-9-]{1,120}$/;
const CARD_ID_RE = /^[a-z0-9_-]{1,150}$/;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;

export function isValidSlug(value: string): boolean {
  return SLUG_RE.test(value);
}

export function isValidCardId(value: string): boolean {
  return CARD_ID_RE.test(value);
}

export function sanitizeCardIdList(raw: string | null | undefined, max = 3): string[] {
  if (!raw || raw.length > 500) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed || !CARD_ID_RE.test(trimmed) || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= max) break;
  }
  return out;
}

export function sanitizeHexColor(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  return HEX_COLOR_RE.test(trimmed) ? trimmed : fallback;
}

export function sanitizeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2048) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function sanitizeExternalHref(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2048) return null;
  if (trimmed.startsWith("tel:")) {
    const cleaned = trimmed.slice(4).replace(/[^+\d]/g, "");
    return cleaned.length >= 3 ? `tel:${cleaned}` : null;
  }
  if (trimmed.startsWith("mailto:")) {
    const addr = trimmed.slice(7).trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr) ? `mailto:${addr}` : null;
  }
  return sanitizeHttpUrl(trimmed);
}

export function sanitizeImageSrc(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2048) return null;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }
  return sanitizeHttpUrl(trimmed);
}

export function escapeHtml(raw: string | number | null | undefined): string {
  return String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Prevents </script> HTML breakout & Unicode line-terminator injection inside JSON-LD <script>.
 */
export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function buildWhatsAppShareHref(text: string, url?: string): string {
  const cleanText = text.trim();
  const cleanUrl = url ? sanitizeHttpUrl(url) : null;
  const payload = cleanUrl ? `${cleanText}\n\n${cleanUrl}` : cleanText;
  return `https://wa.me/?text=${encodeURIComponent(payload)}`;
}
