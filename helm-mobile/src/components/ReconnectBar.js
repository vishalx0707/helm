import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Spinner from './Spinner';
import { colors, fonts, radius } from '../theme';

/**
 * The soft offline state: a glass bar that slides in under the status bar while
 * we try to reach the laptop again. Never a blank screen — the dashboard stays
 * visible underneath. The hard "Laptop unreachable" full screen is OfflineScreen.
 */
export default function ReconnectBar({ label = 'Reconnecting to your laptop…' }) {
  return (
    <View style={styles.bar}>
      <Spinner size={15} />
      <Text style={styles.txt}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    marginHorizontal: 14,
    marginTop: 8,
    backgroundColor: 'rgba(20,20,24,0.92)',
    borderWidth: 1,
    borderColor: colors.hairline2,
    borderRadius: radius.input,
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  txt: { fontSize: 12.5, color: colors.inkMid, fontFamily: fonts.ui },
});
