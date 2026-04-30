import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';

/**
 * אותו מראה בכל מקום: 3D, מצלמה, תפריט, תוכנית יומית, ועוד.
 * @param {number} [size=32] — קוטר; ברירת מחדל 32 בתוך iconBtn 38; אפשר להגדיל לטקסט.
 */
const styles = StyleSheet.create({
  chip: {
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2.5,
    elevation: 2,
  },
});

function GrayIconChip({ children, style, size = 32, ...rest }) {
  const dim = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[styles.chip, dim, style]} {...rest}>
      {children}
    </View>
  );
}

export default memo(GrayIconChip);
