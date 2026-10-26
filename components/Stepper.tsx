import { useId } from "react";

/** A number picked with − and + buttons, for small counts like party size. */
export function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  const id = useId();
  return (
    <div className="field">
      <span id={id} className="field-label">
        {label}
      </span>
      <div className="stepper" role="group" aria-labelledby={id}>
        <button type="button" className="button secondary" aria-label={`Fewer: ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
          −
        </button>
        <output aria-live="polite">{value}</output>
        <button type="button" className="button secondary" aria-label={`More: ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
          +
        </button>
      </div>
      <p className="field-hint">Up to {max}, including you</p>
    </div>
  );
}
