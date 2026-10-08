import type { Deadline } from '../core/extraction/schema';

export interface CalendarEventData {
  title: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  notes: string;
}

/**
 * Event for a dated deadline, or null for relative deadlines: those have no date the
 * app can know, and guessing one would present uncertainty as fact.
 */
export function buildCalendarEvent(
  deadline: Pick<Deadline, 'value' | 'date' | 'time' | 'kind'>,
  notes: string,
): CalendarEventData | null {
  if (deadline.kind === 'relative' || !deadline.date) return null;

  const title = deadline.value.length > 80 ? `${deadline.value.slice(0, 79)}…` : deadline.value;
  if (deadline.time) {
    // Local time: appointments in German letters are given in local time.
    const startDate = new Date(`${deadline.date}T${deadline.time}:00`);
    return {
      title,
      startDate,
      endDate: new Date(startDate.getTime() + 60 * 60 * 1000),
      allDay: false,
      notes,
    };
  }
  const day = new Date(`${deadline.date}T00:00:00`);
  return { title, startDate: day, endDate: day, allDay: true, notes };
}

/** Opens the system "new event" screen. No calendar permission is needed for this. */
export async function addToCalendar(event: CalendarEventData): Promise<void> {
  // The new expo-calendar API is not available in Expo Go; the legacy dialog is.
  const { createEventInCalendarAsync } = await import('expo-calendar/legacy');
  await createEventInCalendarAsync(event);
}
