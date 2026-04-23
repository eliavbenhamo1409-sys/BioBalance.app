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

import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppProvider } from './src/context/AppContext';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Image, Text } from 'react-native';
import { supabase } from './src/api/supabaseClient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
} from 'react-native-reanimated';

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
import Profile from './src/screens/Profile';
import Account from './src/screens/Account';
import RecentMeals from './src/screens/RecentMeals';

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
      <Stack.Screen name="Statistics" component={Statistics} />
      <Stack.Screen name="Recipes" component={Recipes} />
      <Stack.Screen name="RecipeDetail" component={RecipeDetail} />
      <Stack.Screen name="Reminders" component={Reminders} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettings} />
      <Stack.Screen name="AIInsights" component={AIInsights} />
      <Stack.Screen name="Profile" component={Profile} />
      <Stack.Screen name="Account" component={Account} />
      <Stack.Screen name="RecentMeals" component={RecentMeals} />
    </Stack.Navigator>
  );
};

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  // Auth states: 'initializing' | 'unauthenticated' | 'authenticated'
  const [authState, setAuthState] = useState('initializing');
  const [session, setSession] = useState(null);
  const initRef = useRef(false);
  const authResolvedRef = useRef(false); // Track if auth has been resolved

  useEffect(() => {
    // Prevent double initialization in dev mode
    if (initRef.current) return;
    initRef.current = true;

    console.log('[App] Initializing...');

    // ================================================
    // SINGLE SOURCE OF TRUTH: Supabase auth listener
    // ================================================
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log('[App] Auth event:', event, newSession?.user?.email || 'no user');

      // Mark auth as resolved on ANY event
      authResolvedRef.current = true;

      switch (event) {
        case 'INITIAL_SESSION':
          // First check on app load
          if (newSession) {
            console.log('[App] Initial session found');
            setSession(newSession);
            setAuthState('authenticated');
          } else {
            console.log('[App] No initial session');
            setAuthState('unauthenticated');
          }
          break;

        case 'SIGNED_IN':
        case 'TOKEN_REFRESHED':
          console.log('[App] User signed in');
          setSession(newSession);
          setAuthState('authenticated');
          break;

        case 'SIGNED_OUT':
          console.log('[App] User signed out');
          setSession(null);
          setAuthState('unauthenticated');
          break;

        default:
          // For any other event, just update session if present
          if (newSession) {
            setSession(newSession);
            setAuthState('authenticated');
          }
      }
    });

    // Timeout fallback - ONLY if no auth event has fired yet
    const timeout = setTimeout(() => {
      if (!authResolvedRef.current) {
        console.log('[App] Timeout - no auth event received, forcing unauthenticated');
        setAuthState('unauthenticated');
      }
    }, 5000);

    return () => {
      subscription?.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // ================================================
  // RENDER BASED ON AUTH STATE
  // ================================================
  
  // Still initializing
  if (authState === 'initializing') {
    return <LoadingScreen />;
  }

  // Not logged in
  if (authState === 'unauthenticated' || !session) {
    return (
      <NavigationContainer>
        <StatusBar style="dark" />
        <AuthStack />
      </NavigationContainer>
    );
  }

  // Logged in - wrap with AppProvider
  return (
    <AppProvider session={session}>
      <NavigationContainer>
        <StatusBar style="dark" />
        <AppNavigator />
      </NavigationContainer>
    </AppProvider>
  );
}

// ============================================================
// APP NAVIGATOR - Inside AppProvider, has access to context
// ============================================================
const AppNavigator = () => {
  const { isLoading, hasCompletedOnboarding } = require('./src/context/AppContext').useApp();
  
  console.log('[AppNavigator] isLoading:', isLoading, 'hasCompletedOnboarding:', hasCompletedOnboarding);

  // Show loading while AppContext loads data
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
