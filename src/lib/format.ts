import type { OutputLanguage } from '../core/extraction/prompt';

const LOCALES: Record<OutputLanguage, string> = { tr: 'tr-TR', en: 'en-GB' };

/**
 * "2026-10-26" -> "26 Ekim 2026, Pazartesi" / "Monday, 26 October 2026".
 * Dates are calendar dates without a time zone, so they are formatted in UTC to avoid
 * shifting a day in negative offsets.
 */
export function formatDate(isoDate: string, language: OutputLanguage): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat(LOCALES[language], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** Whole days from `today` to `isoDate` (negative if past), both as calendar dates. */
export function daysUntil(isoDate: string, today: Date): number {
  const target = Date.parse(`${isoDate}T00:00:00Z`);
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - start) / 86_400_000);
}
