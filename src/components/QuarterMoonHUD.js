import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const QuarterMoonHUD = ({ stats, targets, onPress }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  
  // Animations
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Calculate percentages
  const caloriesConsumed = stats?.calories || 0;
  const caloriesTarget = targets?.calories || 2000;
  const caloriesRemaining = Math.max(0, caloriesTarget - caloriesConsumed);
  const caloriesPercent = Math.min(100, (caloriesConsumed / caloriesTarget) * 100);
  
  const proteinPercent = Math.min(100, ((stats?.protein || 0) / (targets?.protein || 90)) * 100);
  const fatPercent = Math.min(100, ((stats?.fat || 0) / (targets?.fat || 65)) * 100);
  const waterPercent = Math.min(100, ((stats?.water_glasses || 0) / (targets?.water || 8)) * 100);

  // Pulse animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Get gradient color based on percentage
  const getGradientColors = (percent) => {
    if (percent < 50) return ['#22C55E', '#4ADE80']; // Green
    if (percent < 80) return ['#F59E0B', '#FBBF24']; // Amber
    return ['#EF4444', '#F87171']; // Red
  };

  const gradientColors = getGradientColors(caloriesPercent);

  // Handle tap
  const handleTap = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    
    setIsExpanded(true);
    Animated.spring(expandAnim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }).start();
  };

  const handleClose = () => {
    Animated.spring(expandAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }).start(() => {
      setIsExpanded(false);
    });
  };

  // Trigger celebration when goal reached
  useEffect(() => {
    if (caloriesPercent >= 100 || proteinPercent >= 100) {
      setShowCelebration(true);
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => setShowCelebration(false));
    }
  }, [caloriesPercent, proteinPercent]);

  // Progress Arc
  const size = 70;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (caloriesPercent / 100) * circumference * 0.75; // Quarter

  return (
    <>
      {/* Quarter Moon Widget */}
      <Animated.View 
        style={[
          styles.container,
          { 
            transform: [{ scale: Animated.multiply(scaleAnim, pulseAnim) }],
          }
        ]}
      >
        <TouchableOpacity onPress={handleTap} activeOpacity={0.9} style={styles.touchable}>
          {/* Glow Effect */}
          {showCelebration && (
            <Animated.View style={[styles.glow, { opacity: glowAnim }]} />
          )}
          
          {/* Arc Background */}
          <View style={styles.arcContainer}>
            <Svg width={size} height={size} style={styles.svg}>
              <Defs>
                <LinearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor={gradientColors[0]} />
                  <Stop offset="100%" stopColor={gradientColors[1]} />
                </LinearGradient>
              </Defs>
              
              {/* Background Arc */}
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${circumference * 0.75} ${circumference}`}
                strokeLinecap="round"
                rotation={135}
                origin={`${size / 2}, ${size / 2}`}
              />
              
              {/* Progress Arc */}
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="url(#progressGradient)"
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                rotation={135}
                origin={`${size / 2}, ${size / 2}`}
              />
            </Svg>
            
            {/* Center Number */}
            <View style={styles.centerContent}>
              <Text style={styles.remainingNumber}>{caloriesRemaining}</Text>
              <Text style={styles.remainingLabel}>נשאר</Text>
            </View>
          </View>
          
          {/* Mini Indicators */}
          <View style={styles.miniIndicators}>
            <View style={[styles.miniDot, { backgroundColor: '#9B59B6', opacity: proteinPercent > 50 ? 1 : 0.4 }]} />
            <View style={[styles.miniDot, { backgroundColor: '#F39C12', opacity: fatPercent > 50 ? 1 : 0.4 }]} />
            <View style={[styles.miniDot, { backgroundColor: '#3498DB', opacity: waterPercent > 50 ? 1 : 0.4 }]} />
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Expanded Dashboard Modal */}
      <Modal visible={isExpanded} transparent animationType="none" onRequestClose={handleClose}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={handleClose}>
          <Animated.View 
            style={[
              styles.expandedCard,
              {
                opacity: expandAnim,
                transform: [
                  { translateY: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [-50, 0] }) },
                  { scale: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
                ],
              }
            ]}
          >
            {/* Glass Background */}
            <View style={styles.glassCard}>
              {/* Hero: Calories Ring */}
              <View style={styles.heroSection}>
                <Svg width={120} height={120}>
                  <Defs>
                    <LinearGradient id="heroGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <Stop offset="0%" stopColor={gradientColors[0]} />
                      <Stop offset="100%" stopColor={gradientColors[1]} />
                    </LinearGradient>
                  </Defs>
                  
                  <Circle
                    cx={60}
                    cy={60}
                    r={50}
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth={12}
                    fill="none"
                  />
                  <Circle
                    cx={60}
                    cy={60}
                    r={50}
                    stroke="url(#heroGradient)"
                    strokeWidth={12}
                    fill="none"
                    strokeDasharray={50 * 2 * Math.PI}
                    strokeDashoffset={(50 * 2 * Math.PI) * (1 - caloriesPercent / 100)}
                    strokeLinecap="round"
                    rotation={-90}
                    origin="60, 60"
                  />
                </Svg>
                
                <View style={styles.heroCenter}>
                  <Text style={styles.heroNumber}>{caloriesConsumed}</Text>
                  <Text style={styles.heroLabel}>/{caloriesTarget}</Text>
                </View>
              </View>

              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatLabel}>נצרכו</Text>
                  <Text style={styles.heroStatValue}>{caloriesConsumed}</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatLabel}>נשארו</Text>
                  <Text style={[styles.heroStatValue, { color: gradientColors[0] }]}>{caloriesRemaining}</Text>
                </View>
              </View>

              {/* Secondary Stats */}
              <View style={styles.secondaryStats}>
                <StatBar 
                  emoji="💪" 
                  label="חלבון" 
                  current={stats?.protein || 0} 
                  target={targets?.protein || 90} 
                  color="#9B59B6" 
                  unit="g"
                />
                <StatBar 
                  emoji="🥑" 
                  label="שומן" 
                  current={stats?.fat || 0} 
                  target={targets?.fat || 65} 
                  color="#F39C12" 
                  unit="g"
                />
                <StatBar 
                  emoji="💧" 
                  label="מים" 
                  current={stats?.water_glasses || 0} 
                  target={targets?.water || 8} 
                  color="#3498DB" 
                  unit=""
                />
              </View>

              {/* Close hint */}
              <Text style={styles.closeHint}>לחץ בכל מקום לסגירה</Text>
            </View>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

// Stat Bar Component
const StatBar = ({ emoji, label, current, target, color, unit }) => {
  const percent = Math.min(100, (current / target) * 100);
  
  return (
    <View style={styles.statBar}>
      <View style={styles.statBarHeader}>
        <Text style={styles.statBarEmoji}>{emoji}</Text>
        <Text style={styles.statBarLabel}>{label}</Text>
        <Text style={styles.statBarValue}>{current}{unit}/{target}{unit}</Text>
      </View>
      <View style={styles.statBarBg}>
        <Animated.View style={[styles.statBarFill, { width: `${percent}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    right: 12,
    zIndex: 1000,
  },
  touchable: {
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#22C55E',
    opacity: 0.4,
  },
  arcContainer: {
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 31, 54, 0.95)',
    borderRadius: 35,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  svg: {
    position: 'absolute',
  },
  centerContent: {
    alignItems: 'center',
  },
  remainingNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  remainingLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.6)',
    marginTop: -2,
  },
  miniIndicators: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 4,
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 130,
    paddingRight: 12,
  },
  expandedCard: {
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 320,
  },
  glassCard: {
    backgroundColor: 'rgba(26, 31, 54, 0.97)',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 15,
  },

  // Hero Section
  heroSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  heroCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: -4,
  },
  heroStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 32,
  },
  heroStat: {
    alignItems: 'center',
  },
  heroStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
  },
  heroStatValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  heroStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Secondary Stats
  secondaryStats: {
    gap: 16,
  },
  statBar: {
    gap: 8,
  },
  statBarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statBarEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  statBarLabel: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  statBarValue: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  statBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  statBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  closeHint: {
    textAlign: 'center',
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 20,
  },
});

export default QuarterMoonHUD;





