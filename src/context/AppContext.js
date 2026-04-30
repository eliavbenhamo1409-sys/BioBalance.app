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

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
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
  insertWaterLog,
  insertWeightLog,
} from '../api/supabaseClient';

// Keep base44 for AI helpers (Gemini via aiClient → gemini-proxy)
import { base44 } from '../api/base44Client';

const devLog = (...args) => {
  if (__DEV__) console.log(...args);
};

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

/** Sum kcal / macros from meal rows (authoritative for daily balance). */
function aggregateMacrosFromMealRows(mealList) {
  return (mealList || []).reduce(
    (acc, m) => ({
      calories: acc.calories + (Number(m.calories) || 0),
      protein: acc.protein + (Number(m.protein) || 0),
      fat: acc.fat + (Number(m.fat) || 0),
      carbs: acc.carbs + (Number(m.carbs) || 0),
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );
}

export const AppProvider = ({ children, session }) => {
  const user = session?.user || null;
  const today = getTodayWithReset();
  
  // Data states
  const [profile, setProfileState] = useState(null);
  const [dailyStats, setDailyStatsState] = useState({
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    water_glasses: 0
  });
  const [messages, setMessages] = useState([]);
  const [meals, setMeals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  
  // Prevent race conditions
  const loadingRef = useRef(null);
  const isMountedRef = useRef(true);
  /** Latest daily stats for merges (avoids stale closure on rapid updates). */
  const dailyStatsRef = useRef(dailyStats);
  useEffect(() => {
    dailyStatsRef.current = dailyStats;
  }, [dailyStats]);

  /** Recalculate kcal/macros from today's meals list; preserves water_glasses row. */
  const syncDailyMacrosFromMealsDb = useCallback(
    async (loadIdCheck) => {
      if (!user?.id || !isMountedRef.current) return;
      if (loadIdCheck != null && loadingRef.current !== loadIdCheck) return;
      try {
        const { data: mealRows, error: mealErr } = await getMealsByDate(user.id, today);
        if (mealErr) devLog('[AppContext] getMealsByDate (sync):', mealErr.message);
        const { data: dsRow } = await getDailyStat(user.id, today);

        const agg = aggregateMacrosFromMealRows(mealRows || []);
        const water =
          dsRow?.water ??
          dailyStatsRef.current?.water_glasses ??
          0;

        const next = {
          id: dsRow?.id ?? dailyStatsRef.current?.id,
          calories: Math.max(0, Math.round(agg.calories)),
          protein: Math.max(0, Math.round(agg.protein * 10) / 10),
          fat: Math.max(0, Math.round(agg.fat * 10) / 10),
          carbs: Math.max(0, Math.round(agg.carbs * 10) / 10),
          water_glasses:
            typeof water === 'number' ? water : Number(water) || 0,
        };

        if (!isMountedRef.current) return;
        if (loadIdCheck != null && loadingRef.current !== loadIdCheck) return;

        dailyStatsRef.current = next;
        setDailyStatsState(next);
        setMeals(mealRows || []);

        const { error } = await saveDailyStat(user.id, today, {
          calories: next.calories,
          protein: next.protein,
          fat: next.fat,
          carbs: next.carbs,
          water: next.water_glasses,
        });
        if (error) console.error('[AppContext] sync daily stats save:', error);
      } catch (e) {
        devLog('[AppContext] syncDailyMacrosFromMealsDb:', e?.message || e);
      }
    },
    [user?.id, today]
  );

  // ================================================
  // LOAD USER DATA ON MOUNT
  // ================================================
  useEffect(() => {
    isMountedRef.current = true;
    
    if (user?.id) {
      devLog('[AppContext] Session received, loading data for:', user.email);
      loadUserData(user.id);
    } else {
      devLog('[AppContext] No user, setting loading to false');
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
    
    devLog('[AppContext] Starting data load for user:', userId);

    try {
      // Load profile
      const { data: profileData, error: profileError } = await getUserProfile(userId);
      
      // Check if still valid load
      if (loadingRef.current !== loadId || !isMountedRef.current) {
        devLog('[AppContext] Load cancelled - newer load in progress');
        return;
      }

      if (profileError) {
        devLog('[AppContext] Profile error:', profileError.message);
      }

      devLog('[AppContext] Profile loaded:', profileData ? 'EXISTS' : 'NULL');
      
      // Determine if onboarding is complete
      const isOnboardingDone = checkOnboardingComplete(profileData);
      
      if (isMountedRef.current) {
        setProfileState(profileData || null);
        setHasCompletedOnboarding(isOnboardingDone);
      }

      // If onboarding not done, stop loading here
      if (!isOnboardingDone) {
        devLog('[AppContext] Onboarding not complete, showing onboarding screen');
        setIsLoading(false);
        return;
      }

      // Daily macros + meals: single source of truth = sum of `meals` rows for today
      if (loadingRef.current === loadId && isMountedRef.current) {
        await syncDailyMacrosFromMealsDb(loadId);
      }

      // Chat messages are NOT loaded from DB - fresh chat on every app open
      devLog('[AppContext] Chat starts fresh (no history loaded)');

      devLog('[AppContext] ✅ Data loading complete!');

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
    const previousWeight = profile?.weight_kg;
    const profileWithEmail = {
      ...newProfile,
      email: user?.email || null,
      onboarding_completed: true,
    };

    devLog('[AppContext] Saving profile...');
    setProfileState(profileWithEmail);
    setHasCompletedOnboarding(true);

    if (user) {
      const result = await saveUserProfile(user.id, profileWithEmail);
      devLog('[AppContext] Profile saved:', result.error ? 'ERROR' : 'SUCCESS');
      const w = newProfile?.weight_kg;
      if (!result?.error && w != null && Number(w) > 0 && w !== previousWeight) {
        try {
          await insertWeightLog(user.id, today, Number(w), 'profile');
        } catch (e) {
          devLog('[AppContext] insertWeightLog:', e?.message || e);
        }
      }
      return result;
    }
    return { data: profileWithEmail, error: null };
  };

  // ================================================
  // DAILY STATS FUNCTIONS
  // ================================================
  const setDailyStats = async (newStats) => {
    devLog('[AppContext] setDailyStats called with:', newStats);
    const updatedStats = { ...dailyStatsRef.current, ...newStats };
    devLog('[AppContext] Updated stats:', updatedStats);
    dailyStatsRef.current = updatedStats;
    setDailyStatsState(updatedStats);

    if (user) {
      const { error } = await saveDailyStat(user.id, today, {
        calories: updatedStats.calories,
        protein: updatedStats.protein,
        fat: updatedStats.fat,
        carbs: updatedStats.carbs ?? 0,
        water: updatedStats.water_glasses,
      });
      if (error) {
        console.error('[AppContext] Error saving daily stats:', error);
      } else {
        devLog('[AppContext] Daily stats saved successfully to Supabase');
      }
    }
  };

  const updateStat = async (statName, value) => {
    const newStats = { ...dailyStatsRef.current, [statName]: value };
    dailyStatsRef.current = newStats;
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
          devLog('[AppContext] Loaded', parsed.length, 'messages from storage');
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
      devLog('[AppContext] Messages cleared from storage');
    } catch (error) {
      console.error('[AppContext] Error clearing messages:', error);
    }
  };

  // ================================================
  // MEAL FUNCTIONS
  // ================================================
  const addMeal = async (mealData, skipStatsUpdate = false) => {
    if (!user) {
      devLog('[AppContext] addMeal: No user, skipping');
      return;
    }

    devLog('[AppContext] addMeal: Saving meal:', mealData.name, 'date:', today);
    
    const { data: newMeal, error } = await saveMeal(user.id, {
      ...mealData,
      date: today,
      source: mealData.source || 'manual',
    });

    if (error) {
      devLog('[AppContext] addMeal: Error saving meal:', error);
      return;
    }

    devLog('[AppContext] addMeal: Saved successfully:', newMeal?.id, newMeal?.name);

    if (newMeal) {
      if (!skipStatsUpdate) {
        await syncDailyMacrosFromMealsDb();
      } else {
        setMeals((prev) => {
          devLog('[AppContext] addMeal: Updating meals state, prev count:', prev.length);
          return [newMeal, ...prev];
        });
      }
    }
  };

  const removeMeal = async (mealId) => {
    if (!user) return;

    const { error: delErr } = await deleteMeal(mealId);
    if (delErr) {
      devLog('[AppContext] removeMeal delete:', delErr);
      return;
    }

    await syncDailyMacrosFromMealsDb();
  };

  const editMeal = async (mealId, updatedData) => {
    const originalMeal = meals.find((m) => m.id === mealId);
    if (!originalMeal) return;

    const { data: updatedMeal } = await updateMeal(mealId, updatedData);

    if (updatedMeal) {
      await syncDailyMacrosFromMealsDb();
    }
  };

  // ================================================
  // WATER FUNCTIONS
  // ================================================
  const addWater = async (glasses = 1) => {
    const newWater = (dailyStatsRef.current?.water_glasses || 0) + glasses;
    await updateStat('water_glasses', newWater);
    if (user?.id) {
      try {
        await insertWaterLog(user.id, today, glasses);
      } catch (e) {
        devLog('[AppContext] insertWaterLog:', e?.message || e);
      }
    }
    return newWater;
  };

  // ================================================
  // LOGOUT FUNCTION
  // ================================================
  const logout = async () => {
    devLog('[AppContext] Logging out...');
    
    try {
      // Sign out from Supabase - this will trigger SIGNED_OUT event in App.js
      await supabase.auth.signOut();
      devLog('[AppContext] Supabase signOut successful');
    } catch (error) {
      devLog('[AppContext] Logout error:', error);
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

    // AI integrations (Gemini via base44)
    ai: base44.integrations.Core,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
