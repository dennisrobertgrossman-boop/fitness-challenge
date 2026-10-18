import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAppStore } from './src/store/useAppStore';
import { colors } from './src/theme';

export default function App() {
  const hydrated = useAppStore((s) => s.hydrated);
  const finishWebRedirect = useAppStore((s) => s.finishWebRedirect);
  useEffect(() => {
    // Web only: pick up the session after Google redirects back to the page.
    if (hydrated) finishWebRedirect().catch(() => {});
  }, [hydrated, finishWebRedirect]);

  return (
    <SafeAreaProvider style={styles.outer}>
      {/* On web, keep a phone-width column so the layout matches the mobile app. */}
      <View style={Platform.OS === 'web' ? styles.webColumn : styles.fill}>
        <RootNavigator />
      </View>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  webColumn: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', overflow: 'hidden' },
});
