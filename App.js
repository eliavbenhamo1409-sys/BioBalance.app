/**
 * App.js - BioBalance
 *
 * CLEAN AUTHENTICATION ARCHITECTURE
 * ================================
 * Single source of truth: Supabase auth.onAuthStateChange
 *
 * States:
 * - authState = 'initializing' → Loading screen
 * - authState = 'unauthenticated' → Login screen
 * - authState = 'authenticated' → Main app
 */

import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppProvider } from './src/context/AppContext';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Image, Text, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import useNotifications from './src/hooks/useNotifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from './src/api/supabaseClient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from 'react-native-reanimated';

// Silence the noisy "Reading from `value` during component render" warning.
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

const LOGO_IMAGE = require('./assets/logo.png');

// Screens
import Login from './src/screens/Login';
import Home from './src/screens/Home';
import Onboarding from './src/screens/Onboarding';
import Statistics from './src/screens/Statistics';
import Recipes from './src/screens/Recipes';
import RecipeDetail from './src/screens/RecipeDetail';
import Reminders from './src/screens/Reminders';
import NotificationSettings from './src/screens/NotificationSettings';
import AIInsights from './src/screens/AIInsights';
import Insights from './src/screens/Insights';
import Profile from './src/screens/Profile';
import Account from './src/screens/Account';
import RecentMeals from './src/screens/RecentMeals';
import Sources from './src/screens/Sources';
import Subscription from './src/screens/Subscription';
import BirkatHamazon from './src/screens/BirkatHamazon';

const Stack = createNativeStackNavigator();

// ============================================================
// ANIMATED LOADING DOTS
// ============================================================
const LoadingDots = () => {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    dot1.value = withRepeat(withSequence(withTiming(-10, { duration: 400 }), withTiming(0, { duration: 400 })), -1);
    dot2.value = withDelay(150, withRepeat(withSequence(withTiming(-10, { duration: 400 }), withTiming(0, { duration: 400 })), -1));
    dot3.value = withDelay(300, withRepeat(withSequence(withTiming(-10, { duration: 400 }), withTiming(0, { duration: 400 })), -1));
  }, []);

  const dot1Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot1.value }] }));
  const dot2Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot2.value }] }));
  const dot3Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot3.value }] }));

  return (
    <View style={styles.dotsContainer}>
      <Animated.View style={[styles.dot, dot1Style]} />
      <Animated.View style={[styles.dot, dot2Style]} />
      <Animated.View style={[styles.dot, dot3Style]} />
    </View>
  );
};

// ============================================================
// LOADING SCREEN
// ============================================================
const LoadingScreen = () => (
  <View style={styles.loading}>
    <StatusBar style="dark" />
    <Image source={LOGO_IMAGE} style={styles.loadingLogo} resizeMode="contain" />
    <Text style={styles.loadingTagline}>Balance by data, personalized for you.</Text>
    <LoadingDots />
  </View>
);

// ============================================================
// AUTH STACK (Not logged in)
// ============================================================
const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={Login} />
  </Stack.Navigator>
);

// ============================================================
// MAIN STACK (Logged in)
// ============================================================
const MainStack = ({ hasCompletedOnboarding }) => {
  const initialRoute = hasCompletedOnboarding ? 'Home' : 'Onboarding';

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false, animation: 'slide_from_left' }}
    >
      <Stack.Screen name="Onboarding" component={Onboarding} />
      <Stack.Screen name="Home" component={Home} />
      <Stack.Screen name="Insights" component={Insights} />
      {/* Statistics & AIInsights kept for legacy / deep links. */}
      <Stack.Screen name="Statistics" component={Statistics} />
      <Stack.Screen name="Recipes" component={Recipes} />
      <Stack.Screen name="RecipeDetail" component={RecipeDetail} />
      <Stack.Screen name="Reminders" component={Reminders} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettings} />
      <Stack.Screen name="AIInsights" component={AIInsights} />
      <Stack.Screen name="Profile" component={Profile} />
      <Stack.Screen name="Account" component={Account} />
      <Stack.Screen name="RecentMeals" component={RecentMeals} />
      <Stack.Screen name="Sources" component={Sources} />
      <Stack.Screen name="Subscription" component={Subscription} />
      <Stack.Screen name="BirkatHamazon" component={BirkatHamazon} />
    </Stack.Navigator>
  );
};

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [authState, setAuthState] = useState('initializing');
  const [session, setSession] = useState(null);
  const initRef = useRef(false);
  const authResolvedRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    if (__DEV__) {
      console.log('[App] Initializing...');
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (__DEV__ && event !== 'TOKEN_REFRESHED') {
        console.log('[App] Auth event:', event, newSession?.user?.email || 'no user');
      }
      authResolvedRef.current = true;

      switch (event) {
        case 'INITIAL_SESSION':
          if (newSession) {
            setSession(newSession);
            setAuthState('authenticated');
          } else {
            setAuthState('unauthenticated');
          }
          break;
        case 'SIGNED_IN':
          setSession(newSession);
          setAuthState('authenticated');
          break;
        case 'TOKEN_REFRESHED':
          if (newSession) {
            setSession(newSession);
            setAuthState('authenticated');
          }
          break;
        case 'SIGNED_OUT':
          setSession(null);
          setAuthState('unauthenticated');
          break;
        default:
          if (newSession) {
            setSession(newSession);
            setAuthState('authenticated');
          }
      }
    });

    const timeout = setTimeout(() => {
      if (!authResolvedRef.current) {
        setAuthState('unauthenticated');
      }
    }, 5000);

    return () => {
      subscription?.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  if (authState === 'initializing') {
    return (
      <SafeAreaProvider>
        <LoadingScreen />
      </SafeAreaProvider>
    );
  }

  if (authState === 'unauthenticated' || !session) {
    return (
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <AuthStack />
        </NavigationContainer>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AppProvider session={session}>
        <AppRootWithNav />
      </AppProvider>
    </SafeAreaProvider>
  );
}

// ============================================================
// APP ROOT - holds the navigation container ref for deep-linking
// from notification taps (weekly check-in → Insights screen).
// ============================================================
const AppRootWithNav = () => {
  const navigationRef = useRef(null);
  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="dark" />
      <AppNavigator navigationRef={navigationRef} />
    </NavigationContainer>
  );
};

// ============================================================
// APP NAVIGATOR - Inside AppProvider, has access to context
// ============================================================
const AppNavigator = ({ navigationRef }) => {
  const { isLoading, hasCompletedOnboarding } = require('./src/context/AppContext').useApp();
  const {
    checkAndSendSmartNotification,
    scheduleInactivityCheck,
    scheduleWeeklyCheckin,
    markWeeklyCheckinShown,
  } = useNotifications();
  const navLogRef = useRef(null);

  useEffect(() => {
    const prev = navLogRef.current;
    if (
      __DEV__ &&
      (!prev ||
        prev.isLoading !== isLoading ||
        prev.hasCompletedOnboarding !== hasCompletedOnboarding)
    ) {
      console.log(
        '[AppNavigator] isLoading:',
        isLoading,
        'hasCompletedOnboarding:',
        hasCompletedOnboarding,
      );
    }
    navLogRef.current = { isLoading, hasCompletedOnboarding };
  }, [isLoading, hasCompletedOnboarding]);

  useEffect(() => {
    scheduleInactivityCheck();
    checkAndSendSmartNotification();
    scheduleWeeklyCheckin();

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkAndSendSmartNotification();
        scheduleInactivityCheck();
        scheduleWeeklyCheckin();
      }
    });
    return () => {
      sub.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Weekly check-in notification → deep-link into Insights screen + modal.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response?.notification?.request?.content?.data;
      if (!data) return;
      if (data.type === 'weekly_checkin') {
        await markWeeklyCheckinShown();
        try {
          navigationRef?.current?.navigate('Insights', { tab: 'ai', openCheckin: true });
        } catch (_) {}
      }
    });
    return () => {
      sub.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return <MainStack hasCompletedOnboarding={hasCompletedOnboarding} />;
};

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingLogo: {
    width: 280,
    height: 70,
    marginBottom: 20,
  },
  loadingTagline: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    marginBottom: 24,
    letterSpacing: 0.3,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#16A34A',
  },
});
