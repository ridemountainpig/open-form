# web

Open Form's website and docs: Next.js 16 + [Fumadocs](https://fumadocs.dev), modeled on open-slide's `apps/web`.

```bash
pnpm dev:web    # from the repo root → http://localhost:3030
```

| Path | What |
| --- | --- |
| `app/(home)`, `components/landing` | Landing page. The demos render real forms with the `@open-form-build/core` runtime and the starter themes (`@starters/*` → `packages/core/themes`), with `<Form onSubmit>` standing in for the API. |
| `content/docs` | Docs as MDX; `meta.json` files order the sidebar. |
| `app/docs`, `app/api/search` | Docs layout, pages and search. |
| `app/llms.txt`, `app/llms-full.txt`, `app/llms.mdx`, `proxy.ts` | Markdown for agents: `/llms.txt`, `/docs/<page>.mdx`, or any docs URL with `Accept: text/markdown`. |
| `app/og`, `app/opengraph-image.tsx`, `lib/og.tsx` | Open Graph images, rendered with the Geist fonts from `node_modules`. |
| `lib/shared.ts` | Site URL, GitHub repo and other constants. |
