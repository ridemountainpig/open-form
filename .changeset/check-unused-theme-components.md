---
"@open-form-build/core": patch
---

`open-form check` warns when a form's own theme defines components for parts the form never renders, such as a `Rating` in a form without a rating, and when the form doesn't import its own theme at all.
