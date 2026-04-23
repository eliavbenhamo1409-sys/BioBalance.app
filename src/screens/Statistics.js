import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path, Line, Circle, Text as SvgText, G } from 'react-native-svg';
import { useApp } from '../context/AppContext';
import { getDailyStatsHistory } from '../api/supabaseClient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function Statistics() {
  const navigation = useNavigation();
  const { dailyStats, profile, user } = useApp();
  const [streak, setStreak] = useState(0);
  const [weekData, setWeekData] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('week');

  useEffect(() => {
    loadHistoricalData();
  }, [user]);

  const loadHistoricalData = async () => {
    try {
      let history = [];

      if (user) {
        // Load from Supabase if logged in
        const { data } = await getDailyStatsHistory(user.id, 30);
        if (data) {
          history = data.map(stat => ({
            date: stat.date,
            calories: stat.calories || 0,
            protein: stat.protein || 0,
            fat: stat.fat || 0,
            water: stat.water || 0,
            goalPercent: calculateGoalPercent(stat),
          }));
        }
      }

      // Calculate streak
      let currentStreak = 0;
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        const dayStats = history.find(h => h.date === dateKey);

        if (dayStats && dayStats.goalPercent >= 80) {
          currentStreak++;
        } else if (i > 0) {
          break;
        }
      }
      setStreak(currentStreak);

      // Generate week data
      const week = [];
      const days = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        const dayStats = history.find(h => h.date === dateKey);

        week.push({
          day: days[date.getDay()],
          date: dateKey,
          percent: dayStats?.goalPercent || (i === 0 ? calculateTodayPercent() : 0),
        });
      }
      setWeekData(week);
    } catch (error) {
      // Generate mock data
      const days = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
      const mockData = days.map((day, i) => ({
        day,
        percent: i === 6 ? calculateTodayPercent() : 0,
      }));
      setWeekData(mockData);
      setStreak(0);
    }
  };

  const calculateGoalPercent = (stat) => {
    const caloriesPct = ((stat.calories || 0) / (profile?.calories_target || 2000)) * 100;
    const proteinPct = ((stat.protein || 0) / (profile?.protein_target || 90)) * 100;
    const fatPct = ((stat.fat || 0) / (profile?.fat_target || 65)) * 100;
    const waterPct = ((stat.water || 0) / (profile?.water_target || 8)) * 100;
    return Math.min(100, Math.round((caloriesPct + proteinPct + fatPct + waterPct) / 4));
  };

  const calculateTodayPercent = () => {
    const caloriesPct = ((dailyStats?.calories || 0) / (profile?.calories_target || 2000)) * 100;
    const proteinPct = ((dailyStats?.protein || 0) / (profile?.protein_target || 90)) * 100;
    const fatPct = ((dailyStats?.fat || 0) / (profile?.fat_target || 65)) * 100;
    const waterPct = ((dailyStats?.water_glasses || 0) / (profile?.water_target || 8)) * 100;
    return Math.min(100, Math.round((caloriesPct + proteinPct + fatPct + waterPct) / 4));
  };

  // Chart dimensions
  const chartWidth = SCREEN_WIDTH - 64;
  const chartHeight = 180;
  const padding = { top: 20, right: 20, bottom: 40, left: 40 };
  const graphWidth = chartWidth - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;

  // Generate path
  const generatePath = () => {
    if (weekData.length === 0) return '';

    const points = weekData.map((d, i) => ({
      x: padding.left + (i / (weekData.length - 1)) * graphWidth,
      y: padding.top + graphHeight - (d.percent / 100) * graphHeight,
    }));

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const cp1x = points[i - 1].x + (points[i].x - points[i - 1].x) / 3;
      const cp1y = points[i - 1].y;
      const cp2x = points[i].x - (points[i].x - points[i - 1].x) / 3;
      const cp2y = points[i].y;
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${points[i].x} ${points[i].y}`;
    }
    return path;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>סטטיסטיקות</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Streak Card */}
        <View style={styles.streakCard}>
          <View style={styles.streakIcon}>
            <Text style={styles.streakEmoji}>🔥</Text>
          </View>
          <View style={styles.streakInfo}>
            <Text style={styles.streakNumber}>{streak}</Text>
            <Text style={styles.streakLabel}>ימים ברצף</Text>
          </View>
          <Text style={styles.streakMotivation}>
            {streak >= 7 ? 'מדהים! שמור על הקצב! 💪' : streak >= 3 ? 'כל הכבוד! ממשיך חזק!' : 'התחלה טובה!'}
          </Text>
        </View>

        {/* Chart Card */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>עמידה ביעדים</Text>
            <View style={styles.periodTabs}>
              {['week', 'month'].map(period => (
                <TouchableOpacity
                  key={period}
                  style={[styles.periodTab, selectedPeriod === period && styles.periodTabActive]}
                  onPress={() => setSelectedPeriod(period)}
                >
                  <Text style={[styles.periodTabText, selectedPeriod === period && styles.periodTabTextActive]}>
                    {period === 'week' ? 'שבוע' : 'חודש'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* SVG Chart */}
          <View style={styles.chartContainer}>
            <Svg width={chartWidth} height={chartHeight}>
              {/* Grid lines */}
              {[0, 25, 50, 75, 100].map(pct => (
                <G key={pct}>
                  <Line
                    x1={padding.left}
                    y1={padding.top + graphHeight - (pct / 100) * graphHeight}
                    x2={chartWidth - padding.right}
                    y2={padding.top + graphHeight - (pct / 100) * graphHeight}
                    stroke="#E5E7EB"
                    strokeWidth={1}
                    strokeDasharray={pct === 100 ? '0' : '4,4'}
                  />
                  <SvgText
                    x={padding.left - 8}
                    y={padding.top + graphHeight - (pct / 100) * graphHeight + 4}
                    fontSize={10}
                    fill="#9CA3AF"
                    textAnchor="end"
                  >
                    {pct}%
                  </SvgText>
                </G>
              ))}

              {/* Goal line at 80% */}
              <Line
                x1={padding.left}
                y1={padding.top + graphHeight - 0.8 * graphHeight}
                x2={chartWidth - padding.right}
                y2={padding.top + graphHeight - 0.8 * graphHeight}
                stroke="#22C55E"
                strokeWidth={2}
                strokeDasharray="8,4"
              />

              {/* Chart line */}
              <Path
                d={generatePath()}
                fill="none"
                stroke="#1A1F36"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data points */}
              {weekData.map((d, i) => (
                <G key={i}>
                  <Circle
                    cx={padding.left + (i / (weekData.length - 1)) * graphWidth}
                    cy={padding.top + graphHeight - (d.percent / 100) * graphHeight}
                    r={6}
                    fill={d.percent >= 80 ? '#22C55E' : '#1A1F36'}
                    stroke="#FFFFFF"
                    strokeWidth={2}
                  />
                  <SvgText
                    x={padding.left + (i / (weekData.length - 1)) * graphWidth}
                    y={chartHeight - 10}
                    fontSize={12}
                    fill="#6B7280"
                    textAnchor="middle"
                  >
                    {d.day}
                  </SvgText>
                </G>
              ))}
            </Svg>
          </View>

          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} />
              <Text style={styles.legendText}>יעד (80%+)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#1A1F36' }]} />
              <Text style={styles.legendText}>מתחת ליעד</Text>
            </View>
          </View>
        </View>

        {/* Today Stats */}
        <View style={styles.todayCard}>
          <Text style={styles.todayTitle}>היום</Text>
          <View style={styles.todayStats}>
            <StatItem label="קלוריות" value={dailyStats?.calories || 0} target={profile?.calories_target || 2000} emoji="🔥" />
            <StatItem label="חלבון" value={dailyStats?.protein || 0} target={profile?.protein_target || 90} unit="g" emoji="💪" />
            <StatItem label="שומן" value={dailyStats?.fat || 0} target={profile?.fat_target || 65} unit="g" emoji="🥑" />
            <StatItem label="מים" value={dailyStats?.water_glasses || 0} target={profile?.water_target || 8} emoji="💧" />
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const StatItem = ({ label, value, target, unit = '', emoji }) => {
  const percent = Math.min(100, (value / target) * 100);
  return (
    <View style={styles.statItem}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}{unit}/{target}{unit}</Text>
      <View style={styles.statBar}>
        <View style={[styles.statBarFill, { width: `${percent}%`, backgroundColor: percent >= 100 ? '#22C55E' : '#1A1F36' }]} />
      </View>
    </View>
  );
};

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
    padding: 20,
  },

  // Streak - Clean minimal card
  streakCard: {
    backgroundColor: '#16A34A',
    borderRadius: 24,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  streakIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
  },
  streakEmoji: {
    fontSize: 32,
  },
  streakInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  streakNumber: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 52,
  },
  streakLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  streakMotivation: {
    position: 'absolute',
    left: 24,
    bottom: 24,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },

  // Chart - Clean white card
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
  },
  periodTabs: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 3,
  },
  periodTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  periodTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  periodTabText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  periodTabTextActive: {
    color: '#16A34A',
    fontWeight: '600',
  },
  chartContainer: {
    alignItems: 'center',
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    gap: 24,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },

  // Today Stats - Clean grid
  todayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  todayTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 20,
    textAlign: 'right',
  },
  todayStats: {
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statEmoji: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  },
  statLabel: {
    width: 70,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  statValue: {
    width: 90,
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
    textAlign: 'right',
  },
  statBar: {
    flex: 1,
    height: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 5,
    overflow: 'hidden',
  },
  statBarFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#16A34A',
  },
});
