import { Platform, ViewStyle } from 'react-native';
import { darkColors, darkPalette, lightColors, lightPalette, ThemeColors } from './colors';
import { radius, spacing, RadiusKey, SpacingKey } from './spacing';
import { typography, TypographyVariant } from './typography';

export * from './colors';
export * from './spacing';
export * from './typography';

export const shadows: Record<'sm' | 'md' | 'lg' | 'glow', ViewStyle> = {
  sm: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.25,
      shadowRadius: 3,
    },
    android: {
      elevation: 2,
    },
    default: {},
  }) as ViewStyle,
  md: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
    },
    android: {
      elevation: 4,
    },
    default: {},
  }) as ViewStyle,
  lg: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.45,
      shadowRadius: 16,
    },
    android: {
      elevation: 8,
    },
    default: {},
  }) as ViewStyle,
  glow: Platform.select({
    ios: {
      shadowColor: '#FFFF00',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.28,
      shadowRadius: 18,
    },
    android: {
      elevation: 12,
    },
    default: {
      boxShadow: '0 0 24px rgba(255, 255, 0, 0.22)',
    },
  }) as ViewStyle,
};

export type ShadowKey = keyof typeof shadows;

export interface AppTheme {
  colors: ThemeColors;
  isDark: boolean;
  spacing: typeof spacing;
  typography: typeof typography;
  radius: typeof radius;
  shadows: typeof shadows;
}

/**
 * Primary theme hook for FTC Pulse application screens and components.
 * Returns the signature #FFFF00 electric yellow & 2 yellow-tinted blacks (#0B0B05 & #15150B)
 * borderless palette, tactical typography, and sharp radius tokens.
 */
export function useAppTheme(): AppTheme {
  // Always render in signature yellow & 2 yellow-tinted blacks aesthetic
  const isDark = true;
  const colors = darkColors;

  return {
    colors,
    isDark,
    spacing,
    typography,
    radius,
    shadows,
  };
}
