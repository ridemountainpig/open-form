---
name: Brutalist
description: Neo-brutalism — loud yellow, thick black borders, hard offset shadows, heavy uppercase type.
layout: default card (works with StepperLayout)
---

# Brutalist

**Mood:** loud, confident, fun, a little punk. Every control looks like a physical block you can press.

**Best for:** launches and waitlists, creator / indie products, campaigns, contests, merch drops, youth audiences, anything that should stand out in a feed.

**Avoid when:** the context is sensitive (health, finance, HR) or the brand is quiet.

## Palette (light only)

| Token | Value | Use |
| --- | --- | --- |
| `background` | `#ffd84d` | Page, with a halftone dot pattern |
| `surface` | `#fffdf3` | Card |
| `primary` | `#ff4f9a` | Primary button, title highlight, current progress block, chosen rating |
| pop (`--br-pop`) | `#7cf5c4` | Selected choices, success sticker |
| ink (`--br-ink`) | `#000` | Every border, shadow and outline |
| `error` | `#e5001c` | Error text sits on a black tag |

## Tokens

What `open-form create <form> --theme brutalist` writes into the form's `theme/index.ts`. One palette only.

| Token | Value |
| --- | --- |
| `primary` | `#ff4f9a` |
| `primaryForeground` | `#000000` |
| `background` | `#ffd84d` |
| `surface` | `#fffdf3` |
| `foreground` | `#000000` |
| `muted` | `#3b3b3b` |
| `border` | `#000000` |
| `control` | `#000000` |
| `input` | `#ffffff` |
| `error` | `#e5001c` |
| `success` | `#00a86b` |

- `colorScheme`: `'light'`
- `font`: `'"Helvetica Neue", Helvetica, Arial, var(--of-cjk), sans-serif'`
- `headingFont`: `'"Arial Black", "Helvetica Neue", Helvetica, Impact, var(--of-cjk), sans-serif'`
- `radius`: `'0px'`
- `spacing`: `'comfortable'`
- `width`: `'600px'`
- Layout: the default card — nothing to add.

## Typography

- Titles: `Arial Black` / Impact, uppercase, huge, with a pink marker highlight behind the text.
- Labels: uppercase 13px, 800 weight.
- Body: `Helvetica Neue` / Arial, semibold.

## Layout & components

- Card with a 3px border and a 12px hard shadow on a dotted yellow page.
- Progress: one block per step — black for done, pink for current.
- Page titles: inverted black tags.
- Inputs: 3px borders; on focus they lift up-left and cast a hard shadow.
- Choices: chunky tiles that lift on hover and turn mint when chosen.
- Rating: a connected strip of blocks.
- Matrix: one ink-ruled table with an inverted header row; the chosen cell turns mint. On a narrow form each row is its own block that lifts while you answer it.
- Buttons: lift on hover, slam flat on press.
- Errors: black tags with white text.
- Success: a rotated mint sticker that slams in.

### Building a form's look from it

`index.tsx` and `brutalist.css` are built this way, so take from them as they are:

- **CSS on the runtime's markup** (scoped to the form): uppercase heavy labels and the outlined `*` (`.of-label`, `.of-required`), errors as black tags (`.of-error`), the choice tiles with the input itself as the box (`.of-choice`, `.of-choice > .of-radio`), the checkbox (`.of-choice-single`), the connected rating strip (`.of-rating`), the select (`.of-select-wrap`), buttons that lift on hover and slam flat on press (`.of-button`), the card's border and hard shadow (`.of-form`), inverted page titles (`.of-page-title`), the matrix's ink-ruled table and blocks with the radio itself as the box (`.of-matrix-*`).
- **Components**: `Header` (the marker highlight behind each line of the title), `Progress` (a block per step), `Success` (the rotated sticker) and `TextInput` / `Textarea` (the wrapper that lifts and casts the shadow, the unit and counter).

## Signature ideas

Pick one. `aside` sits beside the card and drops below it on narrow screens:

- **A sticker** — a rotated tile with the one fact that sells it (the date, the price, "30 SEATS"), 3px ink border, hard shadow, `--br-pop` or `primary` fill.
- **A badge that fills in** — the person's name in `Arial Black` capitals on a pink marker strip, plus what they picked (tier, role): a pass people want to screenshot.
- **A stamped ending** — `<Success>` reusing that badge with a slammed-in stamp.

Keep ink borders and hard shadows; the Don'ts below apply to it too.

## Copy tone

Short, punchy, capitalized for emphasis. "GET EARLY ACCESS." "No spam. Ever."

## Do / Don't

- Do keep it to a few questions per step; the components are big.
- Do pair with `StepperLayout` for 3+ steps — the rail is restyled to match.
- Don't add soft shadows, gradients or rounded corners; they break the style.
