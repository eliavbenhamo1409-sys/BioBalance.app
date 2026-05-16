import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Keyboard,
  I18nManager,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import { deleteAccount } from '../api/supabaseClient';
import { calculateNutritionTargets } from '../api/aiClient';
import SourceCitation from '../components/SourceCitation';
import usePro from '../hooks/usePro';

const normalizeActivityLevel = (level) => (level === 'high' ? 'intense' : level);

const profileFromServer = (p) => {
  if (!p) return {};
  const notes = (p.activity_level_notes || '').trim();
  const rawAct = normalizeActivityLevel(p.activity_level);
  return {
    ...p,
    activity_level: notes ? null : rawAct,
    activity_level_notes: p.activity_level_notes ?? '',
    goal: p.goal || 'maintain',
    pace: p.pace || 'balanced',
  };
};

const goalLabels = {
  cut: 'חיטוב / ירידה באחוזי שומן',
  maintain: 'שמירה על המשקל',
  lean_bulk: 'עלייה מתונה במסה',
  bulk: 'עלייה מהירה במסה',
};

const paceLabels = {
  slow: 'קצב רגוע',
  balanced: 'איזון',
  fast: 'שינוי מהיר',
};

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 90,
  mass: 0.8,
};

// Animated Card Component
const AnimatedCard = ({ children, delay = 0, style }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withSpring(1, SPRING_CONFIG));
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolate.CLAMP),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [20, 0], Extrapolate.CLAMP) },
    ],
  }));

  return (
    <Animated.View style={[cardStyle, style]}>
      {children}
    </Animated.View>
  );
};

export default function Profile() {
  const navigation = useNavigation();
  const { profile, setProfile, user, logout } = useApp();
  const { isPro } = usePro();

  const userEmail = user?.email || profile?.email || 'לא מחובר';

  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState(() => profileFromServer(profile));
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  /** אחרי לחיצה על ✓ ליד טקסט חופשי — כל אזור הקלט ייראה כמו אופציה נבחרת */
  const [activityFreeTextConfirmed, setActivityFreeTextConfirmed] = useState(false);

  useEffect(() => {
    if (!isEditing && profile) {
      setEditedProfile(profileFromServer(profile));
    }
  }, [profile, isEditing]);

  useEffect(() => {
    if (!isEditing) setActivityFreeTextConfirmed(false);
  }, [isEditing]);

  const activityLevels = [
    { id: 'sedentary', label: 'יושב/ת רוב היום', desc: 'עבודה משרדית, מעט תנועה', icon: '🛋️' },
    { id: 'light', label: 'פעילות קלה', desc: 'הליכות, פעילות מזדמנת', icon: '🚶' },
    { id: 'moderate', label: '2–3 אימונים בשבוע', desc: 'קצב בינוני', icon: '🏃' },
    { id: 'active', label: '4–5 אימונים בשבוע', desc: 'פעילות גבוהה', icon: '💪' },
    { id: 'intense', label: 'אימונים יומיים אינטנסיביים', desc: 'רמת על', icon: '🔥' },
  ];

  const goalOptions = [
    { id: 'cut', label: 'חיטוב / ירידה באחוזי שומן', icon: '🔥' },
    { id: 'maintain', label: 'שמירה על המשקל', icon: '⚖️' },
    { id: 'lean_bulk', label: 'עלייה מתונה במסה (Lean)', icon: '📈' },
    { id: 'bulk', label: 'עלייה מהירה במסה (Bulk)', icon: '💪' },
  ];

  const paceOptions = [
    { id: 'slow', label: 'קצב רגוע – יציבות לטווח ארוך', icon: '🌿' },
    { id: 'balanced', label: 'איזון – גם תוצאות וגם כיף', icon: '⚖️' },
    { id: 'fast', label: 'שינוי מהיר (בגבולות הבריא)', icon: '🚀' },
  ];

  const calculateWaterTarget = useCallback((g) => {
    if (g === 'bulk' || g === 'lean_bulk') return 10;
    return 8;
  }, []);

  const cancelEditing = () => {
    setActivityFreeTextConfirmed(false);
    setEditedProfile(profileFromServer(profile));
    setIsEditing(false);
  };

  const handleRecalculateAndSave = async () => {
    if (isRecalculating) return;

    const name = (editedProfile.name || '').trim();
    if (!name) {
      Alert.alert('חסר שם', 'נא להזין שם תקין');
      return;
    }
    if (!editedProfile.gender) {
      Alert.alert('חסר מין', 'נא לבחור מין או "לא רוצה לציין"');
      return;
    }
    const w = parseFloat(editedProfile.weight_kg);
    const h = parseFloat(editedProfile.height_cm);
    const a = parseInt(editedProfile.age, 10);
    if (!w || w <= 0 || !h || h <= 0 || !a || a <= 0) {
      Alert.alert('נתונים חסרים', 'נא למלא גיל, גובה ומשקל תקינים');
      return;
    }
    const actNotes = (editedProfile.activity_level_notes || '').trim();
    const hasPreset = !!editedProfile.activity_level;
    if (hasPreset && actNotes.length > 0) {
      Alert.alert('בחר אופציה אחת', 'או רמה מהרשימה או טקסט ידני — לא את שניהם.');
      return;
    }
    if (!hasPreset && actNotes.length < 3) {
      Alert.alert('חסרה רמת פעילות', 'בחרי מהרשימה או כיתבי לפחות כמה מילים.');
      return;
    }
    if (!editedProfile.goal) {
      Alert.alert('חסרה מטרה', 'נא לבחור מטרה');
      return;
    }
    if (!editedProfile.pace) {
      Alert.alert('חסר קצב', 'נא לבחור קצב שינוי');
      return;
    }

    setIsRecalculating(true);
    try {
      const userData = {
        gender: editedProfile.gender,
        weight_kg: w,
        height_cm: h,
        age: a,
        activity_level: hasPreset ? editedProfile.activity_level : 'moderate',
        activity_level_notes: hasPreset ? undefined : (actNotes || undefined),
        goal: editedProfile.goal,
        pace: editedProfile.pace,
      };

      const ai = await calculateNutritionTargets(userData);
      const merged = {
        ...profile,
        ...editedProfile,
        name,
        weight_kg: w,
        height_cm: h,
        age: a,
        activity_level: hasPreset ? editedProfile.activity_level : 'moderate',
        activity_level_notes: hasPreset ? null : (actNotes || null),
        calories_target: Math.round(ai.calories),
        protein_target: Math.round(ai.protein),
        fat_target: Math.round(ai.fat),
        carbs_target: Math.round(ai.carbs),
        water_target: calculateWaterTarget(editedProfile.goal),
        onboarding_completed: true,
      };

      const result = await setProfile(merged);
      if (result?.error) {
        Alert.alert('שגיאה', 'לא הצלחנו לשמור את הפרופיל. נסה שוב.');
        return;
      }
      setIsEditing(false);
      Alert.alert('עודכן', 'היעדים חושבו מחדש לפי הנתונים שעדכנת.');
    } catch (e) {
      console.log('[Profile] recalculate:', e);
      Alert.alert('שגיאה', 'לא הצלחנו לחשב יעדים. בדוק חיבור ונסה שוב.');
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'התנתקות',
      'האם אתה בטוח שברצונך להתנתק?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'התנתק',
          style: 'destructive',
          onPress: () => {
            // logout מנקה את ה-session מיידית ומעביר למסך Login
            logout();
          }
        },
      ]
    );
  };

  const performDeleteAccount = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const result = await deleteAccount();
      if (result?.error) {
        setIsDeleting(false);
        Alert.alert(
          'שגיאה במחיקה',
          'לא הצלחנו למחוק את החשבון. נסה שוב מאוחר יותר או פנה לתמיכה ב-support@biobalance.app.'
        );
        return;
      }

      try {
        await supabaseSignOutAndClear();
      } catch {}

      Alert.alert('החשבון נמחק', 'כל הנתונים שלך הוסרו מהשרת.');
    } catch (e) {
      setIsDeleting(false);
      Alert.alert('שגיאה במחיקה', 'אירעה תקלה. נסה שוב.');
    }
  };

  const supabaseSignOutAndClear = async () => {
    try {
      await AsyncStorage.clear();
    } catch {}
    await logout();
  };

  const handleDeleteAccount = () => {
    if (isDeleting) return;
    Alert.alert(
      'מחיקת חשבון',
      'פעולה זו תמחק לצמיתות את החשבון, הפרופיל, היסטוריית הארוחות, התמונות וכל הנתונים שלך. לא ניתן לשחזר זאת.',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'המשך',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'אישור אחרון',
              'האם אתה בטוח לחלוטין? המחיקה היא בלתי הפיכה.',
              [
                { text: 'בטל', style: 'cancel' },
                {
                  text: 'מחק את החשבון',
                  style: 'destructive',
                  onPress: performDeleteAccount,
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backIcon}>→</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>⚙️ הגדרות</Text>
        </View>
        <TouchableOpacity
          style={[styles.editButton, isEditing && styles.editButtonCancel]}
          onPress={() => {
            if (isEditing) {
              cancelEditing();
              return;
            }
            const ep = profileFromServer(profile);
            setEditedProfile(ep);
            const notes = (ep.activity_level_notes || '').trim();
            const hasPreset = !!ep.activity_level;
            setActivityFreeTextConfirmed(notes.length >= 3 && !hasPreset);
            setIsEditing(true);
          }}
          disabled={isRecalculating}
        >
          <Text style={[styles.editButtonText, isEditing && styles.editButtonTextCancel]}>
            {isEditing ? 'ביטול' : 'עריכה'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Profile Card */}
        <AnimatedCard delay={0}>
          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(profile?.name || userEmail || 'מ').charAt(0).toUpperCase()}
                </Text>
              </View>
              {user && <View style={styles.onlineDot} />}
            </View>

            {isEditing ? (
              <View
                style={[styles.nameEditRow, I18nManager.isRTL && styles.editRowForceLtr]}
              >
                <View style={styles.nameInputWrap}>
                  <TextInput
                    style={styles.nameInput}
                    value={editedProfile.name}
                    onChangeText={(text) => setEditedProfile({ ...editedProfile, name: text })}
                    placeholder="השם שלך"
                    placeholderTextColor="#94A3B8"
                    textAlign="center"
                  />
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.inlineSubmitBtn,
                    pressed && styles.inlineSubmitBtnPressed,
                  ]}
                  onPress={() => Keyboard.dismiss()}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="סיום עריכת שם"
                  android_ripple={
                    Platform.OS === 'android'
                      ? { color: 'rgba(15, 23, 42, 0.08)', borderless: false }
                      : undefined
                  }
                >
                  <Text style={styles.inlineSubmitBtnText}>✓</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.profileName}>{profile?.name || 'משתמש'}</Text>
            )}

            <Text style={styles.profileEmail}>{userEmail}</Text>

            {user && (
              <View style={styles.connectedBadge}>
                <View style={styles.connectedDot} />
                <Text style={styles.connectedText}>מחובר</Text>
              </View>
            )}
          </View>
        </AnimatedCard>

        <AnimatedCard delay={60}>
          <TouchableOpacity
            style={styles.proBanner}
            onPress={() => navigation.navigate('Subscription')}
            activeOpacity={0.88}
          >
            <View style={styles.proBannerBadge}>
              <Text style={styles.proBannerBadgeText}>Pro</Text>
            </View>
            <View style={styles.proBannerCopy}>
              <Text style={styles.proBannerTitle}>BioBalance Pro</Text>
              <Text style={styles.proBannerDesc}>
                {isPro
                  ? 'המנוי שלך פעיל — תודה שאתה איתנו'
                  : 'ניתוח AI, ארוחות חכמות וסטטיסטיקות מלאות'}
              </Text>
            </View>
            <Text style={styles.proBannerArrow}>←</Text>
          </TouchableOpacity>
        </AnimatedCard>

        {/* Personal Info Section */}
        <AnimatedCard delay={100}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>נתונים אישיים</Text>
              <Text style={styles.sectionIcon}>👤</Text>
            </View>

            <View style={styles.fieldsList}>
              <View style={styles.fieldRow}>
                <View style={styles.fieldLeft}>
                  {isEditing ? (
                    <TextInput
                      style={styles.fieldInput}
                      value={String(editedProfile.age || '')}
                      onChangeText={(text) => setEditedProfile({ ...editedProfile, age: parseInt(text) || 0 })}
                      keyboardType="number-pad"
                      placeholder="--"
                    />
                  ) : (
                    <Text style={styles.fieldValue}>{profile?.age || '--'}</Text>
                  )}
                  <Text style={styles.fieldUnit}>שנים</Text>
                </View>
                <Text style={styles.fieldLabel}>גיל</Text>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldLeft}>
                  {isEditing ? (
                    <TextInput
                      style={styles.fieldInput}
                      value={String(editedProfile.height_cm || '')}
                      onChangeText={(text) => setEditedProfile({ ...editedProfile, height_cm: parseInt(text) || 0 })}
                      keyboardType="number-pad"
                      placeholder="--"
                    />
                  ) : (
                    <Text style={styles.fieldValue}>{profile?.height_cm || '--'}</Text>
                  )}
                  <Text style={styles.fieldUnit}>ס״מ</Text>
                </View>
                <Text style={styles.fieldLabel}>גובה</Text>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldLeft}>
                  {isEditing ? (
                    <TextInput
                      style={styles.fieldInput}
                      value={String(editedProfile.weight_kg || '')}
                      onChangeText={(text) => setEditedProfile({ ...editedProfile, weight_kg: parseFloat(text) || 0 })}
                      keyboardType="decimal-pad"
                      placeholder="--"
                    />
                  ) : (
                    <Text style={styles.fieldValue}>{profile?.weight_kg || '--'}</Text>
                  )}
                  <Text style={styles.fieldUnit}>ק״ג</Text>
                </View>
                <Text style={styles.fieldLabel}>משקל</Text>
              </View>

              <View style={[styles.fieldRow, styles.fieldRowLast]}>
                <View style={styles.fieldLeft}>
                  {isEditing ? (
                    <View style={styles.genderButtons}>
                      <TouchableOpacity
                        style={[styles.genderBtn, editedProfile.gender === 'female' && styles.genderBtnActive]}
                        onPress={() => setEditedProfile({ ...editedProfile, gender: 'female' })}
                      >
                        <Text style={[styles.genderText, editedProfile.gender === 'female' && styles.genderTextActive]}>נקבה</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.genderBtn, editedProfile.gender === 'male' && styles.genderBtnActive]}
                        onPress={() => setEditedProfile({ ...editedProfile, gender: 'male' })}
                      >
                        <Text style={[styles.genderText, editedProfile.gender === 'male' && styles.genderTextActive]}>זכר</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.genderBtn, editedProfile.gender === 'other' && styles.genderBtnActive]}
                        onPress={() => setEditedProfile({ ...editedProfile, gender: 'other' })}
                      >
                        <Text style={[styles.genderText, editedProfile.gender === 'other' && styles.genderTextActive]}>לא צוין</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={styles.fieldValue}>
                      {profile?.gender === 'male'
                        ? 'זכר'
                        : profile?.gender === 'female'
                          ? 'נקבה'
                          : profile?.gender === 'other'
                            ? 'לא רוצה לציין'
                            : '--'}
                    </Text>
                  )}
                </View>
                <Text style={styles.fieldLabel}>מין</Text>
              </View>
            </View>
          </View>
        </AnimatedCard>

        {/* Activity Level Section */}
        <AnimatedCard delay={200}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>רמת פעילות</Text>
              <Text style={styles.sectionIcon}>🏃</Text>
            </View>

            <View style={styles.activityList}>
              {activityLevels.map((level) => {
                const notesTrimEdit = (editedProfile.activity_level_notes || '').trim();
                const notesTrimView = (profile?.activity_level_notes || '').trim();
                const currentAct = isEditing
                  ? (notesTrimEdit ? null : editedProfile.activity_level)
                  : (notesTrimView ? null : normalizeActivityLevel(profile?.activity_level));
                return (
                  <TouchableOpacity
                    key={level.id}
                    style={[
                      styles.activityOption,
                      currentAct === level.id && styles.activityOptionActive,
                    ]}
                    onPress={() => {
                      if (!isEditing) return;
                      setActivityFreeTextConfirmed(false);
                      setEditedProfile({
                        ...editedProfile,
                        activity_level: level.id,
                        activity_level_notes: '',
                      });
                    }}
                    disabled={!isEditing}
                    activeOpacity={isEditing ? 0.7 : 1}
                  >
                    <View style={styles.activityLeft}>
                      {currentAct === level.id && (
                        <View style={styles.activityCheck}>
                          <Text style={styles.activityCheckText}>✓</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.activityInfo}>
                      <Text style={styles.activityLabel}>{level.label}</Text>
                      <Text style={styles.activityDesc}>{level.desc}</Text>
                    </View>
                    <Text style={styles.activityIcon}>{level.icon}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {isEditing ? (
              <View style={[styles.activityNotesRow, styles.activityNotesRowLtr]}>
                <Pressable
                  style={({ pressed }) => [
                    styles.inlineSubmitBtnActivity,
                    activityFreeTextConfirmed && styles.inlineSubmitBtnActivityConfirmed,
                    !activityFreeTextConfirmed &&
                      pressed &&
                      styles.inlineSubmitBtnActivityPressed,
                  ]}
                  onPress={() => {
                    const t = (editedProfile.activity_level_notes || '').trim();
                    if (t.length < 3) {
                      Alert.alert(
                        'טקסט קצר מדי',
                        'כתוב לפחות כמה מילים (3 תווים ומעלה), או בחרי מהרשימה למעלה.'
                      );
                      return;
                    }
                    setActivityFreeTextConfirmed(true);
                    requestAnimationFrame(() => Keyboard.dismiss());
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="סיום עריכת רמת פעילות"
                  android_ripple={
                    Platform.OS === 'android'
                      ? {
                          color: activityFreeTextConfirmed
                            ? 'rgba(255, 255, 255, 0.35)'
                            : 'rgba(22, 163, 74, 0.22)',
                          borderless: false,
                        }
                      : undefined
                  }
                >
                  <Text
                    style={[
                      styles.inlineSubmitBtnTextActivity,
                      activityFreeTextConfirmed && styles.inlineSubmitBtnTextActivityConfirmed,
                    ]}
                  >
                    ✓
                  </Text>
                </Pressable>
                <View
                  style={[
                    styles.activityNotesInputWrap,
                    activityFreeTextConfirmed && styles.activityNotesInputWrapSelected,
                  ]}
                >
                  <TextInput
                    value={editedProfile.activity_level_notes || ''}
                    onChangeText={(v) => {
                      setActivityFreeTextConfirmed(false);
                      setEditedProfile((prev) => ({
                        ...prev,
                        activity_level_notes: v,
                        activity_level: v.trim() ? null : prev.activity_level,
                      }));
                    }}
                    placeholder="או כאן במילים (לא בשילוב עם הרשימה)"
                    placeholderTextColor="#94A3B8"
                    style={[
                      styles.activityNotesInput,
                      activityFreeTextConfirmed && styles.activityNotesInputConfirmed,
                    ]}
                    multiline
                    textAlign="right"
                    textAlignVertical="top"
                  />
                </View>
              </View>
            ) : (profile?.activity_level_notes || '').trim() ? (
              <Text style={styles.activityNotesReadonly}>{profile.activity_level_notes.trim()}</Text>
            ) : null}
          </View>
        </AnimatedCard>

        {/* Goal & pace (שאלון ראשוני) */}
        <AnimatedCard delay={240}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>מטרה וקצב</Text>
              <Text style={styles.sectionIcon}>🎯</Text>
            </View>

            {!isEditing ? (
              <>
                <View style={styles.readonlyMetaRow}>
                  <Text style={styles.readonlyMetaLabel}>מטרה</Text>
                  <Text style={styles.readonlyMetaValue}>
                    {goalLabels[profile?.goal] || goalLabels.maintain}
                  </Text>
                </View>
                <View style={[styles.readonlyMetaRow, styles.readonlyMetaRowLast]}>
                  <Text style={styles.readonlyMetaLabel}>קצב שינוי</Text>
                  <Text style={styles.readonlyMetaValue}>
                    {paceLabels[profile?.pace || 'balanced']}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.subsectionLabel}>המטרה שלך</Text>
                <View style={styles.activityList}>
                  {goalOptions.map((g) => (
                    <TouchableOpacity
                      key={g.id}
                      style={[
                        styles.activityOption,
                        editedProfile.goal === g.id && styles.activityOptionActive,
                      ]}
                      onPress={() => setEditedProfile({ ...editedProfile, goal: g.id })}
                      activeOpacity={0.7}
                    >
                      <View style={styles.activityLeft}>
                        {editedProfile.goal === g.id && (
                          <View style={styles.activityCheck}>
                            <Text style={styles.activityCheckText}>✓</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.activityInfo}>
                        <Text style={styles.activityLabel}>{g.label}</Text>
                      </View>
                      <Text style={styles.activityIcon}>{g.icon}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.subsectionLabel, { marginTop: 16 }]}>קצב השינוי</Text>
                <View style={styles.activityList}>
                  {paceOptions.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.activityOption,
                        editedProfile.pace === p.id && styles.activityOptionActive,
                      ]}
                      onPress={() => setEditedProfile({ ...editedProfile, pace: p.id })}
                      activeOpacity={0.7}
                    >
                      <View style={styles.activityLeft}>
                        {editedProfile.pace === p.id && (
                          <View style={styles.activityCheck}>
                            <Text style={styles.activityCheckText}>✓</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.activityInfo}>
                        <Text style={styles.activityLabel}>{p.label}</Text>
                      </View>
                      <Text style={styles.activityIcon}>{p.icon}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        </AnimatedCard>

        {isEditing && (
          <View>
            <Text style={styles.submitAiHint}>
              לאחר עדכון הפרטים, שלח לחישוב מחדש של קלוריות, מאקרו ומים (בהתאם למודל ה-AI או לחישוב גיבוי).
            </Text>
            <TouchableOpacity
              style={[styles.submitAiButton, isRecalculating && styles.submitAiButtonDisabled]}
              onPress={handleRecalculateAndSave}
              disabled={isRecalculating}
              activeOpacity={0.88}
            >
              {isRecalculating ? (
                <ActivityIndicator color="#32A728" />
              ) : (
                <View style={styles.submitAiRow}>
                  <Text style={styles.submitAiCheck}>✓</Text>
                  <Text style={styles.submitAiText}>שלח וחשב יעדים מחדש</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Daily Goals Section */}
        <AnimatedCard delay={300}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>יעדים יומיים</Text>
              <Text style={styles.sectionIcon}>🎯</Text>
            </View>

            <View style={styles.goalsGrid}>
              <View style={styles.goalCard}>
                <Text style={styles.goalEmoji}>🔥</Text>
                <Text style={styles.goalValue}>{profile?.calories_target || 2000}</Text>
                <Text style={styles.goalLabel}>קלוריות</Text>
              </View>
              <View style={styles.goalCard}>
                <Text style={styles.goalEmoji}>💪</Text>
                <Text style={styles.goalValue}>{profile?.protein_target || 90}g</Text>
                <Text style={styles.goalLabel}>חלבון</Text>
              </View>
              <View style={styles.goalCard}>
                <Text style={styles.goalEmoji}>🥑</Text>
                <Text style={styles.goalValue}>{profile?.fat_target || 65}g</Text>
                <Text style={styles.goalLabel}>שומן</Text>
              </View>
              <View style={styles.goalCard}>
                <Text style={styles.goalEmoji}>🌾</Text>
                <Text style={styles.goalValue}>{profile?.carbs_target ?? 250}g</Text>
                <Text style={styles.goalLabel}>פחמימות</Text>
              </View>
              <View style={styles.goalCard}>
                <Text style={styles.goalEmoji}>💧</Text>
                <Text style={styles.goalValue}>{profile?.water_target || 8}</Text>
                <Text style={styles.goalLabel}>כוסות מים</Text>
              </View>
            </View>

            <Text style={styles.goalsNote}>
              {isEditing
                ? '* היעדים הנוכחיים יתעדכנו אחרי לחיצה על «שלח וחשב יעדים מחדש»'
                : '* היעדים מחושבים לפי נתוני השאלון; ניתן לעדכן במצב עריכה'}
            </Text>
            <SourceCitation variant="full" />
          </View>
        </AnimatedCard>

        {/* Sources & Disclaimer */}
        <AnimatedCard delay={380}>
          <TouchableOpacity
            style={styles.sourcesRow}
            onPress={() => navigation.navigate('Sources')}
            activeOpacity={0.7}
          >
            <Text style={styles.sourcesArrow}>←</Text>
            <View style={styles.sourcesInfo}>
              <Text style={styles.sourcesLabel}>אודות ומקורות</Text>
              <Text style={styles.sourcesDesc}>USDA, WHO, נוסחאות חישוב והצהרה רפואית</Text>
            </View>
            <Text style={styles.sourcesIcon}>📚</Text>
          </TouchableOpacity>
        </AnimatedCard>

        {/* Logout Section */}
        <AnimatedCard delay={400}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutIcon}>🚪</Text>
            <Text style={styles.logoutText}>התנתקות</Text>
          </TouchableOpacity>
        </AnimatedCard>

        {/* Danger Zone — Account Deletion (Apple 5.1.1(v)) */}
        <AnimatedCard delay={450}>
          <View style={styles.dangerSection}>
            <Text style={styles.dangerTitle}>אזור מסוכן</Text>
            <TouchableOpacity
              style={[styles.deleteAccountButton, isDeleting && styles.deleteAccountButtonDisabled]}
              onPress={handleDeleteAccount}
              disabled={isDeleting}
              activeOpacity={0.85}
            >
              <Text style={styles.deleteAccountText}>
                {isDeleting ? 'מוחק…' : 'מחיקת חשבון לצמיתות'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.deleteAccountHelp}>
              מחיקה תסיר את החשבון, הפרופיל, התמונות וכל הנתונים מהשרת. אין שחזור.
            </Text>
          </View>
        </AnimatedCard>

        {/* App Info */}
        <AnimatedCard delay={500}>
          <View style={styles.appInfo}>
            <Text style={styles.appLogo}>BioBalance</Text>
            <Text style={styles.appVersion}>גרסה 1.0</Text>
          </View>
        </AnimatedCard>

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
  backButton: {
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
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  editButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
  },
  editButtonActive: {
    backgroundColor: '#16A34A',
  },
  editButtonCancel: {
    backgroundColor: '#F1F5F9',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  editButtonTextActive: {
    color: '#FFFFFF',
  },
  editButtonTextCancel: {
    color: '#475569',
  },
  submitAiButton: {
    backgroundColor: '#E8F5E8',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  submitAiButtonDisabled: {
    opacity: 0.72,
  },
  submitAiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  submitAiCheck: {
    fontSize: 18,
    fontWeight: '800',
    color: '#32A728',
  },
  submitAiText: {
    color: '#32A728',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  submitAiHint: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  readonlyMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  readonlyMetaRowLast: {
    borderBottomWidth: 0,
  },
  readonlyMetaLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  readonlyMetaValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  // Profile Card
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#16A34A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#22C55E',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  editRowForceLtr: {
    direction: 'ltr',
  },
  nameInputWrap: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
  },
  nameInput: {
    width: '100%',
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    borderBottomWidth: 2,
    borderBottomColor: '#16A34A',
    paddingBottom: 4,
  },
  inlineSubmitBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E8',
    borderWidth: 1,
    borderColor: '#C8E6C9',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    zIndex: 2,
    elevation: 3,
    overflow: 'hidden',
  },
  inlineSubmitBtnPressed: {
    opacity: Platform.OS === 'ios' ? 0.88 : 1,
  },
  inlineSubmitBtnText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#32A728',
  },
  /** ✓ משמאל לשדה; פריסה LTR כדי ש״שמאל״ יהיה קבוע גם כשהאפליקציה ב־RTL */
  activityNotesRowLtr: {
    direction: 'ltr',
  },
  /** כמו activityOption / activityOptionActive — ברירת מחדל עדין, בלחיצה ירוק בהיר + מסגרת */
  inlineSubmitBtnActivity: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E8',
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    zIndex: 2,
    elevation: 2,
    overflow: 'hidden',
    marginTop: 8,
  },
  inlineSubmitBtnActivityPressed: {
    backgroundColor: '#F0FDF4',
    borderColor: '#16A34A',
  },
  /** מצב מאושר — כמו עיגול ה־✓ ברשימת רמות (לא „שורה ריקה\" ירוקה בהירה) */
  inlineSubmitBtnActivityConfirmed: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  inlineSubmitBtnTextActivity: {
    fontSize: 18,
    fontWeight: '800',
    color: '#32A728',
  },
  inlineSubmitBtnTextActivityConfirmed: {
    color: '#FFFFFF',
  },
  profileEmail: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  connectedText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16A34A',
  },
  proBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#F7FDF9',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  proBannerBadge: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 12,
  },
  proBannerBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  proBannerCopy: {
    flex: 1,
  },
  proBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'right',
    marginBottom: 4,
  },
  proBannerDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'right',
    lineHeight: 18,
  },
  proBannerArrow: {
    fontSize: 18,
    color: '#86EFAC',
    marginLeft: 4,
  },
  // Section
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  sectionIcon: {
    fontSize: 20,
    marginLeft: 8,
  },
  subsectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'right',
    marginBottom: 10,
  },
  // Fields
  fieldsList: {
    gap: 0,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  fieldRowLast: {
    borderBottomWidth: 0,
  },
  fieldLabel: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  },
  fieldLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fieldValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  fieldUnit: {
    fontSize: 13,
    color: '#94A3B8',
  },
  fieldInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 60,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  genderButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
    maxWidth: 220,
  },
  genderBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  genderBtnActive: {
    backgroundColor: '#16A34A',
  },
  genderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  genderTextActive: {
    color: '#FFFFFF',
  },
  // Activity
  activityList: {
    gap: 10,
  },
  activityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activityOptionActive: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  activityLeft: {
    width: 28,
  },
  activityCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#16A34A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityCheckText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  activityInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  activityLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  activityDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  activityIcon: {
    fontSize: 24,
    marginLeft: 12,
  },
  activityNotesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
    width: '100%',
  },
  activityNotesInputWrap: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
  },
  activityNotesInputWrapSelected: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#16A34A',
    overflow: 'hidden',
  },
  activityNotesInput: {
    width: '100%',
    minHeight: 52,
    maxHeight: 96,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: '#0F172A',
    textAlign: 'right',
  },
  activityNotesInputConfirmed: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
  },
  activityNotesReadonly: {
    fontSize: 14,
    color: '#334155',
    textAlign: 'right',
    lineHeight: 20,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
  },
  // Goals
  goalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  goalCard: {
    width: '47%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  goalEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  goalValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E293B',
  },
  goalLabel: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  goalsNote: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 16,
  },
  // Sources row
  sourcesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sourcesIcon: {
    fontSize: 22,
    marginLeft: 12,
  },
  sourcesInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  sourcesLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'right',
  },
  sourcesDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'right',
  },
  sourcesArrow: {
    fontSize: 16,
    color: '#9CA3AF',
    marginRight: 8,
  },
  // Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 14,
    padding: 16,
    gap: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutIcon: {
    fontSize: 20,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },
  // Danger Zone (account deletion)
  dangerSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  dangerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B91C1C',
    textAlign: 'right',
    marginBottom: 10,
  },
  deleteAccountButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#DC2626',
  },
  deleteAccountButtonDisabled: {
    opacity: 0.6,
  },
  deleteAccountText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#DC2626',
  },
  deleteAccountHelp: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'right',
    marginTop: 8,
    lineHeight: 16,
  },
  // App Info
  appInfo: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  appLogo: {
    fontSize: 22,
    fontWeight: '700',
    color: '#16A34A',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 12,
    color: '#94A3B8',
  },
});
