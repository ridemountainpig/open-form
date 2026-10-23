# Changesets

Run `pnpm changeset` whenever `packages/core`, `packages/cli` or `packages/create-open-form` changes. One line, present tense, user-facing.

## Releasing

On every push to `main`, the Release PR workflow runs `pnpm version-packages` and opens or updates a `chore: release packages` PR that bumps versions and writes the changelogs. It never publishes. After merging that PR, publish from an up-to-date `main`:

```bash
pnpm release
git push --follow-tags
```
