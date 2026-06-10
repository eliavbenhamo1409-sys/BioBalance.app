import React, { memo, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

const BRAND = '#32A728';
const BRAND_SOFT = '#F0FDF4';
const BRAND_BORDER = '#BBF7D0';
const INK = '#0F172A';
const MUTED = '#64748B';
const LINE = '#E2E8F0';
const SURFACE = '#F8FAFC';

function QuantityPromptCard({
  foodName,
  promptTitle,
  unitSingular,
  unitPlural,
  gramsPerUnit,
  kcalPer100g,
  defaultMode = 'unit',
  gramOnly = false,
  onConfirm,
  onSkip,
  disabled = false,
  resolvedLabel = null,
}) {
  const [mode, setMode] = useState(
    gramOnly || defaultMode === 'gram' ? 'gram' : 'unit',
  );
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const cardScale = useSharedValue(1);
  const cardOpacity = useSharedValue(1);
  const checkScale = useSharedValue(0);
  const checkOpacity = useSharedValue(0);
  const checkTranslateY = useSharedValue(18);

  const animateConfirmThen = (cb) => {
    setConfirming(true);

    const easeOut = Easing.bezier(0.22, 1, 0.36, 1);
    const easeInOut = Easing.bezier(0.4, 0, 0.2, 1);

    const cardDur = 340;
    const checkEnter = 200;
    const checkFadeIn = 240;
    const checkHold = 340;
    const checkFadeOut = 300;

    cardOpacity.value = withTiming(0, { duration: cardDur, easing: easeOut });
    cardScale.value = withTiming(0.91, { duration: cardDur + 40, easing: easeOut });

    checkTranslateY.value = withDelay(
      checkEnter,
      withSpring(0, { damping: 20, stiffness: 85, mass: 0.9 }),
    );
    checkScale.value = withDelay(
      checkEnter,
      withSequence(
        withSpring(1, { damping: 15, stiffness: 95, mass: 0.85 }),
        withDelay(
          checkFadeIn + checkHold - 60,
          withTiming(0.88, { duration: checkFadeOut, easing: easeInOut }),
        ),
      ),
    );
    checkOpacity.value = withDelay(
      checkEnter,
      withSequence(
        withTiming(1, { duration: checkFadeIn, easing: easeOut }),
        withDelay(
          checkHold,
          withTiming(0, { duration: checkFadeOut, easing: easeInOut }, (finished) => {
            if (finished) runOnJS(cb)();
          }),
        ),
      ),
    );
  };

  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const checkAnimStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    transform: [
      { translateY: checkTranslateY.value },
      { scale: checkScale.value },
    ],
  }));

  const num = useMemo(() => {
    const n = parseFloat(String(value).replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [value]);

  const grams = useMemo(() => {
    if (num <= 0) return 0;
    return mode === 'gram' ? Math.round(num) : Math.round(num * (gramsPerUnit || 1));
  }, [mode, num, gramsPerUnit]);

  const kcal = useMemo(() => {
    const k100 = Number(kcalPer100g);
    if (!Number.isFinite(k100) || k100 <= 0 || grams <= 0) return null;
    return Math.round((grams / 100) * k100);
  }, [grams, kcalPer100g]);

  const unitLabel = mode === 'gram' ? 'גרם' : unitPlural || 'יחידות';
  const canConfirm = num > 0 && !disabled;
  const title = promptTitle || `כמה ${foodName} אכלת?`;

  if (resolvedLabel) {
    return (
      <View style={styles.wrap}>
        <View style={styles.avatar}>
          <View style={styles.dot} />
        </View>
        <View style={[styles.card, styles.cardResolved, styles.cardStandalone]}>
          <View style={styles.resolvedRow}>
            <Ionicons name="checkmark-circle" size={16} color={BRAND} />
            <Text style={styles.resolvedText}>{resolvedLabel}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.avatar}>
        <View style={styles.dot} />
      </View>

      <View style={styles.cardContainer}>
        {confirming ? (
          <Animated.View style={[styles.checkBurst, checkAnimStyle]} pointerEvents="none">
            <View style={styles.checkCircle}>
              <Ionicons name="checkmark-sharp" size={28} color="#FFFFFF" />
            </View>
          </Animated.View>
        ) : null}

      <Animated.View style={[styles.card, disabled && styles.cardDisabled, cardAnimStyle]}>
        <View style={styles.accentBar} />

        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <Ionicons name="scale-outline" size={16} color={BRAND} />
          </View>
          <Text style={styles.title}>{title}</Text>
        </View>

        {!gramOnly ? (
          <View style={styles.segmented}>
            <Pressable
              style={[styles.segment, mode === 'unit' && styles.segmentActive]}
              onPress={() => !disabled && setMode('unit')}
              disabled={disabled}
            >
              <Text style={[styles.segmentText, mode === 'unit' && styles.segmentTextActive]}>
                {unitPlural || 'יחידות'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.segment, mode === 'gram' && styles.segmentActive]}
              onPress={() => !disabled && setMode('gram')}
              disabled={disabled}
            >
              <Text style={[styles.segmentText, mode === 'gram' && styles.segmentTextActive]}>
                גרם
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.inputShell, focused && styles.inputShellFocused]}>
          <View style={styles.unitChip}>
            <Text style={styles.unitChipText}>{unitLabel}</Text>
          </View>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor="#CBD5E1"
            editable={!disabled}
            textAlign="right"
            selectionColor={BRAND}
          />
        </View>

        {grams > 0 ? (
          <View style={styles.previewChip}>
            <Text style={styles.previewChipText}>
              ≈ {grams}g{kcal != null ? ` · ${kcal} קק"ל` : ''}
            </Text>
          </View>
        ) : (
          <Text style={styles.hint}>
            {mode === 'unit' && unitSingular
              ? `${unitSingular} אחד ≈ ${gramsPerUnit || '?'}g`
              : 'הזן כמות'}
          </Text>
        )}

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.skipBtn,
              pressed && !disabled && styles.skipBtnPressed,
              disabled && styles.btnDisabled,
            ]}
            onPress={() => !disabled && onSkip?.()}
            disabled={disabled}
          >
            <Text style={styles.skipBtnText}>דלג</Text>
            <Text style={styles.skipBtnSub}>השאר הערכה</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.confirmBtn,
              !canConfirm && styles.confirmBtnDisabled,
              pressed && canConfirm && styles.confirmBtnPressed,
            ]}
            onPress={() => {
              if (!canConfirm || confirming) return;
              animateConfirmThen(() => onConfirm?.({ quantity: num, mode }));
            }}
            disabled={!canConfirm || confirming}
          >
            <Text style={[styles.confirmBtnText, !canConfirm && styles.confirmBtnTextDisabled]}>
              אישור
            </Text>
          </Pressable>
        </View>
      </Animated.View>
      </View>
    </View>
  );
}

export default memo(QuantityPromptCard);

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    marginVertical: 6,
    alignItems: 'flex-start',
    paddingHorizontal: 4,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BRAND,
  },
  cardContainer: {
    flex: 1,
    maxWidth: '82%',
    position: 'relative',
    minHeight: 56,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  checkBurst: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  checkCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderBottomLeftRadius: 5,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: LINE,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  cardDisabled: {
    opacity: 0.5,
  },
  cardResolved: {
    paddingVertical: 12,
  },
  cardStandalone: {
    maxWidth: '82%',
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: 3,
    backgroundColor: BRAND,
    opacity: 0.85,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: BRAND_SOFT,
    borderWidth: 1,
    borderColor: BRAND_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: INK,
    textAlign: 'right',
    lineHeight: 21,
  },
  segmented: {
    flexDirection: 'row-reverse',
    backgroundColor: SURFACE,
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: LINE,
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: MUTED,
  },
  segmentTextActive: {
    color: BRAND,
  },
  inputShell: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: LINE,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 2,
    marginBottom: 8,
    backgroundColor: SURFACE,
  },
  inputShellFocused: {
    borderColor: BRAND,
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    color: INK,
    paddingVertical: 10,
    fontVariant: ['tabular-nums'],
    minHeight: 48,
  },
  unitChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: LINE,
    marginLeft: 8,
  },
  unitChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: MUTED,
  },
  hint: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'right',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  previewChip: {
    alignSelf: 'flex-end',
    backgroundColor: BRAND_SOFT,
    borderWidth: 1,
    borderColor: BRAND_BORDER,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 12,
  },
  previewChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  confirmBtn: {
    flex: 1.35,
    backgroundColor: BRAND,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: SURFACE,
    borderWidth: 1.5,
    borderColor: LINE,
  },
  confirmBtnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  confirmBtnTextDisabled: {
    color: '#CBD5E1',
  },
  skipBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: LINE,
  },
  skipBtnPressed: {
    backgroundColor: SURFACE,
    borderColor: '#CBD5E1',
  },
  skipBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: INK,
  },
  skipBtnSub: {
    fontSize: 11,
    fontWeight: '500',
    color: MUTED,
    marginTop: 1,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  resolvedRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  resolvedText: {
    flex: 1,
    fontSize: 14,
    color: '#475569',
    textAlign: 'right',
    fontWeight: '500',
  },
});
