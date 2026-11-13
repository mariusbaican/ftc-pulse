import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme';
import { useEventDetails } from '@/hooks/use-ftc-api';
import { AppIcon } from '@/components/ui/icon';
import { StatusBadge } from '@/components/ui/status-badge';
import { TacticalRefreshScrollView } from '@/components/ui/tactical-refresh-scroll-view';
import { formatNiceEventDateRange } from '@/utils/date-format';
import type { MatchItem } from '@/types/api';

import { EventStatsTab } from '@/components/event/event-stats-tab';
import { EventRankingsTab } from '@/components/event/event-rankings-tab';
import { MatchScheduleTab } from '@/components/event/match-schedule-tab';
import { EventTeamsTab } from '@/components/event/event-teams-tab';
import { VideoVodTab } from '@/components/event/video-vod-tab';

export type EventDetailTab = 'stats' | 'rankings' | 'schedule' | 'teams' | 'vod';

export default function EventDetailScreen() {
  const {
    teamNumber,
    eventCode,
    tab,
    highlightMatch,
    highlightMatchDesc,
    highlightLevel,
  } = useLocalSearchParams<{
    teamNumber: string;
    eventCode: string;
    tab?: string;
    highlightMatch?: string;
    highlightMatchDesc?: string;
    highlightLevel?: string;
  }>();
  const targetEventCode = eventCode || '2025_mock_championship';

  const insets = useSafeAreaInsets();
  const { colors, typography, spacing, radius, shadows } = useAppTheme();
  const { data, status, isLoading, isRefreshing, error, refetch } =
    useEventDetails(targetEventCode);

  const [activeTab, setActiveTab] = useState<EventDetailTab>(() => {
    if (tab === 'schedule' || tab === 'matches' || highlightMatch || highlightMatchDesc) {
      return 'schedule';
    }
    if (tab === 'rankings') return 'rankings';
    if (tab === 'teams') return 'teams';
    if (tab === 'vod') return 'vod';
    return 'stats';
  });

  const [selectedVodMatch, setSelectedVodMatch] = useState<MatchItem | null>(null);
  const [localHighlightMatchDesc, setLocalHighlightMatchDesc] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState<boolean>(false);

  const scrollViewRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const dataContainerYRef = useRef(0);
  const scheduleTabYRef = useRef(0);

  // Sync activeTab with route params if they update dynamically
  useEffect(() => {
    if (tab === 'schedule' || tab === 'matches' || highlightMatch || highlightMatchDesc) {
      setActiveTab('schedule');
    }
  }, [tab, highlightMatch, highlightMatchDesc]);

  // Hide persistent bottom bar when keyboard is up (e.g. searching rankings or teams)
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleJumpToMatchVod = useCallback((match: MatchItem) => {
    setSelectedVodMatch(match);
    setActiveTab('vod');
  }, []);

  const handleSelectHighScoreMatch = useCallback((matchDesc?: string) => {
    if (matchDesc) {
      setLocalHighlightMatchDesc(matchDesc);
    }
    setActiveTab('schedule');
  }, []);

  const handleRequestScrollToScheduleY = useCallback((yWithinTab: number) => {
    setTimeout(() => {
      const targetY = Math.max(
        0,
        dataContainerYRef.current + scheduleTabYRef.current + yWithinTab - 12
      );
      scrollViewRef.current?.scrollTo({
        y: targetY,
        animated: true,
      });
    }, 80);
  }, []);

  const matchCount = data?.matches?.length ?? 0;
  const teamCount = data?.teams?.length ?? data?.stats?.totalTeams ?? 0;
  const formattedDates = formatNiceEventDateRange(data?.event.dateStart, data?.event.dateEnd);

  return (
    <SafeAreaView
      edges={['left', 'right']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* UI #1: Set headerShown: false so only the TopBar back button is visible */}
      <Stack.Screen options={{ headerShown: false }} />

      <TacticalRefreshScrollView
        ref={scrollViewRef}
        refreshing={isRefreshing}
        onRefresh={refetch}
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            padding: spacing.base,
            paddingBottom: isKeyboardVisible ? 24 : 84 + insets.bottom,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Loading State */}
        {isLoading && !data && (
          <View
            style={[
              styles.centerCard,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.md,
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
              Fetching OPR stats, rankings, match schedule, and live streams.
            </Text>
          </View>
        )}

        {/* Error State */}
        {status === 'error' && !data && (
          <View
            style={[
              styles.centerCard,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.md,
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
          <View
            style={styles.dataContainer}
            onLayout={(e) => {
              dataContainerYRef.current = e.nativeEvent.layout.y;
            }}
          >
            {/* Live Queue Alert Banner if present */}
            {data.activeAlert && (
              <View
                style={[
                  styles.alertCard,
                  shadows.md,
                  {
                    backgroundColor: colors.primarySoft,
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
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  padding: spacing.base,
                  marginBottom: spacing.md,
                },
              ]}
            >
              {/* Top Tag Badges: Only LIVE IN PROGRESS and Tournament Type */}
              {(data.event.status === 'IN_PROGRESS' || Boolean(data.event.typeName)) && (
                <View style={styles.badgeRow}>
                  {data.event.status === 'IN_PROGRESS' && (
                    <StatusBadge
                      variant="live"
                      label="LIVE IN PROGRESS"
                      pulsing
                      size="sm"
                    />
                  )}
                  {Boolean(data.event.typeName) && (
                    <StatusBadge
                      variant="gold"
                      label={data.event.typeName}
                      size="sm"
                    />
                  )}
                </View>
              )}

              {/* Tournament Title */}
              <Text
                style={[
                  typography.title,
                  {
                    color: colors.textPrimary,
                    marginTop:
                      data.event.status === 'IN_PROGRESS' || data.event.typeName
                        ? spacing.xs
                        : 0,
                  },
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
                >
                  {data.event.venue ? `${data.event.venue} • ` : ''}
                  {data.event.city}, {data.event.country}
                </Text>
              </View>

              {/* Dates formatted nicely */}
              {formattedDates ? (
                <View style={[styles.infoRow, { marginTop: spacing.xs }]}>
                  <AppIcon name="calendar" size={14} color={colors.textMuted} />
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.textMuted, marginLeft: spacing.xs },
                    ]}
                  >
                    {formattedDates}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Modular Tab Content Panels (kept mounted with display: flex/none for instantaneous 0ms switching) */}
            <View style={{ display: activeTab === 'stats' ? 'flex' : 'none' }}>
              <EventStatsTab
                event={data.event}
                stats={data.stats}
                matches={data.matches}
                onSelectMatchForVod={handleJumpToMatchVod}
                onSelectHighScoreMatch={handleSelectHighScoreMatch}
                onNavigateToRankings={() => setActiveTab('rankings')}
              />
            </View>

            <View style={{ display: activeTab === 'rankings' ? 'flex' : 'none' }}>
              <EventRankingsTab
                rankings={data.rankings ?? []}
                hasQualMatches={data.event.hasQualMatches}
              />
            </View>

            <View
              style={{ display: activeTab === 'schedule' ? 'flex' : 'none' }}
              onLayout={(e) => {
                scheduleTabYRef.current = e.nativeEvent.layout.y;
              }}
            >
              <MatchScheduleTab
                event={data.event}
                matches={data.matches}
                activeAlert={data.activeAlert}
                onWatchMatchVod={handleJumpToMatchVod}
                onAlertTriggered={refetch}
                highlightMatchNumber={highlightMatch ? parseInt(highlightMatch, 10) : null}
                highlightMatchDescription={localHighlightMatchDesc || highlightMatchDesc || null}
                highlightTournamentLevel={highlightLevel || null}
                onRequestScrollToY={handleRequestScrollToScheduleY}
              />
            </View>

            <View style={{ display: activeTab === 'teams' ? 'flex' : 'none' }}>
              <EventTeamsTab teams={data.teams ?? []} />
            </View>

            {/* Video VOD Tab conditionally mounted so YouTube WebView only runs when active */}
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
      </TacticalRefreshScrollView>

      {/* ─────────────────────────────────────────────────────────────
          Persistent Bottom Navigation Bar (UI #19, Functional #4, #6)
          Hidden automatically when keyboard is visible
         ───────────────────────────────────────────────────────────── */}
      {!isKeyboardVisible && (
        <View
          style={[
            styles.bottomNavBar,
            shadows.lg,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.borderSubtle,
              paddingBottom: Math.max(insets.bottom, 8),
            },
          ]}
          accessibilityRole="tablist"
        >
          {/* Tab 1: Stats */}
          <Pressable
            onPress={() => setActiveTab('stats')}
            style={({ pressed }) => [
              styles.navTabButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
            accessibilityRole="tab"
            accessibilityLabel="Stats Tab"
            accessibilityState={{ selected: activeTab === 'stats' }}
            hitSlop={4}
          >
            <AppIcon
              name="chart"
              size={20}
              color={activeTab === 'stats' ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[
                styles.navTabLabel,
                {
                  color: activeTab === 'stats' ? colors.primary : colors.textSecondary,
                  fontWeight: activeTab === 'stats' ? '700' : '500',
                },
              ]}
            >
              Stats
            </Text>
          </Pressable>

          {/* Tab 2: Rankings */}
          <Pressable
            onPress={() => setActiveTab('rankings')}
            style={({ pressed }) => [
              styles.navTabButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
            accessibilityRole="tab"
            accessibilityLabel="Rankings Tab"
            accessibilityState={{ selected: activeTab === 'rankings' }}
            hitSlop={4}
          >
            <AppIcon
              name="trophy"
              size={20}
              color={activeTab === 'rankings' ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[
                styles.navTabLabel,
                {
                  color: activeTab === 'rankings' ? colors.primary : colors.textSecondary,
                  fontWeight: activeTab === 'rankings' ? '700' : '500',
                },
              ]}
            >
              Rankings
            </Text>
          </Pressable>

          {/* Tab 3: Matches */}
          <Pressable
            onPress={() => setActiveTab('schedule')}
            style={({ pressed }) => [
              styles.navTabButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
            accessibilityRole="tab"
            accessibilityLabel={`Matches Tab, ${matchCount} matches`}
            accessibilityState={{ selected: activeTab === 'schedule' }}
            hitSlop={4}
          >
            <View style={styles.tabIconWrapper}>
              <AppIcon
                name="calendar"
                size={20}
                color={activeTab === 'schedule' ? colors.primary : colors.textSecondary}
              />
              {matchCount > 0 && (
                <View
                  style={[
                    styles.tabDotBadge,
                    {
                      backgroundColor:
                        activeTab === 'schedule' ? colors.primary : colors.surfaceElevated,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabDotText,
                      {
                        color:
                          activeTab === 'schedule' ? colors.onPrimary : colors.textSecondary,
                      },
                    ]}
                  >
                    {matchCount}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.navTabLabel,
                {
                  color: activeTab === 'schedule' ? colors.primary : colors.textSecondary,
                  fontWeight: activeTab === 'schedule' ? '700' : '500',
                },
              ]}
            >
              Matches
            </Text>
          </Pressable>

          {/* Tab 4: Teams */}
          <Pressable
            onPress={() => setActiveTab('teams')}
            style={({ pressed }) => [
              styles.navTabButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
            accessibilityRole="tab"
            accessibilityLabel={`Teams Tab, ${teamCount} teams`}
            accessibilityState={{ selected: activeTab === 'teams' }}
            hitSlop={4}
          >
            <View style={styles.tabIconWrapper}>
              <AppIcon
                name="shield"
                size={20}
                color={activeTab === 'teams' ? colors.primary : colors.textSecondary}
              />
              {teamCount > 0 && (
                <View
                  style={[
                    styles.tabDotBadge,
                    {
                      backgroundColor:
                        activeTab === 'teams' ? colors.primary : colors.surfaceElevated,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabDotText,
                      {
                        color:
                          activeTab === 'teams' ? colors.onPrimary : colors.textSecondary,
                      },
                    ]}
                  >
                    {teamCount}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.navTabLabel,
                {
                  color: activeTab === 'teams' ? colors.primary : colors.textSecondary,
                  fontWeight: activeTab === 'teams' ? '700' : '500',
                },
              ]}
            >
              Teams
            </Text>
          </Pressable>

          {/* Tab 5: VOD */}
          <Pressable
            onPress={() => setActiveTab('vod')}
            style={({ pressed }) => [
              styles.navTabButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
            accessibilityRole="tab"
            accessibilityLabel="VOD Stream Tab"
            accessibilityState={{ selected: activeTab === 'vod' }}
            hitSlop={4}
          >
            <AppIcon
              name="video"
              size={20}
              color={activeTab === 'vod' ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[
                styles.navTabLabel,
                {
                  color: activeTab === 'vod' ? colors.primary : colors.textSecondary,
                  fontWeight: activeTab === 'vod' ? '700' : '500',
                },
              ]}
            >
              VOD
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    width: '100%',
  },
  centerCard: {
    alignItems: 'center',
    justifyContent: 'center',
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
  alertCard: {},
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
  heroCard: {},
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  navTabButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  navTabLabel: {
    fontSize: 11,
    marginTop: 3,
    letterSpacing: 0.2,
  },
  tabIconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabDotBadge: {
    position: 'absolute',
    top: -4,
    right: -12,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabDotText: {
    fontSize: 9,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
