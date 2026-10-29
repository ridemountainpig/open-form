---
name: Phosphor
description: An amber CRT terminal drawn in thin lines on a black page — the questions as a JSON body on the glass, a power button to boot it, a phosphor knob and a keyboard that follows yours.
layout: custom (line-drawn monitor + keyboard)
---

# Phosphor

**Source:** the `cafe-order` form (findrink), generalized: its look in `forms/cafe-order/theme/` became this reference.

**Mood:** nocturnal, playful, nerdy. A computer that wakes up for you in the dark — warm amber glow, hairline drawing, a little ceremony before the questions.

**Best for:** developer meetups and hack nights, pre-orders and sign-ups at tech events, beta waitlists, API or tooling products, anything whose audience reads `curl` and JSON for fun. Short to medium forms (≤ ~8 questions) on one page.

**Avoid when:** the audience isn't technical (JSON punctuation reads as noise), the form is long or multi-step (the screen scrolls inside a fixed frame), or it must feel formal. The power-on step adds a click: skip it for forms people fill in under time pressure.

## Palette (dark only)

| Token | Value | Use |
| --- | --- | --- |
| `primary` | `#ff7a59` | The curl line, response values, Enter key, caret, focus rings |
| `primaryForeground` | `#140c05` | Text on `primary` (hover of the submit button) |
| `background` | `#000000` | The page around the drawing |
| `surface` | `#18120b` | The CRT glass (a radial glow and scanlines over it) |
| `foreground` | `#ffc979` | Amber phosphor: text, keys, the selected-string inverse |
| `muted` | `#b08c5c` | JSON punctuation, `//` comments, meta labels |
| `border` | `#5e4a30` | Rules inside the screen |
| `control` | `#a08055` | Dashed input underlines |
| `input` | `#18120b` | Same as the glass: inputs are bare |
| `error` | `#ff6b6b` | `// ! …` error lines |
| `success` | `#5fd38a` | The power light, the `open` status dot |

The line drawing uses `--ph-line: color-mix(in srgb, var(--of-fg) 36%, #000)`, so the computer recolors with the phosphor. The knob swaps the palette by overriding `--of-*` on `.ph-mac[data-phosphor]`:

| Phosphor | `foreground` | `surface` | `muted` | `primary` |
| --- | --- | --- | --- | --- |
| amber (tokens) | `#ffc979` | `#18120b` | `#b08c5c` | `#ff7a59` |
| green | `#8dff9e` | `#0c150e` | `#5fae72` | `#e6ff7a` |
| white | `#eef1f4` | `#15171a` | `#9aa0a8` | `#7cc4ff` |

All three pass the same contrast pairs (text ≥ 12:1, muted ≥ 5.9:1, controls ≥ 5:1); `theme check` covers amber only.

Other tokens: `font` JetBrains Mono (bundled in `fonts/`), `headingFont` Inter (bundled), `radius: 0px`, `spacing: comfortable`, `width: 760px` (the monitor is `width + 200px`), `colorScheme: 'dark'`, `components.Layout` = the custom `Layout` in `index.tsx`.

## Typography

- Everything on the glass is JetBrains Mono 15px / 1.8 (13px on phones) with a faint glow (`text-shadow` at 28% of `foreground`).
- The wordmark is Inter, light with the first word bold, −0.035em tracking, preceded by a line-drawn mark (`.ph-logo`).
- Panel labels (`COLOR`, `POWER`, the nameplate) are Inter 700 9px with 0.14em tracking. They're Latin hardware engraving, so they stay English in every locale.
- CJK: `var(--of-cjk)` sits in both stacks, so labels like `"名字"` fall back to the system's regional sans inside the mono line. No uppercase, italics or tracking is applied to field text, so nothing needs a `:lang(en)` guard.

## Layout & components

**Composition:** a black page with a computer drawn in 1.5px lines. Top to bottom: the monitor (a rounded cabinet with a double line, an inner bezel, a rounded CRT); a panel under the screen (nameplate, speaker grille, COLOR knob, POWER button, power light); and a perspective keyboard wider than the monitor, overlapping the panel. On desktop the CRT has a fixed height (`clamp(400px, 100dvh − 420px, 680px)`) and its content scrolls inside. On phones (≤ 560px) the frame thins out, the screen grows with the content and the page scrolls; the keyboard sits at the bottom.

What each part is:

- **`Layout`** (component): the drawing, the screen states and all behavior. On the glass, in order: header + `dl.ph-meta` (Method / Status / Date), a rule, the red `curl -X POST '<this page's URL>'` line, a rule, then the runtime's content and actions.
  - Power: the screen starts dark with `> press POWER to start_`; the button, a click on the glass or any non-modifier key boots it. Boot lines run for 1.5 s, then the content plays a CRT warm-up. Later loads in the same tab boot by themselves (`sessionStorage`); reduced motion skips it all.
  - The content is `inert` while off. Keyboard users get focus moved to the first answer after booting.
  - The knob cycles amber → green → white (`localStorage`).
  - Each screen remounts with its own key, so it starts at the top.
- **`Keyboard`** (component in `index.tsx`): an SVG generated from a 15-unit row table, projected into perspective.
  - It mirrors real keydowns (`event.code`).
  - Clicked, it types into the focused text answer with `execCommand('insertText')`, so the runtime sees an ordinary input event and `maxLength` holds. Shift is one-shot and shows the shifted legends; Caps toggles; ⌫ and ← → edit.
  - `⏎ POST` calls `form.requestSubmit()`.
  - Pointer-down is prevented, so focus stays in the answer.
- **`Header`**: wordmark + `.ph-tagline`.
- **`Field`**: renders the label as a quoted JSON key (`"key":`), help as a `// comment`, and errors as `// ! error`. A fieldset's legend floats before its value.
- **`TextInput`**: a bare input on a dashed underline, wrapped in CSS quotes.
- **`ChoiceGroup`**: options are quoted strings.
  - If every label is ≤ 6 characters, they render inline as a tuple: `"size": ["S", "M", "L"],`.
  - Otherwise they render as an array, one per line.
  - The picked one is inverted (amber block, dark text) with a blinking caret.
- **`Success`** / **`Notice`**: a title and children. `Notice` prints `HTTP/1.1 410 Gone` (or 404 / 425 / 503 / 409 per state) above the message as a `//` comment.
- **CSS** (`phosphor.css`):
  - The JSON body: `.of-fields` becomes `{ … }`, keys are indented 4ch, and `:has()` adds `: [` / `],` punctuation.
  - Also the drawing, the glass (noise, scanlines, rim), the panel, the keyboard states and the effects.
  - Effects live inside `@media (prefers-reduced-motion: no-preference)`: warm-up, rolling band, flicker, the light blinking on keys and while submitting, the knob nudge after boot, and JSON rain on success.

The language picker sits at the top right of the black page; the drawing starts 24–32px down on desktop and 60px down on phones.

## Signature ideas

- **The form's own boot lines.** Rewrite `BOOT_LINES` for the event: `checking milk ........ ok` for a café pre-order, `allocating seats ..... ok` for a meetup. One line of joke per form, four lines at most.
- **A response echo.** In `<Success>`, print the answers back as a JSON object (keys in `muted` quotes, values in `primary`), followed by a `//` comment with the next step — like an API's `201 Created` body.
- **Nested menus as objects.** Use a custom field (`useField` + `FieldShell`) to render grouped options as `"group": { "item": ["a", "b"] }` and reuse `.ph-pick` / `.ph-str` for the choices. That gives exact per-variant answers (e.g. drink × temperature) in one radio.
- **The nameplate and the mark.** Put the form's brand on the panel's nameplate and swap `Logo` for its own line-drawn mark.

## Copy tone

Terse and technical, with a wink. Labels are short nouns that read as JSON keys (`名字`, `size`, `note`). Help reads like a code comment (`// pick one`). Status words come from HTTP (`open`, `201 Created`, `410 Gone`). Keep the jokes in the boot lines and the success comment, not in the questions.

## Do / Don't

- **Do** keep each label to one or two words: it becomes a quoted key on one line.
- **Do** give options short, lowercase labels so they read as strings; ≤ 6 characters gets the inline tuple.
- **Do** give choice options language-neutral `value`s when the form is translated.
- **Don't** use it for long multi-step forms: the screen has a fixed height, and there's no step rail.
- **Don't** add colors outside the tokens: tints come from `color-mix` on `--of-*`, so the knob can recolor everything.
- **Don't** put essential information only in the drawing: the panel and the keyboard are decoration plus shortcuts. The real submit button and fields stay the accessible path.
