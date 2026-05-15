import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, G } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import moment from 'moment';
import { useApp } from '../context/AppContext';
import { getDailyStatsHistory } from '../api/supabaseClient';
import SourceCitation from '../components/SourceCitation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ---------------- Constants ----------------

const PERIODS = [
  { key: 'week', label: 'שבוע', days: 7 },
  { key: 'month', label: 'חודש', days: 30 },
  { key: 'quarter', label: '3 חודשים', days: 90 },
];

const DEFAULT_TARGETS = {
  calories: 2000,
  protein: 90,
  fat: 65,
  carbs: 250,
  water: 8,
};

const MACROS = [
  { key: 'calories', label: 'קלוריות', short: 'קלוריות', unit: '',  emoji: '🔥', color: '#F97316', soft: '#FFEDD5' },
  { key: 'protein',  label: 'חלבון',    short: 'חלבון',    unit: 'g', emoji: '💪', color: '#16A34A', soft: '#DCFCE7' },
  { key: 'carbs',    label: 'פחמימות',  short: 'פחמ׳',     unit: 'g', emoji: '🌾', color: '#6366F1', soft: '#E0E7FF' },
  { key: 'fat',      label: 'שומן',     short: 'שומן',     unit: 'g', emoji: '🥑', color: '#EAB308', soft: '#FEF9C3' },
  { key: 'water',    label: 'מים',      short: 'מים',      unit: '',  emoji: '💧', color: '#06B6D4', soft: '#CFFAFE' },
];

const HEB_DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const HEB_FULL = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HEB_MONTHS = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];

// ---------------- Helpers ----------------

const pctOf = (value, target) =>
  !target || target <= 0 ? 0 : Math.max(0, (Number(value) || 0) / Number(target) * 100);

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const cappedMean = (arr) =>
  arr.length === 0 ? 0 : arr.reduce((a, b) => a + Math.min(100, b), 0) / arr.length;

const overallScoreOf = (percents) =>
  Math.round(
    (Math.min(100, percents.calories) +
      Math.min(100, percents.protein) +
      Math.min(100, percents.fat) +
      Math.min(100, percents.carbs) +
      Math.min(100, percents.water)) / 5
  );

// ---------------- Screen / Embedded view ----------------
// When `embedded` is true, this component renders inline content only
// (no SafeAreaView, no header) so the parent Insights screen can host
// it under a shared tab header.

export default function Statistics({ embedded = false }) {
  const navigation = useNavigation();
  const { dailyStats, profile, user } = useApp();
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState('week');
  const [focusedMacro, setFocusedMacro] = useState('overall');
  const [selectedDay, setSelectedDay] = useState(null);

  const targets = useMemo(() => ({
    calories: Number(profile?.calories_target) || DEFAULT_TARGETS.calories,
    protein:  Number(profile?.protein_target)  || DEFAULT_TARGETS.protein,
    fat:      Number(profile?.fat_target)      || DEFAULT_TARGETS.fat,
    carbs:    Number(profile?.carbs_target)    || DEFAULT_TARGETS.carbs,
    water:    Number(profile?.water_target)    || DEFAULT_TARGETS.water,
  }), [profile]);

  const periodDef = PERIODS.find(p => p.key === period) || PERIODS[0];

  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoading(true);
      try {
        if (user?.id) {
          const { data } = await getDailyStatsHistory(user.id, 95);
          if (mounted) setHistory(data || []);
        } else if (mounted) {
          setHistory([]);
        }
      } catch (e) {
        if (mounted) setHistory([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [user?.id]);

  const todayKey = useMemo(() => moment().format('YYYY-MM-DD'), []);

  const historyByDate = useMemo(() => {
    const map = {};
    (history || []).forEach(h => {
      map[h.date] = {
        calories: Number(h.calories) || 0,
        protein:  Number(h.protein)  || 0,
        fat:      Number(h.fat)      || 0,
        carbs:    Number(h.carbs)    || 0,
        water:    Number(h.water)    || 0,
      };
    });
    map[todayKey] = {
      calories: Math.max(map[todayKey]?.calories || 0, Number(dailyStats?.calories) || 0),
      protein:  Math.max(map[todayKey]?.protein  || 0, Number(dailyStats?.protein)  || 0),
      fat:      Math.max(map[todayKey]?.fat      || 0, Number(dailyStats?.fat)      || 0),
      carbs:    Math.max(map[todayKey]?.carbs    || 0, Number(dailyStats?.carbs)    || 0),
      water:    Math.max(map[todayKey]?.water    || 0, Number(dailyStats?.water_glasses) || 0),
    };
    return map;
  }, [history, dailyStats, todayKey]);

  const lookbackDays = useMemo(() => {
    const arr = [];
    const today = moment();
    for (let i = 94; i >= 0; i--) {
      const d = moment(today).subtract(i, 'days');
      const key = d.format('YYYY-MM-DD');
      const stats = historyByDate[key] || { calories: 0, protein: 0, fat: 0, carbs: 0, water: 0 };
      const percents = {
        calories: pctOf(stats.calories, targets.calories),
        protein:  pctOf(stats.protein,  targets.protein),
        fat:      pctOf(stats.fat,      targets.fat),
        carbs:    pctOf(stats.carbs,    targets.carbs),
        water:    pctOf(stats.water,    targets.water),
      };
      const hasData = stats.calories > 0 || stats.protein > 0 || stats.fat > 0 || stats.carbs > 0 || stats.water > 0;
      arr.push({
        date: key,
        dayIdx: d.day(),
        dayLetter: HEB_DAYS[d.day()],
        dayFull: HEB_FULL[d.day()],
        dateLabel: `${d.date()}.${d.month() + 1}`,
        monthLabel: `${d.date()} ${HEB_MONTHS[d.month()]}`,
        stats,
        percents,
        overall: hasData ? overallScoreOf(percents) : 0,
        hasData,
        isToday: key === todayKey,
      });
    }
    return arr;
  }, [historyByDate, targets, todayKey]);

  const periodDays = useMemo(
    () => lookbackDays.slice(lookbackDays.length - periodDef.days),
    [lookbackDays, periodDef.days]
  );

  const streak = useMemo(() => {
    let count = 0;
    let i = lookbackDays.length - 1;
    if (i >= 0 && lookbackDays[i].isToday && !lookbackDays[i].hasData) i -= 1;
    for (; i >= 0; i -= 1) {
      if (lookbackDays[i].overall >= 80) count += 1;
      else break;
    }
    return count;
  }, [lookbackDays]);

  const summary = useMemo(() => {
    const recorded = periodDays.filter(d => d.hasData);
    const n = recorded.length;

    const sumValues = recorded.reduce((acc, d) => {
      acc.calories += d.stats.calories;
      acc.protein  += d.stats.protein;
      acc.fat      += d.stats.fat;
      acc.carbs    += d.stats.carbs;
      acc.water    += d.stats.water;
      acc.overall  += d.overall;
      return acc;
    }, { calories: 0, protein: 0, fat: 0, carbs: 0, water: 0, overall: 0 });

    const avgValues = n ? {
      calories: Math.round(sumValues.calories / n),
      protein:  Math.round((sumValues.protein  / n) * 10) / 10,
      fat:      Math.round((sumValues.fat      / n) * 10) / 10,
      carbs:    Math.round((sumValues.carbs    / n) * 10) / 10,
      water:    Math.round((sumValues.water    / n) * 10) / 10,
      overall:  Math.round(sumValues.overall   / n),
    } : { calories: 0, protein: 0, fat: 0, carbs: 0, water: 0, overall: 0 };

    const avgPctByMacro = {
      calories: Math.round(cappedMean(recorded.map(d => d.percents.calories))),
      protein:  Math.round(cappedMean(recorded.map(d => d.percents.protein))),
      fat:      Math.round(cappedMean(recorded.map(d => d.percents.fat))),
      carbs:    Math.round(cappedMean(recorded.map(d => d.percents.carbs))),
      water:    Math.round(cappedMean(recorded.map(d => d.percents.water))),
    };

    let best = null;
    let worst = null;
    recorded.forEach(d => {
      if (!best || d.overall > best.overall) best = d;
      if (!worst || d.overall < worst.overall) worst = d;
    });

    const daysHitGoal = recorded.filter(d => d.overall >= 80).length;

    return {
      avgValues,
      avgPctByMacro,
      best,
      worst,
      daysHitGoal,
      recordedDays: n,
      totalDays: periodDays.length,
    };
  }, [periodDays]);

  const todayDay = useMemo(
    () => lookbackDays.find(d => d.isToday) || null,
    [lookbackDays]
  );

  const handleSelectDay = useCallback((d) => {
    try { Haptics.selectionAsync(); } catch (_) {}
    setSelectedDay(prev => (prev?.date === d.date ? null : d));
  }, []);

  const handleSelectMacro = useCallback((key) => {
    try { Haptics.selectionAsync(); } catch (_) {}
    setFocusedMacro(prev => (prev === key ? 'overall' : key));
  }, []);

  const handlePeriod = useCallback((key) => {
    try { Haptics.selectionAsync(); } catch (_) {}
    setPeriod(key);
    setSelectedDay(null);
  }, []);

  const periodLabel = periodDef.label;
  const periodAvg = summary.avgValues.overall;
  const focusedMacroDef = MACROS.find(m => m.key === focusedMacro) || null;

  const body = (
    <ScrollView
      style={[styles.content, embedded && styles.contentEmbedded]}
      contentContainerStyle={{ paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.periodRow}>
        {PERIODS.map(p => {
          const active = p.key === period;
          return (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodPill, active && styles.periodPillActive]}
              onPress={() => handlePeriod(p.key)}
              activeOpacity={0.85}
            >
              <Text style={[styles.periodPillText, active && styles.periodPillTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <HeroScoreCard
        score={periodAvg}
        streak={streak}
        periodLabel={periodLabel}
        daysHit={summary.daysHitGoal}
        recorded={summary.recordedDays}
        totalDays={summary.totalDays}
      />

      <View style={styles.insightsRow}>
        <InsightChip
          emoji="🎯"
          value={`${summary.daysHitGoal}/${summary.totalDays}`}
          label="ימים ביעד"
        />
        <InsightChip
          emoji="⭐"
          value={summary.best ? `${summary.best.overall}%` : '—'}
          label={summary.best ? `שיא • ${summary.best.dateLabel}` : 'שיא היום עוד מחכה'}
        />
        <InsightChip
          emoji="📅"
          value={summary.recordedDays}
          label="ימים נרשמו"
        />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>פילוח יעדים</Text>
          <Text style={styles.cardCaption}>ממוצע ה{periodLabel}</Text>
        </View>
        <Text style={styles.cardHint}>הקש על קטגוריה לראות את המגמה שלה</Text>

        <View style={{ marginTop: 10, gap: 6 }}>
          {MACROS.map(m => {
            const avgPct = summary.avgPctByMacro[m.key];
            const avgVal = summary.avgValues[m.key];
            const target = targets[m.key];
            const focused = focusedMacro === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                style={[styles.macroRow, focused && { backgroundColor: m.soft }]}
                onPress={() => handleSelectMacro(m.key)}
                activeOpacity={0.85}
              >
                {focused && <View style={[styles.macroFocusBar, { backgroundColor: m.color }]} />}
                <Text style={styles.macroEmojiInline}>{m.emoji}</Text>
                <Text style={styles.macroLabel} numberOfLines={1}>{m.label}</Text>
                <Text style={styles.macroValue} numberOfLines={1}>
                  {avgVal}
                  <Text style={styles.macroTarget}>/{target}{m.unit}</Text>
                </Text>
                <View style={styles.macroBarTrack}>
                  <View style={[styles.macroBarFill, {
                    width: `${Math.min(100, avgPct)}%`,
                    backgroundColor: m.color,
                  }]} />
                  <View style={styles.macroBarGoal} />
                </View>
                <Text style={[styles.macroPct, { color: m.color }]}>{avgPct}%</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>
            {focusedMacroDef ? `מגמת ${focusedMacroDef.label}` : 'עמידה יומית ביעד'}
          </Text>
          {focusedMacroDef ? (
            <TouchableOpacity onPress={() => setFocusedMacro('overall')}>
              <Text style={styles.cardCaption}>הצג כללי ↺</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.cardCaption}>הקו הירוק = יעד 80%</Text>
          )}
        </View>

        <BarChart
          days={periodDays}
          focusedMacro={focusedMacro}
          onTapDay={handleSelectDay}
          selectedDate={selectedDay?.date}
        />

        {selectedDay ? (
          <DayDetail day={selectedDay} targets={targets} onClose={() => setSelectedDay(null)} />
        ) : (
          <Text style={styles.chartHint}>הקש על עמודה לפילוח של היום</Text>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>היום</Text>
          <Text style={[styles.cardCaption, { color: todayDay?.overall >= 80 ? '#16A34A' : '#9CA3AF' }]}>
            {todayDay ? `${todayDay.overall}% מהיעד` : '—'}
          </Text>
        </View>
        <View style={{ marginTop: 8, gap: 10 }}>
          {MACROS.map(m => {
            const value = todayDay?.stats?.[m.key] || 0;
            const target = targets[m.key];
            const pct = Math.min(100, pctOf(value, target));
            return (
              <View key={m.key} style={styles.todayRow}>
                <Text style={styles.todayEmoji}>{m.emoji}</Text>
                <Text style={styles.todayLabel}>{m.label}</Text>
                <Text style={styles.todayValue}>
                  {Math.round(value * 10) / 10}{m.unit}
                  <Text style={styles.todayTarget}>/{target}{m.unit}</Text>
                </Text>
                <View style={styles.todayBar}>
                  <View style={[styles.todayBarFill, {
                    width: `${pct}%`,
                    backgroundColor: pct >= 100 ? '#16A34A' : m.color,
                  }]} />
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {!isLoading && summary.recordedDays === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>🌱</Text>
          <Text style={styles.emptyTitle}>עוד אין מספיק נתונים</Text>
          <Text style={styles.emptyText}>
            הוסף ארוחות ומים כדי לראות פילוח, מגמות והישגים לאורך זמן.
          </Text>
        </View>
      )}

      {isLoading && (
        <View style={{ alignItems: 'center', marginVertical: 20 }}>
          <ActivityIndicator color="#16A34A" />
        </View>
      )}

      <SourceCitation variant="full" />
    </ScrollView>
  );

  if (embedded) {
    return <View style={styles.embedded}>{body}</View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>סטטיסטיקות ויעדים</Text>
        <View style={styles.placeholder} />
      </View>
      {body}
    </SafeAreaView>
  );
}

// ---------------- Sub-components ----------------

function HeroScoreCard({ score, streak, periodLabel, daysHit, recorded, totalDays }) {
  const message =
    score >= 90 ? 'מדהים! אתה ביעד באופן עקבי 🌟' :
    score >= 75 ? 'יופי, ממש קרוב לכל היעדים' :
    score >= 50 ? 'בדרך הנכונה — אפשר עוד טיפה' :
    recorded === 0 ? 'נתחיל לעקוב יחד היום' :
    'יש מקום לעלות — כל יום קטן נחשב';

  const size = 86;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeScore = clamp(score, 0, 100);
  const dashOffset = circumference * (1 - safeScore / 100);

  return (
    <LinearGradient
      colors={['#16A34A', '#15803D', '#166534']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View style={styles.heroLeft}>
        <Text style={styles.heroEyebrow}>ממוצע ה{periodLabel}</Text>
        <Text style={styles.heroScore}>{score}%</Text>
        <Text style={styles.heroSub}>
          {daysHit}/{totalDays} ימים ביעד
        </Text>
        <View style={styles.heroBadgeRow}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeEmoji}>🔥</Text>
            <Text style={styles.heroBadgeText}>{streak}</Text>
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeEmoji}>📈</Text>
            <Text style={styles.heroBadgeText}>{recorded} פעילים</Text>
          </View>
        </View>
        <Text style={styles.heroMessage} numberOfLines={2}>{message}</Text>
      </View>

      <View style={[styles.heroRingWrap, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth={stroke}
              fill="none"
            />
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#FFFFFF"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${circumference}, ${circumference}`}
              strokeDashoffset={dashOffset}
              fill="none"
            />
          </G>
        </Svg>
        <View style={styles.heroRingCenter}>
          <Text style={styles.heroRingEmoji}>🎯</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

function InsightChip({ emoji, value, label }) {
  return (
    <View style={styles.insightChip}>
      <Text style={styles.insightEmoji}>{emoji}</Text>
      <Text style={styles.insightValue}>{value}</Text>
      <Text style={styles.insightLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function BarChart({ days, focusedMacro, onTapDay, selectedDate }) {
  const CHART_HEIGHT = 130;
  const innerWidth = SCREEN_WIDTH - 60;
  const count = days.length;

  let gap;
  if (count <= 7) gap = 10;
  else if (count <= 14) gap = 5;
  else if (count <= 35) gap = 2;
  else gap = 1;
  const barWidth = Math.max(2, Math.floor((innerWidth - gap * (count - 1)) / count));

  const focusedColor = (() => {
    if (focusedMacro === 'overall') return null;
    return MACROS.find(m => m.key === focusedMacro)?.color || '#1A1F36';
  })();

  return (
    <View style={{ marginTop: 14 }}>
      <View style={{ position: 'relative', height: CHART_HEIGHT }}>
        {[25, 50, 75, 100].map(pct => (
          <View
            key={pct}
            style={[
              styles.gridLine,
              { bottom: (pct / 100) * CHART_HEIGHT - 1 },
            ]}
          >
            <Text style={styles.gridLabel}>{pct}%</Text>
          </View>
        ))}
        <View
          style={[
            styles.goalLine,
            { bottom: (80 / 100) * CHART_HEIGHT - 1 },
          ]}
        />

        <View style={[styles.barsRow, { gap, alignItems: 'flex-end', height: CHART_HEIGHT }]}>
          {days.map((d) => {
            const raw = focusedMacro === 'overall' ? d.overall : (d.percents[focusedMacro] || 0);
            const pct = Math.min(100, raw);
            const height = d.hasData ? Math.max(3, (pct / 100) * CHART_HEIGHT) : 4;
            const isSelected = selectedDate === d.date;
            const isHit = pct >= 80;
            const color = !d.hasData
              ? '#E5E7EB'
              : (focusedColor || (isHit ? '#16A34A' : '#1F2937'));
            return (
              <TouchableOpacity
                key={d.date}
                activeOpacity={0.75}
                onPress={() => onTapDay(d)}
                style={{ width: barWidth, height: CHART_HEIGHT, justifyContent: 'flex-end' }}
                hitSlop={{ top: 8, bottom: 8, left: 1, right: 1 }}
              >
                <View
                  style={{
                    width: '100%',
                    height,
                    backgroundColor: color,
                    borderTopLeftRadius: 3,
                    borderTopRightRadius: 3,
                    opacity: d.hasData ? 1 : 0.6,
                    borderWidth: isSelected ? 2 : 0,
                    borderColor: '#0F172A',
                  }}
                />
                {d.isToday && (
                  <View style={[styles.todayDot, { backgroundColor: focusedColor || '#16A34A' }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={[styles.barsRow, { gap, marginTop: 8 }]}>
        {days.map((d, i) => {
          let label = '';
          if (count <= 7) label = d.dayLetter;
          else if (count <= 14) label = i % 2 === 0 ? d.dateLabel : '';
          else if (count <= 35) {
            if (i === 0 || i === count - 1 || i % 5 === 0) label = d.dateLabel;
          } else {
            if (i === 0 || i === count - 1 || i % 14 === 0) label = d.dateLabel;
          }
          return (
            <View key={d.date} style={{ width: barWidth, alignItems: 'center' }}>
              <Text style={[styles.barLabel, d.isToday && { color: '#16A34A', fontWeight: '700' }]}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function DayDetail({ day, targets, onClose }) {
  return (
    <View style={styles.dayDetail}>
      <View style={styles.dayDetailHeader}>
        <View>
          <Text style={styles.dayDetailDate}>
            יום {day.dayFull} • {day.monthLabel}
          </Text>
          <Text style={styles.dayDetailScore}>
            {day.hasData ? `${day.overall}% מהיעד` : 'אין נתונים ליום זה'}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.dayDetailClose}>×</Text>
        </TouchableOpacity>
      </View>

      {day.hasData && (
        <View style={{ marginTop: 8, gap: 6 }}>
          {MACROS.map(m => {
            const pct = Math.round(Math.min(120, day.percents[m.key]));
            const val = day.stats[m.key];
            return (
              <View key={m.key} style={styles.dayMacroRow}>
                <Text style={styles.dayMacroEmoji}>{m.emoji}</Text>
                <Text style={styles.dayMacroLabel}>{m.label}</Text>
                <Text style={styles.dayMacroValue}>
                  {Math.round(val * 10) / 10}{m.unit}
                  <Text style={styles.dayMacroTarget}>/{targets[m.key]}{m.unit}</Text>
                </Text>
                <View style={styles.dayMacroBarTrack}>
                  <View style={[styles.dayMacroBarFill, {
                    width: `${Math.min(100, pct)}%`,
                    backgroundColor: m.color,
                  }]} />
                </View>
                <Text style={[styles.dayMacroPct, { color: m.color }]}>{pct}%</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ---------------- Styles ----------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  embedded: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: { fontSize: 18, color: '#16A34A', fontWeight: '700' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  placeholder: { width: 36 },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  contentEmbedded: { paddingTop: 4 },

  periodRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 3,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  periodPill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 9,
    alignItems: 'center',
  },
  periodPillActive: {
    backgroundColor: '#0F172A',
  },
  periodPillText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  periodPillTextActive: { color: '#FFFFFF' },

  hero: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#15803D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
  heroLeft: { flex: 1, paddingLeft: 12, alignItems: 'flex-end' },
  heroEyebrow: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.78)',
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 2,
    textAlign: 'right',
  },
  heroScore: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 32,
    marginBottom: 2,
    textAlign: 'right',
  },
  heroSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.88)',
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'right',
  },
  heroBadgeRow: { flexDirection: 'row-reverse', gap: 6, marginBottom: 6, flexWrap: 'wrap', justifyContent: 'flex-start' },
  heroBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  heroBadgeEmoji: { fontSize: 11 },
  heroBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  heroMessage: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '500',
    lineHeight: 15,
    textAlign: 'right',
  },
  heroRingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRingCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRingEmoji: { fontSize: 24 },

  insightsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  insightChip: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  insightEmoji: { fontSize: 16, marginBottom: 2 },
  insightValue: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  insightLabel: { fontSize: 10, color: '#6B7280', fontWeight: '500', marginTop: 1 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  cardCaption: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  cardHint: { fontSize: 11, color: '#9CA3AF', marginTop: 2, textAlign: 'right' },

  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    position: 'relative',
    overflow: 'hidden',
  },
  macroFocusBar: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    right: 0,
    width: 3,
    borderRadius: 2,
  },
  macroEmojiInline: { fontSize: 16, width: 20, textAlign: 'center' },
  macroLabel: { fontSize: 12, fontWeight: '700', color: '#0F172A', width: 56 },
  macroValue: { fontSize: 11, fontWeight: '700', color: '#1F2937', width: 72, textAlign: 'right' },
  macroTarget: { color: '#9CA3AF', fontWeight: '500' },
  macroPct: { fontSize: 12, fontWeight: '800', width: 38, textAlign: 'right' },
  macroBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  macroBarFill: { height: '100%', borderRadius: 3 },
  macroBarGoal: {
    position: 'absolute',
    top: -1.5,
    bottom: -1.5,
    left: '80%',
    width: 1.5,
    backgroundColor: 'rgba(15,23,42,0.3)',
    borderRadius: 1,
  },

  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(229,231,235,0.7)',
  },
  gridLabel: {
    position: 'absolute',
    right: 0,
    top: -7,
    fontSize: 9,
    color: '#9CA3AF',
    fontWeight: '600',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 2,
  },
  goalLine: {
    position: 'absolute',
    left: 0,
    right: 22,
    height: 1.5,
    backgroundColor: '#16A34A',
    opacity: 0.5,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  barLabel: { fontSize: 9, color: '#9CA3AF', fontWeight: '600' },
  todayDot: {
    position: 'absolute',
    top: -7,
    alignSelf: 'center',
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  chartHint: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '500',
  },

  dayDetail: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dayDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dayDetailDate: { fontSize: 12, fontWeight: '700', color: '#0F172A', textAlign: 'right' },
  dayDetailScore: { fontSize: 11, color: '#16A34A', fontWeight: '600', marginTop: 1, textAlign: 'right' },
  dayDetailClose: { fontSize: 20, color: '#9CA3AF', fontWeight: '500', lineHeight: 20, paddingHorizontal: 4 },
  dayMacroRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayMacroEmoji: { fontSize: 13, width: 18, textAlign: 'center' },
  dayMacroLabel: { width: 50, fontSize: 11, color: '#1F2937', fontWeight: '600' },
  dayMacroValue: { fontSize: 10, color: '#1F2937', fontWeight: '600', width: 78, textAlign: 'right' },
  dayMacroTarget: { color: '#9CA3AF', fontWeight: '500' },
  dayMacroBarTrack: { flex: 1, height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' },
  dayMacroBarFill: { height: '100%', borderRadius: 3 },
  dayMacroPct: { width: 36, fontSize: 10, fontWeight: '700', textAlign: 'right' },

  todayRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  todayEmoji: { fontSize: 15, width: 22, textAlign: 'center' },
  todayLabel: { width: 58, fontSize: 11, color: '#6B7280', fontWeight: '600' },
  todayValue: { width: 80, fontSize: 11, color: '#0F172A', fontWeight: '700', textAlign: 'right' },
  todayTarget: { color: '#9CA3AF', fontWeight: '500' },
  todayBar: { flex: 1, height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  todayBarFill: { height: '100%', borderRadius: 3 },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 22,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  emptyEmoji: { fontSize: 30, marginBottom: 6 },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  emptyText: { fontSize: 11, color: '#6B7280', textAlign: 'center', lineHeight: 16 },
});
