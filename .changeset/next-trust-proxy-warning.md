---
"@open-form-build/core": patch
---

The Next.js route warns once in production outside Vercel when it relies on the default `trustProxy`, since `next start` exposed without a proxy lets clients spoof their IP past rate limits.
