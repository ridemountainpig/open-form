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
- Rating: `[1] [2] [3]`, chosen one inverted.
- Buttons: `next ↵` (inverted green block) before `← back`.
- Success: `✔ title`, message, `process exited with code 0`.

## Copy tone

Lowercase is fine. Terse, a little wry: "Name, as it should appear on your badge." Avoid exclamation marks.

## Do / Don't

- Do keep labels to one line.
- Do give each `<Page>` a title when the form has sections — they become `## sections` and the ASCII progress bar appears. Short forms work fine on one page.
- Don't use emoji in options; use plain words.
