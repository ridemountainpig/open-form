---
"@open-form-build/core": patch
---

`open-form start` and `open-form dev` no longer stall a kept-alive connection after refusing a request without reading its body, such as an oversized submission, so the next request a reverse proxy sends down that connection is answered instead of timing out.
