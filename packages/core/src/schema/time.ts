// Policy dates are wall-clock times in an explicit IANA time zone, so a form
// opens and closes at the same moment on a laptop in Taipei and a UTC server.

export const DEFAULT_TIME_ZONE = 'UTC';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
const ABSOLUTE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export function isTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value === '') return false;
  try {
    formatter(value);
    return true;
  } catch {
    return false;
  }
}

/** Why a configured `timeZone` won't work, or undefined if it's fine (or unset). */
export function timeZoneProblem(value: unknown): string | undefined {
  if (value === undefined || isTimeZone(value)) return undefined;
  return `timeZone ${JSON.stringify(value)} isn't an IANA time zone. Use e.g. 'Asia/Taipei', 'America/New_York' or 'UTC'.`;
}

export type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** What a clock in `timeZone` shows at `instant`. */
export function wallClock(instant: number, timeZone: string): WallClock {
  const parts: Record<string, number> = {};
  for (const part of formatter(timeZone).formatToParts(new Date(instant))) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year as number,
    month: parts.month as number,
    day: parts.day as number,
    hour: (parts.hour as number) % 24,
    minute: parts.minute as number,
    second: parts.second as number,
  };
}

function offsetAt(instant: number, timeZone: string): number {
  const c = wallClock(instant, timeZone);
  const seconds = Math.floor(instant / 1000) * 1000;
  return Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, c.second) - seconds;
}

const DAY_MS = 86_400_000;

/**
 * The instant a wall-clock time in `timeZone` names. A time the clocks fall
 * back over happens twice and means the earlier one; a time they spring
 * forward over never happens and means as long after the jump as it was
 * after the last valid time, so a day that starts at 01:00 opens at 01:00.
 */
export function zonedInstant(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
): number {
  const wall = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  const before = offsetAt(wall - DAY_MS, timeZone);
  const after = offsetAt(wall + DAY_MS, timeZone);
  const matches = [wall - before, wall - after].filter(
    (instant) => offsetAt(instant, timeZone) === wall - instant,
  );
  return matches.length > 0 ? Math.min(...matches) : wall - before;
}

function invalidDate(value: string): Error {
  return new Error(
    `Invalid date "${value}". Use 'YYYY-MM-DD', 'YYYY-MM-DDTHH:mm' (in the form's time zone) or an ISO timestamp with an offset ('…Z', '…+08:00').`,
  );
}

function realDate(value: string, y: number, m: number, d: number): void {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    throw invalidDate(value);
  }
}

/**
 * When a policy date takes effect. `YYYY-MM-DD` covers the whole day, so it
 * starts at midnight (`'start'`) or runs to the last millisecond (`'end'`).
 */
export function policyInstant(
  value: string | Date,
  timeZone: string,
  edge: 'start' | 'end',
): number {
  if (value instanceof Date) {
    const time = value.getTime();
    if (Number.isNaN(time)) throw new Error('Invalid date (an Invalid Date object).');
    return time;
  }
  const date = DATE_RE.exec(value);
  if (date) {
    const [y, m, d] = date.slice(1).map(Number) as [number, number, number];
    realDate(value, y, m, d);
    return edge === 'start'
      ? zonedInstant(timeZone, y, m, d)
      : zonedInstant(timeZone, y, m, d + 1) - 1;
  }
  const local = LOCAL_RE.exec(value);
  if (local) {
    const [y, m, d, h, min] = local.slice(1, 6).map(Number) as [
      number,
      number,
      number,
      number,
      number,
    ];
    const s = Number(local[6] ?? 0);
    const ms = Number((local[7] ?? '0').padEnd(3, '0'));
    realDate(value, y, m, d);
    if (h > 23 || min > 59 || s > 59) throw invalidDate(value);
    return zonedInstant(timeZone, y, m, d, h, min, s, ms);
  }
  if (ABSOLUTE_RE.test(value)) {
    const time = Date.parse(value);
    if (!Number.isNaN(time)) return time;
  }
  throw invalidDate(value);
}

/** Whether `value` is a wall-clock date, read in the form's time zone. */
export function isWallClockDate(value: string | Date): boolean {
  return typeof value === 'string' && (DATE_RE.test(value) || LOCAL_RE.test(value));
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A policy date as a date and an optional time in `timeZone`, for date and
 * time inputs. `time` is null for a whole day (`YYYY-MM-DD`).
 */
export function policyDateParts(
  value: string | Date,
  timeZone: string,
): { date: string; time: string | null } {
  if (typeof value === 'string' && DATE_RE.test(value)) return { date: value, time: null };
  const c = wallClock(policyInstant(value, timeZone, 'start'), timeZone);
  return {
    date: `${c.year}-${pad(c.month)}-${pad(c.day)}`,
    time: `${pad(c.hour)}:${pad(c.minute)}`,
  };
}

/** `'GMT+8'`, `'GMT-4'`, `'GMT'` — the zone's offset at `instant`. */
export function timeZoneOffsetLabel(timeZone: string, instant: number = Date.now()): string {
  const minutes = Math.round(offsetAt(instant, timeZone) / 60_000);
  if (minutes === 0) return 'GMT';
  const sign = minutes > 0 ? '+' : '-';
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  return `GMT${sign}${h}${m ? `:${pad(m)}` : ''}`;
}
