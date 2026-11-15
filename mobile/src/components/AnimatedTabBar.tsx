import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  FadeInDown,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { ArrowRight, Scale, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LedgerTheme } from '../lib/theme';
import { useCompare } from './CompareContext';

export interface AnimatedTabBarProps {
  state: {
    index: number;
    routes: Array<{ key: string; name: string; params?: object }>;
  };
  descriptors: Record<
    string,
    {
      options: {
        title?: string;
        tabBarLabel?: string | ((...args: never[]) => React.ReactNode);
        tabBarAccessibilityLabel?: string;
        tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => React.ReactNode;
      };
    }
  >;
  emitter?: {
    emit: (event: { type: string; target?: string; canPreventDefault?: boolean }) => {
      defaultPrevented?: boolean;
    };
  };
  navigateToTab?: (key: string) => void;
  navigation?: {
    emit: (event: { type: string; target?: string; canPreventDefault?: boolean }) => {
      defaultPrevented?: boolean;
    };
    navigate: (name: string, params?: object) => void;
  };
}

/**
 * Custom animated floating-pill bottom tab bar supporting both Expo SDK 58 BottomTabView
 * (`emitter` + `navigateToTab`) and legacy `navigation` props, plus a live Floating Compare Dock.
 */
export function AnimatedTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  navigation,
}: AnimatedTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);
  const [barWidth, setBarWidth] = useState(0);
  const { items, removeItem, clearAll } = useCompare();

  const visibleRoutes = state.routes.filter((r) => {
    const opts = descriptors[r.key]?.options as { href?: string | null; hidden?: boolean } | undefined;
    return opts?.hidden !== true && opts?.href !== null;
  });
  const activeRouteKey = state.routes[state.index]?.key;
  const activeVisibleIdx = Math.max(
    0,
    visibleRoutes.findIndex((r) => r.key === activeRouteKey)
  );

  const tabCount = Math.max(1, visibleRoutes.length);
  const horizontalPad = 8;
  const tabWidth = barWidth > 0 ? (barWidth - horizontalPad * 2) / tabCount : 0;
  const activeX = useSharedValue(0);

  useEffect(() => {
    if (tabWidth > 0) {
      activeX.value = withSpring(activeVisibleIdx * tabWidth, {
        damping: 20,
        stiffness: 230,
        mass: 0.85,
      });
    }
  }, [activeVisibleIdx, tabWidth, activeX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: activeX.value }],
  }));

  return (
    <View style={styles.wrapper}>
      {items.length > 0 && (
        <Animated.View
          entering={FadeInDown.duration(220)}
          exiting={FadeOutDown.duration(160)}
          style={styles.compareDock}
        >
          <View style={styles.dockLeft}>
            <View style={styles.dockBadge}>
              <Scale size={12} color={LedgerTheme.colors.accent} />
              <Text style={styles.dockCount}>{items.length}/3</Text>
            </View>
            <View style={styles.dockChips}>
              {items.map((c) => (
                <Pressable
                  key={c.card_id}
                  onPress={() => removeItem(c.card_id)}
                  hitSlop={4}
                  style={styles.dockChip}
                >
                  <Text numberOfLines={1} style={styles.dockChipText}>
                    {c.card_name}
                  </Text>
                  <X size={11} color={LedgerTheme.colors.inkMuted} />
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.dockRight}>
            <Pressable onPress={clearAll} hitSlop={6} style={styles.dockClearBtn}>
              <Text style={styles.dockClearText}>Clear</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/compare')}
              style={({ pressed }) => [
                styles.dockGoBtn,
                pressed ? { opacity: 0.85, transform: [{ scale: 0.97 }] } : null,
              ]}
            >
              <Text style={styles.dockGoText}>Compare</Text>
              <ArrowRight size={12} color="#FFFFFF" />
            </Pressable>
          </View>
        </Animated.View>
      )}

      <View
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
        style={[
          styles.bar,
          {
            paddingBottom: bottomInset,
            paddingTop: 8,
            paddingHorizontal: horizontalPad,
          },
        ]}
      >
        {tabWidth > 0 && (
          <Animated.View
            style={[
              styles.activePill,
              {
                width: Math.max(46, tabWidth - 6),
                left: horizontalPad + 3,
                top: 7,
                pointerEvents: 'none',
              },
              indicatorStyle,
            ]}
          />
        )}

        <View style={styles.row}>
          {visibleRoutes.map((route) => {
            const descriptor = descriptors[route.key];
            if (!descriptor) return null;
            const { options } = descriptor;
            const label =
              typeof options.tabBarLabel === 'string'
                ? options.tabBarLabel
                : options.title ?? route.name;
            const isFocused = route.key === activeRouteKey;
            const color = isFocused
              ? LedgerTheme.colors.accent
              : LedgerTheme.colors.inkMuted;

            const onPress = () => {
              const event = emitter
                ? emitter.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  })
                : navigation?.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });

              if (isFocused || event?.defaultPrevented) return;

              if (typeof navigateToTab === 'function') {
                navigateToTab(route.key);
              } else if (navigation) {
                navigation.navigate(route.name, route.params);
              } else {
                const dest = route.name === 'index' ? '/(tabs)' : `/(tabs)/${route.name}`;
                router.navigate(dest as never);
              }
            };

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                onPress={onPress}
                hitSlop={4}
                style={({ pressed }) => [
                  styles.tabBtn,
                  pressed ? { opacity: 0.78, transform: [{ scale: 0.96 }] } : null,
                ]}
              >
                <View style={styles.iconWrap}>
                  {options.tabBarIcon?.({ focused: isFocused, color, size: 19 })}
                </View>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                  style={[
                    styles.label,
                    {
                      color: isFocused
                        ? LedgerTheme.colors.accent
                        : LedgerTheme.colors.inkMuted,
                      fontWeight: isFocused ? '700' : '500',
                    },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: LedgerTheme.colors.surface,
  },
  compareDock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FAF9F6',
    borderTopWidth: 1,
    borderTopColor: LedgerTheme.colors.hairline,
  },
  dockLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  dockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.tintBorder,
  },
  dockCount: {
    fontSize: 11,
    fontWeight: '700',
    color: LedgerTheme.colors.accent,
  },
  dockChips: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  dockChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    maxWidth: 105,
  },
  dockChipText: {
    fontSize: 10.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    flexShrink: 1,
  },
  dockRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dockClearBtn: {
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  dockClearText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkMuted,
  },
  dockGoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LedgerTheme.colors.accent,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
  },
  dockGoText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bar: {
    backgroundColor: LedgerTheme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: LedgerTheme.colors.hairline,
    position: 'relative',
  },
  activePill: {
    position: 'absolute',
    height: 46,
    borderRadius: 12,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.tintBorder,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabBtn: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    gap: 3,
  },
  iconWrap: {
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10.5,
    letterSpacing: -0.15,
  },
});
