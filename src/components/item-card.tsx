import { Text, View } from 'react-native';

import type { ExtractSuccess } from '../core/api/contract';
import type { OutputLanguage } from '../core/extraction/prompt';
import type { LocalCorrection } from '../lib/analysis';
import { formatDate } from '../lib/format';
import type { StringKey } from '../lib/i18n';
import { AppButton, Body, Notice, styles, usePalette } from './ui';

type Extraction = ExtractSuccess['extraction'];
export type CardItem =
  | { kind: 'summary'; item: Extraction['summary'][number] }
  | { kind: 'deadline'; item: Extraction['deadlines'][number] }
  | { kind: 'action'; item: Extraction['actions'][number] };

/**
 * One extracted item. Uncertainty is shown in words, next to the item: "not found in the
 * letter" when the quote could not be verified, and a check-this note for medium/low
 * confidence. The user can always open the source or report an error.
 */
export function ItemCard({
  card,
  language,
  t,
  correction,
  onShowSource,
  onReport,
  onAddToCalendar,
}: {
  card: CardItem;
  language: OutputLanguage;
  t(key: StringKey, params?: Record<string, string | number>): string;
  correction?: LocalCorrection;
  onShowSource(): void;
  onReport(): void;
  onAddToCalendar?(): void;
}) {
  const palette = usePalette();
  const { item } = card;
  const unverified = item.verification.status === 'unverified';

  let label: string | null = null;
  let headline: string | null = null;
  if (card.kind === 'deadline') {
    label = t(`deadline.${card.item.kind}`);
    if (card.item.date) {
      headline =
        formatDate(card.item.date, language) + (card.item.time ? `, ${card.item.time}` : '');
    }
  } else if (card.kind === 'action') {
    label = t(`action.${card.item.type}`);
    if (card.item.type === 'conditional' && card.item.condition) {
      label = `${label}: ${card.item.condition}`;
    }
  }

  return (
    <View
      style={{
        backgroundColor: palette.card,
        borderColor: unverified ? palette.warningBorder : palette.border,
        borderWidth: unverified ? 2 : 1,
        borderRadius: 12,
        padding: 14,
        gap: 10,
      }}
    >
      {label ? (
        <Text style={[styles.body, { color: palette.muted, fontWeight: '600' }]}>{label}</Text>
      ) : null}
      {headline ? (
        <Text style={[styles.h2, { color: palette.text, marginTop: 0 }]}>{headline}</Text>
      ) : null}
      <Body>{item.value}</Body>

      {card.kind === 'deadline' && card.item.kind === 'relative' ? (
        <Notice tone="info">{t('result.relativeDeadline')}</Notice>
      ) : null}
      {unverified ? <Notice tone="warning">{t('result.unverified')}</Notice> : null}
      {!unverified && item.confidence !== 'high' ? (
        <Notice tone="warning">
          {t(item.confidence === 'low' ? 'result.lowConfidence' : 'result.mediumConfidence')}
        </Notice>
      ) : null}
      {correction ? (
        <Notice tone="info">
          {t('result.corrected')}: {correction.correctedText || t(`report.${correction.category}`)}
        </Notice>
      ) : null}

      <View style={styles.row}>
        <AppButton variant="secondary" label={t('result.showSource')} onPress={onShowSource} />
        {onAddToCalendar ? (
          <AppButton
            variant="secondary"
            label={t('result.addToCalendar')}
            onPress={onAddToCalendar}
          />
        ) : null}
        <AppButton variant="secondary" label={t('result.report')} onPress={onReport} />
      </View>
    </View>
  );
}
