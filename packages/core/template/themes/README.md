# Themes

Reference themes for new forms, one each: a folder `themes/<id>/` with `index.ts` (tokens, optionally a CSS file) or `index.tsx` (with components), plus a `THEME.md` that tells people and agents what the theme is for. A single file `themes/<id>.ts` works too.

Forms never import these, like open-slide's themes. A new form can start from one's tokens; your agent then writes the rest of that form's look in `forms/<id>/theme/`, reading the theme and taking only what the form uses. Editing or deleting a theme here never changes an existing form.

```bash
pnpm exec open-form theme list                       # these themes, then the starters
pnpm exec open-form create <form> --theme brand      # a new form whose theme/index.ts starts from brand's tokens
pnpm exec open-form theme add editorial              # copy a starter in → themes/editorial/
pnpm exec open-form theme add editorial --as brand   # …under your own name
pnpm exec open-form theme font brand Inter           # download a Google Fonts family into themes/brand/fonts/
```

Fonts are served from the theme's `fonts/` folder, so respondents never contact Google; a form started from a theme gets the fonts its tokens name.

Starters: `classic` · `editorial` · `terminal` · `brutalist` · `conversational` — references too; add one here to adapt it. Or ask your agent for a new look (`create-theme`). Studio → Themes shows each one on a sample form.
