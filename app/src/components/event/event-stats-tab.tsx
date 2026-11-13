import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { useAppTheme } from '@/theme';
import { AppIcon } from '@/components/ui/icon';
import { StatusBadge } from '@/components/ui/status-badge';
import type { EventMetadata, EventStats, MatchItem } from '@/types/api';

export interface EventStatsTabProps {
  event: EventMetadata;
  stats: EventStats;
  matches?: MatchItem[];
  onSelectMatchForVod?: (match: MatchItem) => void;
  onSelectHighScoreMatch?: (highScoreMatchDesc?: string) => void;
  onNavigateToRankings?: () => void;
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
 * Modular Event Statistics & Performance Telemetry Tab.
 *
 * Implements:
 * 1. 3 Full-Width Horizontal KPI Cards (Tournament Rank, Event Record, Event High Score NP)
 * 2. Stage/Participation Empty States:
 *    - If no team matches played: displays "Team #15996 did not play any matches at this event."
 *    - If playoff / non-qualification stage: displays stage notice
 * 3. OPR Breakdown & Ranks Card:
 *    - Total Event OPR + EVENT RANK: 1ST badge
 *    - Auto OPR, TeleOp OPR, Endgame OPR + individual event ranks
 * 4. Average Scores Card:
 *    - Average Score + Average Score Margin
 *    - Avg Autonomous, Avg TeleOp, Avg Endgame
 */
export function EventStatsTab({
  event,
  stats,
  matches,
  onSelectHighScoreMatch,
  onNavigateToRankings,
  style,
}: EventStatsTabProps) {
  const { colors, typography, spacing, radius, shadows } = useAppTheme();

  // Normalize win rate percentage (handles both 0..1 and 0..100)
  const rawWinRate = stats?.winRate ?? 0;
  const normalizedWinRate =
    rawWinRate > 0 && rawWinRate <= 1 ? rawWinRate * 100 : rawWinRate;
  const isBelowFifty = normalizedWinRate < 50;

  // Check if team played any matches at this event
  const hasTeamMatches =
    stats?.hasTeamMatches !== false &&
    (stats?.matchesPlayed ?? 0) > 0;

  // Check if stage has qualification matches
  const hasQualMatches =
    stats?.hasQualMatches !== false && event?.hasQualMatches !== false;

  const targetTeamNumber = stats?.teamNumber || 15996;

  const totalEventRank = formatOrdinal(stats?.oprRanks?.total ?? stats?.rank ?? 1);
  const autoEventRank = formatOrdinal(stats?.oprRanks?.auto ?? 1);
  const teleopEventRank = formatOrdinal(stats?.oprRanks?.teleop ?? 1);
  const endgameEventRank = formatOrdinal(stats?.oprRanks?.endgame ?? 1);

  const avgScoreMargin =
    (stats?.averages as any)?.avgScoreMargin ?? stats?.averages?.avgWinningMargin ?? 0;

  // Penalty Telemetry (Item 12):
  // Read avgPenaltiesAwarded, avgPenaltiesConceded, and avgNetPenalties from stats?.averages
  const rawAvgAwarded = stats?.averages?.avgPenaltiesAwarded;
  const rawAvgConceded = stats?.averages?.avgPenaltiesConceded;
  const rawNetPenalties = stats?.averages?.avgNetPenalties;

  let avgAwarded = rawAvgAwarded;
  let avgConceded = rawAvgConceded;
  let netPenalties = rawNetPenalties;

  if (avgAwarded == null || avgConceded == null || netPenalties == null) {
    const teamMatches = (matches ?? []).filter(
      (m) =>
        m.status === 'COMPLETED' &&
        m.targetTeamAlliance &&
        (m.scoreRedFinal !== null || m.scoreBlueFinal !== null)
    );
    if (teamMatches.length > 0) {
      let totalAwarded = 0;
      let totalConceded = 0;
      let count = 0;
      for (const m of teamMatches) {
        const side = (m.targetTeamAlliance?.toLowerCase() === 'blue' ? 'blue' : 'red') as 'red' | 'blue';
        const oppSide = side === 'red' ? 'blue' : 'red';
        const sideTasks = m.taskBreakdown?.[side];
        const oppTasks = m.taskBreakdown?.[oppSide];
        if (sideTasks) {
          totalAwarded += sideTasks.foulPointsAwarded ?? (oppTasks?.foulPointsCommitted ?? 0);
          totalConceded += sideTasks.foulPointsCommitted ?? 0;
          count++;
        } else if (m.periodBreakdown) {
          totalConceded += m.periodBreakdown[side]?.foulCommitted ?? 0;
          totalAwarded += m.periodBreakdown[oppSide]?.foulCommitted ?? 0;
          count++;
        }
      }
      if (count > 0) {
        if (avgAwarded == null) avgAwarded = totalAwarded / count;
        if (avgConceded == null) avgConceded = totalConceded / count;
        if (netPenalties == null) netPenalties = avgAwarded - avgConceded;
      }
    }
  }

  const finalAvgAwarded = avgAwarded ?? 0;
  const finalAvgConceded = avgConceded ?? 0;
  const finalNetPenalties = netPenalties ?? (finalAvgAwarded - finalAvgConceded);

  return (
    <View style={[styles.container, { gap: spacing.md }, style]}>
      {/* ─────────────────────────────────────────────────────────────
          SECTION 1: 3 Full-Width Horizontal KPI Cards or Notice
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

        {!hasTeamMatches ? (
          /* Condition 1: Team did not play any matches */
          <View
            style={[
              styles.noticeCard,
              shadows.sm,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                padding: spacing.xl,
              },
            ]}
          >
            <View
              style={[
                styles.noticeIconCircle,
                { backgroundColor: colors.neutralSoft },
              ]}
            >
              <AppIcon name="alert-circle" size={24} color={colors.textSecondary} />
            </View>
            <Text
              style={[
                typography.subhead,
                {
                  color: colors.textPrimary,
                  marginTop: spacing.md,
                  textAlign: 'center',
                  fontWeight: '700',
                },
              ]}
            >
              Team #{targetTeamNumber} did not play any matches at this event.
            </Text>
          </View>
        ) : !hasQualMatches ? (
          /* Condition 2: Playoff / Non-qualification stage */
          <View
            style={[
              styles.noticeCard,
              shadows.sm,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                padding: spacing.xl,
              },
            ]}
          >
            <View
              style={[
                styles.noticeIconCircle,
                { backgroundColor: colors.accentGoldSoft },
              ]}
            >
              <AppIcon name="trophy" size={24} color={colors.accentGold} />
            </View>
            <Text
              style={[
                typography.subhead,
                {
                  color: colors.textPrimary,
                  marginTop: spacing.md,
                  textAlign: 'center',
                  fontWeight: '700',
                  lineHeight: 22,
                },
              ]}
            >
              Playoff / Division Finals Stage — Qualification OPR, Rank, and W-L-T Record are not calculated for non-qualification stages.
            </Text>
          </View>
        ) : (
          /* Default: 3 Full-Width Horizontal Cards (Stacked Vertically) */
          <View style={[styles.horizontalCardsStack, { gap: spacing.sm }]}>
            {/* Card 1: Tournament Rank Horizontal Card (Interactive Pressable -> Rankings Tab) */}
            <Pressable
              onPress={onNavigateToRankings}
              disabled={!onNavigateToRankings}
              accessible
              accessibilityRole="button"
              accessibilityLabel={`Tournament Rank: ${stats?.rank ? `#${stats.rank}` : 'Unranked'} of ${stats?.totalTeams ?? 0} Teams. Tap to view rankings.`}
              accessibilityHint="Navigates to Rankings tab"
              style={({ pressed }) => [
                styles.horizontalKpiCard,
                shadows.sm,
                {
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  padding: spacing.base,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={styles.cardHeaderBetween}>
                <View style={styles.headerTitleGroup}>
                  <View
                    style={[
                      styles.iconBadgeSmall,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderRadius: radius.sm,
                      },
                    ]}
                  >
                    <AppIcon name="chart" size={14} color={colors.primary} />
                  </View>
                  <Text
                    style={[
                      typography.caption,
                      styles.cardHeaderLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    TOURNAMENT RANK
                  </Text>
                </View>

                <AppIcon name="arrow-up-right" size={14} color={colors.primary} />
              </View>

              <View style={[styles.contentRowBetween, { marginTop: spacing.sm }]}>
                <Text
                  style={[
                    styles.tabularHeroValue,
                    { color: colors.textPrimary },
                  ]}
                >
                  {stats?.rank ? `#${stats.rank}` : 'Unranked'}
                </Text>

                <Text
                  style={[
                    typography.subhead,
                    styles.sideMetricLabel,
                    { color: colors.textMuted },
                  ]}
                  numberOfLines={1}
                >
                  of {stats?.totalTeams ?? 0} Teams
                </Text>
              </View>
            </Pressable>

            {/* Card 2: Event Record Horizontal Card (Interactive Pressable -> Rankings Tab) */}
            <Pressable
              onPress={onNavigateToRankings}
              disabled={!onNavigateToRankings}
              accessible
              accessibilityRole="button"
              accessibilityLabel={`Event Record: ${stats?.wins ?? 0} wins, ${stats?.losses ?? 0} losses, ${stats?.ties ?? 0} ties, ${normalizedWinRate.toFixed(1)} percent win rate, ${stats?.matchesPlayed ?? 0} matches played. Tap to view rankings.`}
              accessibilityHint="Navigates to Rankings tab"
              style={({ pressed }) => [
                styles.horizontalKpiCard,
                shadows.sm,
                {
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  padding: spacing.base,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={styles.cardHeaderBetween}>
                <View style={styles.headerTitleGroup}>
                  <View
                    style={[
                      styles.iconBadgeSmall,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderRadius: radius.sm,
                      },
                    ]}
                  >
                    <AppIcon name="shield" size={14} color={colors.primary} />
                  </View>
                  <Text
                    style={[
                      typography.caption,
                      styles.cardHeaderLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    EVENT RECORD
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <StatusBadge
                    variant={isBelowFifty ? 'red' : 'live'}
                    label={`${normalizedWinRate.toFixed(1)}% Win Rate`}
                    size="sm"
                  />
                  <AppIcon name="arrow-up-right" size={14} color={colors.primary} />
                </View>
              </View>

              <View style={[styles.contentRowBetween, { marginTop: spacing.sm }]}>
                <Text
                  style={[
                    styles.tabularHeroValue,
                    { color: colors.textPrimary },
                  ]}
                >
                  {stats?.wins ?? 0}-{stats?.losses ?? 0}-{stats?.ties ?? 0}
                </Text>

                <Text
                  style={[
                    typography.subhead,
                    styles.sideMetricLabel,
                    { color: colors.textMuted },
                  ]}
                  numberOfLines={1}
                >
                  {stats?.matchesPlayed ?? 0} Matches Played
                </Text>
              </View>
            </Pressable>

            {/* Card 3: Event High Score (NP) Horizontal Card (Interactive Pressable) */}
            <Pressable
              onPress={() => onSelectHighScoreMatch?.(stats?.highScoreMatch)}
              accessible
              accessibilityRole="button"
              accessibilityLabel={`Event High Score (NP): ${stats?.highScore ?? 0} pts, ${stats?.highScoreMatch || 'Peak Alliance Score'}. Tap to jump to match.`}
              accessibilityHint="Jumps to match in the matches tab"
              style={({ pressed }) => [
                styles.horizontalKpiCard,
                shadows.sm,
                {
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  padding: spacing.base,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={styles.cardHeaderBetween}>
                <View style={styles.headerTitleGroup}>
                  <View
                    style={[
                      styles.iconBadgeSmall,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderRadius: radius.sm,
                      },
                    ]}
                  >
                    <AppIcon name="trophy" size={14} color={colors.primary} />
                  </View>
                  <Text
                    style={[
                      typography.caption,
                      styles.cardHeaderLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    EVENT HIGH SCORE (NP)
                  </Text>
                </View>

                <AppIcon name="arrow-up-right" size={14} color={colors.primary} />
              </View>

              <View style={[styles.contentRowBetween, { marginTop: spacing.sm }]}>
                <Text
                  style={[
                    styles.tabularHeroValue,
                    { color: colors.textPrimary },
                  ]}
                >
                  {stats?.highScore ?? 0} pts
                </Text>

                <Text
                  style={[
                    typography.subhead,
                    styles.sideMetricLabel,
                    { color: colors.textSecondary, textAlign: 'right' },
                  ]}
                  numberOfLines={1}
                >
                  {stats?.highScoreMatch || 'Peak Alliance Score'}
                </Text>
              </View>
            </Pressable>
          </View>
        )}
      </View>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: OPR Breakdown & Ranks Card
         ───────────────────────────────────────────────────────────── */}
      {hasTeamMatches && hasQualMatches && (
        <View
          style={[
            styles.breakdownCard,
            shadows.sm,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              padding: spacing.base,
            },
          ]}
          accessible
          accessibilityRole="summary"
          accessibilityLabel="OPR Breakdown and Ranks"
        >
          <View style={styles.cardHeaderBetween}>
            <View style={styles.cardHeaderLeft}>
              <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '700' }]}>
                OPR BREAKDOWN & RANKS
              </Text>
              <Text style={[styles.mainMetricValue, { color: colors.primary, marginTop: spacing.xs }]}>
                {stats?.opr?.totalOpr != null ? stats.opr.totalOpr.toFixed(2) : '0.00'}
                <Text style={[typography.caption, { color: colors.textMuted }]}> Total OPR</Text>
              </Text>
            </View>
            <StatusBadge
              variant="gold"
              label={`EVENT RANK: ${totalEventRank.toUpperCase()}`}
              size="sm"
            />
          </View>

          <View
            style={[
              styles.columnsRow,
              {
                marginTop: spacing.md,
                paddingTop: spacing.sm,
                borderTopWidth: 1,
                borderTopColor: colors.borderSubtle,
              },
            ]}
          >
            {/* Auto OPR */}
            <View style={styles.metricColumn}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Auto OPR</Text>
              <Text style={[styles.columnMetricValue, { color: colors.textPrimary }]}>
                {stats?.opr?.autoOpr != null ? stats.opr.autoOpr.toFixed(1) : '0.0'}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted, fontSize: 11, marginTop: 2 }]}>
                Event Rank: {autoEventRank}
              </Text>
            </View>

            <View style={[styles.metricDivider, { backgroundColor: colors.borderSubtle }]} />

            {/* TeleOp OPR */}
            <View style={styles.metricColumn}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>TeleOp OPR</Text>
              <Text style={[styles.columnMetricValue, { color: colors.textPrimary }]}>
                {stats?.opr?.teleopOpr != null ? stats.opr.teleopOpr.toFixed(1) : '0.0'}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted, fontSize: 11, marginTop: 2 }]}>
                Event Rank: {teleopEventRank}
              </Text>
            </View>

            <View style={[styles.metricDivider, { backgroundColor: colors.borderSubtle }]} />

            {/* Endgame OPR */}
            <View style={styles.metricColumn}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Endgame OPR</Text>
              <Text style={[styles.columnMetricValue, { color: colors.textPrimary }]}>
                {stats?.opr?.endgameOpr != null ? stats.opr.endgameOpr.toFixed(1) : '0.0'}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted, fontSize: 11, marginTop: 2 }]}>
                Event Rank: {endgameEventRank}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3: Average Scores Card (Average Score + Avg Winning Margin)
         ───────────────────────────────────────────────────────────── */}
      {hasTeamMatches && hasQualMatches && (
        <View
          style={[
            styles.breakdownCard,
            shadows.sm,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              padding: spacing.base,
            },
          ]}
          accessible
          accessibilityRole="summary"
          accessibilityLabel="Average Scores Breakdown"
        >
          <View style={styles.cardHeaderBetween}>
            <View style={styles.cardHeaderLeft}>
              <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '700' }]}>
                AVERAGE SCORE
              </Text>
              <Text style={[styles.mainMetricValue, { color: colors.textPrimary, marginTop: spacing.xs }]}>
                {stats?.averages?.totalAvg != null ? stats.averages.totalAvg.toFixed(1) : '0.0'} pts
              </Text>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '700' }]}>
                AVG SCORE MARGIN
              </Text>
              <Text
                style={[
                  styles.mainMetricValue,
                  {
                    color: avgScoreMargin < 0 ? colors.destructive : colors.statusLive,
                    marginTop: spacing.xs,
                  },
                ]}
              >
                {avgScoreMargin > 0 ? '+' : ''}
                {avgScoreMargin.toFixed(1)} pts
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.columnsRow,
              {
                marginTop: spacing.md,
                paddingTop: spacing.sm,
                borderTopWidth: 1,
                borderTopColor: colors.borderSubtle,
              },
            ]}
          >
            {/* Avg Autonomous */}
            <View style={styles.metricColumn}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Avg Autonomous</Text>
              <Text style={[styles.columnMetricValue, { color: colors.textPrimary }]}>
                {stats?.averages?.autoAvg != null ? stats.averages.autoAvg.toFixed(1) : '0.0'}
              </Text>
            </View>

            <View style={[styles.metricDivider, { backgroundColor: colors.borderSubtle }]} />

            {/* Avg TeleOp */}
            <View style={styles.metricColumn}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Avg TeleOp</Text>
              <Text style={[styles.columnMetricValue, { color: colors.textPrimary }]}>
                {stats?.averages?.teleopAvg != null ? stats.averages.teleopAvg.toFixed(1) : '0.0'}
              </Text>
            </View>

            <View style={[styles.metricDivider, { backgroundColor: colors.borderSubtle }]} />

            {/* Avg Endgame */}
            <View style={styles.metricColumn}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Avg Endgame</Text>
              <Text style={[styles.columnMetricValue, { color: colors.textPrimary }]}>
                {stats?.averages?.endgameAvg != null ? stats.averages.endgameAvg.toFixed(1) : '0.0'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 4: Penalty Telemetry Card (Awarded, Conceded, Net)
         ───────────────────────────────────────────────────────────── */}
      {hasTeamMatches && hasQualMatches && (
        <View
          style={[
            styles.breakdownCard,
            shadows.sm,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              padding: spacing.base,
            },
          ]}
          accessible
          accessibilityRole="summary"
          accessibilityLabel={`Penalty Telemetry: Avg Awarded +${finalAvgAwarded.toFixed(1)} points gained, Avg Conceded -${finalAvgConceded.toFixed(1)} points given away, Net Penalties ${finalNetPenalties > 0 ? '+' : ''}${finalNetPenalties.toFixed(1)} points`}
        >
          <View style={styles.cardHeaderBetween}>
            <View style={styles.headerTitleGroup}>
              <View
                style={[
                  styles.iconBadgeSmall,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderRadius: radius.sm,
                  },
                ]}
              >
                <AppIcon name="alert-circle" size={14} color={colors.primary} />
              </View>
              <Text style={[typography.caption, styles.cardHeaderLabel, { color: colors.textSecondary }]}>
                PENALTY TELEMETRY
              </Text>
            </View>

            <StatusBadge
              variant={finalNetPenalties >= 0 ? 'live' : 'red'}
              label={finalNetPenalties >= 0 ? 'NET POSITIVE' : 'NET DEFICIT'}
              size="sm"
            />
          </View>

          <View
            style={[
              styles.columnsRow,
              {
                marginTop: spacing.md,
                paddingTop: spacing.sm,
                borderTopWidth: 1,
                borderTopColor: colors.borderSubtle,
              },
            ]}
          >
            {/* 1. AVG AWARDED */}
            <View style={styles.metricColumn}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Avg Awarded</Text>
              <Text style={[styles.columnMetricValue, { color: colors.statusLive }]}>
                +{finalAvgAwarded.toFixed(1)}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted, fontSize: 11, marginTop: 2 }]}>
                Opponent fouls
              </Text>
            </View>

            <View style={[styles.metricDivider, { backgroundColor: colors.borderSubtle }]} />

            {/* 2. AVG CONCEDED */}
            <View style={styles.metricColumn}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Avg Conceded</Text>
              <Text style={[styles.columnMetricValue, { color: colors.destructive }]}>
                -{finalAvgConceded.toFixed(1)}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted, fontSize: 11, marginTop: 2 }]}>
                Own fouls
              </Text>
            </View>

            <View style={[styles.metricDivider, { backgroundColor: colors.borderSubtle }]} />

            {/* 3. NET PENALTIES */}
            <View style={styles.metricColumn}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Net Penalties</Text>
              <Text
                style={[
                  styles.columnMetricValue,
                  {
                    color: finalNetPenalties >= 0 ? colors.statusLive : colors.destructive,
                  },
                ]}
              >
                {finalNetPenalties > 0 ? '+' : ''}
                {finalNetPenalties.toFixed(1)}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted, fontSize: 11, marginTop: 2 }]}>
                Net margin
              </Text>
            </View>
          </View>
        </View>
      )}
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
  noticeCard: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  horizontalCardsStack: {
    width: '100%',
  },
  horizontalKpiCard: {
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
  iconBadgeSmall: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderLabel: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  contentRowBetween: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    width: '100%',
  },
  tabularHeroValue: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  sideMetricLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  breakdownCard: {
    width: '100%',
  },
  cardHeaderLeft: {
    flex: 1,
  },
  mainMetricValue: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  columnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricColumn: {
    flex: 1,
    alignItems: 'center',
  },
  columnMetricValue: {
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginTop: 4,
  },
  metricDivider: {
    width: 1,
    height: 36,
  },
});
