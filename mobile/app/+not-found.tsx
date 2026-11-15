import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { TOTAL_CARDS } from '../src/lib/data';
import { LedgerTheme } from '../src/lib/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Page Not Found' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This card or screen was not found.</Text>
        <Text style={styles.sub}>
          Return to Discover to search across all {TOTAL_CARDS} active Indian credit cards.
        </Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go back to Discover</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: LedgerTheme.colors.canvas,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    textAlign: 'center',
  },
  sub: {
    fontSize: 13.5,
    color: LedgerTheme.colors.inkSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  link: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: LedgerTheme.colors.tintPrimary,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
});
