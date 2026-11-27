import { ChevronDown } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

export function Accordion({ title, children, contentId, ...props }: ComponentPropsWithoutRef<"details"> & {
  title: ReactNode;
  contentId?: string;
}) {
  return (
    <details {...props} className={`ui-accordion ${props.className ?? ""}`}>
      <summary>{title}<ChevronDown size={16} aria-hidden="true" /></summary>
      <div id={contentId} tabIndex={contentId ? -1 : undefined} className="ui-accordion-content">{children}</div>
    </details>
  );
}
