---
"@open-form-build/core": patch
---

Dates with an offset (`'2026-02-30T19:00+08:00'`) that don't exist are rejected like other bad dates instead of rolling over to the next month.
