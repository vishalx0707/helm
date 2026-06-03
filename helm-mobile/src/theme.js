import { Platform } from 'react-native';

/**
 * HELM Mobile design tokens — the dark, pure-monochrome system defined by
 * helm-mobile-prototype/index.html (which supersedes the aurora direction in
 * design.md). White is the ONLY accent: primary buttons, selected states, the
 * live connection dot. Everything else is grayscale on near-black.
 *
 * Geist / Geist Mono are the intended typefaces. To keep the app runnable with
 * zero font-download risk, we fall back to the platform's system UI face and a
 * platform monospace; drop Geist .ttf files into assets/ and load them with
 * expo-font to match the prototype exactly. Mono is reserved for machine
 * artifacts only: paths, pairing codes, agent versions, console output.
 */

export const colors = {
  bg: '#0A0A0B',
  surface: '#131316',
  surface2: '#1B1B1F',
  consoleBg: '#08080A',

  hairline: 'rgba(255,255,255,0.08)',
  hairline2: 'rgba(255,255,255,0.14)',

  inkHi: '#FAFAFA',
  inkMid: '#A1A1A6',
  inkLo: '#6B6B70',

  fill: '#FFFFFF', // the only accent
  onFill: '#0A0A0B',

  // stream colors stay grayscale — stderr is just brighter ink, never red
  ok: '#FAFAFA',
  err: '#FAFAFA',
};

export const radius = {
  input: 12,
  card: 18,
  sheet: 28,
  pill: 999,
};

export const space = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
};

export const fonts = {
  ui: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
  uiMedium: Platform.select({ ios: 'System', android: 'sans-serif-medium', default: 'System' }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
};

// Convenience text presets used across screens.
export const type = {
  hero: { fontSize: 27, fontWeight: '600', letterSpacing: -0.6, color: colors.inkHi },
  title: { fontSize: 20, fontWeight: '600', letterSpacing: -0.3, color: colors.inkHi },
  section: { fontSize: 21, fontWeight: '600', letterSpacing: -0.3, color: colors.inkHi },
  body: { fontSize: 15, color: colors.inkHi },
  muted: { fontSize: 14, color: colors.inkMid },
  dim: { fontSize: 13, color: colors.inkLo },
  mono: { fontFamily: fonts.mono, color: colors.inkMid },
};
