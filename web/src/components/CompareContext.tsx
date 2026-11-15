"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

export interface CompareSelection {
  card_id: string;
  card_name: string;
  bank: string;
  bank_slug: string;
  card_slug: string;
  annual_fee_inr: number;
  overall_rating: number;
}

interface CompareContextValue {
  items: CompareSelection[];
  toggleItem: (card: CompareSelection) => void;
  removeItem: (cardId: string) => void;
  clearAll: () => void;
  isSelected: (cardId: string) => boolean;
  savedIds: string[];
  toggleSaved: (cardId: string) => void;
  isSaved: (cardId: string) => boolean;
  clearSaved: () => void;
  ownedIds: string[];
  toggleOwned: (cardId: string) => void;
  isOwned: (cardId: string) => boolean;
  setOwnedIds: React.Dispatch<React.SetStateAction<string[]>>;
  clearOwned: () => void;
}

const CompareContext = createContext<CompareContextValue | null>(null);
const STORAGE_KEY = "cardledger_compare_v1";
const SAVED_STORAGE_KEY = "cardledger_saved_v1";
const OWNED_STORAGE_KEY = "cardledger_owned_v1";

const EMPTY_ITEMS: CompareSelection[] = [];
const EMPTY_IDS: string[] = [];
const emptySubscribe = () => () => {};

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const isHydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const [rawItems, setItems] = useState<CompareSelection[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.slice(0, 3);
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });

  const [rawSavedIds, setSavedIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(SAVED_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((id): id is string => typeof id === "string").slice(0, 40);
        }
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });

  const [rawOwnedIds, setOwnedIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(OWNED_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((id): id is string => typeof id === "string").slice(0, 25);
        }
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });

  const items = isHydrated ? rawItems : EMPTY_ITEMS;
  const savedIds = isHydrated ? rawSavedIds : EMPTY_IDS;
  const ownedIds = isHydrated ? rawOwnedIds : EMPTY_IDS;

  useEffect(() => {
    if (!isHydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rawItems));
    } catch {
      // ignore storage errors
    }
  }, [isHydrated, rawItems]);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      window.localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(rawSavedIds));
    } catch {
      // ignore storage errors
    }
  }, [isHydrated, rawSavedIds]);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      window.localStorage.setItem(OWNED_STORAGE_KEY, JSON.stringify(rawOwnedIds));
    } catch {
      // ignore storage errors
    }
  }, [isHydrated, rawOwnedIds]);

  const toggleItem = (card: CompareSelection) => {
    setItems((prev) => {
      const exists = prev.some((c) => c.card_id === card.card_id);
      if (exists) return prev.filter((c) => c.card_id !== card.card_id);
      if (prev.length >= 3) {
        return [...prev.slice(1), card];
      }
      return [...prev, card];
    });
  };

  const removeItem = (cardId: string) => {
    setItems((prev) => prev.filter((c) => c.card_id !== cardId));
  };

  const clearAll = () => setItems([]);

  const isSelected = (cardId: string) => items.some((c) => c.card_id === cardId);

  const toggleSaved = (cardId: string) => {
    setSavedIds((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [cardId, ...prev].slice(0, 40)
    );
  };

  const isSaved = (cardId: string) => savedIds.includes(cardId);

  const clearSaved = () => setSavedIds([]);

  const toggleOwned = (cardId: string) => {
    setOwnedIds((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId].slice(0, 25)
    );
  };

  const isOwned = (cardId: string) => ownedIds.includes(cardId);

  const clearOwned = () => setOwnedIds([]);

  return (
    <CompareContext.Provider
      value={{
        items,
        toggleItem,
        removeItem,
        clearAll,
        isSelected,
        savedIds,
        toggleSaved,
        isSaved,
        clearSaved,
        ownedIds,
        toggleOwned,
        isOwned,
        setOwnedIds,
        clearOwned,
      }}
    >
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) {
    throw new Error("useCompare must be used inside CompareProvider");
  }
  return ctx;
}
