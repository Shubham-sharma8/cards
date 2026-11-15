import type { ImageSourcePropType } from 'react-native';
import { resolveR2MediaUrl } from './mediaCdn';

export type OpenMediaTopic =
  | 'credit-cards'
  | 'airport-lounge'
  | 'golf-course'
  | 'indian-dining'
  | 'airline-business'
  | 'luxury-hotel'
  | 'retail-shopping'
  | 'fuel-station';

const TOPIC_MAP: Record<OpenMediaTopic, { r2Path: string; local: ImageSourcePropType }> = {
  'credit-cards': {
    r2Path: '/illustrations/ai-vault-3d.webp',
    local: require('../../assets/illustrations/ai-vault-3d.webp'),
  },
  'airport-lounge': {
    r2Path: '/open-media/airport-lounge-1.jpg',
    local: require('../../assets/open-media/airport-lounge-1.jpg'),
  },
  'golf-course': {
    r2Path: '/open-media/golf-course-1.jpg',
    local: require('../../assets/open-media/golf-course-1.jpg'),
  },
  'indian-dining': {
    r2Path: '/open-media/indian-dining-1.jpg',
    local: require('../../assets/open-media/indian-dining-1.jpg'),
  },
  'airline-business': {
    r2Path: '/open-media/airline-business-1.jpg',
    local: require('../../assets/open-media/airline-business-1.jpg'),
  },
  'luxury-hotel': {
    r2Path: '/illustrations/lounge-intl-suite.webp',
    local: require('../../assets/illustrations/lounge-intl-suite.webp'),
  },
  'retail-shopping': {
    r2Path: '/open-media/retail-shopping-1.jpg',
    local: require('../../assets/open-media/retail-shopping-1.jpg'),
  },
  'fuel-station': {
    r2Path: '/open-media/fuel-station-1.jpg',
    local: require('../../assets/open-media/fuel-station-1.jpg'),
  },
};

export function resolveOpenMediaTopic(categoryOrQuery: string): OpenMediaTopic {
  const t = categoryOrQuery.toLowerCase();
  if (t.includes('lounge') || t.includes('priority')) return 'airport-lounge';
  if (t.includes('golf')) return 'golf-course';
  if (t.includes('dining') || t.includes('swiggy') || t.includes('zomato') || t.includes('food')) return 'indian-dining';
  if (t.includes('fuel') || t.includes('petrol') || t.includes('hpcl') || t.includes('bpcl') || t.includes('iocl')) return 'fuel-station';
  if (t.includes('hotel') || t.includes('taj') || t.includes('marriott') || t.includes('luxury')) return 'luxury-hotel';
  if (t.includes('travel') || t.includes('flight') || t.includes('airline') || t.includes('miles') || t.includes('forex')) return 'airline-business';
  if (t.includes('shop') || t.includes('amazon') || t.includes('flipkart') || t.includes('grocer') || t.includes('cashback')) return 'retail-shopping';
  return 'credit-cards';
}

export function resolveOpenMediaSource(topicOrLabel: OpenMediaTopic | string): ImageSourcePropType {
  const key = (topicOrLabel in TOPIC_MAP
    ? topicOrLabel
    : resolveOpenMediaTopic(topicOrLabel)) as OpenMediaTopic;
  const entry = TOPIC_MAP[key] || TOPIC_MAP['credit-cards'];
  const r2Url = resolveR2MediaUrl(entry.r2Path);
  if (r2Url) return { uri: r2Url };
  return entry.local;
}
