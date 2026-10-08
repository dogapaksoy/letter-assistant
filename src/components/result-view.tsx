import { ActivityIndicator, View } from 'react-native';

import type { AnalysisState, ItemRef, Section } from '../lib/analysis';
import { itemKey } from '../lib/analysis';
import type { CalendarEventData } from '../lib/calendar';
import { buildCalendarEvent } from '../lib/calendar';
import type { StringKey } from '../lib/i18n';
import { type CardItem, ItemCard } from './item-card';
import { AppButton, Body, Heading, Notice, usePalette } from './ui';

type T = (key: StringKey, params?: Record<string, string | number>) => string;

/** Loading, error and result states of an analysis. Navigation is passed in as callbacks. */
export function ResultView({
  state,
  t,
  onShowSource,
  onReport,
  onAddToCalendar,
  onNewLetter,
}: {
  state: AnalysisState;
  t: T;
  onShowSource(ref: ItemRef): void;
  onReport(ref: ItemRef): void;
  onAddToCalendar(event: CalendarEventData): void;
  onNewLetter(): void;
}) {
  const palette = usePalette();

  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <View
        accessibilityLiveRegion="polite"
        style={{ gap: 12, alignItems: 'center', paddingTop: 32 }}
      >
        <ActivityIndicator size="large" color={palette.primary} />
        <Heading>{t('analyzing.title')}</Heading>
        <Body muted>{t('analyzing.body')}</Body>
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View accessibilityLiveRegion="assertive" style={{ gap: 16 }}>
        <Heading>{t('error.title')}</Heading>
        <Notice tone="warning">{t(`error.${state.error}`)}</Notice>
        <AppButton label={t('error.retry')} onPress={onNewLetter} />
      </View>
    );
  }

  const { result, language, corrections } = state;
  const droppedCount = result.dropped.summary + result.dropped.deadlines + result.dropped.actions;

  const renderSection = (section: Section, title: string, toCard: (index: number) => CardItem) => {
    const items = result.extraction[section];
    return (
      <View style={{ gap: 12 }}>
        <Heading level={2}>{title}</Heading>
        {items.length === 0 ? <Body muted>{t('result.none')}</Body> : null}
        {items.map((_, index) => {
          const ref = { section, index };
          const card = toCard(index);
          const event =
            card.kind === 'deadline' ? buildCalendarEvent(card.item, t('calendar.notes')) : null;
          return (
            <ItemCard
              key={itemKey(ref)}
              card={card}
              language={language}
              t={t}
              correction={corrections[itemKey(ref)]}
              onShowSource={() => onShowSource(ref)}
              onReport={() => onReport(ref)}
              onAddToCalendar={event ? () => onAddToCalendar(event) : undefined}
            />
          );
        })}
      </View>
    );
  };

  return (
    <View style={{ gap: 16 }}>
      {result.devMode ? <Notice tone="warning">{t('result.devMode')}</Notice> : null}
      <Notice tone="info">{t('result.checkOriginal')}</Notice>
      {droppedCount > 0 ? (
        <Notice tone="warning">{t('result.dropped', { count: droppedCount })}</Notice>
      ) : null}
      {renderSection('summary', t('result.summary'), (i) => ({
        kind: 'summary',
        item: result.extraction.summary[i]!,
      }))}
      {renderSection('deadlines', t('result.deadlines'), (i) => ({
        kind: 'deadline',
        item: result.extraction.deadlines[i]!,
      }))}
      {renderSection('actions', t('result.actions'), (i) => ({
        kind: 'action',
        item: result.extraction.actions[i]!,
      }))}
      <AppButton variant="secondary" label={t('result.newLetter')} onPress={onNewLetter} />
    </View>
  );
}
