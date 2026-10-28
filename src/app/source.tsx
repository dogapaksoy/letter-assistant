import { useLocalSearchParams } from 'expo-router';

import { SourceView } from '@/components/source-view';
import { Body, Screen } from '@/components/ui';
import { getItem, parseItemRef, useAnalysis } from '@/lib/analysis';
import { useSettings } from '@/lib/settings';

export default function Source() {
  const { t } = useSettings();
  const { state } = useAnalysis();
  const params = useLocalSearchParams<{ section: string; index: string }>();
  const ref = parseItemRef(params);
  const item = state.status === 'done' && ref ? getItem(state.result, ref) : undefined;

  return (
    <Screen>
      {state.status === 'done' && item ? (
        <SourceView
          letterText={state.result.letterText}
          image={state.image}
          spans={state.result.spans}
          value={item.value}
          verification={item.verification}
          t={t}
        />
      ) : (
        <Body>{t('result.none')}</Body>
      )}
    </Screen>
  );
}
