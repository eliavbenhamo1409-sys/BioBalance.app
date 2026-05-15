// ============================================================
// Weekly check-in modal
// ============================================================
// Shown once a week (triggered by useNotifications) so the user
// reacts to the AI's weekly summary. Feedback persists to
// ai_weekly_checkins and the AI reads it back next time so it can
// actually adapt to what the user likes / dislikes.

import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import moment from 'moment';
import { saveWeeklyCheckin } from '../api/insightsRepository';

const BRAND = '#32A728';
const BRAND_LIGHT = '#E8F5E8';
const TEXT_PRIMARY = '#0F1A0E';
const TEXT_MUTED = 'rgba(50, 167, 40, 0.55)';

export default function WeeklyCheckinModal({
  visible,
  onClose,
  userId,
  weekStart,
  weekEnd,
  report,
  baseline,
  reportId = null,
}) {
  const [reaction, setReaction] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  const previewItems = useMemo(() => {
    const items = [];
    if (report?.todayConclusion) {
      items.push({ icon: '🧭', label: report.todayConclusion });
    }
    if (report?.mainInsight) {
      items.push({ icon: '💡', label: report.mainInsight });
    }
    (report?.strengths || []).slice(0, 2).forEach((s) =>
      items.push({ icon: '✅', label: s }),
    );
    (report?.improvements || []).slice(0, 2).forEach((s) =>
      items.push({ icon: '🛠', label: s }),
    );
    if (baseline?.scores) {
      items.push({
        icon: '📊',
        label: `ציון השבוע ${baseline.scores.week ?? '?'}% (חודשי: ${baseline.scores.month ?? '?'}%)`,
      });
    }
    return items.slice(0, 5);
  }, [report, baseline]);

  const handleSubmit = async () => {
    if (!userId || !weekStart || !weekEnd) {
      onClose?.();
      return;
    }
    setSaving(true);
    try {
      await saveWeeklyCheckin(userId, {
        week_start: weekStart,
        week_end: weekEnd,
        report_id: reportId,
        reaction,
        feedback_text: feedback.trim() || null,
        specific_reactions: {},
      });
    } finally {
      setSaving(false);
      onClose?.();
    }
  };

  const handleSkip = () => {
    onClose?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleSkip}
    >
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.center}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>סיכום שבועי</Text>
            <Text style={styles.subtitle}>
              {moment(weekStart).format('DD/MM')} – {moment(weekEnd).format('DD/MM')}
            </Text>

            <ScrollView
              style={{ maxHeight: 260 }}
              contentContainerStyle={{ paddingVertical: 6 }}
              showsVerticalScrollIndicator={false}
            >
              {previewItems.length === 0 ? (
                <Text style={styles.empty}>אין מספיק נתונים השבוע.</Text>
              ) : (
                previewItems.map((p, i) => (
                  <View key={i} style={styles.previewRow}>
                    <Text style={styles.previewIcon}>{p.icon}</Text>
                    <Text style={styles.previewLabel}>{p.label}</Text>
                  </View>
                ))
              )}
            </ScrollView>

            <Text style={styles.question}>הסיכום מדויק / עוזר לך?</Text>

            <View style={styles.reactionRow}>
              <ReactionButton
                emoji="👍"
                label="מדויק"
                active={reaction === 'positive'}
                onPress={() => setReaction('positive')}
              />
              <ReactionButton
                emoji="😐"
                label="ככה ככה"
                active={reaction === 'neutral'}
                onPress={() => setReaction('neutral')}
              />
              <ReactionButton
                emoji="👎"
                label="לא מדויק"
                active={reaction === 'negative'}
                onPress={() => setReaction('negative')}
              />
            </View>

            <Text style={styles.feedbackLabel}>מה היית רוצה לראות יותר/פחות?</Text>
            <TextInput
              value={feedback}
              onChangeText={setFeedback}
              placeholder="טקסט חופשי — יעזור ל-AI להתאים את עצמו"
              placeholderTextColor="rgba(15,26,14,0.4)"
              style={styles.input}
              multiline
              numberOfLines={3}
              maxLength={400}
            />

            <View style={styles.actions}>
              <TouchableOpacity onPress={handleSkip} style={styles.skipBtn} activeOpacity={0.7}>
                <Text style={styles.skipText}>דלג השבוע</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmit}
                style={[styles.submitBtn, (!reaction || saving) && styles.submitBtnDisabled]}
                disabled={!reaction || saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitText}>שלח</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function ReactionButton({ emoji, label, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.reactionBtn, active && styles.reactionBtnActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={styles.reactionEmoji}>{emoji}</Text>
      <Text style={[styles.reactionLabel, active && styles.reactionLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
  },
  center: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'right' },
  subtitle: { fontSize: 12, color: TEXT_MUTED, textAlign: 'right', marginTop: 2, marginBottom: 14 },

  empty: { fontSize: 13, color: TEXT_MUTED, textAlign: 'center', paddingVertical: 20 },

  previewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  previewIcon: { fontSize: 16, marginLeft: 10, marginTop: 1 },
  previewLabel: { flex: 1, fontSize: 12, color: TEXT_PRIMARY, lineHeight: 18, textAlign: 'right' },

  question: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'right',
    marginTop: 14,
    marginBottom: 10,
  },
  reactionRow: { flexDirection: 'row', gap: 8 },
  reactionBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reactionBtnActive: {
    backgroundColor: BRAND_LIGHT,
    borderColor: BRAND,
  },
  reactionEmoji: { fontSize: 22 },
  reactionLabel: { fontSize: 11, color: TEXT_MUTED, marginTop: 2, fontWeight: '600' },
  reactionLabelActive: { color: BRAND },

  feedbackLabel: {
    fontSize: 12,
    color: TEXT_MUTED,
    textAlign: 'right',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    minHeight: 70,
    maxHeight: 110,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    color: TEXT_PRIMARY,
    fontSize: 13,
    textAlign: 'right',
    textAlignVertical: 'top',
  },

  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  skipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: { fontSize: 13, color: TEXT_MUTED, fontWeight: '600' },
  submitBtn: {
    flex: 1,
    backgroundColor: BRAND,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontSize: 14, color: '#FFFFFF', fontWeight: '700' },
});
