import React, { useState, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  brand: '#16A34A',
  brandLight: '#F0FDF4',
  brandBorder: '#BBF7D0',
  text: '#1F2937',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  background: '#FFFFFF',
  surface: '#F9FAFB',
  border: '#E5E7EB',
  calories: '#FF6B35',
  protein: '#7C5CE0',
  fat: '#FFB800',
};

// Meal Type Icons
const getMealIcon = (mealType) => {
  const icons = {
    breakfast: '🍳',
    morning_snack: '🍎',
    lunch: '🍱',
    afternoon_snack: '🥜',
    dinner: '🍽️',
    evening_snack: '🥛',
    snack: '🍌',
    default: '🍴',
  };
  return icons[mealType] || icons.default;
};

// Single Food Item Row
const FoodItemRow = memo(({ item }) => (
  <View style={styles.foodItemRow}>
    <View style={styles.foodItemLeft}>
      <Text style={styles.foodItemName}>{item.food}</Text>
      <Text style={styles.foodItemAmount}>{item.amount}</Text>
    </View>
    <View style={styles.foodItemRight}>
      <Text style={styles.foodItemCal}>{item.calories}</Text>
      <Text style={styles.foodItemMacros}>{item.protein}p | {item.fat}f</Text>
    </View>
  </View>
));

// Meal Card Component with full details
const MealCard = memo(({ meal, index, onRequestChange, isChanging }) => {
  // Support both old format (foods array) and new format (items array)
  const items = meal.items || (meal.foods ? meal.foods.map(f => ({ food: f, amount: '', calories: 0, protein: 0, fat: 0 })) : []);
  const totalCalories = meal.totalCalories || meal.calories || 0;
  const totalProtein = meal.totalProtein || meal.protein || 0;
  const totalFat = meal.totalFat || meal.fat || 0;
  
  return (
    <View style={styles.mealCard}>
      {/* Header Row */}
      <View style={styles.mealHeader}>
        <TouchableOpacity
          style={styles.changeBtn}
          onPress={() => onRequestChange(meal, index)}
          disabled={isChanging}
          activeOpacity={0.7}
        >
          {isChanging ? (
            <ActivityIndicator size="small" color={COLORS.brand} />
          ) : (
            <Ionicons name="swap-horizontal" size={16} color={COLORS.brand} />
          )}
        </TouchableOpacity>
        
        <View style={styles.mealTitleRow}>
          <Text style={styles.mealIcon}>{getMealIcon(meal.type)}</Text>
          <Text style={styles.mealName}>{meal.name}</Text>
        </View>
        
        <View style={styles.timeBadge}>
          <Text style={styles.timeText}>{meal.time}</Text>
        </View>
      </View>
      
      {/* Food Items List */}
      <View style={styles.foodItemsList}>
        {items.map((item, i) => (
          <FoodItemRow key={i} item={item} />
        ))}
      </View>
      
      {/* Meal Totals */}
      <View style={styles.mealTotals}>
        <View style={styles.totalItem}>
          <Text style={[styles.totalValue, { color: COLORS.calories }]}>{totalCalories}</Text>
          <Text style={styles.totalLabel}>קל'</Text>
        </View>
        <View style={styles.totalDivider} />
        <View style={styles.totalItem}>
          <Text style={[styles.totalValue, { color: COLORS.protein }]}>{totalProtein}g</Text>
          <Text style={styles.totalLabel}>חלבון</Text>
        </View>
        <View style={styles.totalDivider} />
        <View style={styles.totalItem}>
          <Text style={[styles.totalValue, { color: COLORS.fat }]}>{totalFat}g</Text>
          <Text style={styles.totalLabel}>שומן</Text>
        </View>
      </View>
    </View>
  );
});

// Alternatives Popup - Simple floating card, no backdrop
const AlternativesPopup = memo(({ alternatives, mealIndex, onSelectAlternative, onClose }) => {
  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(100)}
      style={styles.alternativesPopup}
    >
      {/* Close button */}
      <TouchableOpacity onPress={onClose} style={styles.popupCloseBtn}>
        <Ionicons name="close-circle" size={24} color={COLORS.textMuted} />
      </TouchableOpacity>
      
      {/* Alternatives list */}
      {alternatives.map((alt, i) => (
        <TouchableOpacity
          key={i}
          style={styles.altOption}
          onPress={() => onSelectAlternative(alt, mealIndex)}
          activeOpacity={0.7}
        >
          <View style={styles.altOptionContent}>
            <Text style={styles.altOptionName}>{alt.name}</Text>
            <Text style={styles.altOptionNutrition}>
              {alt.totalCalories || alt.calories} קל' | {alt.totalProtein || alt.protein}g ח'
            </Text>
          </View>
          <View style={styles.altOptionArrow}>
            <Ionicons name="arrow-back" size={16} color={COLORS.brand} />
          </View>
        </TouchableOpacity>
      ))}
    </Animated.View>
  );
});

// Main Component
function DailyMealPlanCard({ 
  data, 
  onRequestMealChange,
  onSelectAlternative,
  isLoading = false,
}) {
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [changingMealIndex, setChangingMealIndex] = useState(null);
  const [currentAlternatives, setCurrentAlternatives] = useState([]);
  const [selectedMealIndex, setSelectedMealIndex] = useState(null);

  const handleRequestChange = async (meal, index) => {
    setChangingMealIndex(index);
    
    try {
      const alternatives = await onRequestMealChange(meal, index);
      if (alternatives && alternatives.length > 0) {
        setCurrentAlternatives(alternatives);
        setSelectedMealIndex(index);
        setShowAlternatives(true);
      }
    } catch (error) {
      console.error('Error getting alternatives:', error);
    } finally {
      setChangingMealIndex(null);
    }
  };

  const handleSelectAlternative = (alternative, mealIndex) => {
    onSelectAlternative(alternative, mealIndex);
    setShowAlternatives(false);
    setCurrentAlternatives([]);
    setSelectedMealIndex(null);
  };

  const handleCloseAlternatives = () => {
    setShowAlternatives(false);
    setCurrentAlternatives([]);
    setSelectedMealIndex(null);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.brand} />
        <Text style={styles.loadingText}>🤖 בונה תפריט מותאם אישית...</Text>
      </View>
    );
  }

  if (!data || !data.meals || data.meals.length === 0) {
    return null;
  }

  // Calculate grand totals
  const totals = data.meals.reduce((acc, meal) => ({
    calories: acc.calories + (meal.totalCalories || meal.calories || 0),
    protein: acc.protein + (meal.totalProtein || meal.protein || 0),
    fat: acc.fat + (meal.totalFat || meal.fat || 0),
  }), { calories: 0, protein: 0, fat: 0 });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.totalsBadge}>
          <Text style={styles.totalsText}>{totals.calories} קל'</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.headerTitle}>📅 תפריט מותאם אישית</Text>
          <Text style={styles.headerSubtitle}>{data.meals.length} ארוחות • ערכים מדויקים</Text>
        </View>
      </View>

      {/* Meals List */}
      <View style={styles.mealsList}>
        {data.meals.map((meal, index) => (
          <MealCard
            key={`${meal.type}-${index}`}
            meal={meal}
            index={index}
            onRequestChange={handleRequestChange}
            isChanging={changingMealIndex === index}
          />
        ))}
      </View>

      {/* Grand Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: COLORS.calories }]}>{totals.calories}</Text>
            <Text style={styles.summaryLabel}>סה"כ קל'</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: COLORS.protein }]}>{Math.round(totals.protein)}g</Text>
            <Text style={styles.summaryLabel}>חלבון</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: COLORS.fat }]}>{Math.round(totals.fat)}g</Text>
            <Text style={styles.summaryLabel}>שומן</Text>
          </View>
        </View>
        <Text style={styles.hintText}>💡 לחץ ↔️ להחלפת ארוחה</Text>
      </View>

      {/* Alternatives Popup - floating above the card */}
      {showAlternatives && currentAlternatives.length > 0 && (
        <AlternativesPopup
          alternatives={currentAlternatives}
          mealIndex={selectedMealIndex}
          onSelectAlternative={handleSelectAlternative}
          onClose={handleCloseAlternatives}
        />
      )}
    </View>
  );
}

export default memo(DailyMealPlanCard);

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    marginVertical: 6,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },

  // Loading
  loadingContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    marginVertical: 6,
    marginHorizontal: 4,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.brandLight,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.brandBorder,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  totalsBadge: {
    backgroundColor: COLORS.brand,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  totalsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Meals List
  mealsList: {
    padding: 10,
    gap: 10,
  },

  // Meal Card
  mealCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  changeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.brandLight,
    borderWidth: 1,
    borderColor: COLORS.brandBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  mealTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'flex-end',
  },
  mealIcon: {
    fontSize: 18,
  },
  mealName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  timeBadge: {
    backgroundColor: COLORS.brand,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Food Items List
  foodItemsList: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  foodItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  foodItemLeft: {
    flex: 1,
    alignItems: 'flex-end',
  },
  foodItemName: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
  },
  foodItemAmount: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  foodItemRight: {
    alignItems: 'flex-start',
    minWidth: 60,
    marginRight: 8,
  },
  foodItemCal: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.calories,
  },
  foodItemMacros: {
    fontSize: 10,
    color: COLORS.textMuted,
  },

  // Meal Totals
  mealTotals: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 8,
    backgroundColor: COLORS.brandLight,
  },
  totalItem: {
    alignItems: 'center',
    flex: 1,
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  totalLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
  },
  totalDivider: {
    width: 1,
    height: 20,
    backgroundColor: COLORS.brandBorder,
  },

  // Summary
  summary: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  hintText: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 10,
  },

  // Alternatives Popup - floating card, no backdrop
  alternativesPopup: {
    position: 'absolute',
    top: 60,
    left: 10,
    right: 10,
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
  },
  popupCloseBtn: {
    position: 'absolute',
    top: -10,
    left: -10,
    zIndex: 101,
  },
  altOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.brandLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.brandBorder,
  },
  altOptionContent: {
    flex: 1,
    alignItems: 'flex-end',
  },
  altOptionName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  altOptionNutrition: {
    fontSize: 12,
    color: COLORS.brand,
    fontWeight: '500',
    marginTop: 2,
  },
  altOptionArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
});
