import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Text, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import BrachotNusachReader from '../components/BrachotNusachReader';
import BrachotOtherPicker from '../components/BrachotOtherPicker';
import { TEXT_MIZRACH, TEXT_ASHKENAZ, TEXT_SEFARD } from '../data/birkatHamazonTexts';
import {
  TEXT_MEIN_SHALOSH_MIZRACH,
  TEXT_MEIN_SHALOSH_ASHKENAZ,
  TEXT_MEIN_SHALOSH_SEFARD,
  TEXT_BRACHOT_KATZAR_MIZRACH,
  TEXT_BRACHOT_KATZAR_ASHKENAZ,
  TEXT_BRACHOT_KATZAR_SEFARD,
  TEXT_AL_HAMICHYA_MIZRACH,
  TEXT_AL_HAMICHYA_ASHKENAZ,
  TEXT_AL_HAMICHYA_SEFARD,
} from '../data/otherBrachotTexts';

const BRAND = '#32A728';

const VALID_INITIAL_PRAYER = new Set(['hamazon', 'mein', 'michya', 'short']);

export default function BirkatHamazon() {
  const navigation = useNavigation();
  const route = useRoute();
  const paramPrayer = route.params?.initialPrayer;
  const resolvedInitial =
    typeof paramPrayer === 'string' && VALID_INITIAL_PRAYER.has(paramPrayer)
      ? paramPrayer
      : 'hamazon';

  const [menuOpen, setMenuOpen] = useState(false);
  const [prayer, setPrayer] = useState(resolvedInitial);

  useEffect(() => {
    const p = route.params?.initialPrayer;
    if (typeof p === 'string' && VALID_INITIAL_PRAYER.has(p)) {
      setPrayer(p);
    }
  }, [route.params?.initialPrayer]);

  const { title, textMizrach, textAshkenaz, textSefard } = useMemo(() => {
    if (prayer === 'mein') {
      return {
        title: 'מעין שלוש',
        textMizrach: TEXT_MEIN_SHALOSH_MIZRACH,
        textAshkenaz: TEXT_MEIN_SHALOSH_ASHKENAZ,
        textSefard: TEXT_MEIN_SHALOSH_SEFARD,
      };
    }
    if (prayer === 'michya') {
      return {
        title: 'על המחיה',
        textMizrach: TEXT_AL_HAMICHYA_MIZRACH,
        textAshkenaz: TEXT_AL_HAMICHYA_ASHKENAZ,
        textSefard: TEXT_AL_HAMICHYA_SEFARD,
      };
    }
    if (prayer === 'short') {
      return {
        title: 'בורא נפשות',
        textMizrach: TEXT_BRACHOT_KATZAR_MIZRACH,
        textAshkenaz: TEXT_BRACHOT_KATZAR_ASHKENAZ,
        textSefard: TEXT_BRACHOT_KATZAR_SEFARD,
      };
    }
    return {
      title: 'ברכת המזון',
      textMizrach: TEXT_MIZRACH,
      textAshkenaz: TEXT_ASHKENAZ,
      textSefard: TEXT_SEFARD,
    };
  }, [prayer]);

  const onSelectPrayer = useCallback((k) => {
    setPrayer(k);
    setMenuOpen(false);
  }, []);

  const headerStart = (
    <Pressable
      onPress={() => setMenuOpen(true)}
      style={({ pressed }) => [styles.menuLinkWrap, pressed && { opacity: 0.75 }]}
      accessibilityRole="button"
      accessibilityLabel="לשאר ברכות"
    >
      <Text style={styles.menuLink}>לשאר ברכות</Text>
    </Pressable>
  );

  return (
    <View style={styles.fill}>
      <BrachotNusachReader
        title={title}
        textMizrach={textMizrach}
        textAshkenaz={textAshkenaz}
        textSefard={textSefard}
        onBack={() => navigation.goBack()}
        headerStart={headerStart}
        contentKey={prayer}
      />
      <BrachotOtherPicker
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        currentPrayer={prayer}
        onPick={onSelectPrayer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  menuLinkWrap: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  menuLink: {
    fontSize: 12,
    fontWeight: '600',
    color: BRAND,
    textAlign: 'right',
    textDecorationLine: 'underline',
  },
});
