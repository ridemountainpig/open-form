import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { describeStorage, redactUrl, resolveStorage } from './storage.ts';

const ENV = ['OPEN_FORM_DATABASE_URL', 'OPEN_FORM_DB'] as const;
afterEach(() => {
  for (const key of ENV) delete process.env[key];
});

describe('resolveStorage', () => {
  const root = path.resolve('/project');

  it('defaults to SQLite in .open-form/', () => {
    expect(resolveStorage(root, {})).toEqual({
      kind: 'sqlite',
      path: path.join(root, '.open-form', 'open-form.db'),
      source: 'default',
    });
    expect(resolveStorage(root, { storage: { path: 'data/forms.db' } })).toMatchObject({
      path: path.join(root, 'data', 'forms.db'),
      source: 'storage.path',
    });
    process.env.OPEN_FORM_DB = 'other.db';
    expect(resolveStorage(root, { storage: { path: 'data/forms.db' } })).toMatchObject({
      path: path.join(root, 'other.db'),
      source: 'OPEN_FORM_DB',
    });
  });

  it('uses Postgres when there is a connection string, the environment first', () => {
    const config = { storage: { url: 'postgres://config@db/app', path: 'data/forms.db' } };
    expect(resolveStorage(root, config)).toEqual({
      kind: 'postgres',
      url: 'postgres://config@db/app',
      source: 'storage.url',
    });
    process.env.OPEN_FORM_DB = 'other.db';
    process.env.OPEN_FORM_DATABASE_URL = 'postgresql://env@db/app';
    expect(resolveStorage(root, config)).toEqual({
      kind: 'postgres',
      url: 'postgresql://env@db/app',
      source: 'OPEN_FORM_DATABASE_URL',
    });
  });

  it('ignores an empty connection string, as an unset variable in config would be', () => {
    process.env.OPEN_FORM_DATABASE_URL = '';
    expect(resolveStorage(root, { storage: { url: undefined } }).kind).toBe('sqlite');
  });

  it('refuses other databases without showing the password', () => {
    process.env.OPEN_FORM_DATABASE_URL = 'mysql://root:hunter2@db/app';
    expect(() => resolveStorage(root, {})).toThrow(
      'OPEN_FORM_DATABASE_URL must be a Postgres connection string (postgres://…); got mysql://root:***@db/app.',
    );
  });
});

describe('redactUrl', () => {
  it('hides passwords wherever the URL carries them', () => {
    expect(redactUrl('postgres://user:s3cr%40t@db.example.com:5432/app?sslmode=require')).toBe(
      'postgres://user:***@db.example.com:5432/app?sslmode=require',
    );
    expect(redactUrl('postgres://db.example.com/app?user=me&password=s3cret')).toBe(
      'postgres://db.example.com/app?user=me&password=***',
    );
    expect(redactUrl('postgres://user@db.example.com/app')).toBe(
      'postgres://user@db.example.com/app',
    );
    expect(redactUrl('postgres://user:p@ss@[broken')).toBe('postgres://user:***@[broken');
  });

  it('describes where responses go', () => {
    expect(
      describeStorage({ kind: 'postgres', url: 'postgres://u:p@h/db', source: 'storage.url' }),
    ).toBe('Postgres postgres://u:***@h/db');
    expect(
      describeStorage(
        {
          kind: 'sqlite',
          path: path.resolve('/project/.open-form/open-form.db'),
          source: 'default',
        },
        path.resolve('/project'),
      ),
    ).toBe(`SQLite ${path.join('.open-form', 'open-form.db')}`);
  });
});
