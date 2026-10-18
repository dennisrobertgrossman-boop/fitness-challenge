import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ChartColumn, Dumbbell, Trophy } from 'lucide-react-native';
import { Platform, StyleSheet, View } from 'react-native';
import { ActivityRings } from '../components/ActivityRings';
import { AddWorkoutScreen } from '../screens/AddWorkoutScreen';
import { CardioLoadScreen } from '../screens/CardioLoadScreen';
import { ChallengeScreen } from '../screens/ChallengeScreen';
import { DataScreen } from '../screens/DataScreen';
import { MemberScreen } from '../screens/MemberScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SetupScreen } from '../screens/SetupScreen';
import { SummaryScreen } from '../screens/SummaryScreen';
import { WorkoutDetailScreen } from '../screens/WorkoutDetailScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { WorkoutsScreen } from '../screens/WorkoutsScreen';
import { useAppStore } from '../store/useAppStore';
import { colors, fontFamily, metricColors } from '../theme';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const theme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.separator,
    notification: colors.danger,
  },
  fonts: fontFamily
    ? {
        regular: { fontFamily, fontWeight: '400' },
        medium: { fontFamily, fontWeight: '500' },
        bold: { fontFamily, fontWeight: '600' },
        heavy: { fontFamily, fontWeight: '700' },
      }
    : DarkTheme.fonts,
};

function RingsIcon({ color }: { color: string }) {
  const active = color === colors.accent;
  return (
    <View style={{ opacity: active ? 1 : 0.55 }}>
      <ActivityRings
        size={24}
        stroke={3.2}
        gap={1}
        animate={false}
        rings={[
          { progress: 0.8, color: metricColors.steps },
          { progress: 0.65, color: metricColors.cardioLoad },
          { progress: 0.9, color: metricColors.activeMinutes },
        ]}
      />
    </View>
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: Platform.OS === 'web' ? [styles.tabBar, styles.tabBarWeb] : styles.tabBar,
        tabBarLabelStyle: { fontFamily, fontSize: 11, lineHeight: 16, fontWeight: '500' },
      }}
    >
      <Tab.Screen name="Summary" component={SummaryScreen} options={{ tabBarIcon: RingsIcon }} />
      <Tab.Screen
        name="Challenge"
        component={ChallengeScreen}
        options={{ tabBarIcon: ({ color, size }) => <Trophy color={color} size={size - 2} /> }}
      />
      <Tab.Screen
        name="Workouts"
        component={WorkoutsScreen}
        options={{ tabBarIcon: ({ color, size }) => <Dumbbell color={color} size={size - 2} /> }}
      />
      <Tab.Screen
        name="Data"
        component={DataScreen}
        options={{ tabBarIcon: ({ color, size }) => <ChartColumn color={color} size={size - 2} /> }}
      />
    </Tab.Navigator>
  );
}

const stackOptions = {
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.accent,
  headerTitleStyle: { color: colors.text, fontFamily },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.bg },
};

function MainStack({ initialRouteName }: { initialRouteName: 'Tabs' | 'Setup' }) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={stackOptions}>
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false, title: 'Summary' }} />
      <Stack.Screen name="Member" component={MemberScreen} options={{ title: '' }} />
      <Stack.Screen name="Workout" component={WorkoutDetailScreen} options={{ title: 'Workout' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="Setup" component={SetupScreen} options={{ title: 'Get Started' }} />
      <Stack.Screen name="AddWorkout" component={AddWorkoutScreen} options={{ title: 'Log Workout', presentation: 'modal' }} />
      <Stack.Screen name="CardioLoad" component={CardioLoadScreen} options={{ title: 'Daily Numbers', presentation: 'modal' }} />
    </Stack.Navigator>
  );
}

function WelcomeStack() {
  return (
    <Stack.Navigator screenOptions={{ ...stackOptions, headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
    </Stack.Navigator>
  );
}

export function RootNavigator() {
  const hydrated = useAppStore((s) => s.hydrated);
  const entry = useAppStore((s) => s.entry);
  const setupPending = useAppStore((s) => s.setupPending);
  // Wait for saved state so a signed-in user never sees the welcome screen flash.
  if (!hydrated) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return (
    <NavigationContainer theme={theme}>
      {entry === 'welcome' ? (
        <WelcomeStack />
      ) : (
        <MainStack key="main" initialRouteName={setupPending ? 'Setup' : 'Tabs'} />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: { backgroundColor: '#0D0D0D', borderTopColor: colors.separator },
  tabBarWeb: { height: 68, paddingTop: 6, paddingBottom: 12 },
});
