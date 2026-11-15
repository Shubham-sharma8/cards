import React, { useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  AlertTriangle,
  Calculator,
  ChevronRight,
  Compass,
  ExternalLink,
  Headphones,
  LayoutGrid,
  Plane,
  QrCode,
  Scale,
  Search,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react-native';
import { TOTAL_BANKS, TOTAL_CARDS } from '../lib/data';
import { openExternalUrlSafely } from '../lib/security';
import { LedgerTheme } from '../lib/theme';
import { BrandWordmark } from './BrandLogo';
import { useCompare } from './CompareContext';
import { useDrawer } from './DrawerContext';
import { ScalePressable } from './MotionPrimitives';

const DRAWER_WIDTH = 308;

export function SidebarDrawer() {
  const { isOpen, closeDrawer } = useDrawer();
  const { ownedIds, items } = useCompare();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const translateX = useSharedValue(-DRAWER_WIDTH - 20);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (isOpen) {
      translateX.value = withSpring(0, { damping: 22, stiffness: 240, mass: 0.85 });
      backdropOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
    } else {
      translateX.value = withTiming(-DRAWER_WIDTH - 24, {
        duration: 210,
        easing: Easing.in(Easing.quad),
      });
      backdropOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [isOpen, translateX, backdropOpacity]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const goTo = (href: string) => {
    closeDrawer();
    setTimeout(() => {
      router.push(href as never);
    }, 60);
  };

  const navGroups: Array<{
    section: string;
    items: Array<{
      label: string;
      subtitle: string;
      href: string;
      match: string;
      badge?: string;
      Icon: typeof Compass;
    }>;
  }> = [
    {
      section: 'Explore Cardify',
      items: [
        {
          label: 'Discover Home',
          subtitle: 'Top picks, flagship cards & offers',
          href: '/(tabs)',
          match: '/',
          Icon: Compass,
        },
        {
          label: 'Search All Cards',
          subtitle: `${TOTAL_CARDS} cards across ${TOTAL_BANKS} banks`,
          href: '/(tabs)/finder',
          match: '/finder',
          Icon: Search,
        },
        {
          label: 'Spend Categories',
          subtitle: 'Fuel, Cashback, UPI, Travel, Golf',
          href: '/categories',
          match: '/categories',
          Icon: LayoutGrid,
        },
        {
          label: 'Compare Cards',
          subtitle: 'Side-by-side caps & fee audit',
          href: '/compare',
          match: '/compare',
          badge: items.length > 0 ? `${items.length}/3` : undefined,
          Icon: Scale,
        },
      ],
    },
    {
      section: 'Airport Lounge, Golf & Tools',
      items: [
        {
          label: 'Lounge & Golf Hub',
          subtitle: '92 Indian lounges, 30 golf clubs & card matrix',
          href: '/(tabs)/lounges',
          match: '/lounges',
          Icon: Plane,
        },
        {
          label: 'QR Claim Guide',
          subtitle: 'HOI LMS, LoungeOne, TFS, RuPay & Concierge',
          href: '/lounge-guide',
          match: '/lounge-guide',
          Icon: QrCode,
        },
        {
          label: 'AI Card Advisor',
          subtitle: 'Custom portfolio recommendation by spend',
          href: '/advisor',
          match: '/advisor',
          Icon: Sparkles,
        },
        {
          label: 'Spend Calculator',
          subtitle: 'Post-cap net INR return simulator',
          href: '/(tabs)/calculator',
          match: '/calculator',
          Icon: Calculator,
        },
      ],
    },
    {
      section: 'Portfolio & Support',
      items: [
        {
          label: 'My Cards Portfolio',
          subtitle: 'Reorder cards, renewal dates & single-card lounge filter',
          href: '/(tabs)/my-cards',
          match: '/my-cards',
          badge: ownedIds.length > 0 ? `${ownedIds.length}` : undefined,
          Icon: Wallet,
        },
        {
          label: '2026 Devaluation Tracker',
          subtitle: 'Latest issuer rule & cap revisions',
          href: '/devaluations',
          match: '/devaluations',
          Icon: AlertTriangle,
        },
        {
          label: 'Bank Helplines & PNO',
          subtitle: 'Customer care numbers & RBI Ombudsman',
          href: '/help',
          match: '/help',
          Icon: Headphones,
        },
      ],
    },
  ];

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          zIndex: 140,
          pointerEvents: isOpen ? 'auto' : 'none',
        },
      ]}
    >
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={closeDrawer}
          accessibilityLabel="Close navigation drawer"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.drawerPanel,
          {
            paddingTop: Math.max(insets.top, 14) + 8,
            paddingBottom: Math.max(insets.bottom, 14),
          },
          panelStyle,
        ]}
      >
        {/* Top Brand Identity */}
        <View style={styles.drawerHeader}>
          <BrandWordmark />
          <ScalePressable
            onPress={closeDrawer}
            hitSlop={10}
            style={styles.closeBtn}
            accessibilityLabel="Close sidebar menu"
          >
            <X size={18} color={LedgerTheme.colors.inkSecondary} />
          </ScalePressable>
        </View>

        {/* Wallet Snapshot Strip */}
        <ScalePressable
          onPress={() => goTo('/(tabs)/my-cards')}
          style={styles.walletBanner}
        >
          <View style={styles.walletBannerLeft}>
            <Wallet size={16} color={LedgerTheme.colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.walletBannerTitle}>
                My Cards ({ownedIds.length} saved)
              </Text>
              <Text style={styles.walletBannerSub} numberOfLines={1}>
                {ownedIds.length > 0
                  ? 'Tap to reorder cards, track renewal & check lounge perks'
                  : 'Add your credit cards for live lounge & reward verdicts'}
              </Text>
            </View>
          </View>
          <ChevronRight size={15} color={LedgerTheme.colors.accent} />
        </ScalePressable>

        {/* Navigation Links */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {navGroups.map((group) => (
            <View key={group.section} style={styles.groupBlock}>
              <Text style={styles.groupLabel}>{group.section}</Text>
              {group.items.map((item) => {
                const active =
                  item.match === '/'
                    ? pathname === '/' || pathname === '/index'
                    : pathname?.startsWith(item.match);
                const Icon = item.Icon;
                return (
                  <ScalePressable
                    key={item.href}
                    onPress={() => goTo(item.href)}
                    style={[styles.navRow, active && styles.navRowActive]}
                  >
                    <View style={[styles.navIconWrap, active && styles.navIconWrapActive]}>
                      <Icon
                        size={17}
                        color={active ? '#FFFFFF' : LedgerTheme.colors.accent}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.navTitleRow}>
                        <Text
                          numberOfLines={1}
                          style={[styles.navTitle, active && styles.navTitleActive]}
                        >
                          {item.label}
                        </Text>
                        {item.badge ? (
                          <View style={styles.badgePill}>
                            <Text style={styles.badgeText}>{item.badge}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text numberOfLines={1} style={styles.navSub}>
                        {item.subtitle}
                      </Text>
                    </View>
                  </ScalePressable>
                );
              })}
            </View>
          ))}
        </ScrollView>

        {/* Product of cogify Footer */}
        <ScalePressable
          onPress={() => openExternalUrlSafely('https://card.cogify.me')}
          style={styles.drawerFooter}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.footerBrand}>Cardify · A product of cogify.me ❤️</Text>
            <Text style={styles.footerUrl}>card.cogify.me · {TOTAL_CARDS} Cards Database</Text>
          </View>
          <ExternalLink size={14} color={LedgerTheme.colors.accent} />
        </ScalePressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(17, 24, 39, 0.44)',
  },
  drawerPanel: {
    width: DRAWER_WIDTH,
    maxWidth: '86%',
    height: '100%',
    backgroundColor: LedgerTheme.colors.surface,
    borderRightWidth: 1,
    borderRightColor: LedgerTheme.colors.hairline,
    paddingHorizontal: 16,
    gap: 12,
    ...LedgerTheme.shadow.card,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: LedgerTheme.colors.hairline,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: LedgerTheme.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.tintBorder,
    borderRadius: LedgerTheme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  walletBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
  },
  walletBannerTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: LedgerTheme.colors.accentDark,
  },
  walletBannerSub: {
    fontSize: 11,
    color: LedgerTheme.colors.inkSecondary,
  },
  scrollContent: {
    gap: 16,
    paddingBottom: 14,
  },
  groupBlock: {
    gap: 4,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: LedgerTheme.colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: LedgerTheme.radius.md,
  },
  navRowActive: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.tintBorder,
  },
  navIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconWrapActive: {
    backgroundColor: LedgerTheme.colors.accent,
  },
  navTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: LedgerTheme.colors.inkPrimary,
    flexShrink: 1,
  },
  navTitleActive: {
    color: LedgerTheme.colors.accentDark,
  },
  badgePill: {
    backgroundColor: LedgerTheme.colors.accent,
    borderRadius: 99,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  navSub: {
    fontSize: 11.5,
    color: LedgerTheme.colors.inkMuted,
  },
  drawerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: LedgerTheme.colors.hairline,
  },
  footerBrand: {
    fontSize: 12.5,
    fontWeight: '600',
    color: LedgerTheme.colors.inkPrimary,
  },
  footerUrl: {
    fontSize: 11,
    color: LedgerTheme.colors.accent,
  },
});
