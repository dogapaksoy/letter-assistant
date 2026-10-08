import { Body, Heading, Screen } from '@/components/ui';
import { useSettings } from '@/lib/settings';

export default function About() {
  const { t } = useSettings();
  return (
    <Screen>
      <Heading>{t('about.title')}</Heading>
      {t('about.body')
        .split('\n\n')
        .map((paragraph) => (
          <Body key={paragraph}>{paragraph}</Body>
        ))}
    </Screen>
  );
}
