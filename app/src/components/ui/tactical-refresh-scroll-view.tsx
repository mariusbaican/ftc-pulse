import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '@/theme';

const TRIGGER_THRESHOLD = 54;
const REFRESH_HEADER_HEIGHT = 52;
const MAX_PULL = 90;
const DAMPING = 0.45;

export interface TacticalRefreshScrollViewProps extends ScrollViewProps {
  refreshing: boolean;
  onRefresh: () => void;
  reducedMotion?: boolean;
  children: React.ReactNode;
}

type PullState = 'idle' | 'pull' | 'release' | 'refreshing';

/**
 * Tactical Electric Yellow Custom Refresh ScrollView for FTC Pulse.
 * Replaces default platform refresh controls (like the out-of-place native white circle on Android)
 * with a high-contrast #FFFF00 robotics telemetry pull-down animation:
 * - Geometric rotating diamond with deep #0B0B05 core (standard motion)
 * - Accessible static 3-step indicator pill banner without elastic bounce (reduced motion)
 * - Synchronous fill progress bar leading to the 54px trigger threshold
 * - Dynamic tactical uppercase label (PULL TO REFRESH -> RELEASE TO REFRESH -> REFRESHING...)
 * - Continuous 60fps UI-thread spin on active refresh
 */
export const TacticalRefreshScrollView = forwardRef<
  React.ElementRef<typeof ScrollView>,
  TacticalRefreshScrollViewProps
>(function TacticalRefreshScrollView(
    {
      refreshing,
      onRefresh,
      reducedMotion,
      children,
      onScroll,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel,
      scrollEventThrottle = 16,
      contentContainerStyle,
      style,
      ...restProps
    },
    ref
  ) {
    const { colors } = useAppTheme();
    const systemReducedMotion = useReducedMotion();
    const isReducedMotion = reducedMotion ?? systemReducedMotion;

    const [pullState, setPullState] = useState<PullState>(refreshing ? 'refreshing' : 'idle');

    // Touch & scroll tracking
    const scrollY = useRef(0);
    const touchStartY = useRef(0);
    const isPullingRef = useRef(false);

    // Reanimated shared values
    const pullDistance = useSharedValue(refreshing ? REFRESH_HEADER_HEIGHT : 0);
    const isRefreshingShared = useSharedValue(refreshing ? 1 : 0);
    const spinRotation = useSharedValue(0);

    // Sync with external refreshing prop changes
    useEffect(() => {
      isRefreshingShared.value = refreshing ? 1 : 0;

      if (refreshing) {
        setPullState('refreshing');
        pullDistance.value = withTiming(REFRESH_HEADER_HEIGHT, {
          duration: 200,
          easing: Easing.out(Easing.ease),
        });
        if (!isReducedMotion) {
          spinRotation.value = 0;
          spinRotation.value = withRepeat(
            withTiming(360, { duration: 800, easing: Easing.linear }),
            -1,
            false
          );
        } else {
          cancelAnimation(spinRotation);
          spinRotation.value = 0;
        }
      } else {
        cancelAnimation(spinRotation);
        spinRotation.value = 0;
        pullDistance.value = withTiming(0, {
          duration: 240,
          easing: Easing.out(Easing.ease),
        });
        setPullState('idle');
      }
    }, [refreshing, isRefreshingShared, pullDistance, spinRotation, isReducedMotion]);

    const handleScroll = useCallback(
      (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        scrollY.current = e.nativeEvent.contentOffset.y;
        onScroll?.(e);
      },
      [onScroll]
    );

    const handleTouchStart = useCallback(
      (e: GestureResponderEvent) => {
        touchStartY.current = e.nativeEvent.pageY;
        if (scrollY.current <= 2 && !refreshing) {
          isPullingRef.current = true;
        } else {
          isPullingRef.current = false;
        }
        onTouchStart?.(e);
      },
      [refreshing, onTouchStart]
    );

    const handleTouchMove = useCallback(
      (e: GestureResponderEvent) => {
        if (isPullingRef.current && !refreshing) {
          const currentY = e.nativeEvent.pageY;
          const deltaY = currentY - touchStartY.current;

          if (deltaY > 0 && scrollY.current <= 2) {
            const clamped = Math.min(MAX_PULL, deltaY * DAMPING);
            pullDistance.value = clamped;

            if (clamped >= TRIGGER_THRESHOLD) {
              setPullState('release');
            } else {
              setPullState('pull');
            }
          } else {
            if (pullDistance.value > 0) {
              pullDistance.value = 0;
            }
            setPullState('idle');
          }
        }
        onTouchMove?.(e);
      },
      [refreshing, pullDistance, onTouchMove]
    );

    const handleTouchEnd = useCallback(
      (e: GestureResponderEvent) => {
        if (isPullingRef.current && !refreshing) {
          isPullingRef.current = false;

          if (pullDistance.value >= TRIGGER_THRESHOLD) {
            pullDistance.value = withTiming(REFRESH_HEADER_HEIGHT, { duration: 150 });
            setPullState('refreshing');
            onRefresh();
          } else {
            pullDistance.value = withTiming(0, { duration: 200 });
            setPullState('idle');
          }
        }
        onTouchEnd?.(e);
      },
      [refreshing, pullDistance, onRefresh, onTouchEnd]
    );

    const handleTouchCancel = useCallback(
      (e: GestureResponderEvent) => {
        if (isPullingRef.current && !refreshing) {
          isPullingRef.current = false;
          pullDistance.value = withTiming(0, { duration: 200 });
          setPullState('idle');
        }
        onTouchCancel?.(e);
      },
      [refreshing, pullDistance, onTouchCancel]
    );

    // Reanimated styles
    const headerContainerAnimatedStyle = useAnimatedStyle(() => {
      const h = pullDistance.value;
      if (isReducedMotion) {
        const opacity =
          isRefreshingShared.value === 1
            ? 1
            : h > 2
            ? Math.min(1, h / TRIGGER_THRESHOLD)
            : 0;
        return {
          height: isRefreshingShared.value === 1 ? REFRESH_HEADER_HEIGHT : h,
          opacity,
        };
      }
      return {
        height: h,
        opacity: h > 2 ? Math.min(1, h / 20) : 0,
      };
    });

    const dot1AnimatedStyle = useAnimatedStyle(() => {
      const isLit =
        isRefreshingShared.value === 1 ||
        pullDistance.value >= TRIGGER_THRESHOLD * 0.33;
      return {
        backgroundColor: isLit ? colors.primary : 'rgba(255, 255, 255, 0.2)',
      };
    });

    const dot2AnimatedStyle = useAnimatedStyle(() => {
      const isLit =
        isRefreshingShared.value === 1 ||
        pullDistance.value >= TRIGGER_THRESHOLD * 0.66;
      return {
        backgroundColor: isLit ? colors.primary : 'rgba(255, 255, 255, 0.2)',
      };
    });

    const dot3AnimatedStyle = useAnimatedStyle(() => {
      const isLit =
        isRefreshingShared.value === 1 ||
        pullDistance.value >= TRIGGER_THRESHOLD;
      return {
        backgroundColor: isLit ? colors.primary : 'rgba(255, 255, 255, 0.2)',
      };
    });

    const diamondAnimatedStyle = useAnimatedStyle(() => {
      const rotationDeg =
        isRefreshingShared.value === 1
          ? spinRotation.value
          : (pullDistance.value / TRIGGER_THRESHOLD) * 360;

      const scale =
        isRefreshingShared.value === 1
          ? 1
          : Math.min(1.15, 0.6 + (pullDistance.value / TRIGGER_THRESHOLD) * 0.4);

      return {
        transform: [{ rotate: `${rotationDeg}deg` }, { scale }],
      };
    });

    const progressFillAnimatedStyle = useAnimatedStyle(() => {
      const widthPercent =
        isRefreshingShared.value === 1
          ? 100
          : Math.min(1, Math.max(0, pullDistance.value / TRIGGER_THRESHOLD)) * 100;

      return {
        width: `${widthPercent}%`,
      };
    });

    const isHighlightState = pullState === 'release' || refreshing;
    const labelColor = isHighlightState ? colors.primary : colors.textSecondary;

    const reducedMotionLabel =
      refreshing || pullState === 'refreshing'
        ? 'UPDATING DATA...'
        : pullState === 'release'
        ? 'RELEASE TO UPDATE'
        : 'PULL DOWN TO REFRESH';

    return (
      <ScrollView
        ref={ref}
        style={style}
        contentContainerStyle={contentContainerStyle}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        scrollEventThrottle={scrollEventThrottle}
        {...restProps}
      >
        <Animated.View style={[styles.headerContainer, headerContainerAnimatedStyle]}>
          {isReducedMotion ? (
            <View style={styles.reducedMotionHeaderContent}>
              <View
                style={[
                  styles.reducedMotionPill,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: isHighlightState ? colors.primary : colors.borderSubtle,
                  },
                ]}
                accessible
                accessibilityRole="text"
                accessibilityLabel={
                  refreshing || pullState === 'refreshing'
                    ? 'Updating data'
                    : pullState === 'release'
                    ? 'Release to update'
                    : 'Pull down to refresh'
                }
              >
                <View style={styles.reducedMotionDotsRow}>
                  <Animated.View style={[styles.reducedMotionDot, dot1AnimatedStyle]} />
                  <Animated.View style={[styles.reducedMotionDot, dot2AnimatedStyle]} />
                  <Animated.View style={[styles.reducedMotionDot, dot3AnimatedStyle]} />
                </View>

                <Text style={[styles.reducedMotionLabel, { color: labelColor }]}>
                  {reducedMotionLabel}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.headerContent}>
              {/* Rotating Geometric Diamond */}
              <Animated.View style={[styles.diamondWrapper, diamondAnimatedStyle]}>
                <View style={[styles.diamondOuter, { backgroundColor: colors.primary }]}>
                  <View style={[styles.diamondInner, { backgroundColor: colors.background }]} />
                </View>
              </Animated.View>

              {/* Tactical Label & Progress Bar */}
              <View style={styles.telemetryGroup}>
                <Text style={[styles.tacticalLabel, { color: labelColor }]}>
                  {refreshing || pullState === 'refreshing'
                    ? 'REFRESHING...'
                    : pullState === 'release'
                    ? 'RELEASE TO REFRESH'
                    : 'PULL TO REFRESH'}
                </Text>
                <View style={styles.progressBarTrack}>
                  <Animated.View
                    style={[
                      styles.progressBarFill,
                      { backgroundColor: colors.primary },
                      progressFillAnimatedStyle,
                    ]}
                  />
                </View>
              </View>
            </View>
          )}
        </Animated.View>

        {children}
      </ScrollView>
    );
  }
);

export default TacticalRefreshScrollView;

const styles = StyleSheet.create({
  headerContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  headerContent: {
    height: REFRESH_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  reducedMotionHeaderContent: {
    height: REFRESH_HEADER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  reducedMotionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  reducedMotionDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  reducedMotionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  reducedMotionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  diamondWrapper: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diamondOuter: {
    width: 18,
    height: 18,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
    shadowColor: '#FFFF00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.38,
    shadowRadius: 5,
    elevation: 3,
  },
  diamondInner: {
    width: 7,
    height: 7,
    borderRadius: 1,
  },
  telemetryGroup: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 4,
  },
  tacticalLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  progressBarTrack: {
    width: 90,
    height: 2,
    backgroundColor: 'rgba(255, 255, 0, 0.18)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 1,
  },
});
