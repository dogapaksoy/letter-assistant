import { Stack } from 'expo-router';

import { usePalette } from '@/components/ui';
import { AnalysisProvider } from '@/lib/analysis';
import { SettingsProvider, useSettings } from '@/lib/settings';

function AppStack() {
  const { t } = useSettings();
  const palette = usePalette();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.background },
        headerTintColor: palette.text,
        contentStyle: { backgroundColor: palette.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: t('app.name') }} />
      <Stack.Screen name="result" options={{ title: t('result.title') }} />
      <Stack.Screen name="source" options={{ title: t('source.title') }} />
      <Stack.Screen name="report" options={{ title: t('report.title'), presentation: 'modal' }} />
      <Stack.Screen name="about" options={{ title: t('about.title') }} />
      <Stack.Screen name="paste" options={{ title: t('home.pasteText') }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SettingsProvider>
      <AnalysisProvider>
        <AppStack />
      </AnalysisProvider>
    </SettingsProvider>
  );
}
