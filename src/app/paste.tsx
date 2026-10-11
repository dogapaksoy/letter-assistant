import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { AppButton, Notice, Screen, styles, usePalette } from '@/components/ui';
import { MAX_TEXT_LENGTH } from '@/core/api/contract';
import { useAnalysis } from '@/lib/analysis';
import { DEV_SAMPLE_LETTERS } from '@/lib/dev-samples';
import { useSettings } from '@/lib/settings';

/**
 * Development only (linked from the home screen in __DEV__): analyse pasted text, e.g. a
 * synthetic eval letter, without needing OCR. The sample buttons fill in the synthetic
 * letters, since copying text from a computer to a phone is awkward.
 */
export default function Paste() {
  const { t, language } = useSettings();
  const { analyze } = useAnalysis();
  const palette = usePalette();
  const [text, setText] = useState('');

  return (
    <Screen>
      <Notice tone="warning">{t('result.devMode')}</Notice>
      <View style={styles.row}>
        {DEV_SAMPLE_LETTERS.map((sample) => (
          <AppButton
            key={sample.id}
            variant="secondary"
            label={sample.id}
            onPress={() => setText(sample.text)}
          />
        ))}
      </View>
      <TextInput
        accessibilityLabel={t('home.pasteText')}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={MAX_TEXT_LENGTH}
        style={[
          styles.body,
          {
            minHeight: 240,
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
        disabled={text.trim().length === 0}
        onPress={() => {
          void analyze({ kind: 'text', text }, language);
          router.replace('/result');
        }}
      />
    </Screen>
  );
}
