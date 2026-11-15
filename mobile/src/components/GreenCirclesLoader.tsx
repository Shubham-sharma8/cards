import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LedgerTheme } from '../lib/theme';

interface GreenCirclesLoaderProps {
  label?: string;
  size?: number;
}

const GREEN_SHADES = ['#0F5C4D', '#16A34A', '#4ADE80'] as const;

function GreenDot({ color, index, size }: { color: string; index: number; size: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      index * 150,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 360, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 360, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 300 })
        ),
        -1,
        false
      )
    );
  }, [index, progress]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, -10]) },
      { scale: interpolate(progress.value, [0, 1], [0.88, 1.18]) },
    ],
    opacity: interpolate(progress.value, [0, 1], [0.7, 1]),
  }));

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        animStyle,
      ]}
    />
  );
}

/**
 * Animated three-circle loader in three distinct shades of green:
 * Deep Pine (#0F5C4D), Vibrant Emerald (#16A34A), and Fresh Mint (#4ADE80).
 */
export function GreenCirclesLoader({
  label = 'Loading benefits & reward caps…',
  size = 14,
}: GreenCirclesLoaderProps) {
  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityLabel={label}>
      <View style={styles.dotsRow}>
        {GREEN_SHADES.map((color, idx) => (
          <GreenDot key={color} color={color} index={idx} size={size} />
        ))}
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 30,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: LedgerTheme.colors.inkSecondary,
    textAlign: 'center',
  },
});
