import React, { memo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Pressable,
  Image,
} from 'react-native';

const LOGO_IMAGE = require('../../assets/logo.png');
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MENU_WIDTH = Math.min(SCREEN_WIDTH * 0.75, 300);

// Ultra-smooth spring config (same as balance header)
const SPRING_CONFIG = {
  damping: 20,
  stiffness: 90,
  mass: 0.8,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
};

const menuItems = [
  { id: 'home', label: 'דף בית', icon: '🏠', screen: 'Home' },
  { id: 'birkat-hamazon', label: 'ברכת המזון', icon: '📿', screen: 'BirkatHamazon' },
  { id: 'ai-insights', label: 'AI ניתוח', icon: '🧠', screen: 'AIInsights' },
  { id: 'reminders', label: 'תזכורות ארוחות', icon: '🔔', screen: 'NotificationSettings' },
  { id: 'statistics', label: 'סטטיסטיקות', icon: '📊', screen: 'Statistics' },
  { id: 'recipes', label: 'מתכונים', icon: '📖', screen: 'Recipes' },
  { id: 'settings', label: 'הגדרות', icon: '⚙️', screen: 'Profile' },
  { id: 'sources', label: 'אודות ומקורות', icon: '📚', screen: 'Sources' },
];

const MenuItem = memo(({ label, icon, onPress, index, progress }) => {
  const itemStyle = useAnimatedStyle(() => {
    const delay = index * 0.08;
    const itemProgress = interpolate(
      progress.value,
      [delay, delay + 0.4],
      [0, 1],
      Extrapolate.CLAMP
    );
    
    return {
      opacity: itemProgress,
      transform: [
        { translateX: interpolate(itemProgress, [0, 1], [30, 0], Extrapolate.CLAMP) },
        { scale: interpolate(itemProgress, [0, 1], [0.95, 1], Extrapolate.CLAMP) },
      ],
    };
  });

  return (
    <Animated.View style={itemStyle}>
      <TouchableOpacity 
        style={styles.menuItem} 
        onPress={onPress} 
        activeOpacity={0.7}
      >
        <View style={styles.menuItemContent}>
          <Text style={styles.menuLabel}>{label}</Text>
          <Text style={styles.menuIcon}>{icon}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

function SideMenu({ isOpen, onClose, onNavigate, profile }) {
  const slideProgress = useSharedValue(0);
  const itemsProgress = useSharedValue(0);

  useEffect(() => {
    if (isOpen) {
      slideProgress.value = withSpring(1, SPRING_CONFIG);
      itemsProgress.value = withTiming(1, { 
        duration: 500, 
        easing: Easing.bezier(0.25, 0.1, 0.25, 1) 
      });
    } else {
      itemsProgress.value = withTiming(0, { duration: 150 });
      slideProgress.value = withSpring(0, { ...SPRING_CONFIG, stiffness: 120 });
    }
  }, [isOpen]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(slideProgress.value, [0, 1], [0, 1], Extrapolate.CLAMP),
    pointerEvents: slideProgress.value > 0.1 ? 'auto' : 'none',
  }));

  const menuStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(slideProgress.value, [0, 1], [MENU_WIDTH, 0], Extrapolate.CLAMP) },
    ],
  }));

  const headerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(slideProgress.value, [0.3, 1], [0, 1], Extrapolate.CLAMP),
    transform: [
      { scale: interpolate(slideProgress.value, [0.3, 1], [0.9, 1], Extrapolate.CLAMP) },
    ],
  }));

  const handleNavigate = useCallback((screen) => {
    onClose();
    setTimeout(() => onNavigate(screen), 250);
  }, [onClose, onNavigate]);

  if (!isOpen && slideProgress.value === 0) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents={isOpen ? 'auto' : 'none'}>
      {/* Backdrop with blur effect */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={styles.backdropTouch} onPress={onClose} />
      </Animated.View>

      {/* Menu Panel */}
      <Animated.View style={[styles.menuPanel, menuStyle]}>
        {/* Header - Clean White */}
        <View style={styles.menuHeader}>
          {/* Header Content */}
          <Animated.View style={[styles.headerContent, headerStyle]}>
            {/* User Info Card */}
            {profile?.name && (
              <View style={styles.userInfo}>
                {/* User name on LEFT */}
                <View style={styles.userTextContainer}>
                  <Text style={styles.userName}>{profile.name}</Text>
                  <Text style={styles.userStatus}>מחובר</Text>
                </View>
                {/* Online indicator */}
                <View style={styles.onlineIndicator} />
                {/* Avatar on RIGHT */}
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{profile.name.charAt(0).toUpperCase()}</Text>
                </View>
              </View>
            )}
          </Animated.View>
        </View>

        {/* Decorative line */}
        <View style={styles.decorLine} />

        {/* Menu Items */}
        <View style={styles.menuItems}>
          {menuItems.map((item, index) => (
            <MenuItem
              key={item.id}
              label={item.label}
              icon={item.icon}
              index={index}
              progress={itemsProgress}
              onPress={() => handleNavigate(item.screen)}
            />
          ))}
        </View>

        {/* Footer with Logo */}
        <View style={styles.menuFooter}>
          <View style={styles.footerDivider} />
          <Image source={LOGO_IMAGE} style={styles.footerLogoImage} resizeMode="contain" />
          <Text style={styles.footerTagline}>Balanced by data. Personalized for you.</Text>
          <Text style={styles.footerVersion}>v1.0</Text>
        </View>
      </Animated.View>
    </View>
  );
}

export default memo(SideMenu);

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  backdropTouch: {
    flex: 1,
  },
  menuPanel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: MENU_WIDTH,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: -8, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 20,
    borderTopLeftRadius: 28,
    borderBottomLeftRadius: 28,
  },
  menuHeader: {
    height: 140,
    borderTopLeftRadius: 28,
    backgroundColor: '#FFFFFF',
  },
  headerContent: {
    flex: 1,
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    justifyContent: 'flex-end',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#16A34A',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#16A34A',
  },
  userTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 2,
    textAlign: 'left',
  },
  userStatus: {
    fontSize: 12,
    color: '#22C55E',
    textAlign: 'left',
  },
  onlineIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    marginRight: 10,
  },
  decorLine: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 24,
    marginTop: 16,
  },
  menuItems: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 8,
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginVertical: 3,
    borderRadius: 14,
    backgroundColor: 'transparent',
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'right',
  },
  menuIcon: {
    fontSize: 20,
    marginLeft: 12,
  },
  menuFooter: {
    paddingVertical: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  footerDivider: {
    width: 50,
    height: 1,
    backgroundColor: '#D1D5DB',
    marginBottom: 16,
  },
  footerLogoImage: {
    width: 130,
    height: 30,
    marginBottom: 8,
  },
  footerTagline: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 8,
  },
  footerVersion: {
    fontSize: 10,
    color: '#D1D5DB',
  },
});
