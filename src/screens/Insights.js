// ============================================================
// Insights — unified screen with a top tab pill switching
// between Statistics and the AI Coach.
// ============================================================
// This is the screen the side-menu entry "תובנות" points to.
// It is also wired so weekly check-in notifications can deep-link
// here with `params.openCheckin = true` to show the modal.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import moment from 'moment';

import Statistics from './Statistics';
import AIInsights from './AIInsights';
import WeeklyCheckinModal from '../components/WeeklyCheckinModal';
import { useApp } from '../context/AppContext';
import {
  getLatestInsightReport,
  getLatestWeeklyCheckin,
} from '../api/insightsRepository';

const TABS = [
  { key: 'stats', label: 'סטטיסטיקות' },
  { key: 'ai', label: 'תובנות AI' },
];

const BRAND = '#16A34A';

function getCurrentWeekRange() {
  // ISO week start = Sunday in Israel (moment's locale dependent).
  // We pin to Sunday→Saturday explicitly.
  const today = moment();
  const start = moment(today).startOf('day');
  start.subtract(start.day(), 'days');
  const end = moment(start).add(6, 'days');
  return {
    weekStart: start.format('YYYY-MM-DD'),
    weekEnd: end.format('YYYY-MM-DD'),
  };
}

export default function Insights() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useApp();

  const initialTab = route?.params?.tab === 'ai' ? 'ai' : 'stats';
  const [tab, setTab] = useState(initialTab);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinPayload, setCheckinPayload] = useState(null);

  const { weekStart, weekEnd } = useMemo(() => getCurrentWeekRange(), []);

  const handleTab = useCallback((key) => {
    try { Haptics.selectionAsync(); } catch (_) {}
    setTab(key);
  }, []);

  // Open weekly check-in modal if requested by deep-link.
  useEffect(() => {
    let mounted = true;
    const open = async () => {
      if (!route?.params?.openCheckin) return;
      // Don't show if already done this week.
      if (user?.id) {
        const { data: latest } = await getLatestWeeklyCheckin(user.id);
        if (latest && latest.week_start === weekStart) {
          return;
        }
        // Load latest cached daily report to preview.
        const { data: report } = await getLatestInsightReport(user.id, 'daily');
        if (!mounted) return;
        setCheckinPayload({
          report: report
            ? {
                todayConclusion: report.today_conclusion,
                mainInsight: report.main_insight,
                strengths: report.strengths || [],
                improvements: report.improvements || [],
              }
            : null,
          baseline: report?.baseline || null,
          reportId: report?.id || null,
        });
        setCheckinOpen(true);
      } else {
        setCheckinOpen(true);
      }
    };
    open();
    return () => {
      mounted = false;
    };
  }, [route?.params?.openCheckin, user?.id, weekStart]);

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Home');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} accessibilityLabel="חזרה">
          <Text style={styles.backIcon}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>תובנות</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Same segmented control as Statistics (week / month / quarter). */}
      <View style={styles.tabsWrap}>
        <View style={styles.periodRow}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.periodPill, active && styles.periodPillActive]}
                onPress={() => handleTab(t.key)}
                activeOpacity={0.85}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.periodPillText, active && styles.periodPillTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Body */}
      <View style={styles.body}>
        {tab === 'stats' ? <Statistics embedded /> : <AIInsights embedded />}
      </View>

      {/* Weekly check-in modal */}
      <WeeklyCheckinModal
        visible={checkinOpen}
        onClose={() => setCheckinOpen(false)}
        userId={user?.id}
        weekStart={weekStart}
        weekEnd={weekEnd}
        report={checkinPayload?.report || null}
        baseline={checkinPayload?.baseline || null}
        reportId={checkinPayload?.reportId || null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  backIcon: { fontSize: 18, color: BRAND, fontWeight: '700' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  headerSpacer: { width: 36 },

  tabsWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: '#FFFFFF',
  },
  // Mirror `Statistics.js` → `periodRow` / `periodPill*` (embedded stats strip).
  periodRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 3,
    marginBottom: 4,
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
    backgroundColor: BRAND,
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  periodPillText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  periodPillTextActive: { color: '#FFFFFF' },

  body: { flex: 1, backgroundColor: '#FFFFFF' },
});
