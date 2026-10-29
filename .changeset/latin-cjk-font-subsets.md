---
"@open-form-build/core": patch
---

`open-form theme font` and Studio's Google Fonts picker download only the Latin subsets and CJK slices Open Form's languages use, `create --theme` no longer copies fonts its tokens don't name (it prints where they are instead), and `open-form check` flags font files a form never loads.
