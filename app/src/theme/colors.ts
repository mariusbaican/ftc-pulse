/**
 * High-contrast FTC Robotics & Sports Telemetry Color Palette.
 * Compliant with WCAG 2.1 AA text contrast requirements and ui-ux-pro-max guidelines.
 */

export interface ThemeColors {
  /** BrickBot & Red Alliance primary brand color */
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
  /** Base canvas background */
  background: string;
  /** Primary surface (cards, sheets) */
  surface: string;
  /** Elevated surface (interactive containers, badges, inputs) */
  surfaceElevated: string;
  /** Structural borders */
  border: string;
  /** Subtle dividers and secondary borders */
  borderSubtle: string;
  /** High-contrast primary reading text */
  textPrimary: string;
  /** Secondary informational text */
  textSecondary: string;
  /** Low-emphasis captions, metadata and labels */
  textMuted: string;
  /** High-contrast text on primary brand fills */
  onPrimary: string;
  /** Standard card background */
  card: string;
  /** Elevated card background */
  cardElevated: string;
  /** Neutral indicators */
  neutral: string;
  neutralSoft: string;
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
  /** Modal backdrop scrim */
  overlay: string;
}

export const lightColors: ThemeColors = {
  primary: '#DC2626',
  primarySoft: 'rgba(220, 38, 38, 0.12)',
  allianceBlue: '#2563EB',
  allianceBlueSoft: 'rgba(37, 99, 235, 0.12)',
  accentGold: '#D97706',
  accentGoldSoft: 'rgba(217, 119, 6, 0.12)',
  statusLive: '#16A34A',
  statusLiveSoft: 'rgba(22, 163, 74, 0.12)',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#F1F5F9',
  border: '#E2E8F0',
  borderSubtle: 'rgba(226, 232, 240, 0.7)',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  onPrimary: '#FFFFFF',
  card: '#FFFFFF',
  cardElevated: '#F1F5F9',
  neutral: '#64748B',
  neutralSoft: 'rgba(100, 116, 139, 0.12)',
  neutralSurface: '#E2E8F0',
  success: '#16A34A',
  successSoft: 'rgba(22, 163, 74, 0.12)',
  warning: '#D97706',
  warningSoft: 'rgba(217, 119, 6, 0.12)',
  destructive: '#DC2626',
  destructiveSoft: 'rgba(220, 38, 38, 0.12)',
  overlay: 'rgba(15, 23, 42, 0.4)',
};

export const darkColors: ThemeColors = {
  primary: '#EF4444',
  primarySoft: 'rgba(239, 68, 68, 0.18)',
  allianceBlue: '#3B82F6',
  allianceBlueSoft: 'rgba(59, 130, 246, 0.18)',
  accentGold: '#FBBF24',
  accentGoldSoft: 'rgba(251, 191, 36, 0.18)',
  statusLive: '#22C55E',
  statusLiveSoft: 'rgba(34, 197, 94, 0.18)',
  background: '#090D16',
  surface: '#111827',
  surfaceElevated: '#1E293B',
  border: '#334155',
  borderSubtle: 'rgba(51, 65, 85, 0.7)',
  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  onPrimary: '#FFFFFF',
  card: '#111827',
  cardElevated: '#1E293B',
  neutral: '#94A3B8',
  neutralSoft: 'rgba(148, 163, 184, 0.18)',
  neutralSurface: '#1E293B',
  success: '#22C55E',
  successSoft: 'rgba(34, 197, 94, 0.18)',
  warning: '#FBBF24',
  warningSoft: 'rgba(251, 191, 36, 0.18)',
  destructive: '#EF4444',
  destructiveSoft: 'rgba(239, 68, 68, 0.18)',
  overlay: 'rgba(0, 0, 0, 0.7)',
};
