# Open Form — Architecture

[English](./ARCHITECTURE.md) · 繁體中文

> **The form framework built for agents.**
> Your agent writes the questions and logic. Open Form handles everything that makes them a form.

```
Questions + Logic  →  Production-ready Form  →  Responses
```

本文件描述 Open Form 的整體架構、模組邊界與關鍵設計決策。它延續 [open-slide](https://github.com/open-slide/open-slide) 的架構經驗：**使用者 workspace 只放 artifact（forms/），Vite / React / server 全部藏在 framework 套件裡**。

---

## 1. 與原始構想的差異（以及原因）

原始構想列出的技術選擇大多保留，但有六個地方根據 open-slide 的實際架構與 npm 現況做了調整：

| 原始構想 | 實際採用 | 原因 |
| --- | --- | --- |
| Next.js | **Vite（隱藏在套件內）+ Web-standard `fetch` handler** | open-slide 的核心經驗：使用者 repo 只有 `forms/`、`open-form.config.ts`、`package.json`，沒有 `app/`、沒有 `next.config`。Next.js 要求 `app/` 在使用者專案內，無法像 Vite 一樣把整個 app 藏在 `node_modules`。Server 端寫成 `(Request) => Response`，所以也能掛進 Next.js Route Handler（`@open-form-build/core/next` adapter，見 §7）。 |
| 10 個 `@open-form/*` 套件 | **`@open-form-build` npm org 底下兩個發佈套件：`@open-form-build/core`（framework，內部分層 + subpath exports，附 `open-form` CLI）與 `@open-form-build/cli`（建立 workspace），另有 unscoped 的 `create-open-form` 提供 `npm create open-form`** | npm 上 `@open-form/core`、`@open-form/cli` 已被其他人註冊，scope 不在我們手上；unscoped 的 `open-form` 也被 npm 判定和既有的 `openform` 太像而拒絕發佈。做法比照 open-slide（`@open-slide/core` + `@open-slide/cli`）：workspace 直接依賴並 import `@open-form-build/core`，用 `npx @open-form-build/cli init` 建立。open-slide 沒有的是 `create-open-form`：提供 `npm create open-form@latest` / `pnpm create open-form` 這個慣例，執行的是同一個 `init`。分層改用 `src/<layer>/` + Biome `noRestrictedImports` 強制依賴方向，對外以 `@open-form-build/core`、`@open-form-build/core/schema`、`@open-form-build/core/server`、`@open-form-build/core/sqlite` 等 subpath 暴露。日後真的需要拆套件，邊界已經在了。 |
| Drizzle + SQLite driver | **`node:sqlite`（Node 內建）+ 手寫 4 張表的 storage adapter** | 「Zero infrastructure to start」：不需要 native addon（better-sqlite3 要編譯）、不需要 ORM。4 張表、十來個 query，用 ORM 反而增加安裝體積。Postgres adapter 階段再評估 Drizzle。 |
| Zod | **內建輕量 validation engine + 支援 Standard Schema** | Client 與 server 必須用**同一份**驗證邏輯，schema 也必須能序列化存進 DB。內建 engine 處理 required / length / pattern / range / options；escape hatch `validate` 接受函式或任何 [Standard Schema](https://standardschema.dev)（Zod、Valibot、ArkType 皆實作），所以 Zod 可用但不是依賴。 |
| Radix / shadcn | **Form runtime 用原生 input + CSS variables；Studio 用 Tailwind** | 原生 `<select>`、`<input type=radio>` 在手機上的 a11y 與體驗最好，且 runtime 0 額外依賴、可以被任何 React app 嵌入。Studio（我們自己的 UI）沿用 open-slide 的 Tailwind 做法。 |
| `<Number />`、`<Date />` | **`<NumberInput />`、`<DateInput />`** | `import { Number, Date }` 會遮蔽同檔案裡的 JS 全域 `Number()` / `new Date()`（Biome `noShadowRestrictedNames` 也會報錯）。Agent 很常在 validator 裡寫 `Number(v)`，改名避免這個陷阱。 |

---

## 2. Repo layout

```text
open-form/                         ← 本 repo（pnpm + Turborepo monorepo）
├── packages/
│   ├── core/                      ← 發佈到 npm 的 framework（package name: @open-form-build/core）
│   │   ├── src/
│   │   │   ├── schema/            純 TS：FormSchema、validation、conditions、policy、config 型別
│   │   │   ├── react/             Form runtime + DSL 元件 + schema collector（瀏覽器安全）
│   │   │   ├── server/            Web-standard fetch handler、submission pipeline、protection、export
│   │   │   ├── storage/           StorageAdapter 介面 + in-memory adapter（測試用）
│   │   │   ├── sqlite/            node:sqlite adapter（預設 storage）
│   │   │   ├── node/              Node http adapter、production server、secret 管理
│   │   │   ├── next/              `@open-form-build/core/next`：Next.js App Router route handler
│   │   │   ├── vite/              Vite plugin：forms 探索、virtual modules、dev API middleware
│   │   │   ├── editing/           dev 寫回原始碼（Babel AST）：收件設定、主題 token、文字、翻譯、留言、資料夾、loc 標記
│   │   │   ├── cli/               `open-form` CLI：init / dev / build / start / create / check / comments / list /
│   │   │   │                      responses export / theme list|check|add|font / sync:skills
│   │   │   ├── app/               隱藏的 Vite app（原始碼形式出貨）：公開表單頁 + Studio
│   │   │   └── index.ts           給 forms import 的公開 DSL 入口
│   │   ├── themes/                範本主題（classic、editorial、terminal、brutalist、conversational），`theme add` 與 `create --theme` 的參考
│   │   ├── skills/                內建 agent skills（create-form、create-theme、form-authoring、current-form、apply-comments）
│   │   ├── template/              `open-form init` 用的 workspace 模板
│   │   └── e2e/                   smoke test：scaffold → build → start → submit → export
│   ├── cli/                       ← @open-form-build/cli：`npx @open-form-build/cli init` 執行 core 的 CLI
│   └── create-open-form/          ← create-open-form：`npm create open-form@latest` 執行 core 的 `init`
├── apps/
│   └── demo/                      dogfood workspace，透過 workspace:* 使用本地 framework
└── docs/
    ├── ARCHITECTURE.md            英文版
    ├── ARCHITECTURE.zh.md         本文件
    ├── ROADMAP.md
    └── ROADMAP.zh.md
```

使用者 workspace（`npm create open-form@latest my-forms` 產生）：

```text
my-forms/
├── forms/
│   └── event-registration/
│       ├── index.tsx              ← agent 寫的地方
│       └── theme/                 ← 這張表單自己的外觀（token ＋ 它用到的 CSS 與元件），只有它在用
├── themes/
│   └── <id>/index.tsx + THEME.md  ← 建立新表單時的參考（從範本 theme add，或 create-theme 產生）
├── open-form.config.ts
├── AGENTS.md  (CLAUDE.md → AGENTS.md)
├── .agents/skills/                ← 內建 skills（.claude/skills 為 symlink）
├── .open-form/                    ← runtime data，gitignored
│   ├── open-form.db
│   └── secret
├── package.json
└── tsconfig.json
```

**Repo owns the artifact. Runtime data stays yours.** Git 裡有 questions、logic、validation、theme、submission policy；`.open-form/` 裡有 responses、visitor hash、rate-limit state，永遠不進 git。

---

## 3. 分層與依賴方向

```text
                 schema   (純 TS：無 React、無 Node API)
                ↗      ↖
            react      server ──→ storage (介面)
              ↑          ↑           ↑
             app         │        sqlite (node:sqlite)
                         │           ↑
                       node ─────────┘      Node http adapter、production server
                       ↑  ↑
                    next  vite ⇄ editing    dev middleware；editing 以 Babel AST 寫回原始碼
                           ↑
                          cli
```

| Layer | 可以 import | 不可以 import | 對外 subpath |
| --- | --- | --- | --- |
| `schema/` | — | react、node:*、其他 layer | `@open-form-build/core/schema` |
| `react/` | `schema/`、react | node:*、server、storage、sqlite、node、vite、cli | `open-form`（DSL） |
| `storage/` | `schema/` | react、node:*、其他 layer | `@open-form-build/core/server`（型別、`createMemoryStorage`） |
| `server/` | `schema/`、`storage/` | react、node:*、sqlite、node、vite、cli、app | `@open-form-build/core/server` |
| `sqlite/` | `storage/`、`schema/`、node:sqlite | react（慣例） | `@open-form-build/core/sqlite` |
| `node/` | `server/`、`sqlite/`、`schema/`、node:* | — | `@open-form-build/core/node` |
| `next/` | `node/`、`server/`、`sqlite/`、`schema/` | — | `@open-form-build/core/next` |
| `editing/` | `schema/`、`vite/project.ts`、`@babel/parser`、node:* | — | （內部，供 vite / cli 使用） |
| `vite/`、`cli/` | 全部 | — | `@open-form-build/core/vite`（內部） |
| `app/` | `react/`、`schema/`；`editing/` 只取純資料與型別（`folder-colors.ts`、`folders.ts` 的 type） | node:*、server、storage、sqlite、node、vite、cli | （由 Vite 編譯，不對外） |

另外還有 `@open-form-build/core/styles.css`（runtime 基本樣式）與 `@open-form-build/core/env`（表單 import 圖片等資源的 ambient 型別，workspace 的 tsconfig 以 `types` 引入）。

`server/` 只依賴 Web 標準（`Request`、`Response`、`crypto.subtle`），所以同一個 handler 可以跑在 Vite dev middleware、Node production server、Next.js Route Handler（`@open-form-build/core/next`），未來也能跑在 Cloudflare Workers、Bun。

`biome.json` 的 `noRestrictedImports` overrides 強制其中三組：`schema/`、`react/` + `app/`、`server/` + `storage/`（表中的「不可以 import」）。`sqlite/`、`node/`、`next/`、`editing/`、`vite/`、`cli/` 沒有 lint 規則，靠慣例維持。

---

## 4. Form file contract

```tsx
// forms/meetup/index.tsx
import { defineForm, Email, Form, Page, Select, Submit, Text, When } from '@open-form-build/core';

export const config = defineForm({
  title: 'Developer Meetup Registration',
  description: 'Join us on Oct 30 in Taipei.',
  submissions: { maxResponses: 100, uniqueBy: 'email', closesAt: '2026-10-30' },
});

export default function Meetup() {
  return (
    <Form>
      <Page title="About you">
        <Text name="name" label="Name" required />
        <Email name="email" label="Email" required />
      </Page>
      <Page title="Background">
        <Select name="role" label="Role" options={['Student', 'Engineer', 'Designer']} required />
        <When field="role" equals="Student">
          <Text name="school" label="School" required />
        </When>
      </Page>
      <Submit>Register</Submit>
    </Form>
  );
}
```

- `forms/<kebab-id>/index.tsx`，`id` 就是資料夾名稱，也是公開 URL：`/f/<id>`。
- `export const config = defineForm({...})`：title、submission policy、protection、success 訊息。**伺服器端的規則都在這裡**。
- `export default` 一個 React component，回傳 `<Form>`。裡面可以放任何 React（自訂元件、`.map()`、`<div>` 排版），只要欄位使用 DSL 元件或 `useField()`。

---

## 5. Schema：TSX 是 source of truth，schema 是衍生物

伺服器驗證、Responses 欄位、版本紀錄、匯出都需要一份可序列化的 schema。Open Form 不做 AST 靜態分析（遇到自訂元件、`.map()` 就失準），而是 **render-to-collect**：

```text
forms/<id>/index.tsx
        │  (dev: Vite ssrLoadModule / prod: Vite SSR build)
        ▼
renderToString(<CollectProvider><FormComponent/></CollectProvider>)
        │  collect 模式下：
        │   • <Form> 渲染「所有」Page
        │   • <When> 不判斷條件，把條件推入 context stack 後渲染 children
        │   • 每個欄位（含自訂元件的 useField）把自己註冊到 collector
        ▼
FormSchema { id, title, pages[], fields[{ name, type, label, required, options, page, when[] … }] }
        │
        ├─→ version = schemaVersion()：stable JSON 的 cyrb53 雜湊，12 個 hex（同步、只當指紋，不是安全用途）
        ├─→ server validation（含 custom validate 函式，因為 server 真的載入了 module）
        ├─→ form_versions 表（每次 submission 記錄當下的 schema 版本）
        └─→ Studio responses 欄位 / CSV、Excel 匯出欄位
```

Client 與 server 共用 `schema/` 的 `evaluateCondition()`、`validateField()`、`resolveVisibleFields()`，保證「前端說可以送出」與「後端接受」一致。瀏覽器載入時會再做一次 collect render（render 到脫離文件的節點），所以手上有和 server 相同的 schema；`<When>`、步驟可見性、custom validator 的 `allValues`、`onSubmit` 的值與 server 錯誤導回步驟，全部來自 `coerceValues` + `resolveVisibleFields`。

---

## 6. Form Runtime（client）

`<Form>` 擁有一個小型 external store（`useSyncExternalStore`，每個欄位只訂閱自己的值）：

- **State**：values、errors、touched、step、status（idle / submitting / success / error）。
- **Multi-step**：`<Form>` 把 top-level children 切成 steps（每個 `<Page>` 一步；被 `<When>` 包住的 `<Page>` 是條件步驟，條件不成立自動跳過）。沒有 `<Page>` 就是單頁表單。
- **Validation**：欄位掛載時註冊到 registry；按 Next 時驗證「目前掛載的欄位」（隱藏的 `<When>` 欄位不會被驗證）；錯誤時 focus 第一個錯誤欄位。
- **Conditional**：`<When>` 訂閱相關欄位的值；隱藏欄位的值保留在 state（切回來不會遺失），條件只讀可見欄位 coercion 後的答案，送出時由 server 依條件剔除隱藏欄位。
- **Submission**：`POST /api/forms/:id/submissions`，帶上 protection token 與 honeypot；server 回傳的 field errors 會導回對應的 step。
- **UX**：progress、Back/Next、Enter 鍵前進、focus 管理、`aria-invalid` / `aria-describedby`、loading、success、error、closed / full 狀態。
- **Theme**：CSS variables（`--of-*`）；由表單自己的 `forms/<id>/theme/index.tsx` 透過 `defineTheme()` 覆寫，以 `<Form theme>` 傳入。

### 外觀元件（v0.2）

內建欄位只負責**行為**（`useField`：值、驗證、focus、ARIA），**外觀**交給可替換的元件：

```text
<Text name="email" required />
   │  行為：useField → value / setValue / error / controlProps / ref
   ▼
components.Field      ← label / 說明 / 錯誤
  └ components.TextInput  ← 實際的 <input>
```

| 元件 | 對應的內建欄位 |
| --- | --- |
| `Field` | 所有欄位的外框（`FieldShell` 也用它，所以自訂欄位跟著主題走） |
| `TextInput` | `Text`、`Email`、`Url`、`Tel`、`NumberInput`、`DateInput` |
| `Textarea`、`Select`、`ChoiceGroup`、`Checkbox`、`Rating` | 同名欄位；`ChoiceGroup` 同時負責 `RadioGroup` 與 `CheckboxGroup` |

覆蓋順序：`defaultComponents` ← 主題的 `components` ← `<Form components>`。主題來自 `<Form theme>`（表單自己的外觀），否則來自宿主（`FormHost`、官網 landing、Studio 的主題預覽）的 `runtime.theme`。表單自己的主題以表單為範圍：根元素帶 `data-of-theme="<form-id>"`。它由表單模組 import，所以跟表單一起載入（不需第二個請求），也會進到 server bundle（CSS 會被丟掉）。render-to-collect 不套主題元件，所以伺服器讀到的欄位清單不受外觀影響；欄位註冊發生在行為層。

### 版面與外框（v0.2 Step 2）

表單的「外框」也是可替換元件：`Layout`、`LanguageSwitch`、`Header`、`Progress`、`Nav`、`Button`、`Success`、`Notice`。

```text
<form class="of-frame">            ← framework：送出、Enter、honeypot（display: contents）
  <Layout state nav …regions />    ← 決定怎麼排
     header    = <Header/>
     progress  = <Progress/>
     content   = <div class="of-step">目前步驟</div>   ← framework 渲染：focus、scope、欄位註冊
                 （或成功時的 <Success/>、關閉時的 <Notice/>）
     alert     = live region（表單層級錯誤）
     actions   = <Nav/> → <Button/>
     aside     = <Form aside>
```

`useFormNav()` 提供目前步驟、可見步驟清單、`next()`／`back()`／`goTo()`。內建三種版面：`StepperLayout`（側邊步驟）、`SplitLayout`（品牌面板）、`FocusLayout`（一次一題；表單的 title／description 先以歡迎頁呈現，`cover={false}` 可關閉）。因為目前步驟仍由 framework 決定與渲染，任何版面都不會影響驗證、focus 管理和伺服器端的欄位探索。

### 主題範本、theme add 與表單自己的外觀（v0.2 Step 3，v0.4 改為範本與表單自己的外觀）

```text
packages/core/themes/<id>/
  index.tsx     defineTheme({ tokens, components: { Layout, Field, … } })
  <id>.css      元件樣式（前綴 class）＋ [data-of-theme="<id>"] 範圍內的外框覆寫
  THEME.md      視覺語言：調色盤、字體、元件、文案語氣、適用情境、do / don't
```

| 主題 | 版面 | 定位 |
| --- | --- | --- |
| `classic` | 卡片 | 基本樣子，所有 token 明寫，方便換成品牌 |
| `editorial` | `SplitLayout` | 襯線雜誌風 |
| `terminal` | 終端機視窗 | CLI prompt 風 |
| `brutalist` | 卡片 | 新粗獷主義 |
| `conversational` | `FocusLayout` | 一次一題、字母快捷鍵、自動前進 |

跟 open-slide 一樣，**主題是參考，外觀屬於每張表單**。專案 `themes/` 裡的主題是 agent 寫表單外觀時閱讀的參考，沒有表單拿它來渲染、import 或複製它。`open-form create <id>` 一律寫出 `forms/<id>/theme/index.ts` 並接進表單（在表單 CSS 之前 `import theme from './theme/index.ts'`，`<Form theme={theme}>`）；加 `--theme <theme>` 時，這個檔案從參考主題的 token 開始（對載入的模組做 `pickTokens()`，由 `formThemeSource()` 寫出），token 指名的網頁字型也一起帶過來（`src/editing/theme-files.ts` 的 `writeFormTheme()`）。參考主題的 CSS 與元件永遠不會整份搬進來：agent 只拿表單用得到的部分，順序是 token → 寫在 runtime 自己 class 上的 CSS → 只有 CSS 做不到的結構或行為才寫元件（視窗外框、輸入框外層、鍵盤快捷鍵）。所以表單不會帶著用不到的元件，範本之後的改進也不必複製進既有表單。修改或刪除 `themes/` 裡的主題都不會改變任何表單；改表單自己的外觀也只影響這張表單。沒有 `theme/` 資料夾的表單只套 runtime 的基本樣式；沒有專案預設主題，也沒有「主題不存在就退回」要處理。

範本與參考主題的 `index.tsx` 和 CSS 保持完整，因為 Studio 的主題庫與 `/theme-preview`、官網的 theme wall 都靠它們渲染；每份 `THEME.md` 列出所有 token，以及哪些部分是寫在 runtime class 上的 CSS、哪些需要元件，可以當作配方使用。

上面 5 個是**範本**：`open-form theme add <starter> [--as name]` 把範本複製進 `themes/`（改名時一併改寫 `data-of-theme` selector 與 THEME.md 標題），當成可調整的參考——同 shadcn 的模式。`init` 出來的 `themes/` 是空的。build 只為了 Studio 的唯讀主題頁才帶上 `themes/`：`virtual:open-form/themes` 帶著每個參考主題的 THEME.md（名稱、描述、版面、內文）和一個延遲載入的 import，每個主題各自一個 chunk，表單頁不會載入任何一個；`/theme-preview/:themeId` 跟 Studio 一樣開放。`open-form build` 會先用 SSR 載入每個參考主題（`src/cli/build.ts` 的 `unloadableThemes()`），載不起來的就排除並警告，所以改到一半的參考主題不會擋住 deploy。表單從 `themes/` 或別張表單的資料夾 import 時，`open-form check` 會警告（repo 的 Biome 設定在 `apps/demo` 直接禁止），因為那會把外觀綁回一個可能變動的檔案。表單從參考主題帶來的 class 前綴（`.tm-*` 等）仍是全域的；只有同一頁上兩張表單對同一個前綴寫了不同樣式才會互相影響。

### 多語系（v0.3 Step 1）

- `locale` 設在 `defineForm()` 或 `open-form.config.ts`：`'en'`（預設）、`'zh-TW'`、`'zh-CN'`、`'ja'`。只影響 framework 自己的文字（按鈕、驗證、狀態頁）；題目文案由作者用該語言撰寫。
- 訊息目錄在 `schema/messages.ts`，client 與 server 共用，所以驗證錯誤在兩邊一字不差。每個目錄帶自己的 `locale`，日期用 `Intl` 依語系格式化（`formatDate`／`formatDateTime`）。
- 只有單一語言的表單不會依瀏覽器切換：題目是作者寫的那一種語言，只換按鈕反而不一致。
- **多語系表單（v0.3 Step 2）**：翻譯檔 `forms/<id>/locales/<lang>.json` 以原文為 key（gettext 式），由 `defineForm({ translations })` 引入。原因：表單程式碼維持單一語言、易讀；agent 一次產生整份翻譯；`check` 能精確列出缺漏。翻譯只發生在顯示層（`useTranslate()`／`<T>`），schema、欄位名稱、選項 value、條件、CSV 欄名都維持原文，因此各語言的回覆可以放在同一張表。
- 要翻譯的字串由 render-to-collect 一併收集：collect 模式下每次 `tr()` 都會記錄（含 `<When>` 內的條件內容），加上 config 裡的文字，就是 `check`／Studio 的覆蓋率基準。
- 語言選擇：`?lang=` → 該表單上次的選擇（localStorage）→ 瀏覽器語言 → 原文。送出時帶上 `locale`，伺服器只接受表單提供的語言，用它產生錯誤訊息並存進 `submissions.locale`（migration 2）。
- 字型：runtime 依 `:lang()` 提供 `--of-cjk`／`--of-cjk-serif`，主題的字型堆疊在拉丁字型之後接 `var(--of-cjk)`，不寫死某一地區的字型。網頁字型見 §9「主題字型」。

---

## 7. Server：submission pipeline

`createOpenFormHandler({ registry, storage, secret, … })` 回傳 `(Request) => Promise<Response>`。

```text
POST /api/forms/:id/submissions
  │
  ├─ request guard      same-origin（或 embed.origins；同 host 的 https Origin 打 http URL 也放行，給終結 TLS 的 proxy）、JSON only、body size 上限
  ├─ load definition    registry.load(id) → schema + config + validators
  ├─ policy             config.submissions ← Studio 覆寫（storage.getFormOverrides，見 §9）
  ├─ window             closed / opensAt / closesAt（依表單 timeZone 解讀）
  ├─ timing token       簽章 token（HMAC），驗證 minimumCompletionTime
  ├─ sanitize           依條件計算可見欄位（fixed point，每輪都對全部 coercion 後的答案重新判斷），剔除隱藏與未知欄位、型別 coercion
  ├─ validate           validateField() + custom validators（function / Standard Schema）
  │                      正規表示式只看有上限的輸入：email ≤ 254、有 pattern 沒 maxLength ≤ 1,000（ReDoS）
  ├─ rate limit         storage.hitRateLimit(hmac(form, ip 或 IPv6 /64), window)，只計通過驗證的送出
  ├─ visitor            device cookie（of_vid）→ visitor_hash
  ├─ honeypot           有值 → 跑與真實送出相同的額滿／重複檢查、回相同的結果，不儲存
  ├─ storage.createSubmission(..., { maxResponses, uniqueKey })   ← 在 transaction 內原子檢查
  └─ webhooks           回應後非同步投遞 submission.created（waitUntil）
        │
        └─ 201 { id, number }  /  400 too_fast|invalid_token|expired_token  /  409 duplicate
           410 closed|not_open|full  /  422 { errors }  /  429
```

**時區**：`opensAt`／`closesAt` 的 `YYYY-MM-DD`（整天）與 `YYYY-MM-DDTHH:mm` 是「牆上時間」，依 Studio 覆寫的 `timeZone` → 表單 `timeZone` → 專案 `timeZone` → `'UTC'` 解讀（`schema/time.ts`，以 `Intl` 換算 IANA 時區，不加依賴），從不使用執行環境的本地時區——否則同一份設定在台灣的筆電與 UTC 的容器上會差 8 小時。帶 offset 的 ISO timestamp 照原樣。`open-form init` 把建立者電腦的時區寫進 `open-form.config.ts`；沒設時區又用了牆上時間，`open-form check` 會警告。Studio 的設定頁可以換時區（§9）：換時區時牆上時間不變、時間點跟著移動；完全沒設時區且還沒有日期時，預設帶入瀏覽器裝置的時區，儲存時一併寫入。Studio 的狀態由 server 算好回傳（`/forms/:id/schema` 的 `status`、`opensAt`、`closesAt`），不在瀏覽器用它自己的時區重算。

**Webhooks**：`open-form.config.ts` 的 `webhooks: [{ url, forms? }]`（不放 `defineForm`——表單 config 會打包進瀏覽器，URL 可能本身就是密鑰）。`open-form.config.ts` 在 server 啟動時才執行（server entry 以 `import` 引入，不是 build 時 `JSON.stringify` 的快照），所以 `process.env.RESPONSES_WEBHOOK_URL` 從執行環境讀取，值不會留在 `dist/`，build 也不需要它；缺少時 server 啟動即失敗。每筆新回覆在回應送出後非同步 POST `{ type: 'submission.created', timestamp, data: { form, submission } }`，以 `OPEN_FORM_WEBHOOK_SECRET` 依 [Standard Webhooks](https://www.standardwebhooks.com) 簽章（`webhook-id`／`webhook-timestamp`／`webhook-signature: v1,…`，`whsec_` 前綴為 base64 key）。URL 必須是 `https://`（`http://` 只限 localhost，因為 payload 是填寫者的答案）。最多投遞 5 次（間隔 0、5s、30s、2m、10m，即首次 + 4 次重試，同一個 `webhook-id`），`410 Gone` 停止；log 只記 origin，不記 payload。重試在記憶體中，server 重啟就沒了；serverless 平台用 handler 的 `waitUntil` 讓投遞在回應後繼續。

**Next.js（`@open-form-build/core/next`）**：`createOpenFormRoute()` 回傳 `{ GET, POST, PUT, DELETE, OPTIONS }`，掛在 `app/api/[...openform]/route.ts`。App Router 的 route handler 跑在 React Server Components 層（沒有 `createContext`／`react-dom/server`），不能 render 表單來推導 schema，所以 adapter 讀 `open-form build --server-only` 產生的 `dist/server/entry.js`（自帶 React、單一檔案）——client 與 server 仍來自同一份表單原始碼。非 production 時每個 request 檢查 bundle 的 mtime，變了就以 `?v=<mtime>` 重新 import（所以 server entry 必須是單一檔案：拆出去的 chunk 會 import 沒有 query 的舊 entry，等於兩份 React），並用 bundle 的 `config` 建新的 handler，所以 `--watch` 也會帶上 `open-form.config.ts` 的修改。bundle 是以執行期路徑 import，Next 的 file tracing 看不到它：`output: 'standalone'` 與 Vercel 需要 `outputFileTracingIncludes`；serverless function 也寫不了 `.open-form/secret`，需要 `OPEN_FORM_SECRET`（adapter 的錯誤訊息會說明這兩點）。client IP 從 `X-Forwarded-For` 右邊取（預設 1 層：Next.js／Vercel 會把 client 放在最後）。頁面用 `<FormHost id form config />`（`react/host.tsx`）取得 availability 與 timing token 後 render。已用 Next.js 16（Turbopack）實測 build、start、dev + watch、送出。

**Embed**：`open-form.config.ts` 的 `embed.origins`（origin 清單或 `'*'`）是唯一開關。`/embed.js`（`src/app/embed.js`，build 時複製到 `dist/client/`，不加 hash）把 `[data-open-form]` 換成 `/f/<id>?embed` 的 iframe；嵌入模式下頁面取消 `100dvh`，以 `ResizeObserver` 回報 body 高度（`open-form:resize`），送出後發 `open-form:submitted`——訊息只帶 form id，所以 `targetOrigin: '*'`。`success.redirect` 以 `window.open(url, '_top')` 離開宿主頁。`/f/:id` 的 `frame-ancestors` 跟著 `embed.origins`；CORS 只開在公開路由（表單狀態、送出、其 preflight），永不帶 credentials，admin 永不開。第三方 iframe 存不了 cookie（`SameSite=Lax`、瀏覽器封鎖），所以 runtime 另在 localStorage 保留一個隨機 visitor id（`x-open-form-visitor` header／body `visitor`），server 先用 cookie、沒有才用它——兩者都不是身分，強度相同。

Admin API（Studio 使用）：

```text
GET    /api/forms                                   admin：forms + response counts、狀態、最新回覆時間
GET    /api/forms/:id                               public：狀態 + timing token
POST   /api/forms/:id/submissions                   public：送出（見上方 pipeline）
GET    /api/forms/:id/schema                        admin：schema + 套用覆寫後的 status／opensAt／closesAt
GET    /api/forms/:id/submissions?limit&offset&q    admin（limit 預設 50、上限 500）
GET    /api/forms/:id/submissions/:sid              admin
DELETE /api/forms/:id/submissions/:sid              admin
POST   /api/forms/:id/submissions/delete { ids }    admin：一次刪多筆（1–500），回 { deleted }
PUT    /api/forms/:id/overrides                     admin：Studio 收件設定覆寫（見 §9）
DELETE /api/forms/:id/overrides                     admin：改回程式碼設定
GET    /api/forms/:id/export?format=csv|xlsx|json   admin
GET    /api/studio/session                          登入狀態（signedIn、可否登出、登入方式）
POST   /api/studio/session    { password }          密碼 → session cookie（same-origin、每 IP（IPv6 為每 /64）10 次／10 分鐘）
DELETE /api/studio/session                          登出
```

**Admin 保護**：handler 的 `adminAuth` 決定誰能用 Studio 與 admin API；沒傳就沒有 admin route（回 404，fail-closed）。

- `adminAuth.password`：使用者自訂的共用管理密碼（至少 16 字元，可用 passphrase）。Studio 頁面本身不需登入，進來後顯示登入畫面，`POST /api/studio/session` 換成以 secret 簽章的 session cookie（`of_session`，`HttpOnly; SameSite=Strict`，HTTPS 或 `Origin` 為 https 時 `Secure`，預設 7 天）。比對的是兩邊的 HMAC，不洩漏密碼長度；cookie 帶密碼的指紋，換密碼等於登出所有人。登出（`DELETE /api/studio/session`）把該 session 的簽章記進 `StorageAdapter.revokeSession`（SQLite `revoked_sessions`，保留到原本的到期時間），之後同一個 cookie 一律拒絕——被複製走的 cookie 也跟著失效，server 重啟後依然拒絕。登入嘗試每 IP（IPv6 為每 /64）每 10 分鐘 10 次。
- `adminAuth.authorize(request)`：自訂判斷（SSO session、本機連線）；`signInUrl` 讓 Studio 的登入畫面導向外部登入頁。
- dev：沒設密碼時，`authorize` = 本機直接連線（loopback 連線、loopback `Host`、沒有 `Forwarded`／`X-Forwarded-*`／`X-Real-IP`，且不是其他來源的網頁：`Sec-Fetch-Site` 只能是 `same-origin`／`none`、`Origin` 要同源）；另把 Vite 的 `server.cors` 關掉，否則它會對任何 localhost 來源回 CORS，讓別的 dev server 頁面讀到回覆。設了 `OPEN_FORM_ADMIN_PASSWORD` 就不再信任本機、所有人都登入：nginx 預設的 `proxy_pass`（不加 `X-Forwarded-For`、Host 改成 127.0.0.1）或純 TCP 轉發（`ssh -R`、`socat`）會讓遠端請求看起來像本機，對外開放 dev 前一定要設密碼。dev 專用 endpoint（表單外觀、字型搜尋、folders、comments、source、current）用同一個 gate。
- production（`open-form start`）：只認 `OPEN_FORM_ADMIN_PASSWORD`；沒設定時 Studio 與 admin API 都不存在，只對外提供公開表單。
- 頁面 header：Studio `frame-ancestors 'self'`、`X-Frame-Options: SAMEORIGIN`、`Referrer-Policy: same-origin`；`/f/:id` 預設只允許同源嵌入（`embed.origins` 可開放）。

**Client IP**：`trustProxy`（`true` 或 proxy 層數）時從 `X-Forwarded-For` 右邊數起，跳過自己的 proxy 加上去的項目；更左邊的值是 client 自己送的，不採用。

---

## 8. Storage（SQLite-first）

```sql
form_versions    (id, form_id, version, schema JSON, created_at)            UNIQUE(form_id, version)
submissions      (id, form_id, number, form_version_id, data JSON, visitor_hash,
                  unique_key, created_at, updated_at, locale)                UNIQUE(form_id, unique_key)
submission_files (id, submission_id, field_name, storage_key, filename,
                  mime_type, size, created_at)                               -- File Upload 階段才啟用
rate_limits      (key_hash, window_start, count, expires_at)                 PRIMARY KEY(key_hash, window_start)
form_overrides   (form_id, data JSON, updated_at)                            PRIMARY KEY(form_id)
form_counters    (form_id, last_number)                                      PRIMARY KEY(form_id)
revoked_sessions (id, expires_at)                                            PRIMARY KEY(id)  -- 登出的 Studio session
meta             (key, value)                                                -- schema_version 等
```

- Migration 依序執行，`meta.schema_version` 記錄已套用到哪一個：① 初始的 4 張表 ② `submissions.locale`（v0.3 多語系）③ `form_overrides`（Studio 收件設定覆寫）④ `form_counters`（回覆編號計數器）⑤ `revoked_sessions`（登出即撤銷 session）。

- 預設路徑 `.open-form/open-form.db`（可用 `storage.path` 或 `OPEN_FORM_DB` 覆寫），WAL mode。
- 回覆是個資：`.open-form/` 目錄 `0700`、DB 與 `-wal`／`-shm` `0600`（DB 以 `0600` 建立，開啟時修正既有檔案），`secret` `0600`（讀取時也收緊）。
- 搜尋用 `CASE WHEN json_valid(data) THEN EXISTS(json_tree …) END`：`json_tree` 遇到走不完的 JSON 會讓整個查詢失敗，所以跳過該筆而不是 500。寫入端另限制 custom 欄位最多 10 層巢狀。
- `PRAGMA secure_delete = ON`，刪除回覆後再 `wal_checkpoint(TRUNCATE)`：Studio 的刪除是真的抹除，DB 與 WAL 檔裡都不留副本（舊版留下的殘留要 `VACUUM` 一次才會清掉）。
- dev server 的 Vite `fs.allow` 涵蓋整個專案，所以 `fs.deny`（`vite/config.ts` 的 `devServerDeny`）明確排除 `**/.open-form/**` 與自訂的 DB 路徑（含 `-wal`／`-shm`），並重列 Vite 原本的預設（自訂 `deny` 會取代預設）。否則 `/@fs/…/.open-form/open-form.db` 會繞過 Studio 登入直接回傳。
- `StorageAdapter` 是 async 介面；SQLite adapter 雖然是同步 API，介面保持 async 以容納未來的 Postgres / Turso。
- `maxResponses` 與 `uniqueBy` 在 adapter 的 transaction 內檢查，不會有 race。
- `number` 是每張表單內的流水號（Studio 的「Response #147」），刪除後不會重排，也不會重用：編號來自只增不減的 `form_counters`，與 `maxResponses`／`uniqueBy` 檢查在同一個 transaction 內遞增。不單用 `MAX(number) + 1`，因為刪掉最新一筆後下一筆會拿到同一個編號，而 webhook 接收端已經看過它；但仍取 `max(計數器 + 1, MAX(number) + 1)`，所以升級前的資料、或舊版程式繞過計數器寫入的回覆，都不會造成重複編號。
- 搜尋（`listSubmissions({ search })`，Studio 的 `?q=`）只比對答案的值（`json_tree` 的字串與數字），不比對欄位名稱；否則搜「email」會命中每一筆。
- 篩選（`listSubmissions({ filter, now })`，Studio 的 `?filter=` JSON）只在 `schema/response-filter.ts` 定義一次：`parseResponseFilter` 驗證（handler 遇到不合法的回 400），`responseFilterTest` 執行。memory adapter 直接呼叫；SQLite 把它註冊成 `open_form_filter(data, created_at)` SQL 函式，所以 `COUNT`、`LIMIT`、`OFFSET` 仍在 SQL 裡做，兩個 adapter 結果一致。送出時間的「日」以 Studio 傳來的 `timeZone`（檢視者的時區）計算。
- 排序（`listSubmissions({ sort })`，Studio 的 `?sort=` JSON）同樣做法：`schema/response-sort.ts` 把答案轉成排序鍵（`responseSortKey`：數字、轉小寫的文字，或選項在 Studio 傳來的 `values` 中的位置，讓選項依表單順序排）並定義順序（`compareResponseSortKeys`：與 SQLite 相同——數字在文字前、空答案不論升降冪都排最後）。SQLite 把排序鍵註冊成 `open_form_sort_key(data)`，在子查詢裡排序，所以分頁仍在 SQL 完成；同值以 `number DESC` 決定先後。

**部署注意**：SQLite 適合有 persistent volume 的環境（VPS、Docker、Railway + Volume、Fly.io + Volume）。Serverless（Vercel 類）不適合本機 SQLite，需等 remote adapter。

---

## 9. Dev / Build / Start

| 指令 | 做什麼 |
| --- | --- |
| `open-form dev` | Vite dev server（root 指向套件內的 `src/app`）。`/api/*` 掛 fetch handler；表單 module 由 `ssrLoadModule` 載入，存檔即熱更新（client HMR + server schema 同步）。`open-form.config.ts` 決定 plugin、handler 與 server 選項，所以存檔時會以重新載入的 config 在同一個 port 起一個新的 Vite server（config 有錯就保留舊的繼續跑）。不在 workspace（有 `open-form.config.ts`，或 `package.json` 依賴 `open-form`）裡就拒絕執行。 |
| `open-form build` | ① client build → `dist/client`（app、Studio 與每張表單，各自帶著自己的主題；`themes/` 裡的參考主題只為 Studio 的唯讀主題頁帶上，每個一個延遲載入的 chunk，SSR 載入失敗的會被排除並警告）② SSR build → `dist/server/entry.js`（打包所有 forms、config 與 collector；表單的主題隨 import 一起進來但不含 CSS，collect 也不會渲染它）。server entry 把 `process.env.NODE_ENV` 定義為 `production`（`--watch` 時為 `development`），因為 `start` 不會設定它。`--out-dir` 只會清空預設 `dist/`，或先前 build 留下 `.open-form-build` 的資料夾裡的 `client/`、`server/`。 |
| `open-form build --server-only [--watch]` | 只產生 `dist/server/entry.js`（單一檔案），給 `@open-form-build/core/next` 使用。 |
| `open-form start` | Node http server：靜態檔 + SPA fallback + `/api/*`。讀 `PORT`、`OPEN_FORM_DB`、`OPEN_FORM_ADMIN_PASSWORD`、`OPEN_FORM_SECRET`、`OPEN_FORM_TRUST_PROXY`（`true`、`false` 或 proxy 層數；其他值會讓啟動失敗）、`OPEN_FORM_SECURE_COOKIES`（有 trust proxy 時 cookie 預設標 `Secure`，`0` 關閉）、`OPEN_FORM_WEBHOOK_SECRET`。 |
| `open-form check [id]` | 像 server 一樣載入表單，印出 schema 或錯誤；同時檢查翻譯缺漏與時區，表單從 `themes/` 或別張表單 import 時會警告。 |
| `open-form create <id> [--theme]` / `list` / `responses export <id>` | 從 starter 建表單，並附自己的 `theme/index.ts`（`--theme` 時從主題的 token 開始）／列出表單與回覆數／匯出 CSV、Excel、JSON。 |
| `open-form theme list` / `check <id> [--form]` / `add <starter> [--as]` / `font <id> <family> [--form]` | 列出專案主題與範本／檢查對比度／從範本複製進 `themes/`／把 Google Fonts 字體下載進主題（`--form`：表單自己的外觀）。 |
| `open-form comments [id]` | 列出 Studio 留下的 `@form-comment` 標記（見 §11）。 |

App 路由：

```text
/                         → /studio（dev 或已設定管理密碼）
/f/:formId                → 公開表單
/studio                   → Forms 列表（即時縮圖：/f/:id?thumb=1，不回報 current.json）
/studio/:formId           → Preview（desktop / tablet / mobile）
/studio/:formId/responses → Responses 表格、詳細、刪除、Excel / CSV / JSON 匯出
/studio/:formId/responses/:responseId → 同上，直接開啟某筆回覆
/studio/:formId/schema    → 依步驟列出欄位的表格：資料 key、類型、驗證、條件（唯讀，由 collector 推導）
/studio/:formId/settings  → 收件時間與上限（可編輯），其餘 policy 概覽（唯讀，設定在 code 裡）
/studio/themes            → 主題展示頁：參考主題（唯讀，dev 與 production 都有）
/studio/themes/:themeId   → 主題頁：預覽 + token + 附目錄的 THEME.md +「用在表單上」／「修改這個主題」指令
/theme-preview/:themeId   → 範例報名表單，依 ?lang= 顯示 Studio 語言（縮圖與主題頁 iframe 用）
```

Studio 的版面沿用 open-slide：左側 sidebar（Forms／Themes 與數量、所有表單的快速切換、版本），右側是內嵌的內容面板；`lg` 以下改為頂部列 + 抽屜。Forms 與 Themes 頁都是 16:10 的即時縮圖網格（以 1200px 寬渲染再縮放的 iframe，不可互動）。

### 收件時間：程式碼為預設，Studio 可調整

開放／截止時間、回覆上限、暫停收件（`submissions.opensAt`／`closesAt`／`maxResponses`／`closed`），以及解讀這些日期的 `timeZone`，是上線後最常改的設定，而且常由主辦人而非工程師改，所以 Studio 可以直接編輯：

- **`open-form dev`**：`PUT /api/studio/forms/:id/schedule`（dev middleware）把變更寫回 `forms/<id>/index.tsx` 的 `config.submissions` 與 `config.timeZone`（`src/editing/form-config.ts`，與主題 token 共用 `source-object.ts` 的 AST 編輯）。程式碼仍是唯一來源，隨部署帶上線。
- **production**：`PUT /api/forms/:id/overrides`（admin、same-origin）存進 `StorageAdapter.setFormOverrides`（SQLite `form_overrides`），立即生效、不需重新部署；`DELETE` 改回程式碼設定。
- 只存與程式碼不同的 key（`scheduleEdit`：日期以新時區下的時間點比較，`timeZone` 與程式碼的時區不同才存），所以之後部署的程式碼變更在沒被覆寫的欄位仍會生效。`null` 表示清除程式碼的值。
- handler 在所有讀 policy 的地方（狀態、送出、`maxResponses`、Studio 列表與設定、xlsx 匯出的時區）都先 `applyOverrides` 並用覆寫的 `timeZone`；client 與 server 共用 `src/schema/schedule.ts` 的驗證與合併。
- 這是「form 的設定只來自 collector 與 `config`」唯一的例外，範圍刻意只限上述四個收件 key 加 `timeZone`；`uniqueBy` 等收到一半改了會讓既有資料不一致的設定，仍只能改程式碼。
- 本機的 dev 與 `open-form start` 共用 `.open-form/open-form.db`，所以 dev Studio 也會顯示覆寫；在 dev 儲存會寫進程式碼並清掉覆寫，避免覆寫遮住剛寫入的值。

### Studio 資料夾、搜尋與偏好設定（v0.2.1）

- **資料夾**存在 `forms/.folders.json`：`{ folders: [{ id: 'f-xxxxxxxx', name, icon: { type: 'emoji' | 'color', value } }], assignments: { formId: folderId } }`。陣列順序即 sidebar 順序；沒有 assignment 的表單屬於虛擬的「未分類」。資料夾只是整理層，表單仍是平的 `forms/<id>/`，id、URL、回覆都不變。
- dev 端點 `/api/studio/folders`（GET／POST、`PUT assign`、`PUT reorder`、`PATCH`／`DELETE :id`）由 `src/editing/folders.ts` 的純函式產生新 manifest 再整檔寫回，寫入串行化；沿用 same-origin + JSON body 防護。讀檔容錯（壞掉或手改的檔案只保留有效部分）。
- 檔案變更（含 agent 手改）透過 `open-form:folders-changed` 即時同步；`open-form build` 時快照進 server entry（`folders`），由 admin 路由 `GET /api/studio/folders` 只給已登入的 Studio（不進任何 client chunk），production Studio 唯讀。
- 排序資料：`StorageAdapter.latestByForm?()`（最新回覆時間）、`FormRegistry.updatedAt?()`（表單檔 mtime；build 時快照）。兩者皆為選用，自訂 adapter 不需實作。
- **偏好設定**（外觀、介面語言、排序）存在瀏覽器 localStorage；外觀在 `index.html` 的 inline script 於首屏前套用（Tailwind `dark:` 改為依 `html[data-studio-scheme]`）。
- **介面語言**：`studio/messages.ts` 四語字典（型別強制每個語言都完整、測試檢查 placeholder 一致），`useT()` 取字、`t.n()` 處理複數。與表單的 `locale` 無關：後者是填寫者看到的語言。

### 預覽檢視模式（v0.3 Step 3）

Studio 透過 postMessage 對預覽 iframe 下指令（`open-form:preview-command`：`{ type: 'goto', step, quiet? }` 或 `{ type: 'done' }`），預覽頁轉成 `runtime.previewControl` 交給 runtime；runtime 以 `open-form:preview-nav` 回報目前步驟與是否在完成頁。兩端共用 `app/lib/preview-channel.ts`。主題頁的切頁用 `quiet`（不顯示 inspecting 橫幅，避免干擾對主題的判斷），`done` 直接顯示完成頁、不送出。收到跳頁後 runtime 進入 inspecting：所有頁視為可見、`<When>` 透過 `InspectContext` 顯示隱藏內容並標註條件、導覽不驗證、送出改為提示訊息。只有 `preview` 模式會建立 previewControl，正式表單無法進入。

### Studio 設計面板（v0.2 Step 5）

```text
Studio 設計面板 ──postMessage(open-form:theme-draft)──▶ 預覽 iframe（/f/:id?preview=1）
      │                                                  └─ 以草稿 token 取代表單主題的 token，元件與 CSS 不變
      └─ Save ─▶ PUT /api/studio/forms/:id/theme { patch } ─▶ src/editing/theme-tokens.ts（Babel AST）
                                                              └─ 寫檔 → Vite watcher → 預覽重新載入主題
```

面板（`DesignPanel`）編輯表單自己的外觀；`themes/` 裡的參考主題在 Studio 是唯讀的（見下方「主題頁」）。伺服器端是 `src/vite/theme-design.ts` 裡一組以主題檔路徑為單位的 helper（`themeDesign`、`saveThemeTokens`、`addThemeFont`），掛在 `studio-forms.ts`：

- **表單自己的外觀**：表單的 Preview 分頁在「預覽」「編輯」旁多了第三個模式「調整」（`app/studio/form-design.tsx` 的 `FormDesign`）。`GET /api/studio/forms/:id/theme` 回傳 `forms/<id>/theme/index.ts(x)` 的 token、字型與對比，沒有時回 `{ missing: true, file }`；`PUT` 存 patch；`POST …/theme/fonts` 把 Google 字型下載進 `theme/fonts/`；`POST …/theme` 寫出空的 `theme/index.ts` 並接進 `index.tsx`（`src/editing/form-theme.ts` 的 `wireFormTheme()`：import 放在表單 CSS 之前，並在唯一的 `<Form>` 加上 `theme={theme}`）。草稿走 `form:<id>` 頻道（`formDraftKey`）送進表單的預覽 iframe；公開頁把它當成 `runtime.themeDraft`，`<Form>` 只在預覽時用它取代自己主題的 token，元件保留。Studio 送出的草稿會強制成正在編輯的色盤（`forceScheme`），所以在淺色系統上也看得到深色色盤。

- **只有 token 可編輯**（`schema/theme-patch.ts` 定義 key、`diffTokens()` 算出 patch，前後端共用）。元件、CSS、`THEME.md` 仍由人或 agent 手寫。
- **寫回策略**：每個 edit 都重新 parse，只替換值的字元範圍；新增屬性沿用既有縮排與引號；`null` 移除屬性；`dark: false` ↔ 物件可互轉。遇到計算出來的值（`colors: palette`）直接拒絕並請使用者手改，不去猜。
- **安全性**：`/api/studio/forms/:id/theme` 是 dev server middleware（不在 production handler 裡），沿用 Studio 的 loopback／管理密碼授權，寫入需 same-origin + JSON body；patch 白名單驗證（已知 key、單行字串、無反引號）。
- **參考主題在 Studio 之外修改**：主題都在專案的 `themes/` 裡，修改參考主題就是改它的檔案，由人或 agent 動手（主題頁會給一段可以複製的指令）。沒有表單 import 它，只有之後從它建立的表單會看到變更。
- **主題字型（Google Fonts）**：字體下拉多了「從 Google Fonts 加入…」，CLI 對應 `open-form theme font <id> <family>`（`--form` 加到表單自己的外觀），兩者共用 `src/editing/google-fonts.ts` + `theme-fonts.ts`。做法跟 open-slide 一樣是**下載進專案**，但不照它抓單一 TTF：
  - 目錄來自 `fonts.google.com/metadata/fonts`（免 API key，dev server 快取一小時）；`GET /api/studio/fonts?q=&category=&cjk=1` 搜尋（`studio-fonts.ts`），`POST /api/studio/forms/:id/theme/fonts { family }` 下載。
  - 用瀏覽器 UA 向 `css2` 要 woff2：可變字體要整條 `wght` 軸（檔案一樣大），靜態字體只要 400–700；保留 Google 的 `unicode-range` 分片，只接受 `fonts.gstatic.com` 的網址。
  - 寫到主題入口旁的 `fonts/<slug>/`，產生 `fonts/<slug>.css`（標頭記下 family 與 `font` 堆疊，Studio 靠它列出主題的字體），在主題檔加 `import './fonts/<slug>.css'`。build 時由 Vite 打包成資產，**填答者完全不會連到 Google**（直接連 Google Fonts 會把填答者 IP 送給 Google，德國法院 2022 年判過違反 GDPR）。
  - 中日韓字體約 100 個分片、數 MB（例：Noto Sans TC 400–700 約 4 MB），但瀏覽器只下載頁面用到的字；介面上標示「數 MB」並在加入後顯示實際大小。
  - Studio 自己的搜尋預覽直接載入 Google 的 `css2?text=`（作者的瀏覽器，不是填答者）；「調整」面板以 `/@fs/` 載入表單的字體 CSS；主題頁則把預覽 iframe 回報的字體以私有名稱註冊（見「主題頁」）。
- **主題頁**（v0.2.1，v0.4 對齊 open-slide）：先看懂，要改就交給 agent。跟 open-slide 一樣，主題頁是唯讀的，而且每次 build 都會帶上：Studio 從 `virtual:open-form/themes` 讀主題清單（不經 API），dev 下改了 THEME.md 會隨 `open-form:theme-changed` 事件（`info`）送到，頁面就地更新。列表放專案的參考主題：縮圖、名稱、一行描述，沒有 THEME.md 時標出來，上方註明每張表單的外觀都是自己的；沒有主題時是空狀態，引導執行 `/create-theme` 或 `open-form theme add <starter>`。詳細頁從不把參考主題 import 進 Studio 的 document：由預覽 iframe 載入它，再 post `open-form:theme-loaded`（`app/lib/theme-preview.ts`），內容是 `pickTokens()` 的結果和字體堆疊指名的 `@font-face` 規則（網址轉成絕對路徑），或載入失敗的原因。Studio 所有內容都從這裡推導：標頭（代表色、檔案、配色、版面）；一列工具列控制的大預覽（配色、裝置、步驟）；**Token**，也就是 `create --theme` 會複製的部分（每種配色的 `effectivePalettes()` 色票、一行對比結論、點開 dialog 看每一組、字體樣本、用主題自己顏色畫的形狀樣本）；以及 THEME.md（原樣呈現，色碼旁附色塊，附 `##` 段落目錄），旁邊是「用在表單上」卡片（`open-form create <form> --theme <id>` 與複製給 agent 的指令）和把描述轉成指令的「修改這個主題」卡片。Studio 只在頁面開著時把回報的字體以私有名稱（`of-specimen-<id>-<family>`）加進 `document.fonts`，離開就刪掉，所以參考主題的 CSS 和 Studio 自己也用的字體（"Noto Sans TC"）都不會進到 Studio 的 document。載入失敗的參考主題會在頁面和 iframe 裡顯示錯誤，而不是看起來像內建外觀。沒有「被哪些表單使用」：沒有表單依賴參考主題。「新增主題」產生複製給 agent 的指令，並顯示 `open-form theme add <starter>`；補寫 THEME.md 也是複製給 agent 的指令。

---

## 10. Agent integration

延續 open-slide 的做法：

- **Skills** 放在套件的 `skills/`，`init` 時複製到 workspace 的 `.agents/skills/`，`.claude/skills/*` 是 symlink；`dev` 啟動時自動同步（內建 skill 一律覆寫，所以不要原地修改），執行期間也會監看套件的 `skills/`（從原始碼連結 open-form 時改了就即時同步）；`open-form sync:skills` 是不啟動 dev 的手動同步。兩者在 workspace 之外都拒絕執行，因為那裡的 `.claude/skills/` 可能是整個使用者共用的資料夾。`OPEN_FORM_SKIP_SKILLS_SYNC=1` 關閉。
  - `create-form`：從需求到完整表單的 workflow（釐清問題 → **先決定美感方向**：讀各主題的 `THEME.md`，依表單與對象提出 3 個方向 → 選 id → 從選定主題的 token 建立表單（`create --theme`）→ 依方向規劃結構與文案 → 寫檔，並只從參考主題拿表單用得到的部分寫出它自己的外觀 → 自我檢查）。
  - `create-theme`：從 repo 既有設計系統（Tailwind、CSS 變數、shadcn、字體）、圖片或描述產生參考主題 `themes/<id>/`（token、元件、CSS、`THEME.md`），從最接近的範本 `theme add --as` 起步，並檢查對比度。
  - `form-authoring`：技術參考（file contract、元件、條件、驗證、policy、主題、外觀元件、版面、反模式）。
  - `current-form`：讀 `node_modules/.open-form/current.json`（Studio 經 `POST /api/studio/current` 回報，走 Studio 的 gate；內容會進 agent 的 context，所以不開放未授權寫入），知道使用者「現在在看哪張表單、哪一步」、在 Studio 選取了哪個元素（`selection`）、表單自己的主題（`formThemePath`），或正在看哪個參考主題（`themeId`／`themePath`）。
  - `apply-comments`：以 `open-form comments` 找出 Studio 留下的 `@form-comment` 標記，逐一套用並刪除標記，最後跑 `open-form check`；不清楚的保留並詢問（見 §11）。
- **AGENTS.md**（CLAUDE.md symlink）只放 hard rules，細節都在 skills。

---

## 11. 編輯模式與留言（v0.4，僅 dev）

```text
forms/**/*.tsx ──▶ vite/loc-plugin.ts（enforce: pre，只在 serve）
                     每個 JSX 開頭標籤插入 data-of-loc="forms/<id>/index.tsx:行:欄"
                     （只在標籤內插字，行號不變；Fragment 略過；
                      略過 forms/<id>/theme/：它畫出每個欄位，標上去會選到主題）
                          │
     ┌────────────────────┼─────────────────────────────┐
     ▼                    ▼                             ▼
 使用者的 DOM 元素     內建欄位：useField 把它放進       <Form>／<Page>／<Row>／<Heading>：
 直接帶屬性            controlProps（所有主題與自訂欄位    form.tsx／layout.tsx 轉到
                      都必須 spread）→ 落在原生控制項上    .of-root／.of-step／對應元素
```

- **版面**：Preview 分頁仿 open-slide 的編輯頁：一列工具列（裝置、語言｜預覽／編輯、重新載入）；工具列放在預覽那一欄，左緣與畫布對齊；左側步驟列（各步驟標題、題數、條件，最後是「完成頁」；編輯時一律縮成編號，hover 或鍵盤 focus 時在旁邊浮出該步的標題、題數、顯示條件與題目清單）的標題列與工具列同高，第一個步驟與畫布頂端對齊；右側是編輯面板。欄寬用 container query 依內容區寬度決定，不看視窗，因為 Studio 側欄會吃掉一部分寬度；太窄時步驟列改回預覽上方的橫向晶片，面板排到下方。
- **模式**：工具列的「預覽／編輯」切換（沿用 open-slide 的 Preview／Edit）。編輯模式在右側固定一個面板（`studio/edit-panel.tsx`，`lg` 以下排在預覽下方），並以 `open-form:inspect`（附上 `GET /api/studio/source?form=<id>` 取得的「loc → 元件名、欄位 name」對照）開啟 iframe 內的 `app/public/inspector.ts`。切回預覽、關閉面板或在沒有選取時按 Esc 都會離開編輯模式，iframe 的外框與 Studio 的選取一起清掉；有選取時 Esc 只取消選取。
- **選取**：capture 階段吞掉點擊（欄位不 focus、按鈕不換頁），hover 虛線外框＋名稱標籤，點擊後實線外框並回報 `open-form:inspect-pick`。先找「擁有者」：往上找第一個自己帶 `data-of-loc`、或 label 對應的控制項帶、或子孫只有唯一一個位置的元素，外框再往外擴到「仍只屬於這個位置」的最大祖先。欄位整個選（label、說明、控制項一起編輯）；其他擁有者裡由 runtime 或主題畫出來的東西（標題、說明、進度、按鈕、主題裝飾）可以單獨選成「部分」：取點擊處所在的整段文字（只含 inline 元素的最外層），沒有文字就取該元素本身；包住其他已標記元素的外層不算部分。部分以「原文文字」（iframe 依 `config.translations` 反查目前語言）或「在擁有者底下的子元素位置」描述，所以表單重新渲染（改原始碼、換頁）後 iframe 能用 MutationObserver 重新找到它。麵包屑與「選取上層」由 Studio 送 `open-form:inspect-select` 決定外框。選取綁定在建立它的表單上；頁面穩定後 iframe 仍找不到要求的選取時，回報 `open-form:inspect-missing`，Studio 就清掉它。iframe 開始監聽後送 `open-form:inspect-ready`，所以預覽重新載入後 inspector 會重新啟動。
- **直接改文字**：`POST /api/studio/source/slots { loc, text?, locale? }`（`vite/studio-source.ts` → `editing/text-slots.ts`）回傳該選取的「文字槽」：部分以文字比對（先限該元素範圍，再整個檔案，例如 `<Form>` 的標題在 `config`），元素則列出自己的 `label`／`description`／`title`／`placeholder`… 與子文字（`<Form>` 加上 config 的標題、說明）。同時當作值的字串（`options={['Student']}`、`equals="Student"`）不列入，改了會變資料。`PUT /api/studio/source/text { at, from, to }` 以 `from` 檢查來源沒變過、照位置原地改寫（JSX 屬性必要時換引號或改成 `{'…'}`），並把各語系翻譯表（`import x from './locales/<l>.json'` 或 inline 物件）中同一個 key 一起改名；舊文字仍有其他地方在用時改成複製。帶 `locale` 則只改該語系的翻譯值。改完 HMR 會讓表單重新掛載，預覽頁記住目前步驟並以 `goto` 回到原步驟，不會跳回第一頁。
- **給 agent**：Studio 把選取寫進 `current.json` 的 `selection`（`file`／`line`／`column`／欄位 `name`／部分的顯示文字），`current-form` skill 用它解析「把這個改成必填」。面板顯示 `file:line` 與「複製位置」（含欄位與文字，可直接貼給 agent）。
- **留言**：`POST /api/studio/comments { loc, text }`（`vite/studio-comments.ts`，Studio 授權 + same-origin，路徑限制在 `forms/` 內）用 Babel 找到該位置的 JSXElement（或 `config` 裡的屬性，例如標題），在它上面插一行 `{/* @form-comment: … */}`（JSX 子節點）或 `/* @form-comment: … */`（表達式位置），文字壓成單行並中和 `*/`。選的是部分時，留言放在它文字所在的元素或屬性上；找不到唯一來源就放在擁有者上並以 `(on “…”)` 註明是哪個部分。插入一整行時回傳 `shifted`，Studio 把選取的行號一起往下移。同一個端點的 `GET ?form=<id>` 列出該表單的標記、`DELETE { file, line }` 刪除一則。`open-form comments [id]` 列出所有標記；`apply-comments` skill 逐一套用並刪除標記。留言就在原始碼裡，跟 git、PR、agent 的工作方式一致，不需要另外的資料庫。

---

## 12. 不做什麼

Typeform / Google Forms clone、drag-and-drop builder、CRM、marketing automation、database SaaS、auth provider、workflow platform。**不做 sidebar → canvas 拖拉欄位**——那會讓 agent-first 的設計消失。

