---
"@open-form-build/core": minor
---

Adds `<FileInput>` for file uploads: each file uploads as it's picked, the server checks its real kind from its first bytes, files are kept in `.open-form/uploads/` or an S3-compatible bucket (`OPEN_FORM_FILES_URL`, for Vercel and other platforms without a disk), and Studio shows and downloads them.
