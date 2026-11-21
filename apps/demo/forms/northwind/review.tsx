import { T, useFormValues } from '@open-form-build/core';

const ROWS: Array<[label: string, keys: string[]]> = [
  ['Name', ['firstName', 'lastName']],
  ['Email', ['email']],
  ['Based in', ['city']],
  ['Current role', ['currentTitle', 'currentCompany']],
  ['Earliest start', ['startDate']],
  ['Portfolio', ['portfolio']],
];

/** The last step's summary: the answers a recruiter reads first, straight from the form. */
export function Review() {
  const values = useFormValues();
  return (
    <dl className="nw-review">
      {ROWS.map(([label, keys]) => {
        const text = keys
          .map((key) => values[key])
          .filter((value) => typeof value === 'string' && value)
          .join(keys[0] === 'currentTitle' ? ', ' : ' ');
        return (
          <div key={label}>
            <dt>
              <T>{label}</T>
            </dt>
            <dd>{text || '—'}</dd>
          </div>
        );
      })}
    </dl>
  );
}
