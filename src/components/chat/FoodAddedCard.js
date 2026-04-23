import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

const FoodAddedCard = ({ foodName, grams, calories, protein, fat }) => {
  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.checkmark}>✓</Text>
        <Text style={styles.title}>{foodName}</Text>
        <Text style={styles.grams}>{grams}g</Text>
      </View>
      
      {/* Nutrition Row */}
      <View style={styles.nutritionRow}>
        <View style={styles.nutritionItem}>
          <Text style={styles.value}>{calories}</Text>
          <Text style={styles.label}>קלוריות</Text>
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.nutritionItem}>
          <Text style={styles.value}>{protein}g</Text>
          <Text style={styles.label}>חלבון</Text>
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.nutritionItem}>
          <Text style={styles.value}>{fat}g</Text>
          <Text style={styles.label}>שומן</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginVertical: 8,
    marginHorizontal: 4,
    borderWidth: 2,
    borderColor: '#22C55E',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  checkmark: {
    fontSize: 18,
    color: '#22C55E',
    fontWeight: '700',
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#22C55E',
    textAlign: 'right',
  },
  grams: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  nutritionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 14,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
  },
  nutritionItem: {
    alignItems: 'center',
    flex: 1,
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    color: '#22C55E',
  },
  label: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: '#E5E7EB',
  },
});

export default memo(FoodAddedCard);
