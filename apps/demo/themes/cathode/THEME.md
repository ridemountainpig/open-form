---
name: Cathode
description: A beige desktop computer drawn in CSS; the form is a request body on its amber CRT, and a knob switches the phosphor to green. Dark only.
layout: Custom scene
---

# Cathode

**Mood:** nostalgic, nerdy, charming. Somebody clearly had fun.

**Best for:** beta and API key requests, developer community sign-ups, retro or hardware brands, launch pages for technical products.

**Avoid when:** the form is long, or the audience will not get the joke.

## Tokens

The tokens a form copies into its `theme/index.ts`.

| Token | Dark |
| --- | --- |
| `primary` | `#ff7a50` |
| `primaryForeground` | `#1a1108` |
| `background` | `#120e0a` |
| `surface` | `#17100a` |
| `foreground` | `#ffc97a` |
| `muted` | `#c2955a` |
| `border` | `#b58a52` |
| `control` | `#b58a52` |
| `input` | `#17100a` |
| `error` | `#ff8f7a` |
| `success` | `#6fe08e` |

- `font`: `'"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, Consolas, var(--of-cjk), monospace'`
- `headingFont`: `'"VT323", ui-monospace, "SF Mono", Menlo, Consolas, var(--of-cjk), monospace'`
- `radius`: `'3px'`
- `spacing`: `'compact'`
- `width`: `'980px'`
- `colorScheme`: `'dark'` (dark only; `colors` is the one palette)
- Fonts are served from `fonts/` (`ibm-plex-mono.css`, `vt323.css`); a form that uses one gets its own copy with `open-form theme font <form> <Family> --form`.
- Layout: Custom scene, not a token: it comes from `components`.

## Typography

- IBM Plex Mono for the fields; VT323 for the title.
- Everything on the screen is the phosphor color at different strengths, with a soft glow.

## Layout & components

- The Layout is a component: a monitor with bezel, screen, a chin with a badge, grille, PHOSPHOR knob and power light, then a keyboard. A floppy disk and a sticky note sit beside it on wide screens. On phones the monitor fills the width and the keyboard is cropped.
- The screen shows a command line, then the fields as `"key":` lines with their values under them, then the closing brace.
- Choices are quoted values that invert when picked; ratings are ruled keys.
- A status line at the bottom of the screen shows key hints and `ready` / `sending…`.
- The knob is real state: it toggles `data-phosphor` between amber and green.

### Building a form's look from it

`index.tsx` and `cathode.css` are built this way, so take from them as they are:

- **CSS on the runtime's markup** (scoped to the form): the key lines (`.of-label::before` and `::after` add the quotes and colon), quoted choices, inputs, scanlines and glow.
- **Components**: only `Layout` (the machine and the knob).

## Signature ideas

Pick one:

- **A different request**: change the command line to match the form, like `$ curl -X POST /v1/beta`.
- **Side-by-side keys**: for a form with short labels, put key and value on one line (a fixed label column) the way JSON reads.
- **Props on the desk**: a disk label or sticky note with a line about the form.

## Copy tone

Lowercase keys, like field names. Help text reads as `// comments`.

## Do / Don't

- **Do:** Keep labels short and lowercase-friendly.
- **Do:** Leave the knob: it is the best part.
- **Don't:** Add a light palette (`colorScheme: 'dark'`).
- **Don't:** Put more than one page of fields on the screen.
