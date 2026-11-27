"use client";

import { useId, useState, type ReactNode } from "react";

export function Tooltip({ content, children }: {
  content: string;
  children: (descriptionId: string) => ReactNode;
}) {
  const id = useId();
  const [dismissed, setDismissed] = useState(false);

  return (
    <span className="ui-tooltip" data-dismissed={dismissed}
      onPointerEnter={() => setDismissed(false)}
      onFocus={() => setDismissed(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !dismissed) {
          event.stopPropagation();
          setDismissed(true);
        }
      }}>
      {children(id)}
      <span id={id} role="tooltip" className="ui-tooltip-content">{content}</span>
    </span>
  );
}
