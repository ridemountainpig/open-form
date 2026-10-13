import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import {
  elementNames,
  findTextSlots,
  normalizeText,
  replaceText,
  slotsForText,
  slotsOfElement,
  type TextSlot,
} from '../editing/text-slots.ts';
import {
  inlineTranslation,
  jsonTranslation,
  renameInlineKey,
  renameJsonKey,
  setInlineTranslation,
  setJsonTranslation,
  type TranslationTable,
  translationTables,
} from '../editing/translations.ts';
import { FORM_ID_RE } from '../server/index.ts';
import { displayPath, formDirOf, queueFormEdit, resolveLoc, sourceFiles } from './form-files.ts';
import { findForms, type ProjectPaths } from './project.ts';
import { assertSameOrigin, readBody, StudioError, send } from './studio-http.ts';

// Dev-only Studio endpoints behind the preview's Edit mode:
//
//   GET  /api/studio/source?form=<id>   each JSX element's tag (and field name) by loc
//   POST /api/studio/source/slots       { loc, text?, locale? } → the text there, and its translation
//   PUT  /api/studio/source/text        { at, from, to, locale? } → rewrite it (or its translation)

type Context = {
  paths: ProjectPaths;
  authorize(req: IncomingMessage): Promise<boolean>;
};

type Table = TranslationTable & { file: string | null };

export function studioSourceMiddleware(ctx: Context) {
  const { paths } = ctx;
  const display = (file: string) => displayPath(paths, file);
  const locOf = (file: string, pos: { line: number; column: number }) =>
    `${display(file)}:${pos.line}:${pos.column}`;

  const indexOf = (file: string): string => {
    const dir = formDirOf(paths, file);
    const entry = findForms(paths.formsRoot).find((f) => path.dirname(f.file) === dir);
    if (!entry) throw new StudioError(404, 'No such form.');
    return entry.file;
  };

  // JSON tables are only touched inside the form's own folder.
  const tablesOf = async (index: string): Promise<Table[]> => {
    const dir = path.dirname(index);
    return translationTables(await readFile(index, 'utf8')).map((table) => {
      if (table.kind !== 'json') return { ...table, file: null };
      const file = path.resolve(dir, table.specifier);
      const inside = !path.relative(dir, file).startsWith('..') && existsSync(file);
      return { ...table, file: inside ? file : null };
    });
  };

  async function translationOf(table: Table | undefined, index: string, key: string) {
    if (!table) return undefined;
    if (table.kind === 'json') {
      if (!table.file) return undefined;
      const value = jsonTranslation(await readFile(table.file, 'utf8'), key);
      return { locale: table.locale, value, editable: true };
    }
    const value = inlineTranslation(await readFile(index, 'utf8'), table.locale, key);
    return { locale: table.locale, value, editable: value !== null };
  }

  async function slots(body: Record<string, unknown>) {
    const { file, line, column } = resolveLoc(paths, body.loc);
    const source = await readFile(file, 'utf8');
    const index = indexOf(file);
    let found: Array<{ slot: TextSlot; file: string }>;
    if (typeof body.text === 'string') {
      found = slotsForText(source, { line, column }, body.text).map((slot) => ({ slot, file }));
      // A `<Form>` in another file still takes its title from the index's config.
      if (found.length === 0 && index !== file) {
        const inIndex = slotsForText(await readFile(index, 'utf8'), null, body.text);
        found = inIndex.map((slot) => ({ slot, file: index }));
      }
    } else {
      found = slotsOfElement(source, line, column).map((slot) => ({ slot, file }));
    }
    const locale = typeof body.locale === 'string' ? body.locale : undefined;
    const table = locale ? (await tablesOf(index)).find((t) => t.locale === locale) : undefined;
    return Promise.all(
      found.map(async ({ slot, file: at }) => ({
        at: locOf(at, slot),
        anchor: locOf(at, slot.anchor),
        key: slot.key,
        owner: slot.owner,
        value: slot.value,
        translation: await translationOf(table, index, slot.value),
      })),
    );
  }

  /** Is `text` still shown anywhere in the form, with `edited` swapped in for its file? */
  async function stillUsed(index: string, text: string, edited: { file: string; source: string }) {
    const wanted = normalizeText(text);
    for (const file of sourceFiles(path.dirname(index))) {
      const source = file === edited.file ? edited.source : await readFile(file, 'utf8');
      if (findTextSlots(source).some((s) => normalizeText(s.value) === wanted)) return true;
    }
    return false;
  }

  async function editText(body: Record<string, unknown>) {
    const { file, line, column } = resolveLoc(paths, body.at);
    const from = typeof body.from === 'string' ? body.from : '';
    const index = indexOf(file);
    const locale = typeof body.locale === 'string' ? body.locale : undefined;

    if (locale) {
      const slot = findTextSlots(await readFile(file, 'utf8')).find(
        (s) => s.line === line && s.column === column,
      );
      if (!slot || normalizeText(slot.value) !== normalizeText(from)) {
        throw new StudioError(409, 'This text changed in the source since it was loaded.');
      }
      const table = (await tablesOf(index)).find((t) => t.locale === locale);
      const to = normalizeText(typeof body.to === 'string' ? body.to : '');
      if (!to) throw new StudioError(422, 'Translation is empty.');
      if (table?.kind === 'json' && table.file) {
        await writeFile(
          table.file,
          setJsonTranslation(await readFile(table.file, 'utf8'), slot.value, to),
        );
      } else if (table?.kind === 'inline') {
        await writeFile(
          index,
          setInlineTranslation(await readFile(index, 'utf8'), locale, slot.value, to),
        );
      } else {
        throw new StudioError(422, `No ${locale} translations to edit in this form.`);
      }
      return { value: to };
    }

    const to = normalizeText(typeof body.to === 'string' ? body.to : '');
    if (to && to === normalizeText(from)) return { value: to };
    const { source, slot } = replaceText(await readFile(file, 'utf8'), line, column, from, to);
    // Keep each translation attached to the new text; copy it when the old text is still used.
    const keepOld = await stillUsed(index, slot.value, { file, source });
    let edited = source;
    const indexBefore = file === index ? null : await readFile(index, 'utf8');
    let indexSource = indexBefore;
    for (const table of await tablesOf(index)) {
      if (table.kind === 'json' && table.file) {
        const json = await readFile(table.file, 'utf8');
        const renamed = renameJsonKey(json, slot.value, to, keepOld);
        if (renamed !== json) await writeFile(table.file, renamed);
      } else if (table.kind === 'inline') {
        if (indexSource === null) {
          edited = renameInlineKey(edited, table.locale, slot.value, to, keepOld);
        } else {
          indexSource = renameInlineKey(indexSource, table.locale, slot.value, to, keepOld);
        }
      }
    }
    await writeFile(file, edited);
    if (indexSource !== null && indexSource !== indexBefore) await writeFile(index, indexSource);
    return { value: to };
  }

  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/studio/source')) return next();
    try {
      if (!(await ctx.authorize(req))) throw new StudioError(401, 'Sign in to Studio.');
      if (url.pathname === '/api/studio/source' && req.method === 'GET') {
        const formId = url.searchParams.get('form') ?? '';
        if (!FORM_ID_RE.test(formId)) throw new StudioError(404, 'No such form.');
        const elements: Record<string, { tag: string; name?: string }> = {};
        for (const file of sourceFiles(path.join(paths.formsRoot, formId))) {
          for (const [pos, info] of elementNames(await readFile(file, 'utf8'))) {
            elements[`${display(file)}:${pos}`] = info;
          }
        }
        return send(res, 200, { elements });
      }
      assertSameOrigin(req);
      const body = await readBody(req);
      if (url.pathname === '/api/studio/source/slots' && req.method === 'POST') {
        return send(res, 200, { slots: await slots(body) });
      }
      if (url.pathname === '/api/studio/source/text' && req.method === 'PUT') {
        const result = await queueFormEdit(async () => {
          try {
            return await editText(body);
          } catch (err) {
            if (err instanceof StudioError) throw err;
            throw new StudioError(422, err instanceof Error ? err.message : String(err));
          }
        });
        return send(res, 200, result);
      }
      throw new StudioError(405, 'Method not allowed.');
    } catch (err) {
      if (err instanceof StudioError) return send(res, err.status, { message: err.message });
      console.error('[open-form] studio source:', err);
      send(res, 500, { message: err instanceof Error ? err.message : String(err) });
    }
  };
}
