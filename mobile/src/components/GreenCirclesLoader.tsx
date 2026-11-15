import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LedgerTheme } from '../lib/theme';

interface GreenCirclesLoaderProps {
  label?: string;
  size?: number;
}

const GREEN_SHADES = ['#0F5C4D', '#16A34A', '#4ADE80'] as const;

/**
 * Animated three-circle loader in three distinct shades of green:
 * Deep Pine (#0F5C4D), Vibrant Emerald (#16A34A), and Fresh Mint (#4ADE80).
 */
export function GreenCirclesLoader({
  label = 'Loading benefits & reward caps…',
  size = 14,
}: GreenCirclesLoaderProps) {
  const anims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    const loops = anims.map((val, idx) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(idx * 150),
          Animated.timing(val, {
            toValue: 1,
            duration: 360,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 360,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(Math.max(0, (2 - idx) * 150)),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => {
      loops.forEach((l) => l.stop());
    };
  }, [anims]);

  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityLabel={label}>
      <View style={styles.dotsRow}>
        {GREEN_SHADES.map((color, idx) => {
          const translateY = anims[idx].interpolate({
            inputRange: [0, 1],
            outputRange: [0, -10],
          });
          const scale = anims[idx].interpolate({
            inputRange: [0, 1],
            outputRange: [0.88, 1.18],
          });
          const opacity = anims[idx].interpolate({
            inputRange: [0, 1],
            outputRange: [0.7, 1],
          });
          return (
            <Animated.View
              key={color}
              style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: color,
                transform: [{ translateY }, { scale }],
                opacity,
              }}
            />
          );
        })}
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
