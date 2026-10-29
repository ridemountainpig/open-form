# demo

Dogfood workspace for `@open-form-build/core`. It consumes the framework via `workspace:*`.

```bash
pnpm dev   # from the repo root: builds open-form, then runs this workspace
```

- `forms/developer-meetup` — 3-step registration in a look written after the `terminal` theme: CLI prompts, ASCII progress, conditional questions, 100-seat limit, and a `meetup agenda` that marks the talks matching the topics you pick
- `forms/feedback` — conversational NPS survey translated into Traditional Chinese and Japanese, in a look written after the `conversational` theme: one question per screen, letter keys, branching follow-ups
- `forms/contact` — a look written after the `editorial` theme (split layout, underline inputs, pill choices) plus a custom field component and a custom validator
- `forms/conference-pass` — the showcase: a pass that builds itself as you answer — custom fields, live ticket in the `aside`, conditional speaker step, cross-field validator, a dark-only `midnight` look in its own `theme/`, form-scoped CSS
- `forms/cafe-order` — findrink, a café pre-order on an amber CRT drawn in thin lines: power it on, pick a drink from a menu written as a JSON body (a custom field), get the order echoed back as the response; translated into English, Simplified Chinese and Japanese. Its look became the `phosphor` theme
- `themes/` — the references new forms take their look from (`terminal`, `editorial`, `conversational`, `phosphor`); each form above carries only the tokens, CSS and components it uses, so changing a reference never touches it
