# create-open-form

Create an [Open Form](https://open-form.build) workspace:

```bash
npm create open-form@latest my-forms
```

Also `pnpm create open-form`, `yarn create open-form` or `bunx create-open-form`. It runs `open-form init` from [`@open-form-build/core`](https://www.npmjs.com/package/@open-form-build/core) with the arguments you pass, and the workspace uses the package manager you ran it with. npm needs `--` before flags: `npm create open-form@latest my-forms -- --no-git`.

Inside the workspace, forms import from `@open-form-build/core` and the CLI is `open-form` (`pnpm exec open-form …`).

MIT
