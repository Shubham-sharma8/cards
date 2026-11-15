import type { MobileCardDossier } from './types';

const RAW_R2_PUBLIC_URL = (process.env.EXPO_PUBLIC_R2_PUBLIC_URL || '')
  .trim()
  .replace(/\/+$/, '');

const remoteJsonCache = new Map<string, unknown>();

export function hasR2CdnConfigured(): boolean {
  return Boolean(RAW_R2_PUBLIC_URL && /^https?:\/\//i.test(RAW_R2_PUBLIC_URL));
}

/**
 * Resolves a `/lounge-photos/...`, `/golf-photos/...`, or `data/assets/card_images/...`
 * path to the public Cloudflare R2 URL when `EXPO_PUBLIC_R2_PUBLIC_URL` is configured.
 */
export function resolveR2MediaUrl(pathOrCardAsset?: string | null): string | null {
  if (!pathOrCardAsset || !hasR2CdnConfigured()) return null;
  let normalized = pathOrCardAsset.trim();
  const cardPrefix = 'data/assets/card_images/';
  if (normalized.startsWith(cardPrefix)) {
    normalized = `/card-images/${normalized.slice(cardPrefix.length)}`;
  }
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }
  return `${RAW_R2_PUBLIC_URL}${normalized}`;
}

export async function fetchR2Json<T>(relativePath: string): Promise<T | null> {
  if (!hasR2CdnConfigured()) return null;
  const normalized = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  if (remoteJsonCache.has(normalized)) {
    return remoteJsonCache.get(normalized) as T;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5500);
  try {
    const res = await fetch(`${RAW_R2_PUBLIC_URL}${normalized}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as T;
    remoteJsonCache.set(normalized, data);
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchRemoteCardDossier(cardId: string): Promise<MobileCardDossier | null> {
  const safeId = cardId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeId) return null;
  return fetchR2Json<MobileCardDossier>(`/dossiers/${safeId}.json`);
}
