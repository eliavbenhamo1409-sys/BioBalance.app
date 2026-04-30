import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BRAND = '#32A728';
const BRAND_LIGHT = '#E8F5E8';
const TEXT_PRIMARY = '#0F1A0E';

const NUSACH_TABS = [
  { key: 'mizrach', label: 'עדות המזרח' },
  { key: 'ashkenaz', label: 'אשכנז' },
  { key: 'sefard', label: 'ספרד' },
];

/**
 * Shared layout: Hebrew bracha body + tri nusach segment (עה״מ / אשכנז / ספרד).
 *
 * @param {object} props
 * @param {string} props.title — centered header title
 * @param {string} props.textMizrach
 * @param {string} props.textAshkenaz
 * @param {string} props.textSefard
 * @param {() => void} props.onBack
 * @param {string} [props.contentKey] — when changed, scroll body back to top
 */
export default function BrachotNusachReader({
  title,
  textMizrach,
  textAshkenaz,
  textSefard,
  onBack,
  headerStart = null,
  contentKey = '',
}) {
  const [variant, setVariant] = useState('mizrach');
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [contentKey, textMizrach, textAshkenaz, textSefard]);

  const body = useMemo(() => {
    if (variant === 'mizrach') return textMizrach;
    if (variant === 'ashkenaz') return textAshkenaz;
    return textSefard;
  }, [variant, textMizrach, textAshkenaz, textSefard]);

  const onPick = useCallback((key) => () => setVariant(key), []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerStart}>
          {headerStart}
        </View>
        <Text style={styles.headerTitle} numberOfLines={2}>
          {title}
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="חזרה"
        >
          <Text style={styles.backIcon}>→</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.segmentWrap}>
        {NUSACH_TABS.map((tab, index) => (
          <Pressable
            key={tab.key}
            style={({ pressed }) => [
              styles.segmentCell,
              index > 0 && styles.segmentCellAfter,
              variant === tab.key && styles.segmentActive,
              pressed && styles.segmentPressed,
            ]}
            onPress={onPick(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: variant === tab.key }}
          >
            <Text
              style={[
                styles.segmentLabel,
                variant === tab.key ? styles.segmentLabelActive : styles.segmentLabelIdle,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.bodyText} selectable>
          {body}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(50, 167, 40, 0.12)',
    gap: 4,
  },
  headerStart: {
    maxWidth: '32%',
    minWidth: 72,
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
    flexShrink: 0,
  },
  backIcon: {
    fontSize: 16,
    color: BRAND,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    textAlign: 'center',
  },
  segmentWrap: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
    padding: 3,
    borderRadius: 10,
    backgroundColor: BRAND_LIGHT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(50, 167, 40, 0.25)',
    gap: 2,
  },
  segmentCell: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  segmentCellAfter: {
    marginLeft: 0,
  },
  segmentActive: {
    backgroundColor: BRAND,
  },
  segmentPressed: {
    opacity: 0.92,
  },
  segmentLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  segmentLabelActive: {
    color: '#FFFFFF',
  },
  segmentLabelIdle: {
    color: BRAND,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 32,
    paddingTop: 8,
  },
  bodyText: {
    fontSize: 17,
    lineHeight: 28,
    color: TEXT_PRIMARY,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
