import type { ComponentPropsWithRef } from "react";

type Variant = "primary" | "secondary" | "quiet" | "danger";
type ButtonProps = ComponentPropsWithRef<"button"> & { variant?: Variant; loading?: boolean };

export function Button({
  variant = "primary", loading = false, disabled, children, className = "", type = "button", ...props
}: ButtonProps) {
  return (
    <button {...props} type={type} className={`button button--${variant} ${className}`}
      disabled={disabled} aria-disabled={loading || undefined} aria-busy={loading || undefined}
      onClick={loading ? (event) => event.preventDefault() : props.onClick}>
      {loading && <span className="button-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function ButtonLink({ variant = "primary", className = "", ...props }:
  ComponentPropsWithRef<"a"> & { variant?: Variant }) {
  return <a tabIndex={0} className={`button button--${variant} ${className}`} {...props} />;
}

export function IconButton({ label, className = "", ...props }: Omit<ButtonProps, "aria-label"> & { label: string }) {
  return <Button variant="quiet" {...props} className={`icon-button ${className}`} aria-label={label} />;
}
