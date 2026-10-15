---
"@open-form-build/core": patch
---

`OPEN_FORM_ADMIN_PASSWORD` must now use at least 8 different characters and not just repeat a word or pattern (`passwordpassword`); a server with such a password stops at startup with a message saying so.
