import type { Verified } from '../../src/core/verification/verify';
import type { Deadline } from '../../src/core/extraction/schema';
import type { GroundTruth } from './ground-truth';

export interface DeadlineScore {
  /** Ground-truth deadlines with a fixed date, and how many the model found (same date). */
  datedExpected: number;
  datedFound: number;
  /** Predicted dated deadlines whose date is not an expected deadline date. */
  wrongDates: number;
  /** The subset of wrongDates that are known distractors (letter date, consequence dates). */
  distractorDates: number;
  /** Predicted relative deadlines that nevertheless carry a date (should be impossible after parsing). */
  relativeWithDate: number;
  missingDates: string[];
  unexpectedDates: string[];
}

/** Deterministic part of deadline scoring: compares fixed dates only. */
export function scoreDatedDeadlines(
  truth: Pick<GroundTruth, 'deadlines' | 'non_deadline_dates'>,
  predicted: Pick<Verified<Deadline>, 'kind' | 'date'>[],
): DeadlineScore {
  const expectedDates = new Set(
    truth.deadlines.flatMap((d) => (d.kind !== 'relative' && d.date ? [d.date] : [])),
  );
  const distractors = new Set(truth.non_deadline_dates.map((d) => d.date));
  const predictedDates = new Set(predicted.flatMap((d) => (d.date ? [d.date] : [])));

  // A recurring schedule may be returned as "first payment" plus "later payments"; the
  // later start date is part of the expected schedule, not a wrong date.
  const truthHasRecurring = truth.deadlines.some((d) => d.kind === 'recurring');
  const laterRecurringDates = new Set(
    predicted.flatMap((d) =>
      truthHasRecurring && d.kind === 'recurring' && d.date ? [d.date] : [],
    ),
  );

  const missingDates = [...expectedDates].filter((date) => !predictedDates.has(date));
  const unexpectedDates = [...predictedDates].filter(
    (date) => !expectedDates.has(date) && !laterRecurringDates.has(date),
  );

  return {
    datedExpected: expectedDates.size,
    datedFound: expectedDates.size - missingDates.length,
    wrongDates: unexpectedDates.length,
    distractorDates: unexpectedDates.filter((date) => distractors.has(date)).length,
    relativeWithDate: predicted.filter((d) => d.kind === 'relative' && d.date !== null).length,
    missingDates,
    unexpectedDates,
  };
}

export interface MatchScore {
  expected: number;
  found: number;
  /** Predicted items the judge could not match to any expected item. */
  extra: number;
}

export function scoreMatches(
  expectedIds: string[],
  predictedCount: number,
  matches: { expectedId: string; predictedIndex: number | null }[],
): MatchScore {
  const matched = new Map(matches.map((m) => [m.expectedId, m.predictedIndex]));
  const usedPredicted = new Set(
    expectedIds.flatMap((id) => {
      const index = matched.get(id);
      return index === null || index === undefined ? [] : [index];
    }),
  );
  return {
    expected: expectedIds.length,
    found: expectedIds.filter((id) => {
      const index = matched.get(id);
      return index !== null && index !== undefined && index >= 0 && index < predictedCount;
    }).length,
    extra: predictedCount - usedPredicted.size,
  };
}

export function ratio(numerator: number, denominator: number): string {
  if (denominator === 0) return '-';
  return `${numerator}/${denominator} (${Math.round((numerator / denominator) * 100)}%)`;
}
