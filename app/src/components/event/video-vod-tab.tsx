import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';

import { useAppTheme } from '@/theme';
import { AppIcon } from '@/components/ui/icon';
import { StatusBadge } from '@/components/ui/status-badge';
import type { EventMetadata, MatchItem } from '@/types/api';

export interface VideoVodTabProps {
  event: EventMetadata;
  matches: MatchItem[];
  selectedMatch: MatchItem | null;
  onSelectMatch: (match: MatchItem | null) => void;
}

/**
 * Extracts the 11-character YouTube video ID from various YouTube URL patterns:
 * - watch?v=ID
 * - youtu.be/ID
 * - youtube.com/live/ID
 * - youtube.com/embed/ID
 * - youtube-nocookie.com/embed/ID
 * Fallback ID: 'H920hSVJw7E'
 */
export function extractYouTubeVideoId(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') {
    return 'H920hSVJw7E';
  }
  const clean = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) {
    return clean;
  }
  const regExp =
    /(?:youtube(?:-nocookie)?\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|live)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = clean.match(regExp);
  return match && match[1] ? match[1] : 'H920hSVJw7E';
}

/**
 * Formats a total duration in seconds to MM:SS or HH:MM:SS format.
 */
export function formatTimestamp(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const remainingSeconds = sec % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds
    .toString()
    .padStart(2, '0')}`;
}

export function VideoVodTab({
  event,
  matches,
  selectedMatch,
  onSelectMatch,
}: VideoVodTabProps) {
  const { colors, typography, spacing, radius, shadows } = useAppTheme();
  const [isWebViewLoading, setIsWebViewLoading] = useState<boolean>(true);

  // 1. YouTube URL and Timestamp Extraction
  const rawUrl =
    selectedMatch?.vodUrl ||
    event.liveStreamUrl ||
    'https://www.youtube.com/watch?v=H920hSVJw7E';

  const videoId = extractYouTubeVideoId(rawUrl);
  const startSeconds = selectedMatch?.vodTimestampSeconds ?? 0;

  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1&rel=0&modestbranding=1&start=${startSeconds}`;
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}${
    startSeconds > 0 ? `&t=${startSeconds}s` : ''
  }`;

  const nowPlayingTitle = selectedMatch
    ? `${selectedMatch.description} (${formatTimestamp(startSeconds)})`
    : 'Full Tournament Broadcast Stream';

  const handleOpenExternal = useCallback(async () => {
    try {
      await WebBrowser.openBrowserAsync(watchUrl);
    } catch {
      // In case browser cannot be opened, silently gracefully fail
    }
  }, [watchUrl]);

  const isFullBroadcastActive = selectedMatch === null;

  return (
    <View style={styles.container}>
      {/* 2. Embedded 16:9 Video Player Container */}
      <View
        style={[
          styles.playerContainer,
          shadows.md,
          {
            backgroundColor: '#090D16',
            borderColor: colors.border,
            borderRadius: radius.lg,
          },
        ]}
      >
        {Platform.OS === 'web' ? (
          // Web fallback: Clean embedded player card with direct launch
          <View style={styles.webPlayerCard}>
            <View
              style={[
                styles.webPlayIconCircle,
                { backgroundColor: colors.primarySoft, borderColor: colors.primary },
              ]}
            >
              <AppIcon name="video" size={36} color={colors.primary} />
            </View>
            <Text
              style={[
                typography.headline,
                { color: '#FFFFFF', marginTop: spacing.sm, textAlign: 'center' },
              ]}
              numberOfLines={2}
            >
              {nowPlayingTitle}
            </Text>
            <Text
              style={[
                typography.caption,
                styles.tabularNums,
                { color: '#94A3B8', marginTop: spacing.xs, textAlign: 'center' },
              ]}
            >
              Start Offset: {formatTimestamp(startSeconds)} • ID: {videoId}
            </Text>
            <Pressable
              onPress={handleOpenExternal}
              style={({ pressed }) => [
                styles.webLaunchButton,
                {
                  backgroundColor: colors.primary,
                  borderRadius: radius.md,
                  opacity: pressed ? 0.85 : 1,
                  marginTop: spacing.md,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Launch Video in Browser"
              hitSlop={8}
            >
              <AppIcon name="arrow-up-right" size={16} color={colors.onPrimary} />
              <Text
                style={[
                  typography.headline,
                  { color: colors.onPrimary, marginLeft: spacing.xs },
                ]}
              >
                Launch Web Player
              </Text>
            </Pressable>
          </View>
        ) : (
          // Native (iOS & Android): High-performance embedded WebView
          <View style={styles.nativePlayerViewport}>
            <WebView
              key={embedUrl}
              source={{
                uri: embedUrl,
                headers: { Referer: 'https://www.firstinspires.org' },
              }}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              style={styles.webView}
              onLoadStart={() => setIsWebViewLoading(true)}
              onLoadEnd={() => setIsWebViewLoading(false)}
            />
            {isWebViewLoading && (
              <View
                style={[
                  styles.loadingOverlay,
                  { backgroundColor: '#090D16' },
                ]}
              >
                <ActivityIndicator size="large" color={colors.primary} />
                <Text
                  style={[
                    typography.caption,
                    { color: '#94A3B8', marginTop: spacing.sm },
                  ]}
                >
                  Loading Stream & VOD...
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Now Playing Telemetry Bar */}
      <View
        style={[
          styles.telemetryBar,
          shadows.sm,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: radius.md,
            padding: spacing.base,
            marginTop: spacing.md,
          },
        ]}
      >
        <View style={styles.telemetryHeader}>
          <View style={styles.telemetryBadgeRow}>
            <StatusBadge
              variant="live"
              label={selectedMatch ? 'MATCH VOD' : 'FULL BROADCAST'}
              pulsing={isFullBroadcastActive}
              size="sm"
            />
            <Text
              style={[
                typography.caption,
                styles.tabularNums,
                { color: colors.textSecondary, marginLeft: spacing.xs, fontWeight: '600' },
              ]}
            >
              {formatTimestamp(startSeconds)}
            </Text>
          </View>
          <Text
            numberOfLines={1}
            style={[
              typography.headline,
              { color: colors.textPrimary, marginTop: spacing.xs },
            ]}
          >
            {nowPlayingTitle}
          </Text>
        </View>

        <Pressable
          onPress={handleOpenExternal}
          style={({ pressed }) => [
            styles.openExternalButton,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
              borderRadius: radius.md,
              opacity: pressed ? 0.8 : 1,
              marginTop: spacing.sm,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Open in YouTube App or Browser"
          hitSlop={8}
        >
          <AppIcon name="arrow-up-right" size={16} color={colors.primary} />
          <Text
            style={[
              typography.subhead,
              { color: colors.textPrimary, fontWeight: '600', marginLeft: spacing.xs },
            ]}
          >
            Open in YouTube App / Browser
          </Text>
        </Pressable>
      </View>

      {/* 3. Match VOD Timestamp Chapters List */}
      <View style={[styles.chaptersHeader, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
        <AppIcon name="clock" size={14} color={colors.textSecondary} />
        <Text
          style={[
            typography.caption,
            {
              color: colors.textSecondary,
              fontWeight: '700',
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              marginLeft: spacing.xs,
            },
          ]}
        >
          MATCH VOD CHAPTERS • JUMP TO TIMESTAMP
        </Text>
      </View>

      {/* Full Event Broadcast Chapter Row */}
      <Pressable
        onPress={() => onSelectMatch(null)}
        style={({ pressed }) => [
          styles.chapterRow,
          {
            backgroundColor: isFullBroadcastActive ? colors.primarySoft : colors.card,
            borderColor: isFullBroadcastActive ? colors.primary : colors.border,
            borderRadius: radius.md,
            opacity: pressed ? 0.85 : 1,
            marginBottom: spacing.xs,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Full Event Broadcast Stream, timestamp 00:00"
        accessibilityState={{ selected: isFullBroadcastActive }}
        hitSlop={4}
      >
        <View style={styles.chapterMainRow}>
          <View
            style={[
              styles.timestampBadge,
              {
                backgroundColor: isFullBroadcastActive
                  ? colors.primary
                  : colors.surfaceElevated,
                borderColor: isFullBroadcastActive
                  ? colors.primary
                  : colors.border,
              },
            ]}
          >
            <Text
              style={[
                typography.caption,
                styles.tabularNums,
                {
                  color: isFullBroadcastActive ? colors.onPrimary : colors.textPrimary,
                  fontWeight: '700',
                },
              ]}
            >
              00:00
            </Text>
          </View>

          <View style={styles.chapterInfo}>
            <Text
              style={[
                typography.headline,
                { color: colors.textPrimary },
              ]}
              numberOfLines={1}
            >
              Full Event Broadcast
            </Text>
            <Text
              style={[
                typography.caption,
                { color: colors.textSecondary, marginTop: 2 },
              ]}
            >
              Entire tournament stream from start to finish
            </Text>
          </View>

          {isFullBroadcastActive ? (
            <StatusBadge variant="live" label="PLAYING" size="sm" />
          ) : (
            <AppIcon name="chevron-right" size={16} color={colors.textSecondary} />
          )}
        </View>
      </Pressable>

      {/* Matches VOD Chapters */}
      {matches.map((match) => {
        const isSelected = selectedMatch?.matchId === match.matchId;
        const matchTimestamp = match.vodTimestampSeconds ?? 300;
        const alliance = match.targetTeamAlliance || 'Red';
        const isRedAlliance = alliance.toLowerCase() === 'red';

        const redScore = match.scoreRedFinal ?? '—';
        const blueScore = match.scoreBlueFinal ?? '—';

        return (
          <Pressable
            key={match.matchId}
            onPress={() => onSelectMatch(match)}
            style={({ pressed }) => [
              styles.chapterRow,
              {
                backgroundColor: isSelected ? colors.primarySoft : colors.card,
                borderColor: isSelected ? colors.primary : colors.border,
                borderRadius: radius.md,
                opacity: pressed ? 0.85 : 1,
                marginBottom: spacing.xs,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${match.description}, timestamp ${formatTimestamp(
              matchTimestamp
            )}, ${alliance} alliance, score Red ${redScore} Blue ${blueScore}`}
            accessibilityState={{ selected: isSelected }}
            hitSlop={4}
          >
            <View style={styles.chapterMainRow}>
              {/* Timestamp Badge */}
              <View
                style={[
                  styles.timestampBadge,
                  {
                    backgroundColor: isSelected
                      ? colors.primary
                      : colors.surfaceElevated,
                    borderColor: isSelected
                      ? colors.primary
                      : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    typography.caption,
                    styles.tabularNums,
                    {
                      color: isSelected ? colors.onPrimary : colors.textPrimary,
                      fontWeight: '700',
                    },
                  ]}
                >
                  {formatTimestamp(matchTimestamp)}
                </Text>
              </View>

              {/* Match Description & Alliance/Score Info */}
              <View style={styles.chapterInfo}>
                <View style={styles.matchTitleRow}>
                  <Text
                    style={[
                      typography.headline,
                      { color: colors.textPrimary, flexShrink: 1 },
                    ]}
                    numberOfLines={1}
                  >
                    {match.description}
                  </Text>
                  {/* Alliance badge */}
                  <View
                    style={[
                      styles.allianceBadge,
                      {
                        backgroundColor: isRedAlliance
                          ? colors.primarySoft
                          : colors.allianceBlueSoft,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typography.caption,
                        {
                          color: isRedAlliance
                            ? colors.primary
                            : colors.allianceBlue,
                          fontWeight: '700',
                          fontSize: 10,
                        },
                      ]}
                    >
                      {alliance.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Score and Field Telemetry */}
                <View style={styles.matchSubRow}>
                  <Text
                    style={[
                      typography.caption,
                      styles.tabularNums,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Score: {redScore} - {blueScore} • {match.field}
                  </Text>
                </View>
              </View>

              {/* Playing or Chevron indicator */}
              {isSelected ? (
                <StatusBadge variant="live" label="PLAYING" size="sm" />
              ) : (
                <AppIcon name="chevron-right" size={16} color={colors.textSecondary} />
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  playerContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    overflow: 'hidden',
    borderWidth: 1,
  },
  nativePlayerViewport: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000000',
  },
  webView: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  webPlayerCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  webPlayIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  webLaunchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    minHeight: 44,
  },
  telemetryBar: {
    borderWidth: 1,
  },
  telemetryHeader: {
    width: '100%',
  },
  telemetryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  openExternalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  chaptersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chapterRow: {
    minHeight: 56,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  chapterMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timestampBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 54,
  },
  tabularNums: {
    fontVariant: ['tabular-nums'],
  },
  chapterInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  matchTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  allianceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  matchSubRow: {
    marginTop: 2,
  },
});
