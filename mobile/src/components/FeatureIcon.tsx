import React from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { LedgerTheme } from '../lib/theme';

export type CanvaIconKey =
  | 'travel'
  | 'lounge'
  | 'rewards'
  | 'welcome'
  | 'cashback'
  | 'fuel'
  | 'shopping'
  | 'forex'
  | 'golf'
  | 'insurance'
  | 'upi'
  | 'dining'
  | 'grocery'
  | 'devaluation'
  | 'wallet'
  | 'mitc';

const CANVA_ICONS: Record<CanvaIconKey, ImageSourcePropType> = {
  travel: require('../../assets/icons/canva/travel.png'),
  lounge: require('../../assets/icons/canva/lounge.png'),
  rewards: require('../../assets/icons/canva/rewards.png'),
  welcome: require('../../assets/icons/canva/welcome.png'),
  cashback: require('../../assets/icons/canva/cashback.png'),
  fuel: require('../../assets/icons/canva/fuel.png'),
  shopping: require('../../assets/icons/canva/shopping.png'),
  forex: require('../../assets/icons/canva/forex.png'),
  golf: require('../../assets/icons/canva/golf.png'),
  insurance: require('../../assets/icons/canva/insurance.png'),
  upi: require('../../assets/icons/canva/upi.png'),
  dining: require('../../assets/icons/canva/dining.png'),
  grocery: require('../../assets/icons/canva/grocery.png'),
  devaluation: require('../../assets/icons/canva/devaluation.png'),
  wallet: require('../../assets/icons/canva/wallet.png'),
  mitc: require('../../assets/icons/canva/mitc.png'),
};

interface CanvaFeatureIconProps {
  icon: CanvaIconKey;
  size?: number;
}

export function CanvaFeatureIcon({ icon, size = 18 }: CanvaFeatureIconProps) {
  return (
    <Image
      source={CANVA_ICONS[icon]}
      style={{ width: size, height: size, resizeMode: 'contain' }}
      accessibilityIgnoresInvertColors
    />
  );
}

interface CanvaFeaturePillProps {
  icon: CanvaIconKey;
  label: string;
  tone?: 'blue' | 'neutral';
}

export function CanvaFeaturePill({
  icon,
  label,
  tone = 'blue',
}: CanvaFeaturePillProps) {
  return (
    <View
      style={[
        styles.pill,
        tone === 'blue' ? styles.pillBlue : styles.pillNeutral,
      ]}
    >
      <CanvaFeatureIcon icon={icon} size={14} />
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

export function resolveBenefitCanvaIcon(titleOrText: string): CanvaIconKey {
  const t = titleOrText.toLowerCase();
  if (t.includes('mitc') || t.includes('terms') || t.includes('schedule') || t.includes('policy')) {
    return 'mitc';
  }
  if (t.includes('devaluat') || t.includes('warning') || t.includes('capping') || t.includes('revision')) {
    return 'devaluation';
  }
  if (t.includes('wallet') || t.includes('portfolio')) {
    return 'wallet';
  }
  if (t.includes('insur') || t.includes('shield') || t.includes('air accident') || t.includes('cover')) {
    return 'insurance';
  }
  if (t.includes('upi') || t.includes('rupay') || t.includes('scan') || t.includes('gpay') || t.includes('phonepe')) {
    return 'upi';
  }
  if (t.includes('dining') || t.includes('restaurant') || t.includes('swiggy') || t.includes('zomato') || t.includes('eazydiner')) {
    return 'dining';
  }
  if (t.includes('grocer') || t.includes('instamart') || t.includes('blinkit') || t.includes('zepto') || t.includes('bigbasket')) {
    return 'grocery';
  }
  if (t.includes('welcome') || t.includes('joining') || t.includes('gift') || t.includes('voucher')) {
    return 'welcome';
  }
  if (t.includes('golf') || t.includes('green fee') || t.includes('tee-off')) {
    return 'golf';
  }
  if (t.includes('lounge') || t.includes('priority pass') || t.includes('railway')) {
    return 'lounge';
  }
  if (t.includes('fuel') || t.includes('petrol') || t.includes('diesel') || t.includes('surcharge')) {
    return 'fuel';
  }
  if (t.includes('forex') || t.includes('international') || t.includes('currency') || t.includes('markup')) {
    return 'forex';
  }
  if (t.includes('cashback') || t.includes('bill') || t.includes('utility')) {
    return 'cashback';
  }
  if (t.includes('shop') || t.includes('amazon') || t.includes('flipkart') || t.includes('myntra') || t.includes('movie')) {
    return 'shopping';
  }
  if (t.includes('travel') || t.includes('flight') || t.includes('hotel') || t.includes('airline') || t.includes('miles')) {
    return 'travel';
  }
  return 'rewards';
}

export function resolveCategoryCanvaIcon(categoryIdOrName: string): CanvaIconKey {
  const t = categoryIdOrName.toLowerCase();
  if (t.includes('golf')) return 'golf';
  if (t.includes('dining') || t.includes('restaurant')) return 'dining';
  if (t.includes('grocer') || t.includes('supermarket')) return 'grocery';
  if (t.includes('insur')) return 'insurance';
  if (t.includes('rupay') || t.includes('upi')) return 'upi';
  if (t.includes('fuel')) return 'fuel';
  if (t.includes('lounge')) return 'lounge';
  if (t.includes('forex')) return 'forex';
  if (t.includes('travel') || t.includes('miles')) return 'travel';
  if (t.includes('cashback') || t.includes('ltf') || t.includes('lifetime free') || t.includes('utilit') || t.includes('beginner')) {
    return 'cashback';
  }
  if (t.includes('shop') || t.includes('movie')) {
    return 'shopping';
  }
  return 'rewards';
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  pillBlue: {
    backgroundColor: LedgerTheme.colors.blueSoftBg,
    borderColor: LedgerTheme.colors.blueSoftBorder,
  },
  pillNeutral: {
    backgroundColor: LedgerTheme.colors.canvas,
    borderColor: LedgerTheme.colors.hairline,
  },
  pillText: {
    fontSize: 11.5,
    color: LedgerTheme.colors.inkPrimary,
    fontWeight: '400',
  },
});
