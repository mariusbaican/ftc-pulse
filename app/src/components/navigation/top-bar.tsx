import React, { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/theme';
import { AppIcon } from '@/components/ui/icon';
import { useSearchModal } from './floating-search-modal';

export interface TopBarProps {
  onOpenSearch?: () => void;
  style?: StyleProp<ViewStyle>;
}

export type TopBarScrollState = {
  scrolledPastTeamCard: boolean;
  teamNumber: number;
  teamName: string;
};

let currentScrollState: TopBarScrollState = {
  scrolledPastTeamCard: false,
  teamNumber: 15996,
  teamName: 'BrickBot',
};

const listeners = new Set<() => void>();

export function setTopBarTeamScrollState(patch: Partial<TopBarScrollState>) {
  const next = { ...currentScrollState, ...patch };
  if (
    next.scrolledPastTeamCard === currentScrollState.scrolledPastTeamCard &&
    next.teamNumber === currentScrollState.teamNumber &&
    next.teamName === currentScrollState.teamName
  ) {
    return;
  }
  currentScrollState = next;
  listeners.forEach((l) => l());
}

export function getTopBarTeamScrollState(): TopBarScrollState {
  return currentScrollState;
}

/**
 * Persistent Global Top Bar for FTC Pulse.
 * Features:
 * - Electric yellow tactical branding with sharp logo mark.
 * - Dynamic back button on secondary and telemetry screens.
 * - Dedicated search trigger box button invoking the floating blurred search overlay.
 * - Dynamic compact team header (team number & name) when scrolled past team card or inside an event.
 * - Sits below the safe area inset with zero harsh borders.
 */
export function TopBar({ onOpenSearch, style }: TopBarProps) {
  const { colors, radius } = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { openSearch } = useSearchModal();

  const [scrollState, setScrollState] = useState<TopBarScrollState>(currentScrollState);

  useEffect(() => {
    const update = () => {
      setScrollState(currentScrollState);
    };
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  const isRoot = !pathname || pathname === '/' || pathname === '/index';
  const showBackButton = !isRoot;

  const isEventRoute = Boolean(pathname && /^\/teams\/[^/]+\/events\/[^/]+/.test(pathname));
  const isTeamRoute = Boolean(pathname && /^\/teams\/[^/]+\/?$/.test(pathname));

  const routeTeamNumber =
    pathname?.match(/^\/teams\/(\d+)/)?.[1] ||
    String(scrollState.teamNumber || 15996);

  const showCompactTeamHeader =
    isEventRoute || (isTeamRoute && scrollState.scrolledPastTeamCard);

  const teamName =
    scrollState.teamNumber === Number(routeTeamNumber) && scrollState.teamName
      ? scrollState.teamName
      : Number(routeTeamNumber) === 15996
      ? 'BrickBot'
      : scrollState.teamName || 'Team';

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const handleLogoPress = () => {
    if (!isRoot) {
      router.push('/');
    }
  };

  const handleSearchPress = () => {
    if (onOpenSearch) {
      onOpenSearch();
    } else {
      openSearch();
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 12 : 8) + 4,
          backgroundColor: colors.background,
        },
        style,
      ]}
    >
      <View style={styles.contentRow}>
        {/* Left Side: Back button (if non-root) + Logo & Name */}
        <View
          style={[
            styles.leftGroup,
            showCompactTeamHeader && styles.compactLeftGroup,
          ]}
        >
          {showBackButton && (
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [
                styles.backButton,
                {
                  backgroundColor: colors.surface,
                  borderRadius: radius.sm,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={8}
            >
              <AppIcon
                name="chevron-right"
                size={16}
                color={colors.textPrimary}
                style={{ transform: [{ rotate: '180deg' }] }}
              />
            </Pressable>
          )}

          <Pressable
            onPress={handleLogoPress}
            style={({ pressed }) => [
              styles.logoRow,
              { opacity: pressed ? 0.8 : 1 },
              showCompactTeamHeader && styles.compactLogoRow,
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              showCompactTeamHeader
                ? `${routeTeamNumber} - ${teamName}`
                : 'FTC Pulse home'
            }
            hitSlop={6}
          >
            {/* FTC Pulse Logo */}
            <Image
              source={require('../../../assets/images/ftc-pulse-logo.png')}
              style={styles.logoImage}
              contentFit="contain"
              accessibilityLabel="FTC Pulse logo"
            />

            {/* App Name or Team Number & Name */}
            <Text
              style={[
                styles.appName,
                {
                  color: colors.textPrimary,
                },
                showCompactTeamHeader && styles.compactAppName,
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {showCompactTeamHeader
                ? `${routeTeamNumber} - ${teamName}`
                : 'FTC Pulse'}
            </Text>
          </Pressable>
        </View>

        {/* Right Side: Search Button (Pill with label on root/top, boxless larger magnifying glass on compact header) */}
        <Pressable
          onPress={handleSearchPress}
          style={({ pressed }) => [
            styles.searchButton,
            {
              backgroundColor: showCompactTeamHeader ? 'transparent' : colors.surface,
              borderRadius: radius.sm,
              opacity: pressed ? 0.8 : 1,
            },
            showCompactTeamHeader && styles.compactSearchButton,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Open team search"
          hitSlop={6}
        >
          <AppIcon
            name="search"
            size={showCompactTeamHeader ? 22 : 18}
            color={colors.primary}
          />
          {!showCompactTeamHeader && (
            <Text
              style={[
                styles.searchLabel,
                {
                  color: colors.textPrimary,
                },
              ]}
            >
              Search
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderWidth: 0,
    zIndex: 50,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  compactLeftGroup: {
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  backButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactLogoRow: {
    flex: 1,
    flexShrink: 1,
  },
  logoImage: {
    width: 22,
    height: 22,
  },
  appName: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  compactAppName: {
    flexShrink: 1,
  },
  searchButton: {
    minHeight: 40,
    minWidth: 40,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 0,
  },
  compactSearchButton: {
    paddingHorizontal: 0,
    width: 40,
    height: 40,
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center',
  },
  searchLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
