export type Locale = 'en' | 'zh-TW' | 'zh-CN' | 'ja';

export const LOCALES: readonly Locale[] = ['en', 'zh-TW', 'zh-CN', 'ja'];

export type Messages = {
  /** The catalog's own tag, for formatting dates and numbers to match. */
  locale: Locale;
  required: string;
  mustAccept: string;
  invalidEmail: string;
  invalidUrl: string;
  invalidPhone: string;
  invalidNumber: string;
  integer: string;
  minLength: string;
  maxLength: string;
  min: string;
  max: string;
  step: string;
  minDate: string;
  maxDate: string;
  invalidDate: string;
  pattern: string;
  invalidOption: string;
  invalidValue: string;
  minSelected: string;
  maxSelected: string;

  next: string;
  back: string;
  submit: string;
  submitting: string;
  stepOf: string;
  stepLabel: string;
  pressEnter: string;
  newline: string;
  start: string;
  language: string;
  previewInspect: string;
  previewNoSubmit: string;
  shownWhen: string;
  optional: string;
  selectPlaceholder: string;
  successTitle: string;
  successMessage: string;
  closedTitle: string;
  closedMessage: string;
  notOpenMessage: string;
  fullMessage: string;
  duplicateMessage: string;
  rateLimited: string;
  tooFast: string;
  fixErrors: string;
  genericError: string;
  expiredToken: string;
  networkError: string;
  notFoundTitle: string;
  notFoundMessage: string;
  draftRestored: string;
  draftDiscard: string;
};

const en: Messages = {
  locale: 'en',
  required: 'This field is required.',
  mustAccept: 'Please check this box to continue.',
  invalidEmail: 'Enter a valid email address.',
  invalidUrl: 'Enter a valid URL, starting with http:// or https://.',
  invalidPhone: 'Enter a valid phone number.',
  invalidNumber: 'Enter a number.',
  integer: 'Enter a whole number.',
  minLength: 'Use at least {n} characters.',
  maxLength: 'Use {n} characters or fewer.',
  min: 'Enter {n} or more.',
  max: 'Enter {n} or less.',
  step: 'Enter a valid value. The nearest is {n}.',
  minDate: 'Pick a date on or after {n}.',
  maxDate: 'Pick a date on or before {n}.',
  invalidDate: 'Enter a valid date.',
  pattern: 'Use the requested format.',
  invalidOption: 'Choose one of the listed options.',
  invalidValue: 'Enter a valid value.',
  minSelected: 'Select at least {n}.',
  maxSelected: 'Select at most {n}.',

  next: 'Next',
  back: 'Back',
  submit: 'Submit',
  submitting: 'Submitting…',
  stepOf: 'Step {current} of {total}',
  stepLabel: 'Step {n}',
  pressEnter: 'press Enter ↵',
  newline: 'Shift ⇧ + Enter ↵ for a new line',
  start: 'Start',
  language: 'Language',
  previewInspect:
    'Preview: every step and hidden question is shown. Answers aren’t checked or sent.',
  previewNoSubmit:
    'Nothing was sent — you jumped between steps in preview. Reload to fill it in for real.',
  shownWhen: 'Shown when {condition}',
  optional: 'Optional',
  selectPlaceholder: 'Select…',
  successTitle: 'Thank you!',
  successMessage: 'Your response has been recorded.',
  closedTitle: 'This form is closed',
  closedMessage: 'This form is no longer accepting responses.',
  notOpenMessage: 'This form opens on {date}.',
  fullMessage: 'This form has reached its response limit.',
  duplicateMessage: 'You have already submitted this form.',
  rateLimited: 'Too many submissions. Please try again in a few minutes.',
  tooFast: 'That was quick! Please wait a moment and submit again.',
  fixErrors: 'Please fix the highlighted fields.',
  genericError: 'Something went wrong. Please try again.',
  expiredToken: 'This page has been open too long. Reload it and submit again.',
  networkError: 'Could not reach the server. Check your connection and try again.',
  notFoundTitle: 'Form not found',
  notFoundMessage: 'The link may be mistyped, or this form is no longer available.',
  draftRestored: 'We restored the answers you left unfinished.',
  draftDiscard: 'Start over',
};

const zhTW: Messages = {
  locale: 'zh-TW',
  required: '此欄位為必填。',
  mustAccept: '請勾選此項目以繼續。',
  invalidEmail: '請輸入有效的 Email。',
  invalidUrl: '請輸入有效的網址（http:// 或 https:// 開頭）。',
  invalidPhone: '請輸入有效的電話號碼。',
  invalidNumber: '請輸入數字。',
  integer: '請輸入整數。',
  minLength: '至少需要 {n} 個字元。',
  maxLength: '最多 {n} 個字元。',
  min: '請輸入 {n} 以上的數值。',
  max: '請輸入 {n} 以下的數值。',
  step: '請輸入有效的數值，最接近的是 {n}。',
  minDate: '請選擇 {n} 當天或之後的日期。',
  maxDate: '請選擇 {n} 當天或之前的日期。',
  invalidDate: '請輸入有效的日期。',
  pattern: '格式不正確。',
  invalidOption: '請從選項中選擇。',
  invalidValue: '請輸入有效的值。',
  minSelected: '請至少選擇 {n} 項。',
  maxSelected: '最多選擇 {n} 項。',

  next: '下一步',
  back: '上一步',
  submit: '送出',
  submitting: '送出中…',
  stepOf: '第 {current} 步，共 {total} 步',
  stepLabel: '第 {n} 步',
  pressEnter: '按 Enter ↵',
  newline: 'Shift ⇧ + Enter ↵ 換行',
  start: '開始',
  language: '語言',
  previewInspect: '預覽模式：顯示所有步驟與條件題目，不會檢查或送出答案。',
  previewNoSubmit: '沒有送出 —— 你在預覽中跳過了步驟。重新載入即可實際填寫。',
  shownWhen: '{condition}時顯示',
  optional: '選填',
  selectPlaceholder: '請選擇…',
  successTitle: '感謝你的填寫！',
  successMessage: '我們已收到你的回覆。',
  closedTitle: '表單已關閉',
  closedMessage: '此表單已停止收件。',
  notOpenMessage: '此表單將於 {date} 開放填寫。',
  fullMessage: '此表單已達收件上限。',
  duplicateMessage: '你已經填寫過此表單。',
  rateLimited: '送出次數過多，請稍後再試。',
  tooFast: '填寫速度太快了，請稍候再送出一次。',
  fixErrors: '請修正標示的欄位。',
  genericError: '發生錯誤，請再試一次。',
  expiredToken: '此頁面開啟太久了，請重新整理後再送出。',
  networkError: '無法連線到伺服器，請檢查網路後再試一次。',
  notFoundTitle: '找不到表單',
  notFoundMessage: '連結可能有誤，或這份表單已不再公開。',
  draftRestored: '已還原你上次未完成的回答。',
  draftDiscard: '重新開始',
};

// Mainland conventions: 您, 提交, 邮箱.
const zhCN: Messages = {
  locale: 'zh-CN',
  required: '此项为必填项。',
  mustAccept: '请勾选此项以继续。',
  invalidEmail: '请输入有效的邮箱地址。',
  invalidUrl: '请输入有效的网址（以 http:// 或 https:// 开头）。',
  invalidPhone: '请输入有效的电话号码。',
  invalidNumber: '请输入数字。',
  integer: '请输入整数。',
  minLength: '至少输入 {n} 个字符。',
  maxLength: '最多输入 {n} 个字符。',
  min: '请输入不小于 {n} 的数值。',
  max: '请输入不大于 {n} 的数值。',
  step: '请输入有效的数值，最接近的是 {n}。',
  minDate: '请选择 {n} 当天或之后的日期。',
  maxDate: '请选择 {n} 当天或之前的日期。',
  invalidDate: '请输入有效的日期。',
  pattern: '格式不正确。',
  invalidOption: '请从选项中选择。',
  invalidValue: '请输入有效的值。',
  minSelected: '请至少选择 {n} 项。',
  maxSelected: '最多选择 {n} 项。',

  next: '下一步',
  back: '上一步',
  submit: '提交',
  submitting: '提交中…',
  stepOf: '第 {current} 步，共 {total} 步',
  stepLabel: '第 {n} 步',
  pressEnter: '按 Enter ↵',
  newline: 'Shift ⇧ + Enter ↵ 换行',
  start: '开始',
  language: '语言',
  previewInspect: '预览模式：显示所有步骤和条件题目，不会检查或提交答案。',
  previewNoSubmit: '没有提交——你在预览中跳过了步骤。重新加载即可实际填写。',
  shownWhen: '{condition}时显示',
  optional: '选填',
  selectPlaceholder: '请选择…',
  successTitle: '感谢您的填写！',
  successMessage: '我们已收到您的回复。',
  closedTitle: '表单已关闭',
  closedMessage: '此表单已停止收集。',
  notOpenMessage: '此表单将于 {date} 开放填写。',
  fullMessage: '此表单已达到收集上限。',
  duplicateMessage: '您已经填写过此表单。',
  rateLimited: '提交次数过多，请稍后再试。',
  tooFast: '填写速度太快了，请稍等片刻后再提交。',
  fixErrors: '请修正标出的字段。',
  genericError: '出错了，请重试。',
  expiredToken: '此页面打开时间过长，请刷新后重新提交。',
  networkError: '无法连接到服务器，请检查网络后重试。',
  notFoundTitle: '找不到该表单',
  notFoundMessage: '链接可能有误，或这份表单已不再公开。',
  draftRestored: '已恢复您上次未完成的回答。',
  draftDiscard: '重新开始',
};

// Polite form (です・ます), the norm for forms addressed to the public.
const ja: Messages = {
  locale: 'ja',
  required: 'この項目は必須です。',
  mustAccept: '続行するにはチェックを入れてください。',
  invalidEmail: '有効なメールアドレスを入力してください。',
  invalidUrl: '有効なURLを入力してください（http:// または https:// で始まるもの）。',
  invalidPhone: '有効な電話番号を入力してください。',
  invalidNumber: '数値を入力してください。',
  integer: '整数を入力してください。',
  minLength: '{n}文字以上で入力してください。',
  maxLength: '{n}文字以内で入力してください。',
  min: '{n}以上の値を入力してください。',
  max: '{n}以下の値を入力してください。',
  step: '有効な値を入力してください。最も近い値は {n} です。',
  minDate: '{n}以降の日付を選択してください。',
  maxDate: '{n}以前の日付を選択してください。',
  invalidDate: '有効な日付を入力してください。',
  pattern: '指定された形式で入力してください。',
  invalidOption: '選択肢の中から選んでください。',
  invalidValue: '有効な値を入力してください。',
  minSelected: '{n}個以上選択してください。',
  maxSelected: '選択できるのは{n}個までです。',

  next: '次へ',
  back: '戻る',
  submit: '送信',
  submitting: '送信中…',
  stepOf: 'ステップ {current} / {total}',
  stepLabel: 'ステップ {n}',
  pressEnter: 'Enter ↵ で次へ',
  newline: 'Shift ⇧ + Enter ↵ で改行',
  start: 'はじめる',
  language: '言語',
  previewInspect:
    'プレビュー：すべてのステップと条件付きの質問を表示しています。回答は検証も送信もされません。',
  previewNoSubmit:
    '送信されていません（プレビューでステップを移動したため）。実際に入力するには再読み込みしてください。',
  shownWhen: '{condition}のときに表示',
  optional: '任意',
  selectPlaceholder: '選択してください…',
  successTitle: 'ありがとうございました！',
  successMessage: '回答を受け付けました。',
  closedTitle: 'このフォームは締め切りました',
  closedMessage: 'このフォームは現在、回答を受け付けていません。',
  notOpenMessage: 'このフォームは{date}から回答を受け付けます。',
  fullMessage: '回答数が上限に達したため、受付を終了しました。',
  duplicateMessage: 'このフォームにはすでに回答済みです。',
  rateLimited: '送信回数が多すぎます。しばらくしてからもう一度お試しください。',
  tooFast: '入力が速すぎるようです。少し待ってからもう一度送信してください。',
  fixErrors: '表示された項目を修正してください。',
  genericError: 'エラーが発生しました。もう一度お試しください。',
  expiredToken:
    'ページを開いてから時間が経ちすぎています。再読み込みしてからもう一度送信してください。',
  networkError: 'サーバーに接続できませんでした。通信環境を確認して、もう一度お試しください。',
  notFoundTitle: 'フォームが見つかりません',
  notFoundMessage: 'リンクが間違っているか、このフォームは公開を終了しています。',
  draftRestored: '前回途中まで入力した回答を復元しました。',
  draftDiscard: '最初からやり直す',
};

const CATALOG: Record<Locale, Messages> = { en, 'zh-TW': zhTW, 'zh-CN': zhCN, ja };

export function getMessages(locale: Locale | undefined): Messages {
  return (locale && CATALOG[locale]) || en;
}

export function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(vars, key) ? String(vars[key]) : match,
  );
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * The supported locale a BCP 47 tag most likely means — for error messages
 * that suggest a fix (`'zh-Hant'` → `'zh-TW'`). Not used to accept loose tags.
 */
export function suggestLocale(tag: string): Locale | undefined {
  const t = tag.trim().toLowerCase().replace(/_/g, '-');
  if (/^zh(-hant|-tw|-hk|-mo)/.test(t)) return 'zh-TW';
  if (/^zh(-hans|-cn|-sg|$)/.test(t)) return 'zh-CN';
  if (/^(ja|jp)(-|$)/.test(t)) return 'ja';
  if (/^en(-|$)/.test(t)) return 'en';
  return undefined;
}

/** Why a configured `locale` won't work, or undefined if it's fine (or unset). */
export function localeProblem(value: unknown): string | undefined {
  if (value === undefined || isLocale(value)) return undefined;
  const hint = typeof value === 'string' ? suggestLocale(value) : undefined;
  return `locale ${JSON.stringify(value)} isn't supported.${hint ? ` Did you mean '${hint}'?` : ''} Use one of: ${LOCALES.join(', ')}.`;
}

/** `'2026-11-14'` in the locale's long style, e.g. 2026年11月14日. Unparseable input comes back as is. */
export function formatDate(value: string, locale: Locale): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}

/** An ISO timestamp as a localized date and time, in the viewer's time zone. */
export function formatDateTime(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(date);
}
