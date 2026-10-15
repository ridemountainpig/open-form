import { describe, expect, it } from 'vitest';
import { writeScheduleChanges } from './form-config.ts';

const FORM = `import { defineForm, Form, Text } from '@open-form-build/core';

export const config = defineForm({
  title: 'Meetup',
  submissions: {
    maxResponses: 100, // seats
    closesAt: '2026-10-30',
    uniqueBy: 'email',
  },
});

export default function Meetup() {
  return <Form><Text name="name" label="Name" /></Form>;
}
`;

describe('writeScheduleChanges', () => {
  it('replaces, adds and removes values in place', () => {
    const out = writeScheduleChanges(FORM, {
      submissions: {
        closesAt: '2026-11-02T18:00',
        opensAt: '2026-10-01',
        maxResponses: null,
        closed: true,
      },
    });
    expect(out).toContain(`    closesAt: '2026-11-02T18:00',
    uniqueBy: 'email',
    opensAt: '2026-10-01',
    closed: true,
  },`);
    expect(out).not.toContain('maxResponses');
    expect(out).toContain("title: 'Meetup',");
    expect(out).toContain('export default function Meetup()');
  });

  it('creates submissions when missing and drops it once empty', () => {
    const bare = FORM.replace(/ {2}submissions: \{[\s\S]*?\n {2}\},\n/, '');
    const added = writeScheduleChanges(bare, { submissions: { closesAt: '2026-10-31' } });
    expect(added).toContain("  submissions: { closesAt: '2026-10-31' },");
    expect(writeScheduleChanges(added, { submissions: { closesAt: null, closed: false } })).toBe(
      bare,
    );
  });

  it('follows a config declared apart from its export', () => {
    const source = `const config = { title: 'x' } satisfies object;\nexport { config };\n`;
    const out = writeScheduleChanges(source, { submissions: { maxResponses: 5 } });
    expect(out).toContain('submissions: { maxResponses: 5 } } satisfies object;');
    expect(out).toContain("{ title: 'x',");
  });

  it('refuses forms without a config object', () => {
    expect(() =>
      writeScheduleChanges('export default () => null;', { submissions: { closed: true } }),
    ).toThrow(/export const config/);
  });

  it('writes published: false and removes it again when published', () => {
    const out = writeScheduleChanges(FORM, { published: false });
    expect(out).toContain('  published: false,\n');
    expect(writeScheduleChanges(out, { published: true })).toBe(FORM);
  });

  it('writes the form’s own time zone next to its dates', () => {
    const out = writeScheduleChanges(FORM, {
      timeZone: 'Asia/Tokyo',
      submissions: { opensAt: '2026-10-01T09:00' },
    });
    expect(out).toContain("  timeZone: 'Asia/Tokyo',\n");
    expect(out).toContain("    opensAt: '2026-10-01T09:00',\n");
    expect(writeScheduleChanges(out, { timeZone: 'Europe/Paris' })).toContain(
      "  timeZone: 'Europe/Paris',\n",
    );
  });
});
