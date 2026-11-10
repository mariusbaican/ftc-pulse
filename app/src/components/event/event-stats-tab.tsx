import React, { useEffect } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '@/theme';
import { AppIcon, AppIconName } from '@/components/ui/icon';
import { StatusBadge } from '@/components/ui/status-badge';
import type { EventMetadata, EventStats, MatchItem } from '@/types/api';

export interface EventStatsTabProps {
  event: EventMetadata;
  stats: EventStats;
  matches: MatchItem[];
  onSelectMatchForVod?: (match: MatchItem) => void;
  style?: StyleProp<ViewStyle>;
}

interface PeriodBreakdownConfig {
  id: 'auto' | 'teleop' | 'endgame';
  title: string;
  subtitle: string;
  icon: AppIconName;
  accentColor: string;
  softColor: string;
  oprValue: number;
  avgValue: number;
}

function formatMatchLabel(match: MatchItem): string {
  if (match.description) {
    if (/^qualification\s*/i.test(match.description)) {
      return match.description.replace(/^qualification\s*/i, 'QM-');
    }
    if (/^semifinal\s*/i.test(match.description)) {
      return match.description.replace(/^semifinal\s*/i, 'SF-');
    }
    if (/^final\s*/i.test(match.description)) {
      return match.description.replace(/^final\s*/i, 'F-');
    }
    return match.description;
  }
  if (match.matchNumber) {
    return `QM-${match.matchNumber}`;
  }
  return 'Match';
}

/**
 * Modular Event Statistics & Performance Telemetry Tab.
 *
 * Implements:
 * 1. 4-Tile Tournament KPI Grid (2x2 with tabular-nums):
 *    - Tournament Rank (#rank of totalTeams, gold trophy highlight if <= 4)
 *    - Event Record (W-L-T with success win rate badge)
 *    - Total Event OPR (Ridge OLS Offensive Rating in primary color)
 *    - Event High Score (Peak match score & match description)
 * 2. 2025 DECODE Period Breakdown Card:
 *    - Autonomous, Driver-Controlled TeleOp, and Endgame telemetry
 *    - Dual proportional horizontal progress bars (Individual OPR vs Alliance Match Avg)
 *    - Summary footer comparing totals and showing BrickBot offensive share %
 * 3. Match Score Progression & Performance Trajectory Card:
 *    - Chronological list of completed matches
 *    - Horizontal score bars colored by result (Emerald WIN, Red LOSS, Gold TIE)
 *    - Match labels, alliance color pills, final scores (e.g. 248 - 195)
 *    - Accessible 44pt VOD button triggering onSelectMatchForVod
 */
export function EventStatsTab({
  event,
  stats,
  matches,
  onSelectMatchForVod,
  style,
}: EventStatsTabProps) {
  const { colors, typography, spacing, radius, shadows } = useAppTheme();
  const reducedMotion = useReducedMotion();

  // Shared animated value for telemetry progress bars
  const progressAnimation = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (!reducedMotion) {
      progressAnimation.value = withTiming(1, {
        duration: 750,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      progressAnimation.value = 1;
    }
  }, [reducedMotion, progressAnimation]);

  // Normalize win rate percentage (handles both 0..1 and 0..100)
  const rawWinRate = stats?.winRate ?? 0;
  const normalizedWinRate =
    rawWinRate > 0 && rawWinRate <= 1 ? rawWinRate * 100 : rawWinRate;

  // Total scaling reference for period dual bars
  const maxScale = Math.max(
    stats?.averages?.totalAvg ?? 0,
    stats?.opr?.totalOpr ?? 0,
    100
  );

  // BrickBot offensive share percentage
  const totalOpr = stats?.opr?.totalOpr ?? 0;
  const totalAvg = stats?.averages?.totalAvg ?? 0;
  const offensiveSharePct = Math.min(
    100,
    Math.round((totalOpr / Math.max(1, totalAvg)) * 100)
  );

  // Period configs for DECODE breakdown
  const periods: PeriodBreakdownConfig[] = [
    {
      id: 'auto',
      title: 'Autonomous Period',
      subtitle: '30s Pre-Programmed & Vision Scoring',
      icon: 'bolt',
      accentColor: colors.allianceBlue,
      softColor: colors.allianceBlueSoft,
      oprValue: stats?.opr?.autoOpr ?? 0,
      avgValue: stats?.averages?.autoAvg ?? 0,
    },
    {
      id: 'teleop',
      title: 'Driver-Controlled TeleOp',
      subtitle: '2m Driver Telemetry & Cycle Scoring',
      icon: 'radio',
      accentColor: colors.accentGold,
      softColor: colors.accentGoldSoft,
      oprValue: stats?.opr?.teleopOpr ?? 0,
      avgValue: stats?.averages?.teleopAvg ?? 0,
    },
    {
      id: 'endgame',
      title: 'Endgame',
      subtitle: '30s Ascent / Parking & High-Value Objectives',
      icon: 'trophy',
      accentColor: colors.primary,
      softColor: colors.primarySoft,
      oprValue: stats?.opr?.endgameOpr ?? 0,
      avgValue: stats?.averages?.endgameAvg ?? 0,
    },
  ];

  // Filter completed matches and sort chronologically by match number
  const completedMatches = (matches || [])
    .filter(
      (m) =>
        m.status === 'COMPLETED' ||
        m.result === 'WIN' ||
        m.result === 'LOSS' ||
        m.result === 'TIE'
    )
    .sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));

  // Max score across completed matches for progression bar scaling
  const maxMatchScore = Math.max(
    ...completedMatches.map((m) =>
      Math.max(m.scoreRedFinal ?? 0, m.scoreBlueFinal ?? 0)
    ),
    150
  );

  const isTopRank = stats?.rank != null && stats.rank <= 4;

  return (
    <View style={[styles.container, { gap: spacing.lg }, style]}>
      {/* ─────────────────────────────────────────────────────────────
          SECTION 1: 4-Tile Tournament KPI Grid (2x2 with tabular-nums)
         ───────────────────────────────────────────────────────────── */}
      <View style={styles.sectionBlock}>
        <Text
          style={[
            typography.headline,
            { color: colors.textPrimary, marginBottom: spacing.sm },
          ]}
        >
          Tournament Performance
        </Text>

        <View style={[styles.kpiGrid, { gap: spacing.sm }]}>
          {/* Row 1: Rank & Record */}
          <View style={[styles.kpiRow, { gap: spacing.sm }]}>
            {/* Tile 1: Tournament Rank */}
            <Animated.View
              entering={reducedMotion ? undefined : FadeInDown.duration(260).delay(50)}
              style={[
                styles.kpiTile,
                shadows.sm,
                {
                  backgroundColor: colors.card,
                  borderColor: isTopRank ? colors.accentGold : colors.border,
                  borderWidth: isTopRank ? 1.5 : 1,
                  borderRadius: radius.md,
                  padding: spacing.base,
                },
              ]}
              accessible
              accessibilityRole="summary"
              accessibilityLabel={`Tournament Rank: ${stats?.rank ? `#${stats.rank}` : 'Unranked'} of ${stats?.totalTeams ?? 0} Teams`}
            >
              <View style={styles.tileHeaderRow}>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  TOURNAMENT RANK
                </Text>
                {isTopRank ? (
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: colors.accentGoldSoft },
                    ]}
                  >
                    <AppIcon name="trophy" size={14} color={colors.accentGold} />
                  </View>
                ) : (
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: colors.neutralSoft },
                    ]}
                  >
                    <AppIcon name="chart" size={14} color={colors.textSecondary} />
                  </View>
                )}
              </View>

              <Text
                style={[
                  styles.tabularNumberHeading,
                  {
                    color: isTopRank ? colors.accentGold : colors.textPrimary,
                    marginTop: spacing.xs,
                  },
                ]}
              >
                {stats?.rank ? `#${stats.rank}` : 'Unranked'}
              </Text>

              <Text
                style={[
                  typography.caption,
                  { color: colors.textMuted, marginTop: 2 },
                ]}
              >
                of {stats?.totalTeams ?? 0} Teams
              </Text>
            </Animated.View>

            {/* Tile 2: Event Record */}
            <Animated.View
              entering={reducedMotion ? undefined : FadeInDown.duration(260).delay(100)}
              style={[
                styles.kpiTile,
                shadows.sm,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: spacing.base,
                },
              ]}
              accessible
              accessibilityRole="summary"
              accessibilityLabel={`Event Record: ${stats?.wins ?? 0} wins, ${stats?.losses ?? 0} losses, ${stats?.ties ?? 0} ties, ${normalizedWinRate.toFixed(1)}% win rate`}
            >
              <View style={styles.tileHeaderRow}>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  EVENT RECORD
                </Text>
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: colors.successSoft },
                  ]}
                >
                  <AppIcon name="check-circle" size={14} color={colors.success} />
                </View>
              </View>

              <Text
                style={[
                  styles.tabularNumberHeading,
                  { color: colors.textPrimary, marginTop: spacing.xs },
                ]}
              >
                {stats?.wins ?? 0}-{stats?.losses ?? 0}-{stats?.ties ?? 0}
              </Text>

              <View style={{ marginTop: spacing.xs, alignSelf: 'flex-start' }}>
                <StatusBadge
                  variant="success"
                  label={`${normalizedWinRate.toFixed(1)}% WIN RATE`}
                  size="sm"
                />
              </View>
            </Animated.View>
          </View>

          {/* Row 2: Total OPR & High Score */}
          <View style={[styles.kpiRow, { gap: spacing.sm }]}>
            {/* Tile 3: Total Event OPR */}
            <Animated.View
              entering={reducedMotion ? undefined : FadeInDown.duration(260).delay(150)}
              style={[
                styles.kpiTile,
                shadows.sm,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: spacing.base,
                },
              ]}
              accessible
              accessibilityRole="summary"
              accessibilityLabel={`Total Event OPR: ${stats?.opr?.totalOpr?.toFixed(2) ?? '0.00'}, Ridge OLS Offensive Rating`}
            >
              <View style={styles.tileHeaderRow}>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  TOTAL EVENT OPR
                </Text>
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: colors.primarySoft },
                  ]}
                >
                  <AppIcon name="bolt" size={14} color={colors.primary} />
                </View>
              </View>

              <Text
                style={[
                  styles.tabularNumberHeading,
                  { color: colors.primary, marginTop: spacing.xs },
                ]}
              >
                {stats?.opr?.totalOpr != null
                  ? stats.opr.totalOpr.toFixed(2)
                  : '0.00'}
              </Text>

              <Text
                style={[
                  typography.caption,
                  { color: colors.textMuted, marginTop: 2 },
                ]}
                numberOfLines={1}
              >
                Ridge OLS Offensive Rating
              </Text>
            </Animated.View>

            {/* Tile 4: Event High Score */}
            <Animated.View
              entering={reducedMotion ? undefined : FadeInDown.duration(260).delay(200)}
              style={[
                styles.kpiTile,
                shadows.sm,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: spacing.base,
                },
              ]}
              accessible
              accessibilityRole="summary"
              accessibilityLabel={`Event High Score: ${stats?.highScore ?? 0} points, ${stats?.highScoreMatch || 'Peak Alliance Score'}`}
            >
              <View style={styles.tileHeaderRow}>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  EVENT HIGH SCORE
                </Text>
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: colors.accentGoldSoft },
                  ]}
                >
                  <AppIcon name="arrow-up-right" size={14} color={colors.accentGold} />
                </View>
              </View>

              <Text
                style={[
                  styles.tabularNumberHeading,
                  { color: colors.textPrimary, marginTop: spacing.xs },
                ]}
              >
                {stats?.highScore ? `${stats.highScore} PTS` : '—'}
              </Text>

              <Text
                style={[
                  typography.caption,
                  { color: colors.textMuted, marginTop: 2 },
                ]}
                numberOfLines={1}
              >
                {stats?.highScoreMatch || 'Peak Alliance Score'}
              </Text>
            </Animated.View>
          </View>
        </View>
      </View>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: 2025 DECODE Period Breakdown Card
          (Individual OPR vs. Alliance Match Average)
         ───────────────────────────────────────────────────────────── */}
      <Animated.View
        entering={reducedMotion ? undefined : FadeInDown.duration(280).delay(250)}
        style={[
          styles.cardContainer,
          shadows.md,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: radius.lg,
            padding: spacing.base,
          },
        ]}
        accessible
        accessibilityRole="summary"
        accessibilityLabel="2025 DECODE Period Breakdown Card"
      >
        {/* Card Header & Legend */}
        <View style={styles.periodCardHeader}>
          <View style={styles.periodTitleRow}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: colors.primarySoft, width: 32, height: 32 },
              ]}
            >
              <AppIcon name="chart" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[typography.headline, { color: colors.textPrimary }]}>
                2025 DECODE Period Breakdown
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                Individual OPR vs. Alliance Match Average
              </Text>
            </View>
          </View>

          {/* Visual Legend */}
          <View style={[styles.legendRow, { marginTop: spacing.md }]}>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendSolidIndicator,
                  { backgroundColor: colors.primary },
                ]}
              />
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                BrickBot OPR
              </Text>
            </View>

            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendOutlineIndicator,
                  {
                    backgroundColor: colors.neutralSoft,
                    borderColor: colors.neutral,
                  },
                ]}
              />
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Alliance Average
              </Text>
            </View>
          </View>
        </View>

        {/* 3 Game Periods Breakdown */}
        <View style={[styles.periodsList, { gap: spacing.base, marginTop: spacing.md }]}>
          {periods.map((period) => {
            const oprWidthPercent = Math.min(
              100,
              Math.max(4, (period.oprValue / maxScale) * 100)
            );
            const avgWidthPercent = Math.min(
              100,
              Math.max(4, (period.avgValue / maxScale) * 100)
            );

            return (
              <PeriodRow
                key={period.id}
                period={period}
                oprWidthPercent={oprWidthPercent}
                avgWidthPercent={avgWidthPercent}
                progressAnimation={progressAnimation}
                reducedMotion={reducedMotion}
              />
            );
          })}
        </View>

        {/* Summary Comparison Footer */}
        <View
          style={[
            styles.summaryFooter,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.borderSubtle,
              borderRadius: radius.md,
              padding: spacing.md,
              marginTop: spacing.lg,
            },
          ]}
        >
          <View style={styles.summaryTotalsRow}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                TOTAL INDIVIDUAL OPR
              </Text>
              <Text
                style={[
                  styles.tabularMonoMedium,
                  { color: colors.primary, marginTop: 2 },
                ]}
              >
                {totalOpr.toFixed(1)} pts
              </Text>
            </View>

            <View style={[styles.verticalDivider, { backgroundColor: colors.borderSubtle }]} />

            <View style={{ flex: 1, paddingLeft: spacing.md }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                ALLIANCE MATCH AVG
              </Text>
              <Text
                style={[
                  styles.tabularMonoMedium,
                  { color: colors.textPrimary, marginTop: 2 },
                ]}
              >
                {totalAvg.toFixed(1)} pts
              </Text>
            </View>
          </View>

          {/* Offensive Contribution Badge & Explanation */}
          <View style={[styles.shareRow, { marginTop: spacing.sm }]}>
            <StatusBadge
              variant={offensiveSharePct >= 50 ? 'success' : 'gold'}
              label={`${offensiveSharePct}% ALLIANCE OUTPUT`}
              size="sm"
            />
            <Text
              style={[
                typography.caption,
                { color: colors.textSecondary, flex: 1, marginLeft: spacing.sm },
              ]}
              numberOfLines={2}
            >
              BrickBot accounts for {offensiveSharePct}% of total alliance match scoring.
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3: Match Score Progression & Performance Trajectory Card
         ───────────────────────────────────────────────────────────── */}
      <Animated.View
        entering={reducedMotion ? undefined : FadeInDown.duration(280).delay(350)}
        style={[
          styles.cardContainer,
          shadows.md,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: radius.lg,
            padding: spacing.base,
          },
        ]}
        accessible
        accessibilityRole="summary"
        accessibilityLabel="Match Score Progression and Performance Trajectory Card"
      >
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={[typography.headline, { color: colors.textPrimary }]}>
              Match Score Progression
            </Text>
            <Text
              style={[
                typography.caption,
                { color: colors.textSecondary, marginTop: 2 },
              ]}
            >
              Performance trajectory across {completedMatches.length} completed matches
            </Text>
          </View>
          <StatusBadge
            variant="neutral"
            label={`${completedMatches.length} RECORDED`}
            size="sm"
          />
        </View>

        {completedMatches.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: colors.surfaceElevated,
                borderRadius: radius.md,
                padding: spacing.lg,
                marginTop: spacing.md,
              },
            ]}
          >
            <AppIcon name="clock" size={24} color={colors.textMuted} />
            <Text
              style={[
                typography.subhead,
                { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
              ]}
            >
              No completed matches on record yet for this tournament.
            </Text>
          </View>
        ) : (
          <View style={[styles.matchesList, { gap: spacing.md, marginTop: spacing.md }]}>
            {completedMatches.map((match, index) => {
              const isTargetRed =
                match.targetTeamAlliance === 'Red' ||
                match.targetTeamAlliance == null;
              const ourScore = isTargetRed
                ? match.scoreRedFinal ?? 0
                : match.scoreBlueFinal ?? 0;
              const oppScore = isTargetRed
                ? match.scoreBlueFinal ?? 0
                : match.scoreRedFinal ?? 0;

              // Color based on Match Result: Emerald for WIN, Red for LOSS, Gold for TIE
              const resultColor =
                match.result === 'WIN'
                  ? colors.success
                  : match.result === 'LOSS'
                  ? colors.destructive
                  : colors.accentGold;

              const resultBadgeVariant =
                match.result === 'WIN'
                  ? 'success'
                  : match.result === 'LOSS'
                  ? 'red'
                  : 'gold';

              const scoreBarWidthPercent = Math.min(
                100,
                Math.max(12, (ourScore / maxMatchScore) * 100)
              );

              return (
                <View
                  key={match.matchId || `match-${match.matchNumber}-${index}`}
                  style={[
                    styles.matchRowContainer,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.borderSubtle,
                      borderRadius: radius.md,
                      padding: spacing.md,
                    },
                  ]}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={`${formatMatchLabel(match)}, Result ${match.result}, Score ${ourScore} to ${oppScore}`}
                >
                  {/* Top Match Metadata & VOD Button */}
                  <View style={styles.matchTopRow}>
                    <View style={styles.matchInfoGroup}>
                      {/* Match Identifier */}
                      <Text
                        style={[
                          styles.tabularMonoBold,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {formatMatchLabel(match)}
                      </Text>

                      {/* Alliance Color Pill */}
                      <View
                        style={[
                          styles.allianceColorPill,
                          {
                            backgroundColor:
                              match.targetTeamAlliance === 'Blue'
                                ? colors.allianceBlueSoft
                                : colors.primarySoft,
                            borderColor:
                              match.targetTeamAlliance === 'Blue'
                                ? colors.allianceBlue
                                : colors.primary,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.allianceDot,
                            {
                              backgroundColor:
                                match.targetTeamAlliance === 'Blue'
                                ? colors.allianceBlue
                                : colors.primary,
                            },
                          ]}
                        />
                        <Text
                          style={[
                            typography.caption,
                            {
                              color:
                                match.targetTeamAlliance === 'Blue'
                                  ? colors.allianceBlue
                                  : colors.primary,
                              fontWeight: '700',
                            },
                          ]}
                        >
                          {match.targetTeamAlliance?.toUpperCase() || 'RED'}
                        </Text>
                      </View>

                      {/* Result Pill Badge */}
                      <StatusBadge
                        variant={resultBadgeVariant}
                        label={match.result}
                        size="sm"
                      />
                    </View>

                    {/* VOD Action Button (Strict Touch Target: minHeight 44) */}
                    <Pressable
                      onPress={() => onSelectMatchForVod?.(match)}
                      style={({ pressed }) => [
                        styles.vodButton,
                        {
                          backgroundColor: match.vodUrl
                            ? colors.primarySoft
                            : colors.neutralSoft,
                          borderColor: match.vodUrl
                            ? colors.primary
                            : colors.border,
                          borderRadius: radius.sm,
                          opacity: pressed ? 0.75 : 1,
                        },
                      ]}
                      hitSlop={8}
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={`Watch match VOD stream for ${formatMatchLabel(match)}`}
                      accessibilityHint="Navigates to the video broadcast player"
                    >
                      <AppIcon
                        name="video"
                        size={16}
                        color={match.vodUrl ? colors.primary : colors.textSecondary}
                      />
                      <Text
                        style={[
                          typography.subhead,
                          {
                            color: match.vodUrl ? colors.primary : colors.textSecondary,
                            fontWeight: '700',
                            marginLeft: spacing.xs,
                          },
                        ]}
                      >
                        VOD
                      </Text>
                    </Pressable>
                  </View>

                  {/* Score Display & Bar Progression */}
                  <View style={[styles.scoreProgressionBlock, { marginTop: spacing.sm }]}>
                    <View style={styles.scoreRow}>
                      <Text
                        style={[
                          styles.scoreDisplayLarge,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {ourScore}
                        <Text style={{ color: colors.textMuted }}> – </Text>
                        <Text style={{ color: colors.textSecondary }}>{oppScore}</Text>
                      </Text>

                      <Text
                        style={[
                          typography.caption,
                          { color: colors.textMuted },
                        ]}
                      >
                        {match.field ? `Field ${match.field}` : 'Tournament Match'}
                      </Text>
                    </View>

                    {/* Horizontal Score Progression Bar */}
                    <View
                      style={[
                        styles.scoreBarTrack,
                        {
                          backgroundColor: colors.borderSubtle,
                          borderRadius: radius.full,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.scoreBarFill,
                          {
                            width: `${scoreBarWidthPercent}%`,
                            backgroundColor: resultColor,
                            borderRadius: radius.full,
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

/**
 * Period Row Component rendering dual proportional horizontal progress bars:
 * - One solid bar in period accent color for BrickBot's Individual OPR
 * - One soft/outlined bar for Alliance Match Average
 */
function PeriodRow({
  period,
  oprWidthPercent,
  avgWidthPercent,
  progressAnimation,
  reducedMotion,
}: {
  period: PeriodBreakdownConfig;
  oprWidthPercent: number;
  avgWidthPercent: number;
  progressAnimation: SharedValue<number>;
  reducedMotion: boolean | null;
}) {
  const { colors, typography, spacing, radius } = useAppTheme();

  const animatedOprStyle = useAnimatedStyle(() => {
    return {
      width: `${Math.min(100, Math.max(0, oprWidthPercent * progressAnimation.value))}%`,
    };
  });

  const animatedAvgStyle = useAnimatedStyle(() => {
    return {
      width: `${Math.min(100, Math.max(0, avgWidthPercent * progressAnimation.value))}%`,
    };
  });

  return (
    <View
      style={[
        styles.periodItemContainer,
        {
          borderColor: colors.borderSubtle,
          borderRadius: radius.md,
          backgroundColor: colors.surfaceElevated,
          padding: spacing.md,
        },
      ]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${period.title}: BrickBot OPR ${period.oprValue.toFixed(1)} points, Alliance Average ${period.avgValue.toFixed(1)} points`}
    >
      {/* Title & Numeric Values Row */}
      <View style={styles.periodRowHeader}>
        <View style={styles.periodLeftHeader}>
          <View
            style={[
              styles.iconCircleSm,
              { backgroundColor: period.softColor },
            ]}
          >
            <AppIcon name={period.icon} size={14} color={period.accentColor} />
          </View>
          <View style={{ marginLeft: spacing.xs }}>
            <Text style={[typography.subhead, { color: colors.textPrimary, fontWeight: '700' }]}>
              {period.title}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {period.subtitle}
            </Text>
          </View>
        </View>

        {/* Numeric Telemetry Readouts */}
        <View style={styles.periodTelemetryValues}>
          <View style={styles.telemetryStat}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              OPR
            </Text>
            <Text
              style={[
                styles.tabularMonoMedium,
                { color: period.accentColor },
              ]}
            >
              {period.oprValue.toFixed(1)}
            </Text>
          </View>

          <View style={[styles.inlineDivider, { backgroundColor: colors.borderSubtle }]} />

          <View style={styles.telemetryStat}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              AVG
            </Text>
            <Text
              style={[
                styles.tabularMonoMedium,
                { color: colors.textPrimary },
              ]}
            >
              {period.avgValue.toFixed(1)}
            </Text>
          </View>
        </View>
      </View>

      {/* Dual Proportional Progress Bars */}
      <View style={[styles.dualBarContainer, { marginTop: spacing.md, gap: spacing.xs }]}>
        {/* Solid Bar: BrickBot Individual OPR */}
        <View style={styles.barLine}>
          <Text style={[styles.barMicroLabel, { color: period.accentColor }]}>
            BrickBot OPR
          </Text>
          <View
            style={[
              styles.barTrack,
              {
                backgroundColor: colors.background,
                borderRadius: radius.full,
              },
            ]}
          >
            <Animated.View
              style={[
                styles.barFill,
                {
                  backgroundColor: period.accentColor,
                  borderRadius: radius.full,
                },
                reducedMotion ? { width: `${oprWidthPercent}%` } : animatedOprStyle,
              ]}
            />
          </View>
        </View>

        {/* Soft / Outlined Bar: Alliance Match Average */}
        <View style={styles.barLine}>
          <Text style={[styles.barMicroLabel, { color: colors.textMuted }]}>
            Alliance Avg
          </Text>
          <View
            style={[
              styles.barTrack,
              {
                backgroundColor: colors.background,
                borderRadius: radius.full,
              },
            ]}
          >
            <Animated.View
              style={[
                styles.barFill,
                {
                  backgroundColor: period.softColor,
                  borderColor: period.accentColor,
                  borderWidth: 1,
                  borderRadius: radius.full,
                },
                reducedMotion ? { width: `${avgWidthPercent}%` } : animatedAvgStyle,
              ]}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  sectionBlock: {
    width: '100%',
  },
  kpiGrid: {
    width: '100%',
  },
  kpiRow: {
    flexDirection: 'row',
    width: '100%',
  },
  kpiTile: {
    flex: 1,
  },
  tileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabularNumberHeading: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  cardContainer: {
    borderWidth: 1,
    width: '100%',
  },
  periodCardHeader: {
    width: '100%',
  },
  periodTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSolidIndicator: {
    width: 12,
    height: 8,
    borderRadius: 2,
  },
  legendOutlineIndicator: {
    width: 12,
    height: 8,
    borderRadius: 2,
    borderWidth: 1,
  },
  periodsList: {
    width: '100%',
  },
  periodItemContainer: {
    borderWidth: 1,
    width: '100%',
  },
  periodRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  periodLeftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  periodTelemetryValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  telemetryStat: {
    alignItems: 'flex-end',
  },
  inlineDivider: {
    width: 1,
    height: 22,
  },
  dualBarContainer: {
    width: '100%',
  },
  barLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barMicroLabel: {
    fontSize: 10,
    fontWeight: '600',
    width: 72,
    textAlign: 'right',
  },
  barTrack: {
    flex: 1,
    height: 8,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
  },
  summaryFooter: {
    borderWidth: 1,
    width: '100%',
  },
  summaryTotalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verticalDivider: {
    width: 1,
    height: 36,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchesList: {
    width: '100%',
  },
  matchRowContainer: {
    borderWidth: 1,
    width: '100%',
  },
  matchTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  matchInfoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
  },
  allianceColorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
  allianceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  vodButton: {
    minHeight: 44,
    minWidth: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  scoreProgressionBlock: {
    width: '100%',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  scoreDisplayLarge: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.4,
  },
  scoreBarTrack: {
    width: '100%',
    height: 6,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleSm: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabularMonoBold: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  tabularMonoMedium: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
