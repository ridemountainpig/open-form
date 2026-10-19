---
name: Terminal
description: A CLI session — monospace, phosphor green on black, `? question` prompts and ASCII progress.
layout: terminal window
---

# Terminal

**Mood:** nerdy, playful, insider. The form feels like running a command.

**Best for:** developer events and hackathons, CLI / devtool / API signups, beta access, bug reports, engineering surveys, anything for an audience that lives in a terminal.

**Avoid when:** the audience isn't technical — the joke becomes friction.

## Palette (dark only)

| Token | Value | Use |
| --- | --- | --- |
| `primary` | `#5af78e` | Typed answers, prompts, selected options, progress, primary button |
| `background` | `#050706` | Page |
| `surface` | `#0c0f0d` | Terminal window |
| `foreground` | `#d9e4dc` | Questions |
| `muted` | `#6f8076` | Comments, help, unselected markers |
| `error` | `#ff5c57` | `✖` errors |

`colorScheme: 'dark'` — it ignores the system setting on purpose.

## Tokens

What `open-form create <form> --theme terminal` writes into the form's `theme/index.ts`. One palette only.

| Token | Value |
| --- | --- |
| `primary` | `#5af78e` |
| `primaryForeground` | `#04110a` |
| `background` | `#050706` |
| `surface` | `#0c0f0d` |
| `foreground` | `#d9e4dc` |
| `muted` | `#6f8076` |
| `border` | `#1f2823` |
| `control` | `#6f8076` |
| `input` | `#0c0f0d` |
| `error` | `#ff5c57` |
| `success` | `#5af78e` |

- `colorScheme`: `'dark'`
- `font`: `'ui-monospace, "SF Mono", "JetBrains Mono", "Cascadia Code", Menlo, Consolas, var(--of-cjk), monospace'`
- `headingFont`: same as `font`
- `radius`: `'4px'`
- `spacing`: `'comfortable'`
- `width`: `'640px'`
- Layout: its own `Layout` component, the terminal window (see below).

## Typography

Monospace everywhere (`ui-monospace`, `SF Mono`, `JetBrains Mono`, `Menlo`, `Consolas`), 15px, line-height 1.6. Weight is the only hierarchy: questions bold, everything else regular.

## Layout & components

- Window chrome with traffic-light dots and `~/forms — step 2/3` in the title bar.
- Header: `$ open-form start`, then `▲ Title` and a dim description.
- Progress: `[████████░░░░] 2/3 Background`.
- Page titles: `## Background`.
- Fields read like inquirer prompts: `? Question *`, help as `# comment`, errors as `✖ …`.
- Inputs: `❯` prompt, borderless, answers typed in green.
- Choices: `( )` / `(•)` radios and `[ ]` / `[x]` checkboxes; `❯` pointer on hover and focus.
- Matrix: a table of `( )` under dim column headings, with `❯` on the row being answered; on a narrow form each row lists its options like a single-choice prompt.
- Rating: `[1] [2] [3]`, chosen one inverted.
- Buttons: `next ↵` (inverted green block) before `← back`.
- Success: `✔ title`, message, `process exited with code 0`.

### Building a form's look from it

`index.tsx` and `terminal.css` are built this way, so take from them as they are:

- **CSS on the runtime's markup** (scoped to the form), every glyph drawn with `content: "…" / ""` so screen readers skip it: `? ` before labels (`.of-label::before`), `#` help, `✖` errors, `( )` / `(•)` and `[ ]` / `[x]` marks on choices and the checkbox (`.of-choice::after` with `order: -1`), the same marks in the matrix's cells and a `❯` on the row being answered (`.of-matrix-*`), `← back` and `register ↵` buttons (`.of-button-secondary::before`, `.of-button-primary::after`).
- **Components**: `Layout` (the window and its `step n/total` title bar), `Header` (the `$ open-form start` line), `Progress` (the ASCII bar), `Success` and `Notice` (the `✔` / `✖` result screens), `TextInput` / `Textarea` / `Select` (the `❯` before the input) and `Rating` (its `1 = … · 5 = …` line names the scale's ends). Take `Notice` only when the form keeps the default closed screens.

## Signature ideas

Pick one, in the session's voice. `aside` prints at the bottom of the window (`.tm-aside`), after the buttons:

- **The command being built** — `$ rsvp --name "Amy" --topics rag,agents` filling in as people answer (`useFormValues`). It only repeats answers, so mark it `aria-hidden`.
- **A printed file** — the agenda or the event's facts as `$ cat agenda.txt` output: times in `muted`, titles in `foreground`.
- **A log on success** — `<Success>` lines built from the answers and the facts given: `✔ seat reserved for amy@…`, `→ 11/20 19:00 · venue`.

Text and color only — no boxes, cards or icons.

## Copy tone

Lowercase is fine. Terse, a little wry: "Name, as it should appear on your badge." Avoid exclamation marks.

## Do / Don't

- Do keep labels to one line.
- Do give each `<Page>` a title when the form has sections — they become `## sections` and the ASCII progress bar appears. Short forms work fine on one page.
- Don't use emoji in options; use plain words.
