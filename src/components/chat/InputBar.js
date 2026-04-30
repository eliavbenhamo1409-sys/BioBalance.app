import React, { memo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import GrayIconChip from './GrayIconChip';
import { SHOW_CHAT_CAMERA_CAPTURE_IN_UI } from '../../constants/featureFlags';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const SPRING_CONFIG = {
  damping: 18,
  stiffness: 120,
  mass: 0.6,
};

function InputBar({
  inputText,
  onChangeText,
  onSend,
  onCameraPress,
  onWater,
  onFocus,
  onDailyPlanPress,
  /** ניווט למסך ברכות (למשל BirkatHamazon) */
  onBrachotPress,
  on3DPress,
  disabled = false,
  disabledReason = '',
  /** Locks input + side actions while the bot is working (no banner). */
  isBusy = false,
  /** When true with `onStop`, action button becomes stop (cancels generation). */
  canStop = false,
  onStop,
}) {
  const showSendBtn = inputText?.trim()?.length > 0;
  const hardDisabled = disabled;
  const softBusy = isBusy && !hardDisabled;
  const inputLocked = hardDisabled || softBusy;
  const inputRef = React.useRef(null);

  const containerProgress = useSharedValue(0);
  const buttonScale = useSharedValue(1);

  useEffect(() => {
    containerProgress.value = withSpring(1, SPRING_CONFIG);
  }, []);

  useEffect(() => {
    buttonScale.value = withSpring(1, { damping: 15, stiffness: 200 });
  }, [showSendBtn]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(containerProgress.value, [0, 0.5], [0, 1], Extrapolate.CLAMP),
    transform: [
      { translateY: interpolate(containerProgress.value, [0, 1], [20, 0], Extrapolate.CLAMP) },
    ],
  }));

  const actionBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handleSend = () => {
    if (hardDisabled) return;
    if (softBusy) return;
    if (showSendBtn) {
      onSend?.();
    }
  };

  const handleWater = () => {
    if (hardDisabled) return;
    if (softBusy) return;
    onWater?.();
  };

  const handleStop = () => {
    onStop?.();
  };

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {hardDisabled && disabledReason ? (
        <View style={styles.disabledBanner}>
          <Text style={styles.disabledBannerText}>{disabledReason}</Text>
        </View>
      ) : null}
      <View style={[styles.inputCard, hardDisabled && styles.inputCardDisabled, softBusy && styles.inputCardBusy]}>
        {/* תפריט מתוכנן (תכנון ארוחות יומי בצ'אט) */}
        {onDailyPlanPress && (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={inputLocked ? undefined : onDailyPlanPress}
            activeOpacity={0.7}
            disabled={inputLocked}
            accessibilityLabel="תפריט מתוכנן"
            accessibilityRole="button"
          >
            <GrayIconChip size={36}>
              <Text
                style={styles.dailyPlanLabel}
                numberOfLines={2}
                allowFontScaling={false}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                textAlign="center"
              >
                {`תפריט\nמתוכנן`}
              </Text>
            </GrayIconChip>
          </TouchableOpacity>
        )}

        {/* מה לברך — מסך ברכות */}
        {onBrachotPress && (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={inputLocked ? undefined : onBrachotPress}
            activeOpacity={0.7}
            disabled={inputLocked}
            accessibilityLabel="מה לברך"
            accessibilityRole="button"
          >
            <GrayIconChip size={36}>
              <Text
                style={styles.dailyPlanLabel}
                numberOfLines={2}
                allowFontScaling={false}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                textAlign="center"
              >
                {`מה\nלברך`}
              </Text>
            </GrayIconChip>
          </TouchableOpacity>
        )}

        {/* 3D Weight - Clean text button */}
        {on3DPress && (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={inputLocked ? undefined : on3DPress}
            activeOpacity={0.7}
            disabled={inputLocked}
          >
            <GrayIconChip>
              <Text style={styles.threeDText}>3D</Text>
            </GrayIconChip>
          </TouchableOpacity>
        )}

        {/* כפתור המצלמה — מוגדר ב-featureFlags; הקוד נשמר, לא מוצג כשהדגל כבוי */}
        {SHOW_CHAT_CAMERA_CAPTURE_IN_UI && onCameraPress ? (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={inputLocked ? undefined : onCameraPress}
            activeOpacity={0.7}
            disabled={inputLocked}
            accessibilityLabel="צילום ארוחה"
            accessibilityRole="button"
          >
            <GrayIconChip>
              <Text style={styles.cameraIcon}>📷</Text>
            </GrayIconChip>
          </TouchableOpacity>
        ) : null}

        {/* Input Field */}
        <View style={styles.inputWrapper}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={inputText}
            onChangeText={onChangeText}
            placeholder={inputLocked ? 'רגע...' : 'ספר לי מה אכלת...'}
            placeholderTextColor="#9CA3AF"
            onSubmitEditing={handleSend}
            onFocus={onFocus}
            multiline
            maxLength={200}
            returnKeyType="send"
            autoCapitalize="none"
            editable={!inputLocked}
          />
        </View>

        {/* Action: stop (generation) / send / water */}
        {softBusy && canStop && onStop ? (
          <TouchableOpacity
            style={[styles.actionBtn, styles.stopBtn]}
            onPress={handleStop}
            activeOpacity={0.85}
            accessibilityLabel="עצור"
          >
            <View style={styles.stopIconSquare} />
          </TouchableOpacity>
        ) : (
          <AnimatedTouchable
            style={[
              styles.actionBtn,
              actionBtnStyle,
              hardDisabled && styles.actionBtnDisabled,
              softBusy && styles.actionBtnBusy,
            ]}
            onPress={
              hardDisabled || softBusy
                ? undefined
                : (showSendBtn ? handleSend : handleWater)
            }
            activeOpacity={hardDisabled || softBusy ? 1 : 0.8}
            disabled={hardDisabled || softBusy}
          >
            {softBusy ? (
              <View style={styles.busyActionInner}>
                <ActivityIndicator size="small" color="#6B7280" />
              </View>
            ) : showSendBtn ? (
              hardDisabled ? (
                <View style={styles.sendBtnDisabled}>
                  <Text style={styles.sendIconDisabled}>↑</Text>
                </View>
              ) : (
                <LinearGradient
                  colors={['#22C55E', '#16A34A']}
                  style={styles.sendBtnGradient}
                >
                  <Text style={styles.sendIcon}>↑</Text>
                </LinearGradient>
              )
            ) : (
              <View style={[styles.waterBtn, hardDisabled && styles.waterBtnDisabled]}>
                <Text style={styles.waterIcon}>💧</Text>
              </View>
            )}
          </AnimatedTouchable>
        )}
      </View>
    </Animated.View>
  );
}

export default memo(InputBar);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 6,
    // Tight bottom — Home shows the AI disclaimer strip below; extra iOS inset not needed here
    paddingBottom: Platform.OS === 'ios' ? 6 : 6,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 24,
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 6,
    // Subtle green shadow
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    // Very subtle border
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  iconBtn: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dailyPlanLabel: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 8,
    lineHeight: 8.6,
    textAlign: 'center',
    paddingHorizontal: 1,
    width: '100%',
  },
  threeDText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  cameraIcon: {
    fontSize: 20,
  },
  inputWrapper: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  input: {
    fontSize: 15,
    fontWeight: '400',
    color: '#1F2937',
    textAlign: 'right',
    paddingVertical: 8,
    lineHeight: 22,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  sendBtnGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waterBtn: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  sendIcon: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  waterIcon: {
    fontSize: 20,
  },
  disabledBanner: {
    marginHorizontal: 4,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
  },
  disabledBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
    textAlign: 'center',
  },
  inputCardDisabled: {
    opacity: 0.55,
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  sendBtnDisabled: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#D1D5DB',
  },
  sendIconDisabled: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  waterBtnDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  inputCardBusy: {
    opacity: 0.95,
  },
  actionBtnBusy: {
    backgroundColor: '#F3F4F6',
  },
  busyActionInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopBtn: {
    backgroundColor: '#F97316',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EA580C',
  },
  stopIconSquare: {
    width: 11,
    height: 11,
    borderRadius: 1.5,
    backgroundColor: '#FFFFFF',
  },
});
