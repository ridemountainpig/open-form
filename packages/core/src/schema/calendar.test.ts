import { describe, expect, it } from 'vitest';
import {
  calendarEventProblem,
  calendarTimes,
  googleCalendarUrl,
  icsCalendar,
  icsFileName,
} from './calendar.ts';

const NOW = Date.UTC(2026, 9, 22, 5, 13, 0);

describe('calendarTimes', () => {
  it('reads wall-clock times in the event or form time zone', () => {
    expect(calendarTimes({ start: '2026-11-15T19:00' }, 'Asia/Taipei')).toEqual({
      allDay: false,
      start: Date.UTC(2026, 10, 15, 11),
      end: Date.UTC(2026, 10, 15, 12),
    });
    expect(
      calendarTimes(
        { start: '2026-11-15T19:00', end: '2026-11-15T21:30', timeZone: 'Europe/Paris' },
        'Asia/Taipei',
      ),
    ).toEqual({
      allDay: false,
      start: Date.UTC(2026, 10, 15, 18),
      end: Date.UTC(2026, 10, 15, 20, 30),
    });
    expect(calendarTimes({ start: '2026-11-15T11:00:00Z' })).toMatchObject({
      start: Date.UTC(2026, 10, 15, 11),
    });
  });

  it('makes a date an all-day event whose end is inclusive', () => {
    expect(calendarTimes({ start: '2026-12-31' })).toEqual({
      allDay: true,
      start: '20261231',
      end: '20270101',
    });
    expect(calendarTimes({ start: '2026-11-14', end: '2026-11-15' })).toEqual({
      allDay: true,
      start: '20261114',
      end: '20261116',
    });
  });

  it('explains bad dates', () => {
    expect(() => calendarTimes({ start: '2026-11-15T19:00' })).toThrow(/has no time zone/);
    expect(() => calendarTimes({ start: '2026-02-30' })).toThrow(/Invalid date/);
    expect(() => calendarTimes({ start: '2026-11-15', end: '2026-11-15T20:00' })).toThrow(
      /must be a date/,
    );
    expect(() =>
      calendarTimes({ start: '2026-11-15T19:00', end: '2026-11-15T18:00' }, 'UTC'),
    ).toThrow(/isn't after start/);
    expect(() => calendarTimes({ start: '2026-11-15T19:00', timeZone: 'Taipei' })).toThrow(
      /isn't an IANA time zone/,
    );
  });
});

describe('calendarEventProblem', () => {
  it('needs a title and a usable date', () => {
    expect(calendarEventProblem({ start: '2026-11-15' }, {})).toMatch(/needs a `title`/);
    expect(calendarEventProblem({ start: '2026-11-15' }, { title: 'Meetup' })).toBeUndefined();
    expect(calendarEventProblem({ start: 'next friday' }, { title: 'Meetup' })).toMatch(
      /^success\.calendar: Invalid date "next friday"/,
    );
  });
});

describe('googleCalendarUrl', () => {
  it('prefills a timed event in UTC with the zone for display', () => {
    const url = new URL(
      googleCalendarUrl(
        {
          title: 'Raycast Paris',
          start: '2026-11-15T19:00',
          end: '2026-11-15T22:00',
          location: '42 Rue, Paris',
          description: 'Doors at 18:30',
          url: 'https://example.com/e',
        },
        'Europe/Paris',
      ),
    );
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      action: 'TEMPLATE',
      text: 'Raycast Paris',
      dates: '20261115T180000Z/20261115T210000Z',
      details: 'Doors at 18:30\n\nhttps://example.com/e',
      location: '42 Rue, Paris',
      ctz: 'Europe/Paris',
    });
  });

  it('uses dates for an all-day event', () => {
    const url = new URL(googleCalendarUrl({ title: 'Fair', start: '2026-11-14' }));
    expect(url.searchParams.get('dates')).toBe('20261114/20261115');
    expect(url.searchParams.has('ctz')).toBe(false);
  });
});

describe('icsCalendar', () => {
  it('writes an RFC 5545 event', () => {
    const ics = icsCalendar(
      {
        title: 'Meetup; Q&A, drinks',
        start: '2026-11-15T19:00',
        location: 'Taipei 101',
        description: 'Bring a laptop\nand a friend',
      },
      { formTimeZone: 'Asia/Taipei', now: NOW },
    );
    const lines = ics.split('\r\n');
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('DTSTAMP:20261022T051300Z');
    expect(lines).toContain('DTSTART:20261115T110000Z');
    expect(lines).toContain('DTEND:20261115T120000Z');
    expect(lines).toContain('SUMMARY:Meetup\\; Q&A\\, drinks');
    expect(lines).toContain('DESCRIPTION:Bring a laptop\\nand a friend');
    expect(lines.find((l) => l.startsWith('UID:'))).toMatch(/^UID:[0-9a-f]+@open-form$/);
    expect(lines.at(-2)).toBe('END:VCALENDAR');
  });

  it('writes all-day dates and folds long lines without splitting characters', () => {
    const title = '年度活動'.repeat(20);
    const ics = icsCalendar({ title, start: '2026-11-14' }, { now: NOW });
    expect(ics).toContain('DTSTART;VALUE=DATE:20261114\r\nDTEND;VALUE=DATE:20261115');
    const encoder = new TextEncoder();
    for (const line of ics.split('\r\n')) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    const summary = ics.slice(ics.indexOf('SUMMARY:')).split('\r\nEND:VEVENT')[0] as string;
    expect(summary.replace(/\r\n /g, '')).toBe(`SUMMARY:${title}`);
  });
});

describe('icsFileName', () => {
  it('keeps the title readable and safe', () => {
    expect(icsFileName('Raycast Paris: Nov 15')).toBe('Raycast-Paris-Nov-15.ics');
    expect(icsFileName('開發者聚會')).toBe('開發者聚會.ics');
    expect(icsFileName('///')).toBe('event.ics');
  });
});
