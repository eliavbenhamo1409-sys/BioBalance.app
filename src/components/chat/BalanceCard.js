import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../styles/theme';

// Balance Card - appears in chat as a special message
const BalanceCard = ({ stats, targets, onPress }) => {
  const caloriesPercent = Math.min(100, Math.round(((stats?.calories || 0) / (targets?.calories || 2000)) * 100));
  const proteinPercent = Math.min(100, Math.round(((stats?.protein || 0) / (targets?.protein || 90)) * 100));
  const waterPercent = Math.min(100, Math.round(((stats?.water_glasses || 0) / (targets?.water || 8)) * 100));
  
  const caloriesLeft = (targets?.calories || 2000) - (stats?.calories || 0);

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.header}>
        <Text style={styles.title}>📊 מאזן יומי</Text>
        <Text style={styles.tapHint}>לחץ לפרטים</Text>
      </View>
      
      {/* Main calories */}
      <View style={styles.caloriesRow}>
        <Text style={styles.caloriesEmoji}>🔥</Text>
        <View style={styles.caloriesInfo}>
          <View style={styles.caloriesNumbers}>
            <Text style={styles.caloriesCurrent}>{stats?.calories || 0}</Text>
            <Text style={styles.caloriesTarget}> / {targets?.calories || 2000}</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${caloriesPercent}%` }]} />
          </View>
        </View>
        <Text style={styles.caloriesLeft}>{caloriesLeft > 0 ? `נשארו ${caloriesLeft}` : 'הגעת ליעד!'}</Text>
      </View>

      {/* Mini stats */}
      <View style={styles.miniStats}>
        <View style={styles.miniStat}>
          <Text style={styles.miniEmoji}>💪</Text>
          <Text style={styles.miniLabel}>חלבון</Text>
          <Text style={styles.miniValue}>{proteinPercent}%</Text>
        </View>
        <View style={styles.miniDivider} />
        <View style={styles.miniStat}>
          <Text style={styles.miniEmoji}>💧</Text>
          <Text style={styles.miniLabel}>מים</Text>
          <Text style={styles.miniValue}>{waterPercent}%</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginVertical: 8,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.border.light,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  tapHint: {
    fontSize: 11,
    color: colors.text.muted,
  },
  caloriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  caloriesEmoji: {
    fontSize: 24,
    marginRight: 10,
  },
  caloriesInfo: {
    flex: 1,
  },
  caloriesNumbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  caloriesCurrent: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
  },
  caloriesTarget: {
    fontSize: 14,
    color: colors.text.muted,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.nutrition.calories,
    borderRadius: 3,
  },
  caloriesLeft: {
    fontSize: 11,
    color: colors.text.secondary,
    marginLeft: 8,
  },
  miniStats: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
  },
  miniStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  miniDivider: {
    width: 1,
    backgroundColor: colors.border.light,
    marginHorizontal: 8,
  },
  miniEmoji: {
    fontSize: 14,
  },
  miniLabel: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  miniValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
});

export default BalanceCard;





