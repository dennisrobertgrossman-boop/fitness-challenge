import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Member: { memberId: string };
  Workout: { workoutId: string };
  AddWorkout: undefined;
  CardioLoad: undefined;
  Settings: undefined;
  Setup: undefined;
  Welcome: undefined;
};

export type TabParamList = {
  Summary: undefined;
  Challenge: undefined;
  Workouts: undefined;
  Data: undefined;
};

export type RootProps<K extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, K>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
