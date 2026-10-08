import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppButton, Body, Heading, Notice, Screen, styles } from '@/components/ui';
import { useAnalysis } from '@/lib/analysis';
import { type DocumentSource, pickDocument } from '@/lib/pick-document';
import { useSettings } from '@/lib/settings';

export default function Home() {
  const { t, language, setLanguage } = useSettings();
  const { analyze } = useAnalysis();
  const [message, setMessage] = useState<string | null>(null);

  const start = async (source: DocumentSource) => {
    setMessage(null);
    const picked = await pickDocument(source).catch(() => ({ status: 'unsupported' as const }));
    if (picked.status === 'canceled') return;
    if (picked.status !== 'picked') {
      const key =
        picked.status === 'permission_denied'
          ? 'home.permissionDenied'
          : picked.status === 'too_large'
            ? 'home.tooLarge'
            : 'home.unsupported';
      setMessage(t(key));
      return;
    }
    void analyze(picked.document, language);
    router.push('/result');
  };

  return (
    <Screen>
      <Heading>{t('home.title')}</Heading>
      <Body>{t('home.intro')}</Body>

      <View style={{ gap: 10 }}>
        <AppButton label={t('home.takePhoto')} onPress={() => start('camera')} />
        <AppButton label={t('home.choosePhoto')} onPress={() => start('library')} />
        <AppButton label={t('home.choosePdf')} onPress={() => start('pdf')} />
        {__DEV__ ? (
          <AppButton
            variant="secondary"
            label={t('home.pasteText')}
            onPress={() => router.push('/paste')}
          />
        ) : null}
      </View>
      {message ? <Notice tone="warning">{message}</Notice> : null}

      <View style={{ gap: 8 }}>
        <Body muted>{t('home.language')}</Body>
        <View style={styles.row}>
          <AppButton
            variant={language === 'tr' ? 'primary' : 'secondary'}
            label="Türkçe"
            state={{ selected: language === 'tr' }}
            onPress={() => setLanguage('tr')}
          />
          <AppButton
            variant={language === 'en' ? 'primary' : 'secondary'}
            label="English"
            state={{ selected: language === 'en' }}
            onPress={() => setLanguage('en')}
          />
        </View>
      </View>

      <Notice tone="info">{t('home.disclaimer')}</Notice>
      <AppButton
        variant="secondary"
        label={t('home.about')}
        onPress={() => router.push('/about')}
      />
    </Screen>
  );
}
