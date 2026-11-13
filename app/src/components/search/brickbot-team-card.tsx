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
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '@/theme';
import type { TeamProfile } from '@/types/api';
import { AppIcon } from '@/components/ui/icon';
import { StatusBadge } from '@/components/ui/status-badge';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface BrickBotTeamCardProps {
  team: TeamProfile;
  onPress: () => void;
  liveEventCount?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * High-emphasis Sports Telemetry Team Card for Team #15996 BrickBot and search results.
 * Features 60fps UI-thread spring/timing interaction, signature yellow & warm-black borderless aesthetic,
 * high-contrast electric yellow badges with dark text, and WCAG 2.1 AA accessible touch targets.
 */
export function BrickBotTeamCard({
  team,
  onPress,
  liveEventCount = 0,
  style,
}: BrickBotTeamCardProps) {
  const { colors, typography, radius, shadows, spacing } = useAppTheme();
  const scale = useSharedValue(1);

  const animatedPressStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    scale.value = withTiming(0.98, { duration: 120 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 120 });
  };

  const seasonLabel = `${team.season} ${team.seasonName ? team.seasonName.toUpperCase() : 'DECODE'} SEASON`;
  const rookieLabel = `ROOKIE ${team.rookieYear}`;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`Select Team ${team.teamNumber} ${team.nameShort}`}
      accessibilityHint={`Opens 2025 season analytics, OPR, and schedule for ${team.nameShort}`}
      style={[
        styles.cardContainer,
        shadows.md,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.md,
        },
        animatedPressStyle,
        style,
      ]}
    >
      {/* Top Header Row with High-Contrast Badges */}
      <View style={styles.topRow}>
        <View style={styles.badgeGroup}>
          {/* Prominent Tabular BrickBot Team Number Badge */}
          <View
            style={[
              styles.numberBadge,
              {
                backgroundColor: colors.primary,
                borderRadius: radius.md,
              },
            ]}
          >
            <Text style={[typography.tabularNumber, styles.numberText, { color: colors.onPrimary }]}>
              #{team.teamNumber}
            </Text>
          </View>

          {/* Season Indicator */}
          <StatusBadge
            variant="gold"
            label={seasonLabel}
            size="sm"
          />

          {/* Rookie Year Badge */}
          <StatusBadge
            variant="neutral"
            label={rookieLabel}
            size="sm"
          />
        </View>

        {/* Live Active Match / Event Beacon */}
        {liveEventCount > 0 && (
          <StatusBadge
            variant="live"
            label={`${liveEventCount} LIVE`}
            pulsing
            size="sm"
          />
        )}
      </View>

      {/* Main Title Section */}
      <View style={[styles.mainSection, { marginVertical: spacing.sm }]}>
        <Text
          style={[
            typography.title,
            styles.teamNameShort,
            { color: colors.textPrimary },
          ]}
          numberOfLines={1}
        >
          {team.nameShort}
        </Text>
        <Text
          style={[
            typography.subhead,
            styles.teamNameFull,
            { color: colors.textSecondary },
          ]}
          numberOfLines={1}
        >
          {team.nameFull}
        </Text>
      </View>

      {/* Location Row */}
      <View style={[styles.locationRow, { gap: spacing.xs }]}>
        <AppIcon name="location" size={14} color={colors.textMuted} />
        <Text
          style={[
            typography.caption,
            styles.locationText,
            { color: colors.textMuted },
          ]}
          numberOfLines={1}
        >
          {team.displayLocation}
        </Text>
      </View>

      {/* Footer Action Bar with Guaranteed >= 48pt Touch Target */}
      <View
        style={[
          styles.footerBar,
          {
            marginTop: spacing.md,
            paddingTop: spacing.xs,
          },
        ]}
      >
        <Text
          style={[
            typography.caption,
            styles.footerActionText,
            { color: colors.textSecondary },
          ]}
        >
          View {team.season} Season Analytics, OPR & Live Schedule
        </Text>

        {/* Action Button: electric yellow fill, dark icon, small sharp radius, zero borders */}
        <View
          style={[
            styles.footerActionButton,
            {
              backgroundColor: colors.primary,
              borderRadius: radius.md,
            },
          ]}
        >
          <AppIcon name="chevron-right" size={14} color={colors.onPrimary} />
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    padding: 16,
    borderWidth: 0,
    borderCurve: 'continuous',
    minHeight: 140,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  numberBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 0,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  mainSection: {
    gap: 2,
  },
  teamNameShort: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  teamNameFull: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
  },
  footerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 0,
    minHeight: 48,
  },
  footerActionText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  footerActionButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 0,
    borderCurve: 'continuous',
  },
});
