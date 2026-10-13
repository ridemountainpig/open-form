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
- Buttons: lift on hover, slam flat on press.
- Errors: black tags with white text.
- Success: a rotated mint sticker that slams in.

## Copy tone

Short, punchy, capitalized for emphasis. "GET EARLY ACCESS." "No spam. Ever."

## Do / Don't

- Do keep it to a few questions per step; the components are big.
- Do pair with `StepperLayout` for 3+ steps — the rail is restyled to match.
- Don't add soft shadows, gradients or rounded corners; they break the style.
