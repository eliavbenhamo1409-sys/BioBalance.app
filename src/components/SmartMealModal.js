import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Smart Meal Card - Minimalist floating card matching app style
 */
export default function SmartMealModal({
  visible,
  onClose,
  recurringMeals,
  isEmpty,
  isLoading,
  onSelectMeal,
  isFirstTime = false,
  keyboardHeight = 0,
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      progress.value = withSpring(1, {
        damping: 20,
        stiffness: 90,
        mass: 0.8,
      });
    } else {
      progress.value = withTiming(0, { duration: 200 });
    }
  }, [visible]);

  const cardStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], [0.85, 1], Extrapolate.CLAMP);
    const translateY = interpolate(progress.value, [0, 1], [20, 0], Extrapolate.CLAMP);

    return {
      transform: [{ scale }, { translateY }],
      opacity: progress.value,
    };
  });

  const handleSelectMeal = (meal) => {
    onSelectMeal(meal);
    onClose();
  };

  const getFoodEmoji = (foodName) => {
    const name = foodName.toLowerCase();
    if (name.includes('פסטה') || name.includes('ספגטי')) return '🍝';
    if (name.includes('אורז')) return '🍚';
    if (name.includes('עוף') || name.includes('חזה')) return '🍗';
    if (name.includes('בשר') || name.includes('סטייק')) return '🥩';
    if (name.includes('דג') || name.includes('סלמון')) return '🐟';
    if (name.includes('סלט') || name.includes('ירק')) return '🥗';
    if (name.includes('ביצ')) return '🥚';
    if (name.includes('לחם')) return '🍞';
    if (name.includes('בננה')) return '🍌';
    if (name.includes('תפוח')) return '🍎';
    if (name.includes('יוגורט')) return '🥛';
    if (name.includes('גבינה')) return '🧀';
    return '🍽️';
  };

  if (!visible) return null;

  return (
    <View style={styles.overlayContainer}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.overlay, { paddingBottom: keyboardHeight > 0 ? keyboardHeight - 10 : 90 }]}>
        <Animated.View style={[styles.card, cardStyle]}>
          {/* Minimal Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <Text style={styles.headerIconText}>+</Text>
              </View>
              <Text style={styles.title}>הוספה מהירה</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#16A34A" />
              <Text style={styles.loadingText}>טוען...</Text>
            </View>
          ) : isFirstTime || isEmpty ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Text style={styles.emptyIcon}>🎯</Text>
              </View>
              <Text style={styles.emptyTitle}>ארוחות חכמות</Text>
              <Text style={styles.emptyText}>
                אני לומד את ההרגלים שלך!{'\n'}
                הארוחות החוזרות שלך יופיעו כאן{'\n'}
                להוספה מהירה בלחיצה
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.mealsScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.mealsContent}
            >
              {recurringMeals.slice(0, 6).map((meal, index) => (
                <TouchableOpacity
                  key={`${meal.name}_${index}`}
                  style={styles.mealRow}
                  onPress={() => handleSelectMeal(meal)}
                  activeOpacity={0.7}
                >
                  <View style={styles.mealIconContainer}>
                    <Text style={styles.mealEmoji}>{getFoodEmoji(meal.name)}</Text>
                  </View>
                  <View style={styles.mealInfo}>
                    <Text style={styles.mealName} numberOfLines={1}>
                      {meal.name}
                    </Text>
                    <Text style={styles.mealCalories}>
                      {meal.avgCalories} קק"ל
                    </Text>
                  </View>
                  <View style={styles.addBtn}>
                    <Text style={styles.addBtnText}>+</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    pointerEvents: 'box-none',
  },
  overlay: {
    paddingBottom: 100,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: SCREEN_WIDTH - 32,
    maxHeight: SCREEN_HEIGHT * 0.45,
    // Clean shadow
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#16A34A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    padding: 28,
    alignItems: 'center',
  },
  emptyIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  emptyIcon: {
    fontSize: 28,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  mealsScroll: {
    maxHeight: 260,
  },
  mealsContent: {
    padding: 12,
    gap: 8,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  mealIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  mealEmoji: {
    fontSize: 18,
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  mealCalories: {
    fontSize: 12,
    color: '#6B7280',
  },
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#16A34A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
