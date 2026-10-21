---
name: create-theme
description: Use when the user wants a new look for their forms — "make it look like our product / brand / website", "create a theme", "match our design system", "a dark neon theme", "extract a theme from this screenshot", or when `create-form` picked a direction that needs a theme that doesn't exist yet. Produces a reusable reference theme `themes/<id>/` (tokens, optional CSS and components, THEME.md) that forms take their look from. Not for small tweaks to one form's look — edit that form's own look in `forms/<id>/theme/`.
---

# Create a theme

A theme is a reusable visual identity for forms: **tokens** (colors, type, radius, spacing), optional **CSS** and **components**, and a **THEME.md** that tells future agents how to write forms in it. Themes in `themes/` are **references**, like open-slide's: an agent reads one while writing a form's look, and no form imports or copies it. A form takes the tokens (`open-form create <form> --theme <id>`) and writes the rest of its look for itself in `forms/<form>/theme/`, so changing a theme later never changes an existing form. The theme's `index.tsx` and CSS are a working reference — Studio previews them and agents borrow from them — and THEME.md is the recipe. The technical contract is in `form-authoring` (*Themes* and *Layouts and chrome*) — read it first.

You write under `themes/<id>/` — plus a form's own look when the theme is for that form (Step 8).

Run `open-form` through the workspace's package manager and type-check with its `typecheck` script, as AGENTS.md → Commands shows (`pnpm exec open-form`, `npx open-form`, …; `pnpm typecheck`, `npm run typecheck`, …).

## Step 1 — Identify the source

A theme can come from any mix of:

- **The repo's design system** — "make it look like our product". Most common; look before asking.
- **Images** — screenshots, a mood board, a brand guide (open and look at them).
- **A description** — "dark, neon, arcade", "calm clinic", "Swiss poster".
- **A starter to adapt** — "editorial but with our colors".

If the request doesn't make the source clear, ask once — a multi-select question, with a question tool if you have one.

## Step 2 — Gather concrete decisions

### From the repo

Search for real tokens rather than guessing:

- Tailwind: `tailwind.config.*` (`theme.extend.colors`, `fontFamily`, `borderRadius`), or v4 `@theme { --color-…; --font-…; --radius-… }` in CSS.
- CSS variables: `app/globals.css`, `src/styles/*.css`, `styles/theme.css` — shadcn projects define `:root { … }` and `.dark { … }`.
- Theme objects: `theme.ts`, `tokens.json`, `design-tokens/*`, Chakra / MUI / Mantine theme files.
- Fonts: `next/font` calls in `app/layout.tsx`, the `geist` package, `@font-face`, Google Fonts `<link>`s.
- Brand: logo SVG fills, `public/` assets, `manifest.json` `theme_color`.
- The product's own controls: input style (bordered / filled / underline), button shape (`rounded-full` = pill), label placement, button height.

**shadcn / Tailwind → Open Form tokens** (names don't line up — watch the traps):

| Product token | Open Form token | Note |
| --- | --- | --- |
| `--background` | `background` | page behind the form |
| `--card` | `surface` | the form card |
| `--foreground` | `foreground` | |
| `--muted-foreground` | `muted` | shadcn `--muted` is a *background*, not this |
| `--border` | `border` | decorative edges only |
| `--input` | `control` | **shadcn `--input` is a border color**; Open Form `input` is the field *background* (usually `--card` / `--background`) |
| `--primary` / `--primary-foreground` | `primary` / `primaryForeground` | |
| `--destructive` | `error` | |
| `--ring` | — | focus uses `primary` |
| *(none)* | `success` | use the brand's green if it has one, else a green that passes 3:1 on `surface` |
| `--radius` | `radius` | `rounded-full` buttons → `buttonRadius: '999px'` |

Colors may be pasted as-is: every token is a CSS color, so `oklch(…)`, `hsl(…)` and hex all work. `open-form theme check` (Step 7) reads hex, `rgb()`, `hsl()`, `oklch()` and `oklab()`; it can't resolve `var()` or `color-mix()`, so don't use those in tokens.

### From images or a description

Name dominant colors, the type personality (serif / grotesk / mono / rounded, weight), density, corner style, borders vs. shadows, decorative motifs. Resolve vague words into decisions before writing.

Give the theme **one distinctive move** — a display heading font, a textured brand panel, an unusual control shape (underlines, pills, chunky blocks) — and keep everything else quiet. A theme that's only "clean and modern" ends up as `classic` with a new primary color.

When sources disagree, ask which wins.

## Step 3 — Pick an id, a starting point and a depth

- **Id**: kebab-case, short — `acme`, `ledgerly`, `clinic-calm`, `arcade-neon`. Check `open-form theme list` for ids already in `themes/`.
- **Start from the closest starter** — always a folder:

  ```bash
  open-form theme add <closest> --as <id>     # → themes/<id>/
  ```

  Only the `[data-of-theme="<starter>"]` selectors and THEME.md's name and heading become `<id>`. File names and class prefixes stay the starter's: `theme add editorial --as acme` gives `themes/acme/editorial.css` with `.ed-…` classes. Rename them if you want your own, updating the CSS import with them.

  | Target feel | Start from |
  | --- | --- |
  | Product UI, SaaS, shadcn-style | `classic` |
  | Premium, serif, editorial, split panel | `editorial` |
  | Developer, mono, dark | `terminal` |
  | Loud, chunky, campaign | `brutalist` |
  | Survey, one question per screen, soft | `conversational` |

- **Depth** — use the lightest level that reaches the look:
  1. **Tokens** — colors, fonts, `radius`, `buttonRadius`, `spacing`, `width`, `layout`, `components.Layout`. Covers most product themes (pill buttons are just `buttonRadius`).
  2. **Tokens + CSS** — `import './<id>.css';` at the top of `index.ts` (or the starter's CSS file, if it came with one), for chrome details tokens can't express: button weight / shadow, header treatment, card border, pill choices, glyphs drawn with `::before`. Scope every rule to `[data-of-theme="<id>"]`; a form writing its look from it scopes the same rules to its own id.
  3. **Full** — custom components (`themes/<id>/index.tsx`) only where the look needs markup or behavior the runtime's doesn't have: a branded window or layout, a wrapper for an animated underline, keyboard shortcuts. A form takes such a piece only when it uses it, so keep each one small and self-contained.

## Step 4 — Write tokens

- Fill **every** color: `primary`, `primaryForeground`, `background`, `surface`, `foreground`, `muted`, `border`, `control`, `input`, `error`, `success`.
- Dark mode: provide `dark` for every color too (from the product's `.dark` block, or derive: darken backgrounds, lift text, keep `primary`'s hue and raise its lightness). No dark mode in the product → `dark: false`. Dark-only brand → `colorScheme: 'dark'` with the dark palette in `colors`.
- **Fonts** — the product's `next/font` / `geist` package isn't available to forms (they're a different app). Options, in order:
  1. A system stack with the brand font first: `'"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif'` — the brand font shows only where installed.
  Always end with `var(--of-cjk)` (or `var(--of-cjk-serif)` for serif stacks) before the generic family, never a specific CJK font: the runtime fills it with Traditional Chinese, Simplified Chinese or Japanese fonts to match the form's `locale`, since the same characters are drawn differently in each.
  2. A Google Fonts family: `open-form theme font <id> <Family>` (e.g. `theme font acme Inter`) downloads every face into `themes/<id>/fonts/`, writes `fonts/<slug>.css` (woff2 split by `unicode-range`) and imports it from the theme, then prints the `font` value to use. CJK families take a few MB on disk (respondents only download the slices a page uses) — tell the user. `create --theme` brings the fonts the tokens name into the new form.
  3. Any other licensed font: copy the `.woff2` into `themes/<id>/fonts/` and declare `@font-face` in the theme CSS.
  Never link `fonts.googleapis.com` from a theme: every respondent's browser would then contact Google, a privacy problem under the GDPR. Use 2 instead.
  Use 2 or 3 only when the font is central to the brand (display headings, a distinctive wordmark-like face) or the user asks.
- Sizes: keep controls and buttons **≥ 44px tall** even if the product's are 40px (touch targets); keep `spacing` / `width` defaults unless the product is clearly denser or airier.

## Step 5 — CSS and components (depth 2–3)

Follow `form-authoring` → *Themes* → *Components*:

- Every control spreads `field.controlProps` and attaches `field.ref`; groups pass `aria-invalid` / `aria-describedby` to each input; `Field` renders label (`htmlFor` / `legend`), `field.description` with `id={field.descriptionId}`, and `field.error` with `id={field.errorId}`.
- Keep native inputs (visually hidden + styled label, or `appearance: none`); keep a **solid** focus outline (2px `var(--of-primary)`), not a faint tint.
- Prefix classes (`.acme-…`), build on `var(--of-*)`, scope overrides of built-in chrome (`.of-form`, `.of-title`, `.of-button`, `.of-page-title`, `.of-alert`) to `[data-of-theme="<id>"]`. To beat the runtime's mobile rules use `.of-root[data-of-theme="<id>"] …`.
- **Keep the language picker's corner clear.** A form with translations shows a picker (`.of-lang`) 12px inside the top-right corner of `.of-root`, 32px tall. The built-in layouts start below it; a custom `Layout`, or a theme that changes `.of-root`'s padding, has to as well — at every width, phones included. Nothing may sit under it: not the title or description, not window chrome or a title bar, not a card's edge. Reserve the room — `.of-root[data-of-theme="<id>"]:has(> .of-lang) { padding-top: clamp(56px, 6vw, 64px); }` starts the layout 56px down — or move the picker into space the layout leaves free (`[data-of-theme="<id>"] .of-lang { top: …; right: …; }`).
- Prefer the runtime's hover (darker) over a product hover that lightens the button, if the lighter state fails contrast.

## Step 6 — Write `themes/<id>/THEME.md`

Same shape as the starters', so `create-form` can compare themes. Studio shows it as the theme's page — `description` under the name in the gallery, the body beside the live palette, type and shape — so write it for a person choosing a theme, not only for agents:

````markdown
---
name: <Human name>
description: <one line: the look in concrete terms>
layout: <default card | SplitLayout | StepperLayout | FocusLayout | custom>
---

# <Name>

**Source:** <files the tokens came from, so the theme can be refreshed — omit if not from the repo>

**Mood:** <2–3 adjectives and what it should feel like>

**Best for:** <kinds of forms and audiences>

**Avoid when:** <where it would hurt>

## Palette

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `primary` | `#…` | `#…` | … (note any value adjusted for contrast, with the original) |

Every color token gets a row — `primary`, `primaryForeground`, `background`, `surface`, `foreground`, `muted`, `border`, `control`, `input`, `error`, `success` — then the rest of the tokens: `font`, `headingFont`, `radius`, `buttonRadius`, `spacing`, `width`, `colorScheme`, and the layout (`components.Layout`). A form's look starts from exactly these.

## Typography

## Layout & components

## Signature ideas

## Copy tone

## Do / Don't
````

*Layout & components*: say what each part is — tokens, CSS on which runtime classes, or a component in `index.tsx` and why CSS can't do it — so an agent writing a form's look knows what to take.

*Signature ideas*: two or three form-specific elements that fit the theme (*Design guidelines → Look* in `form-authoring`), each with where it lives in this theme's layout (`aside` beside the card, in a split panel, at the bottom of a custom layout, or the success screen when the layout has no `aside`) and how to style it. The starters' THEME.md files show the shape.

## Step 7 — Check it

Run these whether or not a dev server is up:

```bash
open-form theme check <id>   # WCAG contrast for every pair forms use, light and dark
pnpm typecheck               # tsc --noEmit, via the workspace's package manager
```

**Brand vs. contrast**: accessibility wins for text and controls. When a brand color fails (e.g. white on a light emerald button is ~3.5:1, needs 4.5:1), keep the hue and lower the lightness (in `oklch`, reduce L by 0.03–0.08) until it passes, then tell the user the exact adjustment and the original value. Don't silently keep a failing color, and don't fix it per component — fix the token. `border` is decorative and exempt; `control` is not.

Then look at it — contrast numbers don't show whether it looks right. With a browser tool (a browser MCP, Playwright, Claude in Chrome, your editor's preview), open `/studio/themes/<id>` on the URL `open-form dev` printed (default `http://localhost:3000`; if nothing answers, start the `dev` script in the background and stop it afterwards): the theme on a sample form with every component — jump to any step or the success screen, in light and dark, in Studio's language — next to THEME.md and the same contrast report. Screenshot light and dark, compare them with the source (the product, the images, the description) and fix what's off. The sample form there has no language picker, so the corner gets checked on a real form in Step 8. Without a browser tool, say you haven't seen it.

Studio's Themes pages are read-only (in production builds too): changes to a reference come from you. The theme's page hands the user prompts to paste to you — *Change this theme* ("Update the Open Form theme “<id>” (<file>): …"), the gallery's *New theme* ("Create a new Open Form theme: …"), and for a theme without THEME.md "Write THEME.md for …" — treat each like any theme request: read THEME.md, edit tokens / CSS / components, run `theme check`, update THEME.md. Editing the reference affects only forms created from it afterwards.

## Step 8 — Use it in a form and hand off

- When the theme is for a new form, start it with `open-form create <form> --theme <id>` (the tokens, wired up), then write the rest of the form's look as `create-form` → Step 5 describes: only the CSS and components that form uses, taken from this theme. For a form that already exists, write the same into its `forms/<form>/theme/` — set its tokens there, keep what the form already has, and look at it first. Run `open-form check <form>`, then look at the form as `create-form` → Step 6 → *Look at it* describes: `/f/<form>` on desktop and phone width, every step through Studio's Preview, a validation error. When the form has translations, check the language picker covers nothing at phone (~390px) and tablet (~600px) width too (Step 5). A test submission is stored for real — delete it under Responses.
- Changing `themes/<id>/` later doesn't update any form. To bring a change to one, make it in that form's own look.
- "Our forms" / "everything" means writing the look into each form the user means; there's no project-wide theme.
- Tell the user: the theme id and folder, where the tokens came from, any contrast adjustments (original → new), which forms now use it, and that `themes/<id>/` is theirs to edit — as the reference for new forms.
