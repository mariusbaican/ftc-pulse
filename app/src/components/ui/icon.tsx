import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';
import { useAppTheme } from '@/theme';

export type AppIconName =
  | 'search'
  | 'close'
  | 'chevron-right'
  | 'trophy'
  | 'bolt'
  | 'calendar'
  | 'location'
  | 'video'
  | 'chart'
  | 'bell'
  | 'check-circle'
  | 'alert-circle'
  | 'refresh'
  | 'shield'
  | 'radio'
  | 'arrow-up-right'
  | 'clock'
  | 'users'
  | 'list';

export interface AppIconProps {
  name: AppIconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
}

const SF_SYMBOL_MAP: Record<AppIconName, SFSymbol> = {
  search: 'magnifyingglass',
  close: 'xmark.circle.fill',
  'chevron-right': 'chevron.right',
  trophy: 'trophy.fill',
  bolt: 'bolt.fill',
  calendar: 'calendar',
  location: 'mappin.and.ellipse',
  video: 'play.rectangle.fill',
  chart: 'chart.bar.fill',
  bell: 'bell.badge.fill',
  'check-circle': 'checkmark.circle.fill',
  'alert-circle': 'exclamationmark.triangle.fill',
  refresh: 'arrow.clockwise',
  shield: 'shield.fill',
  radio: 'dot.radiowaves.left.and.right',
  'arrow-up-right': 'arrow.up.right',
  clock: 'clock.fill',
  users: 'person.2.fill',
  list: 'list.number',
};

/**
 * Geometric Vector fallback for Android, Web, and platforms without native SF Symbols.
 * Strict ui-ux-pro-max rule: NEVER uses emojis, uses clean geometric vectors.
 */
function GeometricIconFallback({
  name,
  size,
  color,
}: {
  name: AppIconName;
  size: number;
  color: string;
}) {
  const strokeWidth = Math.max(1.8, Math.round(size * 0.09));

  switch (name) {
    case 'search': {
      const ringSize = Math.round(size * 0.58);
      const handleLength = Math.round(size * 0.36);
      return (
        <View style={[styles.center, { width: size, height: size }]}>
          <View
            style={{
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              borderWidth: strokeWidth,
              borderColor: color,
              marginTop: -Math.round(size * 0.12),
              marginLeft: -Math.round(size * 0.12),
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: Math.round(size * 0.13),
              right: Math.round(size * 0.15),
              width: strokeWidth + 0.5,
              height: handleLength,
              backgroundColor: color,
              borderRadius: strokeWidth / 2,
              transform: [{ rotate: '-45deg' }],
            }}
          />
        </View>
      );
    }

    case 'close': {
      const crossLength = Math.round(size * 0.62);
      return (
        <View style={[styles.center, { width: size, height: size }]}>
          <View
            style={{
              position: 'absolute',
              width: crossLength,
              height: strokeWidth,
              backgroundColor: color,
              borderRadius: strokeWidth / 2,
              transform: [{ rotate: '45deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              width: crossLength,
              height: strokeWidth,
              backgroundColor: color,
              borderRadius: strokeWidth / 2,
              transform: [{ rotate: '-45deg' }],
            }}
          />
        </View>
      );
    }

    case 'chevron-right': {
      const boxSize = Math.round(size * 0.38);
      return (
        <View style={[styles.center, { width: size, height: size }]}>
          <View
            style={{
              width: boxSize,
              height: boxSize,
              borderTopWidth: strokeWidth + 0.3,
              borderRightWidth: strokeWidth + 0.3,
              borderColor: color,
              borderRadius: 1,
              marginLeft: -Math.round(size * 0.08),
              transform: [{ rotate: '45deg' }],
            }}
          />
        </View>
      );
    }

    case 'trophy': {
      const cupWidth = Math.round(size * 0.56);
      const cupHeight = Math.round(size * 0.38);
      return (
        <View style={[styles.center, { width: size, height: size }]}>
          {/* Handles */}
          <View
            style={{
              position: 'absolute',
              top: Math.round(size * 0.18),
              width: Math.round(size * 0.82),
              height: Math.round(size * 0.24),
              borderWidth: strokeWidth,
              borderColor: color,
              borderRadius: Math.round(size * 0.12),
            }}
          />
          {/* Cup Bowl */}
          <View
            style={{
              width: cupWidth,
              height: cupHeight,
              backgroundColor: color,
              borderBottomLeftRadius: Math.round(cupWidth / 2),
              borderBottomRightRadius: Math.round(cupWidth / 2),
              marginTop: -Math.round(size * 0.06),
            }}
          />
          {/* Stem */}
          <View
            style={{
              width: strokeWidth + 1,
              height: Math.round(size * 0.16),
              backgroundColor: color,
            }}
          />
          {/* Base */}
          <View
            style={{
              width: Math.round(size * 0.52),
              height: strokeWidth + 1,
              backgroundColor: color,
              borderRadius: strokeWidth / 2,
            }}
          />
        </View>
      );
    }

    case 'bolt': {
      return (
        <View style={[styles.center, { width: size, height: size }]}>
          <View
            style={{
              position: 'absolute',
              top: Math.round(size * 0.14),
              left: Math.round(size * 0.36),
              width: 0,
              height: 0,
              borderTopWidth: 0,
              borderRightWidth: Math.round(size * 0.28),
              borderBottomWidth: Math.round(size * 0.4),
              borderLeftWidth: 0,
              borderRightColor: 'transparent',
              borderBottomColor: color,
              transform: [{ skewX: '-15deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: Math.round(size * 0.14),
              right: Math.round(size * 0.36),
              width: 0,
              height: 0,
              borderTopWidth: Math.round(size * 0.4),
              borderRightWidth: 0,
              borderBottomWidth: 0,
              borderLeftWidth: Math.round(size * 0.28),
              borderLeftColor: 'transparent',
              borderTopColor: color,
              transform: [{ skewX: '-15deg' }],
            }}
          />
        </View>
      );
    }

    case 'calendar': {
      const calWidth = Math.round(size * 0.72);
      const calHeight = Math.round(size * 0.64);
      return (
        <View style={[styles.center, { width: size, height: size }]}>
          <View
            style={{
              width: calWidth,
              height: calHeight,
              borderRadius: Math.round(size * 0.12),
              borderWidth: strokeWidth,
              borderColor: color,
              overflow: 'hidden',
              alignItems: 'center',
            }}
          >
            {/* Header bar */}
            <View
              style={{
                width: '100%',
                height: Math.round(size * 0.18),
                backgroundColor: color,
              }}
            />
            {/* Internal dots */}
            <View
              style={{
                flexDirection: 'row',
                gap: 3,
                marginTop: 3,
              }}
            >
              <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
              <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
              <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
            </View>
          </View>
        </View>
      );
    }

    case 'location': {
      const pinSize = Math.round(size * 0.52);
      return (
        <View style={[styles.center, { width: size, height: size }]}>
          <View
            style={{
              width: pinSize,
              height: pinSize,
              borderRadius: pinSize / 2,
              borderWidth: strokeWidth,
              borderColor: color,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: -Math.round(size * 0.12),
            }}
          >
            <View
              style={{
                width: Math.round(size * 0.16),
                height: Math.round(size * 0.16),
                borderRadius: Math.round(size * 0.08),
                backgroundColor: color,
              }}
            />
          </View>
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: Math.round(size * 0.16),
              borderRightWidth: Math.round(size * 0.16),
              borderTopWidth: Math.round(size * 0.26),
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderTopColor: color,
              marginTop: -Math.round(size * 0.08),
            }}
          />
        </View>
      );
    }

    case 'video': {
      const screenW = Math.round(size * 0.76);
      const screenH = Math.round(size * 0.54);
      return (
        <View style={[styles.center, { width: size, height: size }]}>
          <View
            style={{
              width: screenW,
              height: screenH,
              borderRadius: Math.round(size * 0.12),
              borderWidth: strokeWidth,
              borderColor: color,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Play triangle */}
            <View
              style={{
                width: 0,
                height: 0,
                borderTopWidth: Math.round(size * 0.11),
                borderBottomWidth: Math.round(size * 0.11),
                borderLeftWidth: Math.round(size * 0.18),
                borderTopColor: 'transparent',
                borderBottomColor: 'transparent',
                borderLeftColor: color,
                marginLeft: 2,
              }}
            />
          </View>
        </View>
      );
    }

    case 'chart': {
      const barW = Math.max(2, Math.round(size * 0.14));
      return (
        <View style={[styles.center, { width: size, height: size }]}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: Math.max(2, Math.round(size * 0.08)),
              height: Math.round(size * 0.65),
              paddingBottom: 2,
            }}
          >
            <View
              style={{
                width: barW,
                height: '40%',
                backgroundColor: color,
                borderRadius: 1,
              }}
            />
            <View
              style={{
                width: barW,
                height: '100%',
                backgroundColor: color,
                borderRadius: 1,
              }}
            />
            <View
              style={{
                width: barW,
                height: '65%',
                backgroundColor: color,
                borderRadius: 1,
              }}
            />
          </View>
          <View
            style={{
              width: Math.round(size * 0.72),
              height: strokeWidth,
              backgroundColor: color,
              borderRadius: 1,
            }}
          />
        </View>
      );
    }

    case 'bell': {
      const bellW = Math.round(size * 0.56);
      const bellH = Math.round(size * 0.5);
      return (
        <View style={[styles.center, { width: size, height: size }]}>
          <View
            style={{
              width: bellW,
              height: bellH,
              borderTopLeftRadius: bellW / 2,
              borderTopRightRadius: bellW / 2,
              backgroundColor: color,
            }}
          />
          <View
            style={{
              width: Math.round(size * 0.74),
              height: strokeWidth,
              backgroundColor: color,
              borderRadius: 1,
            }}
          />
          <View
            style={{
              width: Math.round(size * 0.16),
              height: Math.round(size * 0.08),
              borderBottomLeftRadius: 3,
              borderBottomRightRadius: 3,
              backgroundColor: color,
              marginTop: 1,
            }}
          />
        </View>
      );
    }

    case 'check-circle': {
      const circleSize = Math.round(size * 0.78);
      return (
        <View style={[styles.center, { width: size, height: size }]}>
          <View
            style={{
              width: circleSize,
              height: circleSize,
              borderRadius: circleSize / 2,
              borderWidth: strokeWidth,
              borderColor: color,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: Math.round(size * 0.3),
                height: Math.round(size * 0.16),
                borderLeftWidth: strokeWidth,
                borderBottomWidth: strokeWidth,
                borderColor: color,
                transform: [{ rotate: '-45deg' }],
                marginTop: -Math.round(size * 0.04),
              }}
            />
          </View>
        </View>
      );
    }

    case 'alert-circle': {
      const circleSize = Math.round(size * 0.78);
      return (
        <View style={[styles.center, { width: size, height: size }]}>
          <View
            style={{
              width: circleSize,
              height: circleSize,
              borderRadius: circleSize / 2,
              borderWidth: strokeWidth,
              borderColor: color,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: strokeWidth,
                height: Math.round(size * 0.24),
                backgroundColor: color,
                borderRadius: 1,
              }}
            />
            <View
              style={{
                width: strokeWidth,
                height: strokeWidth,
                backgroundColor: color,
                borderRadius: strokeWidth / 2,
                marginTop: 2,
              }}
            />
          </View>
        </View>
      );
    }

    case 'refresh': {
      const ringSize = Math.round(size * 0.68);
      return (
        <View style={[styles.center, { width: size, height: size }]}>
          <View
            style={{
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              borderWidth: strokeWidth,
              borderColor: color,
              borderTopColor: 'transparent',
              transform: [{ rotate: '-45deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: Math.round(size * 0.16),
              right: Math.round(size * 0.22),
              width: 0,
              height: 0,
              borderTopWidth: Math.round(size * 0.12),
              borderRightWidth: Math.round(size * 0.12),
              borderTopColor: color,
              borderRightColor: 'transparent',
            }}
          />
        </View>
      );
    }

    case 'shield': {
      const shieldW = Math.round(size * 0.6);
      const shieldH = Math.round(size * 0.35);
      return (
        <View style={[styles.center, { width: size, height: size }]}>
          <View
            style={{
              width: shieldW,
              height: shieldH,
              backgroundColor: color,
              borderTopLeftRadius: 2,
              borderTopRightRadius: 2,
            }}
          />
          <View
            style={{
              width: shieldW,
              height: shieldH,
              backgroundColor: color,
              borderBottomLeftRadius: shieldW / 2,
              borderBottomRightRadius: shieldW / 2,
            }}
          />
        </View>
      );
    }

    case 'radio': {
      const dot = Math.round(size * 0.2);
      return (
        <View style={[styles.center, { width: size, height: size }]}>
          {/* Outer wave arcs */}
          <View
            style={{
              position: 'absolute',
              width: Math.round(size * 0.78),
              height: Math.round(size * 0.78),
              borderRadius: Math.round(size * 0.39),
              borderWidth: strokeWidth,
              borderColor: color,
              borderTopColor: 'transparent',
              borderBottomColor: 'transparent',
            }}
          />
          {/* Center pulse dot */}
          <View
            style={{
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: color,
            }}
          />
        </View>
      );
    }

    case 'arrow-up-right': {
      const stemH = Math.round(size * 0.52);
      const arrowTip = Math.round(size * 0.26);
      return (
        <View style={[styles.center, { width: size, height: size }]}>
          <View
            style={{
              width: strokeWidth,
              height: stemH,
              backgroundColor: color,
              borderRadius: strokeWidth / 2,
              transform: [{ rotate: '45deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: Math.round(size * 0.22),
              right: Math.round(size * 0.22),
              width: arrowTip,
              height: arrowTip,
              borderTopWidth: strokeWidth + 0.3,
              borderRightWidth: strokeWidth + 0.3,
              borderColor: color,
            }}
          />
        </View>
      );
    }

    case 'clock': {
      const clockSize = Math.round(size * 0.78);
      return (
        <View style={[styles.center, { width: size, height: size }]}>
          <View
            style={{
              width: clockSize,
              height: clockSize,
              borderRadius: clockSize / 2,
              borderWidth: strokeWidth,
              borderColor: color,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Center dot */}
            <View
              style={{
                width: 2,
                height: 2,
                borderRadius: 1,
                backgroundColor: color,
              }}
            />
            {/* Hour hand */}
            <View
              style={{
                position: 'absolute',
                top: Math.round(clockSize * 0.22),
                width: strokeWidth,
                height: Math.round(clockSize * 0.28),
                backgroundColor: color,
                borderRadius: 1,
              }}
            />
            {/* Minute hand */}
            <View
              style={{
                position: 'absolute',
                right: Math.round(clockSize * 0.22),
                width: Math.round(clockSize * 0.26),
                height: strokeWidth,
                backgroundColor: color,
                borderRadius: 1,
              }}
            />
          </View>
        </View>
      );
    }

    case 'users': {
      const headSize = Math.round(size * 0.32);
      const bodyWidth = Math.round(size * 0.52);
      const bodyHeight = Math.round(size * 0.3);
      return (
        <View style={[styles.center, { width: size, height: size }]}>
          {/* Two stylized user silhouettes */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'center',
              width: size,
              height: size,
              paddingBottom: Math.round(size * 0.1),
            }}
          >
            <View style={{ alignItems: 'center', marginRight: -Math.round(size * 0.08) }}>
              <View
                style={{
                  width: headSize,
                  height: headSize,
                  borderRadius: headSize / 2,
                  backgroundColor: color,
                  marginBottom: 2,
                }}
              />
              <View
                style={{
                  width: Math.round(bodyWidth * 0.75),
                  height: bodyHeight,
                  borderTopLeftRadius: bodyHeight * 0.7,
                  borderTopRightRadius: bodyHeight * 0.7,
                  backgroundColor: color,
                }}
              />
            </View>
            <View style={{ alignItems: 'center', marginLeft: Math.round(size * 0.02) }}>
              <View
                style={{
                  width: Math.round(headSize * 0.85),
                  height: Math.round(headSize * 0.85),
                  borderRadius: (headSize * 0.85) / 2,
                  backgroundColor: color,
                  marginBottom: 2,
                }}
              />
              <View
                style={{
                  width: Math.round(bodyWidth * 0.7),
                  height: Math.round(bodyHeight * 0.85),
                  borderTopLeftRadius: bodyHeight * 0.7,
                  borderTopRightRadius: bodyHeight * 0.7,
                  backgroundColor: color,
                }}
              />
            </View>
          </View>
        </View>
      );
    }

    case 'list': {
      const lineLen = Math.round(size * 0.58);
      const dotSz = Math.round(size * 0.14);
      return (
        <View style={[styles.center, { width: size, height: size }, { gap: Math.round(size * 0.12) }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', width: size, paddingHorizontal: Math.round(size * 0.12), gap: 6 }}>
            <View style={{ width: dotSz, height: dotSz, borderRadius: dotSz / 2, backgroundColor: color }} />
            <View style={{ flex: 1, height: strokeWidth, backgroundColor: color, borderRadius: strokeWidth / 2 }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', width: size, paddingHorizontal: Math.round(size * 0.12), gap: 6 }}>
            <View style={{ width: dotSz, height: dotSz, borderRadius: dotSz / 2, backgroundColor: color }} />
            <View style={{ flex: 1, height: strokeWidth, backgroundColor: color, borderRadius: strokeWidth / 2 }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', width: size, paddingHorizontal: Math.round(size * 0.12), gap: 6 }}>
            <View style={{ width: dotSz, height: dotSz, borderRadius: dotSz / 2, backgroundColor: color }} />
            <View style={{ flex: 1, height: strokeWidth, backgroundColor: color, borderRadius: strokeWidth / 2 }} />
          </View>
        </View>
      );
    }

    default:
      return <View style={{ width: size, height: size }} />;
  }
}

/**
 * Universal Vector Icon for FTC Pulse.
 * Uses native Apple SF Symbols on iOS and high-precision geometric vector rendering on Android/Web.
 * Strictly adheres to ui-ux-pro-max guidelines: never uses emojis, zero unbundled native dependencies.
 */
export function AppIcon({
  name,
  size = 20,
  color,
  style,
  weight = 'medium',
}: AppIconProps) {
  const { colors } = useAppTheme();
  const iconColor = color ?? colors.textPrimary;

  if (Platform.OS === 'ios') {
    const sfName = SF_SYMBOL_MAP[name];
    if (sfName) {
      return (
        <SymbolView
          name={sfName}
          size={size}
          tintColor={iconColor}
          weight={weight}
          resizeMode="scaleAspectFit"
          style={[{ width: size, height: size }, style]}
        />
      );
    }
  }

  return (
    <View style={[{ width: size, height: size }, style]}>
      <GeometricIconFallback name={name} size={size} color={iconColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
