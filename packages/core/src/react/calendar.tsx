import { useMemo } from 'react';
import {
  type CalendarEvent,
  googleCalendarUrl,
  icsCalendar,
  icsFileName,
} from '../schema/index.ts';
import { useFormContext, useRuntime } from './context.ts';
import { useTranslate } from './i18n.tsx';

export type AddToCalendarProps = CalendarEvent;

/**
 * Add to Google Calendar and an `.ics` download (Apple Calendar, Outlook) for
 * one event. `config.success.calendar` shows it on the thank-you screen; use
 * this inside `<Success>` when the event depends on the answers.
 */
export function AddToCalendar(props: AddToCalendarProps) {
  const { config } = useRuntime();
  const { messages } = useFormContext('AddToCalendar');
  const tr = useTranslate();
  const title = props.title ?? config?.title;
  const key = JSON.stringify([props, title, config?.timeZone]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` captures every input
  const links = useMemo(() => {
    if (!title) return null;
    const event = {
      ...props,
      title: tr(title),
      location: props.location && tr(props.location),
      description: props.description && tr(props.description),
    };
    try {
      return {
        google: googleCalendarUrl(event, config?.timeZone),
        ics: `data:text/calendar;charset=utf-8,${encodeURIComponent(
          icsCalendar(event, { formTimeZone: config?.timeZone }),
        )}`,
        file: icsFileName(event.title),
      };
    } catch {
      return null;
    }
  }, [key, tr]);
  if (!links) return null;
  return (
    <div className="of-calendar">
      <p className="of-calendar-label">{messages.addToCalendar}</p>
      <div className="of-calendar-links">
        <a
          className="of-button of-calendar-link"
          href={links.google}
          target="_blank"
          rel="noopener noreferrer"
        >
          {messages.googleCalendar}
        </a>
        <a className="of-button of-calendar-link" href={links.ics} download={links.file}>
          {messages.icsDownload}
        </a>
      </div>
    </div>
  );
}
