import { FieldShell, useField } from '@open-form-build/core';
import { formatPace, waveFor } from './bib.tsx';

type Props = { name: string; label: string; description?: string };

const SLOWEST = 480;
const FASTEST = 240;

/** Target pace as a slider, slow on the left. Stores seconds per kilometre. */
export function PaceSlider({ name, label, description }: Props) {
  const field = useField({
    name,
    label,
    description,
    type: 'number',
    min: FASTEST,
    max: SLOWEST,
    integer: true,
    defaultValue: 340,
  });
  const pace = typeof field.value === 'number' ? field.value : 340;
  const wave = waveFor(pace);
  const fill = ((SLOWEST - pace) / (SLOWEST - FASTEST)) * 100;
  return (
    <FieldShell field={field}>
      <div className="ml-pace" style={{ '--ml-fill': `${fill}%` } as object}>
        <div className="ml-pace-top">
          <p className="ml-pace-value">
            {formatPace(pace)}
            <small>/ KM</small>
          </p>
          <p className="ml-pace-wave">
            <b>Wave {wave.letter}</b> · starts {wave.start}
          </p>
        </div>
        <input
          {...field.controlProps}
          ref={field.ref}
          type="range"
          min={0}
          max={SLOWEST - FASTEST}
          step={5}
          value={SLOWEST - pace}
          aria-valuetext={`${formatPace(pace)} per km`}
          onChange={(event) => field.setValue(SLOWEST - Number(event.target.value))}
        />
        <div className="ml-pace-ends" aria-hidden="true">
          <span>8:00 easy</span>
          <span>4:00 flying</span>
        </div>
      </div>
    </FieldShell>
  );
}
