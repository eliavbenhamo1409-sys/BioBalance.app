import React, { memo, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';

// Same spring config as balance header
const SPRING_CONFIG = {
  damping: 20,
  stiffness: 90,
  mass: 0.7,
  overshootClamping: false,
};

function ChatMessage({ message, isBot }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(1, SPRING_CONFIG);
  }, []);

  const containerStyle = useAnimatedStyle(() => {
    const translateX = isBot 
      ? interpolate(progress.value, [0, 1], [-30, 0], Extrapolate.CLAMP)
      : interpolate(progress.value, [0, 1], [30, 0], Extrapolate.CLAMP);
    
    return {
      opacity: interpolate(progress.value, [0, 0.6], [0, 1], Extrapolate.CLAMP),
      transform: [
        { translateX },
        { scale: interpolate(progress.value, [0, 1], [0.92, 1], Extrapolate.CLAMP) },
      ],
    };
  });

  const avatarStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.3, 1], [0, 1], Extrapolate.CLAMP),
    transform: [
      { scale: interpolate(progress.value, [0.3, 1], [0.5, 1], Extrapolate.CLAMP) },
    ],
  }));

  return (
    <Animated.View style={[styles.container, isBot ? styles.botContainer : styles.userContainer, containerStyle]}>
      {isBot && (
        <Animated.View style={[styles.avatar, avatarStyle]}>
          <View style={styles.grayDot} />
        </Animated.View>
      )}
      <View style={[styles.bubble, isBot ? styles.botBubble : styles.userBubble]}>
        <Text style={[styles.text, isBot ? styles.botText : styles.userText]}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

export default memo(ChatMessage);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: 5,
    alignItems: 'flex-end',
    paddingHorizontal: 4,
  },
  botContainer: {
    justifyContent: 'flex-start',
  },
  userContainer: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  grayDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#32A728',  // Logo green
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  botBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  userBubble: {
    backgroundColor: '#0F172A',
    borderBottomRightRadius: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  botText: {
    color: '#1E293B',
    textAlign: 'right',
  },
  userText: {
    color: '#FFFFFF',
    textAlign: 'right',
  },
});
