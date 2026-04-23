import React, { memo, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withDelay,
  withSequence,
  withTiming,
  interpolate,
  Extrapolate,
  Easing,
} from 'react-native-reanimated';

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 90,
  mass: 0.7,
};

const AnimatedDot = memo(({ delay }) => {
  const bounce = useSharedValue(0);

  useEffect(() => {
    bounce.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 300, easing: Easing.in(Easing.ease) })
        ),
        -1,
        false
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(bounce.value, [0, 1], [0.3, 1], Extrapolate.CLAMP),
    transform: [
      { translateY: interpolate(bounce.value, [0, 1], [0, -6], Extrapolate.CLAMP) },
      { scale: interpolate(bounce.value, [0, 1], [1, 1.2], Extrapolate.CLAMP) },
    ],
  }));

  return <Animated.View style={[styles.dot, style]} />;
});

function TypingIndicator() {
  const containerProgress = useSharedValue(0);
  const morphProgress = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    containerProgress.value = withSpring(1, SPRING_CONFIG);
    
    // Circle to square morph animation
    morphProgress.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    
    // Continuous rotation
    rotation.value = withRepeat(
      withTiming(360, { duration: 3200, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(containerProgress.value, [0, 0.6], [0, 1], Extrapolate.CLAMP),
    transform: [
      { translateX: interpolate(containerProgress.value, [0, 1], [-20, 0], Extrapolate.CLAMP) },
      { scale: interpolate(containerProgress.value, [0, 1], [0.9, 1], Extrapolate.CLAMP) },
    ],
  }));

  const avatarStyle = useAnimatedStyle(() => ({
    opacity: interpolate(containerProgress.value, [0.3, 1], [0, 1], Extrapolate.CLAMP),
    transform: [
      { scale: interpolate(containerProgress.value, [0.3, 1], [0.5, 1], Extrapolate.CLAMP) },
    ],
  }));

  // Morphing dot: circle (borderRadius 5) -> square (borderRadius 2)
  const morphDotStyle = useAnimatedStyle(() => ({
    borderRadius: interpolate(morphProgress.value, [0, 1], [5, 2], Extrapolate.CLAMP),
    transform: [
      { rotate: `${rotation.value}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <Animated.View style={[styles.avatar, avatarStyle]}>
        <Animated.View style={[styles.greenDot, morphDotStyle]} />
      </Animated.View>
      <View style={styles.bubble}>
        <AnimatedDot delay={0} />
        <AnimatedDot delay={150} />
        <AnimatedDot delay={300} />
      </View>
    </Animated.View>
  );
}

export default memo(TypingIndicator);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 5,
    paddingHorizontal: 4,
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
  greenDot: {
    width: 10,
    height: 10,
    backgroundColor: '#22C55E',
  },
  bubble: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    gap: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
});
