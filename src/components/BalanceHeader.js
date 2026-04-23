import React, { memo, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableWithoutFeedback,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useAnimatedProps,
  useSharedValue,
  withTiming,
  withDelay,
  interpolate,
  Extrapolate,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

// Create animated Circle component
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// ============================================
// PREMIUM COLOR SYSTEM - Clean & Professional
// ============================================
const COLORS = {
  // Brand
  brand: '#32A728',
  brandLight: '#E8F5E8',
  
  // Nutrients - Soft but distinct
  calories: '#FF6B35',
  protein: '#7C5CE0', 
  fat: '#FFB800',
  water: '#00B4D8',
  
  // Neutrals
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  background: '#FFFFFF',
  surface: '#F8FAFC',
  border: '#E5E7EB',
};

// ============================================
// PROGRESS RING - Premium Gradient Glow
// ============================================
const ProgressRing = memo(({ percentage, size = 64, color = COLORS.brand }) => {
  const strokeWidth = 5;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = Math.min(100, Math.max(0, percentage));
  const offset = circumference - (progress / 100) * circumference;

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      {/* Ring */}
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }], position: 'absolute' }}>
          {/* Define Gradient - Dark to Light (Reversed) */}
          <Defs>
            <SvgGradient id="progressGradient" x1="0%" y1="50%" x2="100%" y2="50%">
              <Stop offset="0%" stopColor="#D1FAE5" stopOpacity="1" />
              <Stop offset="50%" stopColor="#4ADE80" stopOpacity="1" />
              <Stop offset="100%" stopColor="#32A728" stopOpacity="1" />
            </SvgGradient>
          </Defs>
          
          {/* Track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={COLORS.border}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress with Gradient Glow */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#progressGradient)"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </Svg>
        {/* Icon in center */}
        <Ionicons name="trophy" size={size * 0.4} color={COLORS.brand} />
      </View>
      {/* Percentage below */}
      <Text style={[styles.ringText, { color: COLORS.brand }]}>{Math.round(progress)}%</Text>
    </View>
  );
});

// ============================================
// NUTRIENT ROW - Expanded View (with separator option)
// ============================================
const NutrientRow = memo(({ icon, label, current, target, unit, percentage, color, delay = 0, progress, isLast = false }) => {
  const fillValue = useSharedValue(0);
  
  useEffect(() => {
    fillValue.value = 0;
    fillValue.value = withDelay(
      delay + 200,
      withTiming(Math.min(100, percentage), {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [percentage]);
  
  const barStyle = useAnimatedStyle(() => {
    const animatedWidth = interpolate(
      progress.value,
      [0, 0.5, 1],
      [0, fillValue.value * 0.5, fillValue.value],
      Extrapolate.CLAMP
    );
    return { width: `${Math.max(2, animatedWidth)}%` };
  });

  return (
    <View style={[styles.nutrientWrapper, !isLast && styles.nutrientWithBorder]}>
      <View style={styles.nutrientRow}>
        <View style={[styles.nutrientIcon, { backgroundColor: `${color}15` }]}>
          <Ionicons name={icon} size={22} color={color} />
        </View>
        
        <View style={styles.nutrientContent}>
          <View style={styles.nutrientHeader}>
            <Text style={styles.nutrientLabel}>{label}</Text>
            <Text style={styles.nutrientValues}>
              <Text style={[styles.nutrientCurrent, { color }]}>{current}</Text>
              <Text style={styles.nutrientDivider}> / </Text>
              <Text style={styles.nutrientTarget}>{target}{unit}</Text>
            </Text>
          </View>
          
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { backgroundColor: color }, barStyle]} />
          </View>
        </View>
        
        <View style={[styles.percentBadge, { backgroundColor: `${color}10`, borderColor: `${color}25`, borderWidth: 1 }]}>
          <Text style={[styles.percentText, { color }]}>{Math.round(percentage)}%</Text>
        </View>
      </View>
    </View>
  );
});

// ============================================
// MINI RING STAT - Collapsed View (Animated with label)
// ============================================
const MiniRingStat = ({ icon, label, percentage, color, forceAnimate }) => {
  const size = 38;
  const strokeWidth = 3;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = radius * 2 * Math.PI;
  
  // Track if first render
  const isFirstRender = useRef(true);
  const prevPercentage = useRef(0);
  const animatedProgress = useSharedValue(0);
  
  // Animate from previous to new value when percentage changes
  useEffect(() => {
    const clampedPercentage = Math.min(100, Math.max(0, percentage || 0));
    
    // Always animate on first render or when values change
    if (isFirstRender.current) {
      isFirstRender.current = false;
      // Start from 0 and animate to current value
      animatedProgress.value = 0;
      animatedProgress.value = withTiming(clampedPercentage, {
        duration: 1000,
        easing: Easing.out(Easing.cubic),
      });
      prevPercentage.current = percentage;
      return;
    }
    
    // Animate if there's a change OR if forceAnimate changed
    if (prevPercentage.current !== percentage || forceAnimate) {
      animatedProgress.value = withTiming(clampedPercentage, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      });
      prevPercentage.current = percentage;
    }
  }, [percentage, forceAnimate]);
  
  // Animated props for the SVG circle
  const animatedCircleProps = useAnimatedProps(() => {
    const progress = animatedProgress.value;
    const offset = circumference - (progress / 100) * circumference;
    return {
      strokeDashoffset: offset,
    };
  });

  const displayPercent = Math.round(Math.min(100, Math.max(0, percentage)));

  return (
    <View style={styles.miniRingStat}>
      {/* Label on top */}
      <Text style={styles.miniRingLabel}>{label}</Text>
      
      {/* Ring with icon */}
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }], position: 'absolute' }}>
          {/* Track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={`${color}20`}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Animated Progress Circle */}
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            animatedProps={animatedCircleProps}
            strokeLinecap="round"
          />
        </Svg>
        <Ionicons name={icon} size={15} color={color} />
      </View>
      
      {/* Percentage */}
      <Text style={[styles.miniRingPercent, { color }]}>{displayPercent}%</Text>
    </View>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
function BalanceHeader({ 
  dailyStats, 
  targets, 
  isCollapsed, 
  onToggle,
  animatedHeight,
  contentProgress,
  userName,
  animationKey = 0, // Changes after celebrations to force re-animate
  onRecentMealsPress, // Navigate to recent meals screen
}) {
  console.log('[BalanceHeader] Render with dailyStats:', dailyStats?.calories);
  const stats = useMemo(() => {
    const calories = Math.round(dailyStats?.calories || 0);
    const protein = Math.round((dailyStats?.protein || 0) * 10) / 10;
    const fat = Math.round((dailyStats?.fat || 0) * 10) / 10;
    const water = dailyStats?.water_glasses || 0;
    
    const caloriesPercent = Math.min(100, Math.round((calories / targets.calories) * 100));
    const proteinPercent = Math.min(100, Math.round((protein / targets.protein) * 100));
    const fatPercent = Math.min(100, Math.round((fat / targets.fat) * 100));
    const waterPercent = Math.min(100, Math.round((water / targets.water) * 100));
    const overallPercent = Math.round((caloriesPercent + proteinPercent + fatPercent + waterPercent) / 4);
    
    const caloriesRemaining = Math.max(0, targets.calories - calories);
    
    return { 
      calories, protein, fat, water, 
      caloriesPercent, proteinPercent, fatPercent, waterPercent, 
      overallPercent, caloriesRemaining 
    };
  }, [dailyStats, targets]);

  const containerStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
  }));

  const collapsedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(contentProgress.value, [0, 0.3], [1, 0], Extrapolate.CLAMP),
    transform: [
      { scale: interpolate(contentProgress.value, [0, 0.5], [1, 0.98], Extrapolate.CLAMP) },
    ],
  }));

  const expandedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(contentProgress.value, [0.4, 0.8], [0, 1], Extrapolate.CLAMP),
    transform: [
      { translateY: interpolate(contentProgress.value, [0.3, 1], [10, 0], Extrapolate.CLAMP) },
    ],
  }));

  return (
    <View style={styles.wrapper}>
      <TouchableWithoutFeedback onPress={onToggle}>
        <Animated.View style={[styles.container, containerStyle]}>
        
        {/* ========== COLLAPSED STATE ========== */}
        <Animated.View style={[styles.collapsed, collapsedStyle]} pointerEvents={isCollapsed ? 'auto' : 'none'}>
          
          {/* Left: Main Ring */}
          <ProgressRing percentage={stats.overallPercent} size={46} color={COLORS.brand} />
          
          {/* Center: Summary Text */}
          <View style={styles.collapsedCenter}>
            <Text style={styles.collapsedTitle}>היי {userName || 'משתמש'}</Text>
            <Text style={styles.collapsedSubtitle}>
              אכלת <Text style={styles.collapsedHighlight}>{stats.calories}</Text> | נותרו <Text style={styles.collapsedHighlight}>{stats.caloriesRemaining.toLocaleString()}</Text>
            </Text>
          </View>
          
          {/* Right: 4 Mini Ring Stats with Labels */}
          <View style={styles.miniRingStats}>
            <MiniRingStat key={`cal-${animationKey}`} icon="flame" label="קלוריות" percentage={stats.caloriesPercent} color={COLORS.calories} forceAnimate={animationKey} />
            <MiniRingStat key={`pro-${animationKey}`} icon="barbell-outline" label="חלבון" percentage={stats.proteinPercent} color={COLORS.protein} forceAnimate={animationKey} />
            <MiniRingStat key={`fat-${animationKey}`} icon="water-outline" label="שומן" percentage={stats.fatPercent} color={COLORS.fat} forceAnimate={animationKey} />
            <MiniRingStat key={`wat-${animationKey}`} icon="water" label="מים" percentage={stats.waterPercent} color={COLORS.water} forceAnimate={animationKey} />
          </View>
          
        </Animated.View>

        {/* ========== EXPANDED STATE ========== */}
        <Animated.View style={[styles.expanded, expandedStyle]} pointerEvents={isCollapsed ? 'none' : 'auto'}>
          
          {/* Header with Water Counter */}
          <View style={styles.expandedHeader}>
            {/* Main Progress Ring - Left */}
            <ProgressRing percentage={stats.overallPercent} size={48} color={COLORS.brand} />
            
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>היי {userName || 'משתמש'}</Text>
              <Text style={styles.headerSubtitle}>הנה הסיכום היומי שלך</Text>
            </View>
            
            {/* Recent Meals Button */}
            {onRecentMealsPress && (
              <TouchableOpacity 
                style={styles.recentMealsSection}
                onPress={onRecentMealsPress}
                activeOpacity={0.7}
              >
                <View style={styles.recentMealsIcon}>
                  <Ionicons name="time-outline" size={20} color={COLORS.brand} />
                </View>
                <Text style={styles.recentMealsLabel}>ארוחות</Text>
              </TouchableOpacity>
            )}

            {/* Water Glass Counter */}
            <View style={styles.waterGlassSection}>
              <View style={styles.waterGlassIcon}>
                <Ionicons name="cafe-outline" size={20} color={COLORS.water} />
              </View>
              <Text style={styles.waterGlassCount}>
                <Text style={styles.waterGlassCurrent}>{stats.water}</Text>
                <Text style={styles.waterGlassDivider}>/</Text>
                <Text style={styles.waterGlassTarget}>{targets.water}</Text>
              </Text>
              <Text style={styles.waterGlassLabel}>כוסות</Text>
            </View>
          </View>
          
          {/* Divider */}
          <View style={styles.headerDivider} />
          
          {/* Nutrients - Only Calories, Protein, Fat */}
          <View style={styles.nutrients}>
            <NutrientRow
              icon="flame"
              label="קלוריות"
              current={stats.calories.toLocaleString()}
              target={targets.calories.toLocaleString()}
              unit=""
              percentage={stats.caloriesPercent}
              color={COLORS.calories}
              delay={0}
              progress={contentProgress}
            />
            <NutrientRow
              icon="barbell-outline"
              label="חלבון"
              current={stats.protein}
              target={targets.protein}
              unit="g"
              percentage={stats.proteinPercent}
              color={COLORS.protein}
              delay={50}
              progress={contentProgress}
            />
            <NutrientRow
              icon="water-outline"
              label="שומן"
              current={stats.fat}
              target={targets.fat}
              unit="g"
              percentage={stats.fatPercent}
              color={COLORS.fat}
              delay={100}
              progress={contentProgress}
              isLast={true}
            />
          </View>
          
          {/* Pull Handle */}
          <View style={styles.handle}>
            <View style={styles.handleBar} />
          </View>
          
          {/* Slogan */}
          <Text style={styles.slogan}>Balanced by data, Personalized for you.</Text>
          
        </Animated.View>
        
      </Animated.View>
      </TouchableWithoutFeedback>
    </View>
  );
}

export default memo(BalanceHeader);

// ============================================
// STYLES - Clean & Premium
// ============================================
const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: 'transparent',
  },
  container: {
    marginHorizontal: 12,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.brand,
    overflow: 'hidden',
  },

  // ========== RING ==========
  ringText: {
    fontSize: 13,
    fontWeight: '800',
  },

  // ========== COLLAPSED ==========
  collapsed: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  
  // Center Text
  collapsedCenter: {
    flex: 1,
    marginLeft: 12,
  },
  collapsedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  collapsedSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  collapsedHighlight: {
    fontWeight: '700',
    color: COLORS.brand,
  },
  
  // Mini Ring Stats - Compact with progress rings & labels
  miniRingStats: {
    flexDirection: 'row',
    gap: 14,
  },
  miniRingStat: {
    alignItems: 'center',
    gap: 2,
  },
  miniRingLabel: {
    fontSize: 8,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 1,
  },
  miniRingPercent: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 1,
  },

  // ========== EXPANDED ==========
  expanded: {
    ...StyleSheet.absoluteFillObject,
    padding: 18,
  },
  expandedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    gap: 12,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  
  // Recent Meals Button (in Header)
  recentMealsSection: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: `${COLORS.brand}10`,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${COLORS.brand}25`,
  },
  recentMealsIcon: {
    marginBottom: 2,
  },
  recentMealsLabel: {
    fontSize: 10,
    color: COLORS.brand,
    fontWeight: '600',
  },
  
  // Water Glass Section (in Header)
  waterGlassSection: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: `${COLORS.water}10`,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${COLORS.water}25`,
  },
  waterGlassIcon: {
    marginBottom: 2,
  },
  waterGlassCount: {
    fontSize: 15,
    fontWeight: '700',
  },
  waterGlassCurrent: {
    color: COLORS.water,
  },
  waterGlassDivider: {
    color: COLORS.textMuted,
  },
  waterGlassTarget: {
    color: COLORS.textMuted,
  },
  waterGlassLabel: {
    fontSize: 10,
    color: COLORS.water,
    fontWeight: '500',
  },
  
  headerDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 12,
  },

  // Nutrients
  nutrients: {
    gap: 0,
  },
  nutrientWrapper: {
    paddingVertical: 12,
  },
  nutrientWithBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  nutrientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  nutrientIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nutrientContent: {
    flex: 1,
  },
  nutrientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  nutrientLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  nutrientValues: {
    fontSize: 14,
  },
  nutrientCurrent: {
    fontWeight: '700',
    fontSize: 15,
  },
  nutrientDivider: {
    color: COLORS.textMuted,
  },
  nutrientTarget: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  progressTrack: {
    height: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  percentBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 56,
    alignItems: 'center',
  },
  percentText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Handle
  handle: {
    alignItems: 'center',
    paddingTop: 12,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
  },
  
  // Slogan
  slogan: {
    fontSize: 9,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 12,
    letterSpacing: 0.2,
  },
});
