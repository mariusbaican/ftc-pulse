/**
 * 4pt/8pt Grid Spacing and Tactical Border Radius Tokens for FTC Pulse.
 * Designed for a sharp, tactical robotics aesthetic with small corner radiuses.
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export type SpacingKey = keyof typeof spacing;

export const radius = {
  xs: 2,
  sm: 4,
  md: 6,
  lg: 6,
  xl: 8,
  full: 4, // sharp tactical tags instead of round pills
} as const;

export type RadiusKey = keyof typeof radius;
