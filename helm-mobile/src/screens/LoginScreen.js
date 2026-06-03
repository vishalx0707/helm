import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AntDesign, Feather } from '@expo/vector-icons';
import Screen from '../components/Screen';
import HelmGlyph from '../components/HelmGlyph';
import Button from '../components/Button';
import { colors, fonts } from '../theme';

/**
 * Welcome / Login — the brand entry. Real auth (Apple/Google/email) is roadmap,
 * not the MVP (there is no account backend yet — the laptop holds everything).
 * For the demo, any of these buttons simply advances to pairing; the laptop
 * pairing is the real trust step.
 */
export default function LoginScreen({ navigation }) {
  const proceed = () => navigation.navigate('Scan');

  return (
    <Screen padded>
      <View style={styles.wrap}>
        <View style={styles.top}>
          <HelmGlyph size={62} radius={18} />
          <View style={styles.brand}>
            <Text style={styles.brandName}>HELM</Text>
            <Text style={styles.tagline}>Direct the AI agents on your laptop — from anywhere.</Text>
          </View>
        </View>

        <View>
          <View style={styles.actions}>
            <Button
              label="Continue with Apple"
              variant="fill"
              onPress={proceed}
              iconNode={<AntDesign name="apple1" size={18} color={colors.onFill} />}
            />
            <Button
              label="Continue with Google"
              variant="ghost"
              onPress={proceed}
              iconNode={<AntDesign name="google" size={17} color={colors.inkHi} />}
            />
            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerTxt}>OR</Text>
              <View style={styles.line} />
            </View>
            <Button label="Continue with email" variant="ghost" icon="mail" onPress={proceed} />
          </View>

          <Text style={styles.legal}>
            By continuing you agree to HELM's{'\n'}
            <Text style={styles.link}>Terms of Service</Text> and{' '}
            <Text style={styles.link}>Privacy Policy</Text>.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'space-between', paddingVertical: 30 },
  top: { alignItems: 'center', gap: 22, marginTop: 42 },
  brand: { alignItems: 'center', gap: 10 },
  brandName: { fontSize: 26, fontWeight: '600', letterSpacing: 1, color: colors.inkHi },
  tagline: {
    fontSize: 15,
    color: colors.inkMid,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 240,
  },
  actions: { gap: 12 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 2 },
  line: { flex: 1, height: 1, backgroundColor: colors.hairline },
  dividerTxt: { fontFamily: fonts.mono, fontSize: 12, color: colors.inkLo, letterSpacing: 3 },
  legal: {
    fontSize: 11,
    color: colors.inkLo,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 18,
  },
  link: { color: colors.inkMid, textDecorationLine: 'underline' },
});
