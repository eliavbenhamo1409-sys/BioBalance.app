import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';

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

export default function Subscription() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState('yearly');

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

        <Text style={styles.sectionLabel}>בחר מנוי</Text>
        <Text style={styles.planHint}>המחיר הסופי יוצג בשלב התשלום המאובטח.</Text>

        <TouchableOpacity
          style={[styles.planCard, plan === 'monthly' && styles.planCardActive]}
          onPress={() => setPlan('monthly')}
          activeOpacity={0.85}
        >
          <View style={styles.planRadioOuter}>{plan === 'monthly' ? <View style={styles.planRadioInner} /> : null}</View>
          <View style={styles.planBody}>
            <Text style={styles.planName}>חודשי</Text>
            <Text style={styles.planId}>monthly · גמישות מקסימלית</Text>
          </View>
          <Text style={styles.planPrice}>—</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.planYearlyWrap, plan === 'yearly' && styles.planCardActive]}
          onPress={() => setPlan('yearly')}
          activeOpacity={0.85}
        >
          <View style={styles.saveBadge}>
            <Text style={styles.saveBadgeText}>הכי משתלם</Text>
          </View>
          <View style={styles.planCardInnerRow}>
            <View style={styles.planRadioOuter}>{plan === 'yearly' ? <View style={styles.planRadioInner} /> : null}</View>
            <View style={styles.planBody}>
              <Text style={styles.planName}>שנתי</Text>
              <Text style={styles.planId}>yearly · התחייבות ארוכת טווח</Text>
            </View>
            <Text style={styles.planPrice}>—</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.legal}>
          המנוי מתחדש אוטומטית אלא אם בוטל לפחות 24 שעות לפני תום התקופה. ניתן לנהל
          ולבטל את המנוי בהגדרות החשבון.
        </Text>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(14, insets.bottom) },
        ]}
      >
        <TouchableOpacity style={styles.cta} activeOpacity={0.88}>
          <Text style={styles.ctaText}>המשך לתשלום המאובטח</Text>
          <Text style={styles.ctaSub}>גישה מלאה לכל התכונות של BioBalance Pro</Text>
        </TouchableOpacity>
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
  benefitsSection: {
    marginBottom: 8,
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
  planHint: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'right',
    marginBottom: 14,
    lineHeight: 20,
  },
  planCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
    marginBottom: 12,
  },
  planYearlyWrap: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: GREEN_LINE,
    backgroundColor: GREEN_SOFT,
    paddingTop: 22,
    paddingBottom: 18,
    paddingHorizontal: 18,
    marginBottom: 12,
    position: 'relative',
    overflow: 'visible',
  },
  planCardInnerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  planCardActive: {
    borderColor: GREEN,
    backgroundColor: '#FFFFFF',
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  saveBadge: {
    position: 'absolute',
    top: -10,
    right: 18,
    backgroundColor: GREEN,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
  },
  saveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  planRadioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 14,
  },
  planRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: GREEN,
  },
  planBody: {
    flex: 1,
  },
  planName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'right',
  },
  planId: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'right',
  },
  planPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#94A3B8',
  },
  legal: {
    marginTop: 20,
    fontSize: 11,
    lineHeight: 17,
    color: '#CBD5E1',
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
});
