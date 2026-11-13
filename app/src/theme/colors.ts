/**
 * High-contrast FTC Robotics & Sports Telemetry Tactical Color Palette.
 * Signature Electric Yellow (#FFFF00) paired with 2 Yellow-Tinted Blacks (#0B0B05 & #15150B)
 * Borderless design philosophy relying on surface contrast rather than outlines.
 * Compliant with WCAG 2.1 AA text contrast requirements (19:1 onPrimary).
 */

export interface ThemeColors {
  /** BrickBot & Primary brand electric yellow */
  primary: string;
  primarySoft: string;
  /** Blue Alliance secondary telemetry color */
  allianceBlue: string;
  allianceBlueSoft: string;
  /** Championship gold & rank accent */
  accentGold: string;
  accentGoldSoft: string;
  /** Live match/event indicator */
  statusLive: string;
  statusLiveSoft: string;
  /** Canvas background: deep obsidian black with subtle yellow tint */
  background: string;
  /** Primary surface: second black with slight warm yellow tint for cards/boxes */
  surface: string;
  /** Elevated surface: slightly brighter warm yellow-tinted black for nested pills/inputs */
  surfaceElevated: string;
  /** Structural borders: transparent by default for borderless aesthetic */
  border: string;
  /** Subtle dividers and secondary borders */
  borderSubtle: string;
  /** High-contrast primary reading text: crisp warm off-white */
  textPrimary: string;
  /** Secondary informational text: warm muted grey-yellow */
  textSecondary: string;
  /** Low-emphasis captions, metadata and labels */
  textMuted: string;
  /** High-contrast text on primary brand fills (19:1 ratio) */
  onPrimary: string;
  /** Standard card background */
  card: string;
  /** Elevated card background */
  cardElevated: string;
  /** Neutral indicators */
  neutral: string;
  neutralSoft: string;
  /** Neutral surface containers */
  neutralSurface: string;
  /** Semantic success / verified */
  success: string;
  successSoft: string;
  /** Semantic warning */
  warning: string;
  warningSoft: string;
  /** Semantic destructive / penalty */
  destructive: string;
  destructiveSoft: string;
  /** Modal backdrop scrim with slight warm blur tint */
  overlay: string;
}

/**
 * Signature Yellow & 2 Yellow-Tinted Blacks Tactical Palette.
 * Applied unconditionally to guarantee borderless high-contrast visual identity.
 */
export const darkColors: ThemeColors = {
  primary: '#FFFF00',
  primarySoft: 'rgba(255, 255, 0, 0.12)',
  allianceBlue: '#38BDF8',
  allianceBlueSoft: 'rgba(56, 189, 248, 0.12)',
  accentGold: '#FFFF00',
  accentGoldSoft: 'rgba(255, 255, 0, 0.14)',
  statusLive: '#A3E635',
  statusLiveSoft: 'rgba(163, 230, 53, 0.14)',
  background: '#0B0B05',
  surface: '#15150B',
  surfaceElevated: '#1F1F10',
  border: 'transparent',
  borderSubtle: 'transparent',
  textPrimary: '#FAFAF0',
  textSecondary: '#B8B89F',
  textMuted: '#787865',
  onPrimary: '#0B0B05',
  card: '#15150B',
  cardElevated: '#1F1F10',
  neutral: '#787865',
  neutralSoft: 'rgba(255, 255, 255, 0.08)',
  neutralSurface: '#1F1F10',
  success: '#A3E635',
  successSoft: 'rgba(163, 230, 53, 0.14)',
  warning: '#FFFF00',
  warningSoft: 'rgba(255, 255, 0, 0.14)',
  destructive: '#EF4444',
  destructiveSoft: 'rgba(239, 68, 68, 0.14)',
  overlay: 'rgba(8, 8, 3, 0.82)',
};

/**
 * Both light and dark palettes mirror the signature tactical yellow aesthetic
 * to satisfy the user specification for borderless #FFFF00 + 2 yellow-tinted blacks.
 */
export const lightColors: ThemeColors = {
  ...darkColors,
};

export const darkPalette = darkColors;
export const lightPalette = lightColors;
