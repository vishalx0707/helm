import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import { colors } from '../theme';

/**
 * Connection status, rendered in pure grayscale (the prototype's rule — no color).
 *   live    -> solid white dot with a breathing ring (laptop online)
 *   waiting -> dim solid dot (relay reached, laptop offline)
 *   off     -> hollow ring (disconnected / unreachable)
 */
export default function StatusDot({ variant = 'off', size = 8 }) {
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (variant !== 'live') return undefined;
    const loop = Animated.loop(
      Animated.timing(ring, {
        toValue: 1,
        duration: 2400,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [variant, ring]);

  const ringScale = ring.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.7, 1.9, 1.9] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.7, 0, 0] });

  if (variant === 'off') {
    return (
      <View
        style={[
          styles.hollow,
          { width: size + 1, height: size + 1, borderRadius: (size + 1) / 2 },
        ]}
      />
    );
  }

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {variant === 'live' && (
        <Animated.View
          style={[
            styles.breathe,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              transform: [{ scale: ringScale }],
              opacity: ringOpacity,
            },
          ]}
        />
      )}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: variant === 'live' ? colors.inkHi : colors.inkLo,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  breathe: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: colors.inkHi,
  },
  hollow: {
    borderWidth: 1,
    borderColor: colors.inkLo,
    backgroundColor: 'transparent',
  },
});
