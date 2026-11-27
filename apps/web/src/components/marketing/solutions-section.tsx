import Image from "next/image";
import Link from "next/link";
import { ArrowLeftIcon as ArrowLeft } from "@phosphor-icons/react/dist/ssr/ArrowLeft";
import { CalendarDotsIcon as CalendarDays } from "@phosphor-icons/react/dist/ssr/CalendarDots";
import { CaretLeftIcon as ChevronLeft } from "@phosphor-icons/react/dist/ssr/CaretLeft";
import { ButtonLink } from "../ui/buttons";
import { Container, Section, SectionHeading } from "../ui/layout";
import { solutions } from "./content";
import { DemoButton } from "./demo";
import { faNumber, today } from "./sample-data";

const [gym, ...otherSolutions] = solutions;
const session = today.sessions[0];

function BookingSample() {
  return (
    <aside className="solution-booking-sample" aria-label="نمونهٔ رزرو باشگاه">
      <span className="solution-booking-calendar" aria-hidden="true">
        <CalendarDays weight="fill" size={22} />
      </span>
      <p className="solution-booking-eyebrow">نمونهٔ رزرو</p>
      <h4>{session.title}</h4>
      <p className="solution-booking-time">
        {today.title}، <bdi>{session.time}</bdi>
      </p>
      <p className="solution-booking-availability">
        {faNumber(session.capacity - session.booked)} جای خالی
      </p>
      <DemoButton compact showIcon={false} className="solution-booking-action">
        رزرو جلسه
      </DemoButton>
    </aside>
  );
}

export function SolutionsSection() {
  return (
    <Section
      id="solutions"
      tabIndex={-1}
      aria-labelledby="solutions-title"
      className="solutions-section"
    >
      <Container>
        <SectionHeading
          id="solutions-title"
          title={<>هر مجموعه، <span>برنامهٔ خودش</span></>}
          description="زمان کلاس، نوبت مربی یا ظرفیت سانس را بر اساس برنامهٔ مجموعهٔ خودتان تعریف کنید."
        />
        <ul className="solutions-grid" role="list">
          <li className="solution-featured-item">
            <article id="sport-strength" className="solution-featured" aria-labelledby="gym-solution-title">
              <Image
                className="solution-gym-photo"
                src="/assets/solution-gym-v2.webp"
                width={1536}
                height={1024}
                alt=""
                unoptimized
              />
              <BookingSample />
              <div className="solution-featured-copy">
                <p className="solution-featured-tag">برای باشگاه شما</p>
                <h3 id="gym-solution-title">{gym.title}</h3>
                <p className="solution-featured-description">{gym.subtitle}</p>
                <ButtonLink href={`/solutions/${gym.slug}`} className="solution-featured-action">
                  مشاهده راهکار باشگاه‌ها
                  <ArrowLeft weight="fill" size={24} aria-hidden="true" />
                </ButtonLink>
              </div>
            </article>
          </li>
          {otherSolutions.map(({ slug, image, title, subtitle }) => (
            <li key={image}>
              <div id={`sport-${image}`} className="solution-tile">
                <Link href={`/solutions/${slug}`} prefetch={false} className="solution-tile-link">
                  <Image
                    className="solution-art"
                    src={`/assets/solution-${image}-v2.webp`}
                    width={1536}
                    height={1024}
                    alt=""
                    unoptimized
                  />
                  <span className="solution-secondary-copy">
                    <strong className="solution-label">{title}</strong>
                    <span className="solution-subtitle">{subtitle}</span>
                  </span>
                  <ChevronLeft weight="fill" className="solution-chevron" size={21} aria-hidden="true" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
