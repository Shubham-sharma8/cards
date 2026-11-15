import React from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType, type ViewStyle } from 'react-native';

export interface BankLogoProps {
  bankSlug?: string;
  bank?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  style?: ViewStyle;
}

const SLUG_SIZE_PX: Record<NonNullable<BankLogoProps['size']>, number> = {
  xs: 18,
  sm: 22,
  md: 28,
  lg: 40,
  xl: 72,
  '2xl': 88,
};

/* eslint-disable @typescript-eslint/no-require-imports */
const BANK_LOGO_ASSETS: Record<string, ImageSourcePropType> = {
  'american-express': require('../../assets/logos/banks/american-express.png'),
  'au-small-finance-bank': require('../../assets/logos/banks/au-small-finance-bank.png'),
  'axis-bank': require('../../assets/logos/banks/axis-bank.png'),
  'bandhan-bank': require('../../assets/logos/banks/bandhan-bank.png'),
  'bank-of-india': require('../../assets/logos/banks/bank-of-india.png'),
  'bank-of-maharashtra': require('../../assets/logos/banks/bank-of-maharashtra.png'),
  'bobcard-bank-of-baroda': require('../../assets/logos/banks/bobcard-bank-of-baroda.png'),
  'canara-bank': require('../../assets/logos/banks/canara-bank.png'),
  'central-bank-of-india': require('../../assets/logos/banks/central-bank-of-india.png'),
  'csb-bank': require('../../assets/logos/banks/csb-bank.png'),
  'dbs-bank': require('../../assets/logos/banks/dbs-bank.png'),
  'federal-bank-scapia': require('../../assets/logos/banks/federal-bank-scapia.png'),
  'federal-bank': require('../../assets/logos/banks/federal-bank.png'),
  'hdfc-bank': require('../../assets/logos/banks/hdfc-bank.png'),
  'hsbc-bank': require('../../assets/logos/banks/hsbc-bank.png'),
  'icici-bank': require('../../assets/logos/banks/icici-bank.png'),
  'idbi-bank': require('../../assets/logos/banks/idbi-bank.png'),
  'idfc-first-bank': require('../../assets/logos/banks/idfc-first-bank.png'),
  'indian-bank': require('../../assets/logos/banks/indian-bank.png'),
  'indian-overseas-bank': require('../../assets/logos/banks/indian-overseas-bank.png'),
  'indusind-bank': require('../../assets/logos/banks/indusind-bank.png'),
  'karur-vysya-bank': require('../../assets/logos/banks/karur-vysya-bank.png'),
  'kotak-mahindra-bank': require('../../assets/logos/banks/kotak-mahindra-bank.png'),
  'lic-cards-axis-bank': require('../../assets/logos/banks/lic-cards-axis-bank.png'),
  'onecard-co-branded': require('../../assets/logos/banks/onecard-co-branded.png'),
  'punjab-national-bank': require('../../assets/logos/banks/punjab-national-bank.png'),
  'rbl-bank': require('../../assets/logos/banks/rbl-bank.png'),
  'sbi-card': require('../../assets/logos/banks/sbi-card.png'),
  'sbm-bank-india': require('../../assets/logos/banks/sbm-bank-india.png'),
  'slice-small-finance-bank': require('../../assets/logos/banks/slice-small-finance-bank.png'),
  'south-indian-bank': require('../../assets/logos/banks/south-indian-bank.png'),
  'standard-chartered-bank': require('../../assets/logos/banks/standard-chartered-bank.png'),
  'tamilnad-mercantile-bank': require('../../assets/logos/banks/tamilnad-mercantile-bank.png'),
  'uco-bank': require('../../assets/logos/banks/uco-bank.png'),
  'union-bank-of-india': require('../../assets/logos/banks/union-bank-of-india.png'),
  'unity-small-finance-bank': require('../../assets/logos/banks/unity-small-finance-bank.png'),
  'utkarsh-small-finance-bank': require('../../assets/logos/banks/utkarsh-small-finance-bank.png'),
  'yes-bank': require('../../assets/logos/banks/yes-bank.png'),
};

export function resolveBankSlug(bankSlug?: string, bank?: string): string {
  if (bankSlug) {
    const clean = bankSlug.toLowerCase().trim();
    if (BANK_LOGO_ASSETS[clean]) return clean;
  }
  const b = (bank || bankSlug || '').toLowerCase().trim();
  if (!b) return 'default';
  if (b.includes('hdfc')) return 'hdfc-bank';
  if (b.includes('icici')) return 'icici-bank';
  if (b.includes('sbi')) return 'sbi-card';
  if (b.includes('lic')) return 'lic-cards-axis-bank';
  if (b.includes('axis')) return 'axis-bank';
  if (b.includes('kotak')) return 'kotak-mahindra-bank';
  if (b.includes('indusind')) return 'indusind-bank';
  if (b.includes('idfc')) return 'idfc-first-bank';
  if (b.includes('yes')) return 'yes-bank';
  if (b.includes('american express') || b.includes('amex')) return 'american-express';
  if (b.includes('hsbc')) return 'hsbc-bank';
  if (b.includes('standard chartered')) return 'standard-chartered-bank';
  if (b.includes('rbl')) return 'rbl-bank';
  if (b.includes('au small') || b === 'au bank') return 'au-small-finance-bank';
  if (b.includes('bob') || b.includes('baroda')) return 'bobcard-bank-of-baroda';
  if (b.includes('punjab') || b.includes('pnb')) return 'punjab-national-bank';
  if (b.includes('scapia')) return 'federal-bank-scapia';
  if (b.includes('federal')) return 'federal-bank';
  if (b.includes('onecard')) return 'onecard-co-branded';
  if (b.includes('dbs')) return 'dbs-bank';
  if (b.includes('canara')) return 'canara-bank';
  if (b.includes('union bank')) return 'union-bank-of-india';
  if (b.includes('bank of india')) return 'bank-of-india';
  if (b.includes('maharashtra')) return 'bank-of-maharashtra';
  if (b.includes('indian overseas') || b.includes('iob')) return 'indian-overseas-bank';
  if (b.includes('indian bank')) return 'indian-bank';
  if (b.includes('central bank')) return 'central-bank-of-india';
  if (b.includes('idbi')) return 'idbi-bank';
  if (b.includes('uco')) return 'uco-bank';
  if (b.includes('karur') || b.includes('kvb')) return 'karur-vysya-bank';
  if (b.includes('south indian') || b.includes('sib')) return 'south-indian-bank';
  if (b.includes('csb')) return 'csb-bank';
  if (b.includes('tamilnad') || b.includes('tmb')) return 'tamilnad-mercantile-bank';
  if (b.includes('sbm')) return 'sbm-bank-india';
  if (b.includes('slice')) return 'slice-small-finance-bank';
  if (b.includes('bandhan')) return 'bandhan-bank';
  if (b.includes('unity')) return 'unity-small-finance-bank';
  if (b.includes('utkarsh')) return 'utkarsh-small-finance-bank';
  return 'default';
}

export function BankLogo({ bankSlug, bank, size = 'sm', style }: BankLogoProps) {
  const px = SLUG_SIZE_PX[size];
  const resolved = resolveBankSlug(bankSlug, bank);
  const asset = BANK_LOGO_ASSETS[resolved];
  const monogram = (bank || bankSlug || 'BK').trim().slice(0, 2).toUpperCase();

  const cornerRadius = size === 'xs' ? 4 : size === 'xl' || size === '2xl' ? 16 : 6;
  const innerPad = size === 'xs' ? 1 : size === 'xl' || size === '2xl' ? 6 : 2;

  return (
    <View
      style={[
        styles.wrap,
        {
          width: px,
          height: px,
          borderRadius: cornerRadius,
          padding: innerPad,
        },
        style,
      ]}
    >
      {asset ? (
        <Image
          source={asset}
          style={{ width: px - innerPad * 2, height: px - innerPad * 2 }}
          resizeMode="contain"
          accessibilityLabel={bank ? `${bank} logo` : 'Bank logo'}
        />
      ) : (
        <View style={styles.fallbackBadge}>
          <Text style={[styles.fallbackText, { fontSize: Math.max(8, Math.round(px * 0.42)) }]}>
            {monogram}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4DF',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackBadge: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF6F3',
  },
  fallbackText: {
    color: '#0F5C4D',
    fontWeight: '500',
  },
});
