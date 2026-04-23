import React, { memo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

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
  on3DPress,
}) {
  const showSendBtn = inputText?.trim()?.length > 0;
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
    if (showSendBtn) {
      onSend?.();
    }
  };

  const handleWater = () => {
    onWater?.();
  };

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <View style={styles.inputCard}>
        {/* Daily Plan Button - Calendar icon */}
        {onDailyPlanPress && (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onDailyPlanPress}
            activeOpacity={0.7}
          >
            <View style={styles.planBtn}>
              <Text style={styles.planIcon}>📋</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* 3D Weight - Clean text button */}
        {on3DPress && (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={on3DPress}
            activeOpacity={0.7}
          >
            <View style={styles.threeDBtn}>
              <Text style={styles.threeDText}>3D</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Camera Button */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onCameraPress}
          activeOpacity={0.7}
        >
          <Text style={styles.cameraIcon}>📷</Text>
        </TouchableOpacity>

        {/* Input Field */}
        <View style={styles.inputWrapper}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={inputText}
            onChangeText={onChangeText}
            placeholder="ספר לי מה אכלת..."
            placeholderTextColor="#9CA3AF"
            onSubmitEditing={handleSend}
            onFocus={onFocus}
            multiline
            maxLength={200}
            returnKeyType="send"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="none"
          />
        </View>

        {/* Action Button - Send or Water */}
        <AnimatedTouchable
          style={[styles.actionBtn, actionBtnStyle]}
          onPress={showSendBtn ? handleSend : handleWater}
          activeOpacity={0.8}
        >
          {showSendBtn ? (
            <LinearGradient
              colors={['#22C55E', '#16A34A']}
              style={styles.sendBtnGradient}
            >
              <Text style={styles.sendIcon}>↑</Text>
            </LinearGradient>
          ) : (
            <View style={styles.waterBtn}>
              <Text style={styles.waterIcon}>💧</Text>
            </View>
          )}
        </AnimatedTouchable>
      </View>
    </Animated.View>
  );
}

export default memo(InputBar);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
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
  planBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  planIcon: {
    fontSize: 16,
  },
  threeDBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
});
