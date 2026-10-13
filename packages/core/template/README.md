# Forms

Built with Open Form — your agent writes the questions and logic, Open Form handles the runtime, validation, submissions, storage and responses.

```bash
pnpm dev        # Studio at http://localhost:3000/studio
pnpm build      # production build
pnpm start      # serve forms + API + SQLite
```

- Forms live in `forms/<id>/index.tsx` and are served at `/f/<id>`.
- Responses are stored in `.open-form/open-form.db` (SQLite, gitignored).
- Export: `pnpm exec open-form responses export <id> -o responses.xlsx` (or `.csv`, `.json`).
- Each form owns its look: a copy of a theme in `forms/<id>/theme/`, made with `pnpm exec open-form theme copy <theme> <id>` (or `pnpm exec open-form create <id> --theme <theme>`). Edit it freely; no other form changes.
- `themes/` holds your reference themes for new forms — browse them in Studio → Themes. Start from a starter (`classic`, `editorial`, `terminal`, `brutalist`, `conversational`) with `pnpm exec open-form theme add <starter>`, or ask your agent for a new one (`create-theme`). Changing a theme there never changes a form that already copied it.

## Deploying

`open-form start` needs a persistent disk for `.open-form/` (VPS, Docker, Railway / Fly.io with a volume). It reads these variables from the environment, or from a `.env` file in this folder (the environment wins).

| Variable | Purpose |
| --- | --- |
| `PORT` | Port to listen on (default: `port` in `open-form.config.ts`, else 3000) |
| `HOST` | Address to bind (default `0.0.0.0`) |
| `OPEN_FORM_ADMIN_PASSWORD` | Enables Studio in production; a password you choose and sign in with. At least 16 characters — a passphrase of a few words works |
| `OPEN_FORM_DB` | SQLite file path (default: `storage.path` in `open-form.config.ts`, else `.open-form/open-form.db`) |
| `OPEN_FORM_SECRET` | Signs form tokens and Studio sessions; at least 16 characters (default: generated into `.open-form/secret`) |
| `OPEN_FORM_WEBHOOK_SECRET` | Signs `webhooks` deliveries ([Standard Webhooks](https://www.standardwebhooks.com)); base64, optionally prefixed `whsec_` |
| `OPEN_FORM_TRUST_PROXY` | Number of reverse proxies in front of the server (usually `1`), or `true` for one, so rate limits and sign-in attempts count each visitor. `trustProxy` in `open-form.config.ts` wins over it |
| `OPEN_FORM_SECURE_COOKIES` | With a trusted proxy, cookies are always marked `Secure`; `0` marks them `Secure` only for requests made over HTTPS |

Put the server behind HTTPS (a reverse proxy or your platform's TLS). Forms and Studio work behind a proxy that ends TLS without any setting, and cookies are marked `Secure` whenever the browser is on HTTPS. Still set `OPEN_FORM_TRUST_PROXY` to the number of proxies: without it every visitor shares the proxy's address, so one person can use up a form's rate limit or lock everyone out of Studio sign-in. Never set it higher than the real number of proxies, or clients can pick their own IP (the server warns once if requests carry `X-Forwarded-For` without it). Changing `OPEN_FORM_ADMIN_PASSWORD` signs everyone out of Studio.
