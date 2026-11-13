import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/theme';
import { useTeamSearch } from '@/hooks/use-ftc-api';
import { AppIcon } from '@/components/ui/icon';

// ============================================================================
// Context & Hook
// ============================================================================

interface SearchModalContextValue {
  isOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
}

const SearchModalContext = createContext<SearchModalContextValue>({
  isOpen: false,
  openSearch: () => {},
  closeSearch: () => {},
});

export function SearchModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openSearch = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <SearchModalContext.Provider value={{ isOpen, openSearch, closeSearch }}>
      {children}
    </SearchModalContext.Provider>
  );
}

export function useSearchModal(): SearchModalContextValue {
  const context = useContext(SearchModalContext);
  if (!context) {
    throw new Error('useSearchModal must be used within a SearchModalProvider');
  }
  return context;
}

// ============================================================================
// Floating Search Modal Component
// ============================================================================

export function FloatingSearchModal() {
  const { isOpen, closeSearch } = useSearchModal();
  const { colors, typography, radius } = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<any>(null);

  const { data, isLoading } = useTeamSearch(searchQuery);

  // Clear query and manage focus on open/close
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const handleSelectTeam = (teamNumber: number) => {
    closeSearch();
    router.push(`/teams/${teamNumber}`);
  };

  const handleClearOrClose = () => {
    if (searchQuery.trim().length > 0) {
      setSearchQuery('');
      inputRef.current?.focus();
    } else {
      closeSearch();
    }
  };

  if (!isOpen) {
    return null;
  }

  const rawTeams = data?.teams ?? [];
  const q = searchQuery.trim().toLowerCase();
  const isQueryEmpty = q.length === 0;

  // Client-side validation: only display team if query matches 15996 or brickbot (or teamNumber / nameShort includes query)
  const matchingTeams = rawTeams.filter((t) => {
    const numStr = String(t.teamNumber);
    const nameStr = t.nameShort.toLowerCase();
    return numStr.includes(q) || nameStr.includes(q);
  });

  const hasTeams = matchingTeams.length > 0;

  return (
    <Modal
      transparent
      animationType="fade"
      statusBarTranslucent
      visible={isOpen}
      onRequestClose={closeSearch}
    >
      <View style={styles.modalRoot}>
        {/* Slightly Blurred Backdrop */}
        <Pressable
          style={[
            styles.backdrop,
            { backgroundColor: colors.overlay },
            Platform.OS === 'web' ? ({ backdropFilter: 'blur(10px)' } as any) : null,
          ]}
          onPress={closeSearch}
          accessibilityRole="button"
          accessibilityLabel="Close search"
        />

        {/* Floating Search Container - Positioned Near Top to Prevent Keyboard Obstruction */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}
          pointerEvents="box-none"
        >
          <View
            style={[
              styles.floatingCard,
              {
                marginTop: insets.top + 14,
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                borderColor: 'rgba(255, 255, 0, 0.25)',
              },
            ]}
          >
            {/* Input Bar Row */}
            <View style={styles.inputRow}>
              <View style={styles.searchIconWrap}>
                <AppIcon name="search" size={20} color={colors.primary} />
              </View>

              <TextInput
                ref={inputRef}
                style={[
                  typography.body,
                  styles.input,
                  { color: colors.textPrimary },
                ]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search team # or name (15996, BrickBot)..."
                placeholderTextColor={colors.textMuted}
                autoFocus
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="never"
              />

              {isLoading && (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              )}

              <Pressable
                onPress={handleClearOrClose}
                style={styles.clearButton}
                accessibilityRole="button"
                accessibilityLabel={searchQuery ? 'Clear search text' : 'Close search'}
                hitSlop={8}
              >
                {searchQuery ? (
                  <AppIcon name="close" size={18} color={colors.textSecondary} />
                ) : (
                  <View style={[styles.escTag, { backgroundColor: colors.surfaceElevated, borderRadius: radius.xs }]}>
                    <Text style={[typography.caption, { color: colors.textMuted, fontSize: 11, fontWeight: '700' }]}>
                      ESC
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>

            {/* Results / Loading / Empty Dropdown Area - Rendered ONLY when query is NOT empty */}
            {!isQueryEmpty && (
              <ScrollView
                style={styles.resultsScroll}
                contentContainerStyle={styles.resultsContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* State 1: Loading in progress - Never show "No teams match" while loading */}
                {isLoading ? (
                  <View
                    style={[
                      styles.loadingBox,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderRadius: radius.sm,
                      },
                    ]}
                  >
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text
                      style={[
                        typography.caption,
                        styles.loadingText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Searching teams...
                    </Text>
                  </View>
                ) : hasTeams ? (
                  /* State 2: Compact Results Found */
                  <View style={styles.resultsList}>
                    {matchingTeams.map((t) => {
                      const location = [t.city, t.country].filter(Boolean).join(', ');
                      return (
                        <Pressable
                          key={t.teamNumber}
                          style={({ pressed }) => [
                            styles.compactTeamRow,
                            {
                              backgroundColor: colors.surfaceElevated,
                              borderRadius: radius.sm,
                              opacity: pressed ? 0.75 : 1,
                            },
                          ]}
                          onPress={() => handleSelectTeam(t.teamNumber)}
                          accessibilityRole="button"
                          accessibilityLabel={`Team ${t.teamNumber} - ${t.nameShort}${location ? `, ${location}` : ''}`}
                        >
                          <View style={styles.teamMainInfo}>
                            <Text style={styles.teamTitle} numberOfLines={1}>
                              <Text style={styles.teamNumberAccent}>{t.teamNumber}</Text>
                              <Text style={styles.teamNameWhite}> - {t.nameShort}</Text>
                            </Text>
                          </View>

                          {location.length > 0 && (
                            <Text
                              style={[
                                styles.teamLocationText,
                                { color: colors.textSecondary },
                              ]}
                              numberOfLines={1}
                            >
                              {location}
                            </Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  /* State 3: Query Non-Empty, Finished Loading, No Matching Teams */
                  <View
                    style={[
                      styles.emptyBox,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderRadius: radius.sm,
                      },
                    ]}
                  >
                    <View style={styles.emptyIconWrap}>
                      <AppIcon name="alert-circle" size={24} color={colors.primary} />
                    </View>

                    <Text style={[typography.headline, { color: colors.textPrimary, textAlign: 'center' }]}>
                      No teams match "{searchQuery.trim()}"
                    </Text>

                    <Text style={[typography.caption, styles.emptySubText, { color: colors.textSecondary }]}>
                      Try searching by team number or team name.
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  keyboardAvoid: {
    flex: 1,
  },
  floatingCard: {
    marginHorizontal: 16,
    borderWidth: 1,
    overflow: 'hidden',
    // Subtle Yellow Outer Glow
    shadowColor: '#FFFF00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 12,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 24px rgba(255, 255, 0, 0.22)',
        } as any)
      : {}),
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 52,
  },
  searchIconWrap: {
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 4,
  },
  loadingWrap: {
    marginLeft: 8,
  },
  clearButton: {
    marginLeft: 8,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  escTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsScroll: {
    maxHeight: 460,
  },
  resultsContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 8,
    gap: 10,
  },
  resultsList: {
    gap: 8,
  },
  compactTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 12,
  },
  teamMainInfo: {
    flex: 1,
    marginRight: 8,
  },
  teamTitle: {
    fontSize: 15,
  },
  teamNumberAccent: {
    color: '#FFFF00',
    fontWeight: '800',
  },
  teamNameWhite: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  teamLocationText: {
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 0,
    textAlign: 'right',
  },
  loadingBox: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyBox: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyIconWrap: {
    marginBottom: 4,
  },
  emptySubText: {
    textAlign: 'center',
    lineHeight: 18,
  },
});
