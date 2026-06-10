import React, { useEffect, memo, useMemo, useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const LOGO_IMAGE = require('../../assets/logo.png');

const PARTICLE_COUNT = 48;
const RING_COUNT = 3;

const PARTICLE_COLORS = [
  '#22C55E',
  '#FFD700',
  '#F97316',
  '#EC4899',
  '#0EA5E9',
  '#A855F7',
  '#FFFFFF',
];

const GOALS = [
  { key: 'calories', label: 'קלוריות', emoji: '🔥', color: '#F97316' },
  { key: 'protein', label: 'חלבון', emoji: '💪', color: '#A855F7' },
  { key: 'fat', label: 'שומן', emoji: '🥑', color: '#EC4899' },
  { key: 'water', label: 'מים', emoji: '💧', color: '#0EA5E9' },
];

/** A single particle that bursts radially outward from screen center. */
function Particle({ index, total, kickoff }) {
  const t = useSharedValue(0);

  const seed = useMemo(() => {
    const angle = (index / total) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const distance = 140 + Math.random() * 200;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    const size = 6 + Math.random() * 10;
    const color = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];
    const rotEnd = (Math.random() - 0.5) * 720;
    const duration = 1100 + Math.random() * 700;
    const gravity = 200 + Math.random() * 220;
    const isStar = Math.random() < 0.3;
    return { dx, dy, size, color, rotEnd, duration, gravity, isStar };
  }, [index, total]);

  useEffect(() => {
    if (kickoff > 0) {
      t.value = 0;
      t.value = withTiming(1, {
        duration: seed.duration,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [kickoff]);

  const style = useAnimatedStyle(() => {
    const x = seed.dx * t.value;
    const y = seed.dy * t.value + seed.gravity * t.value * t.value;
    const opacity = interpolate(
      t.value,
      [0, 0.1, 0.75, 1],
      [0, 1, 1, 0],
      Extrapolate.CLAMP,
    );
    const rotation = seed.rotEnd * t.value;
    return {
      opacity,
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${rotation}deg` },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          width: seed.size,
          height: seed.isStar ? seed.size : seed.size * 1.4,
          backgroundColor: seed.color,
          borderRadius: seed.isStar ? seed.size / 2 : 2,
        },
        style,
      ]}
    />
  );
}

/** Expanding ring shockwave. */
function ShockwaveRing({ delay, color = '#22C55E' }) {
  const v = useSharedValue(0);

  useEffect(() => {
    v.value = 0;
    v.value = withDelay(
      delay,
      withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(v.value, [0, 0.2, 1], [0, 0.55, 0], Extrapolate.CLAMP),
    transform: [{ scale: interpolate(v.value, [0, 1], [0.2, 3], Extrapolate.CLAMP) }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.ring, { borderColor: color }, style]}
    />
  );
}

function GoalBadge({ goal, index, kickoff }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (kickoff > 0) {
      scale.value = 0;
      opacity.value = 0;
      const d = 1900 + index * 160;
      opacity.value = withDelay(d, withTiming(1, { duration: 180 }));
      scale.value = withDelay(
        d,
        withSequence(
          withSpring(1.25, { damping: 6, stiffness: 220 }),
          withSpring(1, { damping: 10, stiffness: 180 }),
        ),
      );
    }
  }, [kickoff]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.badge, { borderColor: goal.color }, style]}>
      <Text style={styles.badgeEmoji}>{goal.emoji}</Text>
      <Text style={[styles.badgePct, { color: goal.color }]}>100%</Text>
      <Text style={[styles.badgeCheck, { color: goal.color }]}>✓</Text>
    </Animated.View>
  );
}

const DailyGoalCelebration = ({ visible, userName, onComplete }) => {
  const flash = useSharedValue(0);
  const bgOpacity = useSharedValue(0);
  const raysRot = useSharedValue(0);
  const raysOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0);
  const logoRot = useSharedValue(-20);
  const logoGlow = useSharedValue(0);
  const titleSlamY = useSharedValue(-220);
  const titleScale = useSharedValue(0.4);
  const titleOpacity = useSharedValue(0);
  const titleShake = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const nameOpacity = useSharedValue(0);

  const [kick, setKick] = useState(0);

  const triggerHaptics = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 200);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 1900);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 2080);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 2240);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 2400);
    } catch (_) {}
  };

  useEffect(() => {
    if (!visible) return;

    flash.value = 0;
    bgOpacity.value = 0;
    raysRot.value = 0;
    raysOpacity.value = 0;
    logoScale.value = 0;
    logoRot.value = -20;
    logoGlow.value = 0;
    titleSlamY.value = -220;
    titleScale.value = 0.4;
    titleOpacity.value = 0;
    titleShake.value = 0;
    subtitleOpacity.value = 0;
    nameOpacity.value = 0;

    setKick((v) => v + 1);

    bgOpacity.value = withTiming(1, { duration: 220 });

    // PHASE 1: WHITE FLASH + burst
    flash.value = withSequence(
      withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 320, easing: Easing.out(Easing.quad) }),
    );

    raysOpacity.value = withDelay(160, withTiming(0.65, { duration: 380 }));
    raysRot.value = withRepeat(
      withTiming(360, { duration: 14000, easing: Easing.linear }),
      -1,
      false,
    );

    // PHASE 2: LOGO PUNCH
    logoScale.value = withDelay(
      120,
      withSequence(
        withSpring(1.35, { damping: 7, stiffness: 220 }),
        withSpring(1, { damping: 9, stiffness: 160 }),
      ),
    );
    logoRot.value = withDelay(
      120,
      withSequence(
        withTiming(15, { duration: 140 }),
        withTiming(-10, { duration: 140 }),
        withSpring(0, { damping: 8, stiffness: 200 }),
      ),
    );
    logoGlow.value = withDelay(
      350,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.45, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      ),
    );

    // PHASE 3: TITLE SLAMS DOWN
    titleSlamY.value = withDelay(
      900,
      withSpring(0, { damping: 9, stiffness: 220, mass: 0.9 }),
    );
    titleScale.value = withDelay(
      900,
      withSequence(
        withSpring(1.1, { damping: 6, stiffness: 240 }),
        withSpring(1, { damping: 9, stiffness: 180 }),
      ),
    );
    titleOpacity.value = withDelay(900, withTiming(1, { duration: 200 }));
    titleShake.value = withDelay(
      1080,
      withSequence(
        withTiming(-8, { duration: 60 }),
        withTiming(8, { duration: 60 }),
        withTiming(-5, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      ),
    );

    subtitleOpacity.value = withDelay(1400, withTiming(1, { duration: 350 }));
    nameOpacity.value = withDelay(1700, withTiming(1, { duration: 350 }));

    triggerHaptics();

    const timer = setTimeout(() => {
      bgOpacity.value = withTiming(0, { duration: 600 });
      flash.value = 0;
      setTimeout(() => onComplete && onComplete(), 600);
    }, 6500);

    return () => clearTimeout(timer);
  }, [visible]);

  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const bgStyle = useAnimatedStyle(() => ({ opacity: bgOpacity.value }));
  const raysStyle = useAnimatedStyle(() => ({
    opacity: raysOpacity.value,
    transform: [{ rotate: `${raysRot.value}deg` }],
  }));
  const logoContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }, { rotate: `${logoRot.value}deg` }],
  }));
  const logoGlowStyle = useAnimatedStyle(() => ({
    opacity: logoGlow.value * 0.85,
    transform: [
      { scale: interpolate(logoGlow.value, [0, 1], [0.9, 1.4], Extrapolate.CLAMP) },
    ],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [
      { translateY: titleSlamY.value },
      { translateX: titleShake.value },
      { scale: titleScale.value },
    ],
  }));
  const subtitleStyle = useAnimatedStyle(() => ({ opacity: subtitleOpacity.value }));
  const nameStyle = useAnimatedStyle(() => ({ opacity: nameOpacity.value }));

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.container, bgStyle]}>
        <LinearGradient
          colors={['#0B1120', '#0F2A1F', '#0B1120']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />

        <Animated.View style={[styles.raysContainer, raysStyle]} pointerEvents="none">
          {Array.from({ length: 14 }).map((_, i) => (
            <View
              key={i}
              style={[styles.ray, { transform: [{ rotate: `${i * (360 / 14)}deg` }] }]}
            />
          ))}
        </Animated.View>

        <View style={styles.burstAnchor} pointerEvents="none">
          {Array.from({ length: RING_COUNT }).map((_, i) => (
            <ShockwaveRing
              key={`ring_${kick}_${i}`}
              delay={i * 220}
              color={i === 0 ? '#FFFFFF' : i === 1 ? '#22C55E' : '#FFD700'}
            />
          ))}
          {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
            <Particle key={`p_${kick}_${i}`} index={i} total={PARTICLE_COUNT} kickoff={kick} />
          ))}
        </View>

        <View style={styles.content}>
          <Animated.View style={[styles.logoWrap, logoContainerStyle]}>
            <Animated.View style={[styles.logoGlow, logoGlowStyle]} />
            <Image source={LOGO_IMAGE} style={styles.logo} resizeMode="contain" />
          </Animated.View>

          <Animated.Text style={[styles.title, titleStyle]}>יום מושלם!</Animated.Text>

          <Animated.Text style={[styles.subtitle, subtitleStyle]}>
            סגרת את כל היעדים היומיים
          </Animated.Text>

          <Animated.View style={[styles.nameRow, nameStyle]}>
            <Text style={styles.congrats}>כל הכבוד </Text>
            <Text style={styles.name}>{userName || 'אלוף'}</Text>
            <Text style={styles.congrats}>! 🏆</Text>
          </Animated.View>

          <View style={styles.badgesRow}>
            {GOALS.map((g, i) => (
              <GoalBadge key={`${g.key}_${kick}`} goal={g} index={i} kickoff={kick} />
            ))}
          </View>
        </View>

        <Animated.View style={[styles.flash, flashStyle]} pointerEvents="none" />
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
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
  },
  raysContainer: {
    position: 'absolute',
    width: SCREEN_WIDTH * 2.4,
    height: SCREEN_WIDTH * 2.4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ray: {
    position: 'absolute',
    width: 4,
    height: SCREEN_WIDTH * 1.1,
    backgroundColor: 'rgba(34, 197, 94, 0.35)',
    borderRadius: 4,
  },
  burstAnchor: {
    position: 'absolute',
    width: 0,
    height: 0,
    top: '50%',
    left: '50%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  ring: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.7,
    marginLeft: -SCREEN_WIDTH * 0.35,
    marginTop: -SCREEN_WIDTH * 0.35,
    borderRadius: SCREEN_WIDTH * 0.5,
    borderWidth: 3,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  logoGlow: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#22C55E',
  },
  logo: {
    width: 110,
    height: 110,
  },
  title: {
    fontSize: 44,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(34, 197, 94, 0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 22,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 14,
    textAlign: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  congrats: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  name: {
    fontSize: 19,
    color: '#FFD700',
    fontWeight: '800',
    textShadowColor: 'rgba(255, 215, 0, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  badge: {
    width: 64,
    height: 80,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  badgeEmoji: {
    fontSize: 22,
    marginBottom: 2,
  },
  badgePct: {
    fontSize: 12,
    fontWeight: '800',
  },
  badgeCheck: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 1,
  },
});

export default memo(DailyGoalCelebration);
