import {
  type ChoiceGroupUIProps,
  defineTheme,
  type FieldUIProps,
  type HeaderUIProps,
  type LayoutUIProps,
  type NoticeUIProps,
  type SuccessUIProps,
  type TextInputUIProps,
  useTranslate,
} from '@open-form-build/core';
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import './fonts/inter.css';
import './fonts/jetbrains-mono.css';
import './theme.css';

// An amber-screen terminal drawn in thin lines on a black page. Its CRT shows a sans
// wordmark, a curl line, HTTP headers for who's ordering, and the menu as a
// JSON body you select like code in an editor.

const PATH = '/f/cafe-order';

const STATE_LABEL: Record<LayoutUIProps['state'], string> = {
  form: 'open',
  success: '201 Created',
  unavailable: 'closed',
};

// Each key: [event.code, legend, width in key widths]; every row is 15 wide.
type Key = [code: string, legend: string, width: number];
const single = (codes: string, legends: string) =>
  codes.split(' ').map((code, i): Key => [code, legends.split(' ')[i], 1]);
const KEY_ROWS: Key[][] = [
  [
    ...single(
      'Backquote Digit1 Digit2 Digit3 Digit4 Digit5 Digit6 Digit7 Digit8 Digit9 Digit0 Minus Equal',
      '` 1 2 3 4 5 6 7 8 9 0 - =',
    ),
    ['Backspace', '⌫', 2],
  ],
  [
    ['Tab', 'tab', 1.5],
    ...single(
      'KeyQ KeyW KeyE KeyR KeyT KeyY KeyU KeyI KeyO KeyP BracketLeft BracketRight',
      'Q W E R T Y U I O P [ ]',
    ),
    ['Backslash', '\\', 1.5],
  ],
  [
    ['CapsLock', 'caps', 1.75],
    ...single(
      'KeyA KeyS KeyD KeyF KeyG KeyH KeyJ KeyK KeyL Semicolon Quote',
      `A S D F G H J K L ; '`,
    ),
    ['Enter', '⏎ POST', 2.25],
  ],
  [
    ['ShiftLeft', 'shift', 2.25],
    ...single('KeyZ KeyX KeyC KeyV KeyB KeyN KeyM Comma Period Slash', 'Z X C V B N M , . /'),
    ['ShiftRight', 'shift', 2.75],
  ],
  [
    ['ControlLeft', 'ctrl', 1.25],
    ['AltLeft', 'opt', 1.25],
    ['MetaLeft', 'cmd', 1.25],
    ['Space', '', 6.25],
    ['MetaRight', 'cmd', 1.25],
    ['AltRight', 'opt', 1.25],
    ['ArrowLeft', '←', 1.25],
    ['ArrowRight', '→', 1.25],
  ],
];
const ROW_EDGES = [12, 40, 70, 102, 136, 174];

// A point on the keyboard in perspective: u across (0–1), y down the viewBox.
function point(u: number, y: number): [number, number] {
  const left = 110 - ((y - 12) / 162) * 70;
  return [left + u * (1000 - 2 * left), y];
}
const at = (u: number, y: number) =>
  point(u, y)
    .map((n) => n.toFixed(1))
    .join(',');

const KEYS = KEY_ROWS.flatMap((row, r) => {
  const y0 = ROW_EDGES[r] + 2;
  const y1 = ROW_EDGES[r + 1] - 1;
  const rise = (y1 - y0) * 0.3;
  let start = 0;
  return row.map(([code, legend, width]) => {
    const u0 = start / 15 + 0.003;
    const u1 = (start + width) / 15 - 0.003;
    start += width;
    const inset = Math.min(0.012, (u1 - u0) * 0.16);
    const top = [
      at(u0 + inset, y0 - rise),
      at(u1 - inset, y0 - rise),
      at(u1 - inset, y1 - rise * 1.6),
      at(u0 + inset, y1 - rise * 1.6),
    ];
    const [cx, cy] = point((u0 + u1) / 2, (y0 + y1) / 2 - rise * 1.3);
    return {
      code,
      legend,
      size: (y1 - y0) * (legend.length > 2 ? 0.34 : 0.46),
      center: [cx, cy],
      body: [at(u0, y0), top[0], top[1], at(u1, y0), at(u1, y1), at(u0, y1)].join(' '),
      top: top.join(' '),
      edges: `M${top[3]} L${at(u0, y1)} M${top[2]} L${at(u1, y1)}`,
    };
  });
});

function toggled(keys: ReadonlySet<string>, code: string, on: boolean) {
  if (keys.has(code) === on) return keys;
  const next = new Set(keys);
  if (on) next.add(code);
  else next.delete(code);
  return next;
}

const SHIFTED: Record<string, string> = {
  '`': '~',
  '1': '!',
  '2': '@',
  '3': '#',
  '4': '$',
  '5': '%',
  '6': '^',
  '7': '&',
  '8': '*',
  '9': '(',
  '0': ')',
  '-': '_',
  '=': '+',
  '[': '{',
  ']': '}',
  '\\': '|',
  ';': ':',
  "'": '"',
  ',': '<',
  '.': '>',
  '/': '?',
};

type TextField = HTMLInputElement | HTMLTextAreaElement;

// The focused text answer, if any: the drawn keys type only into those.
function focusedText(form: HTMLFormElement | null | undefined): TextField | null {
  const el = document.activeElement;
  if (!form?.contains(el)) return null;
  if (el instanceof HTMLTextAreaElement) return el;
  return el instanceof HTMLInputElement &&
    ['text', 'email', 'search', 'tel', 'url'].includes(el.type)
    ? el
    : null;
}

// Edit like a keystroke would, so the runtime sees an ordinary input event
// (and maxLength holds); setRangeText covers browsers without execCommand.
function edit(field: TextField, text: string) {
  if (document.execCommand(text ? 'insertText' : 'delete', false, text)) return;
  const end = field.selectionEnd ?? field.value.length;
  const start = text ? (field.selectionStart ?? end) : Math.max(0, end - 1);
  field.setRangeText(text, start, end, 'end');
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

// The drawn keyboard follows the real one; clicked, it types into the focused
// answer, and its Enter key sends the order.
function Keyboard({ onKey }: { onKey?: () => void }) {
  const ref = useRef<SVGSVGElement>(null);
  const [down, setDown] = useState<ReadonlySet<string>>(new Set());
  const [shift, setShift] = useState(false);
  const [caps, setCaps] = useState(false);
  const press = (code: string, on: boolean) => setDown((prev) => toggled(prev, code, on));
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => setDown((prev) => toggled(prev, e.code, true));
    const onUp = (e: KeyboardEvent) => setDown((prev) => toggled(prev, e.code, false));
    const reset = () => setDown(new Set());
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', reset);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', reset);
    };
  }, []);

  const hit = (code: string, legend: string) => {
    if (onKey) return onKey();
    const form = ref.current?.closest('form');
    if (code === 'Enter') return form?.requestSubmit();
    if (code.startsWith('Shift')) return setShift((on) => !on);
    if (code === 'CapsLock') return setCaps((on) => !on);
    const field = focusedText(form);
    if (!field) return;
    if (code === 'Backspace') return edit(field, '');
    if (code === 'ArrowLeft' || code === 'ArrowRight') {
      const at = Math.max(0, (field.selectionStart ?? 0) + (code === 'ArrowLeft' ? -1 : 1));
      return field.setSelectionRange(at, at);
    }
    const char = code === 'Space' ? ' ' : legend.length === 1 ? legend : '';
    if (!char) return;
    const upper = shift !== caps;
    edit(
      field,
      /[A-Z]/.test(char)
        ? upper
          ? char
          : char.toLowerCase()
        : shift
          ? (SHIFTED[char] ?? char)
          : char,
    );
    setShift(false);
  };

  return (
    // Keep focus on the answer being typed into while the keys are clicked.
    <svg
      ref={ref}
      className="co-keyboard"
      viewBox="0 -4 1000 214"
      aria-hidden="true"
      onPointerDown={(e) => e.preventDefault()}
      onMouseDown={(e) => e.preventDefault()}
    >
      <polygon points="96,2 904,2 992,184 8,184" />
      <polygon points="8,184 992,184 986,208 14,208" />
      {KEYS.map((key) => {
        const latched =
          (shift && key.code.startsWith('Shift')) || (caps && key.code === 'CapsLock');
        return (
          <g
            key={key.code}
            className="co-key-cap"
            data-code={key.code}
            data-down={down.has(key.code) || latched || undefined}
            onPointerDown={() => {
              press(key.code, true);
              hit(key.code, key.legend);
            }}
            onPointerUp={() => press(key.code, false)}
            onPointerLeave={() => press(key.code, false)}
          >
            <polygon points={key.body} />
            <g className="co-key-top">
              <polygon points={key.top} />
              {key.legend && (
                <text x={key.center[0]} y={key.center[1]} fontSize={key.size}>
                  {shift ? (SHIFTED[key.legend] ?? key.legend) : key.legend}
                </text>
              )}
            </g>
            <path d={key.edges} />
          </g>
        );
      })}
    </svg>
  );
}

// After an order goes through, JSON punctuation rains down the screen once.
const RAIN = Array.from({ length: 36 }, (_, i) => ({
  id: i,
  char: '{}[]":,'[i % 7],
  x: (i * 37) % 100,
  delay: ((i * 53) % 17) / 10,
  duration: 1.6 + ((i * 29) % 11) / 10,
}));

function Rain() {
  return (
    <div className="co-rain" aria-hidden="true">
      {RAIN.map((drop) => (
        <span
          key={drop.id}
          style={
            {
              '--co-x': `${drop.x}%`,
              '--co-delay': `${drop.delay}s`,
              '--co-dur': `${drop.duration}s`,
            } as CSSProperties
          }
        >
          {drop.char}
        </span>
      ))}
    </div>
  );
}

// The screen starts dark until someone powers it on: the button, a click on
// the glass or any key. Later loads in the tab boot by themselves; reduced
// motion skips it.
type Power = 'off' | 'booting' | 'on';
const POWERED = 'findrink:powered';
const BOOT_LINES = [
  'findrink BIOS v1.0',
  'checking milk ........ ok',
  'grinding beans ....... ok',
  'loading menu.json .... ok',
];

// The knob under the screen picks its phosphor; remembered per browser.
const PHOSPHORS = ['amber', 'green', 'white'] as const;
type Phosphor = (typeof PHOSPHORS)[number];
const PHOSPHOR = 'findrink:phosphor';

function Layout({ state, banner, header, content, alert, actions }: LayoutUIProps) {
  const tr = useTranslate();
  const [origin, setOrigin] = useState('');
  const [today, setToday] = useState('');
  const [power, setPower] = useState<Power>('off');
  const [phosphor, setPhosphor] = useState<Phosphor>('amber');
  const scroll = useRef<HTMLElement>(null);
  const focusForm = useRef(false);
  useEffect(() => {
    setOrigin(window.location.origin);
    setToday(new Date().toLocaleDateString('sv-SE'));
    let powered = false;
    try {
      powered = sessionStorage.getItem(POWERED) === '1';
      const saved = localStorage.getItem(PHOSPHOR);
      if (PHOSPHORS.some((p) => p === saved)) setPhosphor(saved as Phosphor);
    } catch {}
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPower('on');
    else if (powered) setPower('booting');
  }, []);
  const boot = useCallback(() => setPower((now) => (now === 'off' ? 'booting' : now)), []);
  useEffect(() => {
    if (power === 'off') {
      const onKey = (e: KeyboardEvent) => {
        if (['Tab', 'Shift', 'Meta', 'Alt', 'Control'].includes(e.key)) return;
        focusForm.current = true;
        boot();
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
    if (power === 'booting') {
      const timer = setTimeout(() => {
        setPower('on');
        try {
          sessionStorage.setItem(POWERED, '1');
        } catch {}
      }, 1500);
      return () => clearTimeout(timer);
    }
    // Keyboard users land in the first answer once the form appears.
    if (focusForm.current) {
      focusForm.current = false;
      scroll.current?.querySelector<HTMLElement>('input, textarea')?.focus();
    }
  }, [power, boot]);
  const gated = state === 'form' && power !== 'on';
  const turnKnob = () => {
    const next = PHOSPHORS[(PHOSPHORS.indexOf(phosphor) + 1) % PHOSPHORS.length];
    setPhosphor(next);
    try {
      localStorage.setItem(PHOSPHOR, next);
    } catch {}
  };
  const screen = state === 'success' ? 'of-success' : state === 'unavailable' ? 'of-notice' : '';
  return (
    <div className="co-mac" data-power={gated ? power : 'on'} data-phosphor={phosphor}>
      <div className="co-monitor">
        <div className="co-bezel">
          <div className="co-screen">
            {state === 'success' && <Rain />}
            {gated && (
              <button
                type="button"
                className="co-off"
                aria-label={tr('開機開始點餐')}
                onClick={(e) => {
                  focusForm.current = e.detail === 0;
                  boot();
                }}
              >
                {power === 'off' ? (
                  <span className="co-prompt">
                    &gt; <span className="co-wide">press POWER to order</span>
                    <span className="co-narrow">tap to power on</span>
                  </span>
                ) : (
                  <span className="co-boot">
                    {BOOT_LINES.map((line, i) => (
                      <span key={line} style={{ '--co-i': i } as CSSProperties}>
                        {line}
                      </span>
                    ))}
                  </span>
                )}
              </button>
            )}
            {/* The screen scrolls, not the page; a new key starts each screen at its top. */}
            <article
              ref={scroll}
              className="co-scroll co-sheet"
              key={`${state}-${gated}`}
              data-state={state}
              inert={gated || undefined}
            >
              <div className="co-head">
                {header}
                <dl className="co-meta">
                  <div>
                    <dt>Method</dt>
                    <dd>POST</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd data-state={state}>{STATE_LABEL[state]}</dd>
                  </div>
                  {today && (
                    <div>
                      <dt>Date</dt>
                      <dd>{today}</dd>
                    </div>
                  )}
                </dl>
              </div>
              <hr className="co-rule" />
              {state === 'form' && (
                <>
                  <p className="co-curl">
                    curl -X POST '{origin}
                    {PATH}'
                  </p>
                  <hr className="co-rule" />
                </>
              )}
              <div
                className={['co-main', screen].filter(Boolean).join(' ')}
                role={state === 'form' ? undefined : 'status'}
              >
                {banner}
                {content}
                {alert}
                {actions}
              </div>
            </article>
          </div>
        </div>
        <div className="co-base">
          <span className="co-badge" aria-hidden="true">
            <Logo />
            findrink
          </span>
          <span className="co-grille" aria-hidden="true" />
          {/* Engraved like a real panel: a label, the knob's positions, the knob. */}
          <button
            type="button"
            className="co-control co-color"
            aria-label={`${tr('螢幕顏色')}: ${phosphor}`}
            title={tr('螢幕顏色')}
            onClick={turnKnob}
          >
            <span className="co-label">COLOR</span>
            <span className="co-dots">
              {PHOSPHORS.map((p) => (
                <span key={p} data-p={p} data-on={p === phosphor || undefined} />
              ))}
            </span>
            <span className="co-knob" data-turn={PHOSPHORS.indexOf(phosphor)} />
          </button>
          <button
            type="button"
            className="co-control co-power-btn"
            tabIndex={-1}
            aria-hidden="true"
            onClick={boot}
          >
            <span className="co-label">POWER</span>
            <span className="co-switch" />
          </button>
          <span className="co-power" aria-hidden="true" />
        </div>
      </div>
      <Keyboard onKey={gated ? boot : undefined} />
    </div>
  );
}

// findrink's mark: a tumbler and straw drawn in the wordmark's weight.
function Logo() {
  return (
    <svg className="co-logo" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M7 10h18l-2.2 17.2a2 2 0 0 1-2 1.8h-9.6a2 2 0 0 1-2-1.8z" />
      <path d="M8 16.5h16" />
      <path d="M17.5 10l3-7h4" />
    </svg>
  );
}

function Header({ title, description }: HeaderUIProps) {
  const [mark, ...rest] = (title ?? '').split(' ');
  return (
    <header className="of-header co-header">
      <h1 className="of-title co-wordmark">
        <Logo />
        <strong>{mark}</strong>
        {rest.length > 0 && ` ${rest.join(' ')}`}
      </h1>
      {description && <p className="of-description co-tagline">{description}</p>}
    </header>
  );
}

function Field({ field, children, as = 'div', hideLabel, hideDescription }: FieldUIProps) {
  const key = field.label && !hideLabel && <span className="co-key">{field.label}</span>;
  const help = field.description && !hideDescription && (
    <p className="of-help co-help" id={field.descriptionId}>
      {field.description}
    </p>
  );
  const error = field.error && (
    <p className="of-error co-error" id={field.errorId}>
      {field.error}
    </p>
  );
  if (as === 'fieldset') {
    return (
      <fieldset className="of-field co-field" data-invalid={field.invalid || undefined}>
        {key && <legend className="of-label">{key}</legend>}
        {help}
        <div className="co-value">{children}</div>
        {error}
      </fieldset>
    );
  }
  return (
    <div className="of-field co-field" data-invalid={field.invalid || undefined}>
      <div className="co-inline">
        {key && (
          <label className="of-label" htmlFor={field.id}>
            {key}
          </label>
        )}
        {children}
      </div>
      {help}
      {error}
    </div>
  );
}

function TextInput({ field, type, value, onChange, unit: _unit, ...attrs }: TextInputUIProps) {
  return (
    <span className="co-text">
      <input
        {...field.controlProps}
        {...attrs}
        ref={field.ref}
        className="of-input co-input-line"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </span>
  );
}

function ChoiceGroup({ field, options, multiple, selected, onToggle }: ChoiceGroupUIProps) {
  // Short options (sizes, sugar levels) read as one line: ["M", "L"]
  const inline = options.every((option) => option.label.length <= 6);
  const Item = inline ? 'span' : 'div';
  return (
    <div className={inline ? 'co-tuple' : 'co-arr'}>
      {inline && (
        <span aria-hidden="true">
          <span className="co-key">{field.label}</span>
          <span className="co-p">: [</span>
        </span>
      )}
      {options.map((option, index) => (
        <Item key={option.value} className={inline ? 'co-pick-wrap' : 'co-line'}>
          <label className="co-pick">
            <input
              ref={index === 0 ? field.ref : undefined}
              className="co-input"
              type={multiple ? 'checkbox' : 'radio'}
              name={field.name}
              value={option.value}
              checked={selected.includes(option.value)}
              aria-invalid={field.controlProps['aria-invalid']}
              aria-describedby={field.controlProps['aria-describedby']}
              required={!multiple && field.required}
              onBlur={field.onBlur}
              onChange={(e) => onToggle(option.value, e.target.checked)}
            />
            <span className="co-str">"{option.label}"</span>
          </label>
          {index < options.length - 1 && <span className="co-p">{inline ? ', ' : ','}</span>}
        </Item>
      ))}
      {inline && <span className="co-p">],</span>}
    </div>
  );
}

function Success({ title, children }: SuccessUIProps) {
  return (
    <>
      <h2 className="of-title co-screen-title">{title}</h2>
      {children}
    </>
  );
}

const STATUS: Partial<Record<NoticeUIProps['state'], string>> = {
  'not-found': '404 Not Found',
  closed: '410 Gone',
  'not-open': '425 Too Early',
  full: '503 Service Unavailable',
  duplicate: '409 Conflict',
};

function Notice({ state, title, message }: NoticeUIProps) {
  const tr = useTranslate();
  return (
    <>
      <p className="co-status">HTTP/1.1 {STATUS[state] ?? '410 Gone'}</p>
      <h2 className="of-title co-screen-title">{title}</h2>
      <p className="of-description co-comment">
        {'// '}
        {message}
      </p>
      {state !== 'not-open' && <p className="co-comment">{`// ${tr('櫃台一樣可以點。')}`}</p>}
    </>
  );
}

export default defineTheme({
  font: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, var(--of-cjk), monospace',
  headingFont:
    '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif',
  radius: '0px',
  spacing: 'comfortable',
  width: '760px',
  colors: {
    primary: '#ff7a59',
    primaryForeground: '#140c05',
    background: '#000000',
    surface: '#18120b',
    foreground: '#ffc979',
    muted: '#b08c5c',
    border: '#5e4a30',
    control: '#a08055',
    input: '#18120b',
    error: '#ff6b6b',
    success: '#5fd38a',
  },
  dark: false,
  colorScheme: 'dark',
  components: { Layout, Header, Field, TextInput, ChoiceGroup, Success, Notice },
});
