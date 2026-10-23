import { hashString } from './hash.ts';
import { isTimeZone, isWallClockDate, policyInstant } from './time.ts';

/** An event the respondent can save to their calendar from the thank-you screen. */
export type CalendarEvent = {
  /** Default: the form's `title`. */
  title?: string;
  /**
   * `'YYYY-MM-DD'` for an all-day event, `'YYYY-MM-DDTHH:mm'` in `timeZone`,
   * or an ISO timestamp with an offset (`'…Z'`, `'…+08:00'`).
   */
  start: string;
  /** Same format as `start`. A date is the last day, inclusive. Default: one hour after `start`, or the same day. */
  end?: string;
  /** IANA zone for wall-clock times. Default: the form's `timeZone`. */
  timeZone?: string;
  location?: string;
  description?: string;
  /** A page about the event, added to its notes. */
  url?: string;
};

export type ResolvedCalendarTimes =
  | { allDay: true; start: string; end: string }
  | { allDay: false; start: number; end: number };

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HOUR_MS = 3_600_000;

function nextDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10).replaceAll('-', '');
}

function instant(value: string, key: string, timeZone: string | undefined): number {
  if (isWallClockDate(value) && !timeZone) {
    throw new Error(
      `${key} "${value}" has no time zone. Set \`timeZone\` on the event or the form (e.g. 'Asia/Taipei'), or use an ISO timestamp with an offset.`,
    );
  }
  return policyInstant(value, timeZone ?? 'UTC', 'start');
}

/** When the event starts and ends; throws a readable error for a bad date. */
export function calendarTimes(event: CalendarEvent, formTimeZone?: string): ResolvedCalendarTimes {
  if (typeof event.start !== 'string' || event.start === '') {
    throw new Error('`start` is required, e.g. "2026-11-15T19:00".');
  }
  if (event.timeZone !== undefined && !isTimeZone(event.timeZone)) {
    throw new Error(`timeZone ${JSON.stringify(event.timeZone)} isn't an IANA time zone.`);
  }
  const timeZone = event.timeZone ?? formTimeZone;
  if (DATE_RE.test(event.start)) {
    policyInstant(event.start, 'UTC', 'start');
    const end = event.end ?? event.start;
    if (!DATE_RE.test(end)) {
      throw new Error(
        `end "${end}" must be a date like start ("${event.start}") for an all-day event.`,
      );
    }
    policyInstant(end, 'UTC', 'start');
    if (end < event.start) throw new Error(`end "${end}" is before start "${event.start}".`);
    return { allDay: true, start: event.start.replaceAll('-', ''), end: nextDay(end) };
  }
  const start = instant(event.start, 'start', timeZone);
  if (event.end !== undefined && DATE_RE.test(event.end)) {
    throw new Error(`end "${event.end}" needs a time, like start ("${event.start}").`);
  }
  const end = event.end === undefined ? start + HOUR_MS : instant(event.end, 'end', timeZone);
  if (end <= start) throw new Error(`end "${event.end}" isn't after start "${event.start}".`);
  return { allDay: false, start, end };
}

/** Why `success.calendar` won't work, or undefined if it's fine. */
export function calendarEventProblem(
  event: CalendarEvent,
  config: { title?: string; timeZone?: string },
): string | undefined {
  if (!event.title && !config.title) {
    return 'success.calendar needs a `title` (or the form a `title`).';
  }
  try {
    calendarTimes(event, config.timeZone);
    return undefined;
  } catch (err) {
    return `success.calendar: ${(err as Error).message}`;
  }
}

function utcStamp(ms: number): string {
  return new Date(ms)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function details(event: CalendarEvent): string {
  return [event.description, event.url].filter(Boolean).join('\n\n');
}

/** A Google Calendar "create event" link, prefilled. */
export function googleCalendarUrl(
  event: CalendarEvent & { title: string },
  formTimeZone?: string,
): string {
  const times = calendarTimes(event, formTimeZone);
  const params = new URLSearchParams({ action: 'TEMPLATE', text: event.title });
  params.set(
    'dates',
    times.allDay
      ? `${times.start}/${times.end}`
      : `${utcStamp(times.start)}/${utcStamp(times.end)}`,
  );
  const notes = details(event);
  if (notes) params.set('details', notes);
  if (event.location) params.set('location', event.location);
  const timeZone = event.timeZone ?? formTimeZone;
  if (!times.allDay && timeZone) params.set('ctz', timeZone);
  return `https://calendar.google.com/calendar/render?${params}`;
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

const encoder = new TextEncoder();

// RFC 5545 §3.1: lines over 75 octets continue on the next line after a space.
function fold(line: string): string {
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (size + bytes > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/** The event as an iCalendar (`.ics`) file, for Apple Calendar, Outlook and others. */
export function icsCalendar(
  event: CalendarEvent & { title: string },
  { formTimeZone, now = Date.now() }: { formTimeZone?: string; now?: number } = {},
): string {
  const times = calendarTimes(event, formTimeZone);
  const uid = `${hashString(JSON.stringify([event.title, event.start, event.end, event.location]))}@open-form`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Open Form//Open Form//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${utcStamp(now)}`,
    ...(times.allDay
      ? [`DTSTART;VALUE=DATE:${times.start}`, `DTEND;VALUE=DATE:${times.end}`]
      : [`DTSTART:${utcStamp(times.start)}`, `DTEND:${utcStamp(times.end)}`]),
    `SUMMARY:${escapeText(event.title)}`,
  ];
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  const notes = details(event);
  if (notes) lines.push(`DESCRIPTION:${escapeText(notes)}`);
  if (event.url) lines.push(`URL:${event.url.replace(/[\r\n]/g, '')}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

/** A file name for the event's `.ics` download. */
export function icsFileName(title: string): string {
  const base = title
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|\p{Cc}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
  return `${base || 'event'}.ics`;
}
