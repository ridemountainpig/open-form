import path from 'node:path';
import type { Plugin } from 'vite';
import { addLocTags } from '../editing/loc-tags.ts';
import { type ProjectPaths, THEME_DIR } from './project.ts';

/** Dev only: tag JSX in `forms/` with its source location for Studio's inspector. */
export function locPlugin(paths: ProjectPaths): Plugin {
  return {
    name: 'open-form:loc',
    apply: 'serve',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0] ?? id;
      if (!/\.[jt]sx$/.test(file)) return null;
      const rel = path.relative(paths.formsRoot, file);
      if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
      // A form's theme draws every field; tagging it would make Edit mode select the theme.
      if (rel.split(path.sep)[1] === THEME_DIR) return null;
      const display = path.relative(paths.userCwd, file).split(path.sep).join('/');
      // Lines don't move, so the existing source map stays accurate enough for dev.
      return { code: addLocTags(code, display), map: null };
    },
  };
}
