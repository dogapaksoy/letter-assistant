import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { ERROR_CATEGORIES, type ErrorCategory } from '../lib/corrections';
import type { StringKey } from '../lib/i18n';
import { AppButton, Body, Notice, styles, usePalette } from './ui';

/** Lets the user say what is wrong. Only the category is ever sent; the text stays local. */
export function ReportForm({
  t,
  onSubmit,
}: {
  t(key: StringKey): string;
  onSubmit(category: ErrorCategory, correctedText: string): void;
}) {
  const palette = usePalette();
  const [category, setCategory] = useState<ErrorCategory | null>(null);
  const [text, setText] = useState('');

  return (
    <View style={{ gap: 16 }}>
      <Notice tone="info">{t('report.intro')}</Notice>
      <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
        {ERROR_CATEGORIES.map((option) => {
          const selected = option === category;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => setCategory(option)}
              style={{
                minHeight: 48,
                borderRadius: 10,
                borderWidth: selected ? 3 : 1,
                borderColor: selected ? palette.primary : palette.border,
                backgroundColor: palette.card,
                padding: 12,
                justifyContent: 'center',
              }}
            >
              <Text style={[styles.body, { color: palette.text }]}>
                {selected ? '● ' : '○ '}
                {t(`report.${option}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Body muted>{t('report.correctionLabel')}</Body>
      <TextInput
        accessibilityLabel={t('report.correctionLabel')}
        value={text}
        onChangeText={setText}
        multiline
        style={[
          styles.body,
          {
            minHeight: 96,
            borderWidth: 1,
            borderColor: palette.border,
            borderRadius: 10,
            padding: 12,
            color: palette.text,
            textAlignVertical: 'top',
          },
        ]}
      />
      <AppButton
        label={t('report.submit')}
        disabled={!category}
        onPress={() => category && onSubmit(category, text.trim())}
      />
    </View>
  );
}
