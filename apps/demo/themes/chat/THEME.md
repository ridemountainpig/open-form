---
name: Chat
description: The form as a conversation: questions are message bubbles, choices are quick-reply chips, and the send button sits where a composer would.
layout: Custom split
---

# Chat

**Mood:** helpful, immediate, human. A support chat that happens to be a form.

**Best for:** support requests, triage, lead qualification, onboarding, anything that already sounds like a conversation.

**Avoid when:** people need to see every question at once, or answers are long.

## Tokens

The tokens a form copies into its `theme/index.ts`.

| Token | Light | Dark |
| --- | --- | --- |
| `primary` | `#c8401a` | `#ff7a4d` |
| `primaryForeground` | `#ffffff` | `#1a0e08` |
| `background` | `#f2efe9` | `#141a16` |
| `surface` | `#ffffff` | `#1e2621` |
| `foreground` | `#1d2a22` | `#eef1ea` |
| `muted` | `#5d6a61` | `#a3ada4` |
| `border` | `#d9d3c6` | `#344038` |
| `control` | `#8b9288` | `#6f7b72` |
| `input` | `#ffffff` | `#1e2621` |
| `error` | `#b3261e` | `#ff9a8a` |
| `success` | `#1f6b45` | `#7fd3a3` |

- `font`: `'"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif'`
- `headingFont`: `'"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif'`
- `radius`: `'18px'`
- `buttonRadius`: `'999px'`
- `spacing`: `'comfortable'`
- `width`: `'640px'`
- Fonts are served from `fonts/` (`geist-mono.css`, `geist.css`); a form that uses one gets its own copy with `open-form theme font <form> <Family> --form`.
- Layout: Custom split, not a token: it comes from `components`.

## Typography

- Geist throughout: bubbles at 1rem, the panel title up to 3.25rem / 600.

## Layout & components

- The Layout is a component: a pine-green panel with the mark, title and description, and a conversation column with a bar (avatar, name, step pips), the thread and the buttons. Under 900px the panel becomes a short header.
- Each label is a bubble from the agent; inputs are rounded composer fields under it.
- Choices are outlined chips aligned to the right, like quick replies. On a one-question step, picking one sends it.
- A page title is a small centered pill, like a date line.
- The form's `aside` is placed above the current question: that is where a transcript goes.
- Success and closed states are a single bubble.

### Building a form's look from it

`index.tsx` and `chat.css` are built this way, so take from them as they are:

- **CSS on the runtime's markup** (scoped to the form): bubbles (`.of-label`), composer inputs, the date-line page title, the buttons.
- **Components**: `Layout` (panel, bar and thread) and `ChoiceGroup` (chips with auto-advance).

## Signature ideas

Pick one:

- **A transcript**: one question per `<Page>`, and an `aside` that replays earlier steps as bubbles with an Edit link (`useFormNav().goTo`).
- **A named agent**: change the avatar, name and status line in the bar.
- **Replies that use the answers**: a `<Success>` bubble that names the person and says what happens next.

## Copy tone

Spoken and short, first person from the agent. "Got it. How long has this been happening?"

## Do / Don't

- **Do:** Write one question per page for the full effect.
- **Do:** Keep chip labels to a few words.
- **Don't:** Fake typing delays: the form should be as fast as the person.
- **Don't:** Stack many fields on one step.
