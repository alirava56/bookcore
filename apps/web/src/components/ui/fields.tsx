"use client";

import { ChevronDown } from "lucide-react";
import { useId, type ComponentPropsWithRef, type ReactNode } from "react";

type FieldDetails = { label: string; hint?: string; error?: string; loading?: boolean };

function useField({ id, hint, error, loading, describedBy }: {
  id?: string; hint?: string; error?: string; loading?: boolean; describedBy?: string;
}) {
  const generated = useId();
  const fieldId = id ?? generated;

  return {
    id: fieldId,
    "aria-describedby": [describedBy, hint && `${fieldId}-hint`, error && `${fieldId}-error`].filter(Boolean).join(" ") || undefined,
    "aria-invalid": error ? true : undefined,
    "aria-busy": loading || undefined,
  };
}

function Field({ id, label, hint, error, loading, children, choice = false }: FieldDetails & {
  id: string; children: ReactNode; choice?: boolean;
}) {
  return (
    <div className="ui-field">
      {choice ? <label className="ui-choice" htmlFor={id}>{children}<span>{label}</span></label> : (
        <><label htmlFor={id}>{label}</label>{children}</>
      )}
      {hint && <p id={`${id}-hint`} className="ui-field-hint">{hint}</p>}
      {error && <p id={`${id}-error`} className="ui-field-error">{error}</p>}
      {loading && <p role="status" className="ui-field-hint">در حال بارگذاری…</p>}
    </div>
  );
}

type FieldProps<Tag extends "input" | "textarea" | "select"> = FieldDetails
  & Omit<ComponentPropsWithRef<Tag>, "aria-invalid" | "aria-busy">;

export function Input({ label, hint, error, loading, id, disabled, "aria-describedby": describedBy, ...props }: FieldProps<"input">) {
  const control = useField({ id, hint, error, loading, describedBy });
  return <Field {...{ label, hint, error, loading }} id={control.id}>
    <input {...props} {...control} disabled={disabled || loading} />
  </Field>;
}

export function Textarea({ label, hint, error, loading, id, disabled, "aria-describedby": describedBy, ...props }: FieldProps<"textarea">) {
  const control = useField({ id, hint, error, loading, describedBy });
  return <Field {...{ label, hint, error, loading }} id={control.id}>
    <textarea {...props} {...control} disabled={disabled || loading} />
  </Field>;
}

export function Select({ label, hint, error, loading, id, disabled, "aria-describedby": describedBy, children, ...props }: FieldProps<"select">) {
  const control = useField({ id, hint, error, loading, describedBy });
  return <Field {...{ label, hint, error, loading }} id={control.id}>
    <div className="ui-select">
      <select {...props} {...control} disabled={disabled || loading}>{children}</select>
      {!props.multiple && (!props.size || props.size === 1) && <ChevronDown size={18} aria-hidden="true" />}
    </div>
  </Field>;
}

type ChoiceProps = Omit<FieldProps<"input">, "type" | "role">;

function Choice({ type, label, hint, error, loading, id, disabled, "aria-describedby": describedBy, ...props }:
  ChoiceProps & { type: "radio" | "checkbox" | "switch" }) {
  const control = useField({ id, hint, error, loading, describedBy });
  return (
    <Field {...{ label, hint, error, loading }} id={control.id} choice>
      <input {...props} {...control} type={type === "radio" ? "radio" : "checkbox"}
        role={type === "switch" ? "switch" : undefined} disabled={disabled || loading} />
    </Field>
  );
}

export function Checkbox(props: ChoiceProps) { return <Choice type="checkbox" {...props} />; }
export function Radio(props: ChoiceProps) { return <Choice type="radio" {...props} />; }
export function Switch(props: ChoiceProps) { return <Choice type="switch" {...props} />; }
