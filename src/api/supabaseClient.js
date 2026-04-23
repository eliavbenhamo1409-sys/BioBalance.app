// Supabase Client for Nature Bot
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { LogBox } from 'react-native';

// Ignore refresh token errors in LogBox (they're handled gracefully)
LogBox.ignoreLogs([
  'Refresh token',
  'refresh_token',
  'not valid',
  'AuthApiError',
]);

// Supabase Configuration
const SUPABASE_URL = 'https://xnynrlctilanhcexkfse.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhueW5ybGN0aWxhbmhjZXhrZnNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNzY0MjQsImV4cCI6MjA4MDk1MjQyNH0.kqfMtay640UI031KD171-Lw7zG8UYkVM9W65zRfHb9U';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'implicit',
  },
});

// Global handler for auth state changes
// ⚠️ NEVER auto-logout! User stays logged in until explicit logout
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('[Supabase] Auth event:', event, session ? 'with session' : 'no session');
  
  if (event === 'SIGNED_IN') {
    console.log('[Supabase] User signed in:', session?.user?.email);
  }
  if (event === 'TOKEN_REFRESHED') {
    if (session) {
      console.log('[Supabase] Token refreshed successfully');
    } else {
      // Token refresh failed, but DON'T logout! Just log it
      console.log('[Supabase] Token refresh returned no session, but keeping user logged in');
    }
  }
  if (event === 'SIGNED_OUT') {
    console.log('[Supabase] User explicitly signed out');
  }
  // ⚠️ Never call clearInvalidSession() automatically here!
});

// Helper to clear invalid sessions without throwing errors
export const clearInvalidSession = async () => {
  try {
    // Clear all supabase related storage
    const keys = await AsyncStorage.getAllKeys();
    const supabaseKeys = keys.filter(key => key.includes('supabase'));
    if (supabaseKeys.length > 0) {
      await AsyncStorage.multiRemove(supabaseKeys);
    }
    await supabase.auth.signOut();
    console.log('[Supabase] Session cleared');
  } catch (e) {
    // Silently ignore
    console.log('[Supabase] Error clearing session:', e);
  }
};

// Helper to refresh session - tries multiple methods
export const refreshSession = async () => {
  console.log('[Supabase] Attempting session refresh...');
  
  // Method 1: Try standard refresh
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data?.session) {
      console.log('[Supabase] Session refreshed via refreshSession()');
      return data.session;
    }
    console.log('[Supabase] Standard refresh failed:', error?.message);
  } catch (e) {
    console.log('[Supabase] Standard refresh error:', e.message);
  }
  
  // Method 2: Try to get existing session
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (!error && session) {
      console.log('[Supabase] Found existing session');
      return session;
    }
  } catch (e) {
    console.log('[Supabase] getSession error:', e.message);
  }
  
  // Method 3: Try to recover from AsyncStorage directly
  try {
    const storedSession = await AsyncStorage.getItem('supabase.auth.token');
    if (storedSession) {
      const parsed = JSON.parse(storedSession);
      if (parsed?.currentSession?.access_token) {
        console.log('[Supabase] Found session in AsyncStorage, attempting to set...');
        const { data, error } = await supabase.auth.setSession({
          access_token: parsed.currentSession.access_token,
          refresh_token: parsed.currentSession.refresh_token || '',
        });
        if (!error && data?.session) {
          console.log('[Supabase] Session recovered from storage!');
          return data.session;
        }
      }
    }
  } catch (e) {
    console.log('[Supabase] Storage recovery failed:', e.message);
  }
  
  console.log('[Supabase] All refresh methods failed, but NOT logging out');
  return null;
};

// ============ Storage Functions ============

// העלאת תמונה
export const uploadImage = async (userId, imageUri, folder = 'meals') => {
  try {
    // קריאת הקובץ כ-base64
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // יצירת שם קובץ ייחודי
    const fileName = `${userId}/${folder}/${Date.now()}.jpg`;
    
    // העלאה ל-Supabase Storage
    const { data, error } = await supabase.storage
      .from('images')
      .upload(fileName, decode(base64), {
        contentType: 'image/jpeg',
        upsert: false,
      });
    
    if (error) throw error;
    
    // קבלת URL ציבורי
    const { data: urlData } = supabase.storage
      .from('images')
      .getPublicUrl(fileName);
    
    return { url: urlData.publicUrl, path: fileName, error: null };
  } catch (error) {
    console.error('Upload image error:', error);
    return { url: null, path: null, error };
  }
};

// מחיקת תמונה
export const deleteImage = async (filePath) => {
  try {
    const { error } = await supabase.storage
      .from('images')
      .remove([filePath]);
    
    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Delete image error:', error);
    return { error };
  }
};

// קבלת URL לתמונה
export const getImageUrl = (filePath) => {
  const { data } = supabase.storage
    .from('images')
    .getPublicUrl(filePath);
  return data.publicUrl;
};

// ============ Authentication Functions ============

// התחברות עם Google
export const signInWithGoogle = async () => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'naturebot://auth-callback',
      },
    });
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Google sign in error:', error);
    return { data: null, error };
  }
};

// התחברות עם אימייל וסיסמה
export const signInWithEmail = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Email sign in error:', error);
    return { data: null, error };
  }
};

// הרשמה עם אימייל וסיסמה
export const signUpWithEmail = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Sign up error:', error);
    return { data: null, error };
  }
};

// התנתקות
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Sign out error:', error);
    return { error };
  }
};

// קבלת המשתמש הנוכחי
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return { user, error: null };
  } catch (error) {
    return { user: null, error };
  }
};

// האזנה לשינויים באימות
export const onAuthStateChange = (callback) => {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
};

// ============ User Profile Functions ============

// שמירת פרופיל משתמש - with retry for foreign key issues
export const saveUserProfile = async (userId, profileData, retryCount = 0) => {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // 1 second

  try {
    // Verify user is authenticated first
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== userId) {
      console.log('User mismatch or not authenticated, using current session user');
      if (user) {
        userId = user.id; // Use the actual authenticated user ID
      } else {
        throw new Error('User not authenticated');
      }
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        ...profileData,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });
    
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Save profile error:', error);
    
    // Retry on foreign key violation (user might not be propagated yet)
    if (error.code === '23503' && retryCount < MAX_RETRIES) {
      console.log(`Retrying save profile... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return saveUserProfile(userId, profileData, retryCount + 1);
    }
    
    return { data: null, error };
  }
};

// קבלת פרופיל משתמש
export const getUserProfile = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return { data, error: null };
  } catch (error) {
    console.error('Get profile error:', error);
    return { data: null, error };
  }
};

// ============ Daily Stats Functions ============

// שמירת סטטיסטיקה יומית
export const saveDailyStat = async (userId, date, statsData) => {
  try {
    const { data, error } = await supabase
      .from('daily_stats')
      .upsert({
        user_id: userId,
        date: date,
        ...statsData,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,date',
      });
    
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Save daily stat error:', error);
    return { data: null, error };
  }
};

// קבלת סטטיסטיקה יומית
export const getDailyStat = async (userId, date) => {
  try {
    const { data, error } = await supabase
      .from('daily_stats')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Get daily stat error:', error);
    return { data: null, error };
  }
};

// קבלת היסטוריית סטטיסטיקות
export const getDailyStatsHistory = async (userId, limit = 30) => {
  try {
    const { data, error } = await supabase
      .from('daily_stats')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Get stats history error:', error);
    return { data: [], error };
  }
};

// ============ Meals Functions ============

// שמירת ארוחה
export const saveMeal = async (userId, mealData) => {
  try {
    console.log('[Supabase] saveMeal: userId:', userId, 'data:', mealData);
    const { data, error } = await supabase
      .from('meals')
      .insert({
        user_id: userId,
        ...mealData,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      console.error('[Supabase] saveMeal error:', error);
      throw error;
    }
    console.log('[Supabase] saveMeal success:', data?.id, data?.name);
    return { data, error: null };
  } catch (error) {
    console.error('[Supabase] saveMeal catch error:', error);
    return { data: null, error };
  }
};

// קבלת ארוחות לפי תאריך
export const getMealsByDate = async (userId, date) => {
  try {
    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Get meals error:', error);
    return { data: [], error };
  }
};

// מחיקת ארוחה
export const deleteMeal = async (mealId) => {
  try {
    const { error } = await supabase
      .from('meals')
      .delete()
      .eq('id', mealId);
    
    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Delete meal error:', error);
    return { error };
  }
};

// עדכון ארוחה
export const updateMeal = async (mealId, mealData) => {
  try {
    const { data, error } = await supabase
      .from('meals')
      .update({
        ...mealData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', mealId)
      .select()
      .single();
    
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Update meal error:', error);
    return { data: null, error };
  }
};

// ============ Chat Messages Functions ============

// שמירת הודעת צ'אט
export const saveChatMessage = async (userId, messageData) => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        user_id: userId,
        ...messageData,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Save message error:', error);
    return { data: null, error };
  }
};

// קבלת הודעות צ'אט
export const getChatMessages = async (userId, limit = 50) => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(limit);
    
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Get messages error:', error);
    return { data: [], error };
  }
};

// ============ Recipes Functions ============

// שמירת מתכון
export const saveRecipe = async (userId, recipeData) => {
  try {
    const { data, error } = await supabase
      .from('saved_recipes')
      .insert({
        user_id: userId,
        ...recipeData,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Save recipe error:', error);
    return { data: null, error };
  }
};

// קבלת מתכונים שמורים
export const getSavedRecipes = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('saved_recipes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Get recipes error:', error);
    return { data: [], error };
  }
};

// מחיקת מתכון
export const deleteRecipe = async (recipeId) => {
  try {
    const { error } = await supabase
      .from('saved_recipes')
      .delete()
      .eq('id', recipeId);
    
    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Delete recipe error:', error);
    return { error };
  }
};

// ============ OTP Functions ============

// שליחת OTP לאימייל
export const sendOTP = async (email) => {
  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Send OTP error:', error);
    return { data: null, error };
  }
};

// אימות OTP
export const verifyOTP = async (email, token) => {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Verify OTP error:', error);
    return { data: null, error };
  }
};

