import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { ExtractSuccess } from '@/core/api/contract';

import { AnalysisProvider, parseItemRef, useAnalysis } from './analysis';
import type { AnalyzeResult } from './api';

const success = {
  ok: true,
  letterText: 'Brief',
  textMethod: 'text',
  spans: [],
  extraction: { summary: [], deadlines: [], actions: [] },
  dropped: { summary: 0, deadlines: 0, actions: 0 },
  model: 'm',
  promptVersion: 'extraction-v1',
  devMode: false,
} satisfies ExtractSuccess;

function setup(extract: () => Promise<AnalyzeResult>) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AnalysisProvider extract={extract}>{children}</AnalysisProvider>
  );
  return renderHook(() => useAnalysis(), { wrapper });
}

describe('AnalysisProvider', () => {
  it('goes from loading to done and keeps corrections in memory', async () => {
    const { result } = setup(async () => ({ ok: true, data: success }));

    act(() => {
      void result.current.analyze({ kind: 'text', text: 'Brief' }, 'tr');
    });
    expect(result.current.state.status).toBe('loading');
    await waitFor(() => expect(result.current.state.status).toBe('done'));

    act(() => result.current.correct({ section: 'actions', index: 0 }, { category: 'other' }));
    expect(result.current.state).toMatchObject({
      language: 'tr',
      corrections: { 'actions:0': { category: 'other' } },
    });

    act(() => result.current.reset());
    expect(result.current.state).toEqual({ status: 'idle' });
  });

  it('keeps the photo in memory for marking sources, but not for text', async () => {
    const { result } = setup(async () => ({ ok: true, data: success }));
    await act(() =>
      result.current.analyze({ kind: 'image', base64: 'AAAA', mimeType: 'image/jpeg' }, 'tr'),
    );
    expect(result.current.state).toMatchObject({ image: 'data:image/jpeg;base64,AAAA' });

    await act(() => result.current.analyze({ kind: 'text', text: 'Brief' }, 'tr'));
    expect(result.current.state).toMatchObject({ status: 'done', image: undefined });
  });

  it('reports errors', async () => {
    const { result } = setup(async () => ({ ok: false, error: 'network' }));
    await act(() => result.current.analyze({ kind: 'text', text: 'x' }, 'en'));
    expect(result.current.state).toEqual({ status: 'error', error: 'network' });
  });

  it('ignores the result of an analysis the user abandoned', async () => {
    let finish: (value: AnalyzeResult) => void = () => {};
    const { result } = setup(() => new Promise((resolve) => (finish = resolve)));

    act(() => {
      void result.current.analyze({ kind: 'text', text: 'old' }, 'en');
    });
    act(() => result.current.reset());
    await act(async () => finish({ ok: true, data: success }));
    expect(result.current.state).toEqual({ status: 'idle' });
  });
});

describe('parseItemRef', () => {
  it('accepts valid params and rejects anything else', () => {
    expect(parseItemRef({ section: 'deadlines', index: '2' })).toEqual({
      section: 'deadlines',
      index: 2,
    });
    expect(parseItemRef({ section: 'letters', index: '0' })).toBeNull();
    expect(parseItemRef({ section: 'actions', index: '-1' })).toBeNull();
    expect(parseItemRef({ section: 'actions', index: 'x' })).toBeNull();
    expect(parseItemRef({})).toBeNull();
  });
});
