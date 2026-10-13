import { FieldShell, useField, useTranslate } from '@open-form-build/core';
import { TIERS } from './pricing.ts';

export const AVATARS = [
  { value: '🦊', label: 'Fox' },
  { value: '🐙', label: 'Octopus' },
  { value: '🦄', label: 'Unicorn' },
  { value: '🐼', label: 'Panda' },
  { value: '🤖', label: 'Robot' },
  { value: '👾', label: 'Alien' },
  { value: '🐸', label: 'Frog' },
  { value: '🦉', label: 'Owl' },
  { value: '🐳', label: 'Whale' },
  { value: '🌵', label: 'Cactus' },
  { value: '🍄', label: 'Mushroom' },
  { value: '⚡️', label: 'Lightning' },
];

export const COLORS = [
  { value: 'lime', label: 'Lime', gradient: 'linear-gradient(135deg, #c8ff3d, #3dffb4)' },
  { value: 'aqua', label: 'Aqua', gradient: 'linear-gradient(135deg, #5ee7ff, #6d7cff)' },
  { value: 'violet', label: 'Violet', gradient: 'linear-gradient(135deg, #b18cff, #ff6bd6)' },
  { value: 'sunset', label: 'Sunset', gradient: 'linear-gradient(135deg, #ffb347, #ff5f6d)' },
  { value: 'rose', label: 'Rose', gradient: 'linear-gradient(135deg, #ffd1dc, #ff7aa8)' },
  { value: 'mono', label: 'Mono', gradient: 'linear-gradient(135deg, #f3f3f7, #9a9ab0)' },
];

type PickerProps = { name: string; label: string; description?: string };

/** Big emoji tiles backed by real radio inputs: keyboard, screen readers and focus all work. */
export function AvatarPicker({ name, label, description }: PickerProps) {
  const field = useField({
    name,
    label,
    description,
    type: 'select',
    required: true,
    options: AVATARS,
  });
  const tr = useTranslate();
  return (
    <FieldShell field={field} as="fieldset">
      <div className="pass-avatars">
        {AVATARS.map((avatar, index) => (
          <label key={avatar.value} className="pass-tile pass-avatar" title={tr(avatar.label)}>
            <input
              ref={index === 0 ? field.ref : undefined}
              type="radio"
              className="pass-sr-only"
              name={field.name}
              value={avatar.value}
              checked={field.value === avatar.value}
              aria-describedby={field.controlProps['aria-describedby']}
              onChange={() => field.setValue(avatar.value)}
              onBlur={field.onBlur}
            />
            <span aria-hidden="true">{avatar.value}</span>
            <span className="pass-sr-only">{tr(avatar.label)}</span>
          </label>
        ))}
      </div>
    </FieldShell>
  );
}

export function ColorPicker({ name, label, description }: PickerProps) {
  const field = useField({
    name,
    label,
    description,
    type: 'select',
    required: true,
    options: COLORS,
  });
  const tr = useTranslate();
  return (
    <FieldShell field={field} as="fieldset">
      <div className="pass-swatches">
        {COLORS.map((color, index) => (
          <label key={color.value} className="pass-swatch">
            <input
              ref={index === 0 ? field.ref : undefined}
              type="radio"
              className="pass-sr-only"
              name={field.name}
              value={color.value}
              checked={field.value === color.value}
              aria-describedby={field.controlProps['aria-describedby']}
              onChange={() => field.setValue(color.value)}
              onBlur={field.onBlur}
            />
            <span className="pass-swatch-dot" style={{ background: color.gradient }} />
            <span className="pass-swatch-label">{tr(color.label)}</span>
          </label>
        ))}
      </div>
    </FieldShell>
  );
}

export function TierPicker({ name, label }: PickerProps) {
  const field = useField({
    name,
    label,
    type: 'select',
    required: true,
    options: TIERS.map((t) => ({ value: t.id, label: t.name })),
  });
  const tr = useTranslate();
  return (
    <FieldShell field={field} as="fieldset">
      <div className="pass-tiers">
        {TIERS.map((tier, index) => (
          <label key={tier.id} className="pass-tile pass-tier">
            <input
              ref={index === 0 ? field.ref : undefined}
              type="radio"
              className="pass-sr-only"
              name={field.name}
              value={tier.id}
              checked={field.value === tier.id}
              aria-describedby={field.controlProps['aria-describedby']}
              onChange={() => field.setValue(tier.id)}
              onBlur={field.onBlur}
            />
            <span className="pass-tier-head">
              <span className="pass-tier-name">{tr(tier.name)}</span>
              {'popular' in tier && <span className="pass-tier-badge">{tr('Popular')}</span>}
            </span>
            <span className="pass-tier-price">
              {tier.price === 0 ? tr('Free') : `$${tier.price}`}
            </span>
            <span className="pass-tier-perks">
              {tier.perks.map((perk) => (
                <span key={perk}>{tr(perk)}</span>
              ))}
            </span>
          </label>
        ))}
      </div>
    </FieldShell>
  );
}

const DEPTH_CAPTIONS: Array<[number, string]> = [
  [0, 'What’s an agent?'],
  [20, 'Curious'],
  [40, 'Tinkering on weekends'],
  [60, 'Building one at work'],
  [80, 'Shipping agents to prod'],
  [100, 'My agents have agents'],
];

/** A range slider stored as a number, with a caption that follows the value. */
export function DepthSlider({ name, label }: PickerProps) {
  const field = useField({
    name,
    label,
    type: 'number',
    min: 0,
    max: 100,
    integer: true,
    defaultValue: 40,
  });
  const tr = useTranslate();
  const value = Number(field.value ?? 40);
  const found = DEPTH_CAPTIONS.filter(([min]) => value >= min).at(-1)?.[1];
  const caption = found && tr(found);
  return (
    <FieldShell field={field}>
      <div className="pass-slider" style={{ '--pass-fill': `${value}%` } as object}>
        <input
          {...field.controlProps}
          ref={field.ref}
          type="range"
          min={0}
          max={100}
          step={10}
          value={value}
          aria-valuetext={caption}
          onChange={(e) => field.setValue(Number(e.target.value))}
        />
        <output htmlFor={field.id} className="pass-slider-caption">
          <span>{caption}</span>
          <span className="pass-slider-value">{value}</span>
        </output>
      </div>
    </FieldShell>
  );
}
