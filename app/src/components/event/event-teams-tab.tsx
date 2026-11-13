import React, { useMemo, useState } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';

import { useAppTheme } from '@/theme';
import { AppIcon } from '@/components/ui/icon';
import type { EventTeamItem } from '@/types/api';

export interface EventTeamsTabProps {
  teams: EventTeamItem[];
  style?: StyleProp<ViewStyle>;
}

/**
 * Event Teams Tab Component.
 * Implements Requirement Functional #6:
 * - Lists all teams attending the event, sorted ascending by team number
 * - Compact search input to filter teams by number or name
 * - Displays #teamNumber in sharp badge on the left, teamName, Rank #X, and OPR
 * - Highlights #15996 BrickBot with yellow accent and elevated styling
 */
export function EventTeamsTab({ teams = [], style }: EventTeamsTabProps) {
  const { colors, typography, spacing, radius, shadows } = useAppTheme();
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. Sort teams strictly ascending by teamNumber
  const sortedTeams = useMemo(() => {
    return [...teams].sort((a, b) => a.teamNumber - b.teamNumber);
  }, [teams]);

  // 2. Filter teams based on search query
  const filteredTeams = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sortedTeams;
    return sortedTeams.filter((item) => {
      const numMatch = item.teamNumber.toString().includes(query);
      const nameMatch = (item.teamName || '').toLowerCase().includes(query);
      return numMatch || nameMatch;
    });
  }, [sortedTeams, searchQuery]);

  if (teams.length === 0) {
    return (
      <View style={[styles.container, style]}>
        <View
          style={[
            styles.emptyCard,
            shadows.sm,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              padding: spacing.xl,
            },
          ]}
        >
          <View
            style={[
              styles.emptyIconCircle,
              { backgroundColor: colors.neutralSoft },
            ]}
          >
            <AppIcon name="shield" size={28} color={colors.textSecondary} />
          </View>
          <Text
            style={[
              typography.headline,
              { color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' },
            ]}
          >
            No Teams Listed
          </Text>
          <Text
            style={[
              typography.body,
              {
                color: colors.textSecondary,
                marginTop: spacing.xs,
                textAlign: 'center',
                maxWidth: 320,
              },
            ]}
          >
            A participating team roster was not published for this tournament.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {/* Search / Filter Input */}
      <View
        style={[
          styles.searchBox,
          {
            backgroundColor: colors.surfaceElevated,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
          },
        ]}
      >
        <AppIcon name="search" size={16} color={colors.textSecondary} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Filter teams at this event..."
          placeholderTextColor={colors.textMuted}
          style={[
            styles.searchInput,
            typography.body,
            { color: colors.textPrimary, marginLeft: spacing.xs },
          ]}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel="Filter teams at this event"
        />
        {searchQuery.length > 0 && (
          <Pressable
            onPress={() => setSearchQuery('')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear team filter"
          >
            <AppIcon name="close" size={16} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* Header Info */}
      <View style={[styles.countHeaderRow, { marginTop: spacing.md, marginBottom: spacing.xs }]}>
        <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '700' }]}>
          ROSTER ({filteredTeams.length} OF {sortedTeams.length} TEAMS • SORTED BY NUMBER)
        </Text>
      </View>

      {/* Teams List */}
      <View style={[styles.teamsList, { gap: spacing.xs }]}>
        {filteredTeams.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                padding: spacing.xl,
              },
            ]}
          >
            <Text
              style={[
                typography.subhead,
                { color: colors.textSecondary, textAlign: 'center' },
              ]}
            >
              No teams match "{searchQuery}"
            </Text>
          </View>
        ) : (
          filteredTeams.map((team) => {
            const isTarget = team.isTargetTeam || team.teamNumber === 15996;

            return (
              <View
                key={`team-${team.teamNumber}`}
                style={[
                  styles.teamCard,
                  shadows.sm,
                  {
                    backgroundColor: isTarget ? colors.primarySoft : colors.surface,
                    borderRadius: radius.sm,
                    padding: spacing.md,
                    borderLeftWidth: isTarget ? 4 : 0,
                    borderLeftColor: colors.primary,
                  },
                ]}
                accessible
                accessibilityRole="text"
                accessibilityLabel={`Team #${team.teamNumber} ${team.teamName}${team.rank != null ? `, Rank ${team.rank}` : ''}${team.totalOpr != null ? `, OPR ${team.totalOpr.toFixed(1)}` : ''}`}
              >
                {/* Left Badge: #teamNumber */}
                <View
                  style={[
                    styles.teamNumberBadge,
                    {
                      backgroundColor: isTarget ? colors.primary : colors.surfaceElevated,
                      borderRadius: radius.sm,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.teamNumberText,
                      { color: isTarget ? colors.onPrimary : colors.textPrimary },
                    ]}
                  >
                    #{team.teamNumber}
                  </Text>
                </View>

                {/* Middle Info: Name & Target Badge */}
                <View style={styles.teamDetailsCol}>
                  <View style={styles.teamTitleRow}>
                    <Text
                      style={[
                        typography.subhead,
                        styles.teamNameText,
                        {
                          color: isTarget ? colors.primary : colors.textPrimary,
                          fontWeight: isTarget ? '800' : '700',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {team.teamName}
                    </Text>
                  </View>

                  {team.record && (
                    <Text
                      style={[
                        typography.caption,
                        styles.tabularNums,
                        { color: colors.textSecondary, marginTop: 2 },
                      ]}
                    >
                      Record: {team.record}
                    </Text>
                  )}
                </View>

                {/* Right Info: Rank & OPR */}
                <View style={styles.teamStatsCol}>
                  {team.rank != null && (
                    <View style={styles.statPill}>
                      <Text
                        style={[
                          typography.caption,
                          styles.tabularNums,
                          {
                            color: isTarget ? colors.primary : colors.textPrimary,
                            fontWeight: '700',
                          },
                        ]}
                      >
                        Rank #{team.rank}
                      </Text>
                    </View>
                  )}

                  {team.totalOpr != null && (
                    <Text
                      style={[
                        typography.caption,
                        styles.tabularNums,
                        {
                          color: isTarget ? colors.primary : colors.textSecondary,
                          fontWeight: '600',
                          marginTop: 2,
                        },
                      ]}
                    >
                      OPR {team.totalOpr.toFixed(1)}
                    </Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
  },
  countHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamsList: {
    width: '100%',
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
  },
  teamNumberBadge: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamNumberText: {
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  teamDetailsCol: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
    justifyContent: 'center',
  },
  teamTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamNameText: {
    flexShrink: 1,
  },
  teamStatsCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabularNums: {
    fontVariant: ['tabular-nums'],
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});