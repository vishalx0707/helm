import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../theme';

/**
 * The HELM mark: a white rounded square with a mono `>_` prompt. White-on-black
 * is the brand's only filled element. `size` scales the square; the glyph and
 * corner radius follow.
 */
export default function HelmGlyph({ size = 30, radius }) {
  const r = radius != null ? radius : Math.round(size * 0.3);
  return (
    <View style={[styles.glyph, { width: size, height: size, borderRadius: r }]}>
      <Text style={[styles.txt, { fontSize: Math.round(size * 0.42) }]}>{'>_'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  glyph: {
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txt: {
    color: colors.onFill,
    fontFamily: fonts.mono,
    fontWeight: '500',
    includeFontPadding: false,
  },
});
