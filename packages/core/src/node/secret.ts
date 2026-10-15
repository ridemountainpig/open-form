import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const DATA_DIR = '.open-form';

/** Owner-only: the mode given at creation doesn't apply to a file that already exists. */
function restrict(file: string): void {
  try {
    chmodSync(file, 0o600);
  } catch {}
}

function readSecret(file: string): string | undefined {
  if (!existsSync(file)) return undefined;
  restrict(file);
  const stored = readFileSync(file, 'utf8').trim();
  return stored.length >= 16 ? stored : undefined;
}

/** The generated secret lives next to the database, so a volume that keeps one keeps both. */
export function secretPath(databasePath: string): string {
  return path.join(path.dirname(databasePath), 'secret');
}

/**
 * `OPEN_FORM_SECRET`, or a random secret persisted next to the database so
 * timing tokens and visitor hashes survive restarts.
 */
export function resolveSecret(
  projectRoot: string,
  databasePath = resolveDatabasePath(projectRoot, undefined),
): string {
  const fromEnv = process.env.OPEN_FORM_SECRET;
  if (fromEnv) return fromEnv;
  const file = secretPath(databasePath);
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const stored = readSecret(file);
  if (stored) return stored;
  // Up to 0.1.1 the secret stayed in .open-form/ even when the database didn't.
  const secret =
    readSecret(path.join(projectRoot, DATA_DIR, 'secret')) ?? randomBytes(32).toString('hex');
  writeFileSync(file, `${secret}\n`, { mode: 0o600 });
  restrict(file);
  return secret;
}

export function resolveDatabasePath(projectRoot: string, configured: string | undefined): string {
  const fromEnv = process.env.OPEN_FORM_DB;
  if (fromEnv) return path.resolve(projectRoot, fromEnv);
  return path.resolve(projectRoot, configured ?? path.join(DATA_DIR, 'open-form.db'));
}
