import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

/**
 * Base screen shell: the near-black background with a soft radial glow at the top
 * (the prototype's inner top-glow). SafeAreaView keeps content clear of the notch
 * and home indicator. Pass `edges` to opt specific safe-area edges in/out.
 */
export default function Screen({ children, style, edges = ['top', 'bottom'], padded = false }) {
  return (
    <View style={styles.root}>
      <View style={styles.topGlow} pointerEvents="none" />
      <SafeAreaView edges={edges} style={[styles.safe, padded && styles.padded, style]}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topGlow: {
    position: 'absolute',
    top: -160,
    left: '50%',
    marginLeft: -300,
    width: 600,
    height: 360,
    borderRadius: 300,
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  safe: { flex: 1 },
  padded: { paddingHorizontal: 26 },
});
