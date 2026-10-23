---
"@open-form-build/core": patch
---

Form fixes: an error shown when a field loses focus waits until the click on the next control ends, so the click no longer misses, and the step count (`useFormNav().total`, the progress bar and FocusLayout's counter) includes the steps an unanswered question can still reveal.
