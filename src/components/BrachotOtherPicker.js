import React, { useEffect, useMemo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BRAND = '#32A728';
const BRAND_LIGHT = '#E8F5E8';
const TEXT_PRIMARY = '#0F1A0E';

const OPTIONS_HAMAZON = [
  { key: 'mein', label: 'מעין שלוש' },
  { key: 'michya', label: 'על המחיה' },
  { key: 'short', label: 'בורא נפשות' },
];

const OPTIONS_OTHER = [
  { key: 'hamazon', label: 'ברכת המזון' },
  { key: 'mein', label: 'מעין שלוש' },
  { key: 'michya', label: 'על המחיה' },
  { key: 'short', label: 'בורא נפשות' },
];

/**
 * Compact anchored menu (top-end) — opens over the same screen, no stack push.
 *
 * @param {object} props
 * @param {boolean} props.visible
 * @param {() => void} props.onClose
 * @param {'hamazon'|'mein'|'michya'|'short'} props.currentPrayer
 * @param {(k: string) => void} props.onPick
 */
export default function BrachotOtherPicker({
  visible,
  onClose,
  currentPrayer,
  onPick,
}) {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const panelW = Math.min(272, winW * 0.78);
  const progress = useSharedValue(0);

  const rows = useMemo(
    () => (currentPrayer === 'hamazon' ? OPTIONS_HAMAZON : OPTIONS_OTHER),
    [currentPrayer]
  );

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 420 : 280,
      easing: Easing.bezier(0.25, 0.8, 0.25, 1),
    });
  }, [visible, progress]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.35,
  }));

  const panelStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * -10 },
      { scale: 0.96 + progress.value * 0.04 },
    ],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.fill} pointerEvents="box-none">
        <Pressable style={styles.backdropPress} onPress={onClose} accessibilityLabel="סגור תפריט">
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
        </Pressable>

        <Animated.View
          style={[
            styles.panel,
            panelStyle,
            {
              top: insets.top + 6,
              width: panelW,
              right: Math.max(12, insets.right),
            },
          ]}
          pointerEvents="box-none"
        >
          <Text style={styles.panelTitle}>שאר ברכות</Text>
          {rows.map((row) => {
            const isCurrent = row.key === currentPrayer;
            return (
              <Pressable
                key={row.key}
                style={({ pressed }) => [
                  styles.row,
                  isCurrent && styles.rowCurrent,
                  pressed && styles.rowPressed,
                ]}
                onPress={() => {
                  if (!isCurrent) onPick(row.key);
                  else onClose();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isCurrent }}
              >
                <Text
                  style={[styles.rowText, isCurrent && styles.rowTextCurrent]}
                  numberOfLines={2}
                >
                  {row.label}
                </Text>
                {isCurrent ? <Text style={styles.hereHint}>כאן</Text> : null}
              </Pressable>
            );
          })}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  backdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    backgroundColor: '#0F1A0E',
  },
  panel: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(50, 167, 40, 0.28)',
    paddingVertical: 8,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 2,
  },
  panelTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND,
    textAlign: 'right',
    paddingHorizontal: 10,
    paddingBottom: 6,
    opacity: 0.85,
  },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
  },
  rowCurrent: {
    backgroundColor: BRAND_LIGHT,
  },
  rowPressed: {
    opacity: 0.88,
  },
  rowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    textAlign: 'right',
  },
  rowTextCurrent: {
    color: BRAND,
  },
  hereHint: {
    fontSize: 11,
    fontWeight: '600',
    color: BRAND,
    opacity: 0.75,
  },
});
