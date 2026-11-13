import React, { useCallback } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme';
import { useServerHealth, useTeamSeasonSummary, useTeamSearch } from '@/hooks/use-ftc-api';
import { AppIcon } from '@/components/ui/icon';
import { StatusBadge } from '@/components/ui/status-badge';
import { BrickBotTeamCard } from '@/components/search/brickbot-team-card';
import { useSearchModal } from '@/components/navigation/floating-search-modal';
import type { TeamProfile } from '@/types/api';

const DEFAULT_BRICKBOT_PROFILE: TeamProfile = {
  teamNumber: 15996,
  displayTeamNumber: '15996',
  nameShort: 'BrickBot',
  nameFull: 'BrickBot #15996 (Colegiul National Unirea)',
  city: 'Focșani',
  stateProv: 'Vrancea',
  country: 'Romania',
  displayLocation: 'Focșani, Vrancea, Romania',
  rookieYear: 2018,
  season: 2026,
  seasonName: 'Biobuzz',
};

interface FeatureCardData {
  id: string;
  badge: string;
  iconName: 'chart' | 'bell' | 'shield' | 'video';
  title: string;
  description: string;
}

const PULSE_FEATURES: FeatureCardData[] = [
  {
    id: 'opr-analytics',
    badge: 'MATRIX TELEMETRY',
    iconName: 'chart',
    title: 'Multi-Season Ridge OPR & Analytics (2018 – 2026 Biobuzz)',
    description:
      'Solves regularized least-squares matrix equations (AᵀA + λI)X = AᵀB to isolate Autonomous, Driver-Controlled TeleOp, and Endgame scoring power across every BrickBot season.',
  },
  {
    id: 'queue-alerts',
    badge: 'SMARTWATCH DISPATCH',
    iconName: 'bell',
    title: 'Live Tournament & Match Queue Alerts',
    description:
      'Tracks the active Biobuzz championship in real time and forwards high-priority match queueing notifications directly to paired smartwatches.',
  },
  {
    id: 'period-breakdowns',
    badge: 'ALLIANCE DYNAMICS',
    iconName: 'shield',
    title: 'Alliance Scoreboards & Period Breakdowns',
    description:
      'Inspects every qualification and playoff match with Red vs. Blue alliance station lineups, penalty adjustments, and win-rate trajectories.',
  },
  {
    id: 'vod-seeking',
    badge: 'BROADCAST SYNC',
    iconName: 'video',
    title: 'Synchronized Livestream & VOD Chapter Seeking',
    description:
      'Jumps straight to any match’s exact timestamp in the embedded tournament broadcast stream.',
  },
];

export default function HomeScreen() {
  const { colors, typography, spacing, radius } = useAppTheme();
  const { openSearch } = useSearchModal();

  // Palette tokens prioritizing the sharp #FFFF00 yellow design
  const yellowPrimary = colors.primary || '#FFFF00';
  const yellowOnPrimary = colors.onPrimary || '#0B0B05';
  const surfaceBg = colors.surface || '#15150B';
  const surfaceElevatedBg = colors.surfaceElevated || '#1F1F10';
  const canvasBg = colors.background || '#0B0B05';

  const {
    data: healthData,
    isRefreshing: isHealthRefreshing,
    refetch: refetchHealth,
  } = useServerHealth();

  const {
    data: teamData,
    isRefreshing: isTeamRefreshing,
    refetch: refetchTeam,
  } = useTeamSeasonSummary(15996);

  const { data: searchData } = useTeamSearch('15996');

  const isRefreshing = isHealthRefreshing || isTeamRefreshing;

  const handleRefresh = useCallback(async () => {
    await Promise.allSettled([refetchHealth(), refetchTeam()]);
  }, [refetchHealth, refetchTeam]);

  const brickBotProfile: TeamProfile =
    searchData?.teams?.[0] ?? DEFAULT_BRICKBOT_PROFILE;

  const liveEventsCount =
    teamData?.events?.filter((ev) => ev.status === 'IN_PROGRESS').length ?? 0;

  const lastUpdatedDisplay =
    healthData?.lastUpdated ||
    teamData?.lastUpdated ||
    (healthData?.fetchedAt
      ? `Fetched ${new Date(healthData.fetchedAt).toLocaleTimeString()}`
      : '24h Cached Snapshot');

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: canvasBg }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          {
            paddingHorizontal: spacing.base,
            paddingTop: spacing.sm,
            paddingBottom: spacing.xxl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={yellowPrimary}
            colors={[yellowPrimary]}
          />
        }
      >
        {/* =========================================================================
            1. Hero Box ("What is FTC Pulse?")
           ========================================================================= */}
        <View
          style={[
            styles.heroBox,
            {
              backgroundColor: surfaceBg,
              borderRadius: radius.md,
              padding: spacing.lg,
            },
          ]}
        >
          {/* Sharp #FFFF00 Tag */}
          <View
            style={[
              styles.heroTag,
              {
                backgroundColor: yellowPrimary,
                borderRadius: radius.sm,
              },
            ]}
          >
            <Text
              style={[
                typography.caption,
                styles.heroTagText,
                { color: yellowOnPrimary },
              ]}
            >
              FIRST TECH CHALLENGE • TELEMETRY & LIVE COMPANION
            </Text>
          </View>

          {/* Headline */}
          <Text
            style={[
              typography.largeTitle,
              styles.heroHeadline,
              { color: colors.textPrimary, marginTop: spacing.md },
            ]}
          >
            Real-Time Competition Intelligence for FTC Robotics.
          </Text>

          {/* Description */}
          <Text
            style={[
              typography.body,
              styles.heroDescription,
              { color: colors.textSecondary, marginTop: spacing.sm },
            ]}
          >
            FTC Pulse is a dedicated mobile telemetry, scouting, and tournament
            companion built to cut through the chaos of FIRST Tech Challenge
            competitions. It unifies multi-season FIRST API analytics,
            Ridge-regularized OPR modeling, live match schedules, VOD timestamp
            playback, and instant smartwatch queueing alerts in a single
            low-latency interface.
          </Text>

          {/* CTAs */}
          <View style={[styles.heroActionsRow, { marginTop: spacing.lg }]}>
            {/* Button 1: Explore BrickBot #15996 Telemetry */}
            <Pressable
              onPress={() => router.push('/teams/15996')}
              style={({ pressed }) => [
                styles.primaryCtaButton,
                {
                  backgroundColor: yellowPrimary,
                  borderRadius: radius.sm,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Explore BrickBot #15996 Telemetry"
            >
              <Text
                style={[
                  typography.headline,
                  styles.ctaButtonText,
                  { color: yellowOnPrimary },
                ]}
              >
                Explore BrickBot #15996 Telemetry
              </Text>
              <AppIcon
                name="chevron-right"
                size={18}
                color={yellowOnPrimary}
              />
            </Pressable>

            {/* Button 2: Open Quick Team Search */}
            <Pressable
              onPress={openSearch}
              style={({ pressed }) => [
                styles.secondaryCtaButton,
                {
                  backgroundColor: surfaceElevatedBg,
                  borderRadius: radius.sm,
                  marginTop: spacing.sm,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Open Quick Team Search"
            >
              <AppIcon
                name="search"
                size={16}
                color={yellowPrimary}
                style={styles.searchButtonIcon}
              />
              <Text
                style={[
                  typography.subhead,
                  styles.secondaryCtaText,
                  { color: yellowPrimary },
                ]}
              >
                Open Quick Team Search
              </Text>
            </Pressable>
          </View>
        </View>

        {/* =========================================================================
            2. "What FTC Pulse Can Do" — 4 Borderless Feature Boxes
           ========================================================================= */}
        <View style={[styles.sectionContainer, { marginTop: spacing.xl }]}>
          <View style={styles.sectionHeader}>
            <Text
              style={[
                typography.caption,
                styles.sectionPretitle,
                { color: yellowPrimary },
              ]}
            >
              CAPABILITIES & ARCHITECTURE
            </Text>
            <Text
              style={[
                typography.title,
                styles.sectionTitle,
                { color: colors.textPrimary, marginTop: 2 },
              ]}
            >
              What FTC Pulse Can Do
            </Text>
          </View>

          <View style={[styles.featuresGrid, { marginTop: spacing.md }]}>
            {PULSE_FEATURES.map((feature) => (
              <View
                key={feature.id}
                style={[
                  styles.featureBox,
                  {
                    backgroundColor: surfaceBg,
                    borderRadius: radius.md,
                    padding: spacing.base,
                    marginBottom: spacing.md,
                  },
                ]}
              >
                <View style={styles.featureTopRow}>
                  <View
                    style={[
                      styles.featureIconChip,
                      {
                        backgroundColor: surfaceElevatedBg,
                        borderRadius: radius.sm,
                      },
                    ]}
                  >
                    <AppIcon
                      name={feature.iconName}
                      size={18}
                      color={yellowPrimary}
                    />
                  </View>
                  <View
                    style={[
                      styles.featureTag,
                      {
                        backgroundColor: surfaceElevatedBg,
                        borderRadius: radius.sm,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typography.caption,
                        styles.featureTagText,
                        { color: yellowPrimary },
                      ]}
                    >
                      {feature.badge}
                    </Text>
                  </View>
                </View>

                <Text
                  style={[
                    typography.headline,
                    styles.featureTitle,
                    { color: colors.textPrimary, marginTop: spacing.sm },
                  ]}
                >
                  {feature.title}
                </Text>

                <Text
                  style={[
                    typography.subhead,
                    styles.featureDesc,
                    { color: colors.textSecondary, marginTop: spacing.xs },
                  ]}
                >
                  {feature.description}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* =========================================================================
            3. Featured Team Spotlight Box (`BrickBot #15996`)
           ========================================================================= */}
        <View style={[styles.sectionContainer, { marginTop: spacing.lg }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.spotlightHeaderRow}>
              <View>
                <Text
                  style={[
                    typography.caption,
                    styles.sectionPretitle,
                    { color: yellowPrimary },
                  ]}
                >
                  FEATURED TEAM SPOTLIGHT
                </Text>
                <Text
                  style={[
                    typography.title,
                    styles.sectionTitle,
                    { color: colors.textPrimary, marginTop: 2 },
                  ]}
                >
                  Team #15996 BrickBot
                </Text>
              </View>

              <StatusBadge
                variant={liveEventsCount > 0 ? 'live' : 'gold'}
                label={
                  liveEventsCount > 0
                    ? `${liveEventsCount} LIVE EVENT`
                    : '2026 BIOBUZZ'
                }
                pulsing={liveEventsCount > 0}
              />
            </View>
          </View>

          {/* BrickBot Card (with borderless style override and small corner radius) */}
          <View style={{ marginTop: spacing.sm }}>
            <BrickBotTeamCard
              team={brickBotProfile}
              liveEventCount={liveEventsCount}
              onPress={() => router.push('/teams/15996')}
              style={[
                styles.brickBotCardOverride,
                {
                  backgroundColor: surfaceBg,
                  borderRadius: radius.md,
                },
              ]}
            />
          </View>

          {/* Live Server Cache & 24h Auto-Sync Status Strip */}
          <View
            style={[
              styles.cacheStatusStrip,
              {
                backgroundColor: surfaceElevatedBg,
                borderRadius: radius.sm,
                padding: spacing.md,
                marginTop: spacing.sm,
              },
            ]}
          >
            <View style={styles.cacheStatusRow}>
              <View style={styles.cacheStatusLeft}>
                <View
                  style={[
                    styles.syncPulseDot,
                    { backgroundColor: yellowPrimary },
                  ]}
                />
                <Text
                  style={[
                    typography.caption,
                    styles.syncStatusText,
                    { color: colors.textPrimary },
                  ]}
                >
                  24h Auto-Sync Active • FIRST Tech Challenge API Connected
                </Text>
              </View>
            </View>
            <Text
              style={[
                typography.caption,
                styles.cacheTimestampText,
                { color: colors.textMuted, marginTop: spacing.xs },
              ]}
            >
              Telemetry Cache: {lastUpdatedDisplay}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  // Hero Section
  heroBox: {
    borderWidth: 0,
  },
  heroTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 0,
  },
  heroTagText: {
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  heroHeadline: {
    fontWeight: '800',
    lineHeight: 34,
  },
  heroDescription: {
    lineHeight: 22,
  },
  heroActionsRow: {
    width: '100%',
  },
  primaryCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
    borderWidth: 0,
  },
  ctaButtonText: {
    fontWeight: '700',
    marginRight: 6,
  },
  secondaryCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 16,
    borderWidth: 0,
  },
  searchButtonIcon: {
    marginRight: 8,
  },
  secondaryCtaText: {
    fontWeight: '600',
  },
  // Section Headers
  sectionContainer: {
    width: '100%',
  },
  sectionHeader: {
    marginBottom: 4,
  },
  sectionPretitle: {
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionTitle: {
    fontWeight: '700',
  },
  // Features Grid
  featuresGrid: {
    width: '100%',
  },
  featureBox: {
    borderWidth: 0,
  },
  featureTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featureIconChip: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  featureTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 0,
  },
  featureTagText: {
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  featureTitle: {
    fontWeight: '700',
    lineHeight: 22,
  },
  featureDesc: {
    lineHeight: 20,
  },
  // Spotlight
  spotlightHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brickBotCardOverride: {
    borderWidth: 0,
  },
  cacheStatusStrip: {
    borderWidth: 0,
  },
  cacheStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cacheStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  syncPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  syncStatusText: {
    fontWeight: '600',
    flex: 1,
  },
  cacheTimestampText: {
    fontSize: 11,
  },
});
