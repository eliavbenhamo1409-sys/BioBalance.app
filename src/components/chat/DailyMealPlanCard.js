// ============================================================
// DailyMealPlanCard — תפריט יום (מה לאכול עכשיו)
// ============================================================
// כותרות קומפקטיות עם שעה; פתיחה לפרטים; מתכון; תזכורת חד-פעמית.

import React, { useState, useEffect, memo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import SourceCitation from '../SourceCitation';
import { buildMealRecipeDraft } from '../../utils/mealPlanRecipe';

const COLORS = {
  brand: '#16A34A',
  brandDark: '#166534',
  brandMid: '#22C55E',
  brandSoft: '#DCFCE7',
  brandSofter: '#F0FDF4',
  text: '#1F2937',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  background: '#FFFFFF',
  surface: '#F9FAFB',
  divider: '#F3F4F6',
  border: '#E5E7EB',
  protein: '#7C5CE0',
  fat: '#F59E0B',
};

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

const formatAmount = (raw) => {
  if (!raw) return 'לפי הטעם';
  const txt = String(raw).trim();
  const gMatch = /^(\d+(?:\.\d+)?)\s*g$/i.exec(txt);
  if (gMatch) return `${gMatch[1]} גרם`;
  const mlMatch = /^(\d+(?:\.\d+)?)\s*ml$/i.exec(txt);
  if (mlMatch) return `${mlMatch[1]} מ"ל`;
  return txt;
};

const FoodItemRow = memo(({ item, isLast }) => (
  <View style={[styles.itemRow, isLast && styles.itemRowLast]}>
    <View style={styles.itemTextWrap}>
      <Text style={styles.itemName} numberOfLines={2}>{item.food}</Text>
    </View>
    <View style={styles.itemAmountChip}>
      <Text style={styles.itemAmountText}>{formatAmount(item.amount)}</Text>
    </View>
    <Text style={styles.itemCal}>{item.calories || 0}</Text>
  </View>
));

/** זמן ארוחה מהמחרוזת (למשל 13:30) → Date קרוב בעתיד */
function defaultReminderDate(mealTimeStr) {
  const d = new Date();
  const m = String(mealTimeStr || '').match(/(\d{1,2})\s*[:：]\s*(\d{2})/);
  if (m) {
    d.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
  } else {
    d.setHours(d.getHours() + 1, 0, 0, 0);
  }
  if (d.getTime() <= Date.now()) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

async function scheduleOneShotReminder({ fireDate, mealName }) {
  const { status } = await Notifications.getPermissionsAsync();
  let s = status;
  if (s !== 'granted') {
    const r = await Notifications.requestPermissionsAsync();
    s = r.status;
  }
  if (s !== 'granted') {
    Alert.alert('הרשאות', 'יש לאשר התראות בהגדרות המכשיר כדי לקבל תזכורת.');
    return false;
  }

  const ms = fireDate.getTime() - Date.now();
  if (ms < 60000) {
    Alert.alert('זמן לא מתאים', 'בחר זמן לפחות דקה מהעכשיו.');
    return false;
  }

  const seconds = Math.floor(ms / 1000);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `תזכורת ארוחה · ${mealName}`,
      body: 'זו התראה חד-פעמית — זמן לאכול לפי התוכנית שלך.',
      sound: true,
    },
    trigger: {
      type: 'timeInterval',
      seconds,
      repeats: false,
    },
  });

  Alert.alert(
    'נקבעה תזכורת חד-פעמית',
    'לא תחזור שוב מחר אוטומטית. רק האירוע הזה.',
  );
  return true;
}

const MealBlock = memo(
  ({
    meal,
    index,
    onRequestChange,
    isChanging,
    isLast,
    expanded,
    onToggleExpand,
    onOpenRecipe,
    onOpenReminder,
  }) => {
    const items =
      meal.items ||
      (meal.foods
        ? meal.foods.map((f) => ({
            food: f,
            amount: '',
            calories: 0,
            protein: 0,
            fat: 0,
          }))
        : []);
    const totalCalories = meal.totalCalories || meal.calories || 0;
    const timeLabel = meal.time ? String(meal.time).trim() : '—';

    return (
      <View style={[styles.mealBlock, isLast && styles.mealBlockLast]}>
        <View style={styles.mealHeader}>
          <TouchableOpacity
            style={styles.expandTap}
            onPress={() => onToggleExpand(index)}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'סגור פרטים' : 'פתח פרטים'}
          >
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={COLORS.brandDark}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mealHeaderMain}
            onPress={() => onToggleExpand(index)}
            activeOpacity={0.7}
          >
            <Text style={styles.mealHeadline} numberOfLines={2}>
              {`${timeLabel} · ${meal.name || 'ארוחה'}`}
            </Text>
            <Text style={styles.mealHeadlineCal}>{totalCalories} קל׳</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.swapBtn}
            onPress={() => onRequestChange(meal, index)}
            disabled={isChanging}
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isChanging ? (
              <ActivityIndicator size="small" color={COLORS.brand} />
            ) : (
              <Ionicons name="swap-horizontal" size={14} color={COLORS.brand} />
            )}
          </TouchableOpacity>

          <View style={styles.mealIconCircle}>
            <Text style={styles.mealIconEmoji}>{getMealIcon(meal.type)}</Text>
          </View>
        </View>

        {expanded ? (
          <View style={styles.expandedBody}>
            <View style={styles.itemsList}>
              {items.map((item, i) => (
                <FoodItemRow key={i} item={item} isLast={i === items.length - 1} />
              ))}
            </View>

            <View style={styles.mealActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => onOpenRecipe(meal)}
                activeOpacity={0.7}
              >
                <Ionicons name="book-outline" size={16} color={COLORS.brandDark} />
                <Text style={styles.actionBtnText}>מתכון</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => onOpenReminder(meal)}
                activeOpacity={0.7}
              >
                <Ionicons name="notifications-outline" size={16} color={COLORS.brandDark} />
                <Text style={styles.actionBtnText}>תזכורת חד-פעמית</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>
    );
  },
);

const AlternativesPopup = memo(({ alternatives, mealIndex, onSelectAlternative, onClose }) => (
  <Animated.View
    entering={FadeIn.duration(160)}
    exiting={FadeOut.duration(120)}
    style={styles.popup}
  >
    <View style={styles.popupHeader}>
      <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="close" size={18} color={COLORS.textSecondary} />
      </TouchableOpacity>
      <Text style={styles.popupTitle}>בחר חלופה</Text>
    </View>

    {alternatives.map((alt, i) => {
      const cal = alt.totalCalories || alt.calories || 0;
      const prot = Math.round(alt.totalProtein || alt.protein || 0);
      return (
        <TouchableOpacity
          key={i}
          style={[styles.altRow, i === alternatives.length - 1 && styles.altRowLast]}
          onPress={() => onSelectAlternative(alt, mealIndex)}
          activeOpacity={0.6}
        >
          <View style={styles.altCalPill}>
            <Text style={styles.altCalPillText}>{cal}</Text>
            <Text style={styles.altCalPillUnit}>קל׳</Text>
          </View>
          <View style={styles.altRowText}>
            <Text style={styles.altName} numberOfLines={2}>{alt.name}</Text>
            <Text style={styles.altMeta}>{prot}g חלבון</Text>
          </View>
        </TouchableOpacity>
      );
    })}
  </Animated.View>
));

function RecipeModal({ visible, meal, onClose }) {
  const draft = meal ? buildMealRecipeDraft(meal) : null;
  const steps = draft?.steps || [];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity
          style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' }}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.modalSheet}>
          <View style={styles.modalGrabber} />
          <Text style={styles.modalTitle}>{draft?.title || ''}</Text>
          {draft?.estimatedMinutes ? (
            <Text style={styles.modalSubtitle}>משוער זמן הכנה: {draft.estimatedMinutes} דק׳</Text>
          ) : null}
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalSectionTitle}>רכיבים</Text>
            {(draft?.ingredients || []).map((line, i) => (
              <Text key={i} style={styles.modalBullet}>
                • {line}
              </Text>
            ))}
            {(draft?.optionalSeasonings || []).length > 0 ? (
              <>
                <Text style={[styles.modalSectionTitle, { marginTop: 14 }]}>
                  {draft.spiceSectionTitle || 'תבלינים (אופציונלי)'}
                </Text>
                {draft.spiceIntro ? (
                  <Text style={styles.modalSpiceIntro}>{draft.spiceIntro}</Text>
                ) : null}
                {(draft.optionalSeasonings || []).map((line, i) => (
                  <Text key={`sp-${i}`} style={styles.modalBullet}>
                    ○ {line}
                  </Text>
                ))}
              </>
            ) : null}
            <Text style={[styles.modalSectionTitle, { marginTop: 14 }]}>הכנה</Text>
            {steps.map((step, i) => {
              const label = typeof step === 'object' && step?.label ? step.label : `שלב ${i + 1}`;
              const text =
                typeof step === 'object' && step?.text != null
                  ? step.text
                  : typeof step === 'string'
                    ? step
                    : '';
              return (
                <Text key={i} style={styles.modalStep}>
                  <Text style={styles.modalStepLabel}>{label}: </Text>
                  {text}
                </Text>
              );
            })}
          </ScrollView>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
            <Text style={styles.modalCloseBtnText}>סגור</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function ReminderModal({ visible, meal, onClose }) {
  const [fireDate, setFireDate] = useState(() =>
    meal ? defaultReminderDate(meal.time) : new Date(Date.now() + 3600000),
  );
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');

  useEffect(() => {
    if (visible && meal) {
      setFireDate(defaultReminderDate(meal.time));
      setShowPicker(Platform.OS === 'ios');
    }
  }, [visible, meal]);

  const confirm = async () => {
    const ok = await scheduleOneShotReminder({
      fireDate,
      mealName: meal?.name || 'ארוחה',
    });
    if (ok) onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <TouchableOpacity
          style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' }}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.reminderSheet}>
          <Text style={styles.reminderTitle}>תזכורת חד-פעמית בלבד</Text>
          <Text style={styles.reminderHint}>
            לא תוחזר מחר אוטומטית ולא תיווצר התראה חוזרת — רק פעם אחת בזמן שבחרת.
          </Text>

          {meal ? (
            <Text style={styles.reminderMealName}>{meal.name}</Text>
          ) : null}

          {Platform.OS === 'android' && !showPicker ? (
            <TouchableOpacity
              style={styles.pickTimeBtn}
              onPress={() => setShowPicker(true)}
            >
              <Text style={styles.pickTimeBtnText}>
                בחר זמן · {fireDate.toLocaleString('he-IL')}
              </Text>
            </TouchableOpacity>
          ) : null}

          {(Platform.OS === 'ios' || showPicker) && (
            <DateTimePicker
              value={fireDate}
              mode="datetime"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(e, date) => {
                if (Platform.OS === 'android') setShowPicker(false);
                if (date) setFireDate(date);
              }}
              minimumDate={new Date(Date.now() + 60000)}
              locale="he-IL"
            />
          )}

          <View style={styles.reminderActions}>
            <TouchableOpacity style={styles.reminderCancel} onPress={onClose}>
              <Text style={styles.reminderCancelText}>ביטול</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.reminderOk} onPress={confirm}>
              <Text style={styles.reminderOkText}>צור התראה</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

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

  const [openIdx, setOpenIdx] = useState(null);
  const [recipeMeal, setRecipeMeal] = useState(null);
  const [reminderMeal, setReminderMeal] = useState(null);

  const toggleExpand = useCallback((idx) => {
    setOpenIdx((prev) => (prev === idx ? null : idx));
  }, []);

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

  if (isLoading) return null;
  if (!data || !data.meals || data.meals.length === 0) return null;

  const totals = data.meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + (meal.totalCalories || meal.calories || 0),
      protein: acc.protein + (meal.totalProtein || meal.protein || 0),
      fat: acc.fat + (meal.totalFat || meal.fat || 0),
    }),
    { calories: 0, protein: 0, fat: 0 },
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerCalPill}>
          <Text style={styles.headerCalValue}>{totals.calories}</Text>
          <Text style={styles.headerCalUnit}>קל׳</Text>
        </View>

        <Text style={styles.headerTitle}>תפריט להמשך היום</Text>
      </View>

      <View style={styles.sectionDivider} />

      <View style={styles.mealsList}>
        {data.meals.map((meal, index) => (
          <MealBlock
            key={`meal-slot-${index}`}
            meal={meal}
            index={index}
            onRequestChange={handleRequestChange}
            isChanging={changingMealIndex === index}
            isLast={index === data.meals.length - 1}
            expanded={openIdx === index}
            onToggleExpand={toggleExpand}
            onOpenRecipe={setRecipeMeal}
            onOpenReminder={setReminderMeal}
          />
        ))}
      </View>

      <View style={styles.sectionDivider} />

      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: COLORS.brandDark }]}>
            {totals.calories}
          </Text>
          <Text style={styles.summaryLabel}>קל׳</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: COLORS.protein }]}>
            {Math.round(totals.protein)}g
          </Text>
          <Text style={styles.summaryLabel}>חלבון</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: COLORS.fat }]}>
            {Math.round(totals.fat)}g
          </Text>
          <Text style={styles.summaryLabel}>שומן</Text>
        </View>
      </View>

      {data?.capMessage ? (
        <Text style={styles.capMessage}>{data.capMessage}</Text>
      ) : null}

      <SourceCitation variant="compact" />

      {showAlternatives && currentAlternatives.length > 0 && (
        <AlternativesPopup
          alternatives={currentAlternatives}
          mealIndex={selectedMealIndex}
          onSelectAlternative={handleSelectAlternative}
          onClose={handleCloseAlternatives}
        />
      )}

      <RecipeModal visible={!!recipeMeal} meal={recipeMeal} onClose={() => setRecipeMeal(null)} />

      <ReminderModal
        visible={!!reminderMeal}
        meal={reminderMeal}
        onClose={() => setReminderMeal(null)}
      />
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
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.divider,
    overflow: 'hidden',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  headerCalPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: COLORS.brandSofter,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  headerCalValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.brandDark,
    fontVariant: ['tabular-nums'],
  },
  headerCalUnit: {
    fontSize: 10,
    color: COLORS.brand,
    fontWeight: '600',
    marginLeft: 3,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'right',
    flex: 1,
    marginLeft: 10,
  },
  mealsList: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  mealBlock: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  mealBlockLast: {
    borderBottomWidth: 0,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  expandTap: {
    paddingLeft: 4,
    paddingRight: 6,
    justifyContent: 'center',
  },
  mealHeaderMain: {
    flex: 1,
    alignItems: 'flex-end',
    marginRight: 6,
    paddingVertical: 4,
  },
  mealHeadline: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'right',
    lineHeight: 18,
  },
  mealHeadlineCal: {
    fontSize: 11,
    color: COLORS.brandDark,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'right',
  },
  expandedBody: {
    paddingTop: 4,
    paddingBottom: 6,
  },
  mealActions: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
    paddingTop: 10,
    paddingHorizontal: 4,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 6,
    backgroundColor: COLORS.brandSofter,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.brandSoft,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.brandDark,
  },
  swapBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.brandSofter,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  mealIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.brandSofter,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  mealIconEmoji: {
    fontSize: 15,
  },
  itemsList: {
    paddingRight: 4,
    paddingLeft: 2,
    marginTop: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  itemRowLast: {
    borderBottomWidth: 0,
  },
  itemTextWrap: {
    flex: 1,
    alignItems: 'flex-end',
    marginLeft: 6,
  },
  itemName: {
    fontSize: 12.5,
    color: COLORS.text,
    textAlign: 'right',
    fontWeight: '500',
  },
  itemAmountChip: {
    backgroundColor: COLORS.brandSofter,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 6,
  },
  itemAmountText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.brandDark,
  },
  itemCal: {
    fontSize: 10.5,
    color: COLORS.textMuted,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    minWidth: 28,
    textAlign: 'left',
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: COLORS.brandSofter,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  summaryLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  summaryDivider: {
    width: 1,
    height: 20,
    backgroundColor: COLORS.brandSoft,
  },
  capMessage: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    fontStyle: 'italic',
    lineHeight: 16,
    backgroundColor: COLORS.surface,
  },
  popup: {
    position: 'absolute',
    top: 56,
    left: 12,
    right: 12,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 12,
    zIndex: 100,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  popupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  popupTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.brandDark,
  },
  altRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  altRowLast: {
    borderBottomWidth: 0,
  },
  altCalPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: COLORS.brandSofter,
    borderWidth: 1,
    borderColor: COLORS.brandSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    minWidth: 56,
    justifyContent: 'center',
  },
  altCalPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.brandDark,
    fontVariant: ['tabular-nums'],
  },
  altCalPillUnit: {
    fontSize: 10,
    color: COLORS.brand,
    fontWeight: '600',
    marginLeft: 2,
  },
  altRowText: {
    flex: 1,
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  altName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'right',
  },
  altMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    textAlign: 'right',
  },
  modalSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 18,
    paddingBottom: 28,
    maxHeight: '82%',
  },
  modalGrabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginVertical: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.brandDark,
    textAlign: 'right',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'right',
    marginBottom: 12,
  },
  modalSpiceIntro: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'right',
    lineHeight: 18,
    marginBottom: 8,
  },
  modalScroll: {
    maxHeight: 420,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'right',
    marginBottom: 8,
  },
  modalBullet: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'right',
    lineHeight: 20,
    marginBottom: 4,
  },
  modalStep: {
    fontSize: 13,
    color: COLORS.text,
    textAlign: 'right',
    lineHeight: 21,
    marginBottom: 8,
  },
  modalStepLabel: {
    fontWeight: '700',
    color: COLORS.brandDark,
  },
  modalCloseBtn: {
    marginTop: 16,
    backgroundColor: COLORS.brand,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  reminderSheet: {
    backgroundColor: COLORS.background,
    marginHorizontal: 18,
    borderRadius: 16,
    padding: 18,
    alignSelf: 'center',
    width: '90%',
    maxWidth: 400,
    zIndex: 2,
  },
  reminderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.brandDark,
    textAlign: 'right',
  },
  reminderHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'right',
    marginTop: 8,
    lineHeight: 18,
  },
  reminderMealName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'right',
    marginTop: 12,
  },
  pickTimeBtn: {
    marginTop: 12,
    padding: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
  },
  pickTimeBtnText: {
    fontSize: 13,
    textAlign: 'center',
    color: COLORS.brandDark,
  },
  reminderActions: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: 18,
    gap: 10,
  },
  reminderCancel: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reminderCancelText: {
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  reminderOk: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.brand,
  },
  reminderOkText: {
    fontWeight: '700',
    color: '#fff',
  },
});
