import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { useAppTheme } from '@/theme';
import { AppIcon } from '@/components/ui/icon';
import type { EventRankingItem } from '@/types/api';

export interface EventRankingsTabProps {
  rankings: EventRankingItem[];
  hasQualMatches?: boolean;
  style?: StyleProp<ViewStyle>;
}

export type SortColumn = 'rank' | 'team' | 'record' | 'rp' | 'tb1' | 'avgScore' | 'opr';
export type SortDirection = 'asc' | 'desc';

/**
 * Event Rankings Tab Component.
 * Implements:
 * - Horizontally scrollable leaderboard table with fixed column widths:
 *   Rank (56), Team (155), Record (76), RP (64), TBP (72), Avg (72), OPR (76, last column)
 * - Sortable by clicking any column header with ▲ / ▼ indicator in #FFFF00
 * - Clean pixel-perfect row alignment with absolutely positioned accent bar for target team
 * - Two-line Team cell: Team number on Line 1, Team name on Line 2 (trimmed with ...)
 * - Search removed per user requirements
 */
export function EventRankingsTab({
  rankings,
  hasQualMatches = true,
  style,
}: EventRankingsTabProps) {
  const { colors, typography, spacing, radius, shadows } = useAppTheme();
  const [sortColumn, setSortColumn] = useState<SortColumn>('rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const isAvailable = hasQualMatches && rankings.length > 0;

  const handleHeaderPress = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection(col === 'rank' || col === 'team' ? 'asc' : 'desc');
    }
  };

  // Sort rankings
  const sortedRankings = useMemo(() => {
    const list = [...rankings];

    list.sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case 'rank':
          comparison = a.rank - b.rank;
          break;
        case 'team':
          comparison = a.teamNumber - b.teamNumber;
          break;
        case 'record': {
          const scoreA = a.wins * 3 + a.ties;
          const scoreB = b.wins * 3 + b.ties;
          comparison = scoreA - scoreB || a.losses - b.losses;
          break;
        }
        case 'rp':
          comparison = (a.rp ?? 0) - (b.rp ?? 0);
          break;
        case 'tb1':
          comparison = (a.tb1 ?? 0) - (b.tb1 ?? 0);
          break;
        case 'avgScore':
          comparison = (a.avgScore ?? 0) - (b.avgScore ?? 0);
          break;
        case 'opr':
          comparison = (a.totalOpr ?? 0) - (b.totalOpr ?? 0);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [rankings, sortColumn, sortDirection]);

  if (!isAvailable) {
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
            <AppIcon name="trophy" size={28} color={colors.textSecondary} />
          </View>
          <Text
            style={[
              typography.headline,
              { color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' },
            ]}
          >
            Qualification Rankings Not Available
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
            Qualification rankings are not calculated or published for this tournament stage.
          </Text>
        </View>
      </View>
    );
  }

  const renderHeaderCol = (
    col: SortColumn,
    title: string,
    width: number,
    align: 'left' | 'center' | 'right' = 'left'
  ) => {
    const isActive = sortColumn === col;
    const arrow = sortDirection === 'asc' ? ' ▲' : ' ▼';
    return (
      <Pressable
        key={col}
        onPress={() => handleHeaderPress(col)}
        style={[{ width }, styles.headerCell, align === 'center' && styles.alignCenter, align === 'right' && styles.alignRight]}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={`Sort by ${title}`}
      >
        <Text
          style={[
            typography.caption,
            {
              color: isActive ? colors.primary : colors.textMuted,
              fontWeight: '700',
              textAlign: align,
            },
          ]}
          numberOfLines={1}
        >
          {title}
          {isActive && <Text style={{ color: colors.primary }}>{arrow}</Text>}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {/* Summary Count Header */}
      <View style={[styles.countHeaderRow, { marginBottom: spacing.sm }]}>
        <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '700' }]}>
          QUALIFICATION RANKINGS ({rankings.length} TEAMS)
        </Text>
      </View>

      {/* Horizontally Scrollable Leaderboard Table Card */}
      <View
        style={[
          styles.tableCard,
          shadows.sm,
          {
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            overflow: 'hidden',
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={true}
          contentContainerStyle={styles.tableScrollContent}
        >
          <View style={styles.tableInner}>
            {/* Table Header Row */}
            <View
              style={[
                styles.tableHeaderRow,
                {
                  backgroundColor: colors.surfaceElevated,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.sm,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.borderSubtle,
                },
              ]}
            >
              {renderHeaderCol('rank', 'RANK', 56, 'center')}
              {renderHeaderCol('team', 'TEAM', 155, 'left')}
              {renderHeaderCol('record', 'RECORD', 76, 'center')}
              {renderHeaderCol('rp', 'RP', 64, 'right')}
              {renderHeaderCol('tb1', 'TBP', 72, 'right')}
              {renderHeaderCol('avgScore', 'AVG', 72, 'right')}
              {renderHeaderCol('opr', 'OPR', 76, 'right')}
            </View>

            {/* Rows */}
            {sortedRankings.map((item, index) => {
              const isTarget = item.isTargetTeam || item.teamNumber === 15996;
              const isLast = index === sortedRankings.length - 1;

              return (
                <View
                  key={`rank-${item.teamNumber}-${item.rank}`}
                  style={[
                    styles.tableRow,
                    {
                      paddingVertical: spacing.sm + 2,
                      paddingHorizontal: spacing.sm,
                      backgroundColor: isTarget
                        ? colors.primarySoft
                        : index % 2 === 1
                        ? colors.surfaceElevated
                        : colors.surface,
                      borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
                      borderBottomColor: colors.borderSubtle,
                    },
                  ]}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={`Rank ${item.rank}, Team ${item.teamName} ${item.teamNumber}, Record ${item.wins}-${item.losses}-${item.ties}, RP ${item.rp?.toFixed(2) ?? 'N/A'}, TBP ${item.tb1?.toFixed(1) ?? 'N/A'}, Avg ${item.avgScore?.toFixed(1) ?? 'N/A'}, OPR ${item.totalOpr?.toFixed(1) ?? 'N/A'}`}
                >
                  {/* Absolutely positioned accent bar for target team to avoid horizontal offset */}
                  {isTarget && (
                    <View
                      style={[
                        styles.targetAccentBar,
                        { backgroundColor: colors.primary },
                      ]}
                    />
                  )}

                  {/* Column 1: Rank (width 56) */}
                  <View style={[{ width: 56 }, styles.alignCenter]}>
                    <Text
                      style={[
                        styles.tabularBold,
                        {
                          color: isTarget ? colors.primary : colors.textPrimary,
                          fontSize: 13,
                        },
                      ]}
                    >
                      #{item.rank}
                    </Text>
                  </View>

                  {/* Column 2: Team (width 155) - Line 1: Team Number, Line 2: Team Name */}
                  <View style={[{ width: 155 }, styles.alignLeft]}>
                    <Text
                      style={[
                        styles.teamNumberText,
                        {
                          color: isTarget ? colors.primary : colors.textPrimary,
                          fontWeight: '800',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {item.teamNumber}
                    </Text>
                    <Text
                      style={[
                        styles.teamNameSubtext,
                        {
                          color: isTarget ? colors.primary : colors.textSecondary,
                          fontWeight: isTarget ? '700' : '500',
                        },
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {item.teamName}
                    </Text>
                  </View>

                  {/* Column 3: Record (width 76) */}
                  <View style={[{ width: 76 }, styles.alignCenter]}>
                    <Text
                      style={[
                        typography.caption,
                        styles.tabularText,
                        { color: isTarget ? colors.primary : colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {item.wins}-{item.losses}-{item.ties}
                    </Text>
                  </View>

                  {/* Column 4: RP (width 64) */}
                  <View style={[{ width: 64 }, styles.alignRight]}>
                    <Text
                      style={[
                        typography.caption,
                        styles.tabularText,
                        {
                          color: isTarget ? colors.primary : colors.textPrimary,
                          fontWeight: '600',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {item.rp != null ? item.rp.toFixed(2) : '—'}
                    </Text>
                  </View>

                  {/* Column 5: TBP (width 72) */}
                  <View style={[{ width: 72 }, styles.alignRight]}>
                    <Text
                      style={[
                        typography.caption,
                        styles.tabularText,
                        {
                          color: isTarget ? colors.primary : colors.textPrimary,
                          fontWeight: '600',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {item.tb1 != null ? item.tb1.toFixed(1) : '—'}
                    </Text>
                  </View>

                  {/* Column 6: Avg (width 72) */}
                  <View style={[{ width: 72 }, styles.alignRight]}>
                    <Text
                      style={[
                        typography.caption,
                        styles.tabularText,
                        {
                          color: isTarget ? colors.primary : colors.textPrimary,
                          fontWeight: '600',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {item.avgScore != null ? item.avgScore.toFixed(1) : '—'}
                    </Text>
                  </View>

                  {/* Column 7: OPR (width 76 - LAST column) */}
                  <View style={[{ width: 76 }, styles.alignRight]}>
                    <Text
                      style={[
                        typography.caption,
                        styles.tabularText,
                        {
                          color: isTarget ? colors.primary : colors.textPrimary,
                          fontWeight: isTarget ? '800' : '700',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {item.totalOpr != null ? item.totalOpr.toFixed(1) : '—'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  countHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tableCard: {
    width: '100%',
  },
  tableScrollContent: {
    minWidth: '100%',
  },
  tableInner: {
    minWidth: 571,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  targetAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    zIndex: 1,
  },
  headerCell: {
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  alignCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  alignRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  alignLeft: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  teamNumberText: {
    fontSize: 13,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
  },
  teamNameSubtext: {
    fontSize: 11,
    lineHeight: 14,
    marginTop: 1,
  },
  tabularText: {
    fontVariant: ['tabular-nums'],
  },
  tabularBold: {
    fontWeight: '700',
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
