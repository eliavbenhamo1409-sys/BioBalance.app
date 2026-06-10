import React, { memo, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';

// Same spring config as balance header
const SPRING_CONFIG = {
  damping: 20,
  stiffness: 90,
  mass: 0.7,
  overshootClamping: false,
};

const BRAND = '#32A728';

/** ממיר **מודגש** ל־Text מקונן — בלי להציג את כתבי ה־markdown */
export function BubbleRichText({ text, isBot, isNote }) {
  const baseStyle = isNote
    ? [styles.brachotNote]
    : [styles.text, isBot ? styles.botText : styles.userText];
  const boldStyle = isNote
    ? styles.brachotNoteEmphasis
    : isBot
      ? styles.botTextEmphasis
      : styles.userTextEmphasis;
  const s = String(text ?? '');
  if (!s.includes('**')) {
    return <Text style={baseStyle}>{s}</Text>;
  }
  const parts = s.split(/\*\*/);
  return (
    <Text style={baseStyle}>
      {parts.map((part, i) =>
        i % 2 === 0 ? (
          part
        ) : (
          <Text key={i} style={[baseStyle, boldStyle]}>
            {part}
          </Text>
        ),
      )}
    </Text>
  );
}

function ChatMessage({ message, isBot, actionButton, brachotLayout, editButton }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(1, SPRING_CONFIG);
  }, []);

  const showBrachot =
    isBot &&
    brachotLayout &&
    (brachotLayout.before || brachotLayout.after || brachotLayout.note);

  const containerStyle = useAnimatedStyle(() => {
    const translateX = isBot 
      ? interpolate(progress.value, [0, 1], [-30, 0], Extrapolate.CLAMP)
      : interpolate(progress.value, [0, 1], [30, 0], Extrapolate.CLAMP);
    
    return {
      opacity: interpolate(progress.value, [0, 0.6], [0, 1], Extrapolate.CLAMP),
      transform: [
        { translateX },
        { scale: interpolate(progress.value, [0, 1], [0.92, 1], Extrapolate.CLAMP) },
      ],
    };
  });

  const avatarStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.3, 1], [0, 1], Extrapolate.CLAMP),
    transform: [
      { scale: interpolate(progress.value, [0.3, 1], [0.5, 1], Extrapolate.CLAMP) },
    ],
  }));

  return (
    <Animated.View style={[styles.container, isBot ? styles.botContainer : styles.userContainer, containerStyle]}>
      {isBot && (
        <Animated.View style={[styles.avatar, avatarStyle]}>
          <View style={styles.grayDot} />
        </Animated.View>
      )}
      <View style={[styles.bubble, isBot ? styles.botBubble : styles.userBubble]}>
        {showBrachot ? (
          <View style={styles.brachotWrap}>
            {brachotLayout.before ? (
              <Text style={[styles.text, styles.botText]}>
                <Text style={styles.brachotLabel}>לפני</Text>
                {'\n'}
                <BubbleRichText text={brachotLayout.before} isBot />
              </Text>
            ) : null}
            {brachotLayout.after ? (
              <Text
                style={[
                  styles.text,
                  styles.botText,
                  brachotLayout.before ? styles.brachotBlockSpacer : null,
                ]}
              >
                <Text style={styles.brachotLabel}>אחרי</Text>
                {'\n'}
                <BubbleRichText text={brachotLayout.after} isBot />
              </Text>
            ) : null}
            {brachotLayout.note ? (
              <View
                style={
                  brachotLayout.before || brachotLayout.after
                    ? styles.brachotBlockSpacer
                    : null
                }
              >
                <BubbleRichText text={brachotLayout.note} isBot isNote />
              </View>
            ) : null}
          </View>
        ) : (
          <BubbleRichText text={message} isBot={isBot} />
        )}
        {isBot && actionButton?.label && actionButton?.onPress ? (
          <Pressable
            onPress={actionButton.onPress}
            style={({ pressed }) => [
              styles.actionBtn,
              pressed && styles.actionBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={actionButton.label}
          >
            <Text style={styles.actionBtnText}>{actionButton.label}</Text>
          </Pressable>
        ) : null}
        {isBot && editButton?.onPress ? (
          <Pressable
            onPress={editButton.onPress}
            style={({ pressed }) => [
              styles.editPill,
              pressed && styles.editPillPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={editButton.label || 'ערוך ארוחה'}
            hitSlop={8}
          >
            <Ionicons name="create-outline" size={13} color={BRAND} />
            <Text style={styles.editPillText}>
              {editButton.label || 'ערוך'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

export default memo(ChatMessage);

const styles = StyleSheet.create({
  brachotWrap: {
    alignSelf: 'stretch',
  },
  brachotLabel: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
  },
  brachotBlockSpacer: {
    marginTop: 14,
  },
  brachotNote: {
    fontSize: 13,
    lineHeight: 20,
    color: '#64748B',
    textAlign: 'right',
  },
  brachotNoteEmphasis: {
    fontWeight: '800',
    color: '#64748B',
  },
  botTextEmphasis: {
    fontWeight: '800',
    color: '#0F172A',
  },
  userTextEmphasis: {
    fontWeight: '800',
    color: '#FFFFFF',
  },
  container: {
    flexDirection: 'row',
    marginVertical: 5,
    alignItems: 'flex-end',
    paddingHorizontal: 4,
  },
  botContainer: {
    justifyContent: 'flex-start',
  },
  userContainer: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  grayDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#32A728',  // Logo green
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  botBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  userBubble: {
    backgroundColor: '#0F172A',
    borderBottomRightRadius: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  botText: {
    color: '#1E293B',
    textAlign: 'right',
  },
  userText: {
    color: '#FFFFFF',
    textAlign: 'right',
  },
  actionBtn: {
    marginTop: 12,
    alignSelf: 'stretch',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: BRAND,
    backgroundColor: '#F0FDF4',
  },
  actionBtnPressed: {
    opacity: 0.85,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND,
    textAlign: 'center',
  },
  editPill: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D4EDD1',
    backgroundColor: '#F0FDF4',
  },
  editPillPressed: {
    opacity: 0.7,
  },
  editPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND,
  },
});
