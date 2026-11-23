# @open-form-build/cli

Scaffold an [Open Form](https://open-form.build) workspace: forms your coding agent writes, with validation, storage and a Studio for the responses.

```bash
npx @open-form-build/cli init my-forms
```

| Package manager | Command |
| --- | --- |
| npm | `npx @open-form-build/cli init my-forms` |
| pnpm | `pnpm dlx @open-form-build/cli init my-forms` |
| yarn | `yarn dlx @open-form-build/cli init my-forms` |
| bun | `bunx @open-form-build/cli init my-forms` |

It runs the `open-form` CLI from [`@open-form-build/core`](https://www.npmjs.com/package/@open-form-build/core) with the arguments you pass, and the workspace uses the package manager you ran it with. Requires Node.js 22.13+. [`npm create open-form@latest`](https://www.npmjs.com/package/create-open-form) does the same.

## Options

| Flag | What it does |
| --- | --- |
| `--database sqlite\|postgres` | Where responses are stored (asked when omitted) |
| `--vercel` | Add `api/index.ts` and `vercel.json` to deploy on Vercel (implies Postgres) |
| `--pm pnpm\|npm\|yarn\|bun` | Use this package manager instead of the one that ran the command |
| `-n, --name <name>` | Package name (defaults to the folder name) |
| `-f, --force` | Scaffold into a non-empty folder |
| `--no-install` | Skip installing dependencies |
| `--no-git` | Skip `git init` |

## Next

`cd my-forms` and run the `dev` script (init prints the command for your package manager), then open `http://localhost:3000/studio` and ask your coding agent for a form.

Inside the workspace, use the `open-form` CLI the workspace installed (`npx open-form …`, `pnpm exec open-form …`), so commands run the same version as your forms. This package can run any `open-form` command too, but the version it runs may not match the one your workspace depends on.

[Docs](https://open-form.build/docs) · [`@open-form-build/core`](https://www.npmjs.com/package/@open-form-build/core) · [GitHub](https://github.com/ridemountainpig/open-form)

MIT
