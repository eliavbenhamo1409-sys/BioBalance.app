// Premium Design Theme - Nature Bot
// Inspired by top-tier apps like Headspace, Calm, Noom

// Legacy COLORS export for backward compatibility
export const COLORS = {
  primary: '#22C55E',
  secondary: '#2DD4BF',
  background: '#0F172A',
  card: '#1E293B',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  border: '#334155',
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
};

// Legacy FONTS export
export const FONTS = {
  regular: undefined, // Will use system default
  medium: undefined,
  bold: undefined,
};

export const colors = {
  // Primary palette - Deep navy to light blue gradient feel
  primary: {
    dark: '#1A1F36',      // Deep navy
    main: '#2D3748',      // Slate
    light: '#4A5568',     // Gray blue
  },
  
  // Accent colors - Warm coral/orange for energy
  accent: {
    coral: '#FF6B6B',     // Warm coral
    peach: '#FFA07A',     // Light salmon
    gold: '#FFD93D',      // Warm gold
    mint: '#6BCB77',      // Fresh mint (success)
  },
  
  // Nutrition specific
  nutrition: {
    calories: '#FF6B6B',  // Coral
    protein: '#9B59B6',   // Purple
    fat: '#F39C12',       // Orange
    water: '#3498DB',     // Blue
  },
  
  // Background
  bg: {
    primary: '#F8FAFC',   // Very light gray
    secondary: '#FFFFFF',
    card: '#FFFFFF',
    dark: '#1A1F36',
  },
  
  // Text
  text: {
    primary: '#1A1F36',
    secondary: '#64748B',
    muted: '#94A3B8',
    inverse: '#FFFFFF',
  },
  
  // Borders
  border: {
    light: '#E2E8F0',
    medium: '#CBD5E1',
  },
};

export const shadows = {
  small: {
    shadowColor: '#1A1F36',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  medium: {
    shadowColor: '#1A1F36',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  large: {
    shadowColor: '#1A1F36',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
  glow: (color) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  }),
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};


