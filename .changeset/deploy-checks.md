---
"@open-form-build/core": patch
---

Catches a bad admin password or secret, and on Vercel a missing secret or database, when `open-form build` runs, so the deployment fails instead of the site. An admin password that breaks the rules at run time now turns only Studio off on Vercel (and the admin API in Next.js), and forms keep taking responses.
