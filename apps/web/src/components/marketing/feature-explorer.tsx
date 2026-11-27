"use client";

import { useEffect, useState } from "react";
import { Building2, CalendarCheck2, Clock3, Dumbbell, UsersRound, Waves } from "lucide-react";
import { Badge } from "../ui/feedback";
import { features } from "./content";
import { CapacityBadge } from "./previews";
import { faNumber, sampleDays, today } from "./sample-data";
import { DemoButton } from "./demo";

type FeatureId = (typeof features)[number]["id"];

const views = {
  booking: { title: "برنامهٔ جلسات", subtitle: "دو روز از برنامهٔ نمونه" },
  branches: { title: "شعبه‌های مجموعه", subtitle: "نمای مدیریت شعبه‌ها" },
  team: { title: "اعضا و منابع", subtitle: "نمای مدیریت مجموعه" },
  reports: { title: "ظرفیت جلسه‌ها", subtitle: today.date },
} satisfies Record<FeatureId, { title: string; subtitle: string }>;

const branches = [
  { title: "شعبهٔ مرکزی", description: "سالن تمرین و کلاس‌های گروهی", icon: Building2, tone: "violet" },
  { title: "شعبهٔ غرب", description: "استخر و سانس‌های آزاد", icon: Waves, tone: "blue" },
] as const;

const members = [
  { title: "مدیر مجموعه", description: "مدیریت برنامه و شعبه‌ها", icon: UsersRound, tone: "violet" },
  { title: "مربی تمرین", description: "همکار مجموعه", icon: Dumbbell, tone: "peach" },
  { title: "سالن تمرین", description: "منبع قابل تخصیص به جلسه", icon: Building2, tone: "blue" },
] as const;

function ScheduleCalendar() {
  const [selectedId, setSelectedId] = useState<string>(today.sessions[0].id);
  const selectedDay = sampleDays.find((day) => day.sessions.some((session) => session.id === selectedId)) ?? today;
  const selected = selectedDay.sessions.find((session) => session.id === selectedId) ?? today.sessions[0];
  return (
    <div className="calendar-preview">
      <div className="calendar-board" aria-label="برنامهٔ دو روز نمونه">
        {sampleDays.map((day) => (
          <div className="calendar-day" key={day.id}>
            <h4>{day.date}</h4>
            <div className="calendar-track">
              {day.sessions.map((session, index) => {
                return (
                  <button type="button" key={session.id}
                    className={`calendar-event calendar-event--${["violet", "blue", "peach"][index]}`}
                    aria-pressed={selectedId === session.id} aria-controls="calendar-selection"
                    onClick={() => setSelectedId(session.id)}>
                    <bdi>{session.time}</bdi><strong>{session.title}</strong>
                    <span>{session.booked === session.capacity ? "ظرفیت تکمیل" : faNumber(session.capacity - session.booked) + " جای خالی"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <aside id="calendar-selection" className="calendar-selection" aria-live="polite" aria-label="جزئیات جلسهٔ انتخاب‌شده">
        <span className="workbench-icon"><CalendarCheck2 size={22} aria-hidden="true" /></span>
        <p>جلسهٔ انتخاب‌شده</p>
        <h4>{selected.title}</h4>
        <span>{selectedDay.date}</span>
        <span className="calendar-selection-time"><Clock3 size={15} aria-hidden="true" /><bdi>{selected.time}</bdi></span>
        <CapacityBadge session={selected} />
        <progress max={selected.capacity} value={selected.booked} aria-label={`ظرفیت ${selected.title}`} />
        <span>{faNumber(selected.booked)} رزرو از {faNumber(selected.capacity)} نفر</span>
        <DemoButton compact />
      </aside>
    </div>
  );
}

function WorkspaceRows({ view }: { view: "branches" | "team" }) {
  const rows = view === "branches" ? branches : members;
  return (
    <ul className="workbench-rows" role="list">
      {rows.map(({ title, description, icon: Icon, tone }) => (
        <li key={title}>
          <span className={`workbench-icon workbench-icon--${tone}`}><Icon size={19} aria-hidden="true" /></span>
          <div className="workbench-row-copy"><strong>{title}</strong><span>{description}</span></div>
        </li>
      ))}
    </ul>
  );
}

function CapacityReport() {
  const booked = today.sessions.reduce((sum, session) => sum + session.booked, 0);
  const capacity = today.sessions.reduce((sum, session) => sum + session.capacity, 0);
  return (
    <div className="capacity-dashboard">
      <dl className="capacity-summary">
        <div><dt>رزرو ثبت‌شده</dt><dd>{faNumber(booked)} <span>نفر</span></dd></div>
        <div><dt>ظرفیت باقی‌مانده</dt><dd>{faNumber(capacity - booked)} <span>نفر</span></dd></div>
        <div><dt>جلسات برنامه</dt><dd>{faNumber(today.sessions.length)} <span>جلسه</span></dd></div>
      </dl>
      <div className="capacity-chart-heading"><h4>میزان پرشدن جلسات</h4><span>رزرو / ظرفیت کل</span></div>
    <ul className="workbench-report" role="list">
      {today.sessions.map(({ id, title, capacity, booked }) => (
        <li key={id}>
          <div><strong>{title}</strong><span>{faNumber(booked)} از {faNumber(capacity)} نفر · {faNumber(Math.round(booked / capacity * 100))}٪</span></div>
          <progress max={capacity} value={booked} aria-label={`ظرفیت ${title}`} />
          <span className="capacity-availability">{booked === capacity ? "ظرفیت تکمیل شده" : faNumber(capacity - booked) + " نفر ظرفیت باقی‌مانده"}</span>
        </li>
      ))}
    </ul>
    </div>
  );
}

export function FeatureExplorer() {
  const [active, setActive] = useState<FeatureId>("booking");

  useEffect(() => {
    const selectFragment = () => {
      const id = window.location.hash.slice(1);
      const match = features.find((feature) => feature.id === id);
      if (match) setActive(match.id);
    };

    selectFragment();
    window.addEventListener("hashchange", selectFragment);
    return () => window.removeEventListener("hashchange", selectFragment);
  }, []);

  const { title, subtitle } = views[active];
  return (
    <div className="feature-explorer">
      <div className="feature-switcher" role="group" aria-label="انتخاب نمای محصول">
        {features.map(({ id, icon: Icon, title, description }) => (
          <button key={id} id={id} type="button" className="feature-option" aria-pressed={active === id}
            aria-controls="feature-preview"
            onClick={() => {
              window.history.replaceState(null, "", "#" + id);
              setActive(id);
            }}>
            <span className="feature-option-icon"><Icon size={21} aria-hidden="true" /></span>
            <span className="feature-option-copy"><strong>{title}</strong><span>{description}</span></span>
          </button>
        ))}
      </div>
      <div className="product-stage">
        <section id="feature-preview" className="workbench" aria-labelledby="preview-title">
          <div className="workbench-header">
            <span><CalendarCheck2 size={19} aria-hidden="true" /> وقتیمو</span>
            <span className="workbench-context"><Building2 size={15} aria-hidden="true" /> مجموعهٔ ورزشی<Badge tone="info">دادهٔ نمونه</Badge></span>
          </div>
          <div className="workbench-body">
            <div className="workbench-intro">
              <h3 id="preview-title" aria-live="polite">{title}</h3>
              <p>{subtitle}</p>
            </div>
            {active === "booking" ? <ScheduleCalendar /> : active === "reports" ? <CapacityReport /> : <WorkspaceRows view={active} />}
          </div>
        </section>
      </div>
    </div>
  );
}
