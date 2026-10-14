# @open-form-build/cli

Create an [Open Form](https://open-form.build) workspace:

```bash
npx @open-form-build/cli init my-forms
```

Also `pnpm dlx @open-form-build/cli init`, `yarn dlx @open-form-build/cli init` or `bunx @open-form-build/cli init`. It runs the `open-form` CLI from [`@open-form-build/core`](https://www.npmjs.com/package/@open-form-build/core) with the arguments you pass (`--pm`, `--no-install`, `--no-git`, …), and the workspace uses the package manager you ran it with.

[`npm create open-form@latest`](https://www.npmjs.com/package/create-open-form) does the same.

Inside the workspace, forms import from `@open-form-build/core` and the CLI is `open-form` (`pnpm exec open-form …`).

MIT
