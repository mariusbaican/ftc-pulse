import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '@/theme';
import type { BestMatchPerformance, SeasonSummaryResponse } from '@/types/api';
import { AppIcon } from '@/components/ui/icon';
import { StatusBadge } from '@/components/ui/status-badge';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface SeasonAnalyticsCardsProps {
  summary: SeasonSummaryResponse;
  onSelectEvent?: (eventCode: string) => void;
  onSelectBestMatch?: (bestMatch: BestMatchPerformance) => void;
  style?: StyleProp<ViewStyle>;
}

function formatOrdinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${n}th`;
  }
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/**
 * Animated High-Emphasis Season Analytics & Statistical Highlight Cards.
 * Implements:
 * 1. Global Season OPR & Period Breakdown Hero Card with World Rank pills
 * 2. Full-width Season W-L-T Record Card with clean compact layout
 * 3. Full-width Season High Score (NP) Card with interactive event touch routing
 *
 * Adheres strictly to ui-ux-pro-max guidelines, expo-animation, expo-native-ui, and WCAG 2.1 AA accessibility.
 */
export function SeasonAnalyticsCards({
  summary,
  onSelectEvent,
  onSelectBestMatch,
  style,
}: SeasonAnalyticsCardsProps) {
  const { colors, typography, spacing, radius, shadows } = useAppTheme();
  const reducedMotion = useReducedMotion();

  const bestMatchScale = useSharedValue(1);

  // Normalize win rate percentage (handles both 0..1 and 0..100)
  const rawWinRate = summary.record?.winRate ?? 0;
  const winRatePct = rawWinRate > 0 && rawWinRate <= 1 ? rawWinRate * 100 : rawWinRate;

  // World ranks with '1st' fallback
  const isBelowFifty = winRatePct < 50;
  const totalWorldRank = summary.worldRanks?.total
    ? formatOrdinal(summary.worldRanks.total)
    : '1st';
  const autoWorldRank = summary.worldRanks?.auto
    ? formatOrdinal(summary.worldRanks.auto)
    : '1st';
  const teleopWorldRank = summary.worldRanks?.teleop
    ? formatOrdinal(summary.worldRanks.teleop)
    : '1st';
  const endgameWorldRank = summary.worldRanks?.endgame
    ? formatOrdinal(summary.worldRanks.endgame)
    : '1st';

  const bestScore = summary.bestMatch
    ? (summary.bestMatch.nonFoulScore ?? summary.bestMatch.score ?? 0)
    : 0;

  const animatedBestMatchPressStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: bestMatchScale.value }],
    };
  });

  const handleBestMatchPressIn = () => {
    if (summary.bestMatch && (onSelectBestMatch || onSelectEvent)) {
      bestMatchScale.value = withTiming(0.98, { duration: 100 });
    }
  };

  const handleBestMatchPressOut = () => {
    bestMatchScale.value = withTiming(1, { duration: 100 });
  };

  const handleBestMatchPress = () => {
    if (summary.bestMatch) {
      if (onSelectBestMatch) {
        onSelectBestMatch(summary.bestMatch);
      } else if (onSelectEvent) {
        onSelectEvent(summary.bestMatch.eventCode);
      }
    }
  };

  const surfaceBg = colors.surface || '#15150B';
  const surfaceElevatedBg = colors.surfaceElevated || '#1F1F10';
  const yellowPrimary = colors.primary || '#FFFF00';

  return (
    <View style={[styles.rootContainer, { gap: spacing.md }, style]}>
      {/* ─────────────────────────────────────────────────────────────
          CARD 1: Global Season OPR & Period Breakdown Hero Card
         ───────────────────────────────────────────────────────────── */}
      <Animated.View
        entering={reducedMotion ? undefined : FadeInDown.duration(260)}
        style={[
          styles.statCard,
          shadows.md,
          {
            backgroundColor: surfaceBg,
            borderRadius: radius.md,
            padding: spacing.base,
          },
        ]}
        accessible
        accessibilityRole="summary"
        accessibilityLabel={`Season OPR NP: ${summary.globalOpr?.totalOpr?.toFixed(2) ?? '0.00'}, World Rank: ${totalWorldRank}`}
      >
        {/* Header Row: Bolt Icon + Label + World Rank Badge */}
        <View style={styles.cardHeaderBetween}>
          <View style={styles.headerTitleGroup}>
            <View
              style={[
                styles.iconBadge,
                {
                  backgroundColor: surfaceElevatedBg,
                  borderRadius: radius.sm,
                },
              ]}
            >
              <AppIcon name="bolt" size={16} color={yellowPrimary} />
            </View>
            <Text
              style={[
                typography.caption,
                styles.cardHeaderLabel,
                { color: colors.textSecondary },
              ]}
            >
              SEASON OPR (NP)
            </Text>
          </View>

          <StatusBadge
            variant="gold"
            label={`World Rank: ${totalWorldRank}`}
            size="sm"
          />
        </View>

        {/* Main Metric Value */}
        <View style={[styles.metricSection, { marginTop: spacing.xs }]}>
          <Text
            style={[
              typography.largeTitle,
              styles.oprValueText,
              { color: colors.textPrimary },
            ]}
          >
            {summary.globalOpr?.totalOpr?.toFixed(2) ?? '0.00'}
          </Text>
        </View>

        {/* 3-Column Period Telemetry Split */}
        <View
          style={[
            styles.telemetryColumnsRow,
            {
              marginTop: spacing.sm,
              paddingTop: spacing.xs,
            },
          ]}
        >
          {/* Autonomous Column */}
          <View
            style={styles.periodCol}
            accessible
            accessibilityLabel={`Auto OPR: ${summary.globalOpr?.autoOpr?.toFixed(1) ?? '0.0'}, World Rank ${autoWorldRank}`}
          >
            <Text
              style={[
                typography.caption,
                styles.periodNameText,
                { color: colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              Auto OPR
            </Text>
            <Text
              style={[
                typography.tabularNumber,
                styles.periodOprValue,
                { color: colors.textPrimary },
              ]}
              numberOfLines={1}
            >
              {summary.globalOpr?.autoOpr?.toFixed(1) ?? '0.0'}
            </Text>
            <Text
              style={[
                typography.caption,
                styles.periodRankValue,
                { color: colors.textMuted },
              ]}
              numberOfLines={1}
            >
              World Rank: {autoWorldRank}
            </Text>
          </View>

          {/* Subtle Vertical Divider */}
          <View
            style={[
              styles.columnDivider,
              { backgroundColor: surfaceElevatedBg },
            ]}
          />

          {/* Driver TeleOp Column */}
          <View
            style={styles.periodCol}
            accessible
            accessibilityLabel={`TeleOp OPR: ${summary.globalOpr?.teleopOpr?.toFixed(1) ?? '0.0'}, World Rank ${teleopWorldRank}`}
          >
            <Text
              style={[
                typography.caption,
                styles.periodNameText,
                { color: colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              TeleOp OPR
            </Text>
            <Text
              style={[
                typography.tabularNumber,
                styles.periodOprValue,
                { color: colors.textPrimary },
              ]}
              numberOfLines={1}
            >
              {summary.globalOpr?.teleopOpr?.toFixed(1) ?? '0.0'}
            </Text>
            <Text
              style={[
                typography.caption,
                styles.periodRankValue,
                { color: colors.textMuted },
              ]}
              numberOfLines={1}
            >
              World Rank: {teleopWorldRank}
            </Text>
          </View>

          {/* Subtle Vertical Divider */}
          <View
            style={[
              styles.columnDivider,
              { backgroundColor: surfaceElevatedBg },
            ]}
          />

          {/* Endgame Column */}
          <View
            style={styles.periodCol}
            accessible
            accessibilityLabel={`Endgame OPR: ${summary.globalOpr?.endgameOpr?.toFixed(1) ?? '0.0'}, World Rank ${endgameWorldRank}`}
          >
            <Text
              style={[
                typography.caption,
                styles.periodNameText,
                { color: colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              Endgame OPR
            </Text>
            <Text
              style={[
                typography.tabularNumber,
                styles.periodOprValue,
                { color: colors.textPrimary },
              ]}
              numberOfLines={1}
            >
              {summary.globalOpr?.endgameOpr?.toFixed(1) ?? '0.0'}
            </Text>
            <Text
              style={[
                typography.caption,
                styles.periodRankValue,
                { color: colors.textMuted },
              ]}
              numberOfLines={1}
            >
              World Rank: {endgameWorldRank}
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* ─────────────────────────────────────────────────────────────
          CARD 2: Season W-L-T Record Card (Full Width Vertical Stack)
         ───────────────────────────────────────────────────────────── */}
      <Animated.View
        entering={
          reducedMotion ? undefined : FadeInDown.delay(70).duration(260)
        }
        style={[
          styles.statCard,
          shadows.sm,
          {
            backgroundColor: surfaceBg,
            borderRadius: radius.md,
            padding: spacing.base,
          },
        ]}
        accessible
        accessibilityRole="summary"
        accessibilityLabel={`Season Record: ${summary.record?.wins ?? 0} wins, ${summary.record?.losses ?? 0} losses, ${summary.record?.ties ?? 0} ties, ${winRatePct.toFixed(1)} percent win rate, ${summary.record?.matchesPlayed ?? 0} matches played`}
      >
        <View style={styles.cardHeaderBetween}>
          <View style={styles.headerTitleGroup}>
            <View
              style={[
                styles.iconBadgeSmall,
                {
                  backgroundColor: surfaceElevatedBg,
                  borderRadius: radius.sm,
                },
              ]}
            >
              <AppIcon name="shield" size={14} color={yellowPrimary} />
            </View>
            <Text
              style={[
                typography.caption,
                styles.cardHeaderLabel,
                { color: colors.textSecondary },
              ]}
            >
              SEASON RECORD
            </Text>
          </View>

          <StatusBadge
            variant={isBelowFifty ? 'red' : 'live'}
            label={`${winRatePct.toFixed(1)}% Win Rate`}
            size="sm"
          />
        </View>

        <View style={[styles.recordContentRow, { marginTop: spacing.sm }]}>
          <Text
            style={[
              typography.largeTitle,
              styles.recordScoreText,
              { color: colors.textPrimary },
            ]}
          >
            {summary.record
              ? `${summary.record.wins}-${summary.record.losses}-${summary.record.ties}`
              : '0-0-0'}
          </Text>

          <Text
            style={[
              typography.subhead,
              styles.matchesPlayedText,
              { color: colors.textMuted },
            ]}
            numberOfLines={1}
          >
            {summary.record?.matchesPlayed ?? 0} Matches Played
          </Text>
        </View>
      </Animated.View>

      {/* ─────────────────────────────────────────────────────────────
          CARD 3: Season High Score (NP) Card (Full Width Vertical Stack)
         ───────────────────────────────────────────────────────────── */}
      <AnimatedPressable
        entering={
          reducedMotion ? undefined : FadeInDown.delay(140).duration(260)
        }
        onPress={handleBestMatchPress}
        onPressIn={handleBestMatchPressIn}
        onPressOut={handleBestMatchPressOut}
        disabled={!summary.bestMatch || (!onSelectBestMatch && !onSelectEvent)}
        accessible
        accessibilityRole="button"
        accessibilityLabel={
          summary.bestMatch
            ? `Season High Score NP: ${bestScore} points, ${summary.bestMatch.matchDescription} at ${summary.bestMatch.eventName}`
            : 'Season High Score NP: No official matches recorded'
        }
        accessibilityHint={
          summary.bestMatch && (onSelectBestMatch || onSelectEvent)
            ? onSelectBestMatch
              ? `Jumps to match ${summary.bestMatch.matchDescription} in ${summary.bestMatch.eventName}`
              : `Jumps to tournament event ${summary.bestMatch.eventName}`
            : undefined
        }
        style={[
          styles.statCard,
          shadows.sm,
          {
            backgroundColor: surfaceBg,
            borderRadius: radius.md,
            padding: spacing.base,
          },
          animatedBestMatchPressStyle,
        ]}
      >
        <View style={styles.cardHeaderBetween}>
          <View style={styles.headerTitleGroup}>
            <View
              style={[
                styles.iconBadgeSmall,
                {
                  backgroundColor: surfaceElevatedBg,
                  borderRadius: radius.sm,
                },
              ]}
            >
              <AppIcon name="trophy" size={14} color={yellowPrimary} />
            </View>
            <Text
              style={[
                typography.caption,
                styles.cardHeaderLabel,
                { color: colors.textSecondary },
              ]}
            >
              SEASON HIGH SCORE (NP)
            </Text>
          </View>

          {summary.bestMatch && (onSelectBestMatch || onSelectEvent) ? (
            <AppIcon
              name="arrow-up-right"
              size={14}
              color={yellowPrimary}
            />
          ) : null}
        </View>

        <View style={[styles.highScoreContentRow, { marginTop: spacing.sm }]}>
          <View style={styles.highScoreLeftCol}>
            <Text
              style={[
                typography.largeTitle,
                styles.recordScoreText,
                { color: colors.textPrimary },
              ]}
            >
              {bestScore}{' '}
              <Text
                style={[
                  typography.headline,
                  { color: colors.textPrimary, fontWeight: '700' },
                ]}
              >
                pts
              </Text>
            </Text>
          </View>

          <View style={styles.highScoreRightCol}>
            <View style={styles.matchMetaRow}>
              <Text
                style={[
                  typography.subhead,
                  styles.matchDescText,
                  { color: colors.textPrimary },
                ]}
                numberOfLines={1}
              >
                {summary.bestMatch?.matchDescription || 'Match'}
              </Text>
            </View>

            <View style={styles.tournamentLinkRow}>
              <Text
                style={[
                  typography.caption,
                  styles.tournamentNameText,
                  { color: colors.textMuted },
                ]}
                numberOfLines={1}
              >
                {summary.bestMatch?.eventName || 'Official Tournament'}
              </Text>
              {summary.bestMatch ? (
                <AppIcon name="arrow-up-right" size={11} color={colors.textMuted} />
              ) : null}
            </View>
          </View>
        </View>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    width: '100%',
  },
  statCard: {
    borderWidth: 0,
    borderCurve: 'continuous',
    width: '100%',
  },
  cardHeaderBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBadge: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  iconBadgeSmall: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  cardHeaderLabel: {
    fontWeight: '700',
    letterSpacing: 0.5,
    fontSize: 12,
    lineHeight: 16,
  },
  metricSection: {
    gap: 2,
  },
  oprValueText: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  telemetryColumnsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderTopWidth: 0,
  },
  periodCol: {
    flex: 1,
    gap: 2,
  },
  periodNameText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  periodOprValue: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  periodRankValue: {
    fontSize: 11,
    lineHeight: 14,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  columnDivider: {
    width: 1,
    height: '80%',
    marginHorizontal: 8,
    alignSelf: 'center',
  },
  recordContentRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  recordScoreText: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  matchesPlayedText: {
    fontSize: 13,
    fontWeight: '500',
  },
  highScoreContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  highScoreLeftCol: {
    justifyContent: 'center',
  },
  highScoreRightCol: {
    flex: 1,
    minWidth: 160,
    alignItems: 'flex-end',
    gap: 3,
  },
  matchMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  matchDescText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  tournamentLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tournamentNameText: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'right',
  },
});
