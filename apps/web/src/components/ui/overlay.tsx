"use client";

import { X } from "lucide-react";
import { useId, useRef, type ReactNode, type RefObject } from "react";
import { Button, IconButton } from "./buttons";

type OverlayProps = {
  id?: string;
  dialogRef?: RefObject<HTMLDialogElement | null>;
  onClose?: () => void;
  trigger?: {
    label: string;
    icon?: ReactNode;
    iconOnly?: boolean;
    variant?: "primary" | "secondary" | "quiet";
    className?: string;
  };
  title: string;
  children: ReactNode;
};

export function showDialog(dialog: HTMLDialogElement | null) {
  if (!dialog || dialog.open) return;
  dialog.showModal();
  dialog.querySelector<HTMLButtonElement>("[data-dialog-close]")?.focus({ preventScroll: true });
}

function Overlay({ id, dialogRef, onClose, trigger, title, children, drawer = false }: OverlayProps & { drawer?: boolean }) {
  const generatedId = useId();
  const dialogId = id ?? generatedId;
  const internalDialog = useRef<HTMLDialogElement>(null);
  const dialog = dialogRef ?? internalDialog;
  const pointerStartedOutside = useRef(false);
  const open = () => showDialog(dialog.current);
  const close = () => dialog.current?.close();
  const triggerProps = {
    onClick: open, "aria-haspopup": "dialog" as const, "aria-controls": dialogId, className: trigger?.className,
  };

  return (
    <>
      {trigger && (trigger.iconOnly ? (
        <IconButton {...triggerProps} label={trigger.label}>{trigger.icon}</IconButton>
      ) : (
        <Button {...triggerProps} variant={trigger.variant}>{trigger.icon}{trigger.label}</Button>
      ))}
      <dialog ref={dialog} id={dialogId} aria-labelledby={`${dialogId}-title`} onClose={onClose}
        className={drawer ? "ui-overlay ui-drawer" : "ui-overlay"}
        onPointerDown={(event) => { pointerStartedOutside.current = event.target === event.currentTarget; }}
        onClick={(event) => {
          const backdropClick = event.target === event.currentTarget && pointerStartedOutside.current;
          const drawerLink = drawer && !event.defaultPrevented && event.target instanceof Element
            && event.target.closest("a[data-close-drawer]");
          if (backdropClick || drawerLink) close();
        }}>
        <div className="ui-overlay-inner">
          <header className="ui-overlay-heading">
            <h2 id={`${dialogId}-title`}>{title}</h2>
            <IconButton label="بستن" data-dialog-close onClick={close}><X size={22} aria-hidden="true" /></IconButton>
          </header>
          {children}
        </div>
      </dialog>
    </>
  );
}

export function Dialog(props: OverlayProps) { return <Overlay {...props} />; }
export function Drawer(props: OverlayProps & { trigger: NonNullable<OverlayProps["trigger"]> }) {
  return <Overlay {...props} drawer />;
}
