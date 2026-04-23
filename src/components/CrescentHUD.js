import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
} from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CrescentHUD = forwardRef(({ stats, targets, onOpenFull }, ref) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationText, setCelebrationText] = useState('');
  
  // Animations
  const expandAnim = useRef(new Animated.Value(0)).current;
  const celebrationAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const confettiAnim = useRef(new Animated.Value(0)).current;

  // Calculate percentages
  const caloriesConsumed = stats?.calories || 0;
  const caloriesTarget = targets?.calories || 2000;
  const caloriesRemaining = Math.max(0, caloriesTarget - caloriesConsumed);
  const caloriesPercent = Math.min(100, (caloriesConsumed / caloriesTarget) * 100);
  
  const proteinConsumed = stats?.protein || 0;
  const proteinTarget = targets?.protein || 90;
  const proteinPercent = Math.min(100, (proteinConsumed / proteinTarget) * 100);
  
  const fatConsumed = stats?.fat || 0;
  const fatTarget = targets?.fat || 65;
  const fatPercent = Math.min(100, (fatConsumed / fatTarget) * 100);
  
  const waterConsumed = stats?.water_glasses || 0;
  const waterTarget = targets?.water || 8;
  const waterPercent = Math.min(100, (waterConsumed / waterTarget) * 100);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    showFoodAdded: (foodName, calories, protein, fat) => {
      openWithAnimation();
      
      // Check for goal achievements
      setTimeout(() => {
        if (caloriesConsumed + calories >= caloriesTarget && caloriesConsumed < caloriesTarget) {
          triggerCelebration('🎉 הגעת ליעד הקלוריות!');
        } else if (proteinConsumed + protein >= proteinTarget && proteinConsumed < proteinTarget) {
          triggerCelebration('💪 סחטיין! הגעת ליעד החלבון!');
        } else if (fatConsumed + fat >= fatTarget && fatConsumed < fatTarget) {
          triggerCelebration('🥑 יעד השומן הושלם!');
        }
      }, 800);
    },
    openPanel: () => openWithAnimation(),
    closePanel: () => closeWithAnimation(),
  }));

  const openWithAnimation = () => {
    setIsExpanded(true);
    Animated.parallel([
      Animated.spring(expandAnim, { toValue: 1, tension: 40, friction: 8, useNativeDriver: true }),
      Animated.timing(progressAnim, { toValue: 1, duration: 800, useNativeDriver: false }),
    ]).start();
  };

  const closeWithAnimation = () => {
    Animated.timing(expandAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
      setIsExpanded(false);
      progressAnim.setValue(0);
    });
  };

  const triggerCelebration = (text) => {
    setCelebrationText(text);
    setShowCelebration(true);
    Animated.sequence([
      Animated.timing(celebrationAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(celebrationAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setShowCelebration(false));
    
    // Confetti
    Animated.loop(
      Animated.timing(confettiAnim, { toValue: 1, duration: 3000, useNativeDriver: true }),
      { iterations: 1 }
    ).start(() => confettiAnim.setValue(0));
  };

  // Get gradient color
  const getColor = (percent) => {
    if (percent < 50) return '#22C55E';
    if (percent < 80) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <>
      {/* Crescent Shape - Top Right Corner */}
      <TouchableOpacity 
        style={styles.crescentContainer} 
        onPress={openWithAnimation}
        activeOpacity={0.9}
      >
        <Svg width={140} height={140} style={styles.crescentSvg}>
          <Defs>
            <LinearGradient id="crescentGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#1A1F36" />
              <Stop offset="100%" stopColor="#2D3454" />
            </LinearGradient>
          </Defs>
          
          {/* Crescent Shape - curves from top-right corner */}
          <Path
            d="M 140 0 
               Q 140 60, 100 100 
               Q 60 140, 0 140
               L 0 0 
               Z"
            fill="url(#crescentGradient)"
          />
          
          {/* Progress Arc inside crescent */}
          <Circle
            cx={105}
            cy={35}
            r={25}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={5}
            fill="none"
          />
          <Circle
            cx={105}
            cy={35}
            r={25}
            stroke={getColor(caloriesPercent)}
            strokeWidth={5}
            fill="none"
            strokeDasharray={25 * 2 * Math.PI}
            strokeDashoffset={(25 * 2 * Math.PI) * (1 - caloriesPercent / 100)}
            strokeLinecap="round"
            rotation={-90}
            origin="105, 35"
          />
        </Svg>
        
        {/* Calories Preview */}
        <View style={styles.crescentContent}>
          <Text style={styles.crescentNumber}>{caloriesRemaining}</Text>
          <Text style={styles.crescentLabel}>קל׳</Text>
        </View>
        
        {/* Mini indicators */}
        <View style={styles.miniDots}>
          <View style={[styles.miniDot, { backgroundColor: '#9B59B6', opacity: proteinPercent > 50 ? 1 : 0.3 }]} />
          <View style={[styles.miniDot, { backgroundColor: '#F39C12', opacity: fatPercent > 50 ? 1 : 0.3 }]} />
          <View style={[styles.miniDot, { backgroundColor: '#3498DB', opacity: waterPercent > 50 ? 1 : 0.3 }]} />
        </View>
      </TouchableOpacity>

      {/* Expanded Panel Modal */}
      <Modal visible={isExpanded} transparent animationType="none" onRequestClose={closeWithAnimation}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeWithAnimation}>
          <Animated.View 
            style={[
              styles.expandedPanel,
              {
                opacity: expandAnim,
                transform: [
                  { translateX: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [100, 0] }) },
                  { translateY: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [-50, 0] }) },
                ],
              }
            ]}
          >
            {/* Panel Header */}
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>מאזן יומי</Text>
              <TouchableOpacity onPress={closeWithAnimation}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Main Calories Ring */}
            <View style={styles.mainRingContainer}>
              <Svg width={160} height={160}>
                <Defs>
                  <LinearGradient id="mainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor={getColor(caloriesPercent)} />
                    <Stop offset="100%" stopColor={getColor(caloriesPercent)} stopOpacity={0.6} />
                  </LinearGradient>
                </Defs>
                
                <Circle cx={80} cy={80} r={65} stroke="rgba(255,255,255,0.1)" strokeWidth={12} fill="none" />
                <AnimatedCircle
                  cx={80}
                  cy={80}
                  r={65}
                  stroke="url(#mainGradient)"
                  strokeWidth={12}
                  fill="none"
                  strokeDasharray={65 * 2 * Math.PI}
                  strokeDashoffset={progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [65 * 2 * Math.PI, (65 * 2 * Math.PI) * (1 - caloriesPercent / 100)],
                  })}
                  strokeLinecap="round"
                  rotation={-90}
                  origin="80, 80"
                />
              </Svg>
              
              <View style={styles.ringCenter}>
                <Text style={styles.ringNumber}>{caloriesConsumed}</Text>
                <Text style={styles.ringTarget}>/ {caloriesTarget}</Text>
                <Text style={styles.ringLabel}>קלוריות</Text>
              </View>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statEmoji}>🔥</Text>
                <Text style={styles.statValue}>{caloriesRemaining}</Text>
                <Text style={styles.statLabel}>נשאר</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statEmoji}>📊</Text>
                <Text style={styles.statValue}>{Math.round(caloriesPercent)}%</Text>
                <Text style={styles.statLabel}>מהיעד</Text>
              </View>
            </View>

            {/* Progress Bars */}
            <View style={styles.progressSection}>
              <ProgressItem 
                emoji="💪" 
                label="חלבון" 
                current={proteinConsumed} 
                target={proteinTarget} 
                color="#9B59B6"
                unit="g"
                animProgress={progressAnim}
              />
              <ProgressItem 
                emoji="🥑" 
                label="שומן" 
                current={fatConsumed} 
                target={fatTarget} 
                color="#F39C12"
                unit="g"
                animProgress={progressAnim}
              />
              <ProgressItem 
                emoji="💧" 
                label="מים" 
                current={waterConsumed} 
                target={waterTarget} 
                color="#3498DB"
                unit=" כוסות"
                animProgress={progressAnim}
              />
            </View>
          </Animated.View>
        </TouchableOpacity>

        {/* Celebration Banner */}
        {showCelebration && (
          <Animated.View 
            style={[
              styles.celebrationBanner,
              {
                opacity: celebrationAnim,
                transform: [{ scale: celebrationAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
              }
            ]}
          >
            <Text style={styles.celebrationText}>{celebrationText}</Text>
            
            {/* Confetti */}
            <View style={styles.confettiContainer}>
              {[...Array(20)].map((_, i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.confetti,
                    {
                      left: `${Math.random() * 100}%`,
                      backgroundColor: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181'][i % 5],
                      transform: [
                        { translateY: confettiAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 150] }) },
                        { rotate: `${Math.random() * 360}deg` },
                      ],
                      opacity: confettiAnim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
                    }
                  ]}
                />
              ))}
            </View>
          </Animated.View>
        )}
      </Modal>
    </>
  );
});

// Animated Circle for SVG
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Progress Item Component
const ProgressItem = ({ emoji, label, current, target, color, unit, animProgress }) => {
  const percent = Math.min(100, (current / target) * 100);
  
  return (
    <View style={styles.progressItem}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressEmoji}>{emoji}</Text>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressValue}>{current}{unit} / {target}{unit}</Text>
      </View>
      <View style={styles.progressBarBg}>
        <Animated.View 
          style={[
            styles.progressBarFill, 
            { 
              backgroundColor: color,
              width: animProgress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', `${percent}%`],
              }),
            }
          ]} 
        />
      </View>
      {percent >= 100 && <Text style={styles.goalReached}>✓ יעד!</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  // Crescent
  crescentContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 1000,
  },
  crescentSvg: {
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  crescentContent: {
    position: 'absolute',
    top: 18,
    right: 18,
    alignItems: 'center',
  },
  crescentNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  crescentLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginTop: -2,
  },
  miniDots: {
    position: 'absolute',
    top: 65,
    right: 25,
    flexDirection: 'row',
    gap: 3,
  },
  miniDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  expandedPanel: {
    position: 'absolute',
    top: 60,
    right: 12,
    width: SCREEN_WIDTH * 0.88,
    maxWidth: 340,
    backgroundColor: '#1A1F36',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 15,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeBtn: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.5)',
    padding: 4,
  },

  // Main Ring
  mainRingContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  ringCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ringTarget: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: -4,
  },
  ringLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statEmoji: {
    fontSize: 16,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 4,
  },

  // Progress Section
  progressSection: {
    gap: 14,
  },
  progressItem: {
    position: 'relative',
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  progressLabel: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  progressValue: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  goalReached: {
    position: 'absolute',
    right: 0,
    top: 0,
    fontSize: 11,
    color: '#22C55E',
    fontWeight: '600',
  },

  // Celebration
  celebrationBanner: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.35,
    left: 20,
    right: 20,
    backgroundColor: '#22C55E',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
    overflow: 'hidden',
  },
  celebrationText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  confettiContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  confetti: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default CrescentHUD;





