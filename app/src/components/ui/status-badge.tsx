import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '@/theme';
import { AppIcon, AppIconName } from './icon';

export type StatusBadgeVariant =
  | 'live'
  | 'red'
  | 'destructive'
  | 'blue'
  | 'gold'
  | 'neutral'
  | 'success';

export interface StatusBadgeProps {
  label: string;
  variant?: StatusBadgeVariant;
  pulsing?: boolean;
  size?: 'sm' | 'md';
  icon?: AppIconName;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

/**
 * Reusable Tactical Status Pill Badge.
 * Adheres to borderless yellow/black sports analytics theming, small corner radiuses,
 * and reduced-motion accessibility guidelines.
 */
export function StatusBadge({
  label,
  variant = 'neutral',
  pulsing = false,
  size = 'sm',
  icon,
  style,
  textStyle,
  accessibilityLabel,
}: StatusBadgeProps) {
  const { colors, typography, radius } = useAppTheme();
  const reducedMotion = useReducedMotion();

  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (pulsing && !reducedMotion) {
      pulseOpacity.value = withRepeat(
        withTiming(0.35, {
          duration: 900,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true
      );
    } else {
      pulseOpacity.value = 1;
    }
  }, [pulsing, reducedMotion, pulseOpacity]);

  const animatedDotStyle = useAnimatedStyle(() => {
    return {
      opacity: pulseOpacity.value,
    };
  });

  const getVariantStyles = (): {
    backgroundColor: string;
    textColor: string;
    dotColor: string;
  } => {
    switch (variant) {
      case 'live':
        return {
          backgroundColor: colors.statusLiveSoft,
          textColor: colors.statusLive,
          dotColor: colors.statusLive,
        };
      case 'red':
      case 'destructive':
        return {
          backgroundColor: colors.destructiveSoft,
          textColor: colors.destructive,
          dotColor: colors.destructive,
        };
      case 'blue':
        return {
          backgroundColor: colors.allianceBlueSoft,
          textColor: colors.allianceBlue,
          dotColor: colors.allianceBlue,
        };
      case 'gold':
        return {
          backgroundColor: colors.accentGoldSoft,
          textColor: colors.accentGold,
          dotColor: colors.accentGold,
        };
      case 'success':
        return {
          backgroundColor: colors.successSoft,
          textColor: colors.success,
          dotColor: colors.success,
        };
      case 'neutral':
      default:
        return {
          backgroundColor: colors.surfaceElevated,
          textColor: colors.textSecondary,
          dotColor: colors.neutral,
        };
    }
  };

  const vStyles = getVariantStyles();
  const isSm = size === 'sm';
  const iconSize = isSm ? 12 : 14;
  const dotSize = isSm ? 6 : 7;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? `${variant} status: ${label}`}
      style={[
        styles.badge,
        isSm ? styles.sizeSm : styles.sizeMd,
        {
          backgroundColor: vStyles.backgroundColor,
          borderRadius: radius.full,
        },
        style,
      ]}
    >
      {pulsing || variant === 'live' ? (
        <Animated.View
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: vStyles.dotColor,
            },
            animatedDotStyle,
          ]}
        />
      ) : icon ? (
        <AppIcon
          name={icon}
          size={iconSize}
          color={vStyles.textColor}
          style={styles.icon}
        />
      ) : null}

      <Text
        style={[
          typography.caption,
          isSm ? styles.textSm : styles.textMd,
          { color: vStyles.textColor },
          textStyle,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderCurve: 'continuous',
    alignSelf: 'flex-start',
  },
  sizeSm: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    gap: 5,
  },
  sizeMd: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    gap: 6,
  },
  dot: {
    flexShrink: 0,
  },
  icon: {
    marginRight: 1,
  },
  textSm: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  textMd: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
