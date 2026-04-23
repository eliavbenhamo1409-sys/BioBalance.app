import React, { useEffect, memo } from 'react';
import { View, Text, StyleSheet, Dimensions, Modal, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
  withRepeat,
  interpolate,
  Extrapolate,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Import logo
const LOGO_IMAGE = require('../../assets/logo.png');

const DailyGoalCelebration = ({ visible, userName, onComplete }) => {
  // Background
  const bgOpacity = useSharedValue(0);
  
  // Logo animations
  const logoScale = useSharedValue(0);
  const logoRotate = useSharedValue(0);
  const logoGlow = useSharedValue(0);
  
  // Crown
  const crownY = useSharedValue(-100);
  const crownScale = useSharedValue(0);
  
  // Text animations
  const titleOpacity = useSharedValue(0);
  const titleScale = useSharedValue(0.5);
  const subtitleOpacity = useSharedValue(0);
  const nameOpacity = useSharedValue(0);
  
  // Stats bar
  const statsOpacity = useSharedValue(0);
  const statsScale = useSharedValue(0.8);
  
  // Rays
  const raysRotation = useSharedValue(0);
  const raysOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Reset all
      bgOpacity.value = 0;
      logoScale.value = 0;
      logoRotate.value = 0;
      logoGlow.value = 0;
      crownY.value = -100;
      crownScale.value = 0;
      titleOpacity.value = 0;
      titleScale.value = 0.5;
      subtitleOpacity.value = 0;
      nameOpacity.value = 0;
      statsOpacity.value = 0;
      statsScale.value = 0.8;
      raysRotation.value = 0;
      raysOpacity.value = 0;

      // === PHASE 1: Background & Logo entrance ===
      bgOpacity.value = withTiming(1, { duration: 500 });
      
      // Logo appears with spring
      logoScale.value = withDelay(300, withSpring(1, { damping: 12, stiffness: 100 }));
      logoRotate.value = withDelay(300, withSequence(
        withTiming(10, { duration: 150 }),
        withTiming(-10, { duration: 150 }),
        withTiming(5, { duration: 100 }),
        withSpring(0, { damping: 10 })
      ));
      
      // === PHASE 2: Rays & Glow ===
      raysOpacity.value = withDelay(800, withTiming(0.5, { duration: 400 }));
      raysRotation.value = withDelay(800, withRepeat(
        withTiming(360, { duration: 20000, easing: Easing.linear }),
        -1,
        false
      ));
      
      logoGlow.value = withDelay(1000, withSequence(
        withTiming(1, { duration: 400 }),
        withTiming(0.5, { duration: 300 })
      ));
      
      // === PHASE 3: Crown drops ===
      crownY.value = withDelay(1500, withSpring(0, { damping: 8, stiffness: 120 }));
      crownScale.value = withDelay(1500, withSpring(1, { damping: 10 }));
      
      // === PHASE 4: Text appears ===
      titleOpacity.value = withDelay(2200, withTiming(1, { duration: 400 }));
      titleScale.value = withDelay(2200, withSpring(1, { damping: 10 }));
      
      subtitleOpacity.value = withDelay(2700, withTiming(1, { duration: 400 }));
      
      nameOpacity.value = withDelay(3200, withTiming(1, { duration: 400 }));
      
      // === PHASE 5: Stats bar ===
      statsOpacity.value = withDelay(3700, withTiming(1, { duration: 400 }));
      statsScale.value = withDelay(3700, withSpring(1, { damping: 12 }));
      
      // Fade rays
      raysOpacity.value = withDelay(4500, withTiming(0.2, { duration: 1000 }));
      
      // === Auto close after 6 seconds ===
      const timer = setTimeout(() => {
        bgOpacity.value = withTiming(0, { duration: 500 });
        logoScale.value = withTiming(0.8, { duration: 500 });
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 500);
      }, 6000);
      
      return () => clearTimeout(timer);
    }
  }, [visible]);

  // Animated styles
  const bgStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
  }));

  const logoContainerStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: logoScale.value },
      { rotate: `${logoRotate.value}deg` },
    ],
  }));

  const logoGlowStyle = useAnimatedStyle(() => ({
    opacity: logoGlow.value,
    transform: [{ scale: interpolate(logoGlow.value, [0, 1], [0.8, 1.3], Extrapolate.CLAMP) }],
  }));

  const raysStyle = useAnimatedStyle(() => ({
    opacity: raysOpacity.value,
    transform: [{ rotate: `${raysRotation.value}deg` }],
  }));

  const crownStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: crownY.value },
      { scale: crownScale.value },
    ],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ scale: titleScale.value }],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  const nameStyle = useAnimatedStyle(() => ({
    opacity: nameOpacity.value,
  }));

  const statsStyle = useAnimatedStyle(() => ({
    opacity: statsOpacity.value,
    transform: [{ scale: statsScale.value }],
  }));

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View style={[styles.container, bgStyle]}>
        {/* Background */}
        <View style={styles.bgDark} />
        
        {/* Rotating rays */}
        <Animated.View style={[styles.raysContainer, raysStyle]}>
          {Array.from({ length: 12 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.ray,
                { transform: [{ rotate: `${i * 30}deg` }] },
              ]}
            />
          ))}
        </Animated.View>
        
        {/* Center content */}
        <View style={styles.content}>
          {/* Crown */}
          <Animated.Text style={[styles.crown, crownStyle]}>👑</Animated.Text>
          
          {/* Logo with glow */}
          <Animated.View style={[styles.logoContainer, logoContainerStyle]}>
            <Animated.View style={[styles.logoGlow, logoGlowStyle]} />
            <Image source={LOGO_IMAGE} style={styles.logo} resizeMode="contain" />
          </Animated.View>
          
          {/* Title */}
          <Animated.Text style={[styles.title, titleStyle]}>
            יעד יומי הושג!
          </Animated.Text>
          
          {/* Subtitle */}
          <Animated.Text style={[styles.subtitle, subtitleStyle]}>
            השלמת את כל היעדים להיום
          </Animated.Text>
          
          {/* User name */}
          <Animated.View style={[styles.nameContainer, nameStyle]}>
            <Text style={styles.congrats}>כל הכבוד </Text>
            <Text style={styles.name}>{userName || 'אלוף'}</Text>
            <Text style={styles.congrats}>! 🎊</Text>
          </Animated.View>
          
          {/* Stats bar */}
          <Animated.View style={[styles.statsBar, statsStyle]}>
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>🔥</Text>
              <Text style={styles.statText}>100%</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>💪</Text>
              <Text style={styles.statText}>100%</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>🥑</Text>
              <Text style={styles.statText}>100%</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>💧</Text>
              <Text style={styles.statText}>100%</Text>
            </View>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bgDark: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  raysContainer: {
    position: 'absolute',
    width: SCREEN_WIDTH * 2,
    height: SCREEN_WIDTH * 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ray: {
    position: 'absolute',
    width: 3,
    height: SCREEN_WIDTH,
    backgroundColor: '#22C55E',
    opacity: 0.4,
    borderRadius: 2,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  crown: {
    fontSize: 55,
    marginBottom: -15,
    zIndex: 10,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 25,
  },
  logoGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#22C55E',
  },
  logo: {
    width: 100,
    height: 100,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#22C55E',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(34, 197, 94, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  subtitle: {
    fontSize: 17,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 18,
    opacity: 0.9,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  congrats: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  name: {
    fontSize: 20,
    color: '#FFD700',
    fontWeight: '800',
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  statIcon: {
    fontSize: 22,
    marginBottom: 3,
  },
  statText: {
    fontSize: 13,
    color: '#22C55E',
    fontWeight: '700',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});

export default memo(DailyGoalCelebration);
