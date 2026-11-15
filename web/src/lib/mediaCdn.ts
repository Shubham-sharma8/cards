const RAW_R2_PUBLIC_URL = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "").trim().replace(/\/+$/, "");

/**
 * Resolves a local `/...` or `data/assets/card_images/...` asset path to
 * the configured Cloudflare R2 public URL when `NEXT_PUBLIC_R2_PUBLIC_URL`
 * is set, falling back to local `/...` paths in `web/public`.
 */
export function resolveMediaUrl(pathOrCardAsset: string | null | undefined): string | null {
  if (!pathOrCardAsset) return null;
  let normalized = pathOrCardAsset.trim();
  const cardPrefix = "data/assets/card_images/";
  if (normalized.startsWith(cardPrefix)) {
    normalized = `/card-images/${normalized.slice(cardPrefix.length)}`;
  }
  if (!normalized.startsWith("/")) {
    return normalized;
  }
  if (RAW_R2_PUBLIC_URL && /^https?:\/\//i.test(RAW_R2_PUBLIC_URL)) {
    return `${RAW_R2_PUBLIC_URL}${normalized}`;
  }
  return normalized;
}
