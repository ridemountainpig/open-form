# demo

Dogfood workspace for `@open-form-build/core`. It consumes the framework via `workspace:*`.

```bash
pnpm dev   # from the repo root: builds open-form, then runs this workspace
```

## Forms

Each form owns its look in `forms/<id>/theme/` and is checked at phone, tablet and desktop widths, in light and dark where it has both.

| Form | What it is | Worth a look |
| --- | --- | --- |
| `parcel` | Delivery feedback in black on white | The plainest a form can be: one column, underline inputs |
| `relay` | Feature request as a page in a notes app | Doodled cover, lettered choices and star rating in CSS only |
| `fieldnotes` | Beta sign-up as a doc | Gradient cover, checkbox rows, a `<When>` follow-up |
| `kite` | Travel survey, one question per screen | Picture tiles drawn in SVG, letter keys, auto-advance |
| `fern` | Garden planner, one question per screen | A garden beside the questions that grows a piece per step |
| `mesa` | Restaurant booking in three courses | A stepper named Starter, Main, Dessert; arch tiles |
| `loop` | Bike-share check-in, translated (zh-TW, ja) | A route with a bike that rides to the current stop |
| `meridian` | B2B "talk to sales" | Split info panel and card, segmented choices, a work-email validator |
| `northwind` | Job application | Tab stepper, a review step, role cards in the `aside`, drafts |
| `halden` | Furniture commission | Editorial sheet with numbered rows and a live job docket |
| `sunday-cuts` | Barbershop booking | A custom day picker and a ticket stub that totals the choice |
| `moonlap` | Night-run registration, dark only | A race bib that fills in as you answer, a pace slider, a calendar link |
| `commit-night` | Developer meetup, dark only | A terminal UI with live panes: you, the agenda, seats left |
| `tinbox` | API beta request, dark only | A beige desktop computer drawn in CSS; a knob switches the phosphor |
| `oda` | Studio enquiry as one sentence | Blanks set inline in a paragraph, built on `useField` |
| `pine` | Support request as a chat | A transcript of earlier answers with Edit, quick-reply chips |
| `offsite` | Team offsite RSVP as a bento board | Numbered tiles, a "Next" marker, a progress ring |

## Themes

`themes/` holds the references new forms take their look from. No form imports them: each form above carries only the tokens, CSS and components it uses, so changing a reference never touches it. Studio → Themes shows each on the sample form.

`classic`, `minimal`, `document`, `editorial`, `pop`, `poster`, `conversational`, `chat`, `sentence`, `bento`, `terminal`, `cathode`.
