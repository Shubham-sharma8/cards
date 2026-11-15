import React, { createContext, useContext, useState } from 'react';
import { Platform, Settings } from 'react-native';

export interface CompareItem {
  card_id: string;
  card_name: string;
  bank: string;
  bank_slug: string;
  card_slug: string;
  annual_fee_inr: number;
  overall_rating: number;
}

export interface WalletCardMeta {
  last4Digits?: string;
  nickname?: string;
  renewalDate?: string;
  isLTF?: boolean;
  usedDomesticLounge: number;
  usedInternationalLounge: number;
  usedGolfGames: number;
  usedGolfLessons: number;
  cycleLabel?: string;
}

const EMPTY_WALLET_META: WalletCardMeta = {
  usedDomesticLounge: 0,
  usedInternationalLounge: 0,
  usedGolfGames: 0,
  usedGolfLessons: 0,
};

const COMPARE_KEY = 'cardledger_compare_v1';
const SAVED_KEY = 'cardledger_saved_v1';
const OWNED_KEY = 'cardledger_owned_v1';
const WALLET_META_KEY = 'cardledger_wallet_meta_v1';

function readPersisted<T>(key: string, fallback: T): T {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    }
    if (Platform.OS === 'ios') {
      const raw = Settings.get(key);
      if (typeof raw === 'string' && raw.length > 0) {
        return JSON.parse(raw) as T;
      }
    }
  } catch {
    // Ignore storage read failures
  }
  return fallback;
}

function writePersisted<T>(key: string, value: T): void {
  try {
    const serialized = JSON.stringify(value);
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, serialized);
    } else if (Platform.OS === 'ios') {
      Settings.set({ [key]: serialized });
    }
  } catch {
    // Ignore storage write failures
  }
}

export type UsageCounterField =
  | 'usedDomesticLounge'
  | 'usedInternationalLounge'
  | 'usedGolfGames'
  | 'usedGolfLessons';

interface CompareContextValue {
  items: CompareItem[];
  savedIds: string[];
  ownedIds: string[];
  walletMeta: Record<string, WalletCardMeta>;
  toggleItem: (card: CompareItem) => void;
  removeItem: (cardId: string) => void;
  clearAll: () => void;
  isSelected: (cardId: string) => boolean;
  toggleSaved: (cardId: string) => void;
  isSaved: (cardId: string) => boolean;
  clearSaved: () => void;
  toggleOwned: (cardId: string, last4Digits?: string) => void;
  setOwnedIds: (ids: string[]) => void;
  moveOwnedCard: (cardId: string, direction: 'up' | 'down') => void;
  isOwned: (cardId: string) => boolean;
  clearOwned: () => void;
  updateWalletMeta: (cardId: string, patch: Partial<WalletCardMeta>) => void;
  incrementUsage: (cardId: string, field: UsageCounterField, delta: number) => void;
  resetUsageCycle: (cardId?: string) => void;
}

const CompareContext = createContext<CompareContextValue | null>(null);

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CompareItem[]>(() => readPersisted<CompareItem[]>(COMPARE_KEY, []));
  const [savedIds, setSavedIds] = useState<string[]>(() => readPersisted<string[]>(SAVED_KEY, []));
  const [ownedIds, setOwnedIdsState] = useState<string[]>(() => readPersisted<string[]>(OWNED_KEY, []));
  const [walletMeta, setWalletMeta] = useState<Record<string, WalletCardMeta>>(() =>
    readPersisted<Record<string, WalletCardMeta>>(WALLET_META_KEY, {})
  );

  const toggleItem = (card: CompareItem) => {
    setItems((prev) => {
      const next = prev.some((c) => c.card_id === card.card_id)
        ? prev.filter((c) => c.card_id !== card.card_id)
        : prev.length >= 3
          ? [...prev.slice(1), card]
          : [...prev, card];
      writePersisted(COMPARE_KEY, next);
      return next;
    });
  };

  const removeItem = (cardId: string) => {
    setItems((prev) => {
      const next = prev.filter((c) => c.card_id !== cardId);
      writePersisted(COMPARE_KEY, next);
      return next;
    });
  };

  const clearAll = () => {
    writePersisted(COMPARE_KEY, []);
    setItems([]);
  };
  const isSelected = (cardId: string) => items.some((c) => c.card_id === cardId);

  const toggleSaved = (cardId: string) => {
    setSavedIds((prev) => {
      const next = prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId];
      writePersisted(SAVED_KEY, next);
      return next;
    });
  };
  const isSaved = (cardId: string) => savedIds.includes(cardId);
  const clearSaved = () => {
    writePersisted(SAVED_KEY, []);
    setSavedIds([]);
  };

  const updateWalletMeta = (cardId: string, patch: Partial<WalletCardMeta>) => {
    setWalletMeta((prev) => {
      const cur = prev[cardId] ?? EMPTY_WALLET_META;
      const sanitizedLast4 =
        patch.last4Digits !== undefined
          ? patch.last4Digits.replace(/\D/g, '').slice(0, 4)
          : cur.last4Digits;
      const next: Record<string, WalletCardMeta> = {
        ...prev,
        [cardId]: {
          ...cur,
          ...patch,
          last4Digits: sanitizedLast4,
        },
      };
      writePersisted(WALLET_META_KEY, next);
      return next;
    });
  };

  const toggleOwned = (cardId: string, last4Digits?: string) => {
    setOwnedIdsState((prev) => {
      const exists = prev.includes(cardId);
      const next = exists ? prev.filter((id) => id !== cardId) : [...prev, cardId];
      writePersisted(OWNED_KEY, next);
      if (!exists && last4Digits) {
        updateWalletMeta(cardId, { last4Digits });
      }
      return next;
    });
  };

  const setOwnedIds = (ids: string[]) => {
    const next = Array.from(new Set(ids));
    writePersisted(OWNED_KEY, next);
    setOwnedIdsState(next);
  };
  const moveOwnedCard = (cardId: string, direction: 'up' | 'down') => {
    setOwnedIdsState((prev) => {
      const idx = prev.indexOf(cardId);
      if (idx === -1) return prev;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(target, 0, item);
      writePersisted(OWNED_KEY, copy);
      return copy;
    });
  };
  const isOwned = (cardId: string) => ownedIds.includes(cardId);
  const clearOwned = () => {
    writePersisted(OWNED_KEY, []);
    setOwnedIdsState([]);
  };

  const incrementUsage = (cardId: string, field: UsageCounterField, delta: number) => {
    setWalletMeta((prev) => {
      const cur = prev[cardId] ?? EMPTY_WALLET_META;
      const currentVal = typeof cur[field] === 'number' ? cur[field] : 0;
      const nextVal = Math.max(0, Math.min(99, currentVal + delta));
      const next: Record<string, WalletCardMeta> = {
        ...prev,
        [cardId]: {
          ...cur,
          [field]: nextVal,
        },
      };
      writePersisted(WALLET_META_KEY, next);
      return next;
    });
  };

  const resetUsageCycle = (cardId?: string) => {
    setWalletMeta((prev) => {
      const next: Record<string, WalletCardMeta> = {};
      if (cardId) {
        Object.assign(next, prev);
        next[cardId] = {
          ...(prev[cardId] ?? EMPTY_WALLET_META),
          usedDomesticLounge: 0,
          usedInternationalLounge: 0,
          usedGolfGames: 0,
          usedGolfLessons: 0,
        };
      } else {
        for (const [id, meta] of Object.entries(prev)) {
          next[id] = {
            ...meta,
            usedDomesticLounge: 0,
            usedInternationalLounge: 0,
            usedGolfGames: 0,
            usedGolfLessons: 0,
          };
        }
      }
      writePersisted(WALLET_META_KEY, next);
      return next;
    });
  };

  return (
    <CompareContext.Provider
      value={{
        items,
        savedIds,
        ownedIds,
        walletMeta,
        toggleItem,
        removeItem,
        clearAll,
        isSelected,
        toggleSaved,
        isSaved,
        clearSaved,
        toggleOwned,
        setOwnedIds,
        moveOwnedCard,
        isOwned,
        clearOwned,
        updateWalletMeta,
        incrementUsage,
        resetUsageCycle,
      }}
    >
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) {
    throw new Error('useCompare must be used inside CompareProvider');
  }
  return ctx;
}
