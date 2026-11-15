import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { LedgerTheme } from '../lib/theme';

export function BrandLogoMark({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <Rect width="36" height="36" rx="9" fill="#0F5C4D" />
      <Rect
        x="7"
        y="10"
        width="22"
        height="16"
        rx="2.5"
        stroke="#FFFFFF"
        strokeWidth="1.9"
      />
      <Path d="M7 15.5H29" stroke="#FFFFFF" strokeWidth="1.9" />
      <Rect x="10.5" y="19" width="5" height="3.2" rx="0.8" fill="#D5EBE3" />
    </Svg>
  );
}

export function BrandWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.row}>
      <BrandLogoMark size={compact ? 25 : 30} />
      <View style={styles.textCol}>
        <View style={styles.titleLine}>
          <Text style={[styles.brandName, compact && { fontSize: 18 }]}>Cardify</Text>
          <Text style={styles.byCogify}>by cogify</Text>
        </View>
        {!compact && (
          <Text style={styles.productTag}>Product of cogify.me ❤️</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textCol: {
    gap: 1,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  brandName: {
    fontSize: 19,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
    letterSpacing: -0.4,
  },
  byCogify: {
    fontSize: 11,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  productTag: {
    fontSize: 10.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkMuted,
  },
});
