import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Screen from '../components/Screen';
import Button from '../components/Button';
import { colors } from '../theme';

/**
 * The hard offline state — the never-blank recovery screen. Shown when the phone
 * can't even reach the relay (vs. the soft ReconnectBar, which means the relay is
 * reachable but the laptop peer is offline). Honors the MVP constraint: a clear
 * retry, never a broken screen. `onRetry` kicks an immediate reconnect; `onRepair`
 * sends the user back to pairing.
 */
export default function OfflineScreen({ onRetry, onRepair }) {
  const [trying, setTrying] = useState(false);

  const retry = () => {
    setTrying(true);
    onRetry?.();
    setTimeout(() => setTrying(false), 1800);
  };

  return (
    <Screen padded>
      <View style={styles.wrap}>
        <View style={styles.orb}>
          <Feather name="wifi-off" size={32} color={colors.inkLo} />
        </View>
        <Text style={styles.title}>Laptop unreachable</Text>
        <Text style={styles.body}>
          We can't reach your laptop right now. It may be asleep, offline, or HELM Desktop isn't
          running.
        </Text>
        <Button label="Try again" variant="fill" loading={trying} onPress={retry} />
        <Pressable onPress={onRepair} style={{ marginTop: 16 }}>
          <Text style={styles.link}>Pairing details</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  orb: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: colors.hairline2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  title: { fontSize: 24, fontWeight: '600', letterSpacing: -0.3, color: colors.inkHi, marginBottom: 10 },
  body: {
    fontSize: 14,
    color: colors.inkMid,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 26,
    maxWidth: 260,
  },
  link: { fontSize: 13, color: colors.inkMid, textDecorationLine: 'underline' },
});
