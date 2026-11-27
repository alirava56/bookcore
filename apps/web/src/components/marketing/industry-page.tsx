import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ChevronLeft } from "lucide-react";
import { Accordion } from "../ui/accordion";
import { ButtonLink } from "../ui/buttons";
import { Container, Section, SectionHeading } from "../ui/layout";
import { Footer, Navbar } from "./chrome";
import { DemoButton, DemoProvider } from "./demo";
import { industries, industrySlugs, type IndustrySlug } from "./industry-content";
import { IndustryPreview, industryIcons } from "./industry-previews";
import { faNumber } from "./sample-data";

function RelatedIndustries({ current }: { current: IndustrySlug }) {
  return (
    <nav aria-labelledby="industry-related" className="industry-related">
      <h2 id="industry-related">سایر راهکارهای وقتیمو</h2>
      <ul role="list">
        {industrySlugs.filter((slug) => slug !== current).map((slug) => {
          const Icon = industryIcons[slug];
          return (
            <li key={slug}>
              <Link href={`/solutions/${slug}`} prefetch={false}>
                <Icon size={21} aria-hidden="true" />{industries[slug].name}<ArrowLeft size={18} aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const bookingSteps = ["پیدا کردن جلسه", "انتخاب زمان", "درخواست رزرو", "پیگیری نتیجه"];

export function IndustryPage({ slug }: { slug: IndustrySlug }) {
  const content = industries[slug];
  const Icon = industryIcons[slug];
  const first = content.days[0].sessions[0];

  return (
    <DemoProvider days={content.days}>
      <a className="skip-link" href="#main" tabIndex={0}>رفتن به محتوای اصلی</a>
      <Navbar onSolution />
      <main id="main" tabIndex={-1} className="industry-page" data-industry={slug}>
        <div className="industry-intro">
          <Container>
            <nav className="industry-breadcrumb" aria-label="مسیر صفحه">
              <ol role="list">
                <li><Link href="/" prefetch={false}>خانه</Link></li>
                <li><ChevronLeft size={15} aria-hidden="true" /><span aria-current="page">{content.name}</span></li>
              </ol>
            </nav>
            <section className="industry-hero" aria-labelledby="industry-title">
              <div className="industry-hero-copy">
                <p className="industry-eyebrow"><Icon size={20} aria-hidden="true" />راهکار {content.name}</p>
                <h1 id="industry-title">{content.title}</h1>
                <p className="industry-lead">{content.description}</p>
                <div className="industry-actions">
                  <DemoButton />
                  <ButtonLink href="#industry-features" variant="secondary">آشنایی با امکانات <ArrowDown size={17} aria-hidden="true" /></ButtonLink>
                </div>
              </div>
              <figure className="industry-art">
                <Image src={`/assets/solution-${content.image}-v2.webp`} width={1536} height={1024} alt=""
                  sizes="(max-width: 767px) 92vw, (max-width: 1300px) 46vw, 570px" loading="eager" fetchPriority="high" />
                <figcaption className="industry-art-caption">
                  <span className="industry-art-icon"><Icon size={23} aria-hidden="true" /></span>
                  <span><small>جلسهٔ نمونه · <bdi>{first.time}</bdi></small><strong>{first.title}</strong></span>
                  <span className="industry-art-capacity"><strong>{faNumber(first.capacity - first.booked)}</strong><small>جای خالی</small></span>
                </figcaption>
              </figure>
            </section>
          </Container>
        </div>

        <Section aria-labelledby="industry-pains" className="industry-panel">
          <Container className="industry-pain-layout">
            <SectionHeading id="industry-pains" title={content.painTitle} />
            <ul className="industry-pains" role="list">
              {content.pains.map((item) => (
                <li key={item.title}><h3>{item.title}</h3><p>{item.description}</p></li>
              ))}
            </ul>
          </Container>
        </Section>

        <Section id="industry-features" tabIndex={-1} aria-labelledby="industry-features-title" className="industry-panel industry-feature-section">
          <Container>
            <SectionHeading id="industry-features-title" title={content.featureTitle} />
            <div className="industry-feature-layout">
              <IndustryPreview slug={slug} />
              <ul role="list" className="industry-feature-list">
                {content.features.map((feature) => (
                  <li key={feature.title}><h3>{feature.title}</h3><p>{feature.description}</p></li>
                ))}
              </ul>
            </div>
          </Container>
        </Section>

        <Section aria-labelledby="industry-scenario" className="industry-panel">
          <Container>
            <div className="industry-scenario">
              <SectionHeading id="industry-scenario" title={content.scenarioTitle} description="سناریوی نمونه با داده‌های فرضی" />
              <ol role="list">
                {content.scenario.map((step, index) => (
                  <li key={step}><span aria-hidden="true">{faNumber(index + 1)}</span><p>{step}</p></li>
                ))}
              </ol>
            </div>
          </Container>
        </Section>

        <Section aria-labelledby="industry-booking" className="industry-panel industry-booking">
          <Container>
            <SectionHeading id="industry-booking" title={content.bookingTitle}
              description="دمو انتخاب زمان و ظرفیت را نشان می‌دهد. ثبت و پیگیری رزرو واقعی به حساب مجاز نیاز دارد." />
            <ol role="list" className="industry-journey">
              {content.booking.map((step, index) => (
                <li key={step}><span aria-hidden="true">{faNumber(index + 1)}</span><h3>{bookingSteps[index]}</h3><p>{step}</p></li>
              ))}
            </ol>
          </Container>
        </Section>

        <Section id="faq" tabIndex={-1} aria-labelledby="industry-faq" className="industry-panel">
          <Container className="industry-faq">
            <SectionHeading id="industry-faq" title={`پرسش‌های متداول ${content.name}`} />
            <div>
              {content.faqs.map(({ title, description }) => <Accordion key={title} title={title}>{description}</Accordion>)}
            </div>
          </Container>
        </Section>

        <Container className="industry-outro">
          <RelatedIndustries current={slug} />
          <section className="industry-final" aria-labelledby="industry-final">
            <div>
              <h2 id="industry-final">{content.closing}</h2>
              <p>تعرفه‌های رسمی هنوز منتشر نشده‌اند.</p>
            </div>
            <DemoButton inverted />
          </section>
        </Container>
      </main>
      <Footer onSolution />
    </DemoProvider>
  );
}
