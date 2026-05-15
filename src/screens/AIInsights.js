// ============================================================
// AI Coach view — long-term memory aware.
// ============================================================
// Renders the AI-driven insights tab. Works as a full screen
// (backwards compat) or embedded under the unified Insights screen.
//
// Data lineage every report uses:
//   • today (live from AppContext)
//   • last 7 days   (daily_stats)
//   • last 30 days  (daily_stats + meals + water + weight)
//   • known facts   (ai_pattern_facts — long-term memory)
//   • recent reports + weekly feedback (ai_insight_reports + ai_weekly_checkins)
//
// The report (overall + per-day conclusion + memory updates) is cached
// once per (user, date, type) so re-opening the tab doesn't burn LLM quota.

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import {
  getDailyStatsHistory,
  getMealsSince,
  getWaterLogsSince,
  getWeightLogsSince,
} from '../api/supabaseClient';
import {
  saveInsightReport,
  getLatestInsightReport,
  getRecentInsightReports,
  upsertPatternFactsBulk,
  getPatternFacts,
  getLatestWeeklyCheckin,
  getWeeklyCheckinsHistory,
} from '../api/insightsRepository';
import { analyzeInsights } from '../utils/insightsAnalyzer';
import { generateInsightsReport } from '../api/insightsAi';
import SourceCitation from '../components/SourceCitation';
import moment from 'moment';
import 'moment/locale/he';

const LOOKBACK_DAYS = 30;

moment.locale('he');

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

// ---------------- Bouncing dots loader ----------------

const BouncingDots = ({ dark }) => {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    dot1.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 300, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 300, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      false,
    );
    dot2.value = withDelay(
      150,
      withRepeat(
        withSequence(
          withTiming(-8, { duration: 300, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 300, easing: Easing.in(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
    dot3.value = withDelay(
      300,
      withRepeat(
        withSequence(
          withTiming(-8, { duration: 300, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 300, easing: Easing.in(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
    return () => {
      cancelAnimation(dot1);
      cancelAnimation(dot2);
      cancelAnimation(dot3);
    };
  }, []);

  const dot1Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot1.value }] }));
  const dot2Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot2.value }] }));
  const dot3Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot3.value }] }));

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

// ---------------- Insight card ----------------

const InsightCard = ({ title, content, delay = 0, tone }) => {
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

  const borderColor =
    tone === 'positive' ? BRAND : tone === 'warning' ? '#F59E0B' : '#94A3B8';

  return (
    <Animated.View style={[styles.insightCard, { borderRightColor: borderColor }, cardStyle]}>
      <Text style={[styles.cardTitle, { color: borderColor }]}>{title}</Text>
      <Text style={styles.cardContent}>{content}</Text>
    </Animated.View>
  );
};

// ---------------- Stats hero ----------------

const StatsSummary = ({ baseline, scores }) => {
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

  const todayScore = scores?.today ?? 0;
  const weekScore = scores?.week ?? 0;
  const monthScore = scores?.month ?? 0;

  return (
    <Animated.View style={[styles.summaryCard, cardStyle]}>
      <View style={styles.summaryInner}>
        <View style={[styles.scoreCircle, { borderColor: BRAND }]}>
          <View style={styles.scoreCircleInner}>
            <Text style={[styles.scoreNumber, { color: BRAND }]}>{Math.min(100, todayScore)}%</Text>
            <Text style={styles.scoreLabel}>היום</Text>
          </View>
        </View>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{weekScore}%</Text>
            <Text style={styles.statLabel}>שבוע</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{monthScore}%</Text>
            <Text style={styles.statLabel}>חודש</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{baseline?.week?.days_hit_goal ?? 0}</Text>
            <Text style={styles.statLabel}>ימים ביעד</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{baseline?.month?.days ?? 0}</Text>
            <Text style={styles.statLabel}>ימי מידע</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

// ---------------- Fact pill (long-term memory) ----------------

const FactPill = ({ fact }) => {
  const color =
    fact.severity === 'positive'
      ? BRAND
      : fact.severity === 'warning'
        ? '#F59E0B'
        : '#475569';
  return (
    <View style={[styles.factPill, { borderColor: color }]}>
      <Text style={[styles.factTitle, { color }]} numberOfLines={2}>
        {fact.title}
      </Text>
      {fact.description ? (
        <Text style={styles.factDesc} numberOfLines={3}>
          {fact.description}
        </Text>
      ) : null}
      <Text style={styles.factMeta}>
        {fact.seen_count > 1 ? `נראה ${fact.seen_count}× • ` : ''}
        {fact.last_seen ? `עד ${moment(fact.last_seen).format('DD/MM')}` : ''}
      </Text>
    </View>
  );
};

// ============================================================
// Main component
// ============================================================

export default function AIInsights({ embedded = false }) {
  const navigation = useNavigation();
  const { profile, dailyStats, user } = useApp();

  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [report, setReport] = useState(null);
  const [knownFacts, setKnownFacts] = useState([]);
  const dataLoadedRef = useRef(false);

  const todayKey = useMemo(() => moment().format('YYYY-MM-DD'), []);

  const targets = useMemo(
    () => ({
      calories: profile?.calories_target || 2000,
      protein: profile?.protein_target || 90,
      fat: profile?.fat_target || 65,
      carbs: profile?.carbs_target || 250,
      water: profile?.water_target || 8,
    }),
    [
      profile?.calories_target,
      profile?.protein_target,
      profile?.fat_target,
      profile?.carbs_target,
      profile?.water_target,
    ],
  );

  // Load history + facts + cached report on mount.
  const loadAll = useCallback(
    async (opts = { force: false }) => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const startDate = moment().subtract(LOOKBACK_DAYS, 'days').format('YYYY-MM-DD');
        const [hist, mealsRes, waterRes, weightRes, factsRes, cachedReportRes] = await Promise.all([
          getDailyStatsHistory(user.id, LOOKBACK_DAYS + 5),
          getMealsSince(user.id, startDate),
          getWaterLogsSince(user.id, startDate),
          getWeightLogsSince(user.id, startDate),
          getPatternFacts(user.id, 20),
          getLatestInsightReport(user.id, 'daily'),
        ]);

        const localAnalysis = analyzeInsights({
          profile,
          todayStats: dailyStats,
          dailyHistory: hist.data || [],
          meals: mealsRes.data || [],
          waterLogs: waterRes.data || [],
          weightLogs: weightRes.data || [],
          knownFacts: factsRes.data || [],
        });

        setAnalysis(localAnalysis);
        setKnownFacts(factsRes.data || []);

        if (
          !opts.force &&
          cachedReportRes.data &&
          cachedReportRes.data.report_date === todayKey
        ) {
          setReport(cachedReportFromRow(cachedReportRes.data));
        } else {
          setReport(null);
        }
      } catch (e) {
        if (__DEV__) console.log('[AIInsights] loadAll error:', e?.message || e);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [user?.id, profile, dailyStats, todayKey],
  );

  useEffect(() => {
    if (dataLoadedRef.current) return;
    dataLoadedRef.current = true;
    loadAll();
  }, [loadAll]);

  // Re-run analysis (without re-fetching) when the live `dailyStats` changes.
  useEffect(() => {
    if (!analysis || !user?.id) return;
    setAnalysis((prev) => {
      if (!prev) return prev;
      const next = analyzeInsights({
        profile,
        todayStats: dailyStats,
        dailyHistory: prev._raw?.dailyHistory || [],
        meals: prev._raw?.meals || [],
        waterLogs: prev._raw?.waterLogs || [],
        weightLogs: prev._raw?.weightLogs || [],
        knownFacts,
      });
      next._raw = prev._raw;
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyStats?.calories, dailyStats?.protein, dailyStats?.fat, dailyStats?.carbs, dailyStats?.water_glasses]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadAll({ force: true });
  };

  // Generate the deep AI report.
  const generateReport = async (force = false) => {
    if (!analysis) return;
    setIsGenerating(true);
    try {
      const [recentReportsRes, latestCheckinRes, allCheckins] = await Promise.all([
        getRecentInsightReports(user?.id, 6),
        getLatestWeeklyCheckin(user?.id),
        getWeeklyCheckinsHistory(user?.id, 4),
      ]);

      const result = await generateInsightsReport({
        profile,
        targets: analysis.targets,
        baseline: analysis.baseline,
        knownFacts,
        detectedFacts: analysis.facts,
        recentReports: recentReportsRes.data || [],
        weeklyCheckins: allCheckins.data || [],
        narrative: analysis.narrative,
        reportType: 'daily',
      });

      setReport(result);

      // Persist long-term memory: cache report + upsert facts.
      if (user?.id) {
        await saveInsightReport(user.id, {
          report_date: todayKey,
          report_type: 'daily',
          overall_score: result.overallScore ?? null,
          status: result.status ?? null,
          recommendation: result.recommendation ?? null,
          main_insight: result.mainInsight ?? null,
          today_conclusion: result.todayConclusion ?? null,
          strengths: result.strengths ?? [],
          improvements: result.improvements ?? [],
          action_items: result.actionItems ?? [],
          personalized_tip: result.personalizedTip ?? null,
          motivational_message: result.motivationalMessage ?? null,
          baseline: analysis.baseline,
          model: result.model ?? null,
        });

        const combinedFacts = [
          ...(analysis.facts || []),
          ...(Array.isArray(result.memoryUpdates) ? result.memoryUpdates : []),
        ];
        if (combinedFacts.length) {
          await upsertPatternFactsBulk(user.id, combinedFacts);
          // Refresh known facts after upsert (best-effort).
          const fresh = await getPatternFacts(user.id, 20);
          if (fresh?.data) setKnownFacts(fresh.data);
        }
      }
    } catch (e) {
      if (__DEV__) console.log('[AIInsights] generateReport error:', e?.message || e);
    } finally {
      setIsGenerating(false);
    }
  };

  // ---------------- Render ----------------

  const factsToShow = useMemo(() => {
    if (!knownFacts?.length) return [];
    return knownFacts.slice(0, 4);
  }, [knownFacts]);

  const reportSections = report ? buildReportSections(report, analysis) : [];

  const body = (
    <ScrollView
      style={[styles.content, embedded && styles.contentEmbedded]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={BRAND} />
      }
    >
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={BRAND} />
          <Text style={styles.loadingText}>קורא את כל ההיסטוריה שלך…</Text>
        </View>
      ) : !analysis ? null : (
        <>
          <StatsSummary baseline={analysis.baseline} scores={analysis.baseline?.scores} />
          <SourceCitation variant="compact" palette={CITE_PALETTE} />

          {/* Long-term memory */}
          {factsToShow.length > 0 && (
            <View style={styles.memoryWrap}>
              <View style={styles.memoryHeader}>
                <Text style={styles.memoryTitle}>הזיכרון של הכלי</Text>
                <Text style={styles.memorySub}>דפוסים שלמדנו עליך לאורך זמן</Text>
              </View>
              <View style={styles.factsRow}>
                {factsToShow.map((f) => (
                  <FactPill key={f.fact_key} fact={f} />
                ))}
              </View>
            </View>
          )}

          {/* Generate / refresh button */}
          <TouchableOpacity
            style={styles.generateButtonWrap}
            onPress={() => generateReport(true)}
            disabled={isGenerating}
            activeOpacity={0.85}
          >
            {isGenerating ? (
              <View style={[styles.generateButton, styles.generateButtonLoading]}>
                <View style={styles.generatingContent}>
                  <BouncingDots dark />
                  <Text style={styles.generateButtonTextMuted}>בונה דוח מדויק…</Text>
                  <Text style={styles.generatingSubtextMuted}>
                    מבוסס על היום + שבוע + 30 ימים + זיכרון
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.generateButton}>
                <Text style={styles.generateButtonLabelLight}>
                  {report ? 'רענן דוח' : 'בנה דוח מפורט'}
                </Text>
                <Text style={styles.generateButtonHint}>
                  היום · שבוע · חודש · זיכרון
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Report */}
          {report && (
            <View style={styles.reportContainer}>
              <View style={styles.reportHeader}>
                <Text style={styles.reportTitle}>הדוח שלך</Text>
                <View
                  style={[
                    styles.statusBadge,
                    report.recommendation === 'שמירה'
                      ? styles.statusBadgeSolid
                      : styles.statusBadgeOutline,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      report.recommendation === 'שמירה'
                        ? styles.statusTextOnBrand
                        : styles.statusTextBrand,
                    ]}
                  >
                    {report.recommendation || (report.overallScore >= 80 ? 'שמירה' : 'שיפור')}
                  </Text>
                </View>
              </View>

              {report.model && report.model !== 'fallback' && (
                <View style={styles.modelBadge}>
                  <Text style={styles.modelBadgeText}>
                    {String(report.model).includes('gemini') ? 'Gemini' : report.model}
                  </Text>
                </View>
              )}

              {report.todayConclusion ? (
                <View style={styles.conclusionBox}>
                  <Text style={styles.conclusionLabel}>מסקנה על היום</Text>
                  <Text style={styles.conclusionText}>{report.todayConclusion}</Text>
                </View>
              ) : null}

              {report.motivationalMessage ? (
                <View style={styles.motivationalBox}>
                  <Text style={styles.motivationalText}>{report.motivationalMessage}</Text>
                </View>
              ) : null}

              {reportSections.map((section, idx) => (
                <View key={idx} style={styles.reportSection}>
                  <Text style={styles.reportSectionTitle}>{section.title}</Text>
                  {section.items.map((item, i) => (
                    <View key={i} style={styles.reportItem}>
                      <Text style={styles.reportBullet}>·</Text>
                      <Text style={styles.reportItemText}>{item}</Text>
                    </View>
                  ))}
                </View>
              ))}

              <Text style={styles.reportTimestamp}>
                {moment(report.timestamp).format('DD/MM/YYYY · HH:mm')}
              </Text>
              <SourceCitation variant="ai" showDisclaimer palette={CITE_PALETTE} />
            </View>
          )}

          {/* Lightweight live insights — always available */}
          {!report && (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>תובנות מהירות</Text>
              <Text style={styles.sectionSubtitle}>נתונים מקומיים · ללא קריאה ל-AI</Text>
            </View>
          )}
          {!report &&
            buildLocalInsights(analysis).map((ins, idx) => (
              <InsightCard
                key={ins.id}
                title={ins.title}
                content={ins.content}
                delay={idx * 80}
                tone={ins.tone}
              />
            ))}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              מתבסס על {analysis.baseline?.month?.days ?? 0} ימי מידע · עדכון אחרון
              {' '}{report ? moment(report.timestamp).format('HH:mm') : 'כעת'}
            </Text>
            <SourceCitation variant="full" showDisclaimer palette={CITE_PALETTE} />
          </View>
        </>
      )}
    </ScrollView>
  );

  if (embedded) {
    return <View style={styles.embeddedRoot}>{body}</View>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
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
            <Text style={styles.headerTitle}>תובנות</Text>
            <Text style={styles.headerSubtitle}>{moment().format('DD/MM/YYYY · HH:mm')}</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
        {body}
      </View>
    </SafeAreaView>
  );
}

// ============================================================
// Helpers
// ============================================================

function cachedReportFromRow(row) {
  return {
    overallScore: row.overall_score,
    status: row.status,
    recommendation: row.recommendation,
    mainInsight: row.main_insight,
    todayConclusion: row.today_conclusion,
    strengths: row.strengths || [],
    improvements: row.improvements || [],
    actionItems: row.action_items || [],
    personalizedTip: row.personalized_tip,
    motivationalMessage: row.motivational_message,
    baseline: row.baseline || {},
    model: row.model,
    timestamp: row.created_at,
  };
}

function buildReportSections(report, analysis) {
  const sections = [];
  if (report.mainInsight) {
    sections.push({ title: 'תובנה עיקרית', items: [report.mainInsight] });
  }
  if (analysis?.baseline) {
    const b = analysis.baseline;
    const t = b.targets || {};
    sections.push({
      title: 'מספרי השוואה',
      items: [
        `היום: ${Math.round(b.today.calories || 0)} קל׳ · ${Math.round(b.today.protein || 0)}g חלבון · ${Math.round(b.today.water || 0)} כוסות (ציון ${b.scores?.today ?? 0}%)`,
        b.week?.days
          ? `ממוצע שבוע: ${b.week.avg_calories} קל׳ · ${b.week.avg_protein}g חלבון · ${b.week.avg_water} כוסות (ציון ${b.scores?.week ?? 0}%)`
          : 'ממוצע שבוע: אין מספיק נתונים',
        b.month?.days
          ? `ממוצע 30 ימים: ${b.month.avg_calories} קל׳ · ${b.month.avg_protein}g חלבון · ${b.month.avg_water} כוסות (ציון ${b.scores?.month ?? 0}%)`
          : 'ממוצע 30 ימים: אין מספיק נתונים',
        `יעדים: ${t.calories || 0} קל׳ · ${t.protein || 0}g חלבון · ${t.water || 0} כוסות`,
      ],
    });
  }
  if (report.strengths?.length) {
    sections.push({ title: 'מה עובד טוב', items: report.strengths });
  }
  if (report.improvements?.length) {
    sections.push({ title: 'מה לתקן', items: report.improvements });
  }
  if (report.actionItems?.length) {
    sections.push({ title: 'פעולות לעכשיו', items: report.actionItems });
  }
  if (report.personalizedTip) {
    sections.push({ title: 'טיפ אישי', items: [report.personalizedTip] });
  }
  return sections;
}

function buildLocalInsights(analysis) {
  if (!analysis) return [];
  const out = [];
  const b = analysis.baseline || {};
  const today = b.today || {};
  const t = b.targets || {};

  if (b.scores) {
    out.push({
      id: 'today_score',
      title: 'מצב היום',
      content: `ציון היום ${b.scores.today}% — ממוצע שבועי ${b.scores.week}%, חודשי ${b.scores.month}%.`,
      tone: b.scores.today >= 80 ? 'positive' : b.scores.today >= 50 ? 'neutral' : 'warning',
    });
  }

  if (today.protein < t.protein * 0.5 && new Date().getHours() > 14) {
    out.push({
      id: 'protein_gap',
      title: 'חוסר חלבון אחה״צ',
      content: `נשארו ${Math.max(0, Math.round(t.protein - (today.protein || 0)))}g חלבון. בארוחה הקרובה תוסיף מקור חלבון.`,
      tone: 'warning',
    });
  }
  if (today.water < t.water * 0.5 && new Date().getHours() > 12) {
    out.push({
      id: 'water_gap',
      title: 'מים נמוכים מהממוצע',
      content: `${today.water || 0} מתוך ${t.water} כוסות עד כה. כוס עכשיו תעזור.`,
      tone: 'warning',
    });
  }
  if ((analysis.facts || []).length === 0 && b.month?.days >= 7) {
    out.push({
      id: 'steady',
      title: 'אין דפוסים מדאיגים',
      content: 'הנתונים שלך יציבים — לא זיהינו חריגות מהשבועות האחרונים.',
      tone: 'positive',
    });
  }
  if (out.length === 0) {
    out.push({
      id: 'start',
      title: 'מתחילים',
      content: 'תעד עוד ארוחות ותראה כאן תובנות חיות לפי הנתונים שלך.',
      tone: 'neutral',
    });
  }
  return out;
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  embeddedRoot: { flex: 1, backgroundColor: '#FFFFFF' },
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
  headerCenter: { alignItems: 'center' },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    letterSpacing: 0.2,
  },
  headerSubtitle: { fontSize: 11, color: TEXT_MUTED, marginTop: 3 },
  headerSpacer: { width: 36 },

  content: { flex: 1 },
  contentEmbedded: { paddingTop: 4 },
  contentContainer: { padding: 16, paddingBottom: 36 },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: { marginTop: 12, fontSize: 13, color: TEXT_MUTED },

  summaryCard: {
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(50, 167, 40, 0.2)',
    backgroundColor: '#FFFFFF',
  },
  summaryInner: { padding: 18, backgroundColor: '#FFFFFF' },
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
  scoreNumber: { fontSize: 21, fontWeight: '700' },
  scoreLabel: { fontSize: 10, color: TEXT_MUTED, marginTop: 2 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    paddingHorizontal: 0,
  },
  statItem: {
    alignItems: 'center',
    width: '22%',
    minWidth: 56,
  },
  statValue: { fontSize: 14, fontWeight: '600', color: TEXT_PRIMARY },
  statLabel: { fontSize: 10, color: TEXT_MUTED, marginTop: 2 },

  // Long-term memory section
  memoryWrap: {
    marginTop: 6,
    marginBottom: 14,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(50,167,40,0.15)',
  },
  memoryHeader: { marginBottom: 8 },
  memoryTitle: { fontSize: 13, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'right' },
  memorySub: { fontSize: 11, color: TEXT_MUTED, marginTop: 2, textAlign: 'right' },
  factsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  factPill: {
    minWidth: '47%',
    maxWidth: '100%',
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRightWidth: 3,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  factTitle: { fontSize: 12, fontWeight: '700', textAlign: 'right' },
  factDesc: { fontSize: 11, color: TEXT_PRIMARY, marginTop: 4, textAlign: 'right', lineHeight: 15, opacity: 0.85 },
  factMeta: { fontSize: 10, color: TEXT_MUTED, marginTop: 4, textAlign: 'right' },

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
  generateButtonLabelLight: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  generateButtonHint: { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  generateButtonTextMuted: { fontSize: 13, fontWeight: '600', color: TEXT_PRIMARY },
  generatingContent: { alignItems: 'center', gap: 6 },
  generatingSubtextMuted: { fontSize: 11, color: TEXT_MUTED, textAlign: 'center' },

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
  reportTitle: { fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusBadgeSolid: { backgroundColor: BRAND },
  statusBadgeOutline: {
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND,
  },
  statusText: { fontSize: 11, fontWeight: '600' },
  statusTextOnBrand: { color: '#FFFFFF' },
  statusTextBrand: { color: BRAND },

  conclusionBox: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  conclusionLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'right',
  },
  conclusionText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
    lineHeight: 19,
    textAlign: 'right',
    marginTop: 4,
  },

  reportSection: { marginBottom: 12 },
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
  reportBullet: { fontSize: 14, color: BRAND, marginLeft: 8, marginTop: 0, fontWeight: '700' },
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
  modelBadgeText: { fontSize: 10, color: BRAND, fontWeight: '600' },
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

  sectionHeader: { marginBottom: 14, marginTop: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY, textAlign: 'right' },
  sectionSubtitle: { fontSize: 12, color: TEXT_MUTED, textAlign: 'right', marginTop: 4 },

  insightCard: {
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderRightWidth: 3,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_TINT,
  },
  cardTitle: { fontSize: 13, fontWeight: '600', textAlign: 'right', marginBottom: 6 },
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
  footerText: { fontSize: 11, color: TEXT_MUTED, marginBottom: 4 },
});
