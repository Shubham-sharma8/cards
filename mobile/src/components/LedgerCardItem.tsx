import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Bookmark, Check, ChevronRight, Plus, Star, Wallet } from 'lucide-react-native';
import type { CardSummaryItem } from '../lib/types';
import { formatInr } from '../lib/format';
import { LedgerTheme } from '../lib/theme';
import { BankLogo } from './BankLogo';
import { CardArtwork } from './CardArtwork';
import { useCompare } from './CompareContext';
import { ScalePressable, SelectionCheckPop } from './MotionPrimitives';
import { CanvaFeaturePill, resolveCategoryCanvaIcon, type CanvaIconKey } from './FeatureIcon';

interface LedgerCardItemProps {
  card: CardSummaryItem;
  onPress: (card: CardSummaryItem) => void;
  subtitleNote?: string;
  compact?: boolean;
}

export const LedgerCardItem = React.memo(function LedgerCardItem({
  card,
  onPress,
  subtitleNote,
  compact = false,
}: LedgerCardItemProps) {
  const { isSelected, toggleItem, isSaved, toggleSaved, isOwned, toggleOwned } = useCompare();
  const compared = isSelected(card.card_id);
  const saved = isSaved(card.card_id);
  const owned = isOwned(card.card_id);
  const t = card.filter_tags;

  const peakPct = Object.entries(card.effective_return_pct_by_category || {})
    .filter(([k]) => k !== 'international_forex_net_of_markup')
    .reduce((max, [, v]) => (v > max ? v : max), 0);

  const featurePills: Array<{ icon: CanvaIconKey; label: string }> = [];
  if (owned) featurePills.push({ icon: 'rewards', label: 'In My Wallet' });
  if (t.is_ltf) featurePills.push({ icon: 'cashback', label: 'Lifetime Free' });
  else if (t.is_fyf) featurePills.push({ icon: 'welcome', label: 'First Year Free' });
  if (t.is_rupay_upi) featurePills.push({ icon: 'rewards', label: 'RuPay UPI' });
  if (t.no_spend_domestic_lounge) featurePills.push({ icon: 'lounge', label: 'No-Spend Lounge' });
  else if (t.has_domestic_lounge) featurePills.push({ icon: 'lounge', label: 'Domestic Lounge' });
  if (t.has_golf || card.categories.includes('Golf')) {
    featurePills.push({ icon: 'golf', label: 'Golf Access' });
  }
  if (t.zero_forex) featurePills.push({ icon: 'forex', label: '0% Forex' });
  else if (t.zero_or_low_forex && featurePills.length < 3) {
    featurePills.push({ icon: 'forex', label: 'Low Forex' });
  }
  if (featurePills.length === 0) {
    featurePills.push({
      icon: resolveCategoryCanvaIcon(card.primary_category),
      label: card.primary_category,
    });
  }

  return (
    <ScalePressable
      onPress={() => onPress(card)}
      style={[styles.card, (compared || owned) && styles.cardSelected]}
      accessibilityRole="button"
      accessibilityLabel={`${card.card_name} by ${card.bank}`}
    >
      {/* Subtle Top Theme Hairline Accent */}
      {card.card_theme?.primary_hex ? (
        <View
          style={[
            styles.accentBar,
            { backgroundColor: card.card_theme.primary_hex },
          ]}
        />
      ) : null}

      <View style={styles.topRow}>
        <CardArtwork
          localImagePath={card.local_image_path}
          imageUrl={card.image_url}
          bank={card.bank}
          cardName={card.card_name}
          network={card.card_network}
          cardTheme={card.card_theme}
          size="md"
        />
        <View style={styles.metaCol}>
          <View style={styles.bankRow}>
            <BankLogo bankSlug={card.bank_slug} bank={card.bank} size="xs" />
            <Text numberOfLines={1} style={styles.bankLabel}>
              {card.bank}
            </Text>
          </View>
          <Text numberOfLines={2} style={styles.title}>
            {card.card_name}
          </Text>
          <View style={styles.ratingRow}>
            <View style={styles.ratingBadge}>
              <Star size={12.5} color={LedgerTheme.colors.warn} />
              <Text style={styles.ratingText}>
                {card.overall_rating?.toFixed(2) ?? 'N/A'}
              </Text>
            </View>
            <Text numberOfLines={1} style={styles.categoryText}>
              {card.primary_category}
            </Text>
          </View>
        </View>
      </View>

      {/* Feature Tags */}
      <View style={styles.tagsRow}>
        {featurePills.slice(0, compact ? 2 : 3).map((pill) => (
          <CanvaFeaturePill key={pill.label} icon={pill.icon} label={pill.label} />
        ))}
      </View>

      {!compact && subtitleNote ? (
        <Text numberOfLines={2} style={styles.noteText}>
          {subtitleNote}
        </Text>
      ) : null}

      {/* Clean Non-Overlapping Footer: Metrics Row Above + Actions Row */}
      <View style={styles.footerWrap}>
        <View style={styles.metricsGroup}>
          <View style={styles.metricCol}>
            <Text style={styles.metricLabel}>Annual Fee</Text>
            <Text style={styles.metricVal}>
              {card.annual_fee_inr === 0 ? '₹0 (LTF)' : formatInr(card.annual_fee_inr)}
            </Text>
          </View>
          {peakPct > 0 && (
            <View style={styles.metricCol}>
              <Text style={styles.metricLabel}>Peak Return</Text>
              <Text style={[styles.metricVal, { color: LedgerTheme.colors.accent }]}>
                Up to {peakPct.toFixed(1)}%
              </Text>
            </View>
          )}
        </View>

        {compact ? (
          <View style={styles.compactArrowPill}>
            <Text style={styles.compactArrowText}>View</Text>
            <ChevronRight size={15} color={LedgerTheme.colors.accent} />
          </View>
        ) : (
          <View style={styles.actionsPair}>
            <ScalePressable
              onPress={(e) => {
                e.stopPropagation();
                toggleOwned(card.card_id);
              }}
              style={[styles.saveBtn, owned && styles.compareBtnActive]}
              scaleTo={0.86}
              hitSlop={6}
              accessibilityLabel={owned ? 'Remove from My Wallet' : 'Mark as owned card'}
            >
              <SelectionCheckPop active={owned}>
                <Wallet
                  size={15}
                  color={owned ? LedgerTheme.colors.accent : LedgerTheme.colors.inkSecondary}
                />
              </SelectionCheckPop>
            </ScalePressable>

            <ScalePressable
              onPress={(e) => {
                e.stopPropagation();
                toggleSaved(card.card_id);
              }}
              style={[styles.saveBtn, saved && styles.compareBtnActive]}
              scaleTo={0.86}
              hitSlop={6}
              accessibilityLabel={saved ? 'Remove from saved watchlist' : 'Save card'}
            >
              <SelectionCheckPop active={saved}>
                <Bookmark
                  size={15}
                  color={saved ? LedgerTheme.colors.accent : LedgerTheme.colors.inkSecondary}
                  fill={saved ? LedgerTheme.colors.tintPrimary : 'transparent'}
                />
              </SelectionCheckPop>
            </ScalePressable>

            <ScalePressable
              onPress={(e) => {
                e.stopPropagation();
                toggleItem({
                  card_id: card.card_id,
                  card_name: card.card_name,
                  bank: card.bank,
                  bank_slug: card.bank_slug,
                  card_slug: card.card_slug,
                  annual_fee_inr: card.annual_fee_inr,
                  overall_rating: card.overall_rating,
                });
              }}
              style={[styles.compareBtn, compared && styles.compareBtnSolidActive]}
              scaleTo={0.9}
              hitSlop={6}
            >
              <SelectionCheckPop active={compared}>
                {compared ? (
                  <Check size={14} color="#FFFFFF" />
                ) : (
                  <Plus size={14} color={LedgerTheme.colors.inkSecondary} />
                )}
              </SelectionCheckPop>
              <Text style={[styles.compareBtnText, compared && styles.compareBtnSolidText]}>
                {compared ? 'Added' : 'Compare'}
              </Text>
            </ScalePressable>
          </View>
        )}
      </View>
    </ScalePressable>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: LedgerTheme.radius.lg,
    padding: 18,
    gap: 13,
    overflow: 'hidden',
    position: 'relative',
    ...LedgerTheme.shadow.card,
  },
  cardSelected: {
    borderColor: LedgerTheme.colors.accent,
    backgroundColor: '#F8FCFA',
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    opacity: 0.72,
  },
  topRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  metaCol: {
    flex: 1,
    minWidth: 0,
  },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bankLabel: {
    flex: 1,
    fontSize: 13,
    color: LedgerTheme.colors.inkMuted,
    fontWeight: '400',
  },
  title: {
    fontSize: 17.5,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
    marginTop: 3,
    lineHeight: 23,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LedgerTheme.colors.creamWarm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
  },
  ratingText: {
    fontSize: 13,
    color: LedgerTheme.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
  },
  categoryText: {
    fontSize: 13,
    color: LedgerTheme.colors.inkMuted,
    flex: 1,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  noteText: {
    fontSize: 14,
    color: LedgerTheme.colors.inkSecondary,
    lineHeight: 20,
  },
  footerWrap: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: LedgerTheme.colors.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  metricsGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    flex: 1,
  },
  metricCol: {
    gap: 2,
  },
  metricLabel: {
    fontSize: 11.5,
    color: LedgerTheme.colors.inkMuted,
  },
  metricVal: {
    fontSize: 14.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
  },
  actionsPair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  saveBtn: {
    minHeight: 38,
    minWidth: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 38,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.surface,
  },
  compareBtnActive: {
    borderColor: LedgerTheme.colors.tintBorder,
    backgroundColor: LedgerTheme.colors.tintPrimary,
  },
  compareBtnSolidActive: {
    borderColor: LedgerTheme.colors.accent,
    backgroundColor: LedgerTheme.colors.accent,
  },
  compareBtnSolidText: {
    color: '#FFFFFF',
  },
  compareBtnText: {
    fontSize: 13,
    color: LedgerTheme.colors.inkSecondary,
    fontWeight: '500',
  },
  compactArrowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.tintBorder,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  compactArrowText: {
    fontSize: 13,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
});
