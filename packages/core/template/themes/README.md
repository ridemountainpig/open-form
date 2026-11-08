# Themes

Reference themes for new forms, one each: a folder `themes/<id>/` with `index.ts` (tokens, optionally a CSS file) or `index.tsx` (with components), plus a `THEME.md` that tells people and agents what the theme is for. A single file `themes/<id>.ts` works too.

Forms never import these, like open-slide's themes. Your agent copies one's tokens into a new form and writes the rest of that form's look in `forms/<id>/theme/`, reading the theme and taking only what the form uses. Editing or deleting a theme here never changes an existing form.

```bash
pnpm exec open-form theme check brand               # WCAG contrast, light and dark
pnpm exec open-form theme font brand Inter          # download a Google Fonts family into themes/brand/fonts/
```

Fonts are served from the theme's `fonts/` folder, so respondents never contact Google; a form that uses one gets its own copy in `forms/<id>/theme/fonts/`.

This folder starts empty. Ask your agent for a theme (`create-theme`) from your design system, images or a description; Studio → Themes shows each one on a sample form.
