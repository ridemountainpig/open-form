# create-open-form

Scaffold an [Open Form](https://open-form.build) workspace: forms your coding agent writes, with validation, storage and a Studio for the responses.

```bash
npm create open-form@latest my-forms
```

| Package manager | Command |
| --- | --- |
| npm | `npm create open-form@latest my-forms` |
| pnpm | `pnpm create open-form my-forms` |
| yarn | `yarn create open-form my-forms` |
| bun | `bunx create-open-form my-forms` |

It runs `open-form init` from [`@open-form-build/core`](https://www.npmjs.com/package/@open-form-build/core), and the workspace uses the package manager you ran it with. Requires Node.js 22.13+.

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

npm needs `--` before flags: `npm create open-form@latest my-forms -- --database postgres`.

## Next

`cd my-forms` and run the `dev` script (init prints the command for your package manager), then open `http://localhost:3000/studio` and ask your coding agent for a form. Inside the workspace, forms import from `@open-form-build/core` and the CLI is `open-form` (`npx open-form …`).

[Docs](https://open-form.build/docs) · [`@open-form-build/core`](https://www.npmjs.com/package/@open-form-build/core) · [GitHub](https://github.com/ridemountainpig/open-form)

MIT
