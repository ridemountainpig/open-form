---
name: Sentence
description: The form reads as one paragraph in large serif type: labels are the words, answers are blanks set inline, choices are words you pick.
layout: Custom page
---

# Sentence

**Mood:** literary, personal, a little theatrical. Filling it in feels like finishing a letter.

**Best for:** short briefs and enquiries, pledges, RSVPs, introductions: five to eight answers that make a sentence.

**Avoid when:** the form has long lists of options, long free text or more than about ten fields.

## Tokens

The tokens a form copies into its `theme/index.ts`.

| Token | Light | Dark |
| --- | --- | --- |
| `primary` | `#5a35f0` | `#a892ff` |
| `primaryForeground` | `#ffffff` | `#0f0b1f` |
| `background` | `#efeaff` | `#0f0b1f` |
| `surface` | `#ffffff` | `#181233` |
| `foreground` | `#1a1433` | `#efeaff` |
| `muted` | `#5f5884` | `#9a93bd` |
| `border` | `#cfc6f2` | `#33295f` |
| `control` | `#8679c4` | `#6f63a8` |
| `input` | `#ffffff` | `#181233` |
| `error` | `#b3261e` | `#ff9a9a` |
| `success` | `#5a35f0` | `#a892ff` |

- `font`: `'"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif'`
- `headingFont`: `'"Instrument Serif", ui-serif, Georgia, var(--of-cjk-serif), serif'`
- `radius`: `'14px'`
- `buttonRadius`: `'999px'`
- `spacing`: `'spacious'`
- `width`: `'1080px'`
- Fonts are served from `fonts/` (`geist-mono.css`, `geist.css`, `instrument-serif.css`); a form that uses one gets its own copy with `open-form theme font <form> <Family> --form`.
- Layout: Custom page, not a token: it comes from `components`.

## Typography

- The paragraph: Instrument Serif at 1.6 to 2.75rem; answers in italic in the primary color.
- Help, units and the description: Geist Mono, 11px, uppercase.
- Buttons use the serif too.

## Layout & components

- The Layout is a component: a top line with a wordmark and the description (the title is kept for screen readers), the paragraph, and a foot with the form's `aside` and the button.
- Every field flows inline: the label, then its blank, then a full stop. Rows and fieldsets are flattened with `display: contents`.
- Text inputs are dashed underlines that turn solid on focus; selects are inline too.
- Choices and ratings are italic words separated by slashes; the picked one is underlined in the primary color.
- A textarea takes a full line. A consent checkbox drops to small print under the paragraph.

### Building a form's look from it

`index.tsx` and `sentence.css` are built this way, so take from them as they are:

- **CSS on the runtime's markup** (scoped to the form): the whole paragraph: inline fields, blanks, picked words, the small-print checkbox.
- **Components**: only `Layout`.

## Signature ideas

Pick one:

- **Write a real sentence**: for full control, render the paragraph yourself with small custom fields built on `useField`, so the words between the blanks are yours ("Hello, I'm ___ from ___").
- **Blanks that size to the answer**: a hidden sizer span under each input.
- **Progress pips** in the foot as `aside`: one per blank.

## Copy tone

Write labels as the start of a clause: "My name is", "I'll arrive on". The form supplies the full stop.

## Do / Don't

- **Do:** Read the paragraph out loud before shipping.
- **Do:** Keep options to a few short words.
- **Don't:** Use help text on every field: it interrupts the sentence.
- **Don't:** Use it for forms people fill in more than once.
