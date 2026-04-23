import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock database for local storage when Base44 is not available
const STORAGE_KEYS = {
  PROFILE: '@nature_bot_profile',
  DAILY_STATS: '@nature_bot_daily_stats',
  MESSAGES: '@nature_bot_messages',
  MEALS: '@nature_bot_meals',
};

// Helper functions
const getItem = async (key) => {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error('Error getting item:', error);
    return null;
  }
};

const setItem = async (key, value) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Error setting item:', error);
    return false;
  }
};

// Mock entities
export const mockEntities = {
  UserProfile: {
    list: async () => {
      const profile = await getItem(STORAGE_KEYS.PROFILE);
      return profile ? [profile] : [];
    },
    create: async (data) => {
      const profile = { id: Date.now().toString(), ...data };
      await setItem(STORAGE_KEYS.PROFILE, profile);
      return profile;
    },
    update: async (id, data) => {
      const profile = await getItem(STORAGE_KEYS.PROFILE);
      if (profile) {
        const updated = { ...profile, ...data };
        await setItem(STORAGE_KEYS.PROFILE, updated);
        return updated;
      }
      return null;
    },
  },
  
  DailyStat: {
    filter: async ({ date }) => {
      const allStats = await getItem(STORAGE_KEYS.DAILY_STATS) || {};
      return allStats[date] ? [allStats[date]] : [];
    },
    create: async (data) => {
      const allStats = await getItem(STORAGE_KEYS.DAILY_STATS) || {};
      const stat = { id: Date.now().toString(), ...data };
      allStats[data.date] = stat;
      await setItem(STORAGE_KEYS.DAILY_STATS, allStats);
      return stat;
    },
    update: async (id, data) => {
      const allStats = await getItem(STORAGE_KEYS.DAILY_STATS) || {};
      for (const date in allStats) {
        if (allStats[date].id === id) {
          allStats[date] = { ...allStats[date], ...data };
          await setItem(STORAGE_KEYS.DAILY_STATS, allStats);
          return allStats[date];
        }
      }
      return null;
    },
    list: async (sort, limit) => {
      const allStats = await getItem(STORAGE_KEYS.DAILY_STATS) || {};
      const stats = Object.values(allStats);
      stats.sort((a, b) => new Date(b.date) - new Date(a.date));
      return stats.slice(0, limit || 100);
    },
  },
  
  ChatMessage: {
    list: async (sort, limit) => {
      const messages = await getItem(STORAGE_KEYS.MESSAGES) || [];
      return messages.slice(-(limit || 50));
    },
    create: async (data) => {
      const messages = await getItem(STORAGE_KEYS.MESSAGES) || [];
      const message = { id: Date.now().toString(), ...data };
      messages.push(message);
      await setItem(STORAGE_KEYS.MESSAGES, messages);
      return message;
    },
  },
  
  Meal: {
    list: async (sort, limit) => {
      const meals = await getItem(STORAGE_KEYS.MEALS) || [];
      meals.sort((a, b) => new Date(b.date) - new Date(a.date));
      return meals.slice(0, limit || 100);
    },
    create: async (data) => {
      const meals = await getItem(STORAGE_KEYS.MEALS) || [];
      const meal = { id: Date.now().toString(), ...data };
      meals.push(meal);
      await setItem(STORAGE_KEYS.MEALS, meals);
      return meal;
    },
    delete: async (id) => {
      const meals = await getItem(STORAGE_KEYS.MEALS) || [];
      const filtered = meals.filter(m => m.id !== id);
      await setItem(STORAGE_KEYS.MEALS, filtered);
      return true;
    },
  },
};

// Mock integrations (for AI - returns mock data)
export const mockIntegrations = {
  Core: {
    InvokeLLM: async ({ prompt }) => {
      // Simple mock responses based on context
      const lowerPrompt = prompt.toLowerCase();
      
      if (lowerPrompt.includes('מומחה תזונה') || lowerPrompt.includes('זהה את המזון')) {
        // Food recognition mock
        return {
          name: 'מנה מזוהה',
          calories_per_100g: 150,
          protein_per_100g: 10,
          fat_per_100g: 5,
        };
      }
      
      // Chat response mock
      const responses = [
        'מעולה! המשך כך 💪',
        'אתה בכיוון הנכון! 🎯',
        'שמח לשמוע! תמשיך לשתות מים 💧',
        'יופי של התקדמות! 🌟',
        'בוא נמשיך לעקוב אחרי התזונה שלך 📊',
      ];
      
      return {
        response: responses[Math.floor(Math.random() * responses.length)],
      };
    },
    UploadFile: async ({ file }) => {
      // Mock file upload - just return a fake URL
      return { file_url: 'mock://uploaded-image-' + Date.now() };
    },
  },
};

// Clear all data (for testing)
export const clearAllData = async () => {
  try {
    await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
    return true;
  } catch (error) {
    console.error('Error clearing data:', error);
    return false;
  }
};





