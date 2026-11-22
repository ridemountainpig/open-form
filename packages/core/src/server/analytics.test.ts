import { describe, expect, it } from 'vitest';
import { type FormConfig, type FormSchema, schemaVersion } from '../schema/index.ts';
import { createMemoryStorage, type StorageAdapter } from '../storage/index.ts';
import { createSigner, issueTimingToken } from './crypto.ts';
import { createOpenFormHandler } from './handler.ts';

const SECRET = 'test-secret-0123456789abcdef';
const ORIGIN = 'http://localhost:3000';

const schema: FormSchema = {
  id: 'trip',
  title: 'Trip',
  pages: [
    { index: 0, title: 'You', when: [] },
    { index: 1, title: 'Travel', when: [{ field: 'travel', equals: 'yes' }] },
    { index: 2, title: 'Wrap up', when: [] },
  ],
  fields: [
    { name: 'name', type: 'text', label: 'Name', page: 0, when: [] },
    { name: 'travel', type: 'text', label: 'Travel', page: 0, when: [] },
  ],
};

function setup(config: FormConfig = {}, project: { analytics?: boolean } = {}) {
  let now = Date.UTC(2026, 10, 20, 9);
  const storage: StorageAdapter = createMemoryStorage();
  const handle = createOpenFormHandler({
    registry: {
      list: async () => ['trip'],
      load: async (id) =>
        id === 'trip'
          ? { id, schema, version: schemaVersion(schema), config, validators: new Map() }
          : null,
    },
    storage,
    secret: SECRET,
    config: { protection: { minimumCompletionTime: false, rateLimit: false }, ...project },
    now: () => now,
    clientAddress: () => '203.0.113.7',
    adminAuth: { authorize: () => true },
  });
  const send = (body: Record<string, unknown>) =>
    handle(
      new Request(`${ORIGIN}/api/forms/trip/visits`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ORIGIN },
        body: JSON.stringify(body),
      }),
    );
  const submit = async (visit: string, openedAt: number) =>
    handle(
      new Request(`${ORIGIN}/api/forms/trip/submissions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ORIGIN },
        body: JSON.stringify({
          data: { name: 'Amy' },
          visit,
          token: await issueTimingToken(createSigner(SECRET), 'trip', openedAt),
        }),
      }),
    );
  const analytics = async (query = '') =>
    (await (await handle(new Request(`${ORIGIN}/api/forms/trip/analytics${query}`))).json()) as {
      supported: boolean;
      enabled: boolean;
      views: number;
      started: number;
      completed: number;
      medianSeconds: number | null;
      steps: Array<{ index: number; reached: number; left: number; conditional: boolean }>;
      versions: Array<{ current: boolean; visits: number }>;
    };
  return {
    storage,
    send,
    submit,
    analytics,
    handle,
    advance: (ms: number) => {
      now += ms;
    },
    now: () => now,
  };
}

const visitId = (n: number) => `visit-${String(n).padStart(12, '0')}`;

describe('form analytics', () => {
  it('counts views, starts, steps reached, where visits stop and completions', async () => {
    const t = setup();
    const opened = t.now();
    for (const n of [1, 2, 3, 4])
      expect((await t.send({ visit: visitId(n), step: 0 })).status).toBe(204);
    await t.send({ visit: visitId(1), started: true });
    await t.send({ visit: visitId(2), started: true });
    await t.send({ visit: visitId(3), started: true });
    await t.send({ visit: visitId(2), step: 1 });
    await t.send({ visit: visitId(2), step: 2 });
    await t.send({ visit: visitId(3), step: 2 });
    // A reload repeats the step it lands on: still one visit.
    await t.send({ visit: visitId(3), step: 2 });
    t.advance(90_000);
    expect((await t.submit(visitId(3), opened)).status).toBe(201);

    const a = await t.analytics();
    expect(a).toMatchObject({ supported: true, enabled: true, views: 4, started: 3, completed: 1 });
    expect(a.medianSeconds).toBe(90);
    expect(a.steps.map(({ index, reached, left }) => [index, reached, left])).toEqual([
      [0, 4, 2],
      [1, 1, 0],
      [2, 2, 1],
    ]);
    expect(a.steps[1]?.conditional).toBe(true);
    expect(a.versions).toEqual([expect.objectContaining({ current: true, visits: 4 })]);
  });

  it('ignores bad visit ids and steps the form does not have', async () => {
    const t = setup();
    await t.send({ visit: 'short', step: 0 });
    await t.send({ visit: visitId(1), step: 3 });
    await t.send({ visit: visitId(1), step: -1 });
    await t.send({ visit: visitId(1), step: '1' });
    expect((await t.analytics()).views).toBe(0);
  });

  it('records nothing for forms that turn analytics off', async () => {
    const off = setup({ analytics: false });
    await off.send({ visit: visitId(1), step: 0 });
    expect(await off.analytics()).toMatchObject({ enabled: false, views: 0 });
    const getForm = await off.handle(new Request(`${ORIGIN}/api/forms/trip`));
    expect(((await getForm.json()) as { visits?: boolean }).visits).toBeUndefined();

    const project = setup({}, { analytics: false });
    await project.send({ visit: visitId(1), step: 0 });
    expect((await project.analytics()).views).toBe(0);

    const form = setup({ analytics: true }, { analytics: false });
    await form.send({ visit: visitId(1), step: 0 });
    expect((await form.analytics()).views).toBe(1);
  });

  it('keeps visits by day, and lets Studio pick a range', async () => {
    const t = setup();
    await t.send({ visit: visitId(1), step: 0 });
    t.advance(10 * 86_400_000);
    await t.send({ visit: visitId(2), step: 0 });
    expect((await t.analytics('?days=7')).views).toBe(1);
    expect((await t.analytics('?days=30')).views).toBe(2);
    expect((await t.analytics()).views).toBe(2);
  });

  it('erases a form’s visits with the form', async () => {
    const t = setup();
    await t.send({ visit: visitId(1), step: 0 });
    await t.storage.deleteForm('trip');
    expect((await t.analytics()).views).toBe(0);
  });

  it('tells Studio when the storage keeps no visits', async () => {
    const storage = createMemoryStorage();
    delete storage.recordVisit;
    delete storage.visitStats;
    const handle = createOpenFormHandler({
      registry: {
        list: async () => ['trip'],
        load: async () => ({
          id: 'trip',
          schema,
          version: 'v',
          config: {},
          validators: new Map(),
        }),
      },
      storage,
      secret: SECRET,
      adminAuth: { authorize: () => true },
    });
    const res = await handle(new Request(`${ORIGIN}/api/forms/trip/analytics`));
    expect(await res.json()).toMatchObject({ supported: false });
  });
});
