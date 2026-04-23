import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Dimensions,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  interpolate,
  Extrapolate,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { calculateNutritionTargets } from '../api/openaiClient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 90,
  mass: 0.8,
};

// Animated Option Button
const OptionButton = ({ label, icon, selected, onPress, delay = 0 }) => {
  const progress = useSharedValue(0);
  const scaleAnim = useSharedValue(1);

  useEffect(() => {
    progress.value = withDelay(delay, withSpring(1, SPRING_CONFIG));
  }, []);

  useEffect(() => {
    scaleAnim.value = withSpring(selected ? 1.02 : 1, { damping: 15, stiffness: 200 });
  }, [selected]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolate.CLAMP),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [20, 0], Extrapolate.CLAMP) },
      { scale: scaleAnim.value },
    ],
  }));

  return (
    <Animated.View style={style}>
      <TouchableOpacity
        style={[styles.optionBtn, selected && styles.optionBtnSelected]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text style={styles.optionIcon}>{icon}</Text>
        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
          {label}
        </Text>
        {selected && (
          <View style={styles.checkmark}>
            <Text style={styles.checkmarkText}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// Progress Dots
const ProgressDots = ({ current, total }) => (
  <View style={styles.progressDots}>
    {Array.from({ length: total }).map((_, i) => (
      <View
        key={i}
        style={[
          styles.dot,
          i === current && styles.dotActive,
          i < current && styles.dotCompleted,
        ]}
      />
    ))}
  </View>
);

// Bouncing Line Animation
const BouncingLine = () => {
  const translateY = useSharedValue(0);
  
  const startBounce = () => {
    translateY.value = withSequence(
      withTiming(-12, { duration: 200, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) }),
      withTiming(-7, { duration: 160, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 160, easing: Easing.in(Easing.quad) }),
      withTiming(-3, { duration: 120, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 120, easing: Easing.in(Easing.quad) }),
      withTiming(-1, { duration: 80, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 80, easing: Easing.in(Easing.quad) }),
      withDelay(1500, withTiming(0, { duration: 0 }))
    );
  };
  
  useEffect(() => {
    startBounce();
    const interval = setInterval(startBounce, 3000);
    return () => clearInterval(interval);
  }, []);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  
  return (
    <Animated.View style={[styles.bouncingLine, animatedStyle]} />
  );
};

// Animated BMI Indicator - Smooth sliding animation
const AnimatedBMIIndicator = ({ position, color }) => {
  const translateX = useSharedValue(0);
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);
  
  useEffect(() => {
    // Start from left and animate to position
    translateX.value = 0;
    scale.value = 0.5;
    opacity.value = 0;
    
    // Animate in with spring
    opacity.value = withDelay(300, withTiming(1, { duration: 400 }));
    scale.value = withDelay(300, withSpring(1, { damping: 12, stiffness: 100 }));
    translateX.value = withDelay(400, withSpring(position, { 
      damping: 15, 
      stiffness: 60,
      mass: 1,
    }));
  }, [position]);
  
  const animatedStyle = useAnimatedStyle(() => ({
    left: `${translateX.value}%`,
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  
  return (
    <Animated.View style={[styles.bmiIndicatorAnimated, animatedStyle]}>
      <View style={[styles.bmiIndicatorGlow, { backgroundColor: color }]} />
      <View style={[styles.bmiIndicatorBall, { backgroundColor: color }]}>
        <View style={styles.bmiIndicatorShine} />
      </View>
    </Animated.View>
  );
};

// Animated Logo with Crosshair Lock-on Effect
const AnimatedLogo = () => {
  // Crosshair lines position
  const lineHorizontalY = useSharedValue(-60);
  const lineVerticalX = useSharedValue(-120);
  // Lines opacity
  const linesOpacity = useSharedValue(1);
  // Logo animations
  const greenOpacity = useSharedValue(0);
  const logoScale = useSharedValue(1);
  // Lock-on effects
  const lockBracketsOpacity = useSharedValue(0);
  const lockBracketsScale = useSharedValue(1.3);
  const pulseOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(0.8);
  // Center dot
  const centerDotOpacity = useSharedValue(0);
  const centerDotScale = useSharedValue(0);
  
  useEffect(() => {
    // Reset all values
    lineHorizontalY.value = -60;
    lineVerticalX.value = -120;
    linesOpacity.value = 1;
    greenOpacity.value = 0;
    logoScale.value = 1;
    lockBracketsOpacity.value = 0;
    lockBracketsScale.value = 1.3;
    pulseOpacity.value = 0;
    pulseScale.value = 0.8;
    centerDotOpacity.value = 0;
    centerDotScale.value = 0;
    
    // Vertical line - searches from LEFT to RIGHT
    lineVerticalX.value = withSequence(
      withTiming(-120, { duration: 300 }),
      withTiming(90, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      withTiming(-60, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      withTiming(50, { duration: 750, easing: Easing.inOut(Easing.quad) }),
      withTiming(-20, { duration: 550, easing: Easing.inOut(Easing.quad) }),
      withTiming(8, { duration: 350, easing: Easing.inOut(Easing.quad) }),
      // LOCK ON!
      withSpring(0, { damping: 12, stiffness: 150 }),
      // Shake
      withTiming(5, { duration: 40 }),
      withTiming(-5, { duration: 40 }),
      withTiming(3, { duration: 35 }),
      withTiming(-3, { duration: 35 }),
      withTiming(1, { duration: 30 }),
      withTiming(0, { duration: 30 })
    );
    
    // Horizontal line - searches from TOP to BOTTOM
    lineHorizontalY.value = withSequence(
      withDelay(150, withTiming(-60, { duration: 250 })),
      withTiming(55, { duration: 1050, easing: Easing.inOut(Easing.quad) }),
      withTiming(-40, { duration: 850, easing: Easing.inOut(Easing.quad) }),
      withTiming(35, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      withTiming(-15, { duration: 500, easing: Easing.inOut(Easing.quad) }),
      withTiming(5, { duration: 300, easing: Easing.inOut(Easing.quad) }),
      // LOCK ON!
      withSpring(0, { damping: 12, stiffness: 150 }),
      // Shake
      withTiming(-5, { duration: 40 }),
      withTiming(5, { duration: 40 }),
      withTiming(-3, { duration: 35 }),
      withTiming(3, { duration: 35 }),
      withTiming(-1, { duration: 30 }),
      withTiming(0, { duration: 30 })
    );
    
    // Center dot appears on lock
    centerDotOpacity.value = withDelay(4300, withTiming(1, { duration: 150 }));
    centerDotScale.value = withDelay(4300, withSpring(1, { damping: 8, stiffness: 200 }));
    centerDotOpacity.value = withDelay(4800, withTiming(0, { duration: 300 }));
    
    // Lock brackets appear
    lockBracketsOpacity.value = withDelay(4350, withTiming(1, { duration: 200 }));
    lockBracketsScale.value = withDelay(4350, withSpring(1, { damping: 10, stiffness: 120 }));
    
    // Pulse effect
    pulseOpacity.value = withDelay(4400, withSequence(
      withTiming(0.6, { duration: 200 }),
      withTiming(0, { duration: 400 })
    ));
    pulseScale.value = withDelay(4400, withTiming(1.5, { duration: 600, easing: Easing.out(Easing.quad) }));
    
    // Logo turns green with slight scale bounce
    greenOpacity.value = withDelay(4500, withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) }));
    logoScale.value = withDelay(4500, withSequence(
      withSpring(1.08, { damping: 8, stiffness: 200 }),
      withSpring(1, { damping: 12, stiffness: 150 })
    ));
    
    // Fade out crosshair elements
    linesOpacity.value = withDelay(5300, withTiming(0, { duration: 600 }));
    lockBracketsOpacity.value = withDelay(5300, withTiming(0, { duration: 600 }));
  }, []);
  
  // Animated styles
  const horizontalLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lineHorizontalY.value }],
    opacity: linesOpacity.value,
  }));
  
  const verticalLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: lineVerticalX.value }],
    opacity: linesOpacity.value,
  }));
  
  const greenLogoStyle = useAnimatedStyle(() => ({
    opacity: greenOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  
  const grayLogoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(greenOpacity.value, [0, 1], [1, 0], Extrapolate.CLAMP),
    transform: [{ scale: logoScale.value }],
  }));
  
  const lockBracketsStyle = useAnimatedStyle(() => ({
    opacity: lockBracketsOpacity.value,
    transform: [{ scale: lockBracketsScale.value }],
  }));
  
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
    transform: [{ scale: pulseScale.value }],
  }));
  
  const centerDotStyle = useAnimatedStyle(() => ({
    opacity: centerDotOpacity.value,
    transform: [{ scale: centerDotScale.value }],
  }));
  
  return (
    <View style={animatedLogoStyles.container}>
      {/* Pulse ring effect */}
      <Animated.View style={[animatedLogoStyles.pulseRing, pulseStyle]} />
      
      {/* Crosshair Lines */}
      <Animated.View style={[animatedLogoStyles.horizontalLine, horizontalLineStyle]} />
      <Animated.View style={[animatedLogoStyles.verticalLine, verticalLineStyle]} />
      
      {/* Center dot on lock */}
      <Animated.View style={[animatedLogoStyles.centerDot, centerDotStyle]} />
      
      {/* Lock brackets */}
      <Animated.View style={[animatedLogoStyles.lockBracketsContainer, lockBracketsStyle]}>
        <View style={[animatedLogoStyles.bracket, animatedLogoStyles.bracketTL]} />
        <View style={[animatedLogoStyles.bracket, animatedLogoStyles.bracketTR]} />
        <View style={[animatedLogoStyles.bracket, animatedLogoStyles.bracketBL]} />
        <View style={[animatedLogoStyles.bracket, animatedLogoStyles.bracketBR]} />
      </Animated.View>
      
      {/* Logo Text - Gray version */}
      <Animated.Text style={[animatedLogoStyles.logoGray, grayLogoStyle]}>
        BioBalance
      </Animated.Text>
      
      {/* Logo Text - Green version */}
      <Animated.Text style={[animatedLogoStyles.logoGreen, greenLogoStyle]}>
        BioBalance
      </Animated.Text>
    </View>
  );
};

const animatedLogoStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: SCREEN_WIDTH,
    height: 120,
  },
  horizontalLine: {
    position: 'absolute',
    width: SCREEN_WIDTH - 40,
    height: 2,
    backgroundColor: '#16A34A',
    zIndex: 10,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  verticalLine: {
    position: 'absolute',
    width: 2,
    height: 160,
    backgroundColor: '#16A34A',
    zIndex: 10,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  centerDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
    zIndex: 15,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  pulseRing: {
    position: 'absolute',
    width: 200,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#16A34A',
    zIndex: 5,
  },
  lockBracketsContainer: {
    position: 'absolute',
    width: 220,
    height: 55,
    zIndex: 12,
  },
  bracket: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderColor: '#16A34A',
    borderWidth: 2,
  },
  bracketTL: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 4,
  },
  bracketTR: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 4,
  },
  bracketBL: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 4,
  },
  bracketBR: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 4,
  },
  logoGray: {
    position: 'absolute',
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: '#9CA3AF',
    zIndex: 1,
  },
  logoGreen: {
    position: 'absolute',
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: '#16A34A',
    zIndex: 2,
    textShadowColor: 'rgba(22, 163, 74, 0.15)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
});


// Number Input with animations
const NumberInput = ({ value, onChange, unit, placeholder }) => {
  const inputProgress = useSharedValue(0);

  useEffect(() => {
    inputProgress.value = withSpring(1, SPRING_CONFIG);
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(inputProgress.value, [0, 1], [0, 1], Extrapolate.CLAMP),
    transform: [
      { translateY: interpolate(inputProgress.value, [0, 1], [15, 0], Extrapolate.CLAMP) },
    ],
  }));

  return (
    <Animated.View style={[styles.inputRow, style]}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.numberInput}
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          maxLength={3}
        />
      </View>
      <Text style={styles.unitText}>{unit}</Text>
    </Animated.View>
  );
};

export default function Onboarding() {
  const navigation = useNavigation();
  const { setProfile, setDailyStats, user } = useApp();
  const { initializeForNewUser } = useNotifications();
  
  const [step, setStep] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // Add submitting state
  const [showResults, setShowResults] = useState(false);
  
  // User data
  const [userName, setUserName] = useState('');
  const [gender, setGender] = useState(null);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [activityLevel, setActivityLevel] = useState(null);
  const [goal, setGoal] = useState(null);
  const [pace, setPace] = useState(null);
  
  // Calculated results
  const [results, setResults] = useState(null);
  
  // Editing state - which field is currently being edited
  const [editingField, setEditingField] = useState(null); // 'calories' | 'protein' | 'fat' | null
  const [editedCalories, setEditedCalories] = useState(null);
  const [editedProtein, setEditedProtein] = useState(null);
  const [editedFat, setEditedFat] = useState(null);
  
  // Animations
  const titleProgress = useSharedValue(0);
  const contentProgress = useSharedValue(0);
  const resultsProgress = useSharedValue(0);
  const celebrateProgress = useSharedValue(0);

  useEffect(() => {
    titleProgress.value = withSpring(1, SPRING_CONFIG);
    contentProgress.value = withDelay(200, withSpring(1, SPRING_CONFIG));
  }, [step]);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(titleProgress.value, [0, 1], [0, 1], Extrapolate.CLAMP),
    transform: [
      { translateY: interpolate(titleProgress.value, [0, 1], [-20, 0], Extrapolate.CLAMP) },
    ],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(contentProgress.value, [0, 1], [0, 1], Extrapolate.CLAMP),
  }));

  const resultsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(resultsProgress.value, [0, 1], [0, 1], Extrapolate.CLAMP),
    transform: [
      { scale: interpolate(resultsProgress.value, [0, 1], [0.9, 1], Extrapolate.CLAMP) },
    ],
  }));

  const goToNextStep = () => {
    titleProgress.value = 0;
    contentProgress.value = 0;
    setStep(prev => prev + 1);
  };

  const calculateResults = async () => {
    setIsCalculating(true);
    
    try {
      const userData = {
        gender,
        weight_kg: parseFloat(weight),
        height_cm: parseFloat(height),
        age: parseInt(age),
        activity_level: activityLevel,
        goal,
        pace,
      };

      console.log('Sending to OpenAI for calculation:', userData);
      
      // Use OpenAI for professional calculation
      const aiResults = await calculateNutritionTargets(userData);
      
      console.log('Received from OpenAI:', aiResults);

      const calculatedResults = {
        calories: aiResults.calories,
        protein: aiResults.protein,
        fat: aiResults.fat,
        carbs: aiResults.carbs,
        water: aiResults.water,
        bmr: aiResults.bmr,
        tdee: aiResults.tdee,
        bmi: aiResults.bmi,
        bmiCategory: aiResults.bmi_category,
        explanation: aiResults.explanation,
      };

      setResults(calculatedResults);
      setIsCalculating(false);
      setShowResults(true);
      
      resultsProgress.value = withSpring(1, SPRING_CONFIG);
      celebrateProgress.value = withDelay(500, withSpring(1, { damping: 12, stiffness: 100 }));
      
    } catch (error) {
      console.log('Error calculating:', error);
      setIsCalculating(false);
      Alert.alert('שגיאה', 'לא הצלחנו לחשב את ההמלצות. נסה שוב.');
    }
  };

  const finishOnboarding = async () => {
    if (isSubmitting) return; // Prevent double clicks
    setIsSubmitting(true);

    // Verify user is authenticated
    if (!user) {
      Alert.alert('שגיאה', 'יש להתחבר מחדש לאפליקציה');
      setIsSubmitting(false);
      return;
    }

    // Water target: 10 glasses for muscle gain, 8 for everyone else (minimum 8)
    const calculateWaterTarget = () => {
      if (goal === 'bulk' || goal === 'lean_bulk') return 10; // עליית מסה = 10 כוסות
      return 8; // ברירת מחדל = 8 כוסות (200 מ"ל כל אחת)
    };

    const profileData = {
      name: userName.trim() || 'משתמש',
      gender,
      weight_kg: parseFloat(weight),
      height_cm: parseFloat(height),
      age: parseInt(age),
      activity_level: activityLevel,
      goal,
      pace,
      calories_target: editedCalories || results.calories,
      protein_target: editedProtein || results.protein,
      fat_target: editedFat || results.fat,
      carbs_target: results.carbs,
      water_target: calculateWaterTarget(),
      onboarding_completed: true,
    };

    // Timeout failsafe - אם משהו נתקע, ננווט אחרי 5 שניות
    const navigationTimeout = setTimeout(() => {
      console.log('[Onboarding] Timeout reached, forcing navigation to Home');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    }, 5000);

    try {
      console.log('[Onboarding] Saving profile for user:', user.id);
      
      // CRITICAL: Save to AsyncStorage FIRST as immediate backup
      try {
        const onboardingKey = `@biobalance_onboarding_completed_${user.id}`;
        await AsyncStorage.setItem(onboardingKey, 'true');
        console.log('[Onboarding] ✅ Saved onboarding flag to AsyncStorage');
      } catch (e) {
        console.log('[Onboarding] AsyncStorage save error:', e);
      }
      
      // Save profile using AppContext (which saves to Supabase)
      const saveResult = await setProfile(profileData);
      
      if (saveResult?.error) {
        console.error('[Onboarding] Profile save error:', saveResult.error);
        // Don't throw - continue to navigation anyway since setProfile updates local state
      }
      
      console.log('[Onboarding] Profile saved! Saving daily stats...');
      
      // Initialize daily stats (non-blocking)
      const initialStats = {
        calories: 0,
        protein: 0,
        fat: 0,
        water_glasses: 0,
      };
      setDailyStats(initialStats).catch(e => console.log('[Onboarding] Stats error:', e));
      
      console.log('[Onboarding] Navigating to Home...');
      
      // Clear timeout and navigate immediately
      clearTimeout(navigationTimeout);
      
      // Force navigation to Home with reset (clean navigation state)
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
      
      // Request notification permission AFTER navigation (non-blocking)
      setTimeout(() => {
        initializeForNewUser().catch(e => console.log('[Onboarding] Notification setup skipped:', e));
      }, 1000);
      
    } catch (error) {
      console.log('[Onboarding] Error saving profile:', error);
      clearTimeout(navigationTimeout);
      
      // Still try to navigate - the profile was set in local state
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0: return true;
      case 1: return userName.trim().length > 0;
      case 2: return gender !== null;
      case 3: return weight && height && age;
      case 4: return activityLevel !== null;
      case 5: return goal !== null;
      case 6: return pace !== null;
      default: return false;
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.brandIntroContainer}>
            {/* Animated Logo with Crosshair Lock-on */}
            <Animated.View style={[styles.brandLogoSection, titleStyle]}>
              <AnimatedLogo />
              <Text style={styles.brandTagline}>Balanced by data. Personalized for you.</Text>
            </Animated.View>

            {/* Data Icon */}
            <Animated.View style={[styles.dataIconContainer, contentStyle]}>
              {/* Outer Ring */}
              <View style={[styles.dataRingThin, styles.ring1]} />
              {/* Center Icon - Bar Chart */}
              <View style={styles.dataIconCenter}>
                <View style={styles.barChartContainer}>
                  <View style={[styles.bar, styles.bar1]} />
                  <View style={[styles.bar, styles.bar2]} />
                  <View style={[styles.bar, styles.bar3]} />
                  <View style={[styles.bar, styles.bar4]} />
                </View>
                <View style={styles.chartCurve} />
              </View>
            </Animated.View>

            {/* Title & Text */}
            <Animated.View style={[styles.promiseSection, contentStyle]}>
              <Text style={styles.promiseTitle}>התוכנית שלך מתחילה כאן</Text>
              <Text style={styles.promiseText}>
                נגדיר יחד את ההרגלים והתפריט{'\n'}שמתאימים בדיוק לגוף שלך.
              </Text>
            </Animated.View>

            {/* Bouncing Line */}
            <Animated.View style={[styles.bouncingLineContainer, contentStyle]}>
              <BouncingLine />
            </Animated.View>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContainer}>
            <Animated.View style={[styles.stepHeader, titleStyle]}>
              <Text style={styles.stepTitleClean}>איך קוראים לך?</Text>
              <Text style={styles.stepSubtitleClean}>נשמח להכיר אותך</Text>
            </Animated.View>
            <Animated.View style={[styles.nameInputSection, contentStyle]}>
              <TextInput
                style={styles.nameInput}
                placeholder="השם שלך"
                placeholderTextColor="#9CA3AF"
                value={userName}
                onChangeText={setUserName}
                textAlign="center"
                autoFocus={true}
              />
            </Animated.View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContainer}>
            <Animated.View style={[styles.stepHeader, titleStyle]}>
              <Text style={styles.stepTitleClean}>מה המין שלך?</Text>
              <Text style={styles.stepSubtitleClean}>לחישוב מדויק יותר</Text>
            </Animated.View>
            <Animated.View style={[styles.optionsClean, contentStyle]}>
              <TouchableOpacity
                style={[styles.optionClean, gender === 'male' && styles.optionCleanSelected]}
                onPress={() => setGender('male')}
                activeOpacity={0.7}
              >
                <Text style={[styles.optionCleanText, gender === 'male' && styles.optionCleanTextSelected]}>זכר</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionClean, gender === 'female' && styles.optionCleanSelected]}
                  onPress={() => setGender('female')}
                activeOpacity={0.7}
              >
                <Text style={[styles.optionCleanText, gender === 'female' && styles.optionCleanTextSelected]}>נקבה</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionClean, gender === 'other' && styles.optionCleanSelected]}
                  onPress={() => setGender('other')}
                activeOpacity={0.7}
              >
                <Text style={[styles.optionCleanText, gender === 'other' && styles.optionCleanTextSelected]}>לא רוצה לציין</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        );

      case 3:
        return (
          <>
            <Animated.Text style={[styles.stepTitle, titleStyle]}>
              נתונים בסיסיים 📊
            </Animated.Text>
            <Animated.Text style={[styles.stepSubtitle, titleStyle]}>
              כדי לחשב את המאזן היומי שלך
            </Animated.Text>
            <Animated.View style={contentStyle}>
              <View style={styles.inputsContainer}>
                <NumberInput
                  value={weight}
                  onChange={setWeight}
                  unit="ק״ג"
                  placeholder="70"
                />
                <NumberInput
                  value={height}
                  onChange={setHeight}
                  unit="ס״מ"
                  placeholder="170"
                />
                <NumberInput
                  value={age}
                  onChange={setAge}
                  unit="שנים"
                  placeholder="25"
                />
              </View>
              <Text style={styles.dataNote}>
                🔒 הנתונים נשמרים באופן מקומי בלבד
              </Text>
            </Animated.View>
          </>
        );

      case 4:
        return (
          <>
            <Animated.Text style={[styles.stepTitle, titleStyle]}>
              רמת הפעילות שלך 🏃
            </Animated.Text>
            <Animated.Text style={[styles.stepSubtitle, titleStyle]}>
              כמה הגוף שלך פעיל ביום-יום?
            </Animated.Text>
            <Animated.View style={contentStyle}>
              <ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.optionsList}>
                  <OptionButton
                    label="יושב/ת רוב היום"
                    icon="🛋️"
                    selected={activityLevel === 'sedentary'}
                    onPress={() => setActivityLevel('sedentary')}
                    delay={100}
                  />
                  <OptionButton
                    label="פעילות קלה – הליכות"
                    icon="🚶"
                    selected={activityLevel === 'light'}
                    onPress={() => setActivityLevel('light')}
                    delay={150}
                  />
                  <OptionButton
                    label="אימונים 2-3 בשבוע"
                    icon="🏃"
                    selected={activityLevel === 'moderate'}
                    onPress={() => setActivityLevel('moderate')}
                    delay={200}
                  />
                  <OptionButton
                    label="אימונים 4-5 בשבוע"
                    icon="💪"
                    selected={activityLevel === 'active'}
                    onPress={() => setActivityLevel('active')}
                    delay={250}
                  />
                  <OptionButton
                    label="אימונים יומיים אינטנסיביים"
                    icon="🔥"
                    selected={activityLevel === 'intense'}
                    onPress={() => setActivityLevel('intense')}
                    delay={300}
                  />
                </View>
              </ScrollView>
            </Animated.View>
          </>
        );

      case 5:
        return (
          <>
            <Animated.Text style={[styles.stepTitle, titleStyle]}>
              המטרה שלך 🎯
            </Animated.Text>
            <Animated.Text style={[styles.stepSubtitle, titleStyle]}>
              עכשיו החלק החשוב ביותר!
            </Animated.Text>
            <Animated.View style={contentStyle}>
              <View style={styles.optionsList}>
                <OptionButton
                  label="חיטוב / ירידה באחוזי שומן"
                  icon="🔥"
                  selected={goal === 'cut'}
                  onPress={() => setGoal('cut')}
                  delay={100}
                />
                <OptionButton
                  label="שמירה על המשקל"
                  icon="⚖️"
                  selected={goal === 'maintain'}
                  onPress={() => setGoal('maintain')}
                  delay={150}
                />
                <OptionButton
                  label="עליה מתונה במסה (Lean)"
                  icon="📈"
                  selected={goal === 'lean_bulk'}
                  onPress={() => setGoal('lean_bulk')}
                  delay={200}
                />
                <OptionButton
                  label="עלייה מהירה במסה (Bulk)"
                  icon="💪"
                  selected={goal === 'bulk'}
                  onPress={() => setGoal('bulk')}
                  delay={250}
                />
              </View>
            </Animated.View>
          </>
        );

      case 6:
        return (
          <>
            <Animated.Text style={[styles.stepTitle, titleStyle]}>
              הקצב שלך ⏱️
            </Animated.Text>
            <Animated.Text style={[styles.stepSubtitle, titleStyle]}>
              עד כמה חשוב לך שהדרך תהיה מהירה או מאוזנת?
            </Animated.Text>
            <Animated.View style={contentStyle}>
              <View style={styles.optionsList}>
                <OptionButton
                  label="קצב רגוע – יציבות לטווח ארוך"
                  icon="🌿"
                  selected={pace === 'slow'}
                  onPress={() => setPace('slow')}
                  delay={100}
                />
                <OptionButton
                  label="איזון – גם תוצאות וגם כיף"
                  icon="⚖️"
                  selected={pace === 'balanced'}
                  onPress={() => setPace('balanced')}
                  delay={200}
                />
                <OptionButton
                  label="שינוי מהיר (בגבולות הבריא)"
                  icon="🚀"
                  selected={pace === 'fast'}
                  onPress={() => setPace('fast')}
                  delay={300}
                />
              </View>
            </Animated.View>
          </>
        );

      default:
        return null;
    }
  };

  // Get feedback based on edited values
  const getEditFeedback = () => {
    if (!results || !editedCalories) return null;
    
    const diff = editedCalories - results.calories;
    const diffPercent = Math.abs(diff / results.calories * 100);
    
    if (diff < 0) {
      // User lowered calories
      if (diffPercent > 30) {
        return {
          type: 'warning',
          icon: '⚠️',
          text: `שים לב: ${editedCalories} קלוריות זה פחות מהמומלץ לגובה ולמשקל שלך. זה עלול להשפיע על האנרגיה והבריאות.`,
        };
      } else if (diffPercent > 10) {
        return {
          type: 'ok',
          icon: '👍',
          text: 'הכל טוב! נתחיל מזה ולאט לאט נשתפר. המטרה היא התקדמות, לא שלמות.',
        };
      }
    } else if (diff > 0 && diffPercent > 20) {
      return {
        type: 'info',
        icon: '💡',
        text: 'יעד גבוה יותר מההמלצה. מתאים אם אתה פעיל במיוחד או רוצה לעלות במשקל.',
      };
    }
    return null;
  };

  if (showResults && results) {
    const displayCalories = editedCalories || results.calories;
    const displayProtein = editedProtein || results.protein;
    const displayFat = editedFat || results.fat;
    const bmiValue = parseFloat(results.bmi);
    
    // BMI category - with personalized messages and beautiful colors
    const getBmiCategory = (bmi) => {
      if (bmi < 18.5) return { 
        label: 'תת משקל', 
        color: '#6366F1',
        bgColor: '#EEF2FF',
        textColor: '#4338CA',
        icon: '💪',
        message: 'בוא נעבוד יחד על בניית מסת גוף בריאה - אתה יכול!'
      };
      if (bmi < 25) return { 
        label: 'תקין', 
        color: '#10B981',
        bgColor: '#ECFDF5',
        textColor: '#047857',
        icon: '🌟',
        message: 'מדהים! הנתונים שלך מעולים, בוא נשמור עליהם ככה!'
      };
      if (bmi < 30) return { 
        label: 'עודף משקל', 
        color: '#F59E0B',
        bgColor: '#FFFBEB',
        textColor: '#B45309',
        icon: '🎯',
        message: 'אתה בכיוון הנכון! עם התוכנית שלנו נגיע ליעד יחד.'
      };
      return { 
        label: 'השמנה', 
        color: '#EF4444',
        bgColor: '#FEF2F2',
        textColor: '#B91C1C',
        icon: '🚀',
        message: 'המסע מתחיל היום! צעד אחד בכל פעם ונגיע לשם.'
      };
    };
    const bmiCategory = getBmiCategory(bmiValue);
    const bmiPosition = Math.min(100, Math.max(0, ((bmiValue - 15) / 25) * 100));
    
    return (
      <SafeAreaView style={styles.resultsContainer}>
        <View style={styles.resultsContent}>
          {/* Header */}
            <Animated.View style={[styles.resultsHeader, resultsStyle]}>
            <Text style={styles.resultsTitle}>התוכנית היומית שלך</Text>
            <Text style={styles.resultsSubtitle}>אלו היעדים שלך לכל יום</Text>
            </Animated.View>

          {/* Calorie Card - Editable */}
            <Animated.View style={[styles.mainCalorieCard, resultsStyle]}>
            <Text style={styles.mainCalorieLabel}>יעד קלוריות יומי</Text>
              {editingField === 'calories' ? (
                <View style={styles.editRow}>
                  <TextInput
                    style={styles.editInput}
                    value={String(editedCalories ?? results.calories)}
                    onChangeText={(t) => setEditedCalories(parseInt(t) || 0)}
                    keyboardType="numeric"
                    maxLength={4}
                    autoFocus
                  />
                  <TouchableOpacity 
                    style={styles.submitBtn}
                    onPress={() => {
                      Keyboard.dismiss();
                      setEditingField(null);
                    }}
                  >
                    <Text style={styles.submitBtnText}>✓</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setEditingField('calories')}>
                  <Text style={styles.mainCalorieValue}>{displayCalories}</Text>
                  <Text style={styles.editHint}>לחץ לעריכה</Text>
                </TouchableOpacity>
              )}
            <Text style={styles.mainCalorieUnit}>קלוריות ליום</Text>
            </Animated.View>

          {/* Macros Grid - All Editable */}
            <Animated.View style={[styles.macrosGrid, resultsStyle]}>
            {/* Protein - Editable */}
            <TouchableOpacity 
              style={styles.macroCard}
              onPress={() => setEditingField('protein')}
              activeOpacity={0.7}
            >
              <Text style={styles.macroIcon}>💪</Text>
              {editingField === 'protein' ? (
                <View style={styles.macroEditRow}>
                  <TextInput
                    style={styles.macroEditInput}
                    value={String(editedProtein ?? results.protein)}
                    onChangeText={(t) => setEditedProtein(parseInt(t) || 0)}
                    keyboardType="numeric"
                    maxLength={3}
                    autoFocus
                  />
                  <TouchableOpacity 
                    style={styles.macroSubmitBtn}
                    onPress={() => {
                      Keyboard.dismiss();
                      setEditingField(null);
                    }}
                  >
                    <Text style={styles.macroSubmitBtnText}>✓</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.macroValue}>{displayProtein}g</Text>
              )}
              <Text style={styles.macroLabel}>חלבון</Text>
            </TouchableOpacity>
              
            {/* Fat - Editable */}
            <TouchableOpacity 
              style={styles.macroCard}
              onPress={() => setEditingField('fat')}
              activeOpacity={0.7}
            >
              <Text style={styles.macroIcon}>🥑</Text>
              {editingField === 'fat' ? (
                <View style={styles.macroEditRow}>
                  <TextInput
                    style={styles.macroEditInput}
                    value={String(editedFat ?? results.fat)}
                    onChangeText={(t) => setEditedFat(parseInt(t) || 0)}
                    keyboardType="numeric"
                    maxLength={3}
                    autoFocus
                  />
                  <TouchableOpacity 
                    style={styles.macroSubmitBtn}
                    onPress={() => {
                      Keyboard.dismiss();
                      setEditingField(null);
                    }}
                  >
                    <Text style={styles.macroSubmitBtnText}>✓</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.macroValue}>{displayFat}g</Text>
              )}
              <Text style={styles.macroLabel}>שומן</Text>
            </TouchableOpacity>
              
              <View style={styles.macroCard}>
                <Text style={styles.macroIcon}>🍚</Text>
                <Text style={styles.macroValue}>{results.carbs}g</Text>
                <Text style={styles.macroLabel}>פחמימות</Text>
              </View>
              
              <View style={styles.macroCard}>
                <Text style={styles.macroIcon}>💧</Text>
              <Text style={styles.macroValue}>{(goal === 'bulk' || goal === 'lean_bulk') ? 10 : 8}</Text>
              <Text style={styles.macroLabel}>כוסות מים</Text>
              </View>
            </Animated.View>

          {/* BMI Scale - Premium Animated Design */}
          <Animated.View style={[styles.bmiSection, resultsStyle]}>
            {/* Header with animated value */}
            <View style={styles.bmiHeader}>
              <View style={styles.bmiTitleRow}>
                <Text style={styles.bmiTitle}>מדד גוף BMI</Text>
                <View style={[styles.bmiCategoryBadge, { backgroundColor: bmiCategory.bgColor }]}>
                  <Text style={[styles.bmiCategoryBadgeText, { color: bmiCategory.color }]}>
                    {bmiCategory.label}
                  </Text>
                </View>
              </View>
              <Text style={[styles.bmiValueLarge, { color: bmiCategory.color }]}>{results.bmi}</Text>
            </View>
            
            {/* Elegant Scale */}
            <View style={styles.bmiScaleWrapper}>
              <View style={styles.bmiScaleTrack}>
                {/* Smooth gradient background */}
                <LinearGradient
                  colors={['#E2E8F0', '#A5F3C4', '#86EFAC', '#FDE68A', '#FBBF24', '#FCA5A5', '#F87171']}
                  locations={[0, 0.12, 0.27, 0.42, 0.52, 0.65, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.bmiGradientTrack}
                />
                
                {/* Animated Indicator */}
                <AnimatedBMIIndicator position={bmiPosition} color={bmiCategory.color} />
              </View>
              
              {/* Scale numbers */}
              <View style={styles.bmiScaleNumbers}>
                <Text style={styles.bmiScaleNum}>15</Text>
                <Text style={styles.bmiScaleNum}>20</Text>
                <Text style={styles.bmiScaleNum}>25</Text>
                <Text style={styles.bmiScaleNum}>30</Text>
                <Text style={styles.bmiScaleNum}>40</Text>
              </View>
            </View>
            
            {/* Personalized Message */}
            <View style={[styles.bmiMessageBox, { backgroundColor: bmiCategory.bgColor }]}>
              <Text style={styles.bmiMessageIcon}>{bmiCategory.icon}</Text>
              <Text style={[styles.bmiMessageText, { color: bmiCategory.textColor }]}>
                {bmiCategory.message}
              </Text>
            </View>
          </Animated.View>

          {/* Stats Row */}
          <Animated.View style={[styles.statsRow, resultsStyle]}>
            <View style={styles.statChip}>
              <Text style={styles.statChipLabel}>BMR</Text>
              <Text style={styles.statChipValue}>{results.bmr}</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statChipLabel}>TDEE</Text>
              <Text style={styles.statChipValue}>{results.tdee}</Text>
            </View>
            <View style={styles.editInfoChip}>
              <Text style={styles.editInfoText}>✏️ לחץ על ערך לעריכה</Text>
            </View>
          </Animated.View>
        </View>

        {/* Bottom CTA */}
        <View style={styles.resultsFooter}>
          <Text style={styles.footerNote}>ניתן לשנות את היעדים בכל עת מההגדרות</Text>
              <TouchableOpacity
            style={[styles.confirmBtn, isSubmitting && { opacity: 0.7 }]}
                onPress={finishOnboarding}
            activeOpacity={0.85}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.confirmBtnText}>בואו נתחיל!</Text>
            )}
              </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (isCalculating) {
    return (
      <SafeAreaView style={styles.calcContainer}>
        <View style={styles.calcContent}>
          <ActivityIndicator size="large" color="#16A34A" />
          <Text style={styles.calcTitle}>מחשב את ההמלצות שלך...</Text>
            </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <LinearGradient
          colors={['#FFFFFF', '#FFFFFF']}
          style={styles.mainGradient}
        >
          {/* Progress */}
          {step > 0 && <ProgressDots current={step - 1} total={6} />}

          {/* Content */}
          <View style={styles.content}>
            {renderStep()}
          </View>

          {/* Bottom Button */}
          <View style={styles.bottomContainer}>
            <TouchableOpacity
              style={[
                styles.nextBtn,
                step === 0 && styles.nextBtnBrand,
                !canProceed() && styles.nextBtnDisabled,
              ]}
              onPress={() => {
                if (step === 6) {
                  calculateResults();
                } else {
                  goToNextStep();
                }
              }}
              disabled={!canProceed()}
              activeOpacity={0.85}
            >
              <Text style={[styles.nextBtnText, step === 0 && styles.nextBtnTextBrand]}>
                {step === 0 ? 'להתחיל התאמה אישית' : step === 6 ? 'חשב את המאזן שלי' : 'המשך'}
              </Text>
            </TouchableOpacity>

            {step === 0 && (
              <Text style={styles.ctaSubtext}>
                פחות מדקה · ללא התחייבות
              </Text>
            )}

            {step > 0 && (
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => setStep(prev => prev - 1)}
              >
                <Text style={styles.backBtnText}>← חזור</Text>
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  mainGradient: {
    flex: 1,
  },

  // Progress
  progressDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
  dotActive: {
    backgroundColor: '#2DD4BF',
    width: 24,
  },
  dotCompleted: {
    backgroundColor: '#2DD4BF',
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },

  // Brand Intro
  brandIntroContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    width: '100%',
    overflow: 'visible',
  },
  
  brandLogoSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    width: '100%',
    overflow: 'visible',
    zIndex: 10,
  },
  brandLogoText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#16A34A',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  brandTagline: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 6,
    fontWeight: '400',
    letterSpacing: 0.3,
    textAlign: 'center',
  },

  // Data Icon with Ring
  dataIconContainer: {
    width: 88,
    height: 88,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 32,
    position: 'relative',
  },
  dataRingThin: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1.5,
  },
  ring1: {
    width: 88,
    height: 88,
    borderColor: '#16A34A',
    opacity: 0.2,
  },
  ring2: {
    width: 88,
    height: 88,
    borderColor: 'transparent',
    opacity: 0,
  },
  ring3: {
    width: 88,
    height: 88,
    borderColor: 'transparent',
    opacity: 0,
  },
  dataIconCenter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  barChartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 28,
  },
  bar: {
    width: 5,
    borderRadius: 2.5,
  },
  bar1: {
    height: 12,
    backgroundColor: '#86EFAC',
  },
  bar2: {
    height: 20,
    backgroundColor: '#4ADE80',
  },
  bar3: {
    height: 16,
    backgroundColor: '#22C55E',
  },
  bar4: {
    height: 26,
    backgroundColor: '#16A34A',
  },
  chartCurve: {
    display: 'none',
  },

  // Promise Section
  promiseSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
    paddingHorizontal: 32,
    width: '100%',
  },
  promiseTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  promiseText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: '400',
  },

  // Bouncing Line
  bouncingLineContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  bouncingLine: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
  },
  

  // Clean Step Styles
  stepContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 48,
  },
  stepTitleClean: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  stepSubtitleClean: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  optionsClean: {
    gap: 12,
  },
  optionClean: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  optionCleanSelected: {
    borderColor: '#16A34A',
    backgroundColor: '#ECFDF5',
    borderWidth: 2,
  },
  optionCleanText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4B5563',
  },
  optionCleanTextSelected: {
    color: '#15803D',
    fontWeight: '600',
  },
  nameInputSection: {
    marginBottom: 8,
  },
  nameInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 20,
    fontSize: 18,
    fontWeight: '500',
    color: '#1F2937',
    textAlign: 'center',
  },

  // Steps
  stepTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 32,
  },

  // Options
  optionsGrid: {
    gap: 12,
  },
  optionsList: {
    gap: 12,
  },
  optionsScroll: {
    maxHeight: SCREEN_HEIGHT * 0.4,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    gap: 14,
  },
  optionBtnSelected: {
    borderColor: '#2DD4BF',
    backgroundColor: '#F0FDFA',
  },
  optionIcon: {
    fontSize: 26,
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#1E293B',
    textAlign: 'right',
  },
  optionLabelSelected: {
    color: '#0F766E',
    fontWeight: '600',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2DD4BF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // Inputs
  inputsContainer: {
    gap: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inputContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    paddingHorizontal: 20,
  },
  numberInput: {
    fontSize: 24,
    fontWeight: '600',
    color: '#0F172A',
    paddingVertical: 16,
    textAlign: 'center',
  },
  unitText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#64748B',
    width: 50,
  },
  dataNote: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 20,
  },

  // Bottom
  bottomContainer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 20 : 24,
    paddingTop: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  nextBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  nextBtnBrand: {
    backgroundColor: '#16A34A',
    borderRadius: 14,
    height: 54,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  nextBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  nextBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  nextBtnTextBrand: {
    fontSize: 16,
    fontWeight: '600',
  },
  ctaSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 12,
  },
  backBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  backBtnText: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  },

  // Calculating
  calcContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  calcContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calcTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 16,
  },

  // Results - Clean White Design
  resultsContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  resultsContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  resultsHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  resultsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  resultsSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },

  mainCalorieCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
  },
  mainCalorieLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  mainCalorieValue: {
    fontSize: 42,
    fontWeight: '700',
    color: '#16A34A',
  },
  mainCalorieUnit: {
    fontSize: 13,
    color: '#22C55E',
    marginTop: 2,
    fontWeight: '500',
  },

  macrosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  macroCard: {
    width: (SCREEN_WIDTH - 56) / 2,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  macroIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  macroValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#16A34A',
  },
  macroLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },

  // BMI Section - Premium Animated Design
  bmiSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  bmiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  bmiTitleRow: {
    flex: 1,
  },
  bmiTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: 4,
  },
  bmiCategoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bmiCategoryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bmiValueLarge: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  bmiScaleWrapper: {
    marginBottom: 16,
  },
  bmiScaleTrack: {
    position: 'relative',
    height: 32,
    justifyContent: 'center',
  },
  bmiGradientTrack: {
    height: 8,
    borderRadius: 4,
  },
  bmiIndicatorAnimated: {
    position: 'absolute',
    top: 4,
    marginLeft: -12,
    alignItems: 'center',
  },
  bmiIndicatorGlow: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    opacity: 0.25,
  },
  bmiIndicatorBall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  bmiIndicatorShine: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  bmiScaleNumbers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: 8,
  },
  bmiScaleNum: {
    fontSize: 10,
    fontWeight: '500',
    color: '#94A3B8',
  },
  bmiMessageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    gap: 10,
  },
  bmiMessageIcon: {
    fontSize: 20,
  },
  bmiMessageText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'right',
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  statChipLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  statChipValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  editChip: {
    backgroundColor: '#F0FDF4',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  editChipText: {
    fontSize: 12,
  },

  resultsFooter: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 16 : 20,
    paddingTop: 8,
    backgroundColor: '#FFFFFF',
  },
  footerNote: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 10,
  },
  confirmBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  confirmBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Edit styles
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  editInput: {
    fontSize: 38,
    fontWeight: '700',
    color: '#16A34A',
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#16A34A',
    paddingVertical: 4,
    minWidth: 100,
  },
  editHint: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 2,
  },
  submitBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#16A34A',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  submitBtnText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  macroEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  macroEditInput: {
    fontSize: 18,
    fontWeight: '700',
    color: '#16A34A',
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#16A34A',
    paddingVertical: 2,
    minWidth: 50,
  },
  macroSubmitBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#16A34A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  macroSubmitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  editInfoChip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editInfoText: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
  },
});
