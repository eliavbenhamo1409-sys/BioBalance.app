// ============================================================
// SourceCitation
// ============================================================
// Reusable footer that surfaces the data sources behind any
// nutritional / health figure shown in the app, plus an optional
// non-medical-advice disclaimer.
//
// Required by Apple App Store Guideline 1.4.1 — apps with health
// or medical information must cite their sources.
// ============================================================

import React from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const COLORS = {
  text: '#6B7280',
  link: '#16A34A',
  faint: '#9CA3AF',
};

const SOURCES = {
  usdaFdc: {
    label: 'USDA FoodData Central',
    url: 'https://fdc.nal.usda.gov/',
  },
  usda: {
    label: 'USDA',
    url: 'https://www.usda.gov/',
  },
  who: {
    label: 'WHO – BMI',
    url: 'https://www.who.int/health-topics/obesity',
  },
  cdc: {
    label: 'CDC',
    url: 'https://www.cdc.gov/healthyweight/assessing/bmi/',
  },
  mifflin: {
    label: 'Mifflin–St Jeor (1990)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/2305711/',
  },
};

const openUrl = (url) => {
  Linking.openURL(url).catch(() => {});
};

const SourceLink = ({ source, linkColor }) => (
  <Text
    style={[styles.link, linkColor ? { color: linkColor } : null]}
    onPress={() => openUrl(source.url)}
    suppressHighlighting
  >
    {source.label}
  </Text>
);

/**
 * Variants:
 *  - "compact"   : single short line — USDA FoodData Central
 *  - "full"      : USDA + WHO BMI + Mifflin–St Jeor
 *  - "ai"        : like "full" but focused on AI report wording
 *
 * Props:
 *  - variant: 'compact' | 'full' | 'ai'           (default: 'compact')
 *  - showDisclaimer: boolean                       (default: false)
 *  - style: optional outer style override
 *  - onPressMore: optional override for "מקורות נוספים" tap
 *  - palette: optional { text, link, faint } to override citation colors
 */
export default function SourceCitation({
  variant = 'compact',
  showDisclaimer = false,
  style,
  onPressMore,
  palette,
}) {
  const c = { ...COLORS, ...(palette || {}) };
  let navigation = null;
  try {
    navigation = useNavigation();
  } catch {
    navigation = null;
  }

  const handleMore = () => {
    if (onPressMore) {
      onPressMore();
      return;
    }
    if (navigation?.navigate) {
      try {
        navigation.navigate('Sources');
      } catch {}
    }
  };

  return (
    <View style={[styles.container, style]} accessible accessibilityRole="text">
      {variant === 'compact' && (
        <Text style={[styles.line, { color: c.text }]}>
          מקור נתוני מזון: <SourceLink source={SOURCES.usdaFdc} linkColor={c.link} />
          {'  '}
          <Pressable onPress={handleMore} hitSlop={6}>
            <Text style={[styles.moreLink, { color: c.link }]}>מקורות נוספים</Text>
          </Pressable>
        </Text>
      )}

      {variant === 'full' && (
        <>
          <Text style={[styles.line, { color: c.text }]}>
            מקור נתוני מזון: <SourceLink source={SOURCES.usdaFdc} linkColor={c.link} />
          </Text>
          <Text style={[styles.line, { color: c.text }]}>
            סיווג BMI: <SourceLink source={SOURCES.who} linkColor={c.link} />
            {'  ·  '}
            חישוב BMR/TDEE: <SourceLink source={SOURCES.mifflin} linkColor={c.link} />
          </Text>
          <TouchableOpacity onPress={handleMore} hitSlop={8}>
            <Text style={[styles.moreLink, { color: c.link }]}>אודות ומקורות מלאים →</Text>
          </TouchableOpacity>
        </>
      )}

      {variant === 'ai' && (
        <>
          <Text style={[styles.line, { color: c.text }]}>
            ניתוח מבוסס נתוני <SourceLink source={SOURCES.usdaFdc} linkColor={c.link} />
            {'  ·  '}
            <SourceLink source={SOURCES.who} linkColor={c.link} />
            {'  ·  '}
            <SourceLink source={SOURCES.mifflin} linkColor={c.link} />
          </Text>
          <TouchableOpacity onPress={handleMore} hitSlop={8}>
            <Text style={[styles.moreLink, { color: c.link }]}>אודות ומקורות מלאים →</Text>
          </TouchableOpacity>
        </>
      )}

      {showDisclaimer && (
        <Text style={[styles.disclaimer, { color: c.faint }]}>
          המידע אינפורמטיבי בלבד ואינו מהווה ייעוץ רפואי. התייעץ עם רופא או דיאטן/ית מוסמכ/ת לפני שינויים תזונתיים.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 4,
  },
  line: {
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.text,
    textAlign: 'right',
  },
  link: {
    color: COLORS.link,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  moreLink: {
    fontSize: 11,
    color: COLORS.link,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 10.5,
    lineHeight: 15,
    color: COLORS.faint,
    fontStyle: 'italic',
    textAlign: 'right',
    marginTop: 4,
  },
});
