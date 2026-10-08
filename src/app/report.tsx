import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { ReportForm } from '@/components/report-form';
import { AppButton, Body, Notice, Screen } from '@/components/ui';
import { getItem, parseItemRef, useAnalysis } from '@/lib/analysis';
import { buildCorrectionReport, submitCorrectionReport } from '@/lib/corrections';
import { useSettings } from '@/lib/settings';

const ITEM_KIND = { summary: 'summary', deadlines: 'deadline', actions: 'action' } as const;

export default function Report() {
  const { t } = useSettings();
  const { state, correct } = useAnalysis();
  const params = useLocalSearchParams<{ section: string; index: string }>();
  const ref = parseItemRef(params);
  const [sent, setSent] = useState<boolean | null>(null);

  if (state.status !== 'done' || !ref) {
    return (
      <Screen>
        <Body>{t('result.none')}</Body>
      </Screen>
    );
  }
  const item = getItem(state.result, ref);
  if (!item) {
    return (
      <Screen>
        <Body>{t('result.none')}</Body>
      </Screen>
    );
  }

  if (sent !== null) {
    return (
      <Screen>
        <Notice tone="info">{t(sent ? 'report.thanks' : 'report.sendFailed')}</Notice>
        <AppButton label="OK" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Body muted>{item.value}</Body>
      <ReportForm
        t={t}
        onSubmit={async (category, correctedText) => {
          correct(ref, { category, correctedText: correctedText || undefined });
          const report = buildCorrectionReport({
            itemKind: ITEM_KIND[ref.section],
            item: { ...item, kind: 'kind' in item ? item.kind : undefined },
            category,
            language: state.language,
            promptVersion: state.result.promptVersion,
            model: state.result.model,
          });
          setSent(await submitCorrectionReport(report));
        }}
      />
    </Screen>
  );
}
