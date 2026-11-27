"use client";

import { CalendarDays, Check, Play } from "lucide-react";
import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { Button } from "../ui/buttons";
import { EmptyState } from "../ui/feedback";
import { Dialog, showDialog } from "../ui/overlay";
import { CapacityBadge } from "./previews";
import { faNumber, sampleDays, type SampleSession } from "./sample-data";

const demoId = "vaghtimo-product-demo";
const DemoContext = createContext<(trigger: HTMLButtonElement) => void>(() => undefined);

function DemoSchedule() {
  const [dayId, setDayId] = useState<(typeof sampleDays)[number]["id"]>(sampleDays[0].id);
  const [selected, setSelected] = useState<SampleSession>();
  const day = sampleDays.find((entry) => entry.id === dayId) ?? sampleDays[0];

  return (
    <div className="demo-schedule">
      <p className="demo-intro">با دادهٔ نمایشی، یک جلسه و وضعیت ظرفیتش را ببینید. این دمو رزروی ثبت نمی‌کند.</p>
      <div className="demo-days" role="group" aria-label="روز برنامهٔ نمونه">
        {sampleDays.map(({ id, title }) => (
          <Button key={id} variant="secondary" aria-pressed={id === dayId} onClick={() => {
            setDayId(id);
            setSelected(undefined);
          }}>{title}</Button>
        ))}
      </div>
      <ul className="demo-sessions" aria-label={`جلسات ${day.title}`}>
        {day.sessions.map((session) => {
          const available = session.capacity - session.booked;
          return (
            <li key={session.id}>
              <Button variant="secondary" aria-pressed={selected?.id === session.id} disabled={available === 0}
                onClick={() => setSelected(session)}>
                <bdi>{session.time}</bdi>
                <strong>{session.title}</strong>
                <CapacityBadge session={session} />
              </Button>
            </li>
          );
        })}
      </ul>
      <div className="demo-selection" aria-live="polite">
        {selected ? (
          <div className="demo-detail">
            <span className="dashboard-check"><Check size={19} aria-hidden="true" /></span>
            <div>
              <strong>پیش‌نمایش رزرو {selected.title}</strong>
              <p>{day.date}، ساعت <bdi>{selected.time}</bdi> · {faNumber(selected.capacity - selected.booked)} جای خالی</p>
            </div>
          </div>
        ) : <EmptyState>برای دیدن جزئیات، یک جلسهٔ دارای ظرفیت را انتخاب کنید.</EmptyState>}
      </div>
    </div>
  );
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <DemoContext.Provider value={(button) => {
      trigger.current = button;
      setOpen(true);
      showDialog(dialog.current);
    }}>
      {children}
      <Dialog id={demoId} title="دموی وقتیمو" dialogRef={dialog} onClose={() => {
        setOpen(false);
        trigger.current?.focus({ preventScroll: true });
      }}>
        {open && <DemoSchedule />}
      </Dialog>
    </DemoContext.Provider>
  );
}

export function DemoButton({ inverted = false, compact = false, showIcon = true, className = "", children }: {
  inverted?: boolean;
  compact?: boolean;
  showIcon?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const open = useContext(DemoContext);
  const Icon = inverted ? CalendarDays : Play;
  return (
    <Button variant={inverted ? "secondary" : "primary"} className={`${compact ? "button-compact" : ""} ${className}`}
      onClick={(event) => open(event.currentTarget)} aria-haspopup="dialog" aria-controls={demoId}>
      {showIcon && <Icon size={17} aria-hidden="true" />}{children ?? "مشاهده دمو"}
    </Button>
  );
}
