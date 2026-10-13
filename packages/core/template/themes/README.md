# Themes

Reference themes for new forms, one each: a folder `themes/<id>/` with `index.ts` (tokens, optionally a CSS file) or `index.tsx` (with components), plus a `THEME.md` that tells people and agents what the theme is for. A single file `themes/<id>.ts` works too.

Forms don't use these directly. A form gets its own copy in `forms/<id>/theme/` and owns its look from then on, so editing or deleting a theme here never changes an existing form.

```bash
pnpm exec open-form theme list                       # these themes, then the starters
pnpm exec open-form theme copy brand <form>          # copy one into forms/<form>/theme/
pnpm exec open-form create <form> --theme brand      # …or start a new form with it
pnpm exec open-form theme add editorial              # copy a starter in → themes/editorial/
pnpm exec open-form theme add editorial --as brand   # …under your own name
pnpm exec open-form theme font brand Inter           # download a Google Fonts family into themes/brand/fonts/
```

Fonts are served with the form from the theme's `fonts/` folder (copied with it), so respondents never contact Google.

Starters: `classic` · `editorial` · `terminal` · `brutalist` · `conversational` — copy one into a form directly, or here to adapt. Or ask your agent for a new look (`create-theme`). Studio → Themes shows each one on a sample form.
