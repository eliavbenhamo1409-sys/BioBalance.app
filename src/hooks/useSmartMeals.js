import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../api/supabaseClient';

/**
 * Hook to fetch and manage smart recurring meals
 * Analyzes user's meal history for frequently eaten meals
 */
export const useSmartMeals = (userId) => {
  const [recurringMeals, setRecurringMeals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    fetchRecurringMeals();
  }, [userId]);

  const fetchRecurringMeals = async () => {
    setIsLoading(true);
    try {
      if (userId) {
        // Fetch from Supabase - get meals from last 7 days
        const { data, error } = await supabase
          .from('daily_stats')
          .select('date, foods')
          .eq('user_id', userId)
          .gte('date', getDateDaysAgo(7))
          .order('date', { ascending: false });

        if (!error && data) {
          const analyzed = analyzeMealFrequency(data);
          setRecurringMeals(analyzed);
          setIsEmpty(analyzed.length === 0);

          // Cache for quick access
          await AsyncStorage.setItem('cached_recurring_meals', JSON.stringify(analyzed));
        }
      } else {
        // Guest user - load from cache
        const cached = await AsyncStorage.getItem('cached_recurring_meals');
        if (cached) {
          const parsed = JSON.parse(cached);
          setRecurringMeals(parsed);
          setIsEmpty(parsed.length === 0);
        }
      }
    } catch (error) {
      console.log('Error fetching recurring meals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeMealFrequency = (dailyStats) => {
    const mealCount = {};

    // Count meal occurrences
    dailyStats.forEach(day => {
      if (day.foods && Array.isArray(day.foods)) {
        day.foods.forEach(food => {
          const name = food.name?.toLowerCase().trim();
          if (name) {
            if (!mealCount[name]) {
              mealCount[name] = {
                name: food.name,
                count: 0,
                totalCalories: 0,
                avgCalories: 0,
                protein: food.protein || 0,
                fat: food.fat || 0,
                lastEaten: day.date,
              };
            }
            mealCount[name].count++;
            mealCount[name].totalCalories += food.calories || 0;
          }
        });
      }
    });

    // Filter meals that appear at least 2 times and calculate average
    const recurring = Object.values(mealCount)
      .filter(meal => meal.count >= 2)
      .map(meal => ({
        ...meal,
        avgCalories: Math.round(meal.totalCalories / meal.count),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8); // Top 8 most frequent meals

    return recurring;
  };

  const getDateDaysAgo = (days) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  };

  const refreshMeals = () => {
    fetchRecurringMeals();
  };

  return {
    recurringMeals,
    isLoading,
    isEmpty,
    refreshMeals,
  };
};


