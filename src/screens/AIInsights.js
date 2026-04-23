import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
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
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { analyzeNutritionWithO1 } from '../api/openaiClient';
import moment from 'moment';
import 'moment/locale/he';

moment.locale('he');

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 90,
  mass: 0.8,
};

// Bouncing Dots Animation Component
const BouncingDots = () => {
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

  return (
    <View style={dotsStyles.container}>
      <Animated.View style={[dotsStyles.dot, dot1Style]} />
      <Animated.View style={[dotsStyles.dot, dot2Style]} />
      <Animated.View style={[dotsStyles.dot, dot3Style]} />
    </View>
  );
};

const dotsStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
});

// Insight Card Component
const InsightCard = ({ title, icon, content, type, delay }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withSpring(1, SPRING_CONFIG));
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolate.CLAMP),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [30, 0], Extrapolate.CLAMP) },
      { scale: interpolate(progress.value, [0, 1], [0.95, 1], Extrapolate.CLAMP) },
    ],
  }));

  const getColors = () => {
    switch (type) {
      case 'success': return { border: '#22C55E', bg: '#F0FDF4' };
      case 'warning': return { border: '#F59E0B', bg: '#FFFBEB' };
      case 'danger': return { border: '#EF4444', bg: '#FEF2F2' };
      case 'info': return { border: '#3B82F6', bg: '#EFF6FF' };
      case 'tip': return { border: '#8B5CF6', bg: '#F5F3FF' };
      default: return { border: '#E5E7EB', bg: '#FFFFFF' };
    }
  };

  const colors = getColors();

  return (
    <Animated.View style={[styles.insightCard, cardStyle, { borderLeftColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={[styles.iconBadge, { backgroundColor: colors.bg }]}>
          <Text style={styles.cardIcon}>{icon}</Text>
        </View>
      </View>
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

  const overallScore = Math.round((Math.min(100, caloriesPct) + Math.min(100, proteinPct) + Math.min(100, fatPct) + Math.min(100, waterPct)) / 4);

  const getScoreColor = () => {
    if (overallScore >= 80) return '#22C55E';
    if (overallScore >= 60) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <Animated.View style={[styles.summaryCard, cardStyle]}>
      <View style={[styles.scoreCircle, { borderColor: getScoreColor() }]}>
        <Text style={[styles.scoreNumber, { color: getScoreColor() }]}>{Math.min(100, overallScore)}%</Text>
        <Text style={styles.scoreLabel}>ציון יומי</Text>
      </View>
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statEmoji}>🔥</Text>
          <Text style={[styles.statValue, caloriesPct >= 90 && caloriesPct <= 110 && styles.statValueGood]}>{caloriesPct}%</Text>
          <Text style={styles.statLabel}>קלוריות</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statEmoji}>💪</Text>
          <Text style={[styles.statValue, proteinPct >= 100 && styles.statValueGood]}>{proteinPct}%</Text>
          <Text style={styles.statLabel}>חלבון</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statEmoji}>🥑</Text>
          <Text style={[styles.statValue, fatPct >= 100 && styles.statValueGood]}>{fatPct}%</Text>
          <Text style={styles.statLabel}>שומן</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statEmoji}>💧</Text>
          <Text style={[styles.statValue, waterPct >= 100 && styles.statValueGood]}>{waterPct}%</Text>
          <Text style={styles.statLabel}>מים</Text>
        </View>
      </View>
    </Animated.View>
  );
};

export default function AIInsights() {
  const navigation = useNavigation();
  const { profile, dailyStats, meals } = useApp();
  const [insights, setInsights] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [detailedReport, setDetailedReport] = useState(null);

  // Button animation
  const buttonPulse = useSharedValue(1);

  useEffect(() => {
    buttonPulse.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonPulse.value }],
  }));

  // Use useMemo to prevent recreating targets on every render
  const targets = useMemo(() => ({
    calories: profile?.calories_target || 2000,
    protein: profile?.protein_target || 90,
    fat: profile?.fat_target || 65,
    water: profile?.water_target || 8,
  }), [profile?.calories_target, profile?.protein_target, profile?.fat_target, profile?.water_target]);

  const generateInsights = useCallback(() => {
    const caloriesPct = Math.round(((dailyStats?.calories || 0) / targets.calories) * 100);
    const proteinPct = Math.round(((dailyStats?.protein || 0) / targets.protein) * 100);
    const fatPct = Math.round(((dailyStats?.fat || 0) / targets.fat) * 100);
    const waterPct = Math.round(((dailyStats?.water_glasses || 0) / targets.water) * 100);

    const hour = new Date().getHours();
    const newInsights = [];

    // Overall status
    const overallScore = (Math.min(100, caloriesPct) + Math.min(100, proteinPct) + Math.min(100, fatPct) + Math.min(100, waterPct)) / 4;

    if (overallScore >= 80) {
      newInsights.push({
        id: 'overall',
        title: 'הערכת מצב כללית',
        icon: '🏆',
        content: `יום מצוין! הגעת ל-${Math.round(overallScore)}% מהיעדים. ממשיכים כך!`,
        type: 'success',
      });
    } else if (overallScore >= 50) {
      newInsights.push({
        id: 'overall',
        title: 'הערכת מצב כללית',
        icon: '📊',
        content: `אתה על ${Math.round(overallScore)}% מהיעדים. עוד קצת מאמץ ומגיעים ליעד!`,
        type: 'info',
      });
    } else {
      newInsights.push({
        id: 'overall',
        title: 'הערכת מצב כללית',
        icon: '💪',
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
        title: '💚 נקודות חזקות',
        icon: '✨',
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
        title: '⚠️ דורש שיפור',
        icon: '📉',
        content: weaknesses.join(' | '),
        type: 'warning',
      });
    }

    // Time-based tip
    if (hour >= 6 && hour < 10) {
      newInsights.push({
        id: 'tip',
        title: '💡 טיפ לבוקר',
        icon: '🌅',
        content: 'ארוחת בוקר עשירה בחלבון תעזור לך להרגיש שבע יותר זמן. ביצים + לחם מלא = שילוב מנצח!',
        type: 'tip',
      });
    } else if (hour >= 14 && hour < 17) {
      newInsights.push({
        id: 'tip',
        title: '💡 טיפ לאחה"צ',
        icon: '☀️',
        content: 'השעות האלה קריטיות - חופן אגוזים או פרי עדיפים על חטיפים מתוקים!',
        type: 'tip',
      });
    } else if (hour >= 20) {
      newInsights.push({
        id: 'tip',
        title: '💡 טיפ לערב',
        icon: '🌙',
        content: 'נסה לסיים לאכול 2-3 שעות לפני השינה לעיכול טוב יותר.',
        type: 'tip',
      });
    }

    setInsights(newInsights);
    setIsLoading(false);
    setIsRefreshing(false);
  }, [dailyStats, targets]);

  // Generate detailed AI report using o1
  const generateDetailedReport = async () => {
    setIsGenerating(true);

    try {
      // Call o1 for advanced analysis
      const aiResult = await analyzeNutritionWithO1(dailyStats, targets, profile);

      if (!aiResult.success) {
        throw new Error('AI analysis failed');
      }

      const caloriesPct = Math.round(((dailyStats?.calories || 0) / targets.calories) * 100);
      const proteinPct = Math.round(((dailyStats?.protein || 0) / targets.protein) * 100);
      const fatPct = Math.round(((dailyStats?.fat || 0) / targets.fat) * 100);
      const waterPct = Math.round(((dailyStats?.water_glasses || 0) / targets.water) * 100);

      const report = {
        timestamp: aiResult.timestamp,
        overallScore: aiResult.overallScore,
        status: aiResult.status,
        recommendation: aiResult.recommendation,
        model: aiResult.model, // 'o1' or 'fallback'
        mainInsight: aiResult.mainInsight,
        motivationalMessage: aiResult.motivationalMessage,
        sections: [
          {
            title: '📊 סיכום יומי',
            icon: '📈',
            items: [
              `ציון כללי: ${aiResult.overallScore}%`,
              `קלוריות: ${dailyStats?.calories || 0}/${targets.calories} (${caloriesPct}%)`,
              `חלבון: ${Math.round(dailyStats?.protein || 0)}g/${targets.protein}g (${proteinPct}%)`,
              `שומן: ${Math.round(dailyStats?.fat || 0)}g/${targets.fat}g (${fatPct}%)`,
              `מים: ${dailyStats?.water_glasses || 0}/${targets.water} כוסות (${waterPct}%)`,
            ],
          },
          {
            title: '🧠 תובנה עיקרית',
            icon: '💡',
            items: [aiResult.mainInsight],
          },
          {
            title: '💪 נקודות חזקות',
            icon: '✅',
            items: aiResult.strengths?.length > 0
              ? aiResult.strengths
              : ['ממשיך לעקוב - הנתונים יתעדכנו'],
          },
          {
            title: '🎯 תחומים לשיפור',
            icon: '📉',
            items: aiResult.improvements?.length > 0
              ? aiResult.improvements
              : ['אין הערות מיוחדות - המשך כך!'],
          },
          {
            title: '📋 פעולות מומלצות',
            icon: '🚀',
            items: aiResult.actionItems?.length > 0
              ? aiResult.actionItems
              : ['המשך לתעד את הארוחות שלך'],
          },
          {
            title: '💡 טיפ אישי',
            icon: '🎯',
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
            title: '⚠️ שגיאה',
            icon: '❌',
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
          <Text style={styles.headerTitle}>🧠 AI ניתוח</Text>
          <Text style={styles.headerSubtitle}>{moment().format('DD/MM/YYYY • HH:mm')}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#16A34A" />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#16A34A" />
            <Text style={styles.loadingText}>מנתח את הנתונים שלך...</Text>
          </View>
        ) : (
          <>
            {/* Stats Summary */}
            <StatsSummary dailyStats={dailyStats} targets={targets} />

            {/* Generate Report Button */}
            <Animated.View style={buttonStyle}>
              <TouchableOpacity
                style={styles.generateButton}
                onPress={generateDetailedReport}
                disabled={isGenerating}
              >
                <LinearGradient
                  colors={isGenerating ? ['#6366F1', '#4F46E5'] : ['#16A34A', '#15803D']}
                  style={[
                    styles.generateButtonGradient,
                    isGenerating && styles.generateButtonGradientLoading
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {isGenerating ? (
                    <View style={styles.generatingContent}>
                      <BouncingDots />
                      <Text style={styles.generateButtonText}>מנתח את הנתונים...</Text>
                      <Text style={styles.generatingSubtext}>זה ניתוח מורכב, עשוי לקחת כמה שניות</Text>
                      <Text style={styles.generatingThanks}>תודה על ההמתנה! 🙏</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.generateButtonIcon}>🔍</Text>
                      <Text style={styles.generateButtonText}>צור דוח AI מפורט</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* Detailed Report */}
            {detailedReport && (
              <View style={styles.reportContainer}>
                <View style={styles.reportHeader}>
                  <Text style={styles.reportTitle}>
                    {(detailedReport.model === 'gpt-4o' || detailedReport.model === 'o1') ? '🧠 דוח AI מתקדם' : '📋 דוח AI מפורט'}
                  </Text>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: detailedReport.recommendation === 'שמירה' ? '#D1FAE5' : '#FEF3C7' }
                  ]}>
                    <Text style={[
                      styles.statusText,
                      { color: detailedReport.recommendation === 'שמירה' ? '#166534' : '#92400E' }
                    ]}>
                      {detailedReport.recommendation === 'שמירה' ? '✨ שמירה' : '📈 שיפור'}
                    </Text>
                  </View>
                </View>

                {/* Model indicator */}
                {(detailedReport.model === 'gpt-4o' || detailedReport.model === 'o1') && (
                  <View style={[
                    styles.modelBadge,
                    detailedReport.model === 'o1' && styles.modelBadgeO1
                  ]}>
                    <Text style={[
                      styles.modelBadgeText,
                      detailedReport.model === 'o1' && styles.modelBadgeTextO1
                    ]}>
                      {detailedReport.model === 'o1' ? '🧠 מנותח עם OpenAI o1 (חשיבה מתקדמת)' : '⚡ מנותח עם OpenAI gpt-4o'}
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
                        <Text style={styles.reportBullet}>•</Text>
                        <Text style={styles.reportItemText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                ))}

                <Text style={styles.reportTimestamp}>
                  {(detailedReport.model === 'gpt-4o' || detailedReport.model === 'o1') ? '🧠 ' : ''}נוצר ב: {moment(detailedReport.timestamp).format('DD/MM/YYYY HH:mm')}
                </Text>
              </View>
            )}

            {/* Section Title */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>תובנות מהירות</Text>
              <Text style={styles.sectionSubtitle}>מבוסס על הנתונים שלך</Text>
            </View>

            {/* Insights Cards */}
            {insights.map((insight, index) => (
              <InsightCard
                key={insight.id}
                title={insight.title}
                icon={insight.icon}
                content={insight.content}
                type={insight.type}
                delay={index * 100}
              />
            ))}

            {/* Footer Info */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                🕘 הערכת מצב יומית אוטומטית ב-21:30
              </Text>
            </View>
          </>
        )}
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
    color: '#16A34A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  headerSpacer: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#64748B',
  },
  // Summary Card
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  scoreCircle: {
    alignSelf: 'center',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F0FDF4',
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  scoreNumber: {
    fontSize: 28,
    fontWeight: '800',
  },
  scoreLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  statValueGood: {
    color: '#22C55E',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  // Generate Button
  generateButton: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  generateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 10,
  },
  generateButtonGradientLoading: {
    paddingVertical: 20,
    flexDirection: 'column',
  },
  generateButtonIcon: {
    fontSize: 20,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  generatingContent: {
    alignItems: 'center',
    gap: 6,
  },
  generatingSubtext: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    textAlign: 'center',
  },
  generatingThanks: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
    marginTop: 2,
  },
  // Report
  reportContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#16A34A',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  reportSection: {
    marginBottom: 16,
  },
  reportSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'right',
  },
  reportItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    paddingRight: 4,
  },
  reportBullet: {
    fontSize: 14,
    color: '#16A34A',
    marginLeft: 8,
    fontWeight: '700',
  },
  reportItemText: {
    fontSize: 14,
    color: '#475569',
    flex: 1,
    textAlign: 'right',
    lineHeight: 20,
  },
  reportTimestamp: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modelBadge: {
    alignSelf: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  modelBadgeO1: {
    backgroundColor: '#FDF4FF',
    borderColor: '#E879F9',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modelBadgeText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '600',
  },
  modelBadgeTextO1: {
    color: '#A21CAF',
    fontWeight: '700',
  },
  motivationalBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  motivationalText: {
    fontSize: 15,
    color: '#166534',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },
  // Section
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'right',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'right',
    marginTop: 2,
  },
  // Insight Card
  insightCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'right',
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  cardIcon: {
    fontSize: 18,
  },
  cardContent: {
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
    textAlign: 'right',
  },
  // Footer
  footer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: '#64748B',
  },
});
