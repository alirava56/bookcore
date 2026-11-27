import {
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  MapPin,
  Plus,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Container, Section, SectionHeading } from "../ui/layout";
import { steps } from "./content";
import { faNumber, today } from "./sample-data";

const session = today.sessions[0];

function SetupPreview() {
  return (
    <div
      className="workflow-preview-card workflow-profile"
      aria-label="نمونهٔ ثبت مجموعه"
    >
      <div className="workflow-profile-heading">
        <span className="workflow-preview-icon">
          <Building2 size={18} aria-hidden="true" />
        </span>
        <strong>ثبت مجموعه جدید</strong>
        <span className="workflow-gym-photo" aria-hidden="true" />
      </div>
      <dl className="workflow-fields">
        <div>
          <dt>نام مجموعه</dt>
          <dd>باشگاه ورزشی آرنا</dd>
        </div>
        <div>
          <dt>نوع مجموعه</dt>
          <dd>باشگاه ورزشی</dd>
          <ChevronDown size={14} aria-hidden="true" />
        </div>
        <div>
          <dt>شعبه / موقعیت</dt>
          <dd>
            <MapPin size={14} aria-hidden="true" /> شعبه مرکزی
          </dd>
        </div>
      </dl>
      <span className="workflow-preview-action">
        <Check size={15} aria-hidden="true" />
        ثبت مجموعه
      </span>
    </div>
  );
}

function SchedulePreview() {
  return (
    <div className="workflow-preview-card workflow-session">
      <div className="workflow-session-heading">
        <CalendarDays size={18} aria-hidden="true" />
        <strong>تنظیم جلسه کلاس گروهی</strong>
      </div>
      <dl className="workflow-fields">
        <div>
          <dt>نام کلاس</dt>
          <dd>{session.title}</dd>
        </div>
        <div>
          <dt>زمان برگزاری</dt>
          <dd>
            <CalendarDays size={13} aria-hidden="true" />
            {today.title}، <bdi>{session.time}</bdi>
          </dd>
        </div>
        <div>
          <dt>ظرفیت</dt>
          <dd>
            <UsersRound size={13} aria-hidden="true" />
            {faNumber(session.capacity)} نفر
          </dd>
          <span className="workflow-steppers" aria-hidden="true">
            <ChevronUp size={11} />
            <ChevronDown size={11} />
          </span>
        </div>
      </dl>
      <span className="workflow-preview-action">
        <Plus size={15} aria-hidden="true" />
        افزودن جلسه
      </span>
    </div>
  );
}

function BookingPreview() {
  return (
    <div className="workflow-preview-card workflow-bookings">
      <div className="workflow-confirmation">
        <span className="workflow-preview-icon">
          <Check size={23} aria-hidden="true" />
        </span>
        <div>
          <strong>رزرو با موفقیت ثبت شد</strong>
          <p>
            {session.title}، {today.title} <bdi>{session.time}</bdi>
          </p>
        </div>
      </div>
      <div className="workflow-booking-list">
        <p className="workflow-booking-list-heading">
          <UsersRound size={15} aria-hidden="true" />
          رزروهای این جلسه ({faNumber(session.capacity)} نفر)
        </p>
        {["سارا محمدی", "علی رضایی", "مریم نادری"].map((name) => (
          <div className="workflow-booking-row" key={name}>
            <span className="workflow-member-icon">
              <UserRound size={13} aria-hidden="true" />
            </span>
            <span>{name}</span>
            <span className="workflow-booking-status">ثبت‌شده</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const previews = {
  setup: SetupPreview,
  schedule: SchedulePreview,
  booking: BookingPreview,
};

export function BookingWorkflow() {
  return (
    <Section
      id="how-it-works"
      tabIndex={-1}
      aria-labelledby="how-title"
      className="how-section"
    >
      <Container>
        <span className="workflow-heading-spark" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <SectionHeading
          id="how-title"
          title={
            <>
              از ثبت مجموعه تا <span>دریافت رزرو</span>
            </>
          }
          description="مسیر نمونه یک کلاس گروهی را از راه‌اندازی تا دریافت رزروها دنبال کنید."
        />
        <ol className="workflow-grid" role="list">
          {steps.map(({ id, title, description, number }) => {
            const Preview = previews[id];
            return (
              <li key={id} className={`workflow-card workflow-card--${id}`}>
                <div className="workflow-card-copy">
                  <div className="workflow-index">
                    <span className="workflow-step-number" aria-hidden="true">
                      {number}
                    </span>
                    <span className="workflow-step-label">مرحله {number}</span>
                  </div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
                <div className="workflow-visual">
                  <Preview />
                </div>
                {id !== "booking" && (
                  <span className="workflow-connector" aria-hidden="true">
                    <ChevronLeft size={20} />
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </Container>
    </Section>
  );
}
