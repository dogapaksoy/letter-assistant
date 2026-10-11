import { buildCalendarEvent } from './calendar';
import { buildCorrectionReport, submitCorrectionReport } from './corrections';
import { daysUntil, formatDate } from './format';
import { translate } from './i18n';
import { toDocument } from './pick-document';

const verified = {
  status: 'verified' as const,
  match: { start: 0, end: 5, similarity: 1, exact: true },
};

describe('translate', () => {
  it('returns strings in both languages and fills parameters', () => {
    expect(translate('tr', 'result.deadlines')).toBe('Son tarihler');
    expect(translate('en', 'result.dropped', { count: 2 })).toContain('2 items');
    expect(translate('en', 'result.dropped')).toContain('{count}');
  });
});

describe('formatDate', () => {
  it('formats calendar dates with the weekday in the chosen language', () => {
    // Exact punctuation depends on the ICU version (Node vs. Hermes), so check the parts.
    expect(formatDate('2026-10-26', 'en')).toMatch(/^Monday,? 26 October 2026$/);
    expect(formatDate('2026-10-26', 'tr')).toMatch(/^26 Ekim 2026,? Pazartesi$/);
  });

  it('returns the input for invalid dates', () => {
    expect(formatDate('not-a-date', 'en')).toBe('not-a-date');
  });

  it('counts calendar days', () => {
    const today = new Date(2026, 9, 8, 23, 30);
    expect(daysUntil('2026-10-08', today)).toBe(0);
    expect(daysUntil('2026-10-26', today)).toBe(18);
    expect(daysUntil('2026-10-01', today)).toBe(-7);
  });
});

describe('buildCalendarEvent', () => {
  it('creates a one-hour event for appointments with a time', () => {
    const event = buildCalendarEvent(
      { kind: 'appointment', date: '2026-10-28', time: '09:30', value: 'Appointment' },
      'notes',
    );
    expect(event).toMatchObject({ title: 'Appointment', allDay: false, notes: 'notes' });
    expect(event?.startDate.getHours()).toBe(9);
    expect(event?.startDate.getMinutes()).toBe(30);
    expect((event!.endDate.getTime() - event!.startDate.getTime()) / 60_000).toBe(60);
    expect(event?.alarms).toEqual([{ relativeOffset: -1440 }, { relativeOffset: -120 }]);
  });

  it('creates an all-day event for due dates', () => {
    const event = buildCalendarEvent({ kind: 'due_date', date: '2026-10-26', value: 'Pay' }, 'n');
    expect(event).toMatchObject({ allDay: true });
    expect(event?.startDate.getDate()).toBe(26);
    // 3 days and 1 day before, at 09:00.
    expect(event?.alarms).toEqual([{ relativeOffset: -3780 }, { relativeOffset: -900 }]);
  });

  it('never creates an event for relative deadlines', () => {
    expect(
      buildCalendarEvent({ kind: 'relative', date: null, value: 'Within 14 days' }, 'n'),
    ).toBeNull();
  });

  it('shortens long titles', () => {
    const event = buildCalendarEvent(
      { kind: 'due_date', date: '2026-10-26', value: 'x'.repeat(200) },
      'n',
    );
    expect(event?.title).toHaveLength(80);
  });
});

describe('buildCorrectionReport', () => {
  it('contains categories and metadata only', () => {
    const report = buildCorrectionReport({
      itemKind: 'deadline',
      item: { confidence: 'high', verification: verified, kind: 'appointment' },
      category: 'wrong_date',
      language: 'tr',
      promptVersion: 'extraction-v1',
      model: 'gemini-3.5-flash',
    });
    expect(report).toEqual({
      item_kind: 'deadline',
      error_category: 'wrong_date',
      deadline_kind: 'appointment',
      confidence: 'high',
      verification_status: 'verified',
      language: 'tr',
      prompt_version: 'extraction-v1',
      model: 'gemini-3.5-flash',
    });
  });

  it('replaces unexpected metadata and drops deadline_kind for other items', () => {
    const report = buildCorrectionReport({
      itemKind: 'action',
      item: { confidence: 'low', verification: { status: 'unverified', reason: 'not_found' } },
      category: 'other',
      language: 'en',
      promptVersion: 'Bad Version!',
      model: 'model with spaces',
    });
    expect(report).toMatchObject({
      deadline_kind: null,
      prompt_version: 'unknown',
      model: 'unknown',
    });
  });
});

describe('submitCorrectionReport', () => {
  const report = buildCorrectionReport({
    itemKind: 'summary',
    item: { confidence: 'high', verification: verified },
    category: 'other',
    language: 'en',
    promptVersion: 'extraction-v1',
    model: 'm',
  });

  it('returns true on success and false on errors or exceptions', async () => {
    await expect(submitCorrectionReport(report, async () => ({ error: null }))).resolves.toBe(true);
    await expect(submitCorrectionReport(report, async () => ({ error: 'denied' }))).resolves.toBe(
      false,
    );
    await expect(
      submitCorrectionReport(report, async () => {
        throw new Error('offline');
      }),
    ).resolves.toBe(false);
  });
});

describe('toDocument', () => {
  it('maps PDFs and supported images', () => {
    expect(toDocument({ base64: 'abc', mimeType: 'application/pdf' })).toEqual({
      status: 'picked',
      document: { kind: 'pdf', base64: 'abc' },
    });
    expect(toDocument({ base64: 'abc', mimeType: 'image/jpg' })).toEqual({
      status: 'picked',
      document: { kind: 'image', base64: 'abc', mimeType: 'image/jpeg' },
    });
  });

  it('rejects missing data, unsupported types and oversized files', () => {
    expect(toDocument({ mimeType: 'image/png' })).toEqual({ status: 'unsupported' });
    expect(toDocument({ base64: 'abc', mimeType: 'image/gif' })).toEqual({ status: 'unsupported' });
    expect(toDocument({ base64: 'a'.repeat(10_000_001), mimeType: 'image/png' })).toEqual({
      status: 'too_large',
    });
  });
});
