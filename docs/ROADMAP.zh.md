# Open Form — Roadmap

[English](./ROADMAP.md) · 繁體中文

> 目標：v0.1 做到完整閉環 **Create → Preview → Submit → Store → Responses**，
> 並用「Developer Meetup Registration」demo 證明：agent 只寫了 questions + logic，就得到一整套 form application。

架構細節見 [ARCHITECTURE.zh.md](./ARCHITECTURE.zh.md)。狀態：✅ 完成　🚧 進行中　⬜ 未開始

---

## v0.1 — MVP

### Phase 0 — Monorepo foundation ✅

- ✅ pnpm workspace + Turborepo + Biome + Vitest + Changesets
- ✅ `packages/core`（framework）與 `apps/demo`（dogfood workspace）骨架
- ✅ 分層 import 規則（Biome `noRestrictedImports`）
- ✅ AGENTS.md / CLAUDE.md、README、CI workflow
- ✅ ARCHITECTURE.md、ROADMAP.md

### Phase 1 — Schema layer（`@open-form-build/core/schema`）✅

- ✅ `FormSchema` / `FieldSchema` / `Condition` 型別
- ✅ `evaluateCondition()`：equals、notEquals、in、notIn、filled、empty、contains、gt/gte/lt/lte、all/any/not
- ✅ `validateField()`：required、min/maxLength、pattern、email、url、number range / integer、options membership、date range、checkbox group 數量
- ✅ `coerceValue()` 與 `resolveVisibleFields()`（fixed-point 剔除隱藏欄位）
- ✅ `defineForm()` / `defineConfig()` / `defineTheme()`、duration 解析（`'2s'`、`'10m'`）
- ✅ Standard Schema 介面（custom validator）
- ✅ `schemaVersion()`：穩定 JSON hash
- ✅ i18n 訊息（en、zh-TW）

### Phase 2 — React runtime + DSL（`@open-form-build/core`）✅

- ✅ External store + `useField()`（自訂欄位元件也能用）
- ✅ `<Form>`、`<Page>`、`<When>`、`<Row>`、`<Heading>`、`<Paragraph>`、`<Submit>`、`<Success>`
- ✅ Fields：`Text`、`Email`、`Url`、`Tel`、`NumberInput`、`Textarea`、`Select`、`RadioGroup`、`Checkbox`、`CheckboxGroup`、`DateInput`、`Rating`
- ✅ Multi-step：progress、Back/Next、條件步驟、驗證後才前進、focus 管理、Enter 前進
- ✅ Submission：loading / success / error / closed / full、server field errors 導回對應 step
- ✅ Honeypot、timing token
- ✅ Responsive CSS、CSS variables theme、dark mode、a11y（label、aria-invalid、aria-describedby、fieldset/legend）
- ✅ Collector：render-to-collect 產生 `FormSchema`
- ✅ `useFormValues()` / `useFieldValue()`、`<Form aside>` 側欄、theme `colorScheme`（強制深色／淺色）

### Phase 3 — Server + Storage ✅

- ✅ Web-standard fetch handler + router
- ✅ Submission pipeline：window、honeypot、timing、rate limit、sanitize、validate、unique、max
- ✅ `StorageAdapter` 介面 + in-memory adapter
- ✅ SQLite adapter（`node:sqlite`、WAL、migrations、form_versions / submissions / rate_limits / meta）
- ✅ Admin API：list / get / delete / export（CSV、JSON）
- ✅ Device cookie（`once-per-device`）
- ✅ Node http adapter

### Phase 4 — Framework runtime（dev / build / start）✅

- ✅ Vite config 隱藏在套件內（root = `src/app`）
- ✅ Forms 探索 + virtual modules（client：lazy load；server：SSR entry）
- ✅ Dev：`/api` middleware、`ssrLoadModule`、HMR、schema 熱同步
- ✅ 公開表單頁 `/f/:formId`
- ✅ Build：client + SSR 兩段式
- ✅ `open-form start`：靜態檔 + API + 保護 Studio（v0.3 起改為登入畫面 + session）

### Phase 5 — Studio ✅

- ✅ Forms 列表（title、欄位數、responses 數、狀態）
- ✅ Preview（desktop / tablet / mobile iframe）
- ✅ Responses：表格、分頁、搜尋、詳細頁、刪除
- ✅ Export CSV / JSON
- ✅ Settings：policy、protection、schema 概覽（唯讀）

### Phase 6 — CLI、Template、Agent skills ✅

- ✅ `open-form init | dev | build | start | list | create | responses export | sync:skills`
- ✅ Workspace template（AGENTS.md、tsconfig、.gitignore、範例表單）
- ✅ Skills：`create-form`、`form-authoring`、`current-form`（+ `current.json`）
- ✅ Demo：Developer Meetup Registration、Feedback、Contact

### Phase 7 — Hardening ✅

- ✅ 單元測試（schema、server pipeline、sqlite、collector、CSV）
- ✅ E2E smoke：scaffold → dev → submit → responses → export
- ✅ README（Before / After）

---

## v0.2 — Design system：像 open-slide 一樣可客製

> 原則：**Runtime 管行為與無障礙，agent 管外觀與版面。**
> 目前只有兩個極端——換顏色（token），或整個自己寫（`useField`）。v0.2 補上中間層，
> 讓「幫我做一張報名表」每次都從設計開始思考，而不是套同一個樣子。

### Step 1 — 欄位拆成「行為 + 外觀」，外觀可整組替換 ✅

- ✅ 定義外觀元件契約（`Field`、`TextInput`、`Textarea`、`Select`、`ChoiceGroup`、`Checkbox`、`Rating`）與型別
- ✅ 內建欄位改為：行為（`useField`）＋ 外觀元件；現有樣子變成 `defaultComponents`
- ✅ 替換來源：主題 `defineTheme({ components })`、表單 `<Form components>`，依序覆蓋預設
- ✅ 主題支援 `.tsx` 與資料夾（`themes/<id>/index.tsx`），按需載入
- ✅ `FieldShell` 跟著主題走：自訂欄位自動套用主題外框
- ✅ 測試、文件（form-authoring skill、ARCHITECTURE）、demo 主題驗證

### Step 2 — 版面插槽 ✅

- ✅ `Layout` 元件接收 `header`、`progress`、`content`、`alert`、`actions`、`aside` 等區塊（目前步驟仍由 framework 渲染）
- ✅ `useFormNav()`：目前步驟、步驟清單、`next()`／`back()`／`goTo()`、送出中；`useFormMessages()`
- ✅ 可替換 `Header`、`Progress`、`Nav`、`Button`、`Success`、`Notice`
- ✅ 內建版面：`FocusLayout`（一次一題）、`SplitLayout`（左右分割）、`StepperLayout`（側邊步驟）

### Step 3 — 內建主題 + eject ✅

- ✅ 5 套差異很大的內建主題：`classic`、`editorial`、`terminal`、`brutalist`、`conversational`（含元件、版面、CSS）
- ✅ `open-form theme list`／`theme eject <id> [--as name]`：複製進 `themes/` 並改寫 selector，由專案擁有（shadcn 模式）；本地主題優先於內建
- ✅ 每個主題附 `THEME.md` 描述視覺語言

### Step 4 — Agent 端 ✅

- ✅ `create-form`：開工前讀各主題 `THEME.md`，依表單主題與對象提出 3 個美感方向（主題 + 版面 + 具體視覺）；方向需符合表單長度
- ✅ `create-theme` skill：從 repo 設計系統（Tailwind、CSS 變數、shadcn 對照表、字體）、圖片或描述產生 `themes/<id>/`；品牌色與對比衝突時保留色相、調整亮度並告知使用者
- ✅ form-authoring：主題、外觀元件、版面、token 完整說明
- ✅ 以兩個獨立 agent 實測 skill（create-form／create-theme），依回報修正 skill、API 與工具：
  - `open-form check [id]`：不開 server 也能看表單衍生的 schema、policy，或精確錯誤
  - `open-form theme check <id>`：主題在淺色／深色下的 WCAG 對比（支援 hex／rgb／hsl／oklch）
  - 設定驗證：`uniqueBy` 指向不存在的欄位、無法解析的日期／時間會直接報錯
  - 新 token：`control`（控制項外框，預設 ≥ 3:1）、`buttonRadius`；選項／評分的 focus 改為實心外框
  - 移除隱含的 `default` 主題；`theme list` 標示專案預設；eject 一併改名 `THEME.md`

### Step 5 — Studio ✅

- ✅ 主題展示頁 `/studio/themes`（同 open-slide `/themes`）：每個主題的即時縮圖、來源（內建／本地／覆蓋內建）、專案預設、使用中的表單數
- ✅ 主題詳細頁：以範例表單（含所有元件）或任一真實表單預覽；淺色／深色／自動、桌面／手機切換；`THEME.md` 指南分頁
- ✅ 設計面板：顏色（淺色／深色 palette）、字體、圓角、寬度、間距、外框即時預覽（postMessage 草稿，不寫檔）；即時 WCAG 對比檢查
- ✅ 寫回原始碼：Babel AST 定位 `defineTheme({...})`，只改動到的值（保留註解、格式、引號、元件）；內建主題需先 eject（未存的修改會一起帶進副本）
- ✅ 主題檔案熱更新（`open-form:theme-changed`）；`current.json` 回報正在編輯的主題（`themeId`／`themePath`）
- ✅ 主題頁只在 `open-form dev` 出現，production 不載入該 chunk
- ✅ Studio 改為 open-slide 式側邊欄（Forms／Themes、表單快速切換、手機抽屜）；Forms 頁改為即時縮圖網格
- ✅ `FocusLayout` 歡迎頁（title／description 獨立一頁 + 開始按鈕）、`1 / 4` 計數、下一步與 Enter 提示同列；`conversational` 主題重新設計

## v0.2.1 — Studio 體驗（對齊 open-slide）✅

- ✅ 亮色／暗色／跟隨系統切換（sidebar 底部、⌘K），首屏前套用、不閃爍；公開表單仍跟隨填寫者系統
- ✅ ⌘K／Ctrl K 指令面板：表單、回覆（輸入後才顯示）、資料夾、主題、外觀、語言；模糊比對、鍵盤操作
- ✅ Forms 頁右上搜尋（標題／id／描述）與排序（最近編輯、最新回覆、回覆最多、名稱），排序記在瀏覽器
- ✅ 資料夾：`forms/.folders.json`（隨 repo 提交、團隊共用），表單 id／URL／回覆不受影響；新增、改名、換圖示（顏色／emoji）、刪除、拖曳排序；「未分類」為虛擬資料夾；production Studio 唯讀
- ✅ 拖曳表單到 sidebar 資料夾（原生 HTML5 DnD，拖曳中提示可放置目標）；卡片上也有「移到資料夾」選單（觸控裝置可用）
- ✅ Studio 介面語言：English／繁體中文／简体中文／日本語（約 240 條字串），預設依瀏覽器語言，⌘K 也可切換
- ✅ 不新增套件：指令面板、toast、popover、圖示選擇器皆自製（open-slide 用 cmdk／sonner／next-themes／emoji-picker-react）
- ✅ 下拉選單統一：Studio 全面改用自製 `Dropdown`（分組、鍵盤操作），表單的語言選單也改為主題化的 listbox；表單的 `Select` 欄位刻意保留原生（手機系統選擇器、自動填入、螢幕閱讀器）
- ✅ 捲軸：表單頁依主題顏色設定細捲軸與頁面背景（深色主題在淺色系統下也正確），Studio 改為細捲軸
- ✅ 主題頁改為 agent 優先（同 open-slide）：「描述你想要的調整」→ 複製給 agent 的指令（含檔案路徑、THEME.md、對比檢查、內建主題先 eject）；面板只留主色、背景、字體、圓角、配色等快速調整，其餘收進「所有 token」
- ✅ 主題頁重設計：列表只標例外（專案預設／本地），縮圖改用像真的範例報名表單（依 Studio 語言）；「新增主題」也是複製給 agent 的指令；詳細頁 = 大預覽（第 N 步／完成頁直接切換）+ THEME.md + 實際 token 規格（色票與對比、字體樣本、形狀）+ 使用中的表單；編輯收進「調整」抽屜，內建主題的 eject 改稱「存成本地主題」
- ✅ 新 logo（步驟軌加打勾，黑底銀色）與 favicon；Studio 強調色改為黑白灰，不再使用品牌色

## v0.3 — Integrations ✅

### Step 1 — 多語系 ✅

- ✅ `locale`: `'en' | 'zh-TW' | 'zh-CN' | 'ja'`（按鈕、驗證訊息、狀態頁、Enter 提示）；簡中採大陸慣用語（您、提交、邮箱），日文用です・ます體
- ✅ 日期依語系格式化（驗證訊息的 min／max 日期、開放時間）：`2026年12月6日`、`December 6, 2026`
- ✅ 表單根元素與頁面設定 `lang`；CJK 字型改為 `var(--of-cjk)`／`var(--of-cjk-serif)`，依語系切換繁中／簡中／日文字型（同一個漢字在三地字形不同）
- ✅ 日文以詞組換行（`word-break: auto-phrase`），過長時仍可斷行
- ✅ 不支援的 `locale` 在載入時直接報錯並建議正確寫法（`'zh-Hant'` → `'zh-TW'`），表單與 `open-form.config.ts` 皆檢查
- ✅ 測試：每個語系都有全部訊息且 placeholder 一致；demo 新增日文表單 `type-workshop`

### Step 2 — 多語系表單 ✅

- ✅ 表單以一種語言撰寫（`locale`），翻譯放在 `forms/<id>/locales/<lang>.json`、以原文為 key，經 `defineForm({ translations })` 引入；缺的條目退回原文，不會壞掉
- ✅ 自動翻譯：標題、描述、完成頁、政策訊息、頁標題、label／description／placeholder／單位、選項文字、Rating 兩端文字、Checkbox 文字、Submit、Heading／Paragraph、`validate` 回傳的訊息；自訂內容用 `<T>`／`useTranslate()`
- ✅ 填寫者語言：`?lang=` → 先前的選擇 → 瀏覽器語言 → 原文；角落語言選單（`languageSwitch: false` 可關、`LanguageSwitch` 可替換）；`<html lang>` 與分頁標題跟著切換
- ✅ 送出時記錄語言（新增 `submissions.locale` 欄位），伺服器錯誤訊息用填寫者的語言；Studio 回覆詳情與 CSV `Language` 欄顯示
- ✅ `open-form check` 顯示各語言 `N/N translated` 與缺漏／多餘條目；Studio 設定頁有語言覆蓋率；有翻譯卻沒設 `locale` 會直接報錯
- ✅ Skill：`create-form` 一開始就判斷語言（必要時才問），多語系表單用明確的選項 value、最後產生 locale 檔並以 `check` 驗證；`form-authoring` 新增 Languages 章節；AGENTS.md 加入「改原文要同步每個 locale 檔」
- ✅ `tr()` 支援 placeholder（`tr('Workshops × {n}', { n })`），自訂元件的動態文字也能翻譯；`aside` 與完成頁內容也納入覆蓋率檢查
- ✅ Demo：每張表單都有中文與英文——英文表單加上繁體中文，`產品回饋`（繁中）加上 English、日本語，`タイポグラフィ勉強会`（日文）加上繁體中文與 English；含自訂欄位、即時票券與價格明細的 `conference-pass` 也全數翻譯

### Step 3 — 預覽檢視模式 ✅

- ✅ Studio 預覽上方的步驟列：直接跳到任一頁（含條件頁，虛線標示），不必逐頁填寫
- ✅ 跳頁後進入檢視模式：條件頁與 `<When>` 內容全部顯示並標出條件，Next／Back 不驗證，**最後一步不會送出**；「重新開始」回到正常填寫
- ✅ 單頁表單有條件題目時，提供「顯示條件題目」
- ✅ 多語系表單可在預覽中切換語言
- ✅ 步驟以頁標題或第一題命名（不再是「第 n 步」），條件頁標「條件」並說明何時出現
- ✅ 條件寫成白話句子、用題目與選項文字（「「Pass」是「Builder」或「Patron」時顯示」；數字比較保留 `≥` 等符號），Studio 依介面語言、預覽內的標註依表單語言，四語皆有（`explainCondition`）；CLI 仍用欄位名稱（`describeCondition`，給 agent）

### Step 4 — Security hardening ✅

> 後面的 Webhook、Next.js adapter、Embed 都會擴大對外介面，先把現有的 admin 與送出路徑補好。

- ✅ Admin API 預設關閉：`createOpenFormHandler` 沒傳 `adminAuth` 就不開 Studio endpoint（回 404）
- ✅ dev 只對「本機直接連線」放行：loopback 連線 + loopback `Host` + 沒有 proxy header；經 ngrok／cloudflared 等 tunnel 或 reverse proxy 一律要 `OPEN_FORM_ADMIN_PASSWORD`，拒絕時在終端機提示一次
- ✅ `trustProxy` 從 `X-Forwarded-For` 右邊取 client IP（`true` 或 proxy 層數），不能再偽造 IP 繞過 rate limit
- ✅ Request body 邊讀邊算上限，chunked 傳送（沒有 `content-length`）也擋得住
- ✅ 管理密碼至少 16 字元（啟動時檢查，可用幾個字組成的 passphrase）；登入嘗試每 IP 每 10 分鐘 10 次；比對 HMAC，不洩漏密碼長度
- ✅ 安全 header：Studio `frame-ancestors 'self'`、`X-Frame-Options`、`Referrer-Policy: same-origin`；`/f/:id` 預設只允許同源嵌入；API 回應加 `nosniff`
- ✅ CSV 公式跳脫涵蓋陣列值（數字以外都檢查）
- ✅ 部署文件：HTTPS、`OPEN_FORM_TRUST_PROXY` 層數、管理密碼的長度要求、換密碼即登出所有人
- ✅ 安全複查（實測）後補強：
  - dev server 的 `fs.deny` 排除 `.open-form/` 與 DB 檔（原本 `/@fs/` 可繞過登入下載整個 DB 與 secret，`--host` 時區網也拿得到）
  - `secure_delete` + 刪除後 `wal_checkpoint(TRUNCATE)`：刪除回覆後 DB 與 WAL 不留副本
  - `.open-form/` `0700`、DB 檔 `0600`（既有檔案開啟時修正）
  - production 偵測到 proxy（`X-Forwarded-For`）卻沒設 `OPEN_FORM_TRUST_PROXY` 時提示一次
  - webhook URL 必須是 `https://`（`http://` 只限 localhost）

### Step 5 — Studio 登入 ✅

> 不做帳號系統：預設是使用者自訂的單一管理密碼；多人／SSO 透過 `adminAuth.authorize` + `signInUrl` 交給 Clerk、Auth.js。

- ✅ `AdminAuth`（`password`／`authorize(request)`／`signInUrl`／`sessionMaxAge`），沒設定就沒有 admin route；`open-form start` 讀 `OPEN_FORM_ADMIN_PASSWORD`
- ✅ Studio 登入畫面取代 Basic Auth：`POST /api/studio/session` 換成以 secret 簽章的 session cookie（`HttpOnly; SameSite=Strict`，HTTPS 時 `Secure`）、預設 7 天、sidebar 登出；cookie 帶密碼指紋，換密碼即失效
- ✅ 任何 401 都回到登入畫面；dev 從別台機器連進來又沒設密碼時，說明要設 `OPEN_FORM_ADMIN_PASSWORD`
- ✅ dev 寫檔 endpoint（themes、folders）與 admin API 共用同一個 gate
- ✅ 四種 Studio 語言的登入介面文字

### Step 6 — Webhook ✅

- ✅ `webhooks: [{ url, forms? }]` 放在 `open-form.config.ts`（原本規劃的 `onSubmit.webhook` 放在表單 config，但表單 config 會打包進瀏覽器，URL 可能本身就是密鑰）
- ✅ Standard Webhooks 格式：`webhook-id`／`webhook-timestamp`／`webhook-signature`，以 `OPEN_FORM_WEBHOOK_SECRET` 簽章（`whsec_…` 可直接用官方函式庫驗證，已實測）；沒設 secret 時啟動提示
- ✅ 回應送出後才投遞；失敗重試 5 次（0、5s、30s、2m、10m），同一個 id 方便接收端去重；`410 Gone` 停止；每次 10 秒逾時
- ✅ log 只記 origin，不記 payload 或 URL path；`waitUntil` 選項給 serverless 平台
- ✅ Studio 設定頁列出該表單的 webhook（只顯示 origin）與是否簽章
- ✅ form-authoring skill：「把回覆送到 Slack／Zapier」寫進 `open-form.config.ts`，不要在表單裡 `fetch`

### Step 7 — Next.js adapter ✅

- ✅ `@open-form-build/core/next`：`createOpenFormRoute()` → `{ GET, POST, DELETE, OPTIONS }`，掛在 `app/api/[...openform]/route.ts`；預設 SQLite、`OPEN_FORM_SECRET`、`OPEN_FORM_ADMIN_PASSWORD`，皆可傳入替換
- ✅ App Router route handler 不能 render 表單，改讀 `open-form build --server-only` 的 server bundle；`--watch` 搭配 `next dev`，非 production 自動重新載入
- ✅ server bundle 改為單一檔案（拆 chunk 會在重新載入時出現兩份 React）
- ✅ `<FormHost id form config theme api />`：在任何 React app 裡 render 表單（取得 availability／timing token、送到 `<api>/forms/<id>/submissions`）
- ✅ 沒有 `adminAuth`／`OPEN_FORM_ADMIN_PASSWORD` 就沒有 admin route；client IP 從 `X-Forwarded-For` 右邊取；`waitUntil` 給 Vercel `after`
- ✅ 以 Next.js 16（Turbopack）實測：`next build`／`next start` 送出成功、`next dev` + watch 改表單即生效

### Step 8 — Embed ✅

- ✅ `embed.origins`（`open-form.config.ts`）：允許的網站清單或 `'*'`；啟動時驗證格式
- ✅ `<script src="…/embed.js">` + `<div data-open-form="id">`：iframe 隨表單高度伸縮、`data-open-form-lang`、送出後發 `open-form:submitted`、`success.redirect` 離開宿主頁；也可直接 iframe `/f/<id>?embed`
- ✅ CORS 只開公開 endpoint（表單狀態、送出、preflight），不帶 credentials，admin 永遠不開；`/f/:id` 的 `frame-ancestors` 跟著 allowlist
- ✅ 第三方 iframe 拿不到 cookie：runtime 在 localStorage 保留隨機 visitor id，`once-per-device` 照常運作
- ✅ `<FormHost api="https://forms.example.com/api">` 可跨網域使用同一套 CORS
- ✅ Studio 設定頁顯示嵌入程式碼（可複製）與允許的網站；form-authoring skill 補上嵌入做法
- ✅ 實測：跨站宿主頁嵌入、CORS、高度追蹤、送出事件與成功頁縮回；production 的 `frame-ancestors`／`embed.js`／preflight

### Step 9 — Draft persistence ✅

- ✅ `defineForm({ drafts: true })`（或 `{ expires: '1d' }`，預設 7 天）：未送出的答案與目前步驟存在填寫者瀏覽器的 localStorage，回來時還原並提示「重新開始」；送出成功即清除
- ✅ 預設關閉：共用電腦上下一個人會看到前一個人的個資；Studio 預覽不讀寫草稿
- ✅ 還原在 mount 之後（`<FormHost>` 在 Next.js SSR 時不會 hydration mismatch）；儲存空間被封鎖時靜默略過
- ✅ 四種語言的提示文字；form-authoring skill 建議長表單開啟；demo `developer-meetup` 開啟

## v0.4 — Agent-native authoring ✅

### Inspector ✅

- ✅ dev 時 `vite/loc-plugin.ts` 在 `forms/` 的每個 JSX 元素標上 `data-of-loc="forms/<id>/index.tsx:行:欄"`（只插在標籤內，行號不變）；內建欄位經 `controlProps` 帶到控制項（任何主題都適用），`<Form>`／`<Page>`／`<Row>`／`<Heading>`／`<Paragraph>` 帶到各自的元素
- ✅ Studio Preview「定位原始碼」：hover 外框、點擊取得位置（不觸發欄位或換頁），Esc 結束；面板顯示 `file:line`、欄位 name，可在編輯器開啟、複製位置
- ✅ 選取寫進 `current.json` 的 `selection`，`current-form` skill 用它解析「這個欄位」

### Comments ✅

- ✅ 面板「留言」：`{/* @form-comment: … */}` 插在元素上方（表達式位置用 `/* … */`），Studio 列出該表單所有留言、可刪除
- ✅ `open-form comments [id] [--json]` 列出標記；`apply-comments` skill：逐一套用、刪除標記、`open-form check`，不清楚的保留並詢問
- ✅ 寫入限制在 `forms/` 內、Studio 授權 + same-origin、文字單行且中和 `*/`

### 編輯模式（對齊 open-slide）✅

- ✅ 「定位原始碼」改為工具列的「預覽／編輯」切換；編輯面板固定在右側（`lg` 以下在預覽下方），移除「在編輯器開啟」
- ✅ 所有東西都能選：欄位整個選；標題、說明、進度、按鈕、主題裝飾等 runtime／主題畫的部分單獨選；麵包屑與「選取上層」往外選到 `<Page>`、`<Form>`
- ✅ 直接改文字：label、description、title、placeholder、子文字與 `config` 的標題、訊息原地寫回原始碼，翻譯表的 key 跟著改名；預覽其他語言時可直接改該語系的翻譯
- ✅ 留言移到面板，⌘↵ 加入；`config` 裡的文字留言放在該屬性上方；工具列顯示留言數
- ✅ 離開編輯模式（切回預覽、關閉面板、Esc）一律清掉 iframe 外框與選取；Esc 先取消選取再離開
- ✅ 改原始碼後預覽留在原本的步驟；進度條的步驟標題跟著翻譯
- ✅ 預覽頁改成 open-slide 式分欄：一列工具列；左側步驟列（標題、題數、條件、完成頁，編輯時縮成編號、hover 或鍵盤 focus 顯示該步的條件與題目），中間預覽（工具列與畫布左緣對齊），右側編輯面板；窄螢幕退回橫向步驟列

### 主題都是專案自己的（對齊 open-slide）✅

- ✅ 表單只用專案 `themes/` 裡的主題；套件不再在執行時提供主題，也沒有內建的預設主題（沒設 `theme` = 基本樣式）
- ✅ 5 個內建主題改為範本：`open-form theme add <starter> [--as name]`（取代 `theme eject`），`init` 的 `themes/` 是空的
- ✅ Studio 主題頁：只列專案的主題，卡片列出使用中的表單、標出沒有 THEME.md 的主題；空狀態引導從範本加入或 `/create-theme`；「新增主題」可一鍵加入範本；表單用了不存在的主題時列出並可一鍵加入；拿掉「內建／本地／覆蓋內建」標籤與另存流程
- ✅ `open-form check` 警告表單用了 `themes/` 裡沒有的主題；demo 的主題改為 `apps/demo/themes/` 下的資料夾，`midnight` 補上 THEME.md

### 主題字型（對齊 open-slide）✅

- ✅ Studio「調整」面板的內文／標題字體下拉可「從 Google Fonts 加入…」：搜尋、分類（含中日韓）、即時預覽，加入後直接套用
- ✅ 字體下載進主題的 `fonts/`（woff2、保留 `unicode-range` 分片），表單自己提供，填答者不會連到 Google
- ✅ `open-form theme font <id> <family>` 給 agent 用；`create-theme` skill 改為建議這個做法，不再建議連 `fonts.googleapis.com`

### 主題是參考，外觀屬於每張表單（對齊 open-slide）✅

- ✅ `themes/` 裡的主題只是 agent 建立表單時複製的素材：`open-form theme copy <theme> <form>`（或 `open-form create <id> --theme <theme>`）把它複製進 `forms/<form>/theme/`、範圍改成表單 id，再以 `<Form theme={theme}>` 套用——修改或刪除主題都不會改變既有表單
- ✅ 移除 `defineForm()` 與 `open-form.config.ts` 的 `theme`、主題不存在時的退回與 `check` 警告；改成表單從 `themes/` 或別張表單 import 時 `check` 會警告
- ✅ production build 不再打包 `themes/`；表單不用等主題 chunk；`/theme-preview` 只在 dev；Edit 模式略過 `forms/<id>/theme/`
- ✅ Studio 主題頁改為參考展示：以「用在表單上」卡片取代「使用中的表單」，拿掉專案預設標籤與缺主題提示；「調整」只影響之後複製的表單
- ✅ `theme check`／`theme font` 支援 `--form` 作用在表單自己的副本；`current.json` 回報 `formThemePath`
- ✅ Demo：每張表單都帶著自己的主題；`conference-pass` 以 `forms/conference-pass/theme/` 找回深色的 `midnight` 外觀

### 收件時間 ✅

- ✅ 時區：`opensAt`／`closesAt` 依表單 → 專案 `timeZone` → UTC 解讀，不再用伺服器時區（台灣筆電與 UTC 容器結果一致）；支援 `YYYY-MM-DDTHH:mm`；`open-form init` 寫入本機時區；`open-form check` 顯示時區、沒設時警告
- ✅ Studio 設定頁可直接調整開放／截止時間、回覆上限、暫停收件（`submissions.closed`）
- ✅ `open-form dev`：寫回 `forms/<id>/index.tsx` 的 `config.submissions`（Babel AST，只改動到的值）
- ✅ production：存成資料庫覆寫（`form_overrides`，只存與程式碼不同的值），立即生效、不需重新部署；Studio 標示「已在 Studio 調整」並可改回程式碼設定
- ✅ Studio 的狀態改由 server 計算（含覆寫與時區）

### Excel 匯出 ✅

- ✅ `GET /api/forms/:id/export?format=xlsx`、Studio「Excel」按鈕、`open-form responses export <id> -o responses.xlsx`（或 `--format xlsx`）
- ✅ 不加依賴：`server/xlsx.ts` 自己寫 SpreadsheetML + ZIP，壓縮用 Web 標準 `CompressionStream`，Next.js／Workers 也能跑
- ✅ 數字是數字、`<DateInput>` 是日期、「Submitted at」轉成表單時區的日期時間（欄名標出時區）；粗體標題列、凍結、篩選、欄寬依內容
- ✅ 文字一律是 inline string，Excel 不會當公式執行，所以不需要 CSV 的 `'` 跳脫；XML 不允許的控制字元會被移除

## v0.5 — Uploads

- ⬜ `<File>`：存在本機 `.open-form/uploads/`、`submission_files`
- ⬜ 上傳安全：大小／型別限制（依內容判斷，不信任副檔名）、儲存檔名由 server 產生、下載需 admin 授權且一律 `Content-Disposition: attachment`

## v0.6 — Protection & analytics

### Step 1 — CAPTCHA ⬜

- ⬜ Turnstile / hCaptcha（選用）

### Step 2 — Analytics ⬜

- ⬜ 完成率、各 step 流失

## v0.7 — Remote storage & integrations

> Zapier／Make／n8n 已可透過 v0.3 的 webhooks 串接，不另做 integration。

### Step 1 — Remote storage ⬜

- ⬜ Turso / libSQL、Postgres adapter（評估 Drizzle）

### Step 2 — S3-compatible 檔案儲存 ⬜

- ⬜ `<File>` 的 S3-compatible adapter（S3、R2、MinIO），作為本機 `.open-form/uploads/` 之外的選項

### Step 3 — Google Sheets ⬜

- ⬜ 新回覆同步到 Google Sheets

### Step 4 — Notion ⬜

- ⬜ 新回覆同步到 Notion database

## Later

- ⬜ 填寫者登入（Clerk / Auth.js / Supabase）——只負責「填表前是否要求登入」；Studio 登入見 v0.3 Step 5
- ✅ `@open-form-build/cli`（`npx @open-form-build/cli init`）
- ✅ `create-open-form`（`npm create open-form@latest`）

---

## 明確不做

Typeform clone、drag-and-drop builder、CRM、marketing automation、database SaaS、auth provider、workflow platform。
