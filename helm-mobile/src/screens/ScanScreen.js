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
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import Screen from '../components/Screen';
import Button from '../components/Button';
import { colors, fonts, radius } from '../theme';
import { parsePairingPayload } from '../protocol';
import { savePairing } from '../lib/storage';
import { useRelay } from '../lib/connection';
import { BUILTIN_RELAY_URL } from '../config';

/**
 * Pair with the laptop. Two paths:
 *
 * 1. **6-digit code (v2):** Scan a QR or type 6 digits. The phone redeems the
 *    code against the built-in relay, gets the durable token, stores it, and
 *    connects. The user never sees a URL or a long token.
 *
 * 2. **Legacy (v1):** Scan a QR that carries { relay, token } or a /sim URL.
 *    Used by older desktop versions that haven't migrated to 6-digit codes.
 */
export default function ScanScreen({ navigation }) {
  const { conn } = useRelay();
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [error, setError] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const handledRef = useRef(false);

  /** Final step: save pairing, connect, navigate to dashboard. */
  const pair = async (pairing) => {
    if (handledRef.current) return;
    handledRef.current = true;
    await savePairing(pairing);
    conn.reconfigure(pairing);
    navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
  };

  /** Redeem a 6-digit code against the built-in relay, then pair. */
  const redeemAndPair = async (code) => {
    if (handledRef.current || redeeming) return;
    setRedeeming(true);
    setError('');
    try {
      const pairing = await conn.redeemCode(BUILTIN_RELAY_URL, code);
      await pair(pairing);
    } catch (e) {
      handledRef.current = false;
      setError(e.message || 'Pairing failed.');
    } finally {
      setRedeeming(false);
    }
  };

  const onScan = ({ data }) => {
    if (handledRef.current || redeeming) return;
    const result = parsePairingPayload(data);
    if (!result) {
      setError("That QR isn't a HELM pairing code.");
      return;
    }
    if (result.v === 2 && result.code) {
      // 6-digit code from QR — redeem it
      redeemAndPair(result.code);
    } else if (result.relay && result.token) {
      // Legacy v1 path
      pair(result);
    } else {
      setError("That QR isn't a HELM pairing code.");
    }
  };

  const onManualPair = () => {
    const code = codeInput.replace(/\s/g, '').trim();
    if (!/^\d{6}$/.test(code)) {
      setError('Enter a 6-digit pairing code.');
      return;
    }
    redeemAndPair(code);
  };

  const canScan = permission?.granted && !manual && !redeeming;

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
              <Text style={styles.back}>‹  CONNECT</Text>
            </Pressable>
            <Text style={styles.title}>Connect a device.</Text>
            <Text style={styles.sub}>
              Scan the QR code shown in HELM Desktop, or type the 6-digit code.
            </Text>
          </View>

          {!manual && (
            <Viewport
              granted={permission?.granted}
              onRequest={requestPermission}
              onScan={canScan ? onScan : undefined}
              redeeming={redeeming}
            />
          )}

          {!manual && (
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.orLine} />
            </View>
          )}

          {manual ? (
            <View style={styles.manualBox}>
              <Text style={styles.fieldLabel}>PAIRING CODE</Text>
              <View style={styles.codeRow}>
                <TextInput
                  value={codeInput}
                  onChangeText={(v) => {
                    // Allow only digits, max 6
                    const digits = v.replace(/\D/g, '').slice(0, 6);
                    setCodeInput(digits);
                    setError('');
                  }}
                  placeholder="000000"
                  placeholderTextColor={colors.inkLo}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  style={styles.codeInput}
                />
              </View>
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {redeeming && (
            <View style={styles.redeemRow}>
              <ActivityIndicator color={colors.inkHi} size="small" />
              <Text style={styles.redeemText}>Connecting…</Text>
            </View>
          )}

          <View style={{ flex: 1 }} />

          <Button
            label={manual ? (redeeming ? 'Pairing…' : 'Pair device') : 'Enter code manually'}
            variant={manual ? 'fill' : 'ghost'}
            disabled={redeeming}
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
                handledRef.current = false;
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
function Viewport({ granted, onRequest, onScan, redeeming }) {
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

      {redeeming && (
        <View style={styles.redeemOverlay}>
          <ActivityIndicator color={colors.inkHi} size="large" />
          <Text style={styles.redeemOverlayText}>Pairing…</Text>
        </View>
      )}

      {/* dim overlay so brackets read on a bright camera feed */}
      <View style={styles.vignette} pointerEvents="none" />
      <View style={[styles.bracket, styles.tl]} />
      <View style={[styles.bracket, styles.tr]} />
      <View style={[styles.bracket, styles.bl]} />
      <View style={[styles.bracket, styles.br]} />
      {granted && !redeeming && <Animated.View style={[styles.scanline, { transform: [{ translateY }] }]} />}
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

  redeemOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,11,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  redeemOverlayText: { color: colors.inkHi, fontSize: 14, fontFamily: fonts.mono },

  orRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 18, gap: 12 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.hairline },
  orText: { color: colors.inkLo, fontSize: 12, fontFamily: fonts.mono },

  manualBox: { marginTop: 6, marginBottom: 12 },
  fieldLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.inkLo,
    marginBottom: 10,
  },
  codeRow: { flexDirection: 'row', justifyContent: 'center' },
  codeInput: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.hairline2,
    borderRadius: radius.input,
    paddingHorizontal: 24,
    height: 64,
    color: colors.inkHi,
    fontFamily: fonts.mono,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 12,
    textAlign: 'center',
    width: '100%',
  },
  error: { color: colors.inkHi, fontSize: 12.5, marginTop: 14, fontFamily: fonts.mono },
  redeemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, justifyContent: 'center' },
  redeemText: { color: colors.inkMid, fontSize: 13, fontFamily: fonts.mono },
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
