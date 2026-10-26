import { useId, type ComponentProps, type ReactNode } from "react";

type Labels = { label: string; hint?: string; error?: string };

/** A labelled input. An error replaces the hint and is read out by screen readers. */
export function Field({ label, hint, error, ...input }: ComponentProps<"input"> & Labels) {
  return <Labelled label={label} hint={hint} error={error}>{(props) => <input {...props} {...input} />}</Labelled>;
}

/** A labelled drop-down, with the same hint and error as Field. */
export function SelectField({ label, hint, error, ...select }: ComponentProps<"select"> & Labels) {
  return <Labelled label={label} hint={hint} error={error}>{(props) => <select {...props} {...select} />}</Labelled>;
}

type ControlProps = { id: string; "aria-invalid"?: true; "aria-describedby"?: string };

function Labelled({ label, hint, error, children }: Labels & { children: (props: ControlProps) => ReactNode }) {
  const id = useId();
  const note = error ?? hint;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": note ? `${id}-note` : undefined })}
      {note && (
        <p id={`${id}-note`} className={error ? "field-error" : "field-hint"}>
          {note}
        </p>
      )}
    </div>
  );
}
