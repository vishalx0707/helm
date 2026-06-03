import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import StatusDot from './StatusDot';
import { colors, fonts, radius } from '../theme';

/** Maps a RelayConnection status to the pill's dot variant + label. */
export function statusMeta(status) {
  switch (status) {
    case 'online':
      return { variant: 'live', label: 'Connected' };
    case 'waiting':
      return { variant: 'waiting', label: 'Laptop offline' };
    case 'connecting':
      return { variant: 'waiting', label: 'Connecting…' };
    case 'disconnected':
      return { variant: 'off', label: 'Reconnecting…' };
    default:
      return { variant: 'off', label: 'Not paired' };
  }
}

/** The mono status pill shown in the dashboard top bar. */
export default function ConnectionPill({ status }) {
  const { variant, label } = statusMeta(status);
  return (
    <View style={styles.pill}>
      <StatusDot variant={variant} />
      <Text style={styles.txt}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  txt: { fontSize: 12, color: colors.inkMid, fontFamily: fonts.mono },
});
