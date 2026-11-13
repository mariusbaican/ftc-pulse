import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme';
import { useTeamSeasonSummary } from '@/hooks/use-ftc-api';
import { AppIcon } from '@/components/ui/icon';
import { TacticalRefreshScrollView } from '@/components/ui/tactical-refresh-scroll-view';
import { SeasonAnalyticsCards } from '@/components/team/season-analytics-cards';
import { EventSummaryCard } from '@/components/team/event-summary-card';
import { setTopBarTeamScrollState } from '@/components/navigation/top-bar';
import type { BestMatchPerformance, SeasonOption, SeasonSummaryResponse } from '@/types/api';

const DEFAULT_AVAILABLE_SEASONS: SeasonOption[] = [
  { season: 2026, seasonName: 'BIOBUZZ', shortName: 'Biobuzz', isLive: true, eventsCount: 4 },
  { season: 2025, seasonName: 'DECODE', shortName: 'Decode', isLive: false, eventsCount: 5 },
  { season: 2024, seasonName: 'INTO THE DEEP', shortName: 'Into The Deep', isLive: false, eventsCount: 4 },
  { season: 2023, seasonName: 'CENTERSTAGE', shortName: 'Centerstage', isLive: false, eventsCount: 4 },
  { season: 2022, seasonName: 'POWER PLAY', shortName: 'Power Play', isLive: false, eventsCount: 3 },
  { season: 2021, seasonName: 'FREIGHT FRENZY', shortName: 'Freight Frenzy', isLive: false, eventsCount: 3 },
  { season: 2020, seasonName: 'ULTIMATE GOAL', shortName: 'Ultimate Goal', isLive: false, eventsCount: 2 },
  { season: 2019, seasonName: 'SKYSTONE', shortName: 'Skystone', isLive: false, eventsCount: 3 },
  { season: 2018, seasonName: 'ROVER RUCKUS', shortName: 'Rover Ruckus', isLive: false, eventsCount: 2 },
];

/**
 * Strips any year range in parentheses from seasonName.
 * e.g. "BIOBUZZ (2026-2027)" -> "BIOBUZZ"
 */
function formatCleanSeasonName(name: string): string {
  return name.replace(/\s*\(.*?\)/g, '').trim();
}

/**
 * Formats relative timestamp cleanly without dates or clock times:
 * e.g. "Last updated just now", "Last updated 1 min ago", "Last updated X mins ago",
 * "Last updated 1 hr ago", "Last updated X hrs ago", "Last updated 1 day ago", "Last updated X days ago".
 */
export function formatRelativeUpdatedTime(
  isoString?: string | null,
  nowMs: number = Date.now()
): string {
  if (!isoString) {
    return 'Last updated just now';
  }
  const timestamp = new Date(isoString).getTime();
  if (isNaN(timestamp)) {
    return 'Last updated just now';
  }
  const diffMs = Math.max(0, nowMs - timestamp);
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return 'Last updated just now';
  }
  if (diffMinutes === 1) {
    return 'Last updated 1 min ago';
  }
  if (diffMinutes < 60) {
    return `Last updated ${diffMinutes} mins ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours === 1) {
    return 'Last updated 1 hr ago';
  }
  if (diffHours < 24) {
    return `Last updated ${diffHours} hrs ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) {
    return 'Last updated 1 day ago';
  }
  return `Last updated ${diffDays} days ago`;
}

export default function TeamHomeScreen() {
  const { teamNumber } = useLocalSearchParams<{ teamNumber: string }>();
  const numericTeamNumber = Number(teamNumber) || 15996;
  const { colors, typography, spacing, radius, shadows } = useAppTheme();

  // Selected season state (defaults to 2026 Biobuzz)
  const [selectedSeason, setSelectedSeason] = useState<number>(2026);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  // Tracking last refresh time and periodic relative time updates
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Palette tokens prioritizing sharp borderless styling with #FFFF00 highlights
  const yellowPrimary = colors.primary || '#FFFF00';
  const yellowOnPrimary = colors.onPrimary || '#0B0B05';
  const surfaceBg = colors.surface || '#15150B';
  const surfaceElevatedBg = colors.surfaceElevated || '#1F1F10';
  const canvasBg = colors.background || '#0B0B05';

  const { data, status, isLoading, isRefreshing, error, refetch } =
    useTeamSeasonSummary(numericTeamNumber, selectedSeason);

  // Immediate multi-season data resolution from cache or active query
  const activeSeasonData: SeasonSummaryResponse | null = useMemo(() => {
    if (data?.season === selectedSeason) {
      return data;
    }
    if (data?.seasonsByYear && data.seasonsByYear[String(selectedSeason)]) {
      return data.seasonsByYear[String(selectedSeason)];
    }
    return data;
  }, [data, selectedSeason]);

  // Keep lastRefreshedAt initialized from server/snapshot timestamp
  useEffect(() => {
    if (activeSeasonData?.lastUpdated && !lastRefreshedAt) {
      setLastRefreshedAt(activeSeasonData.lastUpdated);
    }
  }, [activeSeasonData?.lastUpdated, lastRefreshedAt]);

  // Re-calculate relative time every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const handleRefresh = async () => {
    try {
      await refetch();
    } finally {
      setLastRefreshedAt(new Date().toISOString());
      setNowMs(Date.now());
    }
  };

  const lastUpdatedLabel = useMemo(() => {
    return formatRelativeUpdatedTime(
      lastRefreshedAt || activeSeasonData?.lastUpdated,
      nowMs
    );
  }, [lastRefreshedAt, activeSeasonData?.lastUpdated, nowMs]);

  const availableSeasons: SeasonOption[] = useMemo(() => {
    if (data?.availableSeasons && data.availableSeasons.length > 0) {
      return data.availableSeasons;
    }
    return DEFAULT_AVAILABLE_SEASONS;
  }, [data?.availableSeasons]);

  const currentSeasonOption: SeasonOption = useMemo(() => {
    return (
      availableSeasons.find((s) => s.season === selectedSeason) ?? {
        season: selectedSeason,
        seasonName: selectedSeason === 2026 ? 'BIOBUZZ' : 'SEASON',
        isLive: selectedSeason === 2026,
      }
    );
  }, [availableSeasons, selectedSeason]);

  const teamName = numericTeamNumber === 15996 ? 'BrickBot' : 'Team';
  const teamSubtitle =
    numericTeamNumber === 15996
      ? 'Colegiul National Unirea'
      : 'FIRST Tech Challenge Competitor';
  const teamTitle = `${numericTeamNumber} - ${teamName}`;

  const identityCardBottomRef = useRef<number>(140);

  useEffect(() => {
    setTopBarTeamScrollState({
      scrolledPastTeamCard: false,
      teamNumber: numericTeamNumber,
      teamName,
    });
    return () => {
      setTopBarTeamScrollState({ scrolledPastTeamCard: false });
    };
  }, [numericTeamNumber, teamName]);

  const handleSelectEvent = (eventCode: string) => {
    router.push(`/teams/${numericTeamNumber}/events/${eventCode}`);
  };

  const handleSelectBestMatch = (bestMatch: BestMatchPerformance) => {
    router.push({
      pathname: `/teams/${numericTeamNumber}/events/${bestMatch.eventCode}` as any,
      params: {
        tab: 'schedule',
        highlightMatch: String(bestMatch.matchNumber),
        highlightLevel: bestMatch.tournamentLevel || 'QUAL',
        highlightMatchDesc: bestMatch.matchDescription || '',
      },
    });
  };

  const allEvents = useMemo(() => activeSeasonData?.events ?? [], [activeSeasonData?.events]);

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={[styles.container, { backgroundColor: canvasBg }]}
    >
      <Stack.Screen
        options={{
          title: `BrickBot #${numericTeamNumber}`,
          headerShown: false,
        }}
      />

      <TacticalRefreshScrollView
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          const passed = y > identityCardBottomRef.current - 10;
          setTopBarTeamScrollState({
            scrolledPastTeamCard: passed,
            teamNumber: numericTeamNumber,
            teamName,
          });
        }}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: spacing.base, paddingBottom: spacing.xxl },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <Text
          style={[
            typography.caption,
            styles.lastUpdatedText,
            { color: colors.textMuted, marginBottom: spacing.xs },
          ]}
        >
          {lastUpdatedLabel}
        </Text>

        {/* =========================================================================
            A. Team Identity Header Card (Sharp & Borderless)
           ========================================================================= */}
        <View
          onLayout={(e) => {
            identityCardBottomRef.current =
              e.nativeEvent.layout.y + e.nativeEvent.layout.height;
          }}
          style={[
            styles.identityCard,
            shadows.md,
            {
              backgroundColor: surfaceBg,
              borderRadius: radius.md,
              padding: spacing.base,
            },
          ]}
        >
          {/* Team Name and Number on One Line: {teamName} - {numericTeamNumber} */}
          <Text
            style={[
              typography.largeTitle,
              styles.teamTitle,
              { color: colors.textPrimary },
            ]}
          >
            {teamTitle}
          </Text>

          {/* 3 Clean, Compact Icon + Text Rows in the Exact Same Style */}
          <View style={[styles.metaRowsContainer, { marginTop: spacing.sm }]}>
            <View style={styles.metaRow}>
              <AppIcon name="location" size={14} color={yellowPrimary} style={styles.metaIcon} />
              <Text
                style={[
                  typography.subhead,
                  styles.metaRowText,
                  { color: colors.textSecondary },
                ]}
              >
                Focșani, VN, Romania
              </Text>
            </View>

            <View style={styles.metaRow}>
              <AppIcon name="shield" size={14} color={yellowPrimary} style={styles.metaIcon} />
              <Text
                style={[
                  typography.subhead,
                  styles.metaRowText,
                  { color: colors.textSecondary },
                ]}
              >
                {teamSubtitle}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <AppIcon name="calendar" size={14} color={yellowPrimary} style={styles.metaIcon} />
              <Text
                style={[
                  typography.subhead,
                  styles.metaRowText,
                  { color: colors.textSecondary },
                ]}
              >
                Rookie Year: 2018
              </Text>
            </View>
          </View>
        </View>

        {/* =======================================================================
            SEASON SELECTOR DROPDOWN MENU (Outside Team Box)
           ======================================================================= */}
        <View style={[styles.seasonSelectorContainer, { marginTop: spacing.md }]}>
          <Pressable
            onPress={() => setIsDropdownOpen((prev) => !prev)}
            style={({ pressed }) => [
              styles.seasonSelectorBox,
              {
                backgroundColor: surfaceElevatedBg,
                borderRadius: radius.sm,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
            accessibilityRole="combobox"
            accessibilityLabel={`Active Season: ${currentSeasonOption.season} ${formatCleanSeasonName(currentSeasonOption.seasonName)}. Tap to change season.`}
            accessibilityState={{ expanded: isDropdownOpen }}
          >
            <View style={styles.seasonSelectorLeft}>
              <Text
                style={[
                  typography.headline,
                  styles.activeSeasonName,
                  { color: colors.textPrimary },
                ]}
                numberOfLines={1}
              >
                {currentSeasonOption.season} — {formatCleanSeasonName(currentSeasonOption.seasonName)}
              </Text>
            </View>

            <View style={styles.seasonSelectorRight}>
              <AppIcon
                name="chevron-right"
                size={16}
                color={yellowPrimary}
                style={[
                  styles.dropdownChevron,
                  { transform: [{ rotate: isDropdownOpen ? '90deg' : '0deg' }] },
                ]}
              />
            </View>
          </Pressable>

          {/* Dropdown Options List */}
          {isDropdownOpen && (
            <View
              style={[
                styles.dropdownListContainer,
                {
                  backgroundColor: surfaceElevatedBg,
                  borderRadius: radius.sm,
                  marginTop: spacing.xs,
                  paddingVertical: spacing.xs,
                },
              ]}
            >
              {availableSeasons.map((item) => {
                const isSelected = item.season === selectedSeason;
                const cleanName = formatCleanSeasonName(item.seasonName);
                return (
                  <Pressable
                    key={item.season}
                    onPress={() => {
                      setSelectedSeason(item.season);
                      setIsDropdownOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.dropdownItem,
                      {
                        backgroundColor: isSelected ? surfaceBg : 'transparent',
                        borderRadius: radius.sm,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${item.season} ${cleanName}`}
                  >
                    <View style={styles.dropdownItemLeft}>
                      <Text
                        style={[
                          typography.subhead,
                          styles.dropdownItemText,
                          {
                            color: isSelected ? yellowPrimary : colors.textPrimary,
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {item.season} — {cleanName}
                      </Text>
                    </View>

                    {isSelected ? (
                      <AppIcon name="check-circle" size={16} color={yellowPrimary} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* =========================================================================
            Loading State
           ========================================================================= */}
        {isLoading && !activeSeasonData && (
          <View
            style={[
              styles.centerCard,
              {
                backgroundColor: surfaceBg,
                borderRadius: radius.md,
                padding: spacing.xl,
                marginTop: spacing.lg,
              },
            ]}
          >
            <ActivityIndicator size="large" color={yellowPrimary} />
            <Text
              style={[
                typography.headline,
                { color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' },
              ]}
            >
              Loading {currentSeasonOption.season} Telemetry for #{numericTeamNumber}...
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
        {status === 'error' && !activeSeasonData && (
          <View
            style={[
              styles.centerCard,
              {
                backgroundColor: surfaceBg,
                borderRadius: radius.md,
                padding: spacing.xl,
                marginTop: spacing.lg,
              },
            ]}
          >
            <AppIcon name="alert-circle" size={36} color={yellowPrimary} />
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
                `Failed to retrieve telemetry for team #${numericTeamNumber} in season ${currentSeasonOption.season}.`}
            </Text>
            <Pressable
              onPress={() => refetch()}
              style={({ pressed }) => [
                styles.retryButton,
                {
                  backgroundColor: yellowPrimary,
                  borderRadius: radius.sm,
                  marginTop: spacing.lg,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Retry loading season telemetry"
            >
              <Text style={[typography.headline, { color: yellowOnPrimary }]}>
                Retry Telemetry
              </Text>
            </Pressable>
          </View>
        )}

        {/* =========================================================================
            Empty State
           ========================================================================= */}
        {status === 'empty' && !isLoading && !activeSeasonData && (
          <View
            style={[
              styles.centerCard,
              {
                backgroundColor: surfaceBg,
                borderRadius: radius.md,
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
              No recorded events for team #{numericTeamNumber} in the {currentSeasonOption.season} season.
            </Text>
          </View>
        )}

        {/* =========================================================================
            Success State: Analytics & Tournament List
           ========================================================================= */}
        {activeSeasonData && (
          <View style={{ marginTop: spacing.lg }}>
            {/* -------------------------------------------------------------------
                B. Season Analytics Highlights (No Section Titles)
               ------------------------------------------------------------------- */}
            <SeasonAnalyticsCards
              summary={activeSeasonData}
              onSelectEvent={handleSelectEvent}
              onSelectBestMatch={handleSelectBestMatch}
            />

            {/* -------------------------------------------------------------------
                C. Events Section (Single Clean "Events" Title)
               ------------------------------------------------------------------- */}
            <Text
              style={[
                typography.title,
                styles.eventsTitle,
                { color: colors.textPrimary, marginTop: spacing.xl },
              ]}
            >
              Events
            </Text>

            {/* Tournament Event Cards List (All Events, No Filter Chip Bar) */}
            {allEvents.length === 0 ? (
              <View
                style={[
                  styles.centerCard,
                  {
                    backgroundColor: surfaceBg,
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
                  No Tournaments Found
                </Text>
                <Text
                  style={[
                    typography.body,
                    { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
                  ]}
                >
                  No recorded events for team #{numericTeamNumber} in the {currentSeasonOption.season} season.
                </Text>
              </View>
            ) : (
              <View style={[styles.eventListContainer, { marginTop: spacing.md }]}>
                {allEvents.map((eventItem, index) => (
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
      </TacticalRefreshScrollView>
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
  lastUpdatedText: {
    letterSpacing: 0.2,
  },
  identityCard: {
    borderWidth: 0,
  },
  teamTitle: {
    fontWeight: '800',
  },
  metaRowsContainer: {
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  metaIcon: {
    marginTop: 2,
    flexShrink: 0,
  },
  metaRowText: {
    lineHeight: 18,
    flex: 1,
    flexShrink: 1,
  },
  // Season Selector Dropdown
  seasonSelectorContainer: {
    width: '100%',
  },
  seasonSelectorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 0,
  },
  seasonSelectorLeft: {
    flex: 1,
    justifyContent: 'center',
  },
  activeSeasonName: {
    fontWeight: '700',
  },
  seasonSelectorRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropdownChevron: {
    marginLeft: 2,
  },
  dropdownListContainer: {
    width: '100%',
    borderWidth: 0,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 4,
    marginVertical: 2,
    borderWidth: 0,
  },
  dropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropdownItemText: {
    fontSize: 14,
  },
  // States & Layout
  centerCard: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
  },
  eventsTitle: {
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  eventListContainer: {
    gap: 12,
  },
});
