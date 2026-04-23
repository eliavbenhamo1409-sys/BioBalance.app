import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { colors, shadows } from '../styles/theme';

const { width } = Dimensions.get('window');

const DailyBalance = ({ stats, targets }) => {
  const items = [
    {
      emoji: '🔥',
      label: 'קלוריות',
      current: stats?.calories || 0,
      target: targets?.calories || 2000,
      color: colors.nutrition.calories,
      gradient: ['#FF6B6B', '#FF8E8E'],
    },
    {
      emoji: '💪',
      label: 'חלבון',
      current: stats?.protein || 0,
      target: targets?.protein || 90,
      color: colors.nutrition.protein,
      unit: 'g',
    },
    {
      emoji: '🥑',
      label: 'שומן',
      current: stats?.fat || 0,
      target: targets?.fat || 65,
      color: colors.nutrition.fat,
      unit: 'g',
    },
    {
      emoji: '💧',
      label: 'מים',
      current: stats?.water_glasses || 0,
      target: targets?.water || 8,
      color: colors.nutrition.water,
      unit: '',
    },
  ];

  return (
    <View style={styles.container}>
      {/* Main Calories Card */}
      <View style={styles.mainCard}>
        <View style={styles.mainCardContent}>
          <View style={styles.mainLeft}>
            <Text style={styles.mainEmoji}>🔥</Text>
            <View>
              <Text style={styles.mainLabel}>קלוריות היום</Text>
              <View style={styles.mainValues}>
                <Text style={styles.mainCurrent}>{items[0].current.toLocaleString()}</Text>
                <Text style={styles.mainTarget}>/ {items[0].target.toLocaleString()}</Text>
              </View>
            </View>
          </View>
          <View style={styles.mainRight}>
            <CircularProgress 
              percentage={Math.min(100, Math.round((items[0].current / items[0].target) * 100))}
              color={items[0].color}
              size={56}
            />
          </View>
        </View>
        <View style={styles.mainProgressBg}>
          <Animated.View 
            style={[
              styles.mainProgressFill, 
              { 
                width: `${Math.min(100, (items[0].current / items[0].target) * 100)}%`,
                backgroundColor: items[0].color,
              }
            ]} 
          />
        </View>
      </View>

      {/* Secondary Stats Row */}
      <View style={styles.secondaryRow}>
        {items.slice(1).map((item, index) => {
          const percentage = Math.min(100, Math.round((item.current / item.target) * 100));
          return (
            <View key={index} style={styles.secondaryCard}>
              <View style={styles.secondaryHeader}>
                <Text style={styles.secondaryEmoji}>{item.emoji}</Text>
                <Text style={styles.secondaryPercentage}>{percentage}%</Text>
              </View>
              <Text style={styles.secondaryLabel}>{item.label}</Text>
              <View style={styles.secondaryProgressBg}>
                <View 
                  style={[
                    styles.secondaryProgressFill, 
                    { 
                      width: `${percentage}%`,
                      backgroundColor: item.color,
                    }
                  ]} 
                />
              </View>
              <Text style={styles.secondaryValues}>
                {item.current}{item.unit} / {item.target}{item.unit}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

// Circular Progress Component
const CircularProgress = ({ percentage, color, size }) => {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[styles.circularBg, { width: size, height: size, borderRadius: size / 2 }]}>
        <View style={[
          styles.circularFill, 
          { 
            width: size - 8, 
            height: size - 8, 
            borderRadius: (size - 8) / 2,
          }
        ]}>
          <Text style={styles.circularText}>{percentage}%</Text>
        </View>
      </View>
      {/* Progress ring effect */}
      <View style={[
        styles.circularRing,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
          borderWidth: strokeWidth,
          position: 'absolute',
          opacity: 0.3,
        }
      ]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  mainCard: {
    backgroundColor: colors.bg.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    ...shadows.medium,
  },
  mainCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mainLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mainEmoji: {
    fontSize: 32,
  },
  mainLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  mainValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  mainCurrent: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
  },
  mainTarget: {
    fontSize: 16,
    color: colors.text.muted,
    marginLeft: 4,
  },
  mainRight: {},
  mainProgressBg: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  mainProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryCard: {
    flex: 1,
    backgroundColor: colors.bg.card,
    borderRadius: 16,
    padding: 12,
    ...shadows.small,
  },
  secondaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  secondaryEmoji: {
    fontSize: 20,
  },
  secondaryPercentage: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  secondaryLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: 8,
  },
  secondaryProgressBg: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  secondaryProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  secondaryValues: {
    fontSize: 11,
    color: colors.text.muted,
    textAlign: 'center',
  },
  circularBg: {
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularFill: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.primary,
  },
  circularRing: {},
});

export default DailyBalance;
