---
name: Terminal
description: A terminal UI in a window: bordered panes with legends, a steps list, `?` prompts, `[x]` boxes and a status bar. Dark only.
layout: Custom window
---

# Terminal

**Mood:** technical, insider, a little playful. A tool, not a web page.

**Best for:** developer meetups and hackathons, beta and API access requests, internal tooling, CLI products.

**Avoid when:** the audience is not technical, or the form is long prose.

## Tokens

The tokens a form copies into its `theme/index.ts`.

| Token | Dark |
| --- | --- |
| `primary` | `#a6e36e` |
| `primaryForeground` | `#0c1407` |
| `background` | `#06080b` |
| `surface` | `#0c0f15` |
| `foreground` | `#cdd5e3` |
| `muted` | `#8792a8` |
| `border` | `#262d3b` |
| `control` | `#657087` |
| `input` | `#0c0f15` |
| `error` | `#ff8b8b` |
| `success` | `#a6e36e` |

- `font`: `'"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, var(--of-cjk), monospace'`
- `headingFont`: `'"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, var(--of-cjk), monospace'`
- `radius`: `'3px'`
- `spacing`: `'compact'`
- `width`: `'1372px'`
- `colorScheme`: `'dark'` (dark only; `colors` is the one palette)
- Fonts are served from `fonts/` (`doto.css`, `jetbrains-mono.css`); a form that uses one gets its own copy with `open-form theme font <form> <Family> --form`.
- Layout: Custom window, not a token: it comes from `components`.

## Typography

- JetBrains Mono for everything; the title is set in Doto, a dot-matrix face, at up to 4.5rem.
- Legends and the status bar are 11px uppercase.

## Layout & components

- The Layout is a component: a window with a title bar, a command line above the title, then a grid of panes. The steps pane lists every step and lets you jump back; the main pane holds the questions with the step name in its border; the form's `aside` becomes more panes on the right.
- A status bar along the bottom shows the mode, the step and the key hints.
- Prompts: every label starts with `?`, which turns into a green tick once the field has an answer.
- List choices are `[x]` / `( )` lines with a `❯` cursor on the focused one; `variant="cards"` choices are segmented keys.
- Under 900px the panes stack and the steps become one line.

### Building a form's look from it

`index.tsx` and `terminal.css` are built this way, so take from them as they are:

- **CSS on the runtime's markup** (scoped to the form): the prompts and their tick (`.of-field:has(...)`), the `[x]` and `( )` glyphs drawn before each choice, segmented keys, the rating keys, inputs, comment-style help (`# ...`) and the buttons.
- **Components**: only `Layout` (window, panes, steps and status bar).

## Signature ideas

Pick one:

- **Live panes**: pass `aside` a component with panes that react to the answers: the agenda with matching talks marked, a seat meter, a `whoami` card.
- **A command that matches the form**: change the command line to what the form does, like `$ npx meetup register`.
- **Exit code**: `<Success>` printed as command output.

## Copy tone

Lowercase, terse, like CLI help. Help text reads as `# comments`.

## Do / Don't

- **Do:** Keep labels short enough for one line of mono.
- **Do:** Use page titles: they become the pane legend and the steps list.
- **Don't:** Add a light palette: the look depends on the dark ground (`colorScheme: 'dark'`).
- **Don't:** Use for forms with long paragraphs of explanation.
