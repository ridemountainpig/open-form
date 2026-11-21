---
"@open-form-build/core": minor
---

`protection.turnstile: { siteKey }` adds a Cloudflare Turnstile check on submit, verified on the server with `OPEN_FORM_TURNSTILE_SECRET`. It runs out of sight and opens in a dialog only when Cloudflare asks the respondent to tick a box. Every submission attempt, valid or not, now counts against a cap of five times `rateLimit.max`.
