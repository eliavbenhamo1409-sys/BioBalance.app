import React, { memo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  interpolate,
  Extrapolate,
  Easing,
} from 'react-native-reanimated';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// Same spring config
const SPRING_CONFIG = {
  damping: 18,
  stiffness: 85,
  mass: 0.8,
};

const RecipeSaveBanner = ({ recipeName, onSave, onDismiss }) => {
  const bannerProgress = useSharedValue(0);
  const buttonsProgress = useSharedValue(0);

  useEffect(() => {
    bannerProgress.value = withSpring(1, SPRING_CONFIG);
    buttonsProgress.value = withDelay(200, withTiming(1, {
      duration: 400,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    }));
  }, []);

  const bannerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(bannerProgress.value, [0, 0.5], [0, 1], Extrapolate.CLAMP),
    transform: [
      { translateY: interpolate(bannerProgress.value, [0, 1], [40, 0], Extrapolate.CLAMP) },
      { scale: interpolate(bannerProgress.value, [0, 1], [0.9, 1], Extrapolate.CLAMP) },
    ],
  }));

  const dismissBtnStyle = useAnimatedStyle(() => ({
    opacity: interpolate(buttonsProgress.value, [0, 0.5], [0, 1], Extrapolate.CLAMP),
    transform: [
      { translateX: interpolate(buttonsProgress.value, [0, 1], [-20, 0], Extrapolate.CLAMP) },
    ],
  }));

  const saveBtnStyle = useAnimatedStyle(() => ({
    opacity: interpolate(buttonsProgress.value, [0.2, 0.7], [0, 1], Extrapolate.CLAMP),
    transform: [
      { translateX: interpolate(buttonsProgress.value, [0, 1], [20, 0], Extrapolate.CLAMP) },
      { scale: interpolate(buttonsProgress.value, [0.3, 1], [0.9, 1], Extrapolate.CLAMP) },
    ],
  }));

  return (
    <Animated.View style={[styles.container, bannerStyle]}>
      <View style={styles.content}>
        <Text style={styles.emoji}>📖</Text>
        <Text style={styles.text}>לשמור את המתכון?</Text>
      </View>

      <View style={styles.buttons}>
        <AnimatedTouchable
          style={[styles.dismissBtn, dismissBtnStyle]}
          onPress={onDismiss}
          activeOpacity={0.7}
        >
          <Text style={styles.dismissText}>לא</Text>
        </AnimatedTouchable>
        <AnimatedTouchable
          style={[styles.saveBtn, saveBtnStyle]}
          onPress={onSave}
          activeOpacity={0.8}
        >
          <Text style={styles.saveText}>כן, שמור ✓</Text>
        </AnimatedTouchable>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginVertical: 10,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    gap: 10,
  },
  emoji: {
    fontSize: 22,
  },
  text: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '700',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  dismissBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dismissText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  saveText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

export default memo(RecipeSaveBanner);
