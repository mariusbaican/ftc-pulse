import { Platform, ViewStyle } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { darkColors, lightColors, ThemeColors } from './colors';
import { radius, spacing, RadiusKey, SpacingKey } from './spacing';
import { typography, TypographyVariant } from './typography';

export * from './colors';
export * from './spacing';
export * from './typography';

export const shadows: Record<'sm' | 'md' | 'lg', ViewStyle> = {
  sm: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
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
      shadowOpacity: 0.12,
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
      shadowOpacity: 0.18,
      shadowRadius: 16,
    },
    android: {
      elevation: 8,
    },
    default: {},
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
 * Returns light or dark semantic colors, typography styles, 4pt spacing tokens, and shadow presets.
 */
export function useAppTheme(): AppTheme {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  return {
    colors,
    isDark,
    spacing,
    typography,
    radius,
    shadows,
  };
}
