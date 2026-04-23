import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';

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

  const userEmail = user?.email || profile?.email || 'לא מחובר';

  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState({ ...profile });

  const activityLevels = [
    { id: 'sedentary', label: 'יושבני', desc: 'עבודה משרדית, מעט פעילות', icon: '🪑' },
    { id: 'light', label: 'קל', desc: 'הליכות קלות, פעילות מזדמנת', icon: '🚶' },
    { id: 'moderate', label: 'בינוני', desc: 'אימונים 3-4 פעמים בשבוע', icon: '🏃' },
    { id: 'high', label: 'גבוה', desc: 'אימונים יומיים אינטנסיביים', icon: '💪' },
  ];

  const handleSave = async () => {
    try {
      await setProfile({ ...profile, ...editedProfile });
      setIsEditing(false);
      Alert.alert('נשמר!', 'הפרופיל עודכן בהצלחה');
    } catch (error) {
      Alert.alert('שגיאה', 'לא הצלחנו לשמור את השינויים');
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
          style={[styles.editButton, isEditing && styles.editButtonActive]}
          onPress={() => isEditing ? handleSave() : setIsEditing(true)}
        >
          <Text style={[styles.editButtonText, isEditing && styles.editButtonTextActive]}>
            {isEditing ? '✓ שמור' : 'עריכה'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
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
              <TextInput
                style={styles.nameInput}
                value={editedProfile.name}
                onChangeText={(text) => setEditedProfile({ ...editedProfile, name: text })}
                placeholder="השם שלך"
                placeholderTextColor="#94A3B8"
                textAlign="center"
              />
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
                    </View>
                  ) : (
                    <Text style={styles.fieldValue}>
                      {profile?.gender === 'male' ? 'זכר' : profile?.gender === 'female' ? 'נקבה' : '--'}
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
              {activityLevels.map((level) => (
                <TouchableOpacity
                  key={level.id}
                  style={[
                    styles.activityOption,
                    (isEditing ? editedProfile.activity_level : profile?.activity_level) === level.id && styles.activityOptionActive,
                  ]}
                  onPress={() => isEditing && setEditedProfile({ ...editedProfile, activity_level: level.id })}
                  disabled={!isEditing}
                  activeOpacity={isEditing ? 0.7 : 1}
                >
                  <View style={styles.activityLeft}>
                    {(isEditing ? editedProfile.activity_level : profile?.activity_level) === level.id && (
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
              ))}
            </View>
          </View>
        </AnimatedCard>

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
                <Text style={styles.goalEmoji}>💧</Text>
                <Text style={styles.goalValue}>{profile?.water_target || 8}</Text>
                <Text style={styles.goalLabel}>כוסות מים</Text>
              </View>
            </View>

            <Text style={styles.goalsNote}>* היעדים מחושבים אוטומטית לפי הנתונים שלך</Text>
          </View>
        </AnimatedCard>

        {/* Logout Section */}
        <AnimatedCard delay={400}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutIcon}>🚪</Text>
            <Text style={styles.logoutText}>התנתקות</Text>
          </TouchableOpacity>
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
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  editButtonTextActive: {
    color: '#FFFFFF',
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
  nameInput: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: '#16A34A',
    paddingBottom: 4,
    minWidth: 150,
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
    gap: 8,
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
