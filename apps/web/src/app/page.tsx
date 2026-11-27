import Image from "next/image";
import { Accordion } from "@/components/ui/accordion";
import { ButtonLink } from "@/components/ui/buttons";
import { Container, Section, SectionHeading } from "@/components/ui/layout";
import { BenefitsGlass } from "@/components/marketing/benefits-glass";
import { BookingWorkflow } from "@/components/marketing/booking-workflow";
import { Footer, Navbar } from "@/components/marketing/chrome";
import { questions } from "@/components/marketing/content";
import { DemoButton, DemoProvider } from "@/components/marketing/demo";
import { FeatureExplorer } from "@/components/marketing/feature-explorer";
import { HeroArt } from "@/components/marketing/hero-art";
import { SolutionsSection } from "@/components/marketing/solutions-section";

export default function Home() {
  return (
    <DemoProvider>
      <a className="skip-link" href="#main" tabIndex={0}>رفتن به محتوای اصلی</a>
      <Navbar />
      <main id="main" tabIndex={-1}>
        <Section className="hero" aria-labelledby="hero-title">
          <Container className="hero-grid">
            <div className="hero-copy">
              <h1 id="hero-title">مدیریت و رزرو نوبت، <span>ساده‌تر از همیشه</span></h1>
              <p className="hero-description">وقتیمو، پلتفرم مدیریت جلسات و رزرو آنلاین برای باشگاه‌ها، استودیوهای یوگا و پیلاتس، آکادمی‌ها و مجموعه‌های آبی.</p>
              <div className="hero-actions">
                <DemoButton />
                <ButtonLink href="#features" variant="secondary">آشنایی با امکانات</ButtonLink>
              </div>
            </div>
            <HeroArt />
          </Container>
        </Section>

        <BenefitsGlass />

        <Section id="features" tabIndex={-1} aria-labelledby="features-title" className="features-section">
          <Container>
            <SectionHeading id="features-title" title={<>از اولین رزرو تا <span>آخرین سانس</span></>}
              description="نماهای مختلف را انتخاب کنید و ببینید رزروها، شعبه‌ها، اعضای تیم و ظرفیت جلسه‌ها چطور کنار هم قرار می‌گیرند." />
            <FeatureExplorer />
          </Container>
        </Section>

        <SolutionsSection />

        <BookingWorkflow />

        <Section id="faq" tabIndex={-1} aria-labelledby="faq-title" className="faq-section">
          <Container className="faq-grid">
            <SectionHeading id="faq-title" title="سوالات متداول" description="پاسخ پرسش‌هایی که پیش از تنظیم برنامهٔ مجموعه پیش می‌آیند." />
            <div className="faq-list">
              {questions.map(({ title, answer }) => <Accordion key={title} title={title}>{answer}</Accordion>)}
            </div>
          </Container>
        </Section>

        <Section className="final-section" aria-labelledby="final-title">
          <Container className="final-banner">
            <div className="final-copy">
              <h2 id="final-title">وقتیمو را از نزدیک ببینید</h2>
              <p>یک جلسه انتخاب کنید و مسیر رزرو و بررسی ظرفیت را در دموی وقتیمو امتحان کنید.</p>
              <div className="final-action"><DemoButton inverted /></div>
            </div>
            <div className="final-visual" aria-hidden="true">
              <Image className="final-art" src="/assets/calendar-illustration.webp" width={760} height={560} alt="" unoptimized />
            </div>
          </Container>
        </Section>
      </main>
      <Footer />
    </DemoProvider>
  );
}
