import React from 'react';
import { Link, Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calculator, Compass, Plane, Scale, Search, Wallet } from 'lucide-react-native';
import { LedgerTheme } from '../../src/lib/theme';
import { useCompare } from '../../src/components/CompareContext';
import { BrandWordmark } from '../../src/components/BrandLogo';
import { ScalePressable } from '../../src/components/MotionPrimitives';
import { AnimatedTabBar } from '../../src/components/AnimatedTabBar';

function CompareHeaderButton() {
  const { items } = useCompare();
  return (
    <Link href="/compare" asChild>
      <ScalePressable style={styles.compareHeaderBtn} hitSlop={8}>
        <Scale size={14} color={LedgerTheme.colors.accent} />
        <Text style={styles.compareHeaderText}>
          {items.length > 0 ? `Compare (${items.length})` : 'Compare'}
        </Text>
      </ScalePressable>
    </Link>
  );
}

export default function TabLayout() {
  useSafeAreaInsets();

  return (
    <Tabs
      tabBar={(props) => <AnimatedTabBar {...(props as unknown as React.ComponentProps<typeof AnimatedTabBar>)} />}
      screenOptions={{
        animation: 'fade',
        headerStyle: {
          backgroundColor: LedgerTheme.colors.canvas,
          borderBottomWidth: 1,
          borderBottomColor: LedgerTheme.colors.hairline,
        },
        headerShadowVisible: false,
        headerTitleStyle: {
          color: LedgerTheme.colors.inkPrimary,
          fontSize: 18,
          fontWeight: '700',
        },
        headerRight: () => <CompareHeaderButton />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Discover',
          headerTitleAlign: 'left',
          headerTitle: () => (
            <View style={{ paddingLeft: 4 }}>
              <BrandWordmark compact />
            </View>
          ),
          tabBarIcon: ({ color, size }) => <Compass size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="finder"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size }) => <Search size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calculator"
        options={{
          title: 'Calculator',
          tabBarIcon: ({ color, size }) => <Calculator size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="lounges"
        options={{
          title: 'Lounge & Golf',
          tabBarIcon: ({ color, size }) => <Plane size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="my-cards"
        options={{
          title: 'My Cards',
          tabBarIcon: ({ color, size }) => <Wallet size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  compareHeaderBtn: {
    marginRight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.tintBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  compareHeaderText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
});
