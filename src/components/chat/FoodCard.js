import React, { useEffect, memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  interpolate,
  Extrapolate,
  Easing,
} from 'react-native-reanimated';

// Same spring config as balance header
const SPRING_CONFIG = {
  damping: 18,
  stiffness: 85,
  mass: 0.8,
  overshootClamping: false,
};

const NutrientItem = memo(({ value, label, color, delay, progress }) => {
  const style = useAnimatedStyle(() => {
    const itemProgress = interpolate(
      progress.value,
      [delay, delay + 0.3],
      [0, 1],
      Extrapolate.CLAMP
    );
    
    return {
      opacity: itemProgress,
      transform: [
        { translateY: interpolate(itemProgress, [0, 1], [15, 0], Extrapolate.CLAMP) },
        { scale: interpolate(itemProgress, [0, 1], [0.9, 1], Extrapolate.CLAMP) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.nutrientItem, style]}>
      <Text style={styles.nutrientValue}>{value}</Text>
      <Text style={styles.nutrientLabel}>{label}</Text>
      <View style={[styles.nutrientDot, { backgroundColor: color }]} />
    </Animated.View>
  );
});

const FoodCard = ({ foodName, calories, protein, fat, carbs }) => {
  const cardProgress = useSharedValue(0);
  const contentProgress = useSharedValue(0);
  const celebrateScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    cardProgress.value = withSpring(1, SPRING_CONFIG);
    contentProgress.value = withDelay(150, withTiming(1, { 
      duration: 500,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    }));
    
    // Celebration pulse effect
    setTimeout(() => {
      celebrateScale.value = withSpring(1.03, { damping: 8, stiffness: 200 });
      glowOpacity.value = withTiming(0.6, { duration: 300 });
      setTimeout(() => {
        celebrateScale.value = withSpring(1, { damping: 12 });
        glowOpacity.value = withTiming(0, { duration: 500 });
      }, 400);
    }, 600);
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(cardProgress.value, [0, 0.5], [0, 1], Extrapolate.CLAMP),
    transform: [
      { scale: interpolate(cardProgress.value, [0, 1], [0.85, 1], Extrapolate.CLAMP) * celebrateScale.value },
      { translateY: interpolate(cardProgress.value, [0, 1], [30, 0], Extrapolate.CLAMP) },
    ],
  }));
  
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const headerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(contentProgress.value, [0, 0.4], [0, 1], Extrapolate.CLAMP),
    transform: [
      { translateX: interpolate(contentProgress.value, [0, 0.4], [-20, 0], Extrapolate.CLAMP) },
    ],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(contentProgress.value, [0.6, 1], [0, 1], Extrapolate.CLAMP),
    transform: [
      { scale: interpolate(contentProgress.value, [0.6, 1], [0.8, 1], Extrapolate.CLAMP) },
    ],
  }));

  return (
    <Animated.View style={[styles.container, cardStyle]}>
      {/* Success glow effect */}
      <Animated.View style={[styles.glowOverlay, glowStyle]} />
      
      {/* Gradient accent */}
      <View style={styles.accentBar} />
      
      {/* Header */}
      <Animated.View style={[styles.header, headerStyle]}>
        <View style={styles.checkContainer}>
          <Text style={styles.checkmark}>✓</Text>
        </View>
        <Text style={styles.title}>{foodName}</Text>
      </Animated.View>

      {/* Nutrients Grid */}
      <View style={styles.nutrientsGrid}>
        <NutrientItem 
          value={calories} 
          label="קלוריות" 
          color="#F97316"
          delay={0.15}
          progress={contentProgress}
        />
        <NutrientItem 
          value={`${protein}g`} 
          label="חלבון" 
          color="#A855F7"
          delay={0.25}
          progress={contentProgress}
        />
        <NutrientItem 
          value={`${fat}g`} 
          label="שומן" 
          color="#F59E0B"
          delay={0.35}
          progress={contentProgress}
        />
        {carbs !== undefined && (
          <NutrientItem 
            value={`${carbs}g`} 
            label="פחמימות" 
            color="#10B981"
            delay={0.45}
            progress={contentProgress}
          />
        )}
      </View>

      {/* Success Badge */}
      <Animated.View style={[styles.successBadge, badgeStyle]}>
        <Text style={styles.successEmoji}>✅</Text>
        <Text style={styles.successText}>נוסף בהצלחה!</Text>
        <Text style={styles.successEmoji}>🎉</Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginVertical: 10,
    marginHorizontal: 4,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    overflow: 'hidden',
  },
  glowOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#10B981',
    zIndex: 10,
    pointerEvents: 'none',
  },
  accentBar: {
    height: 5,
    backgroundColor: '#10B981',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  checkContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  checkmark: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: '700',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    textAlign: 'right',
  },
  nutrientsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingVertical: 20,
    paddingHorizontal: 12,
  },
  nutrientItem: {
    alignItems: 'center',
    flex: 1,
  },
  nutrientValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  nutrientLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: 8,
  },
  nutrientDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    paddingVertical: 14,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#D1FAE5',
  },
  successEmoji: {
    fontSize: 18,
  },
  successText: {
    fontSize: 15,
    color: '#059669',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default memo(FoodCard);
