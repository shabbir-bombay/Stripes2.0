import { useId } from "react";
import { Icon } from "./Icon";

/** A number picked with − and + buttons, for small counts like party size. */
export function Stepper({ label, hint, value, min, max, onChange }: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="stepper" role="group" aria-labelledby={id} aria-describedby={hint ? `${id}-hint` : undefined}>
      <div>
        <div id={id} className="field-label">{label}</div>
        {hint && <div id={`${id}-hint`} className="small">{hint}</div>}
      </div>
      <div className="stepper-controls">
        <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
          <Icon name="minus" small />
        </button>
        <output className="num" aria-live="polite" aria-label={`${value} ${label.toLowerCase()}`}>{value}</output>
        <button type="button" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
          <Icon name="plus" small />
        </button>
      </div>
    </div>
  );
}
