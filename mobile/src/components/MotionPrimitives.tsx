import React, { useEffect, useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  LinearTransition,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { LedgerTheme } from '../lib/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const SPRING_CONFIG = {
  damping: 18,
  stiffness: 260,
  mass: 0.78,
};

/**
 * Intentionally a no-op so callers no longer trigger legacy UIKit LayoutAnimation
 * frames that clash with FlatList cell recycling and Reanimated worklets.
 * Use <AnimatedReveal> for explicit expand/collapse panels instead.
 */
export function triggerCalmLayoutTransition() {
  // No-op by design for conflict-free Reanimated rendering.
}

interface ScalePressableProps {
  children: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  hitSlop?: number;
  accessibilityRole?: 'button' | 'link';
  accessibilityLabel?: string;
}

export function ScalePressable({
  children,
  onPress,
  disabled = false,
  style,
  scaleTo = 0.968,
  hitSlop,
  accessibilityRole = 'button',
  accessibilityLabel,
}: ScalePressableProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        style,
        !disabled && pressed
          ? {
              transform: [{ scale: scaleTo }],
              opacity: 0.88,
            }
          : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

interface ParallaxShowcaseCardProps {
  children: React.ReactNode;
  scrollX: SharedValue<number>;
  index: number;
  stride: number;
  style?: StyleProp<ViewStyle>;
}

export function ParallaxShowcaseCard({
  children,
  scrollX,
  index,
  stride,
  style,
}: ParallaxShowcaseCardProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const center = index * stride;
    const inputRange = [center - stride, center, center + stride];
    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.92, 1, 0.92],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      scrollX.value,
      inputRange,
      [10, 0, 10],
      Extrapolation.CLAMP
    );
    const rotateYDeg = interpolate(
      scrollX.value,
      inputRange,
      [9, 0, -9],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.82, 1, 0.82],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { perspective: 950 },
        { scale },
        { translateY },
        { rotateY: `${rotateYDeg}deg` },
      ],
      opacity,
    };
  });

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}

interface AnimatedProgressBarProps {
  percent: number;
  fillColor?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export function AnimatedProgressBar({
  percent,
  fillColor = LedgerTheme.colors.accent,
  height = 8,
  style,
}: AnimatedProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  const widthPct = useSharedValue(0);

  useEffect(() => {
    widthPct.value = withTiming(clamped, {
      duration: 420,
      easing: Easing.out(Easing.cubic),
    });
  }, [clamped, widthPct]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${widthPct.value}%`,
  }));

  return (
    <Animated.View style={[styles.track, { height, borderRadius: height / 2 }, style]}>
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: fillColor, borderRadius: height / 2 },
          fillStyle,
        ]}
      />
    </Animated.View>
  );
}

interface CalmEntranceViewProps {
  children: React.ReactNode;
  delayMs?: number;
  enableLayout?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function CalmEntranceView({
  children,
  delayMs = 0,
  enableLayout = false,
  style,
}: CalmEntranceViewProps) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delayMs).springify().damping(20).stiffness(190)}
      layout={enableLayout ? LinearTransition.duration(220) : undefined}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

interface AnimatedRevealProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function AnimatedReveal({ children, style }: AnimatedRevealProps) {
  return (
    <Animated.View
      entering={FadeInDown.springify().damping(20).stiffness(200)}
      exiting={FadeOutUp.duration(180)}
      layout={LinearTransition.duration(220)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

interface CalmFilterItemProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function CalmFilterItem({ children, style }: CalmFilterItemProps) {
  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(140)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

interface AiOrb3DProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * 3D Reanimated AI Core Orb: dual tilted orbiting rings, breathing emerald glow, specular core.
 */
export function AiOrb3D({ size = 38, style }: AiOrb3DProps) {
  const spin = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    spin.value = withRepeat(
      withTiming(360, { duration: 7200, easing: Easing.linear }),
      -1,
      false
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [spin, pulse]);

  const outerRingStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 360 },
      { rotateX: '64deg' },
      { rotateY: '-18deg' },
      { rotateZ: `${spin.value}deg` },
    ],
  }));

  const innerRingStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 360 },
      { rotateX: '58deg' },
      { rotateY: '24deg' },
      { rotateZ: `${-spin.value * 0.75}deg` },
    ],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.92, 1.14]) }],
    opacity: interpolate(pulse.value, [0, 1], [0.28, 0.56]),
  }));

  const corePx = Math.round(size * 0.54);

  return (
    <View style={[styles.orbContainer, { width: size, height: size }, style]}>
      <Animated.View
        style={[
          styles.orbHalo,
          { width: size, height: size, borderRadius: size / 2 },
          haloStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.orbRing,
          { width: size, height: size, borderRadius: size / 2 },
          outerRingStyle,
        ]}
      >
        <View style={styles.orbSatelliteEmerald} />
      </Animated.View>
      <Animated.View
        style={[
          styles.orbRingGold,
          { width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 },
          innerRingStyle,
        ]}
      >
        <View style={styles.orbSatelliteGold} />
      </Animated.View>
      <View
        style={[
          styles.orbCore,
          {
            width: corePx,
            height: corePx,
            borderRadius: corePx / 2,
          },
        ]}
      >
        <View style={styles.orbSpecular} />
      </View>
    </View>
  );
}

interface Card3DTiltPressableProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Interactive 3D perspective card surface that tilts smoothly on press with a gloss streak.
 */
export function Card3DTiltPressable({
  children,
  onPress,
  style,
}: Card3DTiltPressableProps) {
  const pressed = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { scale: interpolate(pressed.value, [0, 1], [1, 0.968]) },
      { rotateX: `${interpolate(pressed.value, [0, 1], [0, 5.5])}deg` },
      { rotateY: `${interpolate(pressed.value, [0, 1], [0, -5.5])}deg` },
    ],
  }));

  const sheenStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pressed.value, [0, 1], [0, 0.28]),
    transform: [{ translateX: interpolate(pressed.value, [0, 1], [-80, 120]) }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withSpring(1, SPRING_CONFIG);
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, SPRING_CONFIG);
      }}
      style={[animStyle, style, { overflow: 'hidden' }]}
    >
      {children}
      <Animated.View style={[styles.cardSheenBar, sheenStyle, { pointerEvents: 'none' }]} />
    </AnimatedPressable>
  );
}

/**
 * Popping badge scale transition when selection state toggles (Compare / Wallet / Watchlist).
 */
export function SelectionCheckPop({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    scale.value = withSequence(
      withSpring(1.24, { damping: 12, stiffness: 360 }),
      withSpring(1, SPRING_CONFIG)
    );
  }, [active, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={animStyle}>{children}</Animated.View>;
}

/**
 * Ambient traveling light sweep for AI banner surfaces.
 */
export function AiShimmerStrip() {
  const x = useSharedValue(-160);

  useEffect(() => {
    x.value = withRepeat(
      withTiming(380, { duration: 3600, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  }, [x]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { skewX: '-18deg' }],
  }));

  return <Animated.View style={[styles.aiShimmerBar, animStyle, { pointerEvents: 'none' }]} />;
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: LedgerTheme.colors.subtle,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  orbContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  orbHalo: {
    position: 'absolute',
    backgroundColor: '#10B981',
  },
  orbRing: {
    position: 'absolute',
    borderWidth: 1.4,
    borderColor: 'rgba(15, 92, 77, 0.45)',
    alignItems: 'center',
  },
  orbRingGold: {
    position: 'absolute',
    borderWidth: 1.2,
    borderColor: 'rgba(154, 91, 19, 0.35)',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  orbSatelliteEmerald: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10B981',
    marginTop: -2.5,
  },
  orbSatelliteGold: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D97706',
    marginBottom: -2,
  },
  orbCore: {
    backgroundColor: LedgerTheme.colors.accent,
    borderWidth: 1,
    borderColor: '#6EE7B7',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    shadowColor: '#0F5C4D',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  orbSpecular: {
    width: '36%',
    height: '26%',
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.65)',
    marginTop: '18%',
    marginLeft: '18%',
  },
  cardSheenBar: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 72,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    transform: [{ skewX: '-20deg' }],
  },
  aiShimmerBar: {
    position: 'absolute',
    top: -10,
    bottom: -10,
    width: 68,
    backgroundColor: 'rgba(15, 92, 77, 0.06)',
  },
});
