// Base44 Client for React Native
// LLM features use Gemini (Supabase gemini-proxy); local data in AsyncStorage.

import { mockEntities } from './mockDatabase';
import { chatWithBot, analyzeFoodFromImage, calculateNutritionTargets, getNutritionAdvice } from './aiClient';

export const base44 = {
  entities: mockEntities,
  
  integrations: {
    Core: {
      InvokeLLM: async ({ prompt, context = {} }) => {
        try {
          const response = await chatWithBot(prompt, context);
          return { response };
        } catch (error) {
          console.error('AI Chat error:', error);
          return { response: 'אופס, משהו השתבש 😅 נסה שוב' };
        }
      },
      
      AnalyzeFood: async (imageBase64) => {
        try {
          return await analyzeFoodFromImage(imageBase64);
        } catch (error) {
          console.error('Food analysis error:', error);
          return {
            name: 'מנה לא מזוהה',
            calories_per_100g: 150,
            protein_per_100g: 10,
            fat_per_100g: 5,
            estimated_portion_grams: 150,
          };
        }
      },
      
      // Calculate personalized nutrition targets
      CalculateTargets: async (userData) => {
        try {
          return await calculateNutritionTargets(userData);
        } catch (error) {
          console.error('Targets calculation error:', error);
          // Fallback calculation
          return calculateBasicTargets(userData);
        }
      },
      
      // Get nutrition advice
      GetAdvice: async (context, question) => {
        try {
          return await getNutritionAdvice(context, question);
        } catch (error) {
          console.error('Advice error:', error);
          return 'מצטער, לא הצלחתי לתת עצה כרגע. נסה שוב מאוחר יותר.';
        }
      },
      
      // Mock file upload (returns local URI)
      UploadFile: async ({ file }) => {
        return { file_url: file.uri || 'mock://uploaded' };
      },
    },
  },
  
  agents: {
    getWhatsAppConnectURL: (agentName) => {
      return `https://wa.me/?text=Connect%20to%20${agentName}`;
    },
  },
};

// Basic calculation fallback
const calculateBasicTargets = (userData) => {
  let bmr;
  if (userData.gender === 'male') {
    bmr = 10 * userData.weight_kg + 6.25 * userData.height_cm - 5 * userData.age + 5;
  } else {
    bmr = 10 * userData.weight_kg + 6.25 * userData.height_cm - 5 * userData.age - 161;
  }
  
  const multipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    high: 1.725
  };
  
  const tdee = Math.round(bmr * (multipliers[userData.activity_level] || 1.2));
  
  return {
    calories_target: tdee,
    protein_target: Math.round(userData.weight_kg * 1.2),
    fat_target: Math.round(tdee * 0.25 / 9),
    water_target: userData.water_target || 8,
    explanation: 'יעדים מחושבים לפי נתוני הגוף ורמת הפעילות שלך.'
  };
};
