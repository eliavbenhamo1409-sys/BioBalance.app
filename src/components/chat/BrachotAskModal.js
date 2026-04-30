import React, { useState, useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BRAND = '#32A728';
const BRAND_LIGHT = '#E8F5E8';
const BORDER = '#DCFCE7';

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {() => void} props.onClose
 * @param {() => void} [props.onOpenFullTexts]
 * @param {(question: string) => void} props.onSubmit — סוגר את המודל בצד ההורה וממשיך בצ'אט
 */
export default function BrachotAskModal({
  visible,
  onClose,
  onOpenFullTexts,
  onSubmit,
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) return;
    setQuery('');
  }, [visible]);

  const handleSend = useCallback(() => {
    const q = query.trim();
    if (!q || !onSubmit) return;
    onSubmit(q);
  }, [query, onSubmit]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          style={styles.keyboardWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 6 : 0}
        >
          <View
            style={[
              styles.card,
              {
                paddingBottom: Math.max(insets.bottom, 10) + 4,
              },
            ]}
          >
            <View style={styles.headerRow}>
              <Text style={styles.title}>מה לברך</Text>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel="סגור"
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.hint}>
              כתוב מה אתה רוצה לאכול — אחרי «שלח» התשובה תופיע בצ'אט.
            </Text>

            <TextInput
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder="למשל: פיצה, ענבים, יוגורט…"
              placeholderTextColor="#94A3B8"
              textAlign="right"
              multiline
              maxLength={280}
            />

            <TouchableOpacity
              style={[styles.sendBtn, !query.trim() && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!query.trim()}
              activeOpacity={0.88}
            >
              <Text style={styles.sendBtnText}>שלח</Text>
            </TouchableOpacity>

            {onOpenFullTexts ? (
              <TouchableOpacity
                style={styles.linkRow}
                onPress={onOpenFullTexts}
                activeOpacity={0.75}
              >
                <Text style={styles.linkText}>לנוסחי ברכות מלאים ›</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  keyboardWrap: {
    width: '100%',
    maxHeight: '58%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'right',
    flex: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BRAND_LIGHT,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    color: BRAND,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'right',
    lineHeight: 17,
    marginBottom: 8,
  },
  input: {
    minHeight: 56,
    maxHeight: 88,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  sendBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    marginBottom: 6,
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  linkRow: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
    color: BRAND,
  },
});
