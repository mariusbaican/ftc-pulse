import { Platform, TextStyle } from 'react-native';

const sansFontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  default: 'normal',
});

const monoFontFamily = Platform.select({
  ios: 'ui-monospace',
  android: 'monospace',
  web: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  default: 'monospace',
});

export const typography: Record<
  'hero' | 'largeTitle' | 'title' | 'headline' | 'body' | 'subhead' | 'caption' | 'mono' | 'tabularNumber',
  TextStyle
> = {
  hero: {
    fontFamily: sansFontFamily,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  largeTitle: {
    fontFamily: sansFontFamily,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  title: {
    fontFamily: sansFontFamily,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headline: {
    fontFamily: sansFontFamily,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: sansFontFamily,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  subhead: {
    fontFamily: sansFontFamily,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  caption: {
    fontFamily: sansFontFamily,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  mono: {
    fontFamily: monoFontFamily,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  tabularNumber: {
    fontFamily: monoFontFamily,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
};

export type TypographyVariant = keyof typeof typography;
