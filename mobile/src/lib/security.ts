import { Linking } from 'react-native';

const SLUG_RE = /^[a-z0-9-]{1,120}$/;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;
const ALLOWED_STATIC_ROUTES = new Set([
  '/',
  '/(tabs)',
  '/(tabs)/index',
  '/(tabs)/finder',
  '/(tabs)/calculator',
  '/(tabs)/lounges',
  '/(tabs)/my-cards',
  '/advisor',
  '/compare',
  '/devaluations',
  '/help',
  '/my-cards',
]);

export function sanitizeHexColor(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  return HEX_COLOR_RE.test(trimmed) ? trimmed : fallback;
}

export function escapeHtml(raw: string | number | null | undefined): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2048) return null;

  if (trimmed.startsWith('tel:')) {
    const digits = trimmed.slice(4).replace(/[^+\d]/g, '');
    return digits.length >= 3 ? `tel:${digits}` : null;
  }

  if (trimmed.startsWith('mailto:')) {
    const addr = trimmed.slice(7).trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr) ? `mailto:${addr}` : null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function openExternalUrlSafely(raw: string | null | undefined): Promise<boolean> {
  const safe = sanitizeExternalUrl(raw);
  if (!safe) return false;
  try {
    await Linking.openURL(safe);
    return true;
  } catch {
    return false;
  }
}

export function isValidLaunchRoute(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 260 || !trimmed.startsWith('/')) return false;
  if (trimmed.startsWith('//') || trimmed.includes('..') || /[\r\n<>"]/.test(trimmed)) return false;

  const [pathname] = trimmed.split('?');
  if (ALLOWED_STATIC_ROUTES.has(pathname)) return true;

  // Match /card/<bankSlug>/<cardSlug>
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 3 && parts[0] === 'card') {
    return SLUG_RE.test(parts[1]) && SLUG_RE.test(parts[2]);
  }
  return false;
}

export function sanitizeLast4Digits(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 4);
}

export function buildWhatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message.trim())}`;
}
