import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { useAppTheme } from '@/theme';
import { AppIcon } from '@/components/ui/icon';
import { StatusBadge } from '@/components/ui/status-badge';
import { clearMockQueueAlert, triggerMockQueueAlert } from '@/services/api/endpoints';
import type { EventMetadata, MatchItem, QueueAlert } from '@/types/api';

export interface MatchScheduleTabProps {
  event: EventMetadata;
  matches: MatchItem[];
  activeAlert?: QueueAlert | null;
  onWatchMatchVod: (match: MatchItem) => void;
  onAlertTriggered?: () => void;
  style?: StyleProp<ViewStyle>;
}

export type FilterKey = 'ALL' | 'QUEUE' | 'COMPLETED' | 'WINS';

interface FilterChipOption {
  key: FilterKey;
  label: string;
}

/**
 * Formats seconds into MM:SS or HH:MM:SS format for video timestamps.
 * Examples:
 * - 120 -> "02:00"
 * - 420 -> "07:00"
 * - 3460 -> "57:40"
 * - 4400 -> "1:13:20"
 */
export function formatSeconds(seconds?: number | null): string {
  if (seconds == null || isNaN(seconds) || seconds < 0) {
    return '0:00';
  }
  const totalSecs = Math.floor(seconds);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const pad = (v: number) => v.toString().padStart(2, '0');

  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Modular Match Schedule Component for EventDetailScreen (Tab 2).
 * Follows PROJECT.md Section 4.C and ui-ux-pro-max guidelines:
 * - Filter & summary strip with count badges and minimum 40pt hit targets
 * - Interactive live tournament queue telemetry control panel for evaluator simulation
 * - Chronological match cards with Red vs Blue alliance scoreboard grid
 * - High-contrast #15996 BrickBot target badge highlighting
 * - 2025 period score breakdown bar (Auto, TeleOp, Endgame, Penalties)
 * - VOD launch and match-specific queue action buttons (>=44pt touch targets)
 */
export function MatchScheduleTab({
  event,
  matches,
  activeAlert,
  onWatchMatchVod,
  onAlertTriggered,
  style,
}: MatchScheduleTabProps) {
  const { colors, typography, spacing, radius, shadows } = useAppTheme();
  const reducedMotion = useReducedMotion();

  const [activeFilter, setActiveFilter] = useState<FilterKey>('ALL');
  const [isSimulatingGlobal, setIsSimulatingGlobal] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [queueingMatchId, setQueueingMatchId] = useState<string | null>(null);
  const [telemetryNotice, setTelemetryNotice] = useState<string | null>(null);

  // 1. Filter counts calculation
  const queuedOrUpcomingCount = useMemo(
    () => matches.filter((m) => m.status === 'QUEUED' || m.status === 'UPCOMING').length,
    [matches]
  );
  const completedCount = useMemo(
    () => matches.filter((m) => m.status === 'COMPLETED').length,
    [matches]
  );
  const winsCount = useMemo(
    () => matches.filter((m) => m.result === 'WIN').length,
    [matches]
  );

  const filterChips: FilterChipOption[] = useMemo(
    () => [
      { key: 'ALL', label: `All Matches (${matches.length})` },
      { key: 'QUEUE', label: `Queued / Upcoming (${queuedOrUpcomingCount})` },
      { key: 'COMPLETED', label: `Completed (${completedCount})` },
      { key: 'WINS', label: `Wins (${winsCount})` },
    ],
    [matches.length, queuedOrUpcomingCount, completedCount, winsCount]
  );

  // 2. Filter matches
  const filteredMatches = useMemo(() => {
    switch (activeFilter) {
      case 'QUEUE':
        return matches.filter((m) => m.status === 'QUEUED' || m.status === 'UPCOMING');
      case 'COMPLETED':
        return matches.filter((m) => m.status === 'COMPLETED');
      case 'WINS':
        return matches.filter((m) => m.result === 'WIN');
      case 'ALL':
      default:
        return matches;
    }
  }, [matches, activeFilter]);

  // 3. Queue Simulation Handlers
  const handleSimulateGlobalAlert = async () => {
    try {
      setIsSimulatingGlobal(true);
      setTelemetryNotice(null);
      await triggerMockQueueAlert({
        matchNumber: 'QM-12',
        field: 'Field 1',
        estimatedTime: '14:20',
        alliance: 'Red',
      });
      onAlertTriggered?.();
      setTelemetryNotice('Simulated queue alert dispatched: QM-12 • Field 1');
    } catch {
      setTelemetryNotice('Unable to simulate queue alert. Check server connection.');
    } finally {
      setIsSimulatingGlobal(false);
    }
  };

  const handleClearAlert = async () => {
    try {
      setIsClearing(true);
      setTelemetryNotice(null);
      await clearMockQueueAlert();
      onAlertTriggered?.();
      setTelemetryNotice('Active queue alert cleared.');
    } catch {
      setTelemetryNotice('Failed to clear queue alert.');
    } finally {
      setIsClearing(false);
    }
  };

  const handleQueueSpecificMatch = async (match: MatchItem) => {
    try {
      setQueueingMatchId(match.matchId);
      setTelemetryNotice(null);
      await triggerMockQueueAlert({
        matchNumber: `QM-${match.matchNumber}`,
        field: match.field || 'Field 1',
        estimatedTime: match.scheduledTime || '14:20',
        alliance: match.targetTeamAlliance || 'Red',
      });
      onAlertTriggered?.();
      setTelemetryNotice(`Queue alert queued for QM-${match.matchNumber}`);
    } catch {
      setTelemetryNotice(`Failed to queue QM-${match.matchNumber}`);
    } finally {
      setQueueingMatchId(null);
    }
  };

  const isLiveSimulationEligible =
    event.code === '2025_mock_championship' || event.status === 'IN_PROGRESS';

  return (
    <View style={[styles.container, style]}>
      {/* ─────────────────────────────────────────────────────────────
          1. FILTER & SUMMARY STRIP
         ───────────────────────────────────────────────────────────── */}
      <View style={styles.filterStripContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.filterStripContent, { gap: spacing.xs }]}
        >
          {filterChips.map((chip) => {
            const isSelected = activeFilter === chip.key;
            return (
              <Pressable
                key={chip.key}
                onPress={() => setActiveFilter(chip.key)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={chip.label}
                accessibilityState={{ selected: isSelected }}
                style={({ pressed }) => [
                  styles.filterChip,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.card,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderRadius: radius.full,
                    opacity: pressed ? 0.8 : 1,
                    paddingHorizontal: spacing.md,
                  },
                ]}
              >
                <Text
                  style={[
                    typography.caption,
                    styles.filterChipText,
                    {
                      color: isSelected ? colors.onPrimary : colors.textSecondary,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ─────────────────────────────────────────────────────────────
          2. LIVE TOURNAMENT QUEUE CONTROL PANEL
         ───────────────────────────────────────────────────────────── */}
      {isLiveSimulationEligible && (
        <View
          style={[
            styles.controlPanelCard,
            shadows.sm,
            {
              backgroundColor: colors.card,
              borderColor: activeAlert ? colors.primary : colors.border,
              borderWidth: activeAlert ? 1.5 : 1,
              borderRadius: radius.lg,
              padding: spacing.base,
              marginTop: spacing.sm,
              marginBottom: spacing.md,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.controlPanelHeader}>
            <View style={styles.controlTitleRow}>
              <AppIcon
                name="radio"
                size={18}
                color={activeAlert ? colors.primary : colors.statusLive}
              />
              <Text
                style={[
                  typography.headline,
                  { color: colors.textPrimary, marginLeft: spacing.xs },
                ]}
              >
                Live Tournament Queue Simulator
              </Text>
            </View>
            <StatusBadge
              variant={activeAlert ? 'live' : 'neutral'}
              label={activeAlert ? 'ALERT ACTIVE' : 'MONITORING'}
              pulsing={Boolean(activeAlert)}
              size="sm"
            />
          </View>

          <Text
            style={[
              typography.caption,
              { color: colors.textSecondary, marginTop: 4 },
            ]}
          >
            Direct mobile trigger simulating live Pit/Field announcer queue alerts forwarded to
            paired wearables.
          </Text>

          {/* Current Alert Status Bar */}
          <View
            style={[
              styles.alertStatusPill,
              {
                backgroundColor: activeAlert ? colors.primarySoft : colors.surfaceElevated,
                borderColor: activeAlert ? colors.primary : colors.borderSubtle,
                borderRadius: radius.md,
                padding: spacing.sm,
                marginTop: spacing.sm,
              },
            ]}
          >
            <View style={styles.alertStatusRow}>
              <AppIcon
                name={activeAlert ? 'bell' : 'clock'}
                size={14}
                color={activeAlert ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  typography.subhead,
                  styles.alertStatusText,
                  {
                    color: activeAlert ? colors.primary : colors.textMuted,
                    fontWeight: activeAlert ? '700' : '500',
                    marginLeft: spacing.xs,
                  },
                ]}
                numberOfLines={1}
              >
                {activeAlert
                  ? `ACTIVE ALERT: ${activeAlert.matchNumber} • ${activeAlert.field}`
                  : 'No Active Queue Alert'}
              </Text>
            </View>

            {activeAlert && (
              <View style={[styles.alertDetails, { marginTop: 4 }]}>
                <Text
                  style={[
                    typography.subhead,
                    { color: colors.textPrimary, fontWeight: '600' },
                  ]}
                  numberOfLines={2}
                >
                  {activeAlert.message}
                </Text>
                <Text
                  style={[
                    typography.caption,
                    { color: colors.textSecondary, marginTop: 2 },
                  ]}
                >
                  Estimated: {activeAlert.estimatedTime} • Alliance: {activeAlert.alliance}
                </Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={[styles.controlButtonsContainer, { marginTop: spacing.md, gap: spacing.sm }]}>
            <Pressable
              onPress={handleSimulateGlobalAlert}
              disabled={isSimulatingGlobal || isClearing}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Simulate Queue Alert QM-12 Field 1"
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: colors.primary,
                  borderRadius: radius.md,
                  opacity: pressed || isSimulatingGlobal ? 0.8 : 1,
                },
              ]}
            >
              {isSimulatingGlobal ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <View style={styles.buttonInner}>
                  <AppIcon name="bell" size={16} color={colors.onPrimary} />
                  <Text
                    style={[
                      typography.headline,
                      styles.buttonText,
                      { color: colors.onPrimary, marginLeft: spacing.xs },
                    ]}
                    numberOfLines={1}
                  >
                    Simulate Queue Alert (QM-12 • Field 1)
                  </Text>
                </View>
              )}
            </Pressable>

            {activeAlert && (
              <Pressable
                onPress={handleClearAlert}
                disabled={isSimulatingGlobal || isClearing}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Clear Active Alert"
                style={({ pressed }) => [
                  styles.clearButton,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.destructive,
                    borderRadius: radius.md,
                    opacity: pressed || isClearing ? 0.75 : 1,
                  },
                ]}
              >
                {isClearing ? (
                  <ActivityIndicator size="small" color={colors.destructive} />
                ) : (
                  <View style={styles.buttonInner}>
                    <AppIcon name="close" size={16} color={colors.destructive} />
                    <Text
                      style={[
                        typography.headline,
                        styles.buttonText,
                        { color: colors.destructive, marginLeft: spacing.xs },
                      ]}
                      numberOfLines={1}
                    >
                      Clear Alert
                    </Text>
                  </View>
                )}
              </Pressable>
            )}
          </View>

          {telemetryNotice && (
            <Text
              style={[
                typography.caption,
                { color: colors.statusLive, marginTop: spacing.xs, textAlign: 'center' },
              ]}
            >
              {telemetryNotice}
            </Text>
          )}
        </View>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. CHRONOLOGICAL MATCH CARDS LIST
         ───────────────────────────────────────────────────────────── */}
      {filteredMatches.length === 0 ? (
        <View
          style={[
            styles.emptyStateCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: radius.lg,
              padding: spacing.xl,
            },
          ]}
        >
          <AppIcon name="calendar" size={32} color={colors.textMuted} />
          <Text
            style={[
              typography.headline,
              { color: colors.textPrimary, marginTop: spacing.sm, textAlign: 'center' },
            ]}
          >
            No Matches Found
          </Text>
          <Text
            style={[
              typography.body,
              { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
            ]}
          >
            No matches matching filter &quot;{activeFilter}&quot; were found for this tournament.
          </Text>
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          {filteredMatches.map((match, idx) => {
            // Right Status Badge
            const renderStatusBadge = () => {
              if (match.status === 'QUEUED') {
                return <StatusBadge variant="live" label="QUEUED NOW" pulsing />;
              }
              if (match.status === 'UPCOMING') {
                return <StatusBadge variant="gold" label="UPCOMING" />;
              }
              if (match.result === 'WIN') {
                return <StatusBadge variant="success" label="VICTORY (WIN)" />;
              }
              if (match.result === 'LOSS') {
                return <StatusBadge variant="red" label="DEFEAT (LOSS)" />;
              }
              return <StatusBadge variant="neutral" label={match.result || 'PENDING'} />;
            };

            const staggeredDelay = Math.min(idx * 40, 240);

            return (
              <Animated.View
                key={match.matchId}
                entering={
                  reducedMotion
                    ? undefined
                    : FadeInDown.delay(staggeredDelay).duration(200)
                }
                style={[
                  styles.matchCard,
                  shadows.sm,
                  {
                    backgroundColor: colors.card,
                    borderColor: match.status === 'QUEUED' ? colors.statusLive : colors.border,
                    borderWidth: match.status === 'QUEUED' ? 1.5 : 1,
                    borderRadius: radius.lg,
                    padding: spacing.base,
                  },
                ]}
              >
                {/* ── Top Row: Title, Field Pill, Time, Status Badge ── */}
                <View style={styles.matchTopRow}>
                  <View style={styles.matchTitleGroup}>
                    <Text
                      style={[
                        typography.headline,
                        styles.matchTitleText,
                        { color: colors.textPrimary },
                      ]}
                      numberOfLines={1}
                    >
                      {match.description || `Qualification ${match.matchNumber}`}
                    </Text>

                    <View
                      style={[
                        styles.fieldPill,
                        {
                          backgroundColor: colors.surfaceElevated,
                          borderColor: colors.borderSubtle,
                          borderRadius: 4,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          typography.caption,
                          styles.fieldPillText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {match.field || 'Field 1'}
                      </Text>
                    </View>

                    {(match.scheduledTime || match.actualStartTime) && (
                      <View style={styles.timeTag}>
                        <AppIcon name="clock" size={12} color={colors.textMuted} />
                        <Text
                          style={[
                            typography.caption,
                            { color: colors.textMuted, marginLeft: 3 },
                          ]}
                        >
                          {match.scheduledTime ?? match.actualStartTime}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.statusBadgeWrapper}>{renderStatusBadge()}</View>
                </View>

                {/* ── Red vs. Blue Alliance Scoreboard Grid ── */}
                <View style={[styles.scoreboardGrid, { marginTop: spacing.sm }]}>
                  {/* RED ALLIANCE BLOCK */}
                  <View
                    style={[
                      styles.allianceBlock,
                      {
                        backgroundColor: colors.primarySoft,
                        borderLeftColor: colors.primary,
                        borderLeftWidth: 4,
                        borderRadius: radius.sm,
                        padding: spacing.sm,
                      },
                    ]}
                  >
                    <View style={styles.allianceTeamsCol}>
                      <View style={styles.allianceHeaderLabelRow}>
                        <Text
                          style={[
                            typography.caption,
                            { color: colors.primary, fontWeight: '700', fontSize: 10 },
                          ]}
                        >
                          RED ALLIANCE
                        </Text>
                      </View>
                      {match.redAlliance.map((t, teamIdx) => {
                        const isTarget = t.isTargetTeam || t.teamNumber === 15996;
                        return isTarget ? (
                          <View
                            key={`red-${t.teamNumber}-${teamIdx}`}
                            style={[
                              styles.targetTeamBadge,
                              {
                                backgroundColor: colors.primary,
                                borderRadius: 4,
                                marginTop: teamIdx > 0 ? 3 : 2,
                              },
                            ]}
                          >
                            <AppIcon name="shield" size={11} color="#FFFFFF" />
                            <Text
                              style={[
                                typography.caption,
                                styles.targetTeamBadgeText,
                                { color: '#FFFFFF' },
                              ]}
                              numberOfLines={1}
                            >
                              #{t.teamNumber} {t.teamName ? t.teamName.toUpperCase() : 'BRICKBOT'}
                            </Text>
                          </View>
                        ) : (
                          <Text
                            key={`red-${t.teamNumber}-${teamIdx}`}
                            style={[
                              typography.subhead,
                              styles.teamNameText,
                              { color: colors.textPrimary, marginTop: teamIdx > 0 ? 2 : 1 },
                            ]}
                            numberOfLines={1}
                          >
                            #{t.teamNumber} {t.teamName}
                          </Text>
                        );
                      })}
                    </View>

                    <Text
                      style={[
                        typography.tabularNumber,
                        styles.allianceFinalScore,
                        { color: colors.primary },
                      ]}
                    >
                      {match.scoreRedFinal != null ? match.scoreRedFinal : '—'}
                    </Text>
                  </View>

                  {/* BLUE ALLIANCE BLOCK */}
                  <View
                    style={[
                      styles.allianceBlock,
                      {
                        backgroundColor: colors.allianceBlueSoft,
                        borderLeftColor: colors.allianceBlue,
                        borderLeftWidth: 4,
                        borderRadius: radius.sm,
                        padding: spacing.sm,
                        marginTop: spacing.xs,
                      },
                    ]}
                  >
                    <View style={styles.allianceTeamsCol}>
                      <View style={styles.allianceHeaderLabelRow}>
                        <Text
                          style={[
                            typography.caption,
                            { color: colors.allianceBlue, fontWeight: '700', fontSize: 10 },
                          ]}
                        >
                          BLUE ALLIANCE
                        </Text>
                      </View>
                      {match.blueAlliance.map((t, teamIdx) => {
                        const isTarget = t.isTargetTeam || t.teamNumber === 15996;
                        return isTarget ? (
                          <View
                            key={`blue-${t.teamNumber}-${teamIdx}`}
                            style={[
                              styles.targetTeamBadge,
                              {
                                backgroundColor: colors.allianceBlue,
                                borderRadius: 4,
                                marginTop: teamIdx > 0 ? 3 : 2,
                              },
                            ]}
                          >
                            <AppIcon name="shield" size={11} color="#FFFFFF" />
                            <Text
                              style={[
                                typography.caption,
                                styles.targetTeamBadgeText,
                                { color: '#FFFFFF' },
                              ]}
                              numberOfLines={1}
                            >
                              #{t.teamNumber} {t.teamName ? t.teamName.toUpperCase() : 'BRICKBOT'}
                            </Text>
                          </View>
                        ) : (
                          <Text
                            key={`blue-${t.teamNumber}-${teamIdx}`}
                            style={[
                              typography.subhead,
                              styles.teamNameText,
                              { color: colors.textPrimary, marginTop: teamIdx > 0 ? 2 : 1 },
                            ]}
                            numberOfLines={1}
                          >
                            #{t.teamNumber} {t.teamName}
                          </Text>
                        );
                      })}
                    </View>

                    <Text
                      style={[
                        typography.tabularNumber,
                        styles.allianceFinalScore,
                        { color: colors.allianceBlue },
                      ]}
                    >
                      {match.scoreBlueFinal != null ? match.scoreBlueFinal : '—'}
                    </Text>
                  </View>
                </View>

                {/* ── 2025 Period Score Breakdown Bar (when available) ── */}
                {match.periodBreakdown && (
                  <View
                    style={[
                      styles.breakdownContainer,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderColor: colors.borderSubtle,
                        borderRadius: radius.sm,
                        padding: spacing.xs,
                        marginTop: spacing.sm,
                      },
                    ]}
                  >
                    <View style={styles.breakdownHeaderRow}>
                      <Text
                        style={[
                          typography.caption,
                          {
                            color: colors.textMuted,
                            fontSize: 10,
                            letterSpacing: 0.5,
                            fontWeight: '700',
                          },
                        ]}
                      >
                        2025 PERIOD SCORING (RED : BLUE)
                      </Text>
                    </View>

                    <View style={styles.breakdownColumnsRow}>
                      {/* Auto */}
                      <View style={styles.breakdownCol}>
                        <Text
                          style={[
                            typography.caption,
                            styles.breakdownMetricLabel,
                            { color: colors.textSecondary },
                          ]}
                        >
                          Auto
                        </Text>
                        <Text style={[typography.tabularNumber, styles.breakdownScoreSplit]}>
                          <Text style={{ color: colors.primary, fontWeight: '700' }}>
                            {match.periodBreakdown.red.auto}
                          </Text>
                          <Text style={{ color: colors.textMuted }}> : </Text>
                          <Text style={{ color: colors.allianceBlue, fontWeight: '700' }}>
                            {match.periodBreakdown.blue.auto}
                          </Text>
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.breakdownDivider,
                          { backgroundColor: colors.borderSubtle },
                        ]}
                      />

                      {/* TeleOp */}
                      <View style={styles.breakdownCol}>
                        <Text
                          style={[
                            typography.caption,
                            styles.breakdownMetricLabel,
                            { color: colors.textSecondary },
                          ]}
                        >
                          TeleOp
                        </Text>
                        <Text style={[typography.tabularNumber, styles.breakdownScoreSplit]}>
                          <Text style={{ color: colors.primary, fontWeight: '700' }}>
                            {match.periodBreakdown.red.teleop}
                          </Text>
                          <Text style={{ color: colors.textMuted }}> : </Text>
                          <Text style={{ color: colors.allianceBlue, fontWeight: '700' }}>
                            {match.periodBreakdown.blue.teleop}
                          </Text>
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.breakdownDivider,
                          { backgroundColor: colors.borderSubtle },
                        ]}
                      />

                      {/* Endgame */}
                      <View style={styles.breakdownCol}>
                        <Text
                          style={[
                            typography.caption,
                            styles.breakdownMetricLabel,
                            { color: colors.textSecondary },
                          ]}
                        >
                          Endgame
                        </Text>
                        <Text style={[typography.tabularNumber, styles.breakdownScoreSplit]}>
                          <Text style={{ color: colors.primary, fontWeight: '700' }}>
                            {match.periodBreakdown.red.endgame}
                          </Text>
                          <Text style={{ color: colors.textMuted }}> : </Text>
                          <Text style={{ color: colors.allianceBlue, fontWeight: '700' }}>
                            {match.periodBreakdown.blue.endgame}
                          </Text>
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.breakdownDivider,
                          { backgroundColor: colors.borderSubtle },
                        ]}
                      />

                      {/* Penalties */}
                      <View style={styles.breakdownCol}>
                        <Text
                          style={[
                            typography.caption,
                            styles.breakdownMetricLabel,
                            { color: colors.textSecondary },
                          ]}
                        >
                          Penalties
                        </Text>
                        <Text style={[typography.tabularNumber, styles.breakdownScoreSplit]}>
                          <Text style={{ color: colors.primary, fontWeight: '700' }}>
                            {match.periodBreakdown.red.foulCommitted}
                          </Text>
                          <Text style={{ color: colors.textMuted }}> : </Text>
                          <Text style={{ color: colors.allianceBlue, fontWeight: '700' }}>
                            {match.periodBreakdown.blue.foulCommitted}
                          </Text>
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* ── Card Footer Actions: Watch VOD & Queue This Match ── */}
                <View
                  style={[
                    styles.cardFooterActionsRow,
                    { marginTop: spacing.sm, gap: spacing.sm },
                  ]}
                >
                  {/* Button 1: Watch VOD */}
                  <Pressable
                    onPress={() => onWatchMatchVod(match)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`Watch VOD for ${match.description} at timestamp ${formatSeconds(match.vodTimestampSeconds)}`}
                    style={({ pressed }) => [
                      styles.footerActionButton,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderColor: colors.border,
                        borderRadius: radius.md,
                        opacity: pressed ? 0.75 : 1,
                        flex: 1,
                      },
                    ]}
                  >
                    <AppIcon name="video" size={16} color={colors.primary} />
                    <Text
                      style={[
                        typography.headline,
                        styles.footerButtonText,
                        { color: colors.textPrimary, marginLeft: spacing.xs },
                      ]}
                      numberOfLines={1}
                    >
                      {match.vodTimestampSeconds != null
                        ? `Watch VOD (${formatSeconds(match.vodTimestampSeconds)})`
                        : 'Watch VOD'}
                    </Text>
                  </Pressable>

                  {/* Button 2: Queue This Match (mock tournament & not completed) */}
                  {event.code === '2025_mock_championship' &&
                    match.status !== 'COMPLETED' && (
                      <Pressable
                        onPress={() => handleQueueSpecificMatch(match)}
                        disabled={queueingMatchId === match.matchId}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={`Queue Qualification Match ${match.matchNumber}`}
                        style={({ pressed }) => [
                          styles.footerActionButton,
                          {
                            backgroundColor: colors.primarySoft,
                            borderColor: colors.primary,
                            borderRadius: radius.md,
                            opacity:
                              pressed || queueingMatchId === match.matchId ? 0.75 : 1,
                            flex: 1,
                          },
                        ]}
                      >
                        {queueingMatchId === match.matchId ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <>
                            <AppIcon name="bell" size={16} color={colors.primary} />
                            <Text
                              style={[
                                typography.headline,
                                styles.footerButtonText,
                                {
                                  color: colors.primary,
                                  marginLeft: spacing.xs,
                                  fontWeight: '700',
                                },
                              ]}
                              numberOfLines={1}
                            >
                              Queue This Match
                            </Text>
                          </>
                        )}
                      </Pressable>
                    )}
                </View>
              </Animated.View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  filterStripContainer: {
    width: '100%',
    marginBottom: 4,
  },
  filterStripContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  filterChip: {
    minHeight: 40,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipText: {
    fontSize: 13,
  },
  controlPanelCard: {
    width: '100%',
  },
  controlPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  alertStatusPill: {
    borderWidth: 1,
  },
  alertStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertStatusText: {
    fontSize: 13,
  },
  alertDetails: {
    marginTop: 4,
  },
  controlButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryButton: {
    minHeight: 44,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  clearButton: {
    minHeight: 44,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyStateCard: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginVertical: 12,
  },
  matchCard: {
    width: '100%',
  },
  matchTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  matchTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
    marginRight: 8,
  },
  matchTitleText: {
    fontSize: 15,
    marginRight: 6,
  },
  fieldPill: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 6,
  },
  fieldPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadgeWrapper: {
    alignItems: 'flex-end',
  },
  scoreboardGrid: {
    width: '100%',
  },
  allianceBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  allianceTeamsCol: {
    flex: 1,
    marginRight: 8,
  },
  allianceHeaderLabelRow: {
    marginBottom: 2,
  },
  teamNameText: {
    fontSize: 13,
  },
  targetTeamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  targetTeamBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 4,
    letterSpacing: 0.3,
  },
  allianceFinalScore: {
    fontSize: 24,
    fontWeight: '800',
    minWidth: 48,
    textAlign: 'right',
  },
  breakdownContainer: {
    borderWidth: 1,
  },
  breakdownHeaderRow: {
    marginBottom: 4,
  },
  breakdownColumnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  breakdownCol: {
    flex: 1,
    alignItems: 'center',
  },
  breakdownMetricLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  breakdownScoreSplit: {
    fontSize: 12,
    marginTop: 2,
  },
  breakdownDivider: {
    width: 1,
    height: 20,
  },
  cardFooterActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerActionButton: {
    minHeight: 44,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  footerButtonText: {
    fontSize: 13,
  },
});
