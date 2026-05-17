// ============================================================
// Subscription — entry screen for BioBalance Pro.
// ============================================================
// Mostly an explanatory page. The real purchase flow is the paywall
// configured in the RevenueCat Dashboard, presented via
// RevenueCatUI.presentPaywall(). We currently sell only the monthly
// plan (₪12.90); the yearly tier is intentionally hidden for now.

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import usePro from '../hooks/usePro';

const GREEN = '#16A34A';
const GREEN_DARK = '#15803D';
const GREEN_SOFT = '#F0FDF4';
const GREEN_LINE = '#DCFCE7';

const BENEFITS = [
  {
    title: 'ניתוח AI מותאם אישית',
    desc: 'תובנות לפי הפרופיל, המטרות וההיסטוריה שלך.',
  },
  {
    title: 'תוכנית ארוחות יומית חכמה',
    desc: 'הצעות מזון עקביות עם איזון מאקרו ומיקרו.',
  },
  {
    title: 'מעקב וסטטיסטיקות מלאים',
    desc: 'מגמות לאורך זמן כדי לראות התקדמות אמיתית.',
  },
  {
    title: 'תזכורות והתראות חכמות',
    desc: 'פחות פספוסים — יותר עקביות ביום־יום.',
  },
  {
    title: 'חוויה נקייה',
    desc: 'ללא פרסומות — התמקדות בתזונה ובבריאות.',
  },
];

const MANAGE_URL_IOS = 'https://apps.apple.com/account/subscriptions';
const MANAGE_URL_ANDROID = 'https://play.google.com/store/account/subscriptions';

export default function Subscription() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {
    isPro,
    ready,
    offerings,
    monthlyPriceString,
    monthlyProductId,
    openPaywall,
    restore,
  } = usePro();
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const handlePurchase = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { purchased, result } = await openPaywall();
      if (purchased) {
        Alert.alert('ברוך הבא ל-BioBalance Pro 💚', 'המנוי הופעל בהצלחה.');
      } else if (result === 'ERROR') {
        Alert.alert('שגיאה', 'לא הצלחנו להציג את המסך. נסה שוב.');
      }
    } finally {
      setBusy(false);
    }
  }, [busy, openPaywall]);

  const handleRestore = useCallback(async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const res = await restore();
      if (res?.isPro) {
        Alert.alert('שוחזר בהצלחה', 'המנוי הקודם שלך פעיל מחדש.');
      } else {
        Alert.alert('לא נמצא מנוי פעיל', 'לא הצלחנו לאתר רכישה קודמת בחשבון הזה.');
      }
    } finally {
      setRestoring(false);
    }
  }, [restoring, restore]);

  const handleManage = useCallback(async () => {
    const url = Platform.OS === 'android' ? MANAGE_URL_ANDROID : MANAGE_URL_IOS;
    try { await Linking.openURL(url); } catch (_) {}
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>BioBalance Pro</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#F7FDF9', '#FFFFFF']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroKicker}>מנוי פרימיום</Text>
          <Text style={styles.heroTitle}>איזון שמתחיל מהנתונים</Text>
          <Text style={styles.heroSubtitle}>
            כלי AI ותכנון ארוחות שמכבדים את הגוף שלך — בלי רעש, עם בהירות.
          </Text>
        </LinearGradient>

        {isPro ? (
          <View style={styles.activeCard}>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>פעיל</Text>
            </View>
            <Text style={styles.activeTitle}>המנוי שלך פעיל</Text>
            <Text style={styles.activeDesc}>
              גישה מלאה לכל התכונות של BioBalance Pro. תודה שאתה איתנו.
            </Text>
            <TouchableOpacity style={styles.manageBtn} onPress={handleManage} activeOpacity={0.85}>
              <Text style={styles.manageBtnText}>ניהול המנוי בחנות</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.benefitsSection}>
          <Text style={styles.sectionLabel}>מה כלול</Text>
          <View style={styles.benefitsCard}>
            {BENEFITS.map((item, index) => (
              <View
                key={item.title}
                style={[styles.benefitRow, index > 0 && styles.benefitRowBorder]}
              >
                <View style={styles.checkWrap}>
                  <Text style={styles.checkMark}>✓</Text>
                </View>
                <View style={styles.benefitText}>
                  <Text style={styles.benefitTitle}>{item.title}</Text>
                  <Text style={styles.benefitDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {!isPro ? (
          <View style={styles.planSection}>
            <Text style={styles.sectionLabel}>המנוי</Text>
            <View style={styles.planCard}>
              <View style={styles.planBody}>
                <Text style={styles.planName}>חודשי</Text>
                <Text style={styles.planDesc}>גמישות מלאה — ביטול בכל רגע</Text>
              </View>
              <View style={styles.priceWrap}>
                {monthlyPriceString ? (
                  <Text style={styles.price}>{monthlyPriceString}</Text>
                ) : (
                  <>
                    <Text style={styles.priceCurrency}>₪</Text>
                    <Text style={styles.price}>12.90</Text>
                  </>
                )}
                <Text style={styles.pricePeriod}>/חודש</Text>
              </View>
            </View>
          </View>
        ) : null}

        {__DEV__ ? (
          <View style={styles.debugCard}>
            <Text style={styles.debugTitle}>Debug — RevenueCat</Text>
            <Text style={styles.debugLine}>ready: {String(ready)}</Text>
            <Text style={styles.debugLine}>isPro: {String(isPro)}</Text>
            <Text style={styles.debugLine}>
              currentOffering: {offerings?.currentOffering?.identifier || '—'}
            </Text>
            <Text style={styles.debugLine}>
              packages: {offerings?.currentOffering?.availablePackages?.length ?? 0}
            </Text>
            <Text style={styles.debugLine}>
              monthlyPackage: {offerings?.monthlyPackage?.identifier || '—'}
            </Text>
            <Text style={styles.debugLine}>
              productId: {monthlyProductId || '—'}
            </Text>
            <Text style={styles.debugLine}>
              price: {monthlyPriceString || '—'}
            </Text>
            {offerings?.error ? (
              <Text style={[styles.debugLine, { color: '#B91C1C' }]}>
                error: {offerings.error}
              </Text>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.legal}>
          המנוי מתחדש אוטומטית אלא אם בוטל לפחות 24 שעות לפני תום התקופה.
          ניתן לנהל ולבטל את המנוי בכל עת דרך הגדרות החשבון בחנות האפליקציות.
        </Text>

        <View style={{ height: 140 }} />
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(14, insets.bottom) },
        ]}
      >
        {!isPro ? (
          <>
            <TouchableOpacity
              style={[styles.cta, (!ready || busy) && styles.ctaDisabled]}
              activeOpacity={0.88}
              onPress={handlePurchase}
              disabled={!ready || busy}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.ctaText}>המשך לתשלום המאובטח</Text>
                  <Text style={styles.ctaSub}>גישה מלאה לכל התכונות של BioBalance Pro</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleRestore}
              style={styles.restoreBtn}
              activeOpacity={0.7}
              disabled={restoring}
            >
              {restoring ? (
                <ActivityIndicator size="small" color={GREEN_DARK} />
              ) : (
                <Text style={styles.restoreText}>שחזור רכישות</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.ctaSecondary}
            activeOpacity={0.85}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.ctaSecondaryText}>חזרה לאפליקציה</Text>
          </TouchableOpacity>
        )}
      </View>
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
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
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
    color: GREEN,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },
  headerPlaceholder: { width: 44 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  hero: {
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 22,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: GREEN_LINE,
  },
  heroKicker: {
    fontSize: 11,
    fontWeight: '700',
    color: GREEN_DARK,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'right',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'right',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  heroSubtitle: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 24,
    color: '#64748B',
    textAlign: 'right',
    fontWeight: '400',
  },

  activeCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GREEN_LINE,
    backgroundColor: GREEN_SOFT,
    padding: 18,
    marginBottom: 20,
  },
  activeBadge: {
    alignSelf: 'flex-end',
    backgroundColor: GREEN,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    marginBottom: 8,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  activeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: GREEN_DARK,
    textAlign: 'right',
    marginBottom: 6,
  },
  activeDesc: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'right',
    lineHeight: 20,
    marginBottom: 12,
  },
  manageBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: GREEN_LINE,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  manageBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: GREEN_DARK,
  },

  benefitsSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'right',
    marginBottom: 12,
  },
  benefitsCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  benefitRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  benefitRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F1F5F9',
  },
  checkWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: GREEN_SOFT,
    borderWidth: 1,
    borderColor: GREEN_LINE,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 14,
  },
  checkMark: {
    fontSize: 14,
    fontWeight: '800',
    color: GREEN,
  },
  benefitText: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'right',
    marginBottom: 4,
  },
  benefitDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: '#6B7280',
    textAlign: 'right',
  },

  planSection: { marginBottom: 8 },
  planCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: GREEN,
    backgroundColor: '#FFFFFF',
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 3,
  },
  planBody: { flex: 1 },
  planName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'right',
  },
  planDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'right',
  },
  priceWrap: {
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
  },
  priceCurrency: {
    fontSize: 16,
    fontWeight: '700',
    color: GREEN_DARK,
    marginLeft: 2,
  },
  price: {
    fontSize: 22,
    fontWeight: '800',
    color: GREEN_DARK,
    letterSpacing: -0.5,
  },
  pricePeriod: {
    fontSize: 12,
    color: '#64748B',
    marginRight: 4,
  },

  legal: {
    marginTop: 20,
    fontSize: 11,
    lineHeight: 17,
    color: '#94A3B8',
    textAlign: 'right',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  cta: {
    backgroundColor: GREEN,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: GREEN_DARK,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  ctaDisabled: { opacity: 0.55 },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  ctaSub: {
    marginTop: 6,
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },
  ctaSecondary: {
    backgroundColor: GREEN_SOFT,
    borderWidth: 1,
    borderColor: GREEN_LINE,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: GREEN_DARK,
  },
  restoreBtn: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  restoreText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  debugCard: {
    marginTop: 18,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  debugTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  debugLine: {
    fontSize: 11,
    color: '#475569',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  },
});
