import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, PanResponder, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { resolveCardImageAsset } from '../lib/cardImages';
import { resolveR2MediaUrl } from '../lib/mediaCdn';
import { LedgerTheme } from '../lib/theme';
import type { CardTheme } from '../lib/types';

interface Interactive3DCardModelProps {
  localImagePath?: string | null;
  imageUrl?: string | null;
  bank: string;
  cardName: string;
  network?: string;
  tier?: string;
  annualFeeLabel?: string;
  loungeLabel?: string;
  rewardHighlight?: string;
  cardTheme?: CardTheme | null;
  compact?: boolean;
  showInteractiveControls?: boolean;
}

const DEFAULT_TILT = { rx: 6, ry: -10 };

/**
 * Tactile 3D Perspective Credit Card Showcase:
 * Drag to orbit freely in 3D with holographic shimmer, subtle floating depth motion,
 * and multi-layer metallic rim shadow (never fake back-of-card boxes).
 */
export function Interactive3DCardModel({
  localImagePath,
  imageUrl,
  bank,
  cardName,
  rewardHighlight,
  cardTheme,
  compact = false,
  showInteractiveControls = true,
}: Interactive3DCardModelProps) {
  const localAsset = resolveCardImageAsset(localImagePath);
  const r2CardUrl = resolveR2MediaUrl(localImagePath);
  const [imgFailed, setImgFailed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const tiltX = useSharedValue(compact ? 4 : DEFAULT_TILT.rx);
  const tiltY = useSharedValue(compact ? -8 : DEFAULT_TILT.ry);
  const floatY = useSharedValue(0);
  const originRef = useRef({ rx: DEFAULT_TILT.rx, ry: DEFAULT_TILT.ry });

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 1900, easing: Easing.inOut(Easing.ease) }),
        withTiming(2, { duration: 1900, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [floatY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gs) =>
          Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4,
        onPanResponderGrant: () => {
          setIsDragging(true);
          originRef.current = { rx: tiltX.value, ry: tiltY.value };
        },
        onPanResponderMove: (_, gs) => {
          const nextRy = Math.max(-26, Math.min(26, originRef.current.ry + gs.dx * 0.24));
          const nextRx = Math.max(-18, Math.min(18, originRef.current.rx - gs.dy * 0.2));
          tiltY.value = nextRy;
          tiltX.value = nextRx;
        },
        onPanResponderRelease: () => {
          setIsDragging(false);
          tiltX.value = withSpring(DEFAULT_TILT.rx, { damping: 14, stiffness: 135 });
          tiltY.value = withSpring(DEFAULT_TILT.ry, { damping: 14, stiffness: 135 });
        },
        onPanResponderTerminate: () => {
          setIsDragging(false);
          tiltX.value = withSpring(DEFAULT_TILT.rx, { damping: 14, stiffness: 135 });
          tiltY.value = withSpring(DEFAULT_TILT.ry, { damping: 14, stiffness: 135 });
        },
      }),
    [tiltX, tiltY]
  );

  const cardWidth = compact ? 236 : 284;
  const cardHeight = Math.round(cardWidth / 1.586);
  const accentHex = cardTheme?.primary_hex || LedgerTheme.colors.accent;
  const softBg = cardTheme?.soft_bg_hex || '#EEF5F2';
  const borderHex = cardTheme?.border_hex || '#CBE0D7';

  const outerStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1050 },
      { translateY: isDragging ? 0 : floatY.value },
      { rotateX: `${tiltX.value}deg` },
      { rotateY: `${tiltY.value}deg` },
    ],
  }));

  const glareStyle = useAnimatedStyle(() => {
    const translateX = interpolate(tiltY.value, [-26, 26], [-115, 115]);
    const opacity = interpolate(
      Math.abs(tiltY.value) + Math.abs(tiltX.value),
      [0, 32],
      [0.09, 0.34]
    );
    return {
      opacity,
      transform: [{ translateX }, { skewX: '-22deg' }],
    };
  });

  const resolvedSource =
    localAsset ??
    (r2CardUrl ? { uri: r2CardUrl } : undefined) ??
    (imageUrl && imageUrl.startsWith('http') ? { uri: imageUrl } : undefined);
  const hasArt = Boolean(resolvedSource && !imgFailed);

  return (
    <View style={styles.wrap}>
      <View {...panResponder.panHandlers} style={{ width: cardWidth, height: cardHeight }}>
        <Animated.View style={[styles.cardShell, { width: cardWidth, height: cardHeight }, outerStyle]}>
          {/* Multi-layer metallic depth rim */}
          <View
            style={[
              styles.depthRimBack,
              { borderColor: borderHex, backgroundColor: `${accentHex}16`, pointerEvents: 'none' },
            ]}
          />
          <View
            style={[
              styles.depthRim,
              { borderColor: borderHex, backgroundColor: `${accentHex}2A`, pointerEvents: 'none' },
            ]}
          />
          <View style={[styles.face, { backgroundColor: softBg, borderColor: borderHex }]}>
            {hasArt ? (
              <Image
                source={resolvedSource!}
                style={styles.cardImage}
                onError={() => setImgFailed(true)}
              />
            ) : (
              <View style={styles.fallbackBox}>
                <Text style={styles.fallbackBank}>{bank}</Text>
                <Text style={styles.fallbackTitle} numberOfLines={2}>
                  {cardName}
                </Text>
              </View>
            )}
            <Animated.View style={[styles.glareStrip, glareStyle, { pointerEvents: 'none' }]} />
          </View>
        </Animated.View>
      </View>

      {showInteractiveControls && !compact && rewardHighlight ? (
        <View style={styles.controlsRow}>
          <View style={[styles.highlightPill, { borderColor: borderHex, backgroundColor: softBg }]}>
            <Text
              style={[styles.highlightText, { color: cardTheme?.ink_on_soft_hex || accentHex }]}
              numberOfLines={2}
            >
              {rewardHighlight}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  cardShell: {
    position: 'relative',
  },
  depthRimBack: {
    position: 'absolute',
    top: 7,
    left: 5,
    right: -5,
    bottom: -7,
    borderRadius: 16,
    borderWidth: 1,
  },
  depthRim: {
    position: 'absolute',
    top: 3,
    left: 2,
    right: -2,
    bottom: -3,
    borderRadius: 16,
    borderWidth: 1,
  },
  controlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  anglePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.surface,
  },
  angleText: {
    fontSize: 11,
    fontWeight: '600',
    color: LedgerTheme.colors.inkSecondary,
  },
  angleTextActive: {
    color: '#FFFFFF',
  },
  highlightPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: '94%',
  },
  highlightText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  face: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111827',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  cardImage: {
    width: '95%',
    height: '95%',
    resizeMode: 'contain',
  },
  fallbackBox: {
    width: '100%',
    height: '100%',
    padding: 18,
    justifyContent: 'space-between',
  },
  fallbackBank: {
    fontSize: 11,
    fontWeight: '600',
    color: LedgerTheme.colors.inkSecondary,
    textTransform: 'uppercase',
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
  },
  glareStrip: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 64,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
});
