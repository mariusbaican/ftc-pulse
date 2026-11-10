import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme';
import { useEventDetails } from '@/hooks/use-ftc-api';
import { AppIcon } from '@/components/ui/icon';
import { StatusBadge, StatusBadgeVariant } from '@/components/ui/status-badge';
import type { EventStatus, MatchItem } from '@/types/api';

import { EventStatsTab } from '@/components/event/event-stats-tab';
import { MatchScheduleTab } from '@/components/event/match-schedule-tab';
import { VideoVodTab } from '@/components/event/video-vod-tab';

export type EventDetailTab = 'stats' | 'schedule' | 'vod';

export default function EventDetailScreen() {
  const { teamNumber, eventCode } = useLocalSearchParams<{
    teamNumber: string;
    eventCode: string;
  }>();
  const parsedTeamNumber = Number(teamNumber) || 15996;
  const targetEventCode = eventCode || '2025_mock_championship';

  const { colors, typography, spacing, radius, shadows } = useAppTheme();
  const { data, status, isLoading, isRefreshing, error, refetch } =
    useEventDetails(targetEventCode);

  const [activeTab, setActiveTab] = useState<EventDetailTab>('stats');
  const [selectedVodMatch, setSelectedVodMatch] = useState<MatchItem | null>(null);

  const handleJumpToMatchVod = useCallback((match: MatchItem) => {
    setSelectedVodMatch(match);
    setActiveTab('vod');
  }, []);

  const getStatusBadgeVariant = (eventStatus?: EventStatus): StatusBadgeVariant => {
    switch (eventStatus) {
      case 'IN_PROGRESS':
        return 'live';
      case 'COMPLETED':
        return 'success';
      case 'UPCOMING':
      default:
        return 'neutral';
    }
  };

  const getStatusLabel = (eventStatus?: EventStatus): string => {
    switch (eventStatus) {
      case 'IN_PROGRESS':
        return 'LIVE IN PROGRESS';
      case 'COMPLETED':
        return 'COMPLETED';
      case 'UPCOMING':
      default:
        return 'UPCOMING';
    }
  };

  const eventTitle = data?.event.name || String(eventCode || 'Tournament Telemetry');
  const matchCount = data?.matches?.length ?? 0;

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Stack.Screen
        options={{
          title: eventTitle,
          headerBackTitle: `Team #${parsedTeamNumber}`,
        }}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.base }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Navigation Breadcrumb / Return Pill */}
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: radius.full,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Back to Team #${parsedTeamNumber}`}
          hitSlop={8}
        >
          <AppIcon
            name="chevron-right"
            size={14}
            color={colors.textSecondary}
            style={styles.backChevron}
          />
          <Text style={[typography.subhead, { color: colors.textSecondary }]}>
            Back to Team #{parsedTeamNumber}
          </Text>
        </Pressable>

        {/* Loading State */}
        {isLoading && !data && (
          <View
            style={[
              styles.centerCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: radius.lg,
                padding: spacing.xl,
                marginTop: spacing.md,
              },
            ]}
          >
            <ActivityIndicator size="large" color={colors.primary} />
            <Text
              style={[
                typography.headline,
                { color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' },
              ]}
            >
              Loading Tournament Telemetry...
            </Text>
            <Text
              style={[
                typography.body,
                { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
              ]}
            >
              Fetching OPR stats, period breakdowns, match schedule, and live streams.
            </Text>
          </View>
        )}

        {/* Error State */}
        {status === 'error' && !data && (
          <View
            style={[
              styles.centerCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.primary,
                borderRadius: radius.lg,
                padding: spacing.xl,
                marginTop: spacing.md,
              },
            ]}
          >
            <AppIcon name="alert-circle" size={36} color={colors.primary} />
            <Text
              style={[
                typography.title,
                { color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' },
              ]}
            >
              Failed to Load Tournament
            </Text>
            <Text
              style={[
                typography.body,
                { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
              ]}
            >
              {error?.message || `Unable to retrieve tournament details for "${targetEventCode}".`}
            </Text>
            <Pressable
              onPress={() => refetch()}
              style={({ pressed }) => [
                styles.retryButton,
                {
                  backgroundColor: colors.primary,
                  borderRadius: radius.sm,
                  marginTop: spacing.lg,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Retry loading tournament telemetry"
            >
              <Text style={[typography.headline, { color: colors.onPrimary }]}>
                Retry Telemetry
              </Text>
            </Pressable>
          </View>
        )}

        {/* Populated State */}
        {data && (
          <View style={styles.dataContainer}>
            {/* Live Queue Alert Banner if present */}
            {data.activeAlert && (
              <View
                style={[
                  styles.alertCard,
                  shadows.md,
                  {
                    backgroundColor: colors.primarySoft,
                    borderColor: colors.primary,
                    borderRadius: radius.md,
                    padding: spacing.base,
                    marginBottom: spacing.md,
                  },
                ]}
              >
                <View style={styles.alertHeader}>
                  <View style={styles.alertTitleGroup}>
                    <AppIcon name="bell" size={18} color={colors.primary} />
                    <Text
                      style={[
                        typography.headline,
                        { color: colors.primary, marginLeft: spacing.xs },
                      ]}
                    >
                      {data.activeAlert.title}
                    </Text>
                  </View>
                  <StatusBadge variant="live" label="ALERT" pulsing size="sm" />
                </View>
                <Text
                  style={[
                    typography.body,
                    { color: colors.textPrimary, marginTop: spacing.xs, fontWeight: '600' },
                  ]}
                >
                  {data.activeAlert.message}
                </Text>
                <View style={[styles.metaRow, { marginTop: spacing.xs }]}>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    Field: {data.activeAlert.field} • Estimated: {data.activeAlert.estimatedTime}
                  </Text>
                </View>
              </View>
            )}

            {/* Compact Tournament Header Card */}
            <View
              style={[
                styles.heroCard,
                shadows.md,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: radius.lg,
                  padding: spacing.base,
                  marginBottom: spacing.md,
                },
              ]}
            >
              {/* Top Tag Badges */}
              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.teamPill,
                    { backgroundColor: colors.primary, borderRadius: radius.sm },
                  ]}
                >
                  <Text
                    style={[
                      typography.tabularNumber,
                      styles.teamPillText,
                      { color: colors.onPrimary },
                    ]}
                  >
                    #{parsedTeamNumber}
                  </Text>
                </View>
                <StatusBadge
                  variant={getStatusBadgeVariant(data.event.status)}
                  label={getStatusLabel(data.event.status)}
                  pulsing={data.event.status === 'IN_PROGRESS'}
                />
                <StatusBadge
                  variant="gold"
                  label={data.event.typeName || 'CHAMPIONSHIP'}
                />
              </View>

              {/* Tournament Title */}
              <Text
                style={[
                  typography.title,
                  { color: colors.textPrimary, marginTop: spacing.sm },
                ]}
              >
                {data.event.name}
              </Text>

              {/* Location & Venue */}
              <View style={[styles.infoRow, { marginTop: spacing.xs }]}>
                <AppIcon name="location" size={14} color={colors.textSecondary} />
                <Text
                  style={[
                    typography.body,
                    { color: colors.textSecondary, marginLeft: spacing.xs, flex: 1 },
                  ]}
                  numberOfLines={1}
                >
                  {data.event.venue ? `${data.event.venue} • ` : ''}
                  {data.event.city}, {data.event.country}
                </Text>
              </View>

              {/* Dates */}
              <View style={[styles.infoRow, { marginTop: spacing.xs }]}>
                <AppIcon name="calendar" size={14} color={colors.textMuted} />
                <Text
                  style={[
                    typography.caption,
                    { color: colors.textMuted, marginLeft: spacing.xs },
                  ]}
                >
                  {data.event.dateStart}
                  {data.event.dateEnd && data.event.dateEnd !== data.event.dateStart
                    ? ` – ${data.event.dateEnd}`
                    : ''}
                </Text>
              </View>
            </View>

            {/* Segmented 3-Tab Bar (animation: none per expo-animation peer tabs rule) */}
            <View
              style={[
                styles.tabBar,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  marginBottom: spacing.base,
                },
              ]}
              accessibilityRole="tablist"
            >
              {/* Tab 1: Event Stats */}
              <Pressable
                onPress={() => setActiveTab('stats')}
                style={({ pressed }) => [
                  styles.tabButton,
                  activeTab === 'stats' && [
                    styles.tabButtonActive,
                    shadows.sm,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ],
                  { opacity: pressed ? 0.8 : 1 },
                ]}
                accessibilityRole="tab"
                accessibilityLabel="Event Stats tab"
                accessibilityState={{ selected: activeTab === 'stats' }}
                hitSlop={4}
              >
                <AppIcon
                  name="chart"
                  size={16}
                  color={activeTab === 'stats' ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    typography.subhead,
                    {
                      color: activeTab === 'stats' ? colors.textPrimary : colors.textSecondary,
                      fontWeight: activeTab === 'stats' ? '700' : '500',
                      marginLeft: spacing.xs,
                    },
                  ]}
                >
                  Event Stats
                </Text>
              </Pressable>

              {/* Tab 2: Matches Schedule */}
              <Pressable
                onPress={() => setActiveTab('schedule')}
                style={({ pressed }) => [
                  styles.tabButton,
                  activeTab === 'schedule' && [
                    styles.tabButtonActive,
                    shadows.sm,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ],
                  { opacity: pressed ? 0.8 : 1 },
                ]}
                accessibilityRole="tab"
                accessibilityLabel={`Matches tab, ${matchCount} matches`}
                accessibilityState={{ selected: activeTab === 'schedule' }}
                hitSlop={4}
              >
                <AppIcon
                  name="calendar"
                  size={16}
                  color={activeTab === 'schedule' ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    typography.subhead,
                    {
                      color: activeTab === 'schedule' ? colors.textPrimary : colors.textSecondary,
                      fontWeight: activeTab === 'schedule' ? '700' : '500',
                      marginLeft: spacing.xs,
                    },
                  ]}
                >
                  Matches
                </Text>
                <View
                  style={[
                    styles.tabCountBadge,
                    {
                      backgroundColor:
                        activeTab === 'schedule' ? colors.primarySoft : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.caption,
                      styles.tabularNums,
                      {
                        color:
                          activeTab === 'schedule' ? colors.primary : colors.textSecondary,
                        fontWeight: '700',
                        fontSize: 11,
                      },
                    ]}
                  >
                    {matchCount}
                  </Text>
                </View>
              </Pressable>

              {/* Tab 3: Stream / VOD */}
              <Pressable
                onPress={() => setActiveTab('vod')}
                style={({ pressed }) => [
                  styles.tabButton,
                  activeTab === 'vod' && [
                    styles.tabButtonActive,
                    shadows.sm,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ],
                  { opacity: pressed ? 0.8 : 1 },
                ]}
                accessibilityRole="tab"
                accessibilityLabel="Stream and VOD tab"
                accessibilityState={{ selected: activeTab === 'vod' }}
                hitSlop={4}
              >
                <AppIcon
                  name="video"
                  size={16}
                  color={activeTab === 'vod' ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    typography.subhead,
                    {
                      color: activeTab === 'vod' ? colors.textPrimary : colors.textSecondary,
                      fontWeight: activeTab === 'vod' ? '700' : '500',
                      marginLeft: spacing.xs,
                    },
                  ]}
                >
                  Stream / VOD
                </Text>
              </Pressable>
            </View>

            {/* Modular Tab Content Panels */}
            {activeTab === 'stats' && (
              <EventStatsTab
                event={data.event}
                stats={data.stats}
                matches={data.matches}
                onSelectMatchForVod={handleJumpToMatchVod}
              />
            )}

            {activeTab === 'schedule' && (
              <MatchScheduleTab
                event={data.event}
                matches={data.matches}
                activeAlert={data.activeAlert}
                onWatchMatchVod={handleJumpToMatchVod}
                onAlertTriggered={refetch}
              />
            )}

            {activeTab === 'vod' && (
              <VideoVodTab
                event={data.event}
                matches={data.matches}
                selectedMatch={selectedVodMatch}
                onSelectMatch={setSelectedVodMatch}
              />
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 48,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  backChevron: {
    transform: [{ rotate: '180deg' }],
    marginRight: 6,
  },
  centerCard: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dataContainer: {
    width: '100%',
  },
  alertCard: {
    borderWidth: 1,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  alertTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  heroCard: {
    borderWidth: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  teamPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderWidth: 1,
    padding: 3,
    alignItems: 'center',
  },
  tabButton: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingHorizontal: 6,
  },
  tabButtonActive: {
    borderWidth: 1,
  },
  tabCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    marginLeft: 6,
  },
  tabularNums: {
    fontVariant: ['tabular-nums'],
  },
});
