import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const DATA_DIR = '.open-form';

/**
 * `OPEN_FORM_SECRET`, or a random secret persisted next to the database so
 * timing tokens and visitor hashes survive restarts.
 */
/** Owner-only: the mode given at creation doesn't apply to a file that already exists. */
function restrict(file: string): void {
  try {
    chmodSync(file, 0o600);
  } catch {}
}

export function resolveSecret(projectRoot: string): string {
  const fromEnv = process.env.OPEN_FORM_SECRET;
  if (fromEnv) return fromEnv;
  const file = path.join(projectRoot, DATA_DIR, 'secret');
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  if (existsSync(file)) {
    restrict(file);
    const stored = readFileSync(file, 'utf8').trim();
    if (stored.length >= 16) return stored;
  }
  const secret = randomBytes(32).toString('hex');
  writeFileSync(file, `${secret}\n`, { mode: 0o600 });
  restrict(file);
  return secret;
}

export function resolveDatabasePath(projectRoot: string, configured: string | undefined): string {
  const fromEnv = process.env.OPEN_FORM_DB;
  if (fromEnv) return path.resolve(projectRoot, fromEnv);
  return path.resolve(projectRoot, configured ?? path.join(DATA_DIR, 'open-form.db'));
}
