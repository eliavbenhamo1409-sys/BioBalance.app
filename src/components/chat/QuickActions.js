import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

const QuickActions = ({ onAction, showSummary = false }) => {
  const actions = [
    { id: 'photo', emoji: '📸', label: 'צלם' },
    { id: 'water', emoji: '💧', label: 'מים' },
  ];

  if (showSummary) {
    actions.push({ id: 'summary', emoji: '📋', label: 'סיכום' });
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {actions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={styles.actionButton}
            onPress={() => onAction(action.id)}
          >
            <Text style={styles.actionEmoji}>{action.emoji}</Text>
            <Text style={styles.actionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 4,
  },
  scrollContent: {
    paddingHorizontal: 2,
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 4,
  },
  actionEmoji: {
    fontSize: 14,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
});

export default QuickActions;
