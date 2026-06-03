import React from 'react';
import { Pressable, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, fonts } from '../theme';

/**
 * Primary action button. Two variants from the prototype:
 *   fill  — white background, near-black ink (the main CTA)
 *   ghost — transparent with a hairline border
 * Presses scale down slightly (the prototype's :active feel).
 */
export default function Button({
  label,
  onPress,
  variant = 'fill',
  icon, // Feather icon name (optional)
  iconNode, // custom node before label (optional)
  disabled = false,
  loading = false,
  style,
}) {
  const isFill = variant === 'fill';
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        isFill ? styles.fill : styles.ghost,
        pressed && !disabled && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isFill ? colors.onFill : colors.inkHi} size="small" />
      ) : (
        <>
          {iconNode}
          {icon ? (
            <Feather name={icon} size={18} color={isFill ? colors.onFill : colors.inkHi} />
          ) : null}
          <Text style={[styles.label, { color: isFill ? colors.onFill : colors.inkHi }]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 52,
    borderRadius: radius.input,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    width: '100%',
  },
  fill: { backgroundColor: colors.fill },
  ghost: { backgroundColor: 'transparent', borderColor: colors.hairline2 },
  pressed: { transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.45 },
  label: { fontSize: 15, fontWeight: '600', fontFamily: fonts.ui, letterSpacing: -0.15 },
});
