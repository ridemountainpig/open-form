---
name: apply-comments
description: Apply the review comments a user left on forms in Open Form Studio. Use when the user says "apply comments", "/apply-comments", "do what I commented", "go through my notes on the form", or mentions `@form-comment`. Each comment is a marker in a form's source right above the element it is about; apply the request, then delete the marker.
---

# Apply Studio comments

In Studio's Preview, the user switches to **Edit**, selects something and writes a note for you. Studio saves it in the form's source, directly above the element it is about:

```tsx
{/* @form-comment: make this optional and say why we ask */}
<Email name="email" label="Email" required />
```

- Where JSX is an expression, e.g. right after `return (`, the marker is a plain `/* @form-comment: … */`.
- When the element doesn't start its line (`<p>Read our <a href="…">terms</a></p>`), the marker goes inline, just before it on the same line.
- Notes about text that lives in `config` (the form's title, description, success message) sit above that property: `/* @form-comment: … */` on the line before `title: '…',`.
- A note about something the runtime or theme draws inside an element — its title, the progress bar, the Next button — sits above that element and starts with what was picked: `(on “Next ↵”) make this button full width`. That text is as the user saw it, possibly translated.
- Markers are always in the form's own files, never in its theme copy in `forms/<id>/theme/`.

## Workflow

Run `open-form` through the workspace's package manager, as AGENTS.md → Commands shows (`pnpm exec open-form`, `npx open-form`, …).

1. **List them**: `open-form comments` (or `open-form comments <id>`, `--json`). Each line is `file:line  text`; the element the comment is about starts on the next line (or right after the marker on the same line).
2. **Read `form-authoring` first** if you haven't this session — comments are edits to forms and follow the same rules.
3. **For each comment, top to bottom per file:**
   - Read the element the marker is about and enough context to understand it (its `<Page>`, `<When>`, the form's `config`).
   - Do what the comment asks with the DSL — props, `<When>`, `validate`, `config` — never hand-rolled state or CSS.
   - A comment about the look (colors, fonts, spacing, how a theme-drawn part looks) is applied in the form's own theme in `forms/<id>/theme/` — tokens, components or its CSS — never in `themes/`: those are references and don't change existing forms. A form without one has the default look, which is the `classic` starter: copy that in first (`open-form theme copy classic <id>`) so nothing else changes — another theme would restyle the whole form — or ask.
   - Delete the marker line (or the inline marker). Leave no `@form-comment` behind for a comment you applied.
   - If a comment is unclear, conflicts with another, or would rename a field that already has responses, **skip it, keep its marker**, and ask the user about it at the end.
4. **Check**: `open-form check <id>` for each form you touched (plus `open-form theme check <id> --form` after a color change), and `open-form comments` should list only the ones you deliberately kept. After a comment about the look, also look at the result, as `create-form` → Step 6 → *Look at it* describes.
5. **Report** briefly: what you changed for each comment, and which you left (with your question).

## Rules

- Field `name`s are database keys. "Rename this" means change the `label`, not `name`, unless the user says the data key should change.
- Translated forms (`forms/<id>/locales/*.json`): when a comment changes text, update the same key in every locale file.
- Don't edit markers you weren't asked to apply, and don't add new `@form-comment` markers yourself.
