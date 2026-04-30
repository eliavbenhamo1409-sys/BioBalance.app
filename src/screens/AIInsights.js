import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
  Extrapolate,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { analyzeNutritionWithO1 } from '../api/aiClient';
import {
  getDailyStatsHistory,
  getMealsSince,
  getWaterLogsSince,
  getWeightLogsSince,
} from '../api/supabaseClient';
import { buildAiBehaviorNarrative } from '../utils/buildAiBehaviorContext';
import SourceCitation from '../components/SourceCitation';
import moment from 'moment';
import 'moment/locale/he';

const LOOKBACK_DAYS = 21;

moment.locale('he');

/** Brand green — same as caloric balance (BalanceHeader trophy / ring) */
const BRAND = '#32A728';
const BRAND_LIGHT = '#E8F5E8';
const BRAND_TINT = 'rgba(50, 167, 40, 0.08)';
const TEXT_PRIMARY = '#0F1A0E';
const TEXT_MUTED = 'rgba(50, 167, 40, 0.55)';

const CITE_PALETTE = {
  text: TEXT_MUTED,
  link: BRAND,
  faint: 'rgba(50, 167, 40, 0.42)',
};

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 90,
  mass: 0.8,
};

// Bouncing Dots — dark dots on light loading row
const BouncingDots = ({ dark }) => {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    // Dot 1
    dot1.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 300, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 300, easing: Easing.in(Easing.ease) })
      ),
      -1,
      false
    );

    // Dot 2 - delayed
    dot2.value = withDelay(150,
      withRepeat(
        withSequence(
          withTiming(-8, { duration: 300, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 300, easing: Easing.in(Easing.ease) })
        ),
        -1,
        false
      )
    );

    // Dot 3 - more delayed
    dot3.value = withDelay(300,
      withRepeat(
        withSequence(
          withTiming(-8, { duration: 300, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 300, easing: Easing.in(Easing.ease) })
        ),
        -1,
        false
      )
    );

    return () => {
      cancelAnimation(dot1);
      cancelAnimation(dot2);
      cancelAnimation(dot3);
    };
  }, []);

  const dot1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot1.value }],
  }));

  const dot2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot2.value }],
  }));

  const dot3Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot3.value }],
  }));

  const dotColor = dark ? BRAND : '#FFFFFF';
  return (
    <View style={dotsStyles.container}>
      <Animated.View style={[dotsStyles.dot, { backgroundColor: dotColor }, dot1Style]} />
      <Animated.View style={[dotsStyles.dot, { backgroundColor: dotColor }, dot2Style]} />
      <Animated.View style={[dotsStyles.dot, { backgroundColor: dotColor }, dot3Style]} />
    </View>
  );
};

const dotsStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 18,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

// Insight card — single neutral surface, brand accent strip (RTL: physical right)
const InsightCard = ({ title, content, delay }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withSpring(1, SPRING_CONFIG));
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolate.CLAMP),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [16, 0], Extrapolate.CLAMP) },
    ],
  }));

  return (
    <Animated.View style={[styles.insightCard, cardStyle]}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardContent}>{content}</Text>
    </Animated.View>
  );
};

// Stats Summary Card
const StatsSummary = ({ dailyStats, targets }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(1, SPRING_CONFIG);
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolate.CLAMP),
    transform: [
      { scale: interpolate(progress.value, [0, 1], [0.9, 1], Extrapolate.CLAMP) },
    ],
  }));

  const caloriesPct = Math.round(((dailyStats?.calories || 0) / (targets?.calories || 2000)) * 100);
  const proteinPct = Math.round(((dailyStats?.protein || 0) / (targets?.protein || 90)) * 100);
  const fatPct = Math.round(((dailyStats?.fat || 0) / (targets?.fat || 65)) * 100);
  const waterPct = Math.round(((dailyStats?.water_glasses || 0) / (targets?.water || 8)) * 100);
  const carbT = targets?.carbs || 250;
  const carbPct = Math.round(((dailyStats?.carbs || 0) / (carbT || 1)) * 100);

  const overallScore = Math.round(
    (Math.min(100, caloriesPct) +
      Math.min(100, proteinPct) +
      Math.min(100, fatPct) +
      Math.min(100, waterPct) +
      Math.min(100, carbPct)) /
      5
  );

  return (
    <Animated.View style={[styles.summaryCard, cardStyle]}>
      <View style={styles.summaryInner}>
        <View style={[styles.scoreCircle, { borderColor: BRAND }]}>
          <View style={styles.scoreCircleInner}>
            <Text style={[styles.scoreNumber, { color: BRAND }]}>{Math.min(100, overallScore)}%</Text>
            <Text style={styles.scoreLabel}>היום</Text>
          </View>
        </View>
        <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, caloriesPct >= 90 && caloriesPct <= 110 && styles.statValueGood]}>{caloriesPct}%</Text>
          <Text style={styles.statLabel}>קל׳</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, proteinPct >= 100 && styles.statValueGood]}>{proteinPct}%</Text>
          <Text style={styles.statLabel}>חלבון</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, fatPct >= 100 && styles.statValueGood]}>{fatPct}%</Text>
          <Text style={styles.statLabel}>שומן</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, waterPct >= 100 && styles.statValueGood]}>{waterPct}%</Text>
          <Text style={styles.statLabel}>מים</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, carbPct >= 90 && carbPct <= 110 && styles.statValueGood]}>
            {carbPct}%
          </Text>
          <Text style={styles.statLabel}>פחמ׳</Text>
        </View>
        </View>
      </View>
    </Animated.View>
  );
};

export default function AIInsights() {
  const navigation = useNavigation();
  const { profile, dailyStats, user } = useApp();
  const [insights, setInsights] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [detailedReport, setDetailedReport] = useState(null);

  // Use useMemo to prevent recreating targets on every render
  const targets = useMemo(() => ({
    calories: profile?.calories_target || 2000,
    protein: profile?.protein_target || 90,
    fat: profile?.fat_target || 65,
    carbs: profile?.carbs_target || 250,
    water: profile?.water_target || 8,
  }), [profile?.calories_target, profile?.protein_target, profile?.fat_target, profile?.carbs_target, profile?.water_target]);

  const generateInsights = useCallback(() => {
    const caloriesPct = Math.round(((dailyStats?.calories || 0) / targets.calories) * 100);
    const proteinPct = Math.round(((dailyStats?.protein || 0) / targets.protein) * 100);
    const fatPct = Math.round(((dailyStats?.fat || 0) / targets.fat) * 100);
    const waterPct = Math.round(((dailyStats?.water_glasses || 0) / targets.water) * 100);
    const carbPct = Math.round(((dailyStats?.carbs || 0) / (targets.carbs || 250)) * 100);

    const hour = new Date().getHours();
    const newInsights = [];

    // Overall status
    const overallScore =
      (Math.min(100, caloriesPct) +
        Math.min(100, proteinPct) +
        Math.min(100, fatPct) +
        Math.min(100, waterPct) +
        Math.min(100, carbPct)) /
      5;

    if (overallScore >= 80) {
      newInsights.push({
        id: 'overall',
        title: 'הערכת מצב כללית',
        content: `יום מצוין! הגעת ל-${Math.round(overallScore)}% מהיעדים. ממשיכים כך!`,
        type: 'success',
      });
    } else if (overallScore >= 50) {
      newInsights.push({
        id: 'overall',
        title: 'הערכת מצב כללית',
        content: `אתה על ${Math.round(overallScore)}% מהיעדים. עוד קצת מאמץ ומגיעים ליעד!`,
        type: 'info',
      });
    } else {
      newInsights.push({
        id: 'overall',
        title: 'הערכת מצב כללית',
        content: `היום רק ${Math.round(overallScore)}% מהיעד. זה בסדר - כל יום הוא הזדמנות חדשה!`,
        type: 'warning',
      });
    }

    // Strengths
    const strengths = [];
    if (proteinPct >= 80) strengths.push('צריכת חלבון');
    if (fatPct >= 80) strengths.push('שומן בריא');
    if (waterPct >= 80) strengths.push('שתיית מים');
    if (caloriesPct >= 80 && caloriesPct <= 110) strengths.push('איזון קלורי');

    if (strengths.length > 0) {
      newInsights.push({
        id: 'strengths',
        title: 'נקודות חזקות',
        content: `מצוין ב: ${strengths.join(', ')}. המשך לשמור על הרמה!`,
        type: 'success',
      });
    }

    // Weaknesses
    const weaknesses = [];
    if (proteinPct < 50 && hour > 14) weaknesses.push(`חלבון (${Math.round(targets.protein - (dailyStats?.protein || 0))}g חסר)`);
    if (fatPct < 40) weaknesses.push(`שומן (${Math.round(targets.fat - (dailyStats?.fat || 0))}g חסר)`);
    if (waterPct < 50 && hour > 12) weaknesses.push(`מים (${targets.water - (dailyStats?.water_glasses || 0)} כוסות חסרות)`);

    if (weaknesses.length > 0) {
      newInsights.push({
        id: 'weaknesses',
        title: 'דורש שיפור',
        content: weaknesses.join(' | '),
        type: 'warning',
      });
    }

    // Time-based tip
    if (hour >= 6 && hour < 10) {
      newInsights.push({
        id: 'tip',
        title: 'טיפ לבוקר',
        content: 'ארוחת בוקר עשירה בחלבון תעזור לך להרגיש שבע יותר זמן. ביצים + לחם מלא = שילוב מנצח!',
        type: 'tip',
      });
    } else if (hour >= 14 && hour < 17) {
      newInsights.push({
        id: 'tip',
        title: 'טיפ לאחר הצהריים',
        content: 'השעות האלה קריטיות - חופן אגוזים או פרי עדיפים על חטיפים מתוקים!',
        type: 'tip',
      });
    } else if (hour >= 20) {
      newInsights.push({
        id: 'tip',
        title: 'טיפ לערב',
        content: 'נסה לסיים לאכול 2-3 שעות לפני השינה לעיכול טוב יותר.',
        type: 'tip',
      });
    }

    setInsights(newInsights);
    setIsLoading(false);
    setIsRefreshing(false);
  }, [dailyStats, targets]);

  // Generate detailed AI report (Gemini via proxy)
  const generateDetailedReport = async () => {
    setIsGenerating(true);

    const startDate = moment().subtract(LOOKBACK_DAYS, 'days').format('YYYY-MM-DD');
    let behaviorNarrative = '';
    if (user?.id) {
      const [hRes, mRes, wRes, weightRes] = await Promise.all([
        getDailyStatsHistory(user.id, LOOKBACK_DAYS + 7),
        getMealsSince(user.id, startDate),
        getWaterLogsSince(user.id, startDate),
        getWeightLogsSince(user.id, startDate),
      ]);
      behaviorNarrative = buildAiBehaviorNarrative({
        profile,
        dailyStatsHistory: hRes.data || [],
        meals: mRes.data || [],
        waterLogs: wRes.data || [],
        weightLogs: weightRes.data || [],
        lookbackDays: LOOKBACK_DAYS,
      });
    }

    try {
      const aiResult = await analyzeNutritionWithO1(dailyStats, targets, profile, {
        behaviorNarrative,
      });

      if (!aiResult.success) {
        throw new Error('AI analysis failed');
      }

      const caloriesPct = Math.round(((dailyStats?.calories || 0) / targets.calories) * 100);
      const proteinPct = Math.round(((dailyStats?.protein || 0) / targets.protein) * 100);
      const fatPct = Math.round(((dailyStats?.fat || 0) / targets.fat) * 100);
      const waterPct = Math.round(((dailyStats?.water_glasses || 0) / targets.water) * 100);
      const carbPct = Math.round(
        ((dailyStats?.carbs || 0) / (targets.carbs || 250)) * 100
      );

      const report = {
        timestamp: aiResult.timestamp,
        overallScore: aiResult.overallScore,
        status: aiResult.status,
        recommendation: aiResult.recommendation,
        model: aiResult.model, // e.g. gemini-2.5-flash or 'fallback'
        mainInsight: aiResult.mainInsight,
        motivationalMessage: aiResult.motivationalMessage,
        sections: [
          {
            title: 'סיכום יומי',
            icon: '•',
            items: [
              `ציון כללי: ${aiResult.overallScore}%`,
              `קלוריות: ${dailyStats?.calories || 0}/${targets.calories} (${caloriesPct}%)`,
              `חלבון: ${Math.round(dailyStats?.protein || 0)}g/${targets.protein}g (${proteinPct}%)`,
              `שומן: ${Math.round(dailyStats?.fat || 0)}g/${targets.fat}g (${fatPct}%)`,
              `פחמימות: ${Math.round(dailyStats?.carbs || 0)}g/${targets.carbs}g (${carbPct}%)`,
              `מים: ${dailyStats?.water_glasses || 0}/${targets.water} כוסות (${waterPct}%)`,
            ],
          },
          {
            title: 'תובנה עיקרית',
            icon: '•',
            items: [aiResult.mainInsight],
          },
          {
            title: 'נקודות חזקות',
            icon: '•',
            items: aiResult.strengths?.length > 0
              ? aiResult.strengths
              : ['ממשיך לעקוב - הנתונים יתעדכנו'],
          },
          {
            title: 'תחומים לשיפור',
            icon: '•',
            items: aiResult.improvements?.length > 0
              ? aiResult.improvements
              : ['אין הערות מיוחדות - המשך כך!'],
          },
          {
            title: 'פעולות מומלצות',
            icon: '•',
            items: aiResult.actionItems?.length > 0
              ? aiResult.actionItems
              : ['המשך לתעד את הארוחות שלך'],
          },
          {
            title: 'טיפ אישי',
            icon: '•',
            items: [aiResult.personalizedTip],
          },
        ],
      };

      setDetailedReport(report);
    } catch (error) {
      console.error('Report generation error:', error);
      // Fallback to basic report on error
      const caloriesPct = Math.round(((dailyStats?.calories || 0) / targets.calories) * 100);
      const overallScore = Math.round((Math.min(100, caloriesPct)) / 1);

      setDetailedReport({
        timestamp: new Date().toISOString(),
        overallScore,
        status: 'שגיאה בניתוח',
        recommendation: 'נסה שוב',
        model: 'error',
        sections: [
          {
            title: 'שגיאה',
            icon: '—',
            items: ['אירעה שגיאה בניתוח. נסה שוב מאוחר יותר.'],
          },
        ],
      });
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    generateInsights();
  }, [generateInsights]);

  const onRefresh = () => {
    setIsRefreshing(true);
    setDetailedReport(null);
    generateInsights();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="חזרה"
        >
          <Text style={styles.backIcon}>→</Text>
        </TouchableOpacity>
        <View pointerEvents="none" style={styles.headerCenter}>
          <Text style={styles.headerTitle}>ניתוח AI</Text>
          <Text style={styles.headerSubtitle}>{moment().format('DD/MM/YYYY · HH:mm')}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={BRAND} />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={BRAND} />
            <Text style={styles.loadingText}>מנתח את הנתונים שלך...</Text>
          </View>
        ) : (
          <>
            {/* Stats Summary */}
            <StatsSummary dailyStats={dailyStats} targets={targets} />
            <SourceCitation variant="compact" palette={CITE_PALETTE} />

            <TouchableOpacity
              style={styles.generateButtonWrap}
              onPress={generateDetailedReport}
              disabled={isGenerating}
              activeOpacity={0.85}
            >
              {isGenerating ? (
                <View style={[styles.generateButton, styles.generateButtonLoading]}>
                  <View style={styles.generatingContent}>
                    <BouncingDots dark />
                    <Text style={styles.generateButtonTextMuted}>מנתח…</Text>
                    <Text style={styles.generatingSubtextMuted}>מוסיף הקשר מההיסטוריה במסד</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.generateButton}>
                  <Text style={styles.generateButtonLabelLight}>דוח מפורט</Text>
                  <Text style={styles.generateButtonHint}>היסטוריית מסד · דפוסי שעות</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Detailed Report */}
            {detailedReport && (
              <View style={styles.reportContainer}>
                <View style={styles.reportHeader}>
                  <Text style={styles.reportTitle}>
                    דוח
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      detailedReport.recommendation === 'שמירה'
                        ? styles.statusBadgeSolid
                        : styles.statusBadgeOutline,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        detailedReport.recommendation === 'שמירה'
                          ? styles.statusTextOnBrand
                          : styles.statusTextBrand,
                      ]}
                    >
                      {detailedReport.recommendation === 'שמירה' ? 'שמירה' : 'שיפור'}
                    </Text>
                  </View>
                </View>

                {detailedReport.model &&
                  detailedReport.model !== 'fallback' &&
                  (String(detailedReport.model).includes('gemini') ||
                    detailedReport.model === 'gpt-4o' ||
                    detailedReport.model === 'o1') && (
                  <View style={styles.modelBadge}>
                    <Text style={styles.modelBadgeText}>
                      {String(detailedReport.model).includes('gemini')
                        ? 'Gemini'
                        : detailedReport.model || 'LLM'}
                    </Text>
                  </View>
                )}

                {/* Motivational Message */}
                {detailedReport.motivationalMessage && (
                  <View style={styles.motivationalBox}>
                    <Text style={styles.motivationalText}>{detailedReport.motivationalMessage}</Text>
                  </View>
                )}

                {detailedReport.sections.map((section, index) => (
                  <View key={index} style={styles.reportSection}>
                    <Text style={styles.reportSectionTitle}>{section.title}</Text>
                    {section.items.map((item, idx) => (
                      <View key={idx} style={styles.reportItem}>
                        <Text style={styles.reportBullet}>·</Text>
                        <Text style={styles.reportItemText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                ))}

                <Text style={styles.reportTimestamp}>
                  {moment(detailedReport.timestamp).format('DD/MM/YYYY · HH:mm')}
                </Text>
                <SourceCitation variant="ai" showDisclaimer palette={CITE_PALETTE} />
              </View>
            )}

            {/* Section Title */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>תובנות</Text>
              <Text style={styles.sectionSubtitle}>היום · נתונים מקומיים</Text>
            </View>

            {/* Insights Cards */}
            {insights.map((insight, index) => (
              <InsightCard
                key={insight.id}
                title={insight.title}
                content={insight.content}
                delay={index * 100}
              />
            ))}

            {/* Footer Info */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                הערכת מצב יומית 21:30
              </Text>
              <SourceCitation variant="full" showDisclaimer palette={CITE_PALETTE} />
            </View>
          </>
        )}
      </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BRAND_TINT,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(50, 167, 40, 0.35)',
  },
  backIcon: {
    fontSize: 16,
    color: BRAND,
    fontWeight: '600',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginTop: 3,
  },
  headerSpacer: {
    width: 36,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 36,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: TEXT_MUTED,
  },
  summaryCard: {
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(50, 167, 40, 0.2)',
    backgroundColor: '#FFFFFF',
  },
  summaryInner: {
    padding: 18,
    backgroundColor: '#FFFFFF',
  },
  scoreCircle: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: BRAND_LIGHT,
    borderWidth: 2,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  scoreCircleInner: {
    flex: 1,
    width: '100%',
    borderRadius: 38,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreNumber: {
    fontSize: 21,
    fontWeight: '700',
  },
  scoreLabel: {
    fontSize: 10,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    paddingHorizontal: 0,
  },
  statItem: {
    alignItems: 'center',
    width: '18%',
    minWidth: 48,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  statValueGood: {
    color: BRAND,
  },
  statLabel: {
    fontSize: 10,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  generateButtonWrap: {
    marginBottom: 16,
    borderRadius: 10,
    overflow: 'hidden',
  },
  generateButton: {
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND,
  },
  generateButtonLoading: {
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(50, 167, 40, 0.35)',
  },
  generateButtonLabelLight: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  generateButtonHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  generateButtonTextMuted: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  generatingContent: {
    alignItems: 'center',
    gap: 6,
  },
  generatingSubtextMuted: {
    fontSize: 11,
    color: TEXT_MUTED,
    textAlign: 'center',
  },
  reportContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(50, 167, 40, 0.2)',
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BRAND_TINT,
  },
  reportTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeSolid: {
    backgroundColor: BRAND,
  },
  statusBadgeOutline: {
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusTextOnBrand: {
    color: '#FFFFFF',
  },
  statusTextBrand: {
    color: BRAND,
  },
  reportSection: {
    marginBottom: 12,
  },
  reportSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: BRAND,
    marginBottom: 8,
    textAlign: 'right',
  },
  reportItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    paddingRight: 2,
  },
  reportBullet: {
    fontSize: 14,
    color: BRAND,
    marginLeft: 8,
    marginTop: 0,
    fontWeight: '700',
  },
  reportItemText: {
    fontSize: 13,
    color: TEXT_PRIMARY,
    flex: 1,
    textAlign: 'right',
    lineHeight: 20,
    opacity: 0.92,
  },
  reportTimestamp: {
    fontSize: 10,
    color: TEXT_MUTED,
    textAlign: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BRAND_TINT,
  },
  modelBadge: {
    alignSelf: 'flex-end',
    backgroundColor: BRAND_LIGHT,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 10,
  },
  modelBadgeText: {
    fontSize: 10,
    color: BRAND,
    fontWeight: '600',
  },
  motivationalBox: {
    backgroundColor: BRAND_LIGHT,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(50, 167, 40, 0.15)',
  },
  motivationalText: {
    fontSize: 13,
    color: TEXT_PRIMARY,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionHeader: {
    marginBottom: 14,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    textAlign: 'right',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: TEXT_MUTED,
    textAlign: 'right',
    marginTop: 4,
  },
  insightCard: {
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderRightWidth: 3,
    borderRightColor: BRAND,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_TINT,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: BRAND,
    textAlign: 'right',
    marginBottom: 6,
  },
  cardContent: {
    fontSize: 13,
    lineHeight: 20,
    color: TEXT_PRIMARY,
    textAlign: 'right',
    opacity: 0.9,
  },
  footer: {
    marginTop: 8,
    paddingVertical: 16,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    color: TEXT_MUTED,
    marginBottom: 4,
  },
});
