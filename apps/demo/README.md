# demo

Dogfood workspace for `@open-form-build/core`. It consumes the framework via `workspace:*`.

```bash
pnpm dev   # from the repo root: builds open-form, then runs this workspace
```

- `forms/developer-meetup` — 3-step registration with its own copy of the `terminal` theme: CLI prompts, ASCII progress, conditional questions, 100-seat limit, and a `meetup agenda` that marks the talks matching the topics you pick
- `forms/feedback` — conversational NPS survey translated into Traditional Chinese and Japanese, with its own copy of the `conversational` theme: one question per screen, letter keys, branching follow-ups
- `forms/contact` — its own copy of the `editorial` theme (split layout, underline inputs, pill choices) plus a custom field component and a custom validator
- `forms/conference-pass` — the showcase: a pass that builds itself as you answer — custom fields, live ticket in the `aside`, conditional speaker step, cross-field validator, a dark-only `midnight` look in its own `theme/`, form-scoped CSS
- `themes/` — the references new forms are copied from (`terminal`, `editorial`, `conversational`); changing them never touches the forms above
