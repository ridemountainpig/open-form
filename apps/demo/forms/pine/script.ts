export type Turn = {
  name: string;
  ask: string;
  options?: { value: string; label: string }[];
  skipped?: string;
};

export const SCRIPT: Turn[] = [
  {
    name: 'name',
    ask: "Hi, I'm Juniper from Pine Internet. I'll get your request to the right team. What's your name?",
  },
  {
    name: 'topic',
    ask: "Nice to meet you. What's going on with your connection?",
    options: [
      { value: 'slow', label: 'Slow speeds' },
      { value: 'down', label: 'No connection at all' },
      { value: 'drops', label: 'It keeps dropping' },
      { value: 'billing', label: 'A billing question' },
    ],
  },
  {
    name: 'since',
    ask: 'Got it. How long has this been happening?',
    options: [
      { value: 'today', label: 'Just today' },
      { value: 'days', label: 'A few days' },
      { value: 'week', label: 'More than a week' },
    ],
  },
  {
    name: 'restarted',
    ask: 'Have you tried restarting the router?',
    options: [
      { value: 'no-change', label: 'Yes, no change' },
      { value: 'helped', label: 'Yes, it helped for a while' },
      { value: 'not-yet', label: 'Not yet' },
    ],
  },
  {
    name: 'details',
    ask: 'Anything else we should know? You can skip this one.',
    skipped: 'Nothing to add',
  },
  {
    name: 'email',
    ask: 'Last one. Where should we send updates?',
  },
];

export const ASK = Object.fromEntries(SCRIPT.map((turn) => [turn.name, turn])) as Record<
  string,
  Turn
>;
