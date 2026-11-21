---
name: Conversational
description: One question per screen on a warm sunrise wash, with letter keys and auto-advance.
layout: FocusLayout
---

# Conversational

**Mood:** friendly, unhurried, personal. Feels like being asked, not like filling in a form.

**Best for:** surveys and NPS, feedback, quizzes, onboarding questionnaires, research screeners, anything with mostly single-choice questions.

**Avoid when:** people need to see and review everything at once (long applications, data entry), or there are many free-text fields.

## Tokens

The tokens a form copies into its `theme/index.ts`.

| Token | Light | Dark |
| --- | --- | --- |
| `primary` | `#3b2412` | `#fbeedd` |
| `primaryForeground` | `#fff6ea` | `#2a1710` |
| `background` | `#f9e3c4` | `#2b1a1a` |
| `surface` | `#fbecd6` | `#33201d` |
| `foreground` | `#3b2412` | `#fbeedd` |
| `muted` | `#6e5440` | `#c9b3a0` |
| `border` | `#c9ab8c` | `#6b4a40` |
| `control` | `#8a6a50` | `#a88a78` |
| `input` | `#fdf3e4` | `#3a2521` |
| `error` | `#a3271b` | `#ff9a8a` |
| `success` | `#2d6a3e` | `#8ed3a0` |

- `font`: `'"Bricolage Grotesque", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif'`
- `headingFont`: `'"Bricolage Grotesque", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif'`
- `radius`: `'6px'`
- `spacing`: `'comfortable'`
- `width`: `'880px'`
- Fonts are served from `fonts/` (`bricolage-grotesque.css`, `geist-mono.css`); a form that uses one gets its own copy with `open-form theme font <form> <Family> --form`.
- Layout: FocusLayout, not a token: it comes from `components`.

## Typography

- Bricolage Grotesque throughout: titles at weight 500 with tight tracking, questions at 1.6 to 2.25rem and weight 400.
- Counters and key hints in Geist Mono.
- Wrap with `text-wrap: pretty`, not `balance`, which splits Chinese words.

## Layout & components

- `FocusLayout` inside a small wrapper that adds the mark in the corner: a welcome screen with the title, description and a Start button, then one step per screen with a thin progress bar and a `1 / 4` counter.
- The wash is three gradients on `.of-root`, fixed to the viewport; dark mode swaps it for an ember-to-plum one.
- Write **one question per `<Page>`** and leave page titles off: the field label is the question.
- Choices: translucent rows with letter keys (A, B, C). Press the letter to choose. On a one-question step, picking a single answer or a rating moves on by itself.
- Inputs: large underline fields with no box.
- Rating: number tiles; 0 to 10 scales wrap to two rows on phones.

### Building a form's look from it

`index.tsx` and `conversational.css` are built this way, so take from them as they are:

- **CSS on the runtime's markup** (scoped to the form): the wash, question-sized labels, underline inputs, the select, the checkbox row, the buttons and the focus bar.
- **Components**: `Layout` (the mark over `FocusLayout`), `ChoiceGroup` (letter keys, the check, the keyboard shortcut and auto-advance) and `Rating` (moves on once chosen). Auto-advance counts `.of-field` elements on the step, so it only fires when the question is alone.

## Signature ideas

Pick one:

- **Picture tiles**: for `variant="cards"`, draw a small SVG per option in the form's theme and show it above the caption.
- **A drawing that grows**: a scene beside the questions that gains a piece on every step, from `nav.position`.
- **A personal ending**: `<Success>` that uses the name or the score they gave.

## Copy tone

Spoken, second person, one idea per question. "Who do you usually travel with?"

## Do / Don't

- **Do:** Keep each screen to one question.
- **Do:** Write the title and description as an invitation that says how long it takes.
- **Don't:** Put a long page of fields on one step: the wash and large type are sized for one question.
- **Don't:** Use it where people need to scan their answers before sending.
