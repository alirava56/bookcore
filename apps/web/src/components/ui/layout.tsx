import type { ComponentPropsWithoutRef, ReactNode } from "react";

type ElementProps<Tag extends "div" | "section"> = ComponentPropsWithoutRef<Tag>;

export function Container({ className = "", ...props }: ElementProps<"div">) {
  return <div className={`container-shell ${className}`} {...props} />;
}

export function Section({ className = "", ...props }: ElementProps<"section">) {
  return <section className={`section ${className}`} {...props} />;
}

export function SectionHeading({ title, description, id }: {
  title: ReactNode;
  description?: string;
  id: string;
}) {
  return (
    <div className="section-heading">
      <h2 id={id}>{title}</h2>
      {description && <p className="section-description">{description}</p>}
    </div>
  );
}

