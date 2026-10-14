import { useId, type ComponentProps } from "react";

/** A labelled input. An error replaces the hint and is read out by screen readers. */
export function Field({ label, hint, error, ...input }: ComponentProps<"input"> & { label: string; hint?: string; error?: string }) {
  const id = useId();
  const note = error ?? hint;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={note ? `${id}-note` : undefined} {...input} />
      {note && (
        <p id={`${id}-note`} className={error ? "field-error" : "field-hint"}>
          {note}
        </p>
      )}
    </div>
  );
}
