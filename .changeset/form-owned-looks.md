---
"@open-form-build/core": minor
---

Removes `open-form theme copy`: a form's look lives in its own `forms/<id>/theme/` with only the tokens, CSS and components it uses, and themes in `themes/` are references agents read. `open-form create` now always writes `theme/index.ts`, and `--theme` brings in only that theme's tokens and the web fonts they name.
