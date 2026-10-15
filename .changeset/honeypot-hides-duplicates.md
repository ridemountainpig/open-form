---
"@open-form-build/core": patch
---

Submissions caught by the honeypot no longer answer `409`, so they can't be used to check unseen whether a `uniqueBy` value has already responded.
