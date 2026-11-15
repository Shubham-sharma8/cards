import { DefaultTheme, type ErrorBoundaryProps, Stack, ThemeProvider, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Settings, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BrandWordmark } from '../src/components/BrandLogo';
import { CompareProvider } from '../src/components/CompareContext';
import { GreenCirclesLoader } from '../src/components/GreenCirclesLoader';
import { ScalePressable } from '../src/components/MotionPrimitives';
import { TOTAL_CARDS } from '../src/lib/data';
import { isValidLaunchRoute } from '../src/lib/security';
import { LedgerTheme } from '../src/lib/theme';

/**
 * Calm fallback boundary for unexpected runtime exceptions in production builds.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: LedgerTheme.colors.canvas,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 28,
      }}
    >
      <View
        style={{
          width: '100%',
          maxWidth: 360,
          backgroundColor: LedgerTheme.colors.surface,
          borderRadius: LedgerTheme.radius.lg,
          borderWidth: 1,
          borderColor: LedgerTheme.colors.hairline,
          padding: 22,
          gap: 10,
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: '500',
            color: LedgerTheme.colors.inkPrimary,
          }}
        >
          Something interrupted Cardify
        </Text>
        <Text
          style={{
            fontSize: 13,
            lineHeight: 19,
            fontWeight: '400',
            color: LedgerTheme.colors.inkSecondary,
          }}
          numberOfLines={4}
        >
          {error.message || 'An unexpected screen error occurred. Your saved wallet cards remain safe on device.'}
        </Text>
        <ScalePressable
          onPress={retry}
          accessibilityRole="button"
          accessibilityLabel="Reset and reload screen"
          style={{
            marginTop: 6,
            alignSelf: 'flex-start',
            backgroundColor: LedgerTheme.colors.accent,
            borderRadius: LedgerTheme.radius.md,
            paddingHorizontal: 16,
            paddingVertical: 10,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: '500',
              color: '#FFFFFF',
            }}
          >
            Reset &amp; Reload
          </Text>
        </ScalePressable>
      </View>
    </View>
  );
}

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const CardLedgerLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: LedgerTheme.colors.canvas,
    card: LedgerTheme.colors.surface,
    text: LedgerTheme.colors.inkPrimary,
    border: LedgerTheme.colors.hairline,
    primary: LedgerTheme.colors.accent,
  },
};

function LaunchRouteBridge() {
  const router = useRouter();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current || Platform.OS !== 'ios') return;
    handledRef.current = true;
    try {
      const route = Settings.get('launchRoute');
      if (isValidLaunchRoute(route) && route !== '/') {
        const t = setTimeout(() => {
          router.push(route as never);
        }, 160);
        return () => clearTimeout(t);
      }
    } catch {
      // Ignore launch argument lookup errors
    }
  }, [router]);

  return null;
}

export default function RootLayout() {
  const splashHiddenRef = useRef(false);
  const [showBootLoader, setShowBootLoader] = useState(Platform.OS !== 'web');
  const loaderOpacity = useSharedValue(1);
  const cardScale = useSharedValue(0.92);
  const cardOpacity = useSharedValue(0.96);

  const hideSplashOnce = useCallback(() => {
    if (splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const onLayoutRootView = useCallback(() => {
    requestAnimationFrame(() => {
      hideSplashOnce();
    });
  }, [hideSplashOnce]);

  useEffect(() => {
    cardOpacity.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) });
    cardScale.value = withSpring(1, { damping: 16, stiffness: 190, mass: 0.9 });

    const timer = setTimeout(hideSplashOnce, 350);
    const fadeTimer = setTimeout(() => {
      loaderOpacity.value = withTiming(0, {
        duration: 280,
        easing: Easing.out(Easing.quad),
      });
    }, 760);
    const unmountTimer = setTimeout(() => {
      setShowBootLoader(false);
    }, 1080);

    return () => {
      clearTimeout(timer);
      clearTimeout(fadeTimer);
      clearTimeout(unmountTimer);
    };
  }, [cardOpacity, cardScale, hideSplashOnce, loaderOpacity]);

  const curtainStyle = useAnimatedStyle(() => ({
    opacity: loaderOpacity.value,
  }));

  const splashCardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: LedgerTheme.colors.canvas }} onLayout={onLayoutRootView}>
        <ThemeProvider value={CardLedgerLightTheme}>
          <CompareProvider>
              <LaunchRouteBridge />
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: LedgerTheme.colors.surface },
                  headerTintColor: LedgerTheme.colors.inkPrimary,
                  headerTitleStyle: { fontWeight: '500', fontSize: 16 },
                  headerBackTitle: 'Home',
                  headerShadowVisible: false,
                  contentStyle: { backgroundColor: LedgerTheme.colors.canvas },
                  gestureEnabled: true,
                  fullScreenGestureEnabled: true,
                  animation: 'ios_from_right',
                  animationDuration: 280,
                }}
              >
                <Stack.Screen
                  name="(tabs)"
                  options={{ headerShown: false, title: 'Home', headerBackTitle: 'Home' }}
                />
                <Stack.Screen
                  name="card/[bankSlug]/[cardSlug]"
                  options={{ title: 'Card Dossier', headerBackTitle: 'Back' }}
                />
                <Stack.Screen
                  name="lounge/[code]"
                  options={{ title: 'Lounge & Golf Details', headerBackTitle: 'Back' }}
                />
                <Stack.Screen
                  name="compare"
                  options={{
                    title: 'Compare Cards',
                    presentation: 'modal',
                    sheetGrabberVisible: true,
                  }}
                />
                <Stack.Screen
                  name="devaluations"
                  options={{ title: 'Devaluation Tracker' }}
                />
                <Stack.Screen
                  name="advisor"
                  options={{ title: 'Card Advisor & Combo' }}
                />
                <Stack.Screen
                  name="my-cards"
                  options={{ title: 'My Cards & Wallet' }}
                />
                <Stack.Screen
                  name="help"
                  options={{ title: 'Customer Support' }}
                />
                <Stack.Screen
                  name="help/[bankSlug]"
                  options={{ title: 'Bank Support Desk', headerBackTitle: 'Banks' }}
                />
                <Stack.Screen
                  name="categories"
                  options={{ title: 'Spend Categories' }}
                />
                <Stack.Screen
                  name="categories/[categoryId]"
                  options={{ title: 'Category Leaders', headerBackTitle: 'Categories' }}
                />
                <Stack.Screen
                  name="lounge-guide"
                  options={{ title: 'QR Portals & Claim Steps', headerBackTitle: 'Lounges' }}
                />
              </Stack>
          </CompareProvider>
        </ThemeProvider>
        {showBootLoader && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              curtainStyle,
              {
                pointerEvents: 'none',
                backgroundColor: LedgerTheme.colors.canvas,
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 99,
              },
            ]}
          >
            <Animated.View
              style={[
                splashCardStyle,
                {
                  backgroundColor: LedgerTheme.colors.surface,
                  borderRadius: LedgerTheme.radius.lg,
                  borderWidth: 1,
                  borderColor: LedgerTheme.colors.hairline,
                  paddingHorizontal: 32,
                  paddingVertical: 28,
                  alignItems: 'center',
                  gap: 16,
                  ...LedgerTheme.shadow.card,
                },
              ]}
            >
              <BrandWordmark />
              <GreenCirclesLoader
                label={`Syncing ${TOTAL_CARDS} cards, lounges & rules…`}
                size={15}
              />
            </Animated.View>
          </Animated.View>
        )}
      </View>
    </SafeAreaProvider>
  );
}
