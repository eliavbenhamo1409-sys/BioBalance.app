import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useApp } from '../context/AppContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import SourceCitation from '../components/SourceCitation';
import moment from 'moment';
import 'moment/locale/he';

moment.locale('he');

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Brand colors
const COLORS = {
  primary: '#16A34A',
  primaryLight: '#22C55E',
  primaryBg: '#F0FDF4',
  white: '#FFFFFF',
  gray: '#6B7280',
  grayLight: '#9CA3AF',
  grayBorder: '#E5E7EB',
  text: '#1F2937',
  danger: '#EF4444',
  dangerBg: '#FEE2E2',
};

// Get emoji for food type
const getFoodEmoji = (foodName) => {
  if (!foodName) return '🍽️';
  const name = foodName.toLowerCase();
  if (name.includes('פסטה') || name.includes('ספגטי')) return '🍝';
  if (name.includes('אורז')) return '🍚';
  if (name.includes('עוף') || name.includes('חזה')) return '🍗';
  if (name.includes('בשר') || name.includes('סטייק')) return '🥩';
  if (name.includes('דג') || name.includes('סלמון')) return '🐟';
  if (name.includes('סלט') || name.includes('ירק')) return '🥗';
  if (name.includes('ביצ')) return '🥚';
  if (name.includes('לחם')) return '🍞';
  if (name.includes('פירות') || name.includes('תפוח') || name.includes('בננה')) return '🍎';
  if (name.includes('יוגורט') || name.includes('חלב')) return '🥛';
  if (name.includes('קפה')) return '☕';
  if (name.includes('מיץ')) return '🧃';
  return '🍽️';
};

// Format time from ISO string
const formatTime = (isoString) => {
  if (!isoString) return '';
  return moment(isoString).format('HH:mm');
};

// Calculate today with 3AM reset
const getTodayWithReset = () => {
  const now = moment();
  const threeAM = moment().startOf('day').add(3, 'hours');
  if (now.isBefore(threeAM)) {
    return moment().subtract(1, 'day').format('YYYY-MM-DD');
  }
  return moment().format('YYYY-MM-DD');
};

// Meal Card Component
const MealCard = ({ meal, onDelete, onEdit, isDeleteMode, onLongPress }) => {
  const scale = useSharedValue(1);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const handleLongPress = () => {
    // Subtle haptic tick
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Enter delete mode
    onLongPress();
  };

  return (
    <Animated.View style={[styles.mealCard, cardStyle]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => !isDeleteMode && onEdit(meal)}
        onLongPress={!isDeleteMode ? handleLongPress : undefined}
        delayLongPress={400}
      >
        <View style={styles.mealContent}>
          {/* Left side - Emoji */}
          <View style={styles.mealEmojiContainer}>
            <Text style={styles.mealEmoji}>{getFoodEmoji(meal.name)}</Text>
          </View>

          {/* Right side - Details */}
          <View style={styles.mealDetails}>
            <Text style={styles.mealName} numberOfLines={1}>{meal.name || 'ארוחה'}</Text>
            <View style={styles.mealMeta}>
              <Text style={styles.mealCalories}>{meal.calories || 0} קל׳</Text>
              <Text style={styles.mealDot}>•</Text>
              <Text style={styles.mealMacros}>{meal.protein?.toFixed(0) || 0}g ח׳</Text>
              <Text style={styles.mealDot}>•</Text>
              <Text style={styles.mealMacros}>{meal.fat?.toFixed(0) || 0}g ש׳</Text>
            </View>
          </View>

          {/* Time */}
          <View style={styles.mealTimeContainer}>
            <Text style={styles.mealTime}>{formatTime(meal.created_at)}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Delete Button - Only visible in delete mode */}
      {isDeleteMode && (
        <TouchableOpacity 
          style={styles.deleteBtn}
          onPress={() => onDelete(meal)}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={16} color={COLORS.white} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

// Edit Modal Component with elegant fade
const EditMealModal = ({ visible, meal, onClose, onSave }) => {
  const [editedMeal, setEditedMeal] = useState({});
  const [isVisible, setIsVisible] = useState(false);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.95);

  useEffect(() => {
    if (visible && meal) {
      setIsVisible(true);
      setEditedMeal({
        name: meal.name || '',
        calories: meal.calories?.toString() || '0',
        protein: meal.protein?.toString() || '0',
        fat: meal.fat?.toString() || '0',
      });
      opacity.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) });
      scale.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.back(1.1)) });
    } else if (!visible && isVisible) {
      opacity.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) });
      scale.value = withTiming(0.95, { duration: 200 }, () => {
        runOnJS(setIsVisible)(false);
      });
    }
  }, [visible, meal]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const handleSave = () => {
    const updatedMeal = {
      ...meal,
      name: editedMeal.name,
      calories: parseFloat(editedMeal.calories) || 0,
      protein: parseFloat(editedMeal.protein) || 0,
      fat: parseFloat(editedMeal.fat) || 0,
    };
    onSave(updatedMeal);
  };

  if (!isVisible) return null;

  return (
    <Modal transparent visible={isVisible} animationType="none" statusBarTranslucent>
      <KeyboardAvoidingView 
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.View style={[StyleSheet.absoluteFill, styles.modalBackdrop, backdropStyle]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        </Animated.View>
        
        <Animated.View style={[styles.modalContent, contentStyle]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color={COLORS.gray} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>עריכת ארוחה</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Body */}
          <View style={styles.modalBody}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>שם הארוחה</Text>
              <TextInput
                style={styles.input}
                value={editedMeal.name}
                onChangeText={(text) => setEditedMeal(prev => ({ ...prev, name: text }))}
                placeholder="למשל: חזה עוף עם אורז"
                placeholderTextColor={COLORS.grayLight}
                textAlign="right"
              />
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputGroupSmall}>
                <Text style={styles.inputLabel}>קלוריות</Text>
                <TextInput
                  style={styles.inputSmall}
                  value={editedMeal.calories}
                  onChangeText={(text) => setEditedMeal(prev => ({ ...prev, calories: text }))}
                  keyboardType="numeric"
                  textAlign="center"
                />
              </View>
              <View style={styles.inputGroupSmall}>
                <Text style={styles.inputLabel}>חלבון (g)</Text>
                <TextInput
                  style={styles.inputSmall}
                  value={editedMeal.protein}
                  onChangeText={(text) => setEditedMeal(prev => ({ ...prev, protein: text }))}
                  keyboardType="numeric"
                  textAlign="center"
                />
              </View>
              <View style={styles.inputGroupSmall}>
                <Text style={styles.inputLabel}>שומן (g)</Text>
                <TextInput
                  style={styles.inputSmall}
                  value={editedMeal.fat}
                  onChangeText={(text) => setEditedMeal(prev => ({ ...prev, fat: text }))}
                  keyboardType="numeric"
                  textAlign="center"
                />
              </View>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>ביטול</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
              <Text style={styles.saveBtnText}>שמור</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default function RecentMeals() {
  const navigation = useNavigation();
  const route = useRoute();
  const { meals, removeMeal, editMeal } = useApp();
  const [todayMeals, setTodayMeals] = useState([]);
  const [editingMeal, setEditingMeal] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  // Each navigation push from the chat carries its own openMealId; we track the
  // last id we already auto-opened so re-renders don't reopen the modal.
  const lastOpenedMealIdRef = React.useRef(null);

  useEffect(() => {
    const effectiveToday = getTodayWithReset();
    const filtered = meals.filter(meal => {
      const mealDate = moment(meal.date || meal.created_at).format('YYYY-MM-DD');
      return mealDate === effectiveToday;
    });
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setTodayMeals(filtered);
  }, [meals]);

  // Auto-open the edit modal when arriving from the chat's edit button.
  useEffect(() => {
    const targetId = route.params?.openMealId;
    if (!targetId || lastOpenedMealIdRef.current === targetId) return;
    const target = meals.find((m) => m.id === targetId);
    if (target) {
      lastOpenedMealIdRef.current = targetId;
      setEditingMeal(target);
      setShowEditModal(true);
    }
  }, [route.params?.openMealId, meals]);

  // Exit delete mode when no meals left
  useEffect(() => {
    if (todayMeals.length === 0 && isDeleteMode) {
      setIsDeleteMode(false);
    }
  }, [todayMeals.length]);

  const enterDeleteMode = () => {
    setIsDeleteMode(true);
  };

  const handleDelete = async (meal) => {
    await removeMeal(meal.id);
  };

  const handleEdit = (meal) => {
    setEditingMeal(meal);
    setShowEditModal(true);
  };

  const handleSaveEdit = async (updatedMeal) => {
    await editMeal(editingMeal.id, {
      name: updatedMeal.name,
      calories: updatedMeal.calories,
      protein: updatedMeal.protein,
      fat: updatedMeal.fat,
    });
    
    setShowEditModal(false);
    setEditingMeal(null);
  };

  const exitDeleteMode = () => {
    setIsDeleteMode(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backBtn} 
          onPress={() => {
            if (isDeleteMode) {
              exitDeleteMode();
            } else {
              navigation.goBack();
            }
          }}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={isDeleteMode ? "checkmark" : "chevron-forward"} 
            size={26} 
            color={isDeleteMode ? COLORS.primary : COLORS.primary} 
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isDeleteMode ? 'מצב מחיקה' : 'ארוחות היום'}
        </Text>
        <View style={styles.headerRight}>
          <Text style={styles.mealsCount}>{todayMeals.length}</Text>
        </View>
      </View>


      {/* Meals List */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SourceCitation variant="compact" />
        {todayMeals.length > 0 ? (
          <>
            {todayMeals.map((meal) => (
              <MealCard
                key={meal.id}
                meal={meal}
                onDelete={handleDelete}
                onEdit={handleEdit}
                isDeleteMode={isDeleteMode}
                onLongPress={enterDeleteMode}
              />
            ))}
            {!isDeleteMode && (
              <Text style={styles.hintText}>
                לחיצה לעריכה • לחיצה ארוכה למחיקה
              </Text>
            )}
          </>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="restaurant-outline" size={48} color={COLORS.primaryLight} />
            </View>
            <Text style={styles.emptyTitle}>אין ארוחות היום</Text>
            <Text style={styles.emptySubtitle}>
              ספר לבוט מה אכלת והארוחות יופיעו כאן
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Ionicons name="refresh-outline" size={14} color={COLORS.grayLight} />
        <Text style={styles.footerText}>מתאפס בשעה 03:00</Text>
      </View>

      {/* Edit Modal */}
      <EditMealModal
        visible={showEditModal}
        meal={editingMeal}
        onClose={() => {
          setShowEditModal(false);
          setEditingMeal(null);
        }}
        onSave={handleSaveEdit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayBorder,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerRight: {
    width: 40,
    alignItems: 'center',
  },
  mealsCount: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    backgroundColor: COLORS.primaryBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  mealCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
  },
  mealContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  mealEmojiContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  mealEmoji: {
    fontSize: 22,
  },
  mealDetails: {
    flex: 1,
    alignItems: 'flex-end',
  },
  mealName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
    textAlign: 'right',
  },
  mealMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealCalories: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  mealDot: {
    fontSize: 10,
    color: COLORS.grayLight,
    marginHorizontal: 6,
  },
  mealMacros: {
    fontSize: 12,
    color: COLORS.gray,
  },
  mealTimeContainer: {
    paddingLeft: 12,
  },
  mealTime: {
    fontSize: 12,
    color: COLORS.grayLight,
  },
  deleteBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  hintText: {
    fontSize: 12,
    color: COLORS.grayLight,
    textAlign: 'center',
    marginTop: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.grayLight,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.grayBorder,
    gap: 6,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.grayLight,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContent: {
    width: SCREEN_WIDTH - 48,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayBorder,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputGroupSmall: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.gray,
    marginBottom: 8,
    textAlign: 'right',
  },
  input: {
    backgroundColor: COLORS.primaryBg,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputSmall: {
    backgroundColor: COLORS.primaryBg,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 0,
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primaryBg,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.gray,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.white,
  },
});
