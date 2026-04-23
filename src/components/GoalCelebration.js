import React, { useEffect, memo } from 'react';
import { View, Text, StyleSheet, Dimensions, Modal } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
  interpolate,
  Extrapolate,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const GOAL_DATA = {
  calories: { label: 'קלוריות', emoji: '🔥', color: '#F97316' },
  protein: { label: 'חלבון', emoji: '💪', color: '#8B5CF6' },
  fat: { label: 'שומן', emoji: '🥑', color: '#EC4899' },
  water: { label: 'מים', emoji: '💧', color: '#0EA5E9' },
};

const GoalCelebration = ({ visible, goalType, userName, onComplete }) => {
  const goalInfo = GOAL_DATA[goalType] || GOAL_DATA.calories;
  
  // Main animations
  const progress = useSharedValue(0);
  const lineX = useSharedValue(-150);
  const lineY = useSharedValue(-80);
  const colorFill = useSharedValue(0);
  const showSuccess = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Reset
      progress.value = 0;
      lineX.value = -150;
      lineY.value = -80;
      colorFill.value = 0;
      showSuccess.value = 0;

      // Fade in
      progress.value = withTiming(1, { duration: 400 });
      
      // Search animation - vertical line (left to right)
      lineX.value = withDelay(300, withSequence(
        withTiming(100, { duration: 800, easing: Easing.inOut(Easing.quad) }),
        withTiming(-60, { duration: 600, easing: Easing.inOut(Easing.quad) }),
        withTiming(40, { duration: 500, easing: Easing.inOut(Easing.quad) }),
        withTiming(-15, { duration: 400, easing: Easing.inOut(Easing.quad) }),
        withTiming(5, { duration: 300, easing: Easing.inOut(Easing.quad) }),
        withSpring(0, { damping: 12, stiffness: 150 })
      ));
      
      // Search animation - horizontal line (top to bottom)
      lineY.value = withDelay(400, withSequence(
        withTiming(60, { duration: 750, easing: Easing.inOut(Easing.quad) }),
        withTiming(-40, { duration: 550, easing: Easing.inOut(Easing.quad) }),
        withTiming(30, { duration: 450, easing: Easing.inOut(Easing.quad) }),
        withTiming(-10, { duration: 350, easing: Easing.inOut(Easing.quad) }),
        withTiming(3, { duration: 250, easing: Easing.inOut(Easing.quad) }),
        withSpring(0, { damping: 12, stiffness: 150 })
      ));
      
      // Color fill when locked
      colorFill.value = withDelay(3200, withTiming(1, { duration: 500 }));
      
      // Show success
      showSuccess.value = withDelay(3800, withTiming(1, { duration: 400 }));
      
      // Auto close
      const timer = setTimeout(() => {
        progress.value = withTiming(0, { duration: 350 });
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 350);
      }, 5500);
      
      return () => clearTimeout(timer);
    }
  }, [visible, goalType]);

  // Styles
  const containerStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.9, 1], Extrapolate.CLAMP) }],
  }));

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.8, 1], Extrapolate.CLAMP) }],
  }));

  const lineHStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lineY.value }],
    opacity: interpolate(colorFill.value, [0, 0.5], [1, 0], Extrapolate.CLAMP),
  }));

  const lineVStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: lineX.value }],
    opacity: interpolate(colorFill.value, [0, 0.5], [1, 0], Extrapolate.CLAMP),
  }));

  const grayTextStyle = useAnimatedStyle(() => ({
    opacity: interpolate(colorFill.value, [0, 1], [1, 0], Extrapolate.CLAMP),
  }));

  const colorTextStyle = useAnimatedStyle(() => ({
    opacity: colorFill.value,
    transform: [
      { scale: interpolate(colorFill.value, [0, 0.5, 1], [1, 1.1, 1], Extrapolate.CLAMP) },
    ],
  }));

  const successStyle = useAnimatedStyle(() => ({
    opacity: showSuccess.value,
    transform: [
      { translateY: interpolate(showSuccess.value, [0, 1], [20, 0], Extrapolate.CLAMP) },
    ],
  }));

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View style={[styles.overlay, containerStyle]}>
        <View style={styles.dimmed} />
        
        <Animated.View style={[styles.circle, circleStyle]}>
          {/* Target area for text - positioned above center */}
          <View style={styles.targetArea}>
            {/* Search lines - relative to target area */}
            <Animated.View style={[styles.lineH, lineHStyle, { backgroundColor: goalInfo.color }]} />
            <Animated.View style={[styles.lineV, lineVStyle, { backgroundColor: goalInfo.color }]} />
            
            {/* Text - Gray */}
            <Animated.Text style={[styles.text, styles.textGray, grayTextStyle]}>
              {goalInfo.label}
            </Animated.Text>
            
            {/* Text - Colored */}
            <Animated.Text style={[styles.text, styles.textColored, colorTextStyle, { color: goalInfo.color }]}>
              {goalInfo.label}
            </Animated.Text>
          </View>
          
          {/* Success */}
          <Animated.View style={[styles.success, successStyle]}>
            <Text style={styles.emoji}>{goalInfo.emoji}</Text>
            <Text style={[styles.achieved, { color: goalInfo.color }]}>יעד הושג!</Text>
            <Text style={styles.check}>✓</Text>
          </Animated.View>
          
          {/* Name */}
          <Animated.View style={[styles.nameRow, successStyle]}>
            <Text style={styles.congrats}>כל הכבוד </Text>
            <Text style={[styles.name, { color: goalInfo.color }]}>{userName || 'מלך'}</Text>
            <Text style={styles.congrats}>! 🎉</Text>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dimmed: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  circle: {
    width: SCREEN_WIDTH * 0.85,
    height: SCREEN_WIDTH * 0.85,
    borderRadius: SCREEN_WIDTH * 0.5,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  targetArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  lineH: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.6,
    height: 2.5,
    borderRadius: 2,
  },
  lineV: {
    position: 'absolute',
    width: 2.5,
    height: 120,
    borderRadius: 2,
  },
  text: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: 1,
  },
  textGray: {
    color: '#9CA3AF',
  },
  textColored: {
    position: 'absolute',
  },
  success: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 25,
    gap: 8,
  },
  emoji: {
    fontSize: 26,
  },
  achieved: {
    fontSize: 22,
    fontWeight: '700',
  },
  check: {
    fontSize: 22,
    color: '#22C55E',
    fontWeight: '800',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  congrats: {
    fontSize: 18,
    color: '#4B5563',
    fontWeight: '600',
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
  },
});

export default memo(GoalCelebration);
