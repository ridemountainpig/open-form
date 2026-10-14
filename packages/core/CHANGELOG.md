# @open-form-build/core

## 0.1.1

### Patch Changes

- ba78eb6: Going back to an earlier step no longer carries over the "Please fix the highlighted fields." alert from the step you left.
- ba78eb6: Fixes `open-form check`, `theme check` and `responses export` blanking a running `open-form dev` until it restarts.
- 8104dc4: Adds `npm create open-form@latest` (also `pnpm create open-form`, `yarn create open-form` and `bunx create-open-form`) for creating a workspace.
- ba78eb6: Fixes forms losing their title, description and own theme CSS under `open-form dev` in workspaces installed from npm.
- b8f0545: Studio's Responses tab gathers Excel, CSV and JSON under one Export menu that says what each format is for and that exports include every response.
- b8f0545: Studio's Preview can collapse its step list to just the numbers (`Cmd`/`Ctrl` + `B`), for a wider preview; the choice is remembered.
- b8f0545: Studio's `Cmd`/`Ctrl` + `K` search also works while focus is inside the form preview.
- b8f0545: Studio's Responses tab has Notion-style filters: add rules on any question or the submission time (contains, is, greater than, has any of, is before, in the past N days, is empty, and more), and match all or any of them. Bulk selection follows the filters too.
- b8f0545: Studio's Responses table sorts by any column: click a heading for ascending, descending or a filter on it. Choice questions sort in the order of their options, and empty answers come last.
- b8f0545: Studio Settings tab fills the page width instead of a narrow column.
- d8b5bb6: Form skills now plan a signature element for each form, follow concrete design guidelines and styling hooks, and screenshot the form at desktop and phone width before handing off.
- d8b5bb6: Starter themes' THEME.md now suggest signature elements that fit each theme, and where they go in its layout.

## 0.1.0

### Minor Changes

- df6d085: Initial release: write forms as React code (multi-step pages, conditions, validation, drafts, translations); collect responses with spam protection, SQLite storage, webhooks and CSV, Excel or JSON export; manage, edit and organize them in Studio; style them with themes each form keeps its own copy of; embed them on other sites; deploy with the Node server or a Next.js route; and build them with your agent through the `open-form` CLI and built-in skills.
