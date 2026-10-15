---
"@open-form-build/core": patch
---

The generated signing secret is now written next to the database, so pointing `OPEN_FORM_DB` or `storage.path` at a volume keeps the secret across redeploys too; an existing `.open-form/secret` is carried over.
