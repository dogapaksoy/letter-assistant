import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  type AccessibilityState,
} from 'react-native';

/** High-contrast palettes; warnings never rely on colour alone (they always have text). */
const palettes = {
  light: {
    background: '#FFFFFF',
    text: '#111418',
    muted: '#4A5160',
    card: '#F4F6FA',
    border: '#C9CFD9',
    primary: '#1D4ED8',
    onPrimary: '#FFFFFF',
    warningBg: '#FFF4D6',
    warningBorder: '#9A5B00',
    warningText: '#4A2E00',
    infoBg: '#E8F0FF',
    infoBorder: '#1D4ED8',
    infoText: '#0F2A6B',
    highlight: '#FFE066',
    onHighlight: '#111418',
  },
  dark: {
    background: '#0F1115',
    text: '#F2F4F7',
    muted: '#B7BDC8',
    card: '#1B1F26',
    border: '#3B424F',
    primary: '#8AB0FF',
    onPrimary: '#0B1020',
    warningBg: '#3A2D0E',
    warningBorder: '#F0B14A',
    warningText: '#FFE5B3',
    infoBg: '#14213D',
    infoBorder: '#8AB0FF',
    infoText: '#DCE6FF',
    highlight: '#FFE066',
    onHighlight: '#111418',
  },
};

export type Palette = typeof palettes.light;

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? palettes.dark : palettes.light;
}

export function Screen({ children }: { children: ReactNode }) {
  const palette = usePalette();
  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Heading({ children, level = 1 }: { children: ReactNode; level?: 1 | 2 }) {
  const palette = usePalette();
  return (
    <Text
      accessibilityRole="header"
      style={[level === 1 ? styles.h1 : styles.h2, { color: palette.text }]}
    >
      {children}
    </Text>
  );
}

export function Body({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  const palette = usePalette();
  return (
    <Text style={[styles.body, { color: muted ? palette.muted : palette.text }]}>{children}</Text>
  );
}

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  hint,
  disabled = false,
  state,
}: {
  label: string;
  onPress(): void;
  variant?: 'primary' | 'secondary';
  hint?: string;
  disabled?: boolean;
  state?: AccessibilityState;
}) {
  const palette = usePalette();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={hint}
      accessibilityState={{ disabled, ...state }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: primary ? palette.primary : 'transparent',
          borderColor: palette.primary,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text style={[styles.buttonLabel, { color: primary ? palette.onPrimary : palette.primary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Notice({ tone, children }: { tone: 'warning' | 'info'; children: ReactNode }) {
  const palette = usePalette();
  const colors =
    tone === 'warning'
      ? { bg: palette.warningBg, border: palette.warningBorder, text: palette.warningText }
      : { bg: palette.infoBg, border: palette.infoBorder, text: palette.infoText };
  return (
    <View style={[styles.notice, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <Text style={[styles.body, { color: colors.text }]}>
        {tone === 'warning' ? '⚠ ' : 'ⓘ '}
        {children}
      </Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { padding: 16, gap: 16, paddingBottom: 48 },
  h1: { fontSize: 26, fontWeight: '700' },
  h2: { fontSize: 21, fontWeight: '700', marginTop: 8 },
  body: { fontSize: 17, lineHeight: 25 },
  button: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonLabel: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  notice: { borderWidth: 2, borderRadius: 10, padding: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
