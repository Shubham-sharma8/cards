"use client";

import { useEffect, useState } from "react";
import type { CardSummaryItem, SearchIndexPayload } from "./types";

const DEFAULT_R2_BASE = "https://media.card.cogify.me";

function getClientR2Base(): string {
  const envUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim();
  return (envUrl && envUrl.length > 0 ? envUrl : DEFAULT_R2_BASE).replace(/\/+$/, "");
}

let cachedCardsClient: CardSummaryItem[] | null = null;
let inflightCardsClient: Promise<CardSummaryItem[] | null> | null = null;

const r2JsonCache = new Map<string, unknown>();
const r2JsonInflight = new Map<string, Promise<unknown>>();

async function loadFullCardsClient(): Promise<CardSummaryItem[] | null> {
  if (cachedCardsClient) return cachedCardsClient;
  if (inflightCardsClient) return inflightCardsClient;

  inflightCardsClient = (async () => {
    for (const url of ["/data/search-index.json", `${getClientR2Base()}/meta/search_index.json`]) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = (await res.json()) as SearchIndexPayload;
        if (Array.isArray(data?.cards) && data.cards.length > 0) {
          cachedCardsClient = data.cards;
          return data.cards;
        }
      } catch {
        // Try next source
      }
    }
    return null;
  })().finally(() => {
    inflightCardsClient = null;
  });

  return inflightCardsClient;
}

/**
 * Hydrates a sliced SSR card list to the full 515-card index once in browser memory.
 * Keeps static HTML/RSC payloads under 500 KB while preserving full client filtering/search.
 */
export function useFullCards(initialCards: CardSummaryItem[], fullThreshold = 400): CardSummaryItem[] {
  const [cards, setCards] = useState<CardSummaryItem[]>(() =>
    initialCards.length >= fullThreshold ? initialCards : cachedCardsClient ?? initialCards
  );

  useEffect(() => {
    if (initialCards.length >= fullThreshold || cachedCardsClient) return;
    let cancelled = false;
    void loadFullCardsClient().then((loaded) => {
      if (!cancelled && loaded && loaded.length > initialCards.length) {
        setCards(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [initialCards, fullThreshold]);

  return cards;
}

async function loadR2JsonClient<T>(relPath: string): Promise<T | null> {
  const cleanPath = relPath.replace(/^\/+/, "");
  if (r2JsonCache.has(cleanPath)) return r2JsonCache.get(cleanPath) as T;
  const existing = r2JsonInflight.get(cleanPath);
  if (existing) return (await existing) as T | null;

  const job = (async (): Promise<T | null> => {
    try {
      const res = await fetch(`${getClientR2Base()}/${cleanPath}`);
      if (!res.ok) return null;
      const json = (await res.json()) as T;
      r2JsonCache.set(cleanPath, json);
      return json;
    } catch {
      return null;
    } finally {
      r2JsonInflight.delete(cleanPath);
    }
  })();

  r2JsonInflight.set(cleanPath, job);
  return job;
}

/**
 * Lazily hydrates a large static metadata JSON (e.g. advisor_meta_map, lounge_access_master)
 * from Cloudflare R2 CDN in the browser when the SSR page intentionally passed a trimmed subset.
 */
export function useFullR2Json<T>(
  relPath: string,
  initialValue: T,
  needsHydration: boolean
): T {
  const cleanPath = relPath.replace(/^\/+/, "");
  const [data, setData] = useState<T>(() =>
    !needsHydration ? initialValue : (r2JsonCache.get(cleanPath) as T | undefined) ?? initialValue
  );

  useEffect(() => {
    if (!needsHydration || r2JsonCache.has(cleanPath)) return;
    let cancelled = false;
    void loadR2JsonClient<T>(cleanPath).then((loaded) => {
      if (!cancelled && loaded) {
        setData(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [cleanPath, needsHydration]);

  return data;
}
