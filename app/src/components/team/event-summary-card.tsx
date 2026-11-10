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
import type { EventSummaryItem } from '@/types/api';
import { AppIcon } from '@/components/ui/icon';
import { StatusBadge } from '@/components/ui/status-badge';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/**
 * Parses YYYY-MM-DD components directly to prevent timezone-related date shifts.
 */
function parseDateComponents(
  isoStr?: string
): { year: number; month: number; day: number } | null {
  if (!isoStr) return null;
  const match = isoStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10) - 1,
    day: parseInt(match[3], 10),
  };
}

/**
 * Formats tournament date ranges cleanly without timezone discrepancies.
 * Examples:
 * - "2026-04-29", "2026-05-02" -> "Apr 29 – May 2, 2026"
 * - "2026-02-21", "2026-02-22" -> "Feb 21–22, 2026"
 * - "2025-12-13", "2025-12-13" -> "Dec 13, 2025"
 */
export function formatEventDateRange(
  dateStartStr?: string,
  dateEndStr?: string
): string {
  if (!dateStartStr) return '';
  const start = parseDateComponents(dateStartStr);
  if (!start) return dateStartStr;

  const startMonthName = MONTH_NAMES[start.month] ?? '';
  const startDay = start.day;
  const startYear = start.year;

  if (!dateEndStr) {
    return `${startMonthName} ${startDay}, ${startYear}`;
  }

  const end = parseDateComponents(dateEndStr);
  if (!end) {
    return `${startMonthName} ${startDay}, ${startYear}`;
  }

  const endMonthName = MONTH_NAMES[end.month] ?? '';
  const endDay = end.day;
  const endYear = end.year;

  if (startYear === endYear) {
    if (start.month === end.month) {
      if (startDay === endDay) {
        return `${startMonthName} ${startDay}, ${startYear}`;
      }
      return `${startMonthName} ${startDay}–${endDay}, ${startYear}`;
    }
    return `${startMonthName} ${startDay} – ${endMonthName} ${endDay}, ${startYear}`;
  }

  return `${startMonthName} ${startDay}, ${startYear} – ${endMonthName} ${endDay}, ${endYear}`;
}

export interface EventSummaryCardProps {
  event: EventSummaryItem;
  index: number;
  onPress: (eventCode: string) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Tournament Summary Card for TeamHomeScreen and Season Tournament Lists.
 * Features:
 * - Live in-progress beacon banner with real-time accent border
 * - Completed tournament top-rank badges and formatted date intervals
 * - 4-column sports telemetry grid (Rank, Record, Event OPR, High Score) with tabular numerals
 * - 60fps UI-thread press interaction (0.985 scale over 120ms) and staggered entrance
 */
export function EventSummaryCard({
  event,
  index,
  onPress,
  style,
}: EventSummaryCardProps) {
  const { colors, typography, spacing, radius, shadows } = useAppTheme();
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const isLive = event.status === 'IN_PROGRESS';
  const isTopRank = typeof event.rank === 'number' && event.rank <= 4;
  const dateRange = formatEventDateRange(event.dateStart, event.dateEnd);

  const animatedPressStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    scale.value = withTiming(0.985, { duration: 120 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 120 });
  };

  const handlePress = () => {
    onPress(event.eventCode);
  };

  const staggeredDelay = Math.min(index * 55, 300);

  return (
    <AnimatedPressable
      entering={
        reducedMotion
          ? undefined
          : FadeInDown.delay(staggeredDelay).duration(250)
      }
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${event.name}, ${isLive ? 'Live Tournament in progress' : event.typeName}. Rank ${event.rank ? `#${event.rank} of ${event.totalTeams}` : 'Unranked'}, Record ${event.wins} wins, ${event.losses} losses, ${event.ties} ties.`}
      accessibilityHint="Tap to view event overview, match results, and live queue schedule"
      style={[
        styles.cardContainer,
        isLive ? shadows.md : shadows.sm,
        {
          backgroundColor: colors.card,
          borderColor: isLive ? colors.statusLive : colors.border,
          borderWidth: isLive ? 1.5 : 1,
          borderRadius: radius.lg,
          padding: spacing.base,
        },
        animatedPressStyle,
        style,
      ]}
    >
      {/* ─────────────────────────────────────────────────────────────
          TOP ROW / BANNER STRIP
         ───────────────────────────────────────────────────────────── */}
      {isLive ? (
        <View style={styles.liveBannerRow}>
          <StatusBadge
            variant="live"
            label="LIVE TOURNAMENT • IN PROGRESS"
            pulsing
            size="sm"
          />
          <View style={styles.livePromptContainer}>
            <Text
              style={[
                typography.caption,
                styles.livePromptText,
                { color: colors.statusLive },
              ]}
              numberOfLines={1}
            >
              Tap for Live Queue & Schedule
            </Text>
            <AppIcon name="radio" size={13} color={colors.statusLive} />
          </View>
        </View>
      ) : (
        <View style={styles.topRow}>
          <StatusBadge
            variant={isTopRank ? 'gold' : 'neutral'}
            label={(event.typeName || 'TOURNAMENT').toUpperCase()}
            size="sm"
          />
          {dateRange ? (
            <View style={styles.dateContainer}>
              <AppIcon name="calendar" size={13} color={colors.textMuted} />
              <Text
                style={[
                  typography.caption,
                  styles.dateText,
                  { color: colors.textMuted },
                ]}
                numberOfLines={1}
              >
                {dateRange}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TITLE & VENUE ROW
         ───────────────────────────────────────────────────────────── */}
      <View style={[styles.titleSection, { marginTop: spacing.sm }]}>
        <View style={styles.titleRow}>
          <Text
            style={[
              typography.headline,
              styles.eventTitle,
              { color: colors.textPrimary },
            ]}
            numberOfLines={2}
          >
            {event.name}
          </Text>
          <View
            style={[
              styles.chevronCircle,
              {
                backgroundColor: colors.surfaceElevated,
                borderRadius: radius.full,
              },
            ]}
          >
            <AppIcon
              name="chevron-right"
              size={14}
              color={colors.textSecondary}
            />
          </View>
        </View>

        {/* Location Row */}
        <View style={[styles.locationRow, { marginTop: spacing.xs }]}>
          <AppIcon name="location" size={13} color={colors.textMuted} />
          <Text
            style={[
              typography.caption,
              styles.locationText,
              { color: colors.textMuted },
            ]}
            numberOfLines={1}
          >
            {event.city}, {event.country}
            {event.venue ? ` • ${event.venue}` : ''}
          </Text>
        </View>
      </View>

      {/* ─────────────────────────────────────────────────────────────
          BOTTOM 4-METRIC TELEMETRY GRID
         ───────────────────────────────────────────────────────────── */}
      <View
        style={[
          styles.telemetryGrid,
          {
            borderTopColor: colors.borderSubtle,
            marginTop: spacing.md,
            paddingTop: spacing.sm,
          },
        ]}
      >
        {/* 1. RANK */}
        <View style={styles.metricCell}>
          <Text
            style={[
              typography.caption,
              styles.metricLabel,
              { color: colors.textMuted },
            ]}
            numberOfLines={1}
          >
            RANK
          </Text>
          <Text
            style={[
              typography.tabularNumber,
              styles.metricValue,
              { color: isTopRank ? colors.accentGold : colors.textPrimary },
            ]}
            numberOfLines={1}
          >
            {event.rank ? `#${event.rank} / ${event.totalTeams}` : '—'}
          </Text>
        </View>

        {/* 2. RECORD */}
        <View style={styles.metricCell}>
          <Text
            style={[
              typography.caption,
              styles.metricLabel,
              { color: colors.textMuted },
            ]}
            numberOfLines={1}
          >
            RECORD
          </Text>
          <Text
            style={[
              typography.tabularNumber,
              styles.metricValue,
              { color: colors.textPrimary },
            ]}
            numberOfLines={1}
          >
            {event.wins}-{event.losses}-{event.ties}
            <Text
              style={[
                styles.metricSubWinRate,
                { color: colors.statusLive },
              ]}
            >
              {` (${event.winRate.toFixed(0)}%)`}
            </Text>
          </Text>
        </View>

        {/* 3. EVENT OPR */}
        <View style={styles.metricCell}>
          <Text
            style={[
              typography.caption,
              styles.metricLabel,
              { color: colors.textMuted },
            ]}
            numberOfLines={1}
          >
            EVENT OPR
          </Text>
          <Text
            style={[
              typography.tabularNumber,
              styles.metricValue,
              { color: colors.primary },
            ]}
            numberOfLines={1}
          >
            {event.totalOpr.toFixed(1)}
          </Text>
        </View>

        {/* 4. HIGH SCORE */}
        <View style={styles.metricCell}>
          <Text
            style={[
              typography.caption,
              styles.metricLabel,
              { color: colors.textMuted },
            ]}
            numberOfLines={1}
          >
            HIGH SCORE
          </Text>
          <Text
            style={[
              typography.tabularNumber,
              styles.metricValue,
              { color: colors.textPrimary },
            ]}
            numberOfLines={1}
          >
            {event.highScore} pts
          </Text>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    borderCurve: 'continuous',
    width: '100%',
  },
  liveBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  livePromptContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  livePromptText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  titleSection: {
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  eventTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    flex: 1,
  },
  chevronCircle: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
    flexShrink: 0,
    marginTop: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    flex: 1,
  },
  telemetryGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  metricCell: {
    flex: 1,
    gap: 2,
  },
  metricLabel: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  metricValue: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  metricSubWinRate: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
