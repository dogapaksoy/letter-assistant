import { fireEvent, render, screen } from '@testing-library/react-native';

import type { ExtractSuccess } from '@/core/api/contract';
import type { AnalysisState } from '@/lib/analysis';
import { translate } from '@/lib/i18n';

import { ReportForm } from './report-form';
import { ResultView } from './result-view';
import { SourceView } from './source-view';

const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) =>
  translate('en', key, params);

const LETTER = 'Bitte zahlen Sie den Betrag von 412,00 Euro spätestens am 26.10.2026.';
const verified = (start: number, end: number) => ({
  status: 'verified' as const,
  match: { start, end, similarity: 1, exact: true },
});
const unverified = { status: 'unverified' as const, reason: 'not_found' as const };

const result: ExtractSuccess = {
  ok: true,
  letterText: LETTER,
  textMethod: 'text',
  spans: [],
  extraction: {
    summary: [
      {
        value: 'You owe 412 euros.',
        source_quote: '412,00 Euro',
        confidence: 'high',
        verification: verified(32, 43),
      },
    ],
    deadlines: [
      {
        value: 'Pay 412 euros.',
        source_quote: 'spätestens am 26.10.2026',
        confidence: 'high',
        kind: 'due_date',
        date: '2026-10-26',
        verification: verified(44, 68),
      },
      {
        value: 'Object within one month.',
        source_quote: 'binnen eines Monats',
        confidence: 'medium',
        kind: 'relative',
        date: null,
        verification: unverified,
      },
    ],
    actions: [
      {
        value: 'Apply for an exemption.',
        source_quote: 'Befreiung',
        confidence: 'low',
        type: 'conditional',
        condition: 'If you receive BAföG',
        verification: verified(0, 5),
      },
    ],
  },
  dropped: { summary: 0, deadlines: 1, actions: 0 },
  model: 'm',
  promptVersion: 'extraction-v1',
  devMode: true,
};

const done: AnalysisState = { status: 'done', result, language: 'en', corrections: {} };

function renderResult(state: AnalysisState) {
  const handlers = {
    onShowSource: jest.fn(),
    onReport: jest.fn(),
    onAddToCalendar: jest.fn(),
    onNewLetter: jest.fn(),
  };
  render(<ResultView state={state} t={t} {...handlers} />);
  return handlers;
}

describe('ResultView', () => {
  it('shows a loading state', () => {
    renderResult({ status: 'loading' });
    expect(screen.getByText('Reading your letter…')).toBeOnTheScreen();
  });

  it('explains errors and offers a way back', () => {
    const handlers = renderResult({ status: 'error', error: 'ocr_not_configured' });
    expect(screen.getByText(/Reading photos is not ready yet/)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Start again' }));
    expect(handlers.onNewLetter).toHaveBeenCalled();
  });

  it('shows items with dates, labels, and the not-legal-advice and test-mode notices', () => {
    renderResult(done);
    expect(screen.getByText(/not legal advice/)).toBeOnTheScreen();
    expect(screen.getByText(/Test mode/)).toBeOnTheScreen();
    expect(screen.getByText(/1 items cannot be shown/)).toBeOnTheScreen();
    expect(screen.getByText(/26 October 2026/)).toBeOnTheScreen();
    expect(screen.getByText('Only if: If you receive BAföG')).toBeOnTheScreen();
  });

  it('warns in words about unverified and uncertain items, and explains relative deadlines', () => {
    renderResult(done);
    expect(screen.getByText(/Not found in the letter/)).toBeOnTheScreen();
    expect(screen.getByText(/We are not sure/)).toBeOnTheScreen();
    expect(screen.getByText(/The letter gives no exact date/)).toBeOnTheScreen();
  });

  it('offers the calendar only for dated deadlines', () => {
    const handlers = renderResult(done);
    const buttons = screen.getAllByRole('button', { name: 'Add to calendar' });
    expect(buttons).toHaveLength(1);
    fireEvent.press(buttons[0]!);
    expect(handlers.onAddToCalendar).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Pay 412 euros.', allDay: true }),
    );
  });

  it('passes the item reference to source and report actions', () => {
    const handlers = renderResult(done);
    fireEvent.press(screen.getAllByRole('button', { name: 'Show in letter' })[1]!);
    expect(handlers.onShowSource).toHaveBeenCalledWith({ section: 'deadlines', index: 0 });
    fireEvent.press(screen.getAllByRole('button', { name: 'Wrong?' })[3]!);
    expect(handlers.onReport).toHaveBeenCalledWith({ section: 'actions', index: 0 });
  });

  it('shows the user’s local correction', () => {
    renderResult({
      ...done,
      corrections: { 'deadlines:0': { category: 'wrong_date', correctedText: 'It is 27.10.' } },
    });
    expect(screen.getByText(/Your correction: It is 27\.10\./)).toBeOnTheScreen();
  });
});

describe('SourceView', () => {
  it('highlights the verified passage and repeats it for screen readers', () => {
    render(<SourceView letterText={LETTER} value="Pay." verification={verified(44, 68)} t={t} />);
    expect(screen.getByLabelText('Highlighted text: spätestens am 26.10.2026')).toBeOnTheScreen();
    expect(screen.getAllByText('spätestens am 26.10.2026').length).toBeGreaterThan(0);
  });

  it('warns when the passage was not found', () => {
    render(<SourceView letterText={LETTER} value="Pay." verification={unverified} t={t} />);
    expect(screen.getByText(/We could not find matching text/)).toBeOnTheScreen();
  });
});

describe('ReportForm', () => {
  it('only submits once a category is chosen, with the optional local text', () => {
    const onSubmit = jest.fn();
    render(<ReportForm t={t} onSubmit={onSubmit} />);

    const submit = screen.getByRole('button', { name: 'Send' });
    expect(submit).toBeDisabled();

    fireEvent.press(screen.getByRole('radio', { name: /Wrong date/ }));
    fireEvent.changeText(
      screen.getByLabelText('Correct version (optional, stays on your phone)'),
      '  27.10.2026 ',
    );
    fireEvent.press(submit);
    expect(onSubmit).toHaveBeenCalledWith('wrong_date', '27.10.2026');
  });
});
