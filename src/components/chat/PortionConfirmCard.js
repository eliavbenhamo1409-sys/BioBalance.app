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
import {
  buildFoodsFromPortionDrafts,
  gramsFromPortionDraft,
  portionGramTickLabels,
  portionUnitTickLabels,
} from '../../utils/standardPortionGuess';
import { BubbleRichText } from './ChatMessage';

const BRAND = '#32A728';
const SLIDER_ABS_MAX = 800;

function gramSliderBounds(guess, fallbackDefault) {
  const g = guess || {};
  const defRaw = g.defaultGrams ?? fallbackDefault;
  const def = Math.min(Math.max(defRaw, 0), SLIDER_ABS_MAX);
  let minG = Math.max(0, g.minGrams ?? 0);
  let maxG =
    g.maxGrams != null ? Math.min(g.maxGrams, SLIDER_ABS_MAX) : SLIDER_ABS_MAX;

  if (minG === maxG) {
    return { minG, maxG: minG, def };
  }
  if (maxG <= minG) {
    maxG = Math.min(SLIDER_ABS_MAX, Math.max(minG + 10, def, 50));
  }
  return { minG, maxG, def };
}

/** שורה עליונה: משקל/יח׳ משוערים; שורה תחתונה: מילת כלי אחת */
function GramTickStrip({ tickLabels }) {
  return (
    <View style={styles.tickStrip} accessibilityElementsHidden accessibilityLabel="">
      <View style={styles.tickMarksRow}>
        {(tickLabels || []).map((label, idx) => {
          const raw = String(label ?? '');
          const i = raw.indexOf('\n');
          const measure = i === -1 ? raw.trim() : raw.slice(0, i).trim();
          const word = i === -1 ? '' : raw.slice(i + 1).trim();
          return (
            <View key={`g_${idx}_${measure}_${word}`} style={styles.tickSlot}>
              <View style={styles.tickMark} />
              {measure ? (
                <Text
                  style={styles.tickMeasure}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  {measure}
                </Text>
              ) : null}
              {word ? (
                <Text style={styles.tickWord} numberOfLines={1}>
                  {word}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function UnitTickStrip({ tickLabels }) {
  return (
    <View style={styles.tickStrip} accessibilityElementsHidden accessibilityLabel="">
      <View style={styles.tickMarksRow}>
        {(tickLabels || []).map((label, idx) => {
          const raw = String(label ?? '');
          const i = raw.indexOf('\n');
          const measure = i === -1 ? raw.trim() : raw.slice(0, i).trim();
          const word = i === -1 ? '' : raw.slice(i + 1).trim();
          return (
            <View key={`u_${idx}_${measure}_${word}`} style={styles.tickSlot}>
              <View style={styles.tickMark} />
              {measure ? (
                <Text
                  style={styles.tickMeasure}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  {measure}
                </Text>
              ) : null}
              {word ? (
                <Text style={styles.tickWord} numberOfLines={1}>
                  {word}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function initialDrafts(items) {
  return (items || []).map((it) => {
    const g = it.portionGuess;
    if (!g || g.mode === 'grams') {
      const { def, minG, maxG } = gramSliderBounds(g, 150);
      const raw = g?.defaultGrams ?? def;
      const grams = Math.min(Math.max(raw, minG), maxG);
      return { mode: 'grams', grams };
    }
    return { mode: 'units', units: g.defaultUnits ?? 1 };
  });
}

function PortionConfirmCard({ introText, items, locked, onApplied }) {
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
      if (!foods.length) return;
      await onApplied?.(foods);
    },
    [items, locked, onApplied]
  );

  const onYes = useCallback(() => applyWithDrafts(defaultsDrafts), [applyWithDrafts, defaultsDrafts]);

  const onSaveAdjust = useCallback(async () => {
    await applyWithDrafts(drafts);
    setAdjustOpen(false);
  }, [applyWithDrafts, drafts]);

  const updateDraftGrams = useCallback(
    (index, grams) => {
      const guess = items[index]?.portionGuess;
      const { minG, maxG } = gramSliderBounds(guess, 150);
      const g = Math.min(Math.max(grams, minG), maxG);
      setDrafts((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], grams: g };
        return next;
      });
    },
    [items]
  );

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
        {typeof introText === 'string' && introText.trim() ? (
          <View style={styles.introWrap} accessibilityRole="text">
            <BubbleRichText text={introText.trim()} isBot />
          </View>
        ) : null}
        <View
          style={[
            styles.actionsRow,
            typeof introText === 'string' && introText.trim() ? styles.actionsRowAfterIntro : null,
          ]}
        >
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
            <Text style={styles.sheetHint}>גררו. אפשר גם לכתוב בצ׳אט.</Text>
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
                  const { minG, maxG } = gramSliderBounds(g, 150);
                  const step = g.step ?? 10;
                  const rawVal = drafts[i]?.grams ?? g.defaultGrams ?? 150;
                  const val = Math.min(Math.max(rawVal, minG), maxG);
                  const isLiquid = g.scaleMode === 'liquid';
                  const perMl = g.gramsPerMl > 0 ? g.gramsPerMl : 1;
                  const displayMlNow = Math.round(val / perMl);
                  const gramTickLabels = portionGramTickLabels(g, { minG, maxG }, name);

                  return (
                    <View key={`${name}_${i}`} style={styles.block}>
                      <Text style={styles.blockTitle}>{name}</Text>
                      <Text style={styles.amountRow} accessibilityLiveRegion="polite">
                        {isLiquid ? (
                          <>
                            <Text style={styles.amountValue}>{displayMlNow}</Text>
                            <Text style={styles.amountUnit}> מ״ל</Text>
                          </>
                        ) : (
                          <>
                            <Text style={styles.amountValue}>{Math.round(val)}</Text>
                            <Text style={styles.amountUnit}> גרם</Text>
                          </>
                        )}
                      </Text>
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
                      <GramTickStrip tickLabels={gramTickLabels} />
                      {isLiquid ? (
                        <Text style={styles.gramEquivMuted}>~{Math.round(val)} גרם</Text>
                      ) : null}
                    </View>
                  );
                }
                const minU = 0;
                const maxU = guess.maxUnits ?? 8;
                const u = drafts[i]?.units ?? guess.defaultUnits ?? 1;
                const est = gramsFromPortionDraft(it, drafts[i]);
                const unitTickLabels = portionUnitTickLabels(guess, { minU, maxU });
                return (
                  <View key={`${name}_${i}`} style={styles.block}>
                    <Text style={styles.blockTitle}>{name}</Text>
                    <Text style={styles.amountRow} accessibilityLiveRegion="polite">
                      <Text style={styles.amountValue}>{Math.round(u)}</Text>
                      <Text style={styles.amountUnit}>
                        {u === 1 ? ' יחידה · ' : ' יחידות · '}
                      </Text>
                      <Text style={styles.amountValue}>~{est}</Text>
                      <Text style={styles.amountUnit}> גרם</Text>
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
                    <UnitTickStrip tickLabels={unitTickLabels} />
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
    width: '100%',
  },
  actionsRowAfterIntro: {
    marginTop: 14,
  },
  introWrap: {
    alignSelf: 'stretch',
    width: '100%',
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
    lineHeight: 18,
    color: '#64748B',
    textAlign: 'right',
    marginBottom: 12,
  },
  sheetScroll: {
    maxHeight: 420,
  },
  block: {
    marginBottom: 22,
  },
  blockTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'right',
    marginBottom: 6,
  },
  amountRow: {
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
    justifyContent: 'flex-start',
    marginBottom: 6,
    textAlign: 'right',
    flexWrap: 'wrap',
    width: '100%',
  },
  amountValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
  },
  amountUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  gramEquivMuted: {
    marginTop: 4,
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  slider: {
    width: '100%',
    height: 40,
    marginBottom: 2,
  },
  tickStrip: {
    marginTop: 6,
    paddingHorizontal: 4,
    width: '100%',
  },
  tickMarksRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tickSlot: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 0,
    minWidth: 0,
    maxWidth: '20%',
  },
  tickMark: {
    width: 2,
    height: 8,
    borderRadius: 1,
    backgroundColor: '#CBD5E1',
    marginBottom: 4,
    alignSelf: 'center',
  },
  tickMeasure: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '700',
    color: '#1E293B',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    width: '100%',
  },
  tickWord: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 2,
    width: '100%',
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
