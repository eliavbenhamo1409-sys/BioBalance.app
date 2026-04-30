import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import { getSavedRecipes, deleteRecipe as deleteRecipeFromSupabase } from '../api/supabaseClient';

export default function Recipes() {
  const navigation = useNavigation();
  const { user } = useApp();
  const [recipes, setRecipes] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadRecipes();
  }, [user]);

  const loadRecipes = async () => {
    try {
      if (user) {
        // Load from Supabase if logged in
        const { data } = await getSavedRecipes(user.id);
        if (data) {
          setRecipes(data.map(r => ({
            id: r.id,
            title: r.title,
            content: r.content,
            calories: r.calories,
            savedAt: r.created_at,
          })));
        }
      } else {
        // Fallback to AsyncStorage for guest users
        const saved = await AsyncStorage.getItem('saved_recipes');
        if (saved) {
          const parsed = JSON.parse(saved);
          setRecipes(parsed.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt)));
        }
      }
    } catch (error) {
      console.log('Error loading recipes:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecipes();
    setRefreshing(false);
  };

  const deleteRecipe = async (id) => {
    Alert.alert(
      'מחיקת מתכון',
      'האם למחוק את המתכון?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            const updated = recipes.filter(r => r.id !== id);
            setRecipes(updated);

            if (user) {
              // Delete from Supabase
              await deleteRecipeFromSupabase(id);
            } else {
              // Delete from AsyncStorage
              await AsyncStorage.setItem('saved_recipes', JSON.stringify(updated));
            }
          },
        },
      ]
    );
  };

  const openRecipe = (recipe) => {
    navigation.navigate('RecipeDetail', { recipe });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', {
      day: 'numeric',
      month: 'short',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>המתכונים שלי</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {recipes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📖</Text>
            <Text style={styles.emptyTitle}>אין מתכונים שמורים</Text>
            <Text style={styles.emptyText}>
              בקש מהבוט מתכון ולחץ "שמור" כדי להוסיף אותו לאוסף שלך
            </Text>
          </View>
        ) : (
          <View style={styles.recipesList}>
            {recipes.map((recipe) => (
              <TouchableOpacity
                key={recipe.id}
                style={styles.recipeCard}
                onPress={() => openRecipe(recipe)}
                onLongPress={() => deleteRecipe(recipe.id)}
                activeOpacity={0.7}
              >
                <View style={styles.recipeIcon}>
                  <Text style={styles.recipeEmoji}>🍽️</Text>
                </View>
                <View style={styles.recipeInfo}>
                  <Text style={styles.recipeTitle} numberOfLines={1}>
                    {recipe.title}
                  </Text>
                  <Text style={styles.recipeDate}>
                    נשמר ב-{formatDate(recipe.savedAt)}
                  </Text>
                </View>
                <Text style={styles.chevron}>←</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.hint}>לחיצה ארוכה למחיקת מתכון</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: '#16A34A',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  placeholder: {
    width: 44,
  },
  content: {
    flex: 1,
    padding: 20,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },

  // Recipes List
  recipesList: {
    gap: 14,
  },
  recipeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  recipeIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 14,
  },
  recipeEmoji: {
    fontSize: 26,
  },
  recipeInfo: {
    flex: 1,
    marginRight: 14,
  },
  recipeTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'right',
    marginBottom: 4,
  },
  recipeDate: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'right',
  },
  chevron: {
    fontSize: 20,
    color: '#D1D5DB',
  },

  hint: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 24,
  },
});
