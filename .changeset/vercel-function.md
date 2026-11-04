---
"@open-form-build/core": minor
---

Deploys a whole Open Form project to Vercel: `createOpenFormApp()` from `@open-form-build/core/vercel` serves the API, form pages and Studio from one function, with responses in Postgres. `open-form init --vercel` adds the function and `vercel.json` to a new project. On Vercel, a database added from the Marketplace (`POSTGRES_URL` or `DATABASE_URL`) is used when `OPEN_FORM_DATABASE_URL` isn't set.
