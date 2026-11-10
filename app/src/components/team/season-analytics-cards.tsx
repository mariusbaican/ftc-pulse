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
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '@/theme';
import type { SeasonSummaryResponse } from '@/types/api';
import { AppIcon } from '@/components/ui/icon';
import { StatusBadge } from '@/components/ui/status-badge';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface SeasonAnalyticsCardsProps {
  summary: SeasonSummaryResponse;
  onSelectEvent?: (eventCode: string) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Animated High-Emphasis Season Analytics & Statistical Highlight Cards.
 * Implements:
 * 1. Global Season OPR & Period Breakdown Hero Card with proportional distribution bar
 * 2. Side-by-side Season W-L-T Record Card with animated win rate telemetry bar
 * 3. Side-by-side Best Match Performance Card with interactive touch routing
 *
 * Adheres strictly to ui-ux-pro-max guidelines, expo-animation, expo-native-ui, and WCAG 2.1 AA accessibility.
 */
export function SeasonAnalyticsCards({
  summary,
  onSelectEvent,
  style,
}: SeasonAnalyticsCardsProps) {
  const { colors, typography, spacing, radius, shadows } = useAppTheme();
  const reducedMotion = useReducedMotion();

  // Shared values for proportional telemetry bars
  const distributionProgress = useSharedValue(reducedMotion ? 1 : 0);
  const winRateProgress = useSharedValue(reducedMotion ? 1 : 0);
  const bestMatchScale = useSharedValue(1);

  // Normalize win rate percentage (handles both 0..1 and 0..100)
  const rawWinRate = summary.record?.winRate ?? 0;
  const winRatePct = rawWinRate > 0 && rawWinRate <= 1 ? rawWinRate * 100 : rawWinRate;

  // Calculate component distribution ratios for OPR breakdown
  const autoOpr = Math.max(0, summary.globalOpr?.autoOpr ?? 0);
  const teleopOpr = Math.max(0, summary.globalOpr?.teleopOpr ?? 0);
  const endgameOpr = Math.max(0, summary.globalOpr?.endgameOpr ?? 0);
  const totalComponentOpr = autoOpr + teleopOpr + endgameOpr;
  const safeSum = totalComponentOpr > 0 ? totalComponentOpr : 1;

  const autoRatio = autoOpr / safeSum;
  const teleopRatio = teleopOpr / safeSum;
  const endgameRatio = endgameOpr / safeSum;

  const autoFlex = Math.max(1, Math.round(autoRatio * 100));
  const teleopFlex = Math.max(1, Math.round(teleopRatio * 100));
  const endgameFlex = Math.max(1, Math.round(endgameRatio * 100));

  useEffect(() => {
    if (!reducedMotion) {
      distributionProgress.value = withTiming(1, {
        duration: 650,
        easing: Easing.out(Easing.cubic),
      });
      winRateProgress.value = withTiming(1, {
        duration: 700,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      distributionProgress.value = 1;
      winRateProgress.value = 1;
    }
  }, [reducedMotion, distributionProgress, winRateProgress]);

  // Animated styles for bar fills
  const animatedDistributionBarStyle = useAnimatedStyle(() => {
    return {
      width: `${Math.min(100, Math.max(0, distributionProgress.value * 100))}%`,
    };
  });

  const animatedWinRateBarStyle = useAnimatedStyle(() => {
    const clampedPct = Math.min(100, Math.max(0, winRatePct));
    return {
      width: `${clampedPct * winRateProgress.value}%`,
    };
  });

  const animatedBestMatchPressStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: bestMatchScale.value }],
    };
  });

  const handleBestMatchPressIn = () => {
    if (summary.bestMatch && onSelectEvent) {
      bestMatchScale.value = withTiming(0.98, { duration: 100 });
    }
  };

  const handleBestMatchPressOut = () => {
    bestMatchScale.value = withTiming(1, { duration: 100 });
  };

  const handleBestMatchPress = () => {
    if (summary.bestMatch && onSelectEvent) {
      onSelectEvent(summary.bestMatch.eventCode);
    }
  };

  const seasonYear = summary.season || 2025;

  return (
    <View style={[styles.rootContainer, { gap: spacing.md }, style]}>
      {/* ─────────────────────────────────────────────────────────────
          CARD 1: Global Season OPR & Period Breakdown Hero Card
         ───────────────────────────────────────────────────────────── */}
      <Animated.View
        entering={reducedMotion ? undefined : FadeInDown.duration(260)}
        style={[
          styles.heroCard,
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
        accessibilityLabel={`Global Season OPR: ${summary.globalOpr?.totalOpr?.toFixed(2) ?? '0.00'}`}
      >
        {/* Header Row: Bolt Icon + Label + Best Event Peak OPR Pill */}
        <View style={styles.headerRow}>
          <View style={styles.headerTitleGroup}>
            <View
              style={[
                styles.iconBadge,
                {
                  backgroundColor: colors.primarySoft,
                  borderRadius: radius.sm,
                },
              ]}
            >
              <AppIcon name="bolt" size={16} color={colors.primary} />
            </View>
            <Text
              style={[
                typography.caption,
                styles.cardHeaderLabel,
                { color: colors.textSecondary },
              ]}
            >
              GLOBAL SEASON OPR
            </Text>
          </View>

          {summary.bestEvent ? (
            <StatusBadge
              variant="gold"
              label={`Peak OPR: ${summary.bestEvent.totalOpr.toFixed(1)}`}
              size="sm"
            />
          ) : (
            <StatusBadge
              variant="neutral"
              label={`${seasonYear} Season`}
              size="sm"
            />
          )}
        </View>

        {/* Main Metric Value & Subtitle */}
        <View style={[styles.metricSection, { marginTop: spacing.sm }]}>
          <Text
            style={[
              typography.hero,
              styles.oprValueText,
              { color: colors.textPrimary },
            ]}
          >
            {summary.globalOpr?.totalOpr?.toFixed(2) ?? '0.00'}
          </Text>
          <Text
            style={[
              typography.caption,
              styles.oprSubtitle,
              { color: colors.textMuted },
            ]}
          >
            Offensive Power Rating (Ridge OLS across {seasonYear} season)
          </Text>
        </View>

        {/* Animated Proportional Period Distribution Bar */}
        <View style={[styles.barContainer, { marginTop: spacing.md }]}>
          <View
            style={[
              styles.barTrack,
              {
                backgroundColor: colors.surfaceElevated,
                borderRadius: radius.full,
              },
            ]}
          >
            <Animated.View
              style={[
                styles.barSegmentsContainer,
                { borderRadius: radius.full },
                animatedDistributionBarStyle,
              ]}
            >
              <View
                style={[
                  styles.barSegment,
                  {
                    flex: autoFlex,
                    backgroundColor: colors.allianceBlue,
                  },
                ]}
              />
              <View
                style={[
                  styles.barSegment,
                  {
                    flex: teleopFlex,
                    backgroundColor: colors.primary,
                  },
                ]}
              />
              <View
                style={[
                  styles.barSegment,
                  {
                    flex: endgameFlex,
                    backgroundColor: colors.accentGold,
                  },
                ]}
              />
            </Animated.View>
          </View>
        </View>

        {/* 3-Column Period Telemetry Split */}
        <View
          style={[
            styles.telemetryColumnsRow,
            {
              borderTopColor: colors.borderSubtle,
              marginTop: spacing.md,
              paddingTop: spacing.md,
            },
          ]}
        >
          {/* Autonomous Column */}
          <View
            style={styles.periodCol}
            accessible
            accessibilityLabel={`Autonomous: Auto OPR ${summary.globalOpr?.autoOpr?.toFixed(1) ?? '0.0'}, average ${summary.periodAverages?.autoAvg?.toFixed(1) ?? '0.0'} points`}
          >
            <View style={styles.periodColHeader}>
              <View
                style={[
                  styles.periodIndicatorDot,
                  { backgroundColor: colors.allianceBlue },
                ]}
              />
              <Text
                style={[
                  typography.caption,
                  styles.periodNameText,
                  { color: colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                Autonomous
              </Text>
            </View>
            <Text
              style={[
                typography.tabularNumber,
                styles.periodOprValue,
                { color: colors.allianceBlue },
              ]}
              numberOfLines={1}
            >
              Auto OPR: {summary.globalOpr?.autoOpr?.toFixed(1) ?? '0.0'}
            </Text>
            <Text
              style={[
                typography.caption,
                styles.periodAvgValue,
                { color: colors.textMuted },
              ]}
              numberOfLines={1}
            >
              Avg: {summary.periodAverages?.autoAvg?.toFixed(1) ?? '0.0'} pts
            </Text>
          </View>

          {/* Subtle Vertical Divider */}
          <View
            style={[
              styles.columnDivider,
              { backgroundColor: colors.borderSubtle },
            ]}
          />

          {/* Driver TeleOp Column */}
          <View
            style={styles.periodCol}
            accessible
            accessibilityLabel={`Driver TeleOp: TeleOp OPR ${summary.globalOpr?.teleopOpr?.toFixed(1) ?? '0.0'}, average ${summary.periodAverages?.teleopAvg?.toFixed(1) ?? '0.0'} points`}
          >
            <View style={styles.periodColHeader}>
              <View
                style={[
                  styles.periodIndicatorDot,
                  { backgroundColor: colors.primary },
                ]}
              />
              <Text
                style={[
                  typography.caption,
                  styles.periodNameText,
                  { color: colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                Driver TeleOp
              </Text>
            </View>
            <Text
              style={[
                typography.tabularNumber,
                styles.periodOprValue,
                { color: colors.primary },
              ]}
              numberOfLines={1}
            >
              TeleOp OPR: {summary.globalOpr?.teleopOpr?.toFixed(1) ?? '0.0'}
            </Text>
            <Text
              style={[
                typography.caption,
                styles.periodAvgValue,
                { color: colors.textMuted },
              ]}
              numberOfLines={1}
            >
              Avg: {summary.periodAverages?.teleopAvg?.toFixed(1) ?? '0.0'} pts
            </Text>
          </View>

          {/* Subtle Vertical Divider */}
          <View
            style={[
              styles.columnDivider,
              { backgroundColor: colors.borderSubtle },
            ]}
          />

          {/* Endgame Column */}
          <View
            style={styles.periodCol}
            accessible
            accessibilityLabel={`Endgame: Endgame OPR ${summary.globalOpr?.endgameOpr?.toFixed(1) ?? '0.0'}, average ${summary.periodAverages?.endgameAvg?.toFixed(1) ?? '0.0'} points`}
          >
            <View style={styles.periodColHeader}>
              <View
                style={[
                  styles.periodIndicatorDot,
                  { backgroundColor: colors.accentGold },
                ]}
              />
              <Text
                style={[
                  typography.caption,
                  styles.periodNameText,
                  { color: colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                Endgame
              </Text>
            </View>
            <Text
              style={[
                typography.tabularNumber,
                styles.periodOprValue,
                { color: colors.accentGold },
              ]}
              numberOfLines={1}
            >
              Endgame OPR: {summary.globalOpr?.endgameOpr?.toFixed(1) ?? '0.0'}
            </Text>
            <Text
              style={[
                typography.caption,
                styles.periodAvgValue,
                { color: colors.textMuted },
              ]}
              numberOfLines={1}
            >
              Avg: {summary.periodAverages?.endgameAvg?.toFixed(1) ?? '0.0'} pts
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* ─────────────────────────────────────────────────────────────
          ROW OF 2 SIDE-BY-SIDE CARDS (Record & Best Match Performance)
         ───────────────────────────────────────────────────────────── */}
      <View style={[styles.sideBySideRow, { gap: spacing.md }]}>
        {/* CARD 2A: Season W-L-T Record Card */}
        <Animated.View
          entering={
            reducedMotion ? undefined : FadeInDown.delay(70).duration(260)
          }
          style={[
            styles.sideCard,
            shadows.sm,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: radius.lg,
              padding: spacing.base,
            },
          ]}
          accessible
          accessibilityRole="summary"
          accessibilityLabel={`Season Record: ${summary.record?.wins ?? 0} wins, ${summary.record?.losses ?? 0} losses, ${summary.record?.ties ?? 0} ties, ${winRatePct.toFixed(1)} percent win rate`}
        >
          {/* Header Row: Shield Icon + Label */}
          <View style={styles.sideCardHeader}>
            <View style={styles.headerTitleGroup}>
              <View
                style={[
                  styles.iconBadgeSmall,
                  {
                    backgroundColor: colors.statusLiveSoft,
                    borderRadius: radius.sm,
                  },
                ]}
              >
                <AppIcon name="shield" size={14} color={colors.statusLive} />
              </View>
              <Text
                style={[
                  typography.caption,
                  styles.sideCardLabel,
                  { color: colors.textSecondary },
                ]}
              >
                SEASON RECORD
              </Text>
            </View>
          </View>

          {/* Large Tabular Record */}
          <Text
            style={[
              typography.largeTitle,
              styles.recordScoreText,
              { color: colors.textPrimary, marginTop: spacing.xs },
            ]}
          >
            {summary.record
              ? `${summary.record.wins}-${summary.record.losses}-${summary.record.ties}`
              : '0-0-0'}
          </Text>

          {/* Win Rate Badge */}
          <View style={{ marginTop: spacing.xs }}>
            <StatusBadge
              variant="live"
              label={`${winRatePct.toFixed(1)}% Win Rate`}
              size="sm"
            />
          </View>

          {/* Animated Horizontal Win-Rate Bar */}
          <View
            style={[
              styles.miniBarTrack,
              {
                backgroundColor: colors.surfaceElevated,
                borderRadius: radius.full,
                marginTop: spacing.sm,
              },
            ]}
          >
            <Animated.View
              style={[
                styles.miniBarFill,
                {
                  backgroundColor: colors.statusLive,
                  borderRadius: radius.full,
                },
                animatedWinRateBarStyle,
              ]}
            />
          </View>

          {/* Subtitle Matches Played */}
          <Text
            style={[
              typography.caption,
              styles.sideCardSubtitle,
              { color: colors.textMuted, marginTop: spacing.xs },
            ]}
            numberOfLines={1}
          >
            {summary.record?.matchesPlayed ?? 0} Official Matches Played
          </Text>
        </Animated.View>

        {/* CARD 2B: Best Match Performance Highlight Card */}
        <AnimatedPressable
          entering={
            reducedMotion ? undefined : FadeInDown.delay(140).duration(260)
          }
          onPress={handleBestMatchPress}
          onPressIn={handleBestMatchPressIn}
          onPressOut={handleBestMatchPressOut}
          disabled={!summary.bestMatch || !onSelectEvent}
          accessible
          accessibilityRole="button"
          accessibilityLabel={
            summary.bestMatch
              ? `Season High Score: ${summary.bestMatch.score} points, ${summary.bestMatch.matchDescription} at ${summary.bestMatch.eventName}`
              : 'Season High Score: No official matches recorded'
          }
          accessibilityHint={
            summary.bestMatch && onSelectEvent
              ? `Jumps to tournament event ${summary.bestMatch.eventName}`
              : undefined
          }
          style={[
            styles.sideCard,
            shadows.sm,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: radius.lg,
              padding: spacing.base,
            },
            animatedBestMatchPressStyle,
          ]}
        >
          {/* Header Row: Trophy Icon + Label + Arrow */}
          <View style={styles.sideCardHeaderBetween}>
            <View style={styles.headerTitleGroup}>
              <View
                style={[
                  styles.iconBadgeSmall,
                  {
                    backgroundColor: colors.accentGoldSoft,
                    borderRadius: radius.sm,
                  },
                ]}
              >
                <AppIcon name="trophy" size={14} color={colors.accentGold} />
              </View>
              <Text
                style={[
                  typography.caption,
                  styles.sideCardLabel,
                  { color: colors.textSecondary },
                ]}
              >
                SEASON HIGH SCORE
              </Text>
            </View>

            {summary.bestMatch && onSelectEvent ? (
              <AppIcon
                name="arrow-up-right"
                size={14}
                color={colors.accentGold}
              />
            ) : null}
          </View>

          {/* Large Tabular Score */}
          <Text
            style={[
              typography.largeTitle,
              styles.recordScoreText,
              { color: colors.accentGold, marginTop: spacing.xs },
            ]}
          >
            {summary.bestMatch?.score ?? 0}{' '}
            <Text
              style={[
                typography.headline,
                { color: colors.accentGold, fontWeight: '700' },
              ]}
            >
              PTS
            </Text>
          </Text>

          {/* Subtitle Match Description & Alliance */}
          <Text
            style={[
              typography.caption,
              styles.matchDescText,
              { color: colors.textSecondary, marginTop: spacing.xs },
            ]}
            numberOfLines={1}
          >
            {summary.bestMatch
              ? `${summary.bestMatch.matchDescription} • ${summary.bestMatch.alliance} Alliance`
              : 'No matches played yet'}
          </Text>

          {/* Tournament Name with Link Icon */}
          <View style={[styles.tournamentLinkRow, { marginTop: spacing.xs }]}>
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
              <AppIcon name="arrow-up-right" size={12} color={colors.textMuted} />
            ) : null}
          </View>
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    width: '100%',
  },
  heroCard: {
    borderWidth: 1,
    borderCurve: 'continuous',
    width: '100%',
  },
  headerRow: {
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
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '800',
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  oprSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  barContainer: {
    width: '100%',
  },
  barTrack: {
    height: 10,
    width: '100%',
    overflow: 'hidden',
  },
  barSegmentsContainer: {
    height: '100%',
    flexDirection: 'row',
    overflow: 'hidden',
    gap: 1.5,
  },
  barSegment: {
    height: '100%',
  },
  telemetryColumnsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  periodCol: {
    flex: 1,
    gap: 3,
  },
  periodColHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  periodIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  periodNameText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  periodOprValue: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  periodAvgValue: {
    fontSize: 11,
    lineHeight: 14,
    fontVariant: ['tabular-nums'],
  },
  columnDivider: {
    width: StyleSheet.hairlineWidth,
    height: '80%',
    marginHorizontal: 8,
    alignSelf: 'center',
  },
  sideBySideRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
  },
  sideCard: {
    flex: 1,
    borderWidth: 1,
    borderCurve: 'continuous',
    justifyContent: 'space-between',
    minHeight: 148,
  },
  sideCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideCardHeaderBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sideCardLabel: {
    fontWeight: '700',
    letterSpacing: 0.4,
    fontSize: 11,
    lineHeight: 15,
  },
  recordScoreText: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  miniBarTrack: {
    height: 6,
    width: '100%',
    overflow: 'hidden',
  },
  miniBarFill: {
    height: '100%',
  },
  sideCardSubtitle: {
    fontSize: 11,
    lineHeight: 15,
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
    flex: 1,
  },
});
