import React, { useMemo, useState } from 'react';
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
import { useTeamSeasonSummary } from '@/hooks/use-ftc-api';
import { AppIcon } from '@/components/ui/icon';
import { StatusBadge } from '@/components/ui/status-badge';
import { SeasonAnalyticsCards } from '@/components/team/season-analytics-cards';
import { EventSummaryCard } from '@/components/team/event-summary-card';
import type { EventSummaryItem } from '@/types/api';

export type EventFilterCategory = 'ALL' | 'LIVE' | 'CHAMPIONSHIPS' | 'LEAGUE';

interface FilterOption {
  key: EventFilterCategory;
  label: string;
}

export default function TeamHomeScreen() {
  const { teamNumber } = useLocalSearchParams<{ teamNumber: string }>();
  const numericTeamNumber = Number(teamNumber) || 15996;
  const { colors, typography, spacing, radius, shadows } = useAppTheme();

  const [activeFilter, setActiveFilter] = useState<EventFilterCategory>('ALL');

  const { data, status, isLoading, isRefreshing, error, refetch } =
    useTeamSeasonSummary(numericTeamNumber);

  const teamName = numericTeamNumber === 15996 ? 'BrickBot' : `Team #${numericTeamNumber}`;
  const teamSubtitle =
    numericTeamNumber === 15996
      ? 'Colegiul National Unirea'
      : 'FIRST Tech Challenge Competitor';

  const handleSelectEvent = (eventCode: string) => {
    router.push(`/teams/${numericTeamNumber}/events/${eventCode}`);
  };

  // Filter calculations
  const allEvents = useMemo(() => data?.events ?? [], [data?.events]);

  const liveCount = useMemo(
    () => allEvents.filter((ev) => ev.status === 'IN_PROGRESS').length,
    [allEvents]
  );

  const champCount = useMemo(
    () =>
      allEvents.filter(
        (ev) =>
          ev.typeName?.toLowerCase().includes('championship') ||
          ev.name?.toLowerCase().includes('championship')
      ).length,
    [allEvents]
  );

  const leagueCount = useMemo(
    () =>
      allEvents.filter(
        (ev) =>
          ev.typeName?.toLowerCase().includes('league') ||
          ev.name?.toLowerCase().includes('league') ||
          ev.typeName?.toLowerCase().includes('meet') ||
          ev.name?.toLowerCase().includes('meet')
      ).length,
    [allEvents]
  );

  const filterOptions: FilterOption[] = useMemo(
    () => [
      { key: 'ALL', label: `All (${allEvents.length})` },
      { key: 'LIVE', label: `Live Now (${liveCount})` },
      { key: 'CHAMPIONSHIPS', label: `Championships (${champCount})` },
      { key: 'LEAGUE', label: `League Events (${leagueCount})` },
    ],
    [allEvents.length, liveCount, champCount, leagueCount]
  );

  const filteredEvents: EventSummaryItem[] = useMemo(() => {
    switch (activeFilter) {
      case 'LIVE':
        return allEvents.filter((ev) => ev.status === 'IN_PROGRESS');
      case 'CHAMPIONSHIPS':
        return allEvents.filter(
          (ev) =>
            ev.typeName?.toLowerCase().includes('championship') ||
            ev.name?.toLowerCase().includes('championship')
        );
      case 'LEAGUE':
        return allEvents.filter(
          (ev) =>
            ev.typeName?.toLowerCase().includes('league') ||
            ev.name?.toLowerCase().includes('league') ||
            ev.typeName?.toLowerCase().includes('meet') ||
            ev.name?.toLowerCase().includes('meet')
        );
      case 'ALL':
      default:
        return allEvents;
    }
  }, [allEvents, activeFilter]);

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Stack.Screen
        options={{
          title: `BrickBot #${numericTeamNumber}`,
          headerShown: true,
          headerBackTitle: 'Search',
        }}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: spacing.base, paddingBottom: spacing.xxl },
        ]}
        contentInsetAdjustmentBehavior="automatic"
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
          accessibilityLabel="Back to Team Lookup"
          hitSlop={8}
        >
          <AppIcon
            name="chevron-right"
            size={14}
            color={colors.textSecondary}
            style={styles.backChevron}
          />
          <Text style={[typography.subhead, { color: colors.textSecondary }]}>
            Back to Team Lookup
          </Text>
        </Pressable>

        {/* =========================================================================
            A. Team Identity Header Card
           ========================================================================= */}
        <View
          style={[
            styles.identityCard,
            shadows.md,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: radius.lg,
              padding: spacing.base,
            },
          ]}
        >
          {/* Top Row Badges */}
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
                #{numericTeamNumber}
              </Text>
            </View>
            <StatusBadge variant="gold" label="2025 DECODE SEASON" />
            <StatusBadge variant="neutral" label="ROOKIE 2018" />
            {liveCount > 0 && (
              <StatusBadge variant="live" label={`${liveCount} LIVE EVENT`} pulsing />
            )}
          </View>

          {/* Team Name and Subtitle */}
          <Text
            style={[
              typography.largeTitle,
              { color: colors.textPrimary, marginTop: spacing.md },
            ]}
          >
            {teamName}
          </Text>
          <Text
            style={[
              typography.headline,
              { color: colors.textSecondary, marginTop: 2, fontWeight: '500' },
            ]}
          >
            {teamSubtitle}
          </Text>

          {/* Location Row */}
          <View style={[styles.locationRow, { marginTop: spacing.sm }]}>
            <AppIcon name="location" size={14} color={colors.textSecondary} />
            <Text
              style={[
                typography.subhead,
                { color: colors.textSecondary, marginLeft: spacing.xs },
              ]}
            >
              Focșani, VN, Romania • Home Region: RO
            </Text>
          </View>
        </View>

        {/* =========================================================================
            Loading State
           ========================================================================= */}
        {isLoading && !data && (
          <View
            style={[
              styles.centerCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: radius.lg,
                padding: spacing.xl,
                marginTop: spacing.lg,
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
              Loading Season Telemetry for #{numericTeamNumber}...
            </Text>
            <Text
              style={[
                typography.body,
                { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
              ]}
            >
              Processing OPR matrix, period splits, and tournament records.
            </Text>
          </View>
        )}

        {/* =========================================================================
            Error State
           ========================================================================= */}
        {status === 'error' && !data && (
          <View
            style={[
              styles.centerCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.primary,
                borderRadius: radius.lg,
                padding: spacing.xl,
                marginTop: spacing.lg,
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
              Season Telemetry Unavailable
            </Text>
            <Text
              style={[
                typography.body,
                { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
              ]}
            >
              {error?.message ||
                `Failed to retrieve season summary for team #${numericTeamNumber}.`}
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
              accessibilityLabel="Retry loading season telemetry"
            >
              <Text style={[typography.headline, { color: colors.onPrimary }]}>
                Retry Telemetry
              </Text>
            </Pressable>
          </View>
        )}

        {/* =========================================================================
            Empty State
           ========================================================================= */}
        {status === 'empty' && !isLoading && (
          <View
            style={[
              styles.centerCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: radius.lg,
                padding: spacing.xl,
                marginTop: spacing.lg,
              },
            ]}
          >
            <AppIcon name="calendar" size={32} color={colors.textMuted} />
            <Text
              style={[
                typography.title,
                { color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' },
              ]}
            >
              No Tournament Records Found
            </Text>
            <Text
              style={[
                typography.body,
                { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
              ]}
            >
              No recorded events for team #{numericTeamNumber} in the 2025 season.
            </Text>
          </View>
        )}

        {/* =========================================================================
            Success State: Analytics & Tournament List
           ========================================================================= */}
        {data && (
          <View style={{ marginTop: spacing.lg }}>
            {/* -------------------------------------------------------------------
                B. Season Analytics Highlights
               ------------------------------------------------------------------- */}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>
                  2025 SEASON ANALYTICS
                </Text>
                <Text style={[typography.title, { color: colors.textPrimary, marginTop: 2 }]}>
                  OPR & Performance Splits
                </Text>
              </View>
            </View>

            <View style={{ marginTop: spacing.sm }}>
              <SeasonAnalyticsCards summary={data} onSelectEvent={handleSelectEvent} />
            </View>

            {/* -------------------------------------------------------------------
                C. 2025 Season Tournaments Section
               ------------------------------------------------------------------- */}
            <View style={[styles.sectionHeaderRow, { marginTop: spacing.xl }]}>
              <View>
                <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>
                  2025 COMPETITIONS
                </Text>
                <Text style={[typography.title, { color: colors.textPrimary, marginTop: 2 }]}>
                  Season Tournaments
                </Text>
              </View>
              <StatusBadge
                variant="neutral"
                label={`${filteredEvents.length} ${filteredEvents.length === 1 ? 'EVENT' : 'EVENTS'}`}
              />
            </View>

            {/* Interactive Category Filter Bar */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.filterBar, { marginTop: spacing.md }]}
            >
              {filterOptions.map((filter) => {
                const isSelected = activeFilter === filter.key;
                return (
                  <Pressable
                    key={filter.key}
                    onPress={() => setActiveFilter(filter.key)}
                    style={({ pressed }) => [
                      styles.filterChip,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.card,
                        borderColor: isSelected ? colors.primary : colors.border,
                        borderRadius: radius.full,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Filter by ${filter.label}`}
                    hitSlop={6}
                  >
                    <Text
                      style={[
                        typography.subhead,
                        styles.filterChipText,
                        {
                          color: isSelected ? colors.onPrimary : colors.textSecondary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {filter.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Tournament Event Cards List */}
            {filteredEvents.length === 0 ? (
              <View
                style={[
                  styles.centerCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    padding: spacing.xl,
                    marginTop: spacing.md,
                  },
                ]}
              >
                <AppIcon name="calendar" size={28} color={colors.textMuted} />
                <Text
                  style={[
                    typography.headline,
                    { color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' },
                  ]}
                >
                  No Tournaments in this Category
                </Text>
                <Text
                  style={[
                    typography.body,
                    { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
                  ]}
                >
                  Try selecting "All ({allEvents.length})" to view all 2025 competitions.
                </Text>
                <Pressable
                  onPress={() => setActiveFilter('ALL')}
                  style={[
                    styles.resetFilterButton,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                      borderRadius: radius.sm,
                      marginTop: spacing.md,
                    },
                  ]}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Reset tournament filter to All"
                >
                  <Text style={[typography.subhead, { color: colors.textPrimary, fontWeight: '600' }]}>
                    Reset Filter to All
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={[styles.eventListContainer, { marginTop: spacing.md }]}>
                {filteredEvents.map((eventItem, index) => (
                  <EventSummaryCard
                    key={eventItem.eventCode}
                    event={eventItem}
                    index={index}
                    onPress={handleSelectEvent}
                  />
                ))}
              </View>
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
    flexGrow: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
    minHeight: 44,
  },
  backChevron: {
    transform: [{ rotate: '180deg' }],
    marginRight: 6,
  },
  identityCard: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  teamPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  teamPillText: {
    fontSize: 14,
    fontWeight: '800',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  centerCard: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  filterBar: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
  },
  eventListContainer: {
    gap: 12,
  },
  resetFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
