import { CheckCircleIcon as CheckCircle2 } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { WarningCircleIcon as CircleAlert } from "@phosphor-icons/react/dist/ssr/WarningCircle";
import { InfoIcon as Info } from "@phosphor-icons/react/dist/ssr/Info";
import { WarningIcon as TriangleAlert } from "@phosphor-icons/react/dist/ssr/Warning";
import type { ReactNode } from "react";

type Tone = "neutral" | "info" | "success" | "warning" | "error";
const alertIcons = { neutral: Info, info: Info, success: CheckCircle2, warning: TriangleAlert, error: CircleAlert };

export function Badge({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`ui-badge tone-${tone}`}>{children}</span>;
}

export function Alert({ tone = "info", children, live = false }: { tone?: Tone; children: ReactNode; live?: boolean }) {
  const Icon = alertIcons[tone];
  return (
    <div className={`ui-alert tone-${tone}`} role={live ? (tone === "error" ? "alert" : "status") : undefined}>
      <Icon weight="fill" size={19} className="shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="ui-empty"><Info weight="fill" size={19} aria-hidden="true" />{children}</p>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`ui-skeleton ${className}`} aria-hidden="true" />;
}
