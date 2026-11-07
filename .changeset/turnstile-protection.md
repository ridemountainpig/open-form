---
"@open-form-build/core": minor
---

`protection.turnstile: { siteKey }` adds a Cloudflare Turnstile check above the submit button, verified on the server with `OPEN_FORM_TURNSTILE_SECRET`, and every submission attempt, valid or not, now counts against a cap of five times `rateLimit.max`.
