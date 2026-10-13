import { readFile } from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import { listComments } from '../editing/comments.ts';
import { sourceFiles } from '../vite/form-files.ts';
import { findForms, loadUserConfig, projectPaths } from '../vite/project.ts';

/** `@form-comment` markers left from Studio, for the agent applying them. */
export async function commentsCommand(id: string | undefined, flags: { json?: boolean }) {
  const userCwd = process.cwd();
  const { formsRoot } = projectPaths(userCwd, await loadUserConfig(userCwd));
  const forms = findForms(formsRoot).filter((form) => !id || form.id === id);
  if (id && forms.length === 0) throw new Error(`No form "${id}" in forms/.`);

  const comments: Array<{ form: string; file: string; line: number; text: string }> = [];
  for (const form of forms) {
    for (const file of sourceFiles(path.dirname(form.file))) {
      const rel = path.relative(userCwd, file).split(path.sep).join('/');
      for (const comment of listComments(await readFile(file, 'utf8'))) {
        comments.push({ form: form.id, file: rel, ...comment });
      }
    }
  }

  if (flags.json) {
    process.stdout.write(`${JSON.stringify(comments, null, 2)}\n`);
    return;
  }
  if (comments.length === 0) {
    process.stdout.write(`\n  ${chalk.dim('No comments.')}\n\n`);
    return;
  }
  process.stdout.write('\n');
  for (const comment of comments) {
    process.stdout.write(`  ${chalk.cyan(`${comment.file}:${comment.line}`)}  ${comment.text}\n`);
  }
  process.stdout.write(
    `\n  ${chalk.dim('Apply each one, then delete its marker line (apply-comments skill).')}\n\n`,
  );
}
