import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from 'react';

import type { ExtractRequest, ExtractSuccess } from '../core/api/contract';
import type { OutputLanguage } from '../core/extraction/prompt';
import { type ClientError, requestExtraction } from './api';
import type { ErrorCategory } from './corrections';

export type Section = 'summary' | 'deadlines' | 'actions';

export interface ItemRef {
  section: Section;
  index: number;
}

/** A user's correction. Lives only in memory on this device. */
export interface LocalCorrection {
  category: ErrorCategory;
  correctedText?: string;
}

/**
 * The current analysis. Privacy: results and the letter text are kept in memory only and
 * are gone when the app closes or the user starts a new letter.
 */
export type AnalysisState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: ClientError }
  | {
      status: 'done';
      result: ExtractSuccess;
      language: OutputLanguage;
      corrections: Record<string, LocalCorrection>;
    };

interface Analysis {
  state: AnalysisState;
  analyze(document: ExtractRequest['document'], language: OutputLanguage): Promise<void>;
  correct(ref: ItemRef, correction: LocalCorrection): void;
  reset(): void;
}

export const itemKey = (ref: ItemRef) => `${ref.section}:${ref.index}`;

const AnalysisContext = createContext<Analysis | null>(null);

export function AnalysisProvider({
  children,
  initialState = { status: 'idle' },
  extract = requestExtraction,
}: {
  children: ReactNode;
  initialState?: AnalysisState;
  extract?: typeof requestExtraction;
}) {
  const [state, setState] = useState<AnalysisState>(initialState);
  // Ignores results of an analysis the user has already abandoned.
  const current = useRef(0);

  const analyze = useCallback(
    async (document: ExtractRequest['document'], language: OutputLanguage) => {
      const id = ++current.current;
      setState({ status: 'loading' });
      const response = await extract({ language, document });
      if (id !== current.current) return;
      setState(
        response.ok
          ? { status: 'done', result: response.data, language, corrections: {} }
          : { status: 'error', error: response.error },
      );
    },
    [extract],
  );

  const correct = useCallback((ref: ItemRef, correction: LocalCorrection) => {
    setState((previous) =>
      previous.status === 'done'
        ? { ...previous, corrections: { ...previous.corrections, [itemKey(ref)]: correction } }
        : previous,
    );
  }, []);

  const reset = useCallback(() => {
    current.current++;
    setState({ status: 'idle' });
  }, []);

  return (
    <AnalysisContext.Provider value={{ state, analyze, correct, reset }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis(): Analysis {
  const analysis = useContext(AnalysisContext);
  if (!analysis) throw new Error('useAnalysis must be used inside AnalysisProvider');
  return analysis;
}

/** Returns the item an ItemRef points to, if the current result has it. */
export function getItem(result: ExtractSuccess, ref: ItemRef) {
  const items: readonly unknown[] = result.extraction[ref.section];
  return items[ref.index] as
    | ExtractSuccess['extraction']['summary'][number]
    | ExtractSuccess['extraction']['deadlines'][number]
    | ExtractSuccess['extraction']['actions'][number]
    | undefined;
}

const SECTIONS: readonly Section[] = ['summary', 'deadlines', 'actions'];

/** Reads an ItemRef from route params; null if they are missing or malformed. */
export function parseItemRef(params: { section?: string; index?: string }): ItemRef | null {
  const section = SECTIONS.find((s) => s === params.section);
  const index = Number(params.index);
  if (!section || !Number.isInteger(index) || index < 0) return null;
  return { section, index };
}
