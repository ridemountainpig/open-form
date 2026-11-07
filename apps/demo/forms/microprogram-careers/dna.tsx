import {
  type ChoiceGroupUIProps,
  defaultComponents,
  type FieldOption,
  useFieldValue,
} from '@open-form-build/core';

// The four core competencies from the careers page, drawn around the DNA ring.
// Each option keeps a native radio; the ring quadrant of the chosen one turns red.

export const competencies: FieldOption[] = [
  { value: 'customer', label: '客戶導向' },
  { value: 'positive', label: '正向思考' },
  { value: 'innovation', label: '創新能力' },
  { value: 'communication', label: '溝通協調' },
];

const blurbs: Record<string, string> = {
  customer: '傾聽需求、洞察趨勢，與客戶建立長期信任。',
  positive: '以樂觀迎接變化，在挑戰中學習與突破。',
  innovation: '提出新想法並動手實踐，把創意變成行動。',
  communication: '重視傾聽與表達，讓合作有溫度也有效率。',
};

function Icon({ value }: { value: string }) {
  const common = {
    width: 26,
    height: 26,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (value === 'customer')
    return (
      <svg {...common} aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      </svg>
    );
  if (value === 'positive')
    return (
      <svg {...common} aria-hidden="true">
        <path d="M12 20V5M6 11l6-6 6 6" />
        <path d="M4 20h16" />
      </svg>
    );
  if (value === 'innovation')
    return (
      <svg {...common} aria-hidden="true">
        <path d="M9 18h6M10 21h4" />
        <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" />
      </svg>
    );
  return (
    <svg {...common} aria-hidden="true">
      <path d="M3 5h11v7H8l-3 3v-3H3z" />
      <path d="M17 9h4v7h-2v3l-3-3h-5v-2" />
    </svg>
  );
}

function Ring({ chosen, small }: { chosen?: string; small?: boolean }) {
  const index = competencies.findIndex((c) => c.value === chosen);
  return (
    <div
      className={small ? 'mp-ring mp-ring-small' : 'mp-ring'}
      data-chosen={index >= 0 ? index : undefined}
      aria-hidden="true"
    >
      <span className="mp-ring-core">DNA</span>
    </div>
  );
}

export function DnaChoice(props: ChoiceGroupUIProps) {
  if (props.field.name !== 'coreStrength') return <defaultComponents.ChoiceGroup {...props} />;
  const { field, options, selected, onToggle } = props;
  return (
    <div className="mp-dna">
      <Ring chosen={selected[0]} />
      {options.map((option, index) => (
        <label
          key={option.value}
          className="mp-dna-opt"
          data-slot={index}
          data-checked={selected.includes(option.value) || undefined}
        >
          <input
            ref={index === 0 ? field.ref : undefined}
            type="radio"
            className="mp-dna-input"
            name={field.name}
            value={option.value}
            checked={selected.includes(option.value)}
            aria-invalid={field.controlProps['aria-invalid']}
            aria-describedby={field.controlProps['aria-describedby']}
            onBlur={field.onBlur}
            onChange={(e) => onToggle(option.value, e.target.checked)}
          />
          <span className="mp-dna-icon">
            <Icon value={option.value} />
          </span>
          <span className="mp-dna-text">
            <span className="mp-dna-title">{option.label}</span>
            <span className="mp-dna-blurb">{blurbs[option.value]}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export function DnaEcho() {
  const name = useFieldValue<string>('name');
  const strength = useFieldValue<string>('coreStrength');
  const chosen = competencies.find((c) => c.value === strength);
  return (
    <div className="mp-echo">
      <Ring chosen={strength} small />
      <div>
        <p className="mp-echo-lead">
          {name ? `${name}，謝謝你想加入微程式。` : '謝謝你想加入微程式。'}
        </p>
        {chosen && (
          <p>
            你帶來的核心職能：<strong>{chosen.label}</strong>
          </p>
        )}
        <p>我們會在兩週內完成評估，若合適將主動與你聯絡。</p>
      </div>
    </div>
  );
}
