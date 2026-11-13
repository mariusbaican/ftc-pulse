import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
import { clearMockQueueAlert, triggerMockQueueAlert } from '@/services/api/endpoints';
import type {
  AllianceMember,
  EventMetadata,
  MatchItem,
  MatchTaskBreakdownSide,
  QueueAlert,
} from '@/types/api';

export interface MatchScheduleTabProps {
  event: EventMetadata;
  matches: MatchItem[];
  activeAlert?: QueueAlert | null;
  onWatchMatchVod: (match: MatchItem) => void;
  onAlertTriggered?: () => void;
  highlightMatchNumber?: number | null;
  highlightMatchDescription?: string | null;
  highlightTournamentLevel?: string | null;
  onRequestScrollToY?: (yOffsetWithinScheduleTab: number) => void;
  style?: StyleProp<ViewStyle>;
}

export function MatchScheduleTab({
  event,
  matches,
  activeAlert,
  onWatchMatchVod,
  onAlertTriggered,
  highlightMatchNumber,
  highlightMatchDescription,
  highlightTournamentLevel,
  onRequestScrollToY,
  style,
}: MatchScheduleTabProps) {
  const { colors, typography, spacing, radius, shadows } = useAppTheme();

  const [selectedMatchForBreakdown, setSelectedMatchForBreakdown] = useState<MatchItem | null>(null);
  const [isSimulatingGlobal, setIsSimulatingGlobal] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [telemetryNotice, setTelemetryNotice] = useState<string | null>(null);

  // Layout tracking refs for scrolling to target match
  const matchesContainerYRef = useRef<number>(0);
  const playoffSectionYRef = useRef<number>(0);
  const playoffListYRef = useRef<number>(0);
  const qualSectionYRef = useRef<number>(0);
  const qualListYRef = useRef<number>(0);
  const cardYMapRef = useRef<Record<string, number>>({});
  const hasScrolledTargetRef = useRef<string | null>(null);

  // Reset scroll latch when highlight target changes
  useEffect(() => {
    hasScrolledTargetRef.current = null;
  }, [highlightMatchNumber, highlightMatchDescription, highlightTournamentLevel]);

  // 1. Filter out practice matches
  const nonPracticeMatches = useMemo(() => {
    return (matches || []).filter((m) => {
      const level = (m.tournamentLevel || '').toUpperCase();
      const desc = (m.description || '').toUpperCase();
      return !level.includes('PRACTICE') && !desc.includes('PRACTICE');
    });
  }, [matches]);

  // 2. Split into Playoff matches & Qualification matches
  const playoffMatches = useMemo(() => {
    return nonPracticeMatches
      .filter((m) => !m.tournamentLevel?.toUpperCase().includes('QUAL'))
      .sort(
        (a, b) =>
          (a.series || 0) - (b.series || 0) || (a.matchNumber || 0) - (b.matchNumber || 0)
      );
  }, [nonPracticeMatches]);

  const qualMatches = useMemo(() => {
    return nonPracticeMatches
      .filter((m) => m.tournamentLevel?.toUpperCase().includes('QUAL'))
      .sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));
  }, [nonPracticeMatches]);

  // Match target verification helper
  const isTargetMatch = useCallback(
    (match: MatchItem) => {
      if (highlightMatchNumber == null && !highlightMatchDescription) return false;
      if (highlightMatchNumber != null && match.matchNumber === highlightMatchNumber) {
        if (highlightTournamentLevel) {
          return (match.tournamentLevel || '')
            .toUpperCase()
            .includes(highlightTournamentLevel.toUpperCase());
        }
        return true;
      }
      if (highlightMatchDescription) {
        const targetDesc = highlightMatchDescription.trim().toLowerCase();
        const mDesc = (match.description || '').trim().toLowerCase();
        if (mDesc && (mDesc === targetDesc || mDesc.includes(targetDesc) || targetDesc.includes(mDesc))) {
          return true;
        }
        const targetClean = targetDesc.replace(/^(match|qualification|qual|qm|q)\s*[-#]?/i, '').trim();
        const mClean = mDesc.replace(/^(match|qualification|qual|qm|q)\s*[-#]?/i, '').trim();
        if (targetClean && mClean && targetClean === mClean) {
          return true;
        }
        const parsed = parseInt(targetClean, 10);
        if (!isNaN(parsed) && match.matchNumber === parsed) {
          return true;
        }
      }
      return false;
    },
    [highlightMatchNumber, highlightMatchDescription, highlightTournamentLevel]
  );

  // Check and notify parent ScrollView to scroll to the target match card
  const checkAndNotifyScroll = useCallback(() => {
    if (!onRequestScrollToY) return;
    if (highlightMatchNumber == null && !highlightMatchDescription) return;

    const targetPlayoff = playoffMatches.find(isTargetMatch);
    const targetQual = qualMatches.find(isTargetMatch);
    const target = targetPlayoff || targetQual;
    if (!target) return;

    const targetKey = `${target.matchId}-${target.matchNumber}`;
    if (hasScrolledTargetRef.current === targetKey) return;

    const cardY = cardYMapRef.current[target.matchId];
    if (cardY == null) return;

    let totalY = matchesContainerYRef.current;
    if (targetPlayoff) {
      totalY += playoffSectionYRef.current + playoffListYRef.current + cardY;
    } else {
      totalY += qualSectionYRef.current + qualListYRef.current + cardY;
    }

    hasScrolledTargetRef.current = targetKey;
    onRequestScrollToY(totalY);
  }, [
    onRequestScrollToY,
    highlightMatchNumber,
    highlightMatchDescription,
    playoffMatches,
    qualMatches,
    isTargetMatch,
  ]);

  // Queue Simulation Handlers
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

  const isLiveSimulationEligible =
    event.code === '2025_mock_championship' || event.status === 'IN_PROGRESS';

  // Render alliance member team row (renderTeamPill)
  const renderAllianceMember = (
    member: AllianceMember,
    index: number,
    allianceColor: 'Red' | 'Blue',
    isWinner: boolean
  ) => {
    const isTarget = member.isTargetTeam || member.teamNumber === 15996;
    const didNotPlay = member.onField === false || member.noShow === true;
    const hasYellow = Boolean((member as any).yellowCard || (member as any).card === 'YELLOW');
    const hasRed = Boolean((member as any).redCard || (member as any).card === 'RED');

    const textColor = didNotPlay
      ? colors.textMuted
      : isTarget
      ? colors.primary
      : isWinner
      ? '#FFFFFF'
      : colors.textPrimary;

    const textWeight = didNotPlay
      ? '400'
      : isTarget
      ? '800'
      : isWinner
      ? '700'
      : '600';

    return (
      <View
        key={`${allianceColor}-${member.teamNumber}-${index}`}
        style={[
          styles.allianceMemberRow,
          {
            marginTop: index > 0 ? 2 : 1,
            opacity: didNotPlay ? 0.45 : 1,
          },
        ]}
      >
        <Text
          style={[
            typography.subhead,
            styles.teamNameText,
            {
              color: textColor,
              fontWeight: textWeight,
            },
          ]}
        >
          #{member.teamNumber}
        </Text>

        {hasYellow && (
          <View
            style={[styles.cardBadgeYellow, styles.teamCardBadge]}
            accessibilityLabel="Yellow Card"
          />
        )}
        {hasRed && (
          <View
            style={[styles.cardBadgeRed, styles.teamCardBadge]}
            accessibilityLabel="Red Card"
          />
        )}

        <Text
          style={[
            typography.subhead,
            styles.teamNameText,
            {
              color: textColor,
              fontWeight: textWeight,
              marginLeft: hasYellow || hasRed ? 2 : 4,
              flexShrink: 1,
            },
          ]}
          numberOfLines={1}
        >
          {member.teamName || (isTarget ? 'BrickBot' : '')}
        </Text>
      </View>
    );
  };

  // Render individual match card
  const renderMatchCard = (match: MatchItem) => {
    const isCompleted =
      match.status === 'COMPLETED' ||
      match.result === 'WIN' ||
      match.result === 'LOSS' ||
      match.result === 'TIE';

    const redScore = match.scoreRedFinal;
    const blueScore = match.scoreBlueFinal;

    const redWon = isCompleted && redScore != null && blueScore != null && redScore > blueScore;
    const blueWon = isCompleted && redScore != null && blueScore != null && blueScore > redScore;

    const hasVod = Boolean(match.vodUrl || event.liveStreamUrl);
    const isHighlighted = isTargetMatch(match);

    // Red Alliance styling
    const redBgColor = redWon
      ? '#DC2626'
      : colors.destructiveSoft || 'rgba(239, 68, 68, 0.16)';
    const redBorderColor = redWon ? '#FCA5A5' : '#EF4444';

    // Blue Alliance styling
    const blueBgColor = blueWon
      ? '#2563EB'
      : colors.allianceBlueSoft || 'rgba(59, 130, 246, 0.16)';
    const blueBorderColor = blueWon ? '#93C5FD' : '#3B82F6';

    return (
      <View
        key={match.matchId}
        onLayout={(e) => {
          cardYMapRef.current[match.matchId] = e.nativeEvent.layout.y;
          checkAndNotifyScroll();
        }}
      >
        <Pressable
          onPress={() => setSelectedMatchForBreakdown(match)}
          accessibilityRole="button"
          accessibilityLabel={`View detailed task breakdown for ${match.description || `Match ${match.matchNumber}`}`}
          style={({ pressed }) => [
            styles.matchCard,
            shadows.sm,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              padding: spacing.base,
              opacity: pressed ? 0.9 : 1,
              borderWidth: isHighlighted ? 1.5 : 0,
              borderColor: isHighlighted ? colors.primary : 'transparent',
            },
          ]}
        >
          {/* Top Row: Description, Field Pill, VOD Icon Button */}
          <View style={styles.matchTopRow}>
            <View style={styles.matchTitleGroup}>
              <Text
                style={[
                  typography.headline,
                  styles.matchTitleText,
                  { color: isHighlighted ? colors.primary : colors.textPrimary },
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
            </View>

            {/* VOD Action Button: Large boxless icon button */}
            {hasVod && (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  onWatchMatchVod(match);
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Watch VOD for ${match.description || `Match ${match.matchNumber}`}`}
                style={({ pressed }) => [
                  styles.vodIconButton,
                  {
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <AppIcon name="video" size={24} color={colors.primary} />
              </Pressable>
            )}
          </View>

          {/* Red vs. Blue Alliance Scoreboard Grid */}
          <View style={[styles.scoreboardGrid, { marginTop: spacing.sm }]}>
            {/* RED ALLIANCE BLOCK */}
            <View
              style={[
                styles.allianceBlock,
                {
                  backgroundColor: redBgColor,
                  borderLeftColor: redBorderColor,
                  borderLeftWidth: 3,
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
                      {
                        color: redWon ? '#FFFFFF' : '#EF4444',
                        fontWeight: '700',
                        fontSize: 10,
                        opacity: redWon ? 0.92 : 1,
                      },
                    ]}
                  >
                    RED ALLIANCE {redWon ? '• WINNER' : ''}
                  </Text>
                </View>
                {match.redAlliance.map((t, idx) =>
                  renderAllianceMember(t, idx, 'Red', redWon)
                )}
              </View>

              {redWon ? (
                <View style={styles.winningScoreBadge}>
                  <Text style={styles.winningScoreText}>
                    {redScore != null ? redScore : '—'}
                  </Text>
                </View>
              ) : (
                <View style={styles.losingScoreContainer}>
                  <Text
                    style={[
                      styles.losingScoreText,
                      { color: '#EF4444' },
                    ]}
                  >
                    {redScore != null ? redScore : '—'}
                  </Text>
                </View>
              )}
            </View>

            {/* BLUE ALLIANCE BLOCK */}
            <View
              style={[
                styles.allianceBlock,
                {
                  backgroundColor: blueBgColor,
                  borderLeftColor: blueBorderColor,
                  borderLeftWidth: 3,
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
                      {
                        color: blueWon ? '#FFFFFF' : '#3B82F6',
                        fontWeight: '700',
                        fontSize: 10,
                        opacity: blueWon ? 0.92 : 1,
                      },
                    ]}
                  >
                    BLUE ALLIANCE {blueWon ? '• WINNER' : ''}
                  </Text>
                </View>
                {match.blueAlliance.map((t, idx) =>
                  renderAllianceMember(t, idx, 'Blue', blueWon)
                )}
              </View>

              {blueWon ? (
                <View style={styles.winningScoreBadge}>
                  <Text style={styles.winningScoreText}>
                    {blueScore != null ? blueScore : '—'}
                  </Text>
                </View>
              ) : (
                <View style={styles.losingScoreContainer}>
                  <Text
                    style={[
                      styles.losingScoreText,
                      { color: '#3B82F6' },
                    ]}
                  >
                    {blueScore != null ? blueScore : '—'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Pressable>
      </View>
    );
  };

  // Detailed Game Task Breakdown Pop-up Modal Helper
  const renderBreakdownModal = () => {
    if (!selectedMatchForBreakdown) return null;

    const match = selectedMatchForBreakdown;
    const task = match.taskBreakdown;
    const period = match.periodBreakdown;

    const redTask: Partial<MatchTaskBreakdownSide> = task?.red || {};
    const blueTask: Partial<MatchTaskBreakdownSide> = task?.blue || {};

    const redAutoTotal = redTask.autoTotal ?? period?.red.auto ?? match.scoreRedAuto ?? 0;
    const blueAutoTotal = blueTask.autoTotal ?? period?.blue.auto ?? match.scoreBlueAuto ?? 0;

    const redTeleopTotal = redTask.teleopTotal ?? period?.red.teleop ?? 0;
    const blueTeleopTotal = blueTask.teleopTotal ?? period?.blue.teleop ?? 0;

    const redEndgameTotal = redTask.endgameBasePoints ?? period?.red.endgame ?? 0;
    const blueEndgameTotal = blueTask.endgameBasePoints ?? period?.blue.endgame ?? 0;

    const redFoulAwarded = redTask.foulPointsAwarded ?? period?.blue.foulCommitted ?? 0;
    const blueFoulAwarded = blueTask.foulPointsAwarded ?? period?.red.foulCommitted ?? 0;

    const redMinorPenalties = (redTask as any).opponentMinorFouls ?? blueTask.minorFouls ?? 0;
    const redMajorPenalties = (redTask as any).opponentMajorFouls ?? blueTask.majorFouls ?? 0;

    const blueMinorPenalties = (blueTask as any).opponentMinorFouls ?? redTask.minorFouls ?? 0;
    const blueMajorPenalties = (blueTask as any).opponentMajorFouls ?? redTask.majorFouls ?? 0;

    const redAllianceTeams = match.redAlliance || (match as any).redTeams || [];
    const blueAllianceTeams = match.blueAlliance || (match as any).blueTeams || [];

    const redYellowCards =
      (redTask as any).yellowCards ??
      (redTask as any).yellowCardCount ??
      redAllianceTeams.filter((t: any) => t.yellowCard || t.card === 'YELLOW').length;

    const redRedCards =
      (redTask as any).redCards ??
      (redTask as any).redCardCount ??
      redAllianceTeams.filter((t: any) => t.redCard || t.card === 'RED').length;

    const blueYellowCards =
      (blueTask as any).yellowCards ??
      (blueTask as any).yellowCardCount ??
      blueAllianceTeams.filter((t: any) => t.yellowCard || t.card === 'YELLOW').length;

    const blueRedCards =
      (blueTask as any).redCards ??
      (blueTask as any).redCardCount ??
      blueAllianceTeams.filter((t: any) => t.redCard || t.card === 'RED').length;

    const redNonPenalty =
      redTask.nonPenaltyTotal ?? Math.max(0, (match.scoreRedFinal ?? 0) - redFoulAwarded);
    const blueNonPenalty =
      blueTask.nonPenaltyTotal ?? Math.max(0, (match.scoreBlueFinal ?? 0) - blueFoulAwarded);

    const redFinal = redTask.totalScore ?? match.scoreRedFinal ?? 0;
    const blueFinal = blueTask.totalScore ?? match.scoreBlueFinal ?? 0;

    const renderCardSummary = (yellow: number, red: number) => {
      if (yellow === 0 && red === 0) {
        return (
          <Text
            style={[
              typography.caption,
              styles.modalColVal,
              styles.tabularText,
              { color: colors.textMuted, fontSize: 10, textAlign: 'right' },
            ]}
          >
            None
          </Text>
        );
      }

      return (
        <View style={styles.cardSummaryContainer}>
          {yellow > 0 && (
            <View style={styles.cardSummaryItem}>
              <View style={styles.cardBadgeYellow} />
              <Text
                style={[
                  typography.caption,
                  styles.tabularText,
                  { color: '#FACC15', fontWeight: '700', fontSize: 10 },
                ]}
              >
                {yellow}
              </Text>
            </View>
          )}
          {red > 0 && (
            <View style={styles.cardSummaryItem}>
              <View style={styles.cardBadgeRed} />
              <Text
                style={[
                  typography.caption,
                  styles.tabularText,
                  { color: '#EF4444', fontWeight: '700', fontSize: 10 },
                ]}
              >
                {red}
              </Text>
            </View>
          )}
        </View>
      );
    };

    const renderRow = (
      rowKey: string,
      label: string,
      redVal: string | number | React.ReactNode | undefined,
      blueVal: string | number | React.ReactNode | undefined,
      options?: { isHeader?: boolean; isTotal?: boolean; isIndented?: boolean }
    ) => {
      const isHeader = Boolean(options?.isHeader);
      const isTotal = Boolean(options?.isTotal);
      const isIndented = Boolean(options?.isIndented);

      return (
        <View
          key={rowKey}
          style={[
            styles.modalTableRow,
            isHeader && {
              backgroundColor: colors.surfaceElevated,
              marginTop: 2,
              borderRadius: 3,
            },
            isTotal && {
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.borderSubtle,
            },
          ]}
        >
          <Text
            style={[
              typography.caption,
              styles.modalColLabel,
              {
                color: isHeader
                  ? colors.primary
                  : isTotal
                  ? colors.textPrimary
                  : isIndented
                  ? colors.textMuted
                  : colors.textSecondary,
                fontWeight: isHeader || isTotal ? '700' : '500',
                fontSize: isIndented ? 10 : 10.5,
                paddingLeft: isIndented ? 10 : 0,
              },
            ]}
            numberOfLines={1}
          >
            {isIndented ? `↳ ${label}` : label}
          </Text>

          {React.isValidElement(redVal) ? (
            <View style={styles.modalColVal}>{redVal}</View>
          ) : (
            <Text
              style={[
                typography.caption,
                styles.modalColVal,
                styles.tabularText,
                {
                  color: isHeader || isTotal ? '#EF4444' : isIndented ? colors.textMuted : colors.textPrimary,
                  fontWeight: isHeader || isTotal ? '800' : isIndented ? '500' : '600',
                  fontSize: isIndented ? 10 : 10.5,
                },
              ]}
            >
              {redVal ?? '—'}
            </Text>
          )}

          {React.isValidElement(blueVal) ? (
            <View style={styles.modalColVal}>{blueVal}</View>
          ) : (
            <Text
              style={[
                typography.caption,
                styles.modalColVal,
                styles.tabularText,
                {
                  color: isHeader || isTotal ? '#3B82F6' : isIndented ? colors.textMuted : colors.textPrimary,
                  fontWeight: isHeader || isTotal ? '800' : isIndented ? '500' : '600',
                  fontSize: isIndented ? 10 : 10.5,
                },
              ]}
            >
              {blueVal ?? '—'}
            </Text>
          )}
        </View>
      );
    };

    return (
      <Modal
        visible={Boolean(selectedMatchForBreakdown)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMatchForBreakdown(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSelectedMatchForBreakdown(null)}
            accessibilityRole="button"
            accessibilityLabel="Close breakdown modal"
          />
          <View
            style={[
              styles.modalCard,
              shadows.lg,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                borderColor: colors.borderSubtle,
              },
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.headline, styles.modalTitleText, { color: colors.textPrimary }]}>
                  {match.description || `Match ${match.matchNumber}`}
                </Text>
                <Text style={[typography.caption, styles.modalSubtitleText, { color: colors.textSecondary }]}>
                  Game Task Score Breakdown
                </Text>
              </View>

              <Pressable
                onPress={() => setSelectedMatchForBreakdown(null)}
                style={({ pressed }) => [
                  styles.modalCloseButton,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderRadius: radius.sm,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close breakdown modal"
              >
                <AppIcon name="close" size={16} color={colors.textSecondary} />
              </Pressable>
            </View>

            {/* Score Banner (Red vs Blue) */}
            <View style={styles.modalScoreBanner}>
              <View
                style={[
                  styles.modalScoreSide,
                  { backgroundColor: 'rgba(239, 68, 68, 0.22)', borderLeftColor: '#EF4444', borderLeftWidth: 3 },
                ]}
              >
                <Text style={[typography.caption, { color: '#EF4444', fontWeight: '700', fontSize: 9 }]}>
                  RED ALLIANCE
                </Text>
                <Text style={[styles.modalBannerScore, { color: '#EF4444' }]}>
                  {match.scoreRedFinal ?? '—'}
                </Text>
              </View>

              <View
                style={[
                  styles.modalScoreSide,
                  { backgroundColor: 'rgba(59, 130, 246, 0.22)', borderLeftColor: '#3B82F6', borderLeftWidth: 3 },
                ]}
              >
                <Text style={[typography.caption, { color: '#3B82F6', fontWeight: '700', fontSize: 9 }]}>
                  BLUE ALLIANCE
                </Text>
                <Text style={[styles.modalBannerScore, { color: '#3B82F6' }]}>
                  {match.scoreBlueFinal ?? '—'}
                </Text>
              </View>
            </View>

            {/* Task Breakdown Table Content (Fits cleanly in one view without ScrollView) */}
            <View style={styles.modalTableContainer}>
              {/* Columns Header */}
              <View
                style={[
                  styles.modalTableRow,
                  {
                    backgroundColor: colors.surfaceElevated,
                    paddingVertical: 3,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.borderSubtle,
                  },
                ]}
              >
                <Text style={[typography.caption, styles.modalColLabel, { color: colors.textMuted, fontWeight: '700', fontSize: 10 }]}>
                  TASK / PERIOD
                </Text>
                <Text style={[typography.caption, styles.modalColVal, { color: '#EF4444', fontWeight: '700', fontSize: 10 }]}>
                  RED
                </Text>
                <Text style={[typography.caption, styles.modalColVal, { color: '#3B82F6', fontWeight: '700', fontSize: 10 }]}>
                  BLUE
                </Text>
              </View>

              {/* 1. AUTONOMOUS TASKS */}
              {renderRow('auto-header', 'AUTONOMOUS PERIOD', redAutoTotal, blueAutoTotal, { isHeader: true })}
              {renderRow('auto-r1', 'Robot 1 Leave', redTask.robot1Auto ? 'Yes' : 'No', blueTask.robot1Auto ? 'Yes' : 'No')}
              {renderRow('auto-r2', 'Robot 2 Leave', redTask.robot2Auto ? 'Yes' : 'No', blueTask.robot2Auto ? 'Yes' : 'No')}
              {renderRow('auto-leave', 'Leave Points', redTask.autoLeavePoints ?? 0, blueTask.autoLeavePoints ?? 0)}
              {renderRow('auto-artifacts', 'Artifact Points', redTask.autoArtifactPoints ?? 0, blueTask.autoArtifactPoints ?? 0)}
              {renderRow('auto-classified', 'Classified', redTask.autoClassifiedArtifacts ?? 0, blueTask.autoClassifiedArtifacts ?? 0, { isIndented: true })}
              {renderRow('auto-overflow', 'Overflow', redTask.autoOverflowArtifacts ?? 0, blueTask.autoOverflowArtifacts ?? 0, { isIndented: true })}
              {renderRow('auto-pattern', 'Pattern Points', redTask.autoPatternPoints ?? 0, blueTask.autoPatternPoints ?? 0)}

              {/* 2. TELEOP TASKS */}
              {renderRow('teleop-header', 'DRIVER TELEOP PERIOD', redTeleopTotal, blueTeleopTotal, { isHeader: true })}
              {renderRow('teleop-artifacts', 'Artifact Points', redTask.teleopArtifactPoints ?? 0, blueTask.teleopArtifactPoints ?? 0)}
              {renderRow('teleop-classified', 'Classified', redTask.teleopClassifiedArtifacts ?? 0, blueTask.teleopClassifiedArtifacts ?? 0, { isIndented: true })}
              {renderRow('teleop-overflow', 'Overflow', redTask.teleopOverflowArtifacts ?? 0, blueTask.teleopOverflowArtifacts ?? 0, { isIndented: true })}
              {renderRow('teleop-depot', 'Depot Points', redTask.teleopDepotPoints ?? 0, blueTask.teleopDepotPoints ?? 0)}
              {renderRow('teleop-pattern', 'Pattern Points', redTask.teleopPatternPoints ?? 0, blueTask.teleopPatternPoints ?? 0)}

              {/* 3. ENDGAME / BASE TASKS */}
              {renderRow('endgame-header', 'ENDGAME / BASE PERIOD', redEndgameTotal, blueEndgameTotal, { isHeader: true })}
              {renderRow('endgame-r1', 'Robot 1 Base', redTask.robot1Teleop || 'NONE', blueTask.robot1Teleop || 'NONE')}
              {renderRow('endgame-r2', 'Robot 2 Base', redTask.robot2Teleop || 'NONE', blueTask.robot2Teleop || 'NONE')}

              {/* 4. PENALTIES & FINAL SCORE */}
              {renderRow('penalties-header', 'PENALTIES AWARDED', redFoulAwarded, blueFoulAwarded, { isHeader: true })}
              {renderRow('penalties-minor', 'Minor Penalties', redMinorPenalties, blueMinorPenalties, { isIndented: true })}
              {renderRow('penalties-major', 'Major Penalties', redMajorPenalties, blueMajorPenalties, { isIndented: true })}
              {renderRow('penalties-cards', 'Yellow / Red Cards', renderCardSummary(redYellowCards, redRedCards), renderCardSummary(blueYellowCards, blueRedCards), { isIndented: true })}
              {renderRow('total-np', 'Non-Penalty Score (NP)', redNonPenalty, blueNonPenalty, { isTotal: true })}
              {renderRow('total-final', 'Final Score', redFinal, blueFinal, { isTotal: true })}
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const totalMatchesCount = playoffMatches.length + qualMatches.length;

  return (
    <View style={[styles.container, style]}>
      {/* ─────────────────────────────────────────────────────────────
          1. LIVE TOURNAMENT QUEUE CONTROL PANEL
         ───────────────────────────────────────────────────────────── */}
      {isLiveSimulationEligible && (
        <View
          style={[
            styles.controlPanelCard,
            shadows.sm,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              padding: spacing.base,
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
                borderRadius: radius.sm,
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
                  borderRadius: radius.sm,
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
                    borderRadius: radius.sm,
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
          2. CHRONOLOGICAL MATCH SCHEDULE (Playoffs FIRST, then Quals)
         ───────────────────────────────────────────────────────────── */}
      {totalMatchesCount === 0 ? (
        <View
          style={[
            styles.emptyStateCard,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.md,
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
            No qualification or playoff matches were found for this tournament.
          </Text>
        </View>
      ) : (
        <View
          style={{ gap: spacing.lg }}
          onLayout={(e) => {
            matchesContainerYRef.current = e.nativeEvent.layout.y;
            checkAndNotifyScroll();
          }}
        >
          {/* SECTION 1: Playoff Matches (Rendered FIRST) */}
          {playoffMatches.length > 0 && (
            <View
              style={{ gap: spacing.sm }}
              onLayout={(e) => {
                playoffSectionYRef.current = e.nativeEvent.layout.y;
                checkAndNotifyScroll();
              }}
            >
              <View style={styles.sectionHeaderRow}>
                <Text style={[typography.caption, { color: colors.primary, fontWeight: '800' }]}>
                  PLAYOFF MATCHES ({playoffMatches.length})
                </Text>
              </View>
              <View
                style={{ gap: spacing.md }}
                onLayout={(e) => {
                  playoffListYRef.current = e.nativeEvent.layout.y;
                  checkAndNotifyScroll();
                }}
              >
                {playoffMatches.map((match) => renderMatchCard(match))}
              </View>
            </View>
          )}

          {/* SECTION 2: Qualification Matches */}
          {qualMatches.length > 0 && (
            <View
              style={{ gap: spacing.sm }}
              onLayout={(e) => {
                qualSectionYRef.current = e.nativeEvent.layout.y;
                checkAndNotifyScroll();
              }}
            >
              <View style={styles.sectionHeaderRow}>
                <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '800' }]}>
                  QUALIFICATION MATCHES ({qualMatches.length})
                </Text>
              </View>
              <View
                style={{ gap: spacing.md }}
                onLayout={(e) => {
                  qualListYRef.current = e.nativeEvent.layout.y;
                  checkAndNotifyScroll();
                }}
              >
                {qualMatches.map((match) => renderMatchCard(match))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. DETAILED GAME TASK BREAKDOWN POP-UP MODAL
         ───────────────────────────────────────────────────────────── */}
      {renderBreakdownModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
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
  alertStatusPill: {},
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
    marginVertical: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 4,
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
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 6,
  },
  fieldPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  vodIconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
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
  allianceMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamNameText: {
    fontSize: 13,
  },
  cardBadgeYellow: {
    width: 8,
    height: 11,
    backgroundColor: '#FACC15',
    borderRadius: 1.5,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.3)',
  },
  cardBadgeRed: {
    width: 8,
    height: 11,
    backgroundColor: '#EF4444',
    borderRadius: 1.5,
    borderWidth: 0.5,
    borderColor: '#FFFFFF',
  },
  teamCardBadge: {
    marginLeft: 4,
    marginRight: 2,
  },
  allianceFinalScore: {
    fontSize: 22,
    fontWeight: '800',
    minWidth: 54,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  winningScoreBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  winningScoreText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  losingScoreContainer: {
    minWidth: 54,
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginRight: 4,
  },
  losingScoreText: {
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  // Pop-up Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  modalTitleText: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalSubtitleText: {
    fontSize: 10,
    marginTop: 1,
  },
  modalCloseButton: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScoreBanner: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 4,
  },
  modalScoreSide: {
    flex: 1,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  modalBannerScore: {
    fontSize: 16,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  modalTableContainer: {
    width: '100%',
  },
  modalTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 1.5,
    paddingHorizontal: 4,
  },
  modalColLabel: {
    flex: 1.6,
  },
  modalColVal: {
    flex: 1,
    textAlign: 'right',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  cardSummaryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  cardSummaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  tabularText: {
    fontVariant: ['tabular-nums'],
  },
});
