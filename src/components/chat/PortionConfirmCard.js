import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { buildFoodsFromPortionDrafts, gramsFromPortionDraft } from '../../utils/standardPortionGuess';

const BRAND = '#32A728';

function initialDrafts(items) {
  return (items || []).map((it) => {
    const g = it.portionGuess;
    if (!g || g.mode === 'grams') {
      return { mode: 'grams', grams: g?.defaultGrams ?? 150 };
    }
    return { mode: 'units', units: g.defaultUnits ?? 1 };
  });
}

function PortionConfirmCard({ items, locked, onApplied }) {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [drafts, setDrafts] = useState(() => initialDrafts(items));

  const defaultsDrafts = useMemo(() => initialDrafts(items), [items]);

  const openAdjust = useCallback(() => {
    setDrafts(initialDrafts(items));
    setAdjustOpen(true);
  }, [items]);

  const closeAdjust = useCallback(() => setAdjustOpen(false), []);

  const applyWithDrafts = useCallback(
    async (d) => {
      if (locked) return;
      const foods = buildFoodsFromPortionDrafts(items, d);
      await onApplied?.(foods);
    },
    [items, locked, onApplied]
  );

  const onYes = useCallback(() => applyWithDrafts(defaultsDrafts), [applyWithDrafts, defaultsDrafts]);

  const onSaveAdjust = useCallback(async () => {
    await applyWithDrafts(drafts);
    setAdjustOpen(false);
  }, [applyWithDrafts, drafts]);

  const updateDraftGrams = useCallback((index, grams) => {
    setDrafts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], grams };
      return next;
    });
  }, []);

  const updateDraftUnits = useCallback((index, units) => {
    setDrafts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], units: Math.round(units) };
      return next;
    });
  }, []);

  return (
    <>
      <View style={[styles.card, locked && styles.cardLocked]} accessibilityRole="summary">
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.btnPrimary, locked && styles.btnDisabled]}
            onPress={onYes}
            disabled={locked}
            accessibilityRole="button"
            accessibilityLabel="הוספה למאזן לפי המנות המוצעות"
          >
            <Text style={styles.btnPrimaryText}>הוסף</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnSecondary, locked && styles.btnDisabled]}
            onPress={openAdjust}
            disabled={locked}
            accessibilityRole="button"
            accessibilityLabel="לא — עריכת כמות לפני הוספה"
          >
            <Text style={styles.btnSecondaryText}>לא</Text>
          </TouchableOpacity>
        </View>
        {locked ? (
          <Text style={styles.lockedNote}>נרשם במאזן</Text>
        ) : null}
      </View>

      <Modal
        visible={adjustOpen}
        transparent
        animationType="fade"
        onRequestClose={closeAdjust}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeAdjust}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation?.()}>
            <Text style={styles.sheetTitle}>כוונון כמות</Text>
            <Text style={styles.sheetHint}>
              גררו את הסרגל או בחרו מספר יחידות — ההערכה משמשת לחישוב קלוריות.
            </Text>
            <ScrollView
              style={styles.sheetScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {(items || []).map((it, i) => {
                const guess = it.portionGuess;
                const name = it.name || 'מזון';
                if (!guess || guess.mode === 'grams') {
                  const g = guess || {};
                  const minG = g.minGrams ?? 50;
                  const maxG = g.maxGrams ?? 400;
                  const step = g.step ?? 10;
                  const val = drafts[i]?.grams ?? g.defaultGrams ?? 150;
                  return (
                    <View key={`${name}_${i}`} style={styles.block}>
                      <Text style={styles.blockTitle}>{name}</Text>
                      <Text style={styles.blockValue}>{Math.round(val)} גרם</Text>
                      <Slider
                        style={styles.slider}
                        minimumValue={minG}
                        maximumValue={maxG}
                        step={step}
                        value={val}
                        onValueChange={(v) => updateDraftGrams(i, v)}
                        minimumTrackTintColor={BRAND}
                        maximumTrackTintColor="#E2E8F0"
                        thumbTintColor={BRAND}
                      />
                    </View>
                  );
                }
                const minU = guess.minUnits ?? 1;
                const maxU = guess.maxUnits ?? 8;
                const u = drafts[i]?.units ?? guess.defaultUnits ?? 1;
                const est = gramsFromPortionDraft(it, drafts[i]);
                return (
                  <View key={`${name}_${i}`} style={styles.block}>
                    <Text style={styles.blockTitle}>{name}</Text>
                    <Text style={styles.blockValue}>
                      {Math.round(u)} {u === 1 ? 'יחידה' : 'יחידות'} (~{est} גרם)
                    </Text>
                    <Slider
                      style={styles.slider}
                      minimumValue={minU}
                      maximumValue={maxU}
                      step={1}
                      value={u}
                      onValueChange={(v) => updateDraftUnits(i, v)}
                      minimumTrackTintColor={BRAND}
                      maximumTrackTintColor="#E2E8F0"
                      thumbTintColor={BRAND}
                    />
                  </View>
                );
              })}
            </ScrollView>
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.sheetBtnGhost} onPress={closeAdjust}>
                <Text style={styles.sheetBtnGhostText}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetBtnGo} onPress={onSaveAdjust}>
                <Text style={styles.sheetBtnGoText}>אישור והוספה</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export default memo(PortionConfirmCard);

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    maxWidth: '78%',
    marginLeft: 38,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardLocked: {
    opacity: 0.72,
  },
  actionsRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    justifyContent: 'stretch',
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: BRAND,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  btnSecondaryText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.45,
  },
  lockedNote: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748B',
    textAlign: 'right',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    maxHeight: '88%',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
    marginBottom: 6,
  },
  sheetHint: {
    fontSize: 13,
    lineHeight: 19,
    color: '#64748B',
    textAlign: 'right',
    marginBottom: 14,
  },
  sheetScroll: {
    maxHeight: 420,
  },
  block: {
    marginBottom: 20,
  },
  blockTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'right',
    marginBottom: 4,
  },
  blockValue: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'right',
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sheetActions: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  sheetBtnGhost: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  sheetBtnGhostText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  sheetBtnGo: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: BRAND,
  },
  sheetBtnGoText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
