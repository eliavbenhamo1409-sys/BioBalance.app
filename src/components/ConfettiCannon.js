import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CONFETTI_COUNT = 50;

const ConfettiCannon = () => {
  const confettiPieces = useRef(
    [...Array(CONFETTI_COUNT)].map(() => ({
      x: new Animated.Value(Math.random() * SCREEN_WIDTH),
      y: new Animated.Value(-20),
      rotation: new Animated.Value(0),
      color: ['#F97316', '#6366F1', '#EAB308', '#3B82F6', '#10B981'][Math.floor(Math.random() * 5)],
      size: Math.random() * 6 + 4,
    }))
  ).current;

  useEffect(() => {
    const animations = confettiPieces.map((piece, index) => {
      const duration = 2500 + Math.random() * 1000;
      const delay = index * 30;
      
      return Animated.parallel([
        Animated.timing(piece.y, {
          toValue: SCREEN_HEIGHT + 50,
          duration,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(piece.x, {
          toValue: piece.x._value + (Math.random() - 0.5) * 100,
          duration,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(piece.rotation, {
          toValue: Math.random() * 720,
          duration,
          delay,
          useNativeDriver: true,
        }),
      ]);
    });

    Animated.stagger(20, animations).start();
  }, []);

  return (
    <View style={styles.container} pointerEvents="none">
      {confettiPieces.map((piece, index) => (
        <Animated.View
          key={index}
          style={[
            styles.confetti,
            {
              width: piece.size,
              height: piece.size * 1.5,
              backgroundColor: piece.color,
              transform: [
                { translateX: piece.x },
                { translateY: piece.y },
                {
                  rotate: piece.rotation.interpolate({
                    inputRange: [0, 360],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  confetti: {
    position: 'absolute',
    borderRadius: 2,
  },
});

export default ConfettiCannon;





