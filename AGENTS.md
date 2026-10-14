# Open Form — Framework Repo Guide

You are working on the **Open Form framework**: the runtime, server, Studio, CLI and agent skills that ship to npm as `@open-form-build/core` (the framework and its `open-form` CLI) and two scaffolders that run its `init`: `create-open-form` (`npm create open-form@latest`) and `@open-form-build/cli` (`npx @open-form-build/cli init`).

(Form-authoring guidance lives in the `form-authoring` / `create-form` skills under `packages/core/skills/`. Use those only when editing `apps/demo/forms/`.)

## Layout

pnpm + Turbo monorepo. Architecture and decisions: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Plan: [docs/ROADMAP.md](docs/ROADMAP.md).

| Path | Role |
| --- | --- |
| `packages/core/src/schema` | Pure TS: schema types, conditions, validation, policy, themes, messages. No React, no Node. |
| `packages/core/src/react` | Form runtime + DSL (`Form`, `Page`, `When`, fields, `useField`) and the render-to-collect schema collector. Browser-safe. |
| `packages/core/src/server`, `src/storage` | Web-standard fetch handler (submissions, protection, admin API, export) and the `StorageAdapter` interface. No Node APIs. |
| `packages/core/src/sqlite` | `node:sqlite` adapter. |
| `packages/core/src/node`, `src/vite`, `src/cli` | Node HTTP adapter + production server, Vite plugins/config, the `open-form` CLI. |
| `packages/core/src/app` | Hidden Vite app shipped as source: public form page (`/f/:id`) and Studio (`/studio`, Tailwind). |
| `packages/core/skills`, `template` | Built-in agent skills and the `open-form init` workspace template. |
| `packages/cli` | `@open-form-build/cli`: `npx @open-form-build/cli init` runs the core package's `open-form` CLI. |
| `packages/create-open-form` | `create-open-form`: `npm create open-form@latest` runs the core package's `open-form init`. |
| `apps/demo` | Dogfood workspace using `@open-form-build/core` via `workspace:*`. |
| `apps/web` | Website and docs (Next.js + Fumadocs, modeled on open-slide's). Landing demos render real forms with the runtime and the starter themes; docs are MDX in `content/docs/`. |

Layer boundaries are enforced by Biome `noRestrictedImports` overrides in `biome.json` — don't work around them.

## Workflow

```bash
pnpm install
pnpm dev          # builds open-form, runs apps/demo (Studio at http://localhost:3000/studio)
pnpm dev:web      # website + docs at http://localhost:3030
pnpm build        # build all packages
pnpm typecheck
pnpm check        # biome (format + lint + imports)
pnpm check:fix
pnpm test         # vitest
pnpm test:e2e     # scaffold → build → start → submit → export, then `open-form dev` from a packed install
```

`src/app` and `src/react` are compiled by Vite from source at runtime (the `@open-form-build/core` import is aliased to `src/index.ts`), so app/runtime edits hot-reload in `pnpm dev`. Node-side code (`cli`, `vite`, `node`, `server`, `sqlite`) runs from `dist/` — rebuild (`pnpm of build`, or keep `pnpm of build:watch` running) and restart `pnpm dev` after changing it.

## Hard rules

- **Biome must pass** (`pnpm check`) and **tests must pass** (`pnpm test`) before committing.
- **Client and server must agree.** Validation, conditions and coercion live once in `src/schema` and are used by both the runtime and the handler. Never duplicate a rule on one side.
- **The schema is derived, never hand-written.** Anything the server needs to know about a form comes from the collector (`collectFormSchema`) or `config` — plus Studio's stored schedule overrides (`opensAt`/`closesAt`/`maxResponses`/`closed` and `timeZone` only; see ARCHITECTURE).
- **Docs follow the code.** A user-facing change in `packages/core`, `packages/cli` or `packages/create-open-form` updates the matching page in `apps/web/content/docs/` in the same change.
- **Changes to `packages/core`, `packages/cli` or `packages/create-open-form` need a changeset** (`pnpm changeset`; one present-tense line, user-facing).
- Don't add dependencies casually — `@open-form-build/core` installs into every user workspace.
- Respondent data is personal data: never log submission bodies; keep `.open-form/` out of git.
- **Default to writing no comments.** Only explain a non-obvious *why*.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
