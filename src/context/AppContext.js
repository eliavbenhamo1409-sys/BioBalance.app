/**
 * AppContext.js - BioBalance
 * 
 * CLEAN DATA MANAGEMENT
 * ====================
 * This context ONLY manages user data (profile, stats, messages).
 * Authentication is handled by App.js.
 * 
 * When session is provided → load user data from Supabase.
 * When data is ready → isLoading = false.
 */

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import moment from 'moment';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  supabase,
  getUserProfile,
  saveUserProfile,
  getDailyStat,
  saveDailyStat,
  getChatMessages,
  saveChatMessage,
  getMealsByDate,
  saveMeal,
  deleteMeal,
  updateMeal,
} from '../api/supabaseClient';

// Keep base44 for AI functions (OpenAI)
import { base44 } from '../api/base44Client';

const AppContext = createContext();

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

// Calculate "today" with 3:00 AM reset
// Before 3:00 AM → consider it as "yesterday"
const getTodayWithReset = () => {
  const now = moment();
  const threeAM = moment().startOf('day').add(3, 'hours');
  
  if (now.isBefore(threeAM)) {
    return moment().subtract(1, 'day').format('YYYY-MM-DD');
  }
  return moment().format('YYYY-MM-DD');
};

export const AppProvider = ({ children, session }) => {
  const user = session?.user || null;
  const today = getTodayWithReset();
  
  // Data states
  const [profile, setProfileState] = useState(null);
  const [dailyStats, setDailyStatsState] = useState({
    calories: 0,
    protein: 0,
    fat: 0,
    water_glasses: 0
  });
  const [messages, setMessages] = useState([]);
  const [meals, setMeals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  
  // Prevent race conditions
  const loadingRef = useRef(null);
  const isMountedRef = useRef(true);

  // ================================================
  // LOAD USER DATA ON MOUNT
  // ================================================
  useEffect(() => {
    isMountedRef.current = true;
    
    if (user?.id) {
      console.log('[AppContext] Session received, loading data for:', user.email);
      loadUserData(user.id);
    } else {
      console.log('[AppContext] No user, setting loading to false');
      setIsLoading(false);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [user?.id]);

  // ================================================
  // MAIN DATA LOADING FUNCTION
  // ================================================
  const loadUserData = async (userId) => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const loadId = Date.now();
    loadingRef.current = loadId;
    
    console.log('[AppContext] Starting data load for user:', userId);

    try {
      // Load profile
      const { data: profileData, error: profileError } = await getUserProfile(userId);
      
      // Check if still valid load
      if (loadingRef.current !== loadId || !isMountedRef.current) {
        console.log('[AppContext] Load cancelled - newer load in progress');
        return;
      }

      if (profileError) {
        console.log('[AppContext] Profile error:', profileError.message);
      }

      console.log('[AppContext] Profile loaded:', profileData ? 'EXISTS' : 'NULL');
      
      // Determine if onboarding is complete
      const isOnboardingDone = checkOnboardingComplete(profileData);
      
      if (isMountedRef.current) {
        setProfileState(profileData || null);
        setHasCompletedOnboarding(isOnboardingDone);
      }

      // If onboarding not done, stop loading here
      if (!isOnboardingDone) {
        console.log('[AppContext] Onboarding not complete, showing onboarding screen');
        setIsLoading(false);
        return;
      }

      // Load daily stats
      try {
        const { data: statsData } = await getDailyStat(userId, today);
        if (statsData && loadingRef.current === loadId && isMountedRef.current) {
          setDailyStatsState({
            id: statsData.id,
            calories: statsData.calories || 0,
            protein: statsData.protein || 0,
            fat: statsData.fat || 0,
            water_glasses: statsData.water || 0,
          });
          console.log('[AppContext] Daily stats loaded:', statsData.calories, 'cal');
        }
      } catch (statsError) {
        console.log('[AppContext] Stats load error:', statsError.message);
      }

      // Load today's meals
      try {
        const { data: mealsData } = await getMealsByDate(userId, today);
        if (mealsData && mealsData.length > 0 && loadingRef.current === loadId && isMountedRef.current) {
          setMeals(mealsData);
          console.log('[AppContext] Meals loaded:', mealsData.length, 'items');
        }
      } catch (mealsError) {
        console.log('[AppContext] Meals load error:', mealsError.message);
      }

      // Chat messages are NOT loaded from DB - fresh chat on every app open
      console.log('[AppContext] Chat starts fresh (no history loaded)');

      console.log('[AppContext] ✅ Data loading complete!');

    } catch (error) {
      console.error('[AppContext] Error loading data:', error);
    } finally {
      if (loadingRef.current === loadId && isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // ================================================
  // CHECK IF ONBOARDING IS COMPLETE
  // ================================================
  const checkOnboardingComplete = (profileData) => {
    if (!profileData) return false;

    // User has completed onboarding if:
    // 1. Explicit flag is set
    if (profileData.onboarding_completed === true) return true;

    // 2. Has all required fields from onboarding
    if (profileData.name && profileData.calories_target > 0 && profileData.goal) {
      return true;
    }

    // 3. Profile exists with meaningful data (user_id means row was created)
    if (profileData.user_id && profileData.weight_kg && profileData.height_cm) {
      return true;
    }

    return false;
  };

  // ================================================
  // PROFILE FUNCTIONS
  // ================================================
  const setProfile = async (newProfile) => {
    const profileWithEmail = {
      ...newProfile,
      email: user?.email || null,
      onboarding_completed: true,
    };

    console.log('[AppContext] Saving profile...');
    setProfileState(profileWithEmail);
    setHasCompletedOnboarding(true);

    if (user) {
      const result = await saveUserProfile(user.id, profileWithEmail);
      console.log('[AppContext] Profile saved:', result.error ? 'ERROR' : 'SUCCESS');
      return result;
    }
    return { data: profileWithEmail, error: null };
  };

  // ================================================
  // DAILY STATS FUNCTIONS
  // ================================================
  const setDailyStats = async (newStats) => {
    console.log('[AppContext] setDailyStats called with:', newStats);
    const updatedStats = { ...dailyStats, ...newStats };
    console.log('[AppContext] Updated stats:', updatedStats);
    setDailyStatsState(updatedStats);
    
    if (user) {
      const { error } = await saveDailyStat(user.id, today, {
        calories: updatedStats.calories,
        protein: updatedStats.protein,
        fat: updatedStats.fat,
        water: updatedStats.water_glasses,
      });
      if (error) {
        console.error('[AppContext] Error saving daily stats:', error);
      } else {
        console.log('[AppContext] Daily stats saved successfully to Supabase');
      }
    }
  };

  const updateStat = async (statName, value) => {
    const newStats = { ...dailyStats, [statName]: value };
    setDailyStatsState(newStats);
    
    if (user) {
      const dbField = statName === 'water_glasses' ? 'water' : statName;
      await saveDailyStat(user.id, today, { [dbField]: value });
    }
  };

  // ================================================
  // MESSAGE FUNCTIONS (Persisted to AsyncStorage, reset daily at 3 AM)
  // ================================================
  const MESSAGES_STORAGE_KEY = '@chat_messages';
  
  // Load messages from AsyncStorage on startup
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const savedMessages = await AsyncStorage.getItem(MESSAGES_STORAGE_KEY);
        if (savedMessages) {
          const parsed = JSON.parse(savedMessages);
          console.log('[AppContext] Loaded', parsed.length, 'messages from storage');
          setMessages(parsed);
        }
      } catch (error) {
        console.error('[AppContext] Error loading messages:', error);
      }
    };
    loadMessages();
  }, []);
  
  // Save messages to AsyncStorage whenever they change
  useEffect(() => {
    const saveMessages = async () => {
      try {
        await AsyncStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages));
      } catch (error) {
        console.error('[AppContext] Error saving messages:', error);
      }
    };
    // Only save if messages array exists
    if (messages.length > 0) {
      saveMessages();
    }
  }, [messages]);

  const addMessage = async (message) => {
    const messageText = message.text || '';

    const newMessage = {
      id: message.id || Date.now().toString(),
      text: messageText,
      isBot: message.isBot,
      type: message.type || 'text',
      data: message.data,
      metadata: message.metadata,
    };

    setMessages(prev => [...prev, newMessage]);
  };

  // Clear all messages (for session reset)
  const clearMessages = async () => {
    setMessages([]);
    try {
      await AsyncStorage.removeItem(MESSAGES_STORAGE_KEY);
      console.log('[AppContext] Messages cleared from storage');
    } catch (error) {
      console.error('[AppContext] Error clearing messages:', error);
    }
  };

  // ================================================
  // MEAL FUNCTIONS
  // ================================================
  const addMeal = async (mealData, skipStatsUpdate = false) => {
    if (!user) {
      console.log('[AppContext] addMeal: No user, skipping');
      return;
    }

    console.log('[AppContext] addMeal: Saving meal:', mealData.name, 'date:', today);
    
    const { data: newMeal, error } = await saveMeal(user.id, {
      ...mealData,
      date: today,
    });

    if (error) {
      console.log('[AppContext] addMeal: Error saving meal:', error);
      return;
    }

    console.log('[AppContext] addMeal: Saved successfully:', newMeal?.id, newMeal?.name);

    if (newMeal) {
      setMeals(prev => {
        console.log('[AppContext] addMeal: Updating meals state, prev count:', prev.length);
        return [newMeal, ...prev];
      });

      // Update daily stats (unless skipped - when batch processing)
      if (!skipStatsUpdate) {
        const newCalories = dailyStats.calories + (mealData.calories || 0);
        const newProtein = dailyStats.protein + (mealData.protein || 0);
        const newFat = dailyStats.fat + (mealData.fat || 0);

        await setDailyStats({
          calories: newCalories,
          protein: newProtein,
          fat: newFat,
          water_glasses: dailyStats.water_glasses,
        });
      }
    }
  };

  const removeMeal = async (mealId) => {
    const meal = meals.find(m => m.id === mealId);
    if (!meal) return;

    await deleteMeal(mealId);
    setMeals(prev => prev.filter(m => m.id !== mealId));

    // Update daily stats
    const newCalories = Math.max(0, dailyStats.calories - (meal.calories || 0));
    const newProtein = Math.max(0, dailyStats.protein - (meal.protein || 0));
    const newFat = Math.max(0, dailyStats.fat - (meal.fat || 0));

    await setDailyStats({
      calories: newCalories,
      protein: newProtein,
      fat: newFat,
      water_glasses: dailyStats.water_glasses,
    });
  };

  const editMeal = async (mealId, updatedData) => {
    const originalMeal = meals.find(m => m.id === mealId);
    if (!originalMeal) return;

    // Update in database
    const { data: updatedMeal } = await updateMeal(mealId, updatedData);
    
    if (updatedMeal) {
      // Update local state
      setMeals(prev => prev.map(m => m.id === mealId ? { ...m, ...updatedData } : m));

      // Calculate difference and update daily stats
      const caloriesDiff = (updatedData.calories || 0) - (originalMeal.calories || 0);
      const proteinDiff = (updatedData.protein || 0) - (originalMeal.protein || 0);
      const fatDiff = (updatedData.fat || 0) - (originalMeal.fat || 0);

      await setDailyStats({
        calories: Math.max(0, dailyStats.calories + caloriesDiff),
        protein: Math.max(0, dailyStats.protein + proteinDiff),
        fat: Math.max(0, dailyStats.fat + fatDiff),
        water_glasses: dailyStats.water_glasses,
      });
    }
  };

  // ================================================
  // WATER FUNCTIONS
  // ================================================
  const addWater = async (glasses = 1) => {
    const newWater = (dailyStats.water_glasses || 0) + glasses;
    await updateStat('water_glasses', newWater);
    return newWater;
  };

  // ================================================
  // LOGOUT FUNCTION
  // ================================================
  const logout = async () => {
    console.log('[AppContext] Logging out...');
    
    try {
      // Sign out from Supabase - this will trigger SIGNED_OUT event in App.js
      await supabase.auth.signOut();
      console.log('[AppContext] Supabase signOut successful');
    } catch (error) {
      console.log('[AppContext] Logout error:', error);
    }
  };

  // ================================================
  // CONTEXT VALUE
  // ================================================
  const value = {
    // User & Auth
    user,
    isAuthenticated: !!user,
    logout,

    // Profile
    profile,
    setProfile,
    hasCompletedOnboarding,

    // Daily Stats
    dailyStats,
    setDailyStats,
    updateStat,

    // Messages (ephemeral - not persisted)
    messages,
    setMessages,
    addMessage,
    clearMessages,

    // Meals
    meals,
    addMeal,
    removeMeal,
    editMeal,

    // Water
    addWater,

    // Loading state
    isLoading,
    today,

    // Refresh data
    refreshData: () => user && loadUserData(user.id),

    // AI integrations (OpenAI via base44)
    ai: base44.integrations.Core,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
