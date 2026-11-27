import { CalendarDays, Clock3, Dumbbell, Layers3, Volleyball, Waves, Wind } from "lucide-react";
import { Badge } from "../ui/feedback";
import { industries, type IndustrySlug } from "./industry-content";
import { CapacityBadge } from "./previews";
import { faNumber, type SampleSession } from "./sample-data";

export const industryIcons = {
  gyms: Dumbbell,
  "yoga-pilates": Wind,
  academies: Volleyball,
  pools: Waves,
};

function SessionTime({ session }: { session: SampleSession }) {
  return <bdi dir="ltr" className="industry-time">{session.time}{session.end && ` – ${session.end}`}</bdi>;
}

function PoolSchedule() {
  return (
    <ul role="list" className="industry-lanes">
      {industries.pools.days[0].sessions.map((session) => (
        <li key={session.id}>
          <div className="industry-lane-time"><Clock3 size={17} aria-hidden="true" /><SessionTime session={session} /></div>
          <div className="industry-lane-info">
            <strong>{session.title}</strong>
            <span>{faNumber(session.booked)} از {faNumber(session.capacity)} نفر</span>
          </div>
          {session.id === "afternoon"
            ? <Badge tone="warning">ظرفیت محدود · {faNumber(session.capacity - session.booked)} جای خالی</Badge>
            : <CapacityBadge session={session} />}
        </li>
      ))}
    </ul>
  );
}

function StudioCapacity() {
  return (
    <ul role="list" className="industry-seats">
      {[{ booked: 2, label: "ظرفیت موجود" }, { booked: 5, label: "نزدیک به تکمیل" }, { booked: 6, label: "تکمیل ظرفیت" }].map(({ booked, label }) => (
        <li key={label}>
          <div className="industry-seat-caption"><strong>{label}</strong><span>{faNumber(booked)} از ۶ نفر</span></div>
          <div className="industry-seat-dots" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => <span key={index} data-booked={index < booked ? "" : undefined} />)}
          </div>
        </li>
      ))}
    </ul>
  );
}

function AcademyAgenda() {
  return (
    <div className="industry-agenda">
      {industries.academies.days.map((day) => (
        <div key={day.id}>
          <h3 className="industry-agenda-day"><CalendarDays size={19} aria-hidden="true" />{day.date}</h3>
          <ul role="list">
            {day.sessions.map((session) => (
              <li key={session.id}>
                <SessionTime session={session} />
                <strong>{session.title}</strong>
                <CapacityBadge session={session} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function GymRoster() {
  const [training, strength] = industries.gyms.days[0].sessions;
  return (
    <div className="industry-roster">
      <p className="industry-roster-branch"><Layers3 size={18} aria-hidden="true" />شعبهٔ مرکزی <span>· دوشنبه، ۱۰ آذر</span></p>
      <div className="industry-class-highlight">
        <div>
          <SessionTime session={training} />
          <h3>{training.title}</h3>
          <p>مربی تمرین گروهی · سالن یک</p>
        </div>
        <div className="industry-roster-count">
          <strong>{faNumber(training.booked)} از {faNumber(training.capacity)} نفر</strong>
          <CapacityBadge session={training} />
        </div>
      </div>
      <div className="industry-roster-secondary">
        <SessionTime session={strength} />
        <strong>{strength.title}</strong>
        <CapacityBadge session={strength} />
      </div>
    </div>
  );
}

const previews = {
  gyms: GymRoster,
  "yoga-pilates": StudioCapacity,
  academies: AcademyAgenda,
  pools: PoolSchedule,
};

export function IndustryPreview({ slug }: { slug: IndustrySlug }) {
  const Preview = previews[slug];
  return (
    <figure className="industry-preview">
      <figcaption><strong>{industries[slug].previewLabel}</strong><Badge tone="neutral">دادهٔ نمونه</Badge></figcaption>
      <Preview />
    </figure>
  );
}
