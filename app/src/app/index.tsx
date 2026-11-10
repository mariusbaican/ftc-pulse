import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme';
import { useServerHealth, useTeamSearch } from '@/hooks/use-ftc-api';
import { apiClient } from '@/services/api/client';
import { AppIcon } from '@/components/ui/icon';
import { StatusBadge } from '@/components/ui/status-badge';
import { BrickBotTeamCard } from '@/components/search/brickbot-team-card';
import type { TeamProfile } from '@/types/api';

interface QuickFilterOption {
  label: string;
  value: string;
  accessibilityHint: string;
}

const QUICK_FILTERS: QuickFilterOption[] = [
  { label: '#15996', value: '15996', accessibilityHint: 'Search for BrickBot team number 15996' },
  { label: 'BrickBot', value: 'BrickBot', accessibilityHint: 'Search for BrickBot by team name' },
  {
    label: 'Test Unhosted Team (#11111)',
    value: '11111',
    accessibilityHint: 'Filter by non-hosted team 11111 to test the PoC empty state message',
  },
  { label: 'Show Default', value: '', accessibilityHint: 'Clear search filter to view default BrickBot' },
];

export default function TeamSearchScreen() {
  const [query, setQuery] = useState('');
  const { colors, typography, spacing, radius, shadows } = useAppTheme();

  const { data: healthData, status: healthStatus } = useServerHealth();
  const { data, status, isLoading, isRefreshing, error, refetch } = useTeamSearch(query);

  const team: TeamProfile | undefined = data?.teams?.[0];

  const getHealthBadgeConfig = () => {
    if (healthStatus === 'loading') {
      return {
        label: 'CONNECTING...',
        variant: 'neutral' as const,
        pulsing: false,
      };
    }
    if (healthStatus === 'success') {
      const sourceLabel =
        healthData?.dataSource === 'live_api' ? 'LIVE FTC API' : '2025 SNAPSHOT';
      return {
        label: `API ONLINE • ${sourceLabel}`,
        variant: 'live' as const,
        pulsing: true,
      };
    }
    return {
      label: 'API OFFLINE',
      variant: 'red' as const,
      pulsing: false,
    };
  };

  const healthConfig = getHealthBadgeConfig();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }]}
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
        {/* Top Telemetry Header */}
        <View style={styles.headerContainer}>
          <View style={styles.telemetryBadgeRow}>
            <View
              style={[
                styles.brandBadge,
                {
                  backgroundColor: colors.primarySoft,
                  borderColor: colors.primary,
                  borderRadius: radius.full,
                },
              ]}
            >
              <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>
                FTC PULSE • 2025 DECODE
              </Text>
            </View>

            <StatusBadge
              label={healthConfig.label}
              variant={healthConfig.variant}
              pulsing={healthConfig.pulsing}
            />
          </View>

          <Text style={[typography.hero, styles.headerTitle, { color: colors.textPrimary, marginTop: spacing.sm }]}>
            Team Intelligence &amp; Live Companion
          </Text>
          <Text style={[typography.body, styles.headerSubtitle, { color: colors.textSecondary, marginTop: spacing.xs }]}>
            Search by FTC team number or name to inspect 2025 OPR, match schedules, and live queueing alerts.
          </Text>
        </View>

        {/* Interactive Search Bar */}
        <View
          style={[
            styles.searchBarContainer,
            shadows.sm,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: radius.md,
              marginTop: spacing.md,
            },
          ]}
        >
          <View style={styles.searchIconContainer}>
            <AppIcon name="search" size={20} color={colors.textMuted} />
          </View>

          <TextInput
            style={[
              typography.body,
              styles.searchInput,
              {
                color: colors.textPrimary,
              },
            ]}
            placeholder="Search team # or name (e.g. 15996, BrickBot)..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel="Search team number or name"
          />

          {query.trim().length > 0 && (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear search query"
              style={({ pressed }) => [
                styles.clearButton,
                {
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <AppIcon name="close" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* Quick Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.chipsContainer, { marginTop: spacing.sm }]}
        >
          {QUICK_FILTERS.map((filter) => {
            const isSelected =
              filter.value === ''
                ? query.trim() === ''
                : query.trim().toLowerCase() === filter.value.toLowerCase();

            return (
              <Pressable
                key={filter.label}
                onPress={() => setQuery(filter.value)}
                accessibilityRole="button"
                accessibilityLabel={filter.label}
                accessibilityHint={filter.accessibilityHint}
                style={({ pressed }) => [
                  styles.filterChip,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surfaceElevated,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderRadius: radius.full,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    typography.subhead,
                    {
                      color: isSelected ? colors.onPrimary : colors.textSecondary,
                      fontWeight: isSelected ? '700' : '600',
                    },
                  ]}
                >
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Dynamic Presentation States */}
        <View style={[styles.stateSection, { marginTop: spacing.lg }]}>
          {/* State 1: Loading State */}
          {isLoading && !data && (
            <View
              style={[
                styles.stateCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: radius.lg,
                  padding: spacing.xl,
                },
              ]}
            >
              <ActivityIndicator size="large" color={colors.primary} />
              <Text
                style={[
                  typography.body,
                  { color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center' },
                ]}
              >
                Querying FTC 2025 Team Directory...
              </Text>
            </View>
          )}

          {/* State 2: Error State */}
          {status === 'error' && !data && (
            <View
              style={[
                styles.stateCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.destructive,
                  borderRadius: radius.lg,
                  padding: spacing.xl,
                },
              ]}
            >
              <AppIcon name="alert-circle" size={36} color={colors.destructive} />
              <Text style={[typography.title, { color: colors.textPrimary, marginTop: spacing.md }]}>
                Backend Connection Error
              </Text>
              <Text
                style={[
                  typography.body,
                  { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
                ]}
              >
                {error?.message || 'Unable to reach the FTC Pulse local analytics server.'}
              </Text>

              <View
                style={[
                  styles.endpointCallout,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    borderRadius: radius.sm,
                    padding: spacing.sm,
                    marginTop: spacing.md,
                  },
                ]}
              >
                <Text style={[typography.caption, { color: colors.textMuted }]}>API BASE URL</Text>
                <Text
                  style={[
                    typography.mono,
                    { color: colors.textPrimary, marginTop: spacing.xs },
                  ]}
                  numberOfLines={1}
                >
                  {apiClient.getBaseUrl()}
                </Text>
              </View>

              <Pressable
                onPress={() => refetch()}
                style={({ pressed }) => [
                  styles.primaryActionButton,
                  {
                    backgroundColor: colors.primary,
                    borderRadius: radius.sm,
                    marginTop: spacing.lg,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Retry Connection"
              >
                <AppIcon name="refresh" size={16} color={colors.onPrimary} />
                <Text style={[typography.headline, { color: colors.onPrimary, marginLeft: spacing.xs }]}>
                  Retry Connection
                </Text>
              </Pressable>
            </View>
          )}

          {/* State 3: Empty State (Proof of Concept Non-15996 Notice) */}
          {status === 'empty' && (
            <View
              style={[
                styles.stateCard,
                shadows.sm,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: radius.lg,
                  padding: spacing.xl,
                },
              ]}
            >
              <View
                style={[
                  styles.emptyStateIconContainer,
                  {
                    backgroundColor: colors.accentGoldSoft,
                    borderRadius: radius.full,
                  },
                ]}
              >
                <AppIcon name="shield" size={32} color={colors.accentGold} />
              </View>

              <Text style={[typography.title, { color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' }]}>
                Team Not Found in PoC
              </Text>

              <Text
                style={[
                  typography.body,
                  {
                    color: colors.textSecondary,
                    textAlign: 'center',
                    marginTop: spacing.sm,
                    lineHeight: 22,
                  },
                ]}
              >
                {data?.pocNotice ||
                  'Team not found. In this proof of concept, only BrickBot #15996 data is hosted. Multi-team lookup will be available in future releases.'}
              </Text>

              <Pressable
                onPress={() => setQuery('')}
                style={({ pressed }) => [
                  styles.primaryActionButton,
                  {
                    backgroundColor: colors.primary,
                    borderRadius: radius.md,
                    marginTop: spacing.xl,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Reset Filter to BrickBot #15996"
              >
                <Text style={[typography.headline, { color: colors.onPrimary }]}>
                  Reset Filter to BrickBot #15996
                </Text>
              </Pressable>
            </View>
          )}

          {/* State 4: Success State (BrickBot Result Found) */}
          {status === 'success' && team && (
            <View style={styles.successContainer}>
              <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '700' }]}>
                MATCHING FTC TEAM PROFILE
              </Text>

              {/* High-emphasis Sports Telemetry Team Card */}
              <BrickBotTeamCard
                team={team}
                onPress={() => router.push('/teams/15996')}
              />

              {/* 2025 Season Telemetry Capabilities Overview Grid */}
              <View style={[styles.capabilitiesSection, { marginTop: spacing.xl }]}>
                <View style={styles.sectionTitleRow}>
                  <Text style={[typography.headline, { color: colors.textPrimary }]}>
                    2025 Season Telemetry Capabilities
                  </Text>
                  <StatusBadge variant="gold" label="DECODE" />
                </View>

                <View style={[styles.capabilitiesGrid, { marginTop: spacing.md }]}>
                  <View
                    style={[
                      styles.capabilityTile,
                      shadows.sm,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        borderRadius: radius.md,
                        padding: spacing.md,
                      },
                    ]}
                  >
                    <View style={styles.capabilityHeader}>
                      <AppIcon name="chart" size={18} color={colors.primary} />
                      <Text style={[typography.subhead, { color: colors.textPrimary, marginLeft: spacing.xs, fontWeight: '700' }]}>
                        Ridge OPR Engine
                      </Text>
                    </View>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                      Least-squares regression matrix solving for Auto, TeleOp, and Endgame ratings.
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.capabilityTile,
                      shadows.sm,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        borderRadius: radius.md,
                        padding: spacing.md,
                      },
                    ]}
                  >
                    <View style={styles.capabilityHeader}>
                      <AppIcon name="trophy" size={18} color={colors.accentGold} />
                      <Text style={[typography.subhead, { color: colors.textPrimary, marginLeft: spacing.xs, fontWeight: '700' }]}>
                        13 Official + 1 Live Event
                      </Text>
                    </View>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                      Full match breakdown from FIRST FTC Events API plus real-time simulated championship.
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.capabilityTile,
                      shadows.sm,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        borderRadius: radius.md,
                        padding: spacing.md,
                      },
                    ]}
                  >
                    <View style={styles.capabilityHeader}>
                      <AppIcon name="bell" size={18} color={colors.statusLive} />
                      <Text style={[typography.subhead, { color: colors.textPrimary, marginLeft: spacing.xs, fontWeight: '700' }]}>
                        Smartwatch Queue Alerts
                      </Text>
                    </View>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                      Background polling with wearable-compatible high-importance notifications.
                    </Text>
                  </View>
                </View>

                {/* Direct Shortcut to TeamHomeScreen */}
                <Pressable
                  onPress={() => router.push('/teams/15996')}
                  style={({ pressed }) => [
                    styles.shortcutCard,
                    shadows.sm,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                      borderRadius: radius.md,
                      padding: spacing.md,
                      marginTop: spacing.md,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Explore BrickBot #15996 Analytics"
                  accessibilityHint="Navigates to the team season summary and tournament schedule"
                >
                  <View style={styles.shortcutContent}>
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.headline, { color: colors.textPrimary }]}>
                        Explore BrickBot #15996 Analytics
                      </Text>
                      <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                        Tap to inspect 14 tournaments, period breakdowns, and live queueing.
                      </Text>
                    </View>
                    <AppIcon name="arrow-up-right" size={20} color={colors.primary} />
                  </View>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerContainer: {
    paddingTop: 8,
  },
  telemetryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  brandBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  headerTitle: {
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    lineHeight: 20,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 52,
    paddingHorizontal: 12,
  },
  searchIconContainer: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
  },
  clearButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stateSection: {
    flex: 1,
  },
  stateCard: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateIconContainer: {
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  endpointCallout: {
    alignSelf: 'stretch',
    borderWidth: 1,
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    minHeight: 44,
    alignSelf: 'stretch',
  },
  successContainer: {
    width: '100%',
  },
  capabilitiesSection: {
    width: '100%',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  capabilitiesGrid: {
    gap: 10,
  },
  capabilityTile: {
    borderWidth: 1,
  },
  capabilityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shortcutCard: {
    borderWidth: 1,
    minHeight: 44,
  },
  shortcutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
