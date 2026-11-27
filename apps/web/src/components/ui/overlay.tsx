"use client";

import { XIcon as X } from "@phosphor-icons/react/dist/ssr/X";
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
    ref?: RefObject<HTMLButtonElement | null>;
  };
  title: string;
  heading?: ReactNode;
  children: ReactNode;
};

export function showDialog(dialog: HTMLDialogElement | null) {
  if (!dialog || dialog.open) return;
  dialog.showModal();
  dialog.querySelector<HTMLButtonElement>("[data-dialog-close]")?.focus({ preventScroll: true });
}

function Overlay({ id, dialogRef, onClose, trigger, title, heading, children, drawer = false }: OverlayProps & { drawer?: boolean }) {
  const generatedId = useId();
  const dialogId = id ?? generatedId;
  const internalDialog = useRef<HTMLDialogElement>(null);
  const dialog = dialogRef ?? internalDialog;
  const pointerStartedOutside = useRef(false);
  const open = () => {
    if (drawer) trigger?.ref?.current?.focus({ preventScroll: true });
    if (!dialog.current?.open) dialog.current?.removeAttribute("data-closing");
    showDialog(dialog.current);
  };
  const close = () => {
    const panel = dialog.current;
    if (!panel?.open || panel.hasAttribute("data-closing")) return;
    if (!drawer) {
      panel.close();
      return;
    }
    panel.setAttribute("data-closing", "");
    const motion = panel.getAnimations();
    if (motion.length === 0) panel.close();
    else void Promise.allSettled(motion.map((animation) => animation.finished)).then(() => {
      if (panel.open && panel.hasAttribute("data-closing")) panel.close();
    });
  };
  const triggerProps = {
    ref: trigger?.ref, onClick: open, "aria-haspopup": "dialog" as const, "aria-controls": dialogId, className: trigger?.className,
  };

  return (
    <>
      {trigger && (trigger.iconOnly ? (
        <IconButton {...triggerProps} label={trigger.label}>{trigger.icon}</IconButton>
      ) : (
        <Button {...triggerProps} variant={trigger.variant}>{trigger.icon}{trigger.label}</Button>
      ))}
      <dialog ref={dialog} id={dialogId} aria-labelledby={`${dialogId}-title`}
        onClose={(event) => {
          event.currentTarget.removeAttribute("data-closing");
          onClose?.();
        }}
        onCancel={(event) => {
          if (drawer) {
            event.preventDefault();
            close();
          }
        }}
        className={drawer ? "ui-overlay ui-drawer" : "ui-overlay"}
        onPointerDown={(event) => { pointerStartedOutside.current = event.target === event.currentTarget; }}
        onClick={(event) => {
          const backdropClick = event.target === event.currentTarget && pointerStartedOutside.current;
          const drawerLink = drawer && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
            && event.target instanceof Element
            && event.target.closest("a[data-close-drawer]");
          if (drawerLink) dialog.current?.close();
          if (backdropClick) close();
        }}>
        <div className="ui-overlay-inner">
          <header className="ui-overlay-heading">
            <h2 className={heading ? "sr-only" : undefined} id={`${dialogId}-title`}>{title}</h2>
            {heading}
            <IconButton label="بستن" data-dialog-close onClick={close}><X weight="fill" size={22} aria-hidden="true" /></IconButton>
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
