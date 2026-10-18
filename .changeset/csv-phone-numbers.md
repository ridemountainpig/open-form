---
"@open-form-build/core": patch
---

CSV exports write a `+` followed only by digits, such as an international phone number, as stored instead of with a leading `'`.
