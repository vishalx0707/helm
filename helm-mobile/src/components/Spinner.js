import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, StyleSheet } from 'react-native';
import { colors } from '../theme';

/**
 * The mono spinner ring from the prototype: a faint full circle with a brighter
 * arc rotating over it. Pure CSS in the prototype; here it's a rotating bordered
 * circle with one lit edge.
 */
export default function Spinner({ size = 15, color = colors.inkHi }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const border = Math.max(2, Math.round(size * 0.16));

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.base,
          { width: size, height: size, borderRadius: size / 2, borderWidth: border },
        ]}
      />
      <Animated.View
        style={[
          styles.arc,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: border,
            borderTopColor: color,
            transform: [{ rotate }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
    borderColor: colors.hairline2,
  },
  arc: {
    position: 'absolute',
    borderColor: 'transparent',
  },
});
