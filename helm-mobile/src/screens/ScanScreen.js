import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Animated,
  Easing,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import Screen from '../components/Screen';
import Button from '../components/Button';
import { colors, fonts, radius } from '../theme';
import { parsePairingPayload } from '../protocol';
import { savePairing } from '../lib/storage';
import { useRelay } from '../lib/connection';

/**
 * Pair with the laptop. Primary path: point the camera at the QR HELM Desktop
 * shows — it encodes { v, relay, token } (see helm-desktop/src/main/pairing.js).
 * On a successful scan we persist the pairing, point the live connection at it,
 * and drop into the dashboard.
 *
 * Secondary path: a manual relay-URL + token entry for development, when the
 * laptop and phone are on the same network without a tunnel.
 */
export default function ScanScreen({ navigation }) {
  const { conn } = useRelay();
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState(false);
  const [relay, setRelay] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const handledRef = useRef(false);

  const pair = async (pairing) => {
    if (handledRef.current) return;
    handledRef.current = true;
    await savePairing(pairing);
    conn.reconfigure(pairing);
    navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
  };

  const onScan = ({ data }) => {
    const pairing = parsePairingPayload(data);
    if (!pairing) {
      setError("That QR isn't a HELM pairing code.");
      return;
    }
    pair(pairing);
  };

  const onManualPair = () => {
    const r = relay.trim();
    const t = token.trim();
    if (!r || !t) {
      setError('Enter both the relay URL and the token.');
      return;
    }
    if (!/^wss?:\/\//i.test(r)) {
      setError('Relay URL must start with ws:// or wss://');
      return;
    }
    pair({ relay: r, token: t });
  };

  const canScan = permission?.granted && !manual;

  return (
    <Screen padded>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingVertical: 8 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.head}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
              <Text style={styles.back}>‹  PAIRING</Text>
            </Pressable>
            <Text style={styles.title}>Pair with your laptop.</Text>
            <Text style={styles.sub}>
              Point your camera at the code shown in HELM Desktop on your laptop.
            </Text>
          </View>

          {!manual && (
            <Viewport
              granted={permission?.granted}
              onRequest={requestPermission}
              onScan={canScan ? onScan : undefined}
            />
          )}

          {manual && (
            <View style={styles.manualBox}>
              <Text style={styles.fieldLabel}>RELAY URL</Text>
              <TextInput
                value={relay}
                onChangeText={(v) => {
                  setRelay(v);
                  setError('');
                }}
                placeholder="wss://your-relay.example"
                placeholderTextColor={colors.inkLo}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>PAIRING TOKEN</Text>
              <TextInput
                value={token}
                onChangeText={(v) => {
                  setToken(v);
                  setError('');
                }}
                placeholder="paste token from desktop…"
                placeholderTextColor={colors.inkLo}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={{ flex: 1 }} />

          <Button
            label={manual ? 'Pair device' : 'Enter code manually'}
            variant={manual ? 'fill' : 'ghost'}
            onPress={
              manual
                ? onManualPair
                : () => {
                    setManual(true);
                    setError('');
                  }
            }
          />
          {manual && (
            <Pressable
              onPress={() => {
                setManual(false);
                setError('');
              }}
              style={{ alignSelf: 'center', marginTop: 14 }}
            >
              <Text style={styles.switchLink}>Scan QR instead</Text>
            </Pressable>
          )}

          <View style={styles.reassure}>
            <Feather name="lock" size={14} color={colors.inkLo} />
            <Text style={styles.reassureTxt}>
              No code or credentials ever leave your laptop · TLS encrypted.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** The camera viewport with animated corner brackets + a sweeping scan line. */
function Viewport({ granted, onRequest, onScan }) {
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 2600,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);

  const translateY = sweep.interpolate({ inputRange: [0, 0.5, 1], outputRange: [10, 180, 10] });

  return (
    <View style={styles.viewport}>
      {granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={onScan}
        />
      ) : (
        <Pressable style={styles.permPrompt} onPress={onRequest}>
          <Feather name="camera" size={26} color={colors.inkMid} />
          <Text style={styles.permTxt}>Tap to enable the camera</Text>
        </Pressable>
      )}

      {/* dim overlay so brackets read on a bright camera feed */}
      <View style={styles.vignette} pointerEvents="none" />
      <View style={[styles.bracket, styles.tl]} />
      <View style={[styles.bracket, styles.tr]} />
      <View style={[styles.bracket, styles.bl]} />
      <View style={[styles.bracket, styles.br]} />
      {granted && <Animated.View style={[styles.scanline, { transform: [{ translateY }] }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { marginBottom: 22, marginTop: 8 },
  back: { fontFamily: fonts.mono, fontSize: 12, color: colors.inkLo, marginBottom: 14 },
  title: { fontSize: 27, fontWeight: '600', letterSpacing: -0.6, color: colors.inkHi },
  sub: { marginTop: 8, fontSize: 14, color: colors.inkMid, lineHeight: 20 },

  viewport: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0e0e10',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  vignette: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,10,11,0.18)' },
  permPrompt: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 12 },
  permTxt: { color: colors.inkMid, fontSize: 13 },

  bracket: { position: 'absolute', width: 38, height: 38, borderColor: colors.inkHi },
  tl: { top: 26, left: 26, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 8 },
  tr: { top: 26, right: 26, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 8 },
  bl: { bottom: 26, left: 26, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 8 },
  br: { bottom: 26, right: 26, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 8 },
  scanline: {
    position: 'absolute',
    left: 26,
    right: 26,
    top: 26,
    height: 2,
    backgroundColor: colors.inkHi,
    opacity: 0.8,
  },

  manualBox: { marginTop: 6 },
  fieldLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.inkLo,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.hairline2,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    height: 50,
    color: colors.inkHi,
    fontFamily: fonts.mono,
    fontSize: 14,
  },
  error: { color: colors.inkHi, fontSize: 12.5, marginTop: 14, fontFamily: fonts.mono },
  switchLink: {
    fontSize: 13,
    color: colors.inkMid,
    textDecorationLine: 'underline',
  },
  reassure: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 18,
  },
  reassureTxt: { color: colors.inkLo, fontSize: 11.5, textAlign: 'center', flexShrink: 1 },
});
