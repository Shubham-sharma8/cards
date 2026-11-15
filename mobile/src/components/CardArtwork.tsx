import React, { useEffect, useState } from 'react';
import { Image, type ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { resolveCardImageAsset } from '../lib/cardImages';
import { resolveR2MediaUrl } from '../lib/mediaCdn';
import { LedgerTheme } from '../lib/theme';
import type { CardTheme } from '../lib/types';

interface CardArtworkProps {
  localImagePath?: string | null;
  imageUrl?: string | null;
  bank: string;
  cardName: string;
  network: string;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  cardTheme?: CardTheme | null;
  showSplash?: boolean;
}

const SIZE_MAP = {
  sm: { width: 74, height: 48, fontSize: 8.5 },
  md: { width: 96, height: 60, fontSize: 9.5 },
  lg: { width: 176, height: 112, fontSize: 11.5 },
  hero: { width: 204, height: 128, fontSize: 12 },
};

export const CardArtwork = React.memo(function CardArtwork({
  localImagePath,
  imageUrl,
  bank,
  cardName,
  network,
  size = 'md',
  cardTheme,
  showSplash = false,
}: CardArtworkProps) {
  const localAsset = resolveCardImageAsset(localImagePath);
  const [failed, setFailed] = useState(false);
  const imgOpacity = useSharedValue(localAsset ? 1 : 0.35);
  const dims = SIZE_MAP[size];

  useEffect(() => {
    setFailed(false);
    imgOpacity.value = localAsset ? 1 : 0.35;
  }, [localImagePath, imageUrl, localAsset, imgOpacity]);

  const cdnUrl = resolveR2MediaUrl(localImagePath);
  const remoteUri =
    cdnUrl || (imageUrl && imageUrl.startsWith('http') ? imageUrl : null);
  const activeSource: ImageSourcePropType | null =
    (!failed && remoteUri ? { uri: remoteUri } : null) ?? localAsset;
  const hasArtwork = Boolean(activeSource);

  const pad = size === 'lg' || size === 'hero' ? 5 : 2;
  let frameWidth = dims.width;
  if (localAsset && hasArtwork) {
    try {
      const resolved = Image.resolveAssetSource(localAsset);
      if (resolved?.width && resolved?.height) {
        const aspect = resolved.width / resolved.height;
        if (aspect < 1.15) {
          const snug = Math.round((dims.height - pad * 2) * aspect + pad * 2);
          frameWidth = Math.min(dims.width, Math.max(snug, Math.round(dims.height * 0.6)));
        }
      }
    } catch {
      // Fallback to default width if asset metadata lookup is unavailable
    }
  }

  const splashColor = cardTheme?.wash_hex || cardTheme?.primary_hex || '#D7E2FF';
  const surfaceBg =
    showSplash && cardTheme?.soft_bg_hex ? cardTheme.soft_bg_hex : '#F8F6F0';
  const borderColor =
    showSplash && cardTheme?.border_hex ? cardTheme.border_hex : LedgerTheme.colors.hairline;

  const imgAnimatedStyle = useAnimatedStyle(() => ({
    opacity: imgOpacity.value,
  }));

  const boxNode = hasArtwork ? (
    <View
      style={[
        styles.frame,
        {
          width: frameWidth,
          height: dims.height,
          backgroundColor: surfaceBg,
          borderColor,
          padding: pad,
        },
      ]}
    >
      <Animated.Image
        source={activeSource as ImageSourcePropType}
        style={[
          {
            width: frameWidth - pad * 2,
            height: dims.height - pad * 2,
            resizeMode: 'contain',
          },
          imgAnimatedStyle,
        ]}
        onLoad={() => {
          imgOpacity.value = withTiming(1, { duration: 180 });
        }}
        onError={() => setFailed(true)}
      />
    </View>
  ) : (
    <View
      style={[
        styles.fallbackFrame,
        {
          width: dims.width,
          height: dims.height,
          backgroundColor:
            showSplash && cardTheme?.soft_bg_hex ? cardTheme.soft_bg_hex : '#EEF5F2',
          borderColor:
            showSplash && cardTheme?.border_hex ? cardTheme.border_hex : '#C2DBD2',
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.bankText,
          {
            fontSize: Math.max(7.5, dims.fontSize - 1),
            color: cardTheme?.ink_on_soft_hex || LedgerTheme.colors.accent,
          },
        ]}
      >
        {bank.toUpperCase()}
      </Text>
      <View style={styles.chipRow}>
        <View style={styles.chip} />
        <Text numberOfLines={1} style={[styles.cardMini, { fontSize: dims.fontSize }]}>
          {cardName}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={[styles.networkText, { fontSize: Math.max(7.5, dims.fontSize - 1) }]}
      >
        {network}
      </Text>
    </View>
  );

  if (!showSplash) {
    return boxNode;
  }

  const splashW = frameWidth + 28;
  const splashH = dims.height + 22;

  return (
    <View style={[styles.splashWrap, { width: splashW, height: splashH }]}>
      <Svg
        width={splashW}
        height={splashH}
        viewBox="0 0 360 230"
        style={StyleSheet.absoluteFill}
      >
        <Path
          d="M28 168C10 132 22 68 62 42C102 16 178 14 244 26C300 36 344 74 340 128C336 184 282 212 206 214C132 216 48 208 28 168Z"
          fill={splashColor}
          fillOpacity={0.34}
        />
        <Path
          d="M52 184C36 164 68 142 126 154C184 166 258 176 306 162C332 154 328 188 278 202C220 218 74 210 52 184Z"
          fill={cardTheme?.primary_hex || splashColor}
          fillOpacity={0.22}
        />
      </Svg>
      {boxNode}
    </View>
  );
});

const styles = StyleSheet.create({
  splashWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  frame: {
    borderRadius: 12,
    backgroundColor: '#F8F6F0',
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackFrame: {
    borderRadius: 12,
    backgroundColor: '#EEF5F2',
    borderWidth: 1,
    borderColor: '#C2DBD2',
    padding: 8,
    justifyContent: 'space-between',
  },
  bankText: {
    color: LedgerTheme.colors.accent,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chip: {
    width: 15,
    height: 11,
    borderRadius: 2.5,
    backgroundColor: '#D6D9CE',
  },
  cardMini: {
    color: LedgerTheme.colors.inkPrimary,
    fontWeight: '500',
    flex: 1,
  },
  networkText: {
    color: LedgerTheme.colors.inkSecondary,
    textAlign: 'right',
    fontWeight: '400',
  },
});
