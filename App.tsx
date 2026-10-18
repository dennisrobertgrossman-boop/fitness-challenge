import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors } from './src/theme';

export default function App() {
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
