import { Text, View } from 'react-native';

import type { ExtractSuccess } from '../core/api/contract';
import type { QuoteVerification } from '../core/verification/match';
import { boxesForRange } from '../lib/highlight';
import type { StringKey } from '../lib/i18n';
import { PhotoHighlight } from './photo-highlight';
import { Body, Notice, styles, usePalette } from './ui';

/**
 * Shows the letter text with the item's source passage highlighted. The highlighted
 * passage is also repeated at the top, so screen-reader users hear it first and nobody
 * has to search the whole letter. For photos, the passage is also marked on the image.
 */
export function SourceView({
  image,
  spans = [],
  letterText,
  value,
  verification,
  t,
}: {
  letterText: string;
  value: string;
  verification: QuoteVerification;
  t(key: StringKey, params?: Record<string, string | number>): string;
  /** The letter photo (data URI), kept in memory only; absent for PDFs and pasted text. */
  image?: string;
  spans?: ExtractSuccess['spans'];
}) {
  const palette = usePalette();

  if (verification.status === 'unverified') {
    return (
      <View style={{ gap: 16 }}>
        <Body>{value}</Body>
        <Notice tone="warning">{t('source.notFound')}</Notice>
        <Text style={[styles.body, { color: palette.text }]}>{letterText}</Text>
      </View>
    );
  }

  const { start, end } = verification.match;
  const before = letterText.slice(0, start);
  const passage = letterText.slice(start, end);
  const after = letterText.slice(end);
  const highlight = { backgroundColor: palette.highlight, color: palette.onHighlight };
  const boxes = image ? boxesForRange(spans, start, end) : [];

  return (
    <View style={{ gap: 16 }}>
      <Body>{value}</Body>
      {image && boxes.length > 0 ? (
        <PhotoHighlight uri={image} boxes={boxes} label={t('source.photoLabel')} />
      ) : null}
      <View
        accessible
        accessibilityLabel={t('source.highlightLabel', { text: passage })}
        style={{ borderLeftWidth: 4, borderColor: palette.highlight, paddingLeft: 12 }}
      >
        <Text style={[styles.body, highlight, { fontWeight: '600' }]}>{passage}</Text>
      </View>
      <Text style={[styles.body, { color: palette.text }]}>
        {before}
        <Text style={[highlight, { fontWeight: '700' }]}>{passage}</Text>
        {after}
      </Text>
    </View>
  );
}
