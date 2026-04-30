import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import { deleteAccount } from '../api/supabaseClient';

export default function Account() {
  const navigation = useNavigation();
  const { setProfile, setDailyStats, setMessages, logout, user, profile } = useApp();
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Get user email from Supabase user object
  const userEmail = user?.email || 'לא מחובר';

  const menuItems = [
    {
      id: 'notifications',
      icon: '🔔',
      label: 'התראות',
      desc: 'ניהול תזכורות והתראות',
      action: () => Alert.alert('התראות', 'בקרוב...'),
    },
    {
      id: 'export',
      icon: '📊',
      label: 'ייצוא נתונים',
      desc: 'הורד את כל הנתונים שלך',
      action: () => Alert.alert('ייצוא', 'הנתונים שלך יישלחו במייל'),
    },
    {
      id: 'privacy',
      icon: '🔒',
      label: 'פרטיות',
      desc: 'מדיניות פרטיות',
      action: () => Linking.openURL('https://example.com/privacy'),
    },
    {
      id: 'terms',
      icon: '📄',
      label: 'תנאי שימוש',
      desc: 'תנאים והגבלות',
      action: () => Linking.openURL('https://example.com/terms'),
    },
    {
      id: 'support',
      icon: '💬',
      label: 'תמיכה',
      desc: 'צור קשר עם הצוות',
      action: () => Linking.openURL('mailto:support@naturebot.app'),
    },
    {
      id: 'rate',
      icon: '⭐',
      label: 'דרג אותנו',
      desc: 'עזור לנו להשתפר',
      action: () => Alert.alert('תודה!', 'נשמח לדירוג חיובי 😊'),
    },
  ];

  const handleResetData = () => {
    Alert.alert(
      'איפוס נתונים',
      user
        ? 'פעולה זו תנתק אותך מהחשבון. הנתונים בשרת יישמרו.'
        : 'האם אתה בטוח? כל הנתונים המקומיים יימחקו.',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: user ? 'התנתק' : 'מחק הכל',
          style: 'destructive',
          onPress: () => {
            AsyncStorage.clear().catch(() => {});
            if (user) {
              // logout מנקה את ה-session מיידית ומעביר למסך Login
              logout();
            } else {
              setProfile(null);
              setDailyStats({ calories: 0, protein: 0, fat: 0, carbs: 0, water_glasses: 0 });
              setMessages([]);
              navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
            }
          },
        },
      ]
    );
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
          },
        },
      ]
    );
  };

  const performDeleteAccount = async () => {
    if (isDeletingAccount) return;
    setIsDeletingAccount(true);
    try {
      const result = await deleteAccount();
      if (result?.error) {
        setIsDeletingAccount(false);
        Alert.alert(
          'שגיאה במחיקה',
          'לא הצלחנו למחוק את החשבון. נסה שוב מאוחר יותר או פנה לתמיכה ב-support@biobalance.app.'
        );
        return;
      }
      try {
        await AsyncStorage.clear();
      } catch {}
      await logout();
      Alert.alert('החשבון נמחק', 'כל הנתונים שלך הוסרו מהשרת.');
    } catch {
      setIsDeletingAccount(false);
      Alert.alert('שגיאה במחיקה', 'אירעה תקלה. נסה שוב.');
    }
  };

  const handleDeleteAccount = () => {
    if (isDeletingAccount) return;
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>חשבון</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Profile Card */}
        <View style={styles.userCard}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {profile?.name?.[0]?.toUpperCase() || userEmail?.[0]?.toUpperCase() || '👤'}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{profile?.name || 'משתמש'}</Text>
            <Text style={styles.userEmail}>{userEmail}</Text>
            {user && (
              <View style={styles.connectedBadge}>
                <Text style={styles.connectedDot}>●</Text>
                <Text style={styles.connectedText}>מחובר</Text>
              </View>
            )}
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.section}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuItem, index === 0 && styles.menuItemFirst]}
              onPress={item.action}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <View style={styles.menuItemIcon}>
                  <Text style={styles.iconEmoji}>{item.icon}</Text>
                </View>
                <View style={styles.menuItemInfo}>
                  <Text style={styles.menuItemLabel}>{item.label}</Text>
                  <Text style={styles.menuItemDesc}>{item.desc}</Text>
                </View>
              </View>
              <Text style={styles.menuItemArrow}>←</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Danger Zone */}
        <View style={styles.dangerSection}>
          <Text style={styles.dangerTitle}>אזור מסוכן</Text>

          <TouchableOpacity style={styles.dangerBtn} onPress={handleResetData}>
            <Text style={styles.dangerIcon}>🗑️</Text>
            <Text style={styles.dangerText}>איפוס כל הנתונים</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.dangerBtn, styles.logoutBtn]} onPress={handleLogout}>
            <Text style={styles.dangerIcon}>🚪</Text>
            <Text style={styles.dangerText}>התנתקות</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dangerBtn, styles.deleteAccountBtn, isDeletingAccount && { opacity: 0.6 }]}
            onPress={handleDeleteAccount}
            disabled={isDeletingAccount}
          >
            <Text style={styles.dangerIcon}>⚠️</Text>
            <Text style={[styles.dangerText, styles.deleteAccountTextStrong]}>
              {isDeletingAccount ? 'מוחק…' : 'מחיקת חשבון לצמיתות'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.deleteAccountHelp}>
            מחיקה תסיר את החשבון, הפרופיל, התמונות וכל הנתונים מהשרת. אין שחזור.
          </Text>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <View style={styles.appLogo}>
            <Text style={styles.appLogoEmoji}>🌿</Text>
          </View>
          <Text style={styles.appName}>BioBalance</Text>
          <Text style={styles.appVersion}>גרסה 1.0.0</Text>
          <Text style={styles.appCopyright}>© 2024 BioBalance</Text>
        </View>

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

  // Header
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
  },

  // User Card
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: 20,
    marginHorizontal: 20,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  userAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#16A34A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
    marginRight: 16,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'right',
  },
  userEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'right',
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  connectedDot: {
    fontSize: 10,
    color: '#22C55E',
    marginLeft: 6,
  },
  connectedText: {
    fontSize: 13,
    color: '#22C55E',
    fontWeight: '600',
  },

  // Menu Section
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  menuItemFirst: {
    borderTopWidth: 0,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  iconEmoji: {
    fontSize: 20,
  },
  menuItemInfo: {
    flex: 1,
  },
  menuItemLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'right',
  },
  menuItemDesc: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
    textAlign: 'right',
  },
  menuItemArrow: {
    fontSize: 18,
    color: '#D1D5DB',
    marginLeft: 8,
  },

  // Danger Section
  dangerSection: {
    marginTop: 32,
    marginHorizontal: 20,
  },
  dangerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'right',
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutBtn: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  dangerIcon: {
    fontSize: 20,
    marginRight: 14,
  },
  dangerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },
  deleteAccountBtn: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DC2626',
    borderWidth: 1.5,
  },
  deleteAccountTextStrong: {
    fontWeight: '700',
  },
  deleteAccountHelp: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'right',
    marginTop: 2,
    marginBottom: 4,
    lineHeight: 16,
  },

  // App Info
  appInfo: {
    alignItems: 'center',
    marginTop: 48,
    paddingHorizontal: 20,
  },
  appLogo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#DCFCE7',
  },
  appLogoEmoji: {
    fontSize: 32,
  },
  appName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#16A34A',
  },
  appVersion: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  appCopyright: {
    fontSize: 12,
    color: '#D1D5DB',
    marginTop: 8,
  },
});


