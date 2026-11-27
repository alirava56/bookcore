import { Accordion } from "../ui/accordion";
import { ButtonLink } from "../ui/buttons";
import { Container } from "../ui/layout";
import { Logo } from "./brand";
import { features, marketingHref, navLinks } from "./content";
import { DemoButton } from "./demo";
import { MobileNavigation } from "./mobile-navigation";

export function Navbar({ onSolution = false }: { onSolution?: boolean }) {
  return (
    <header className="site-header">
      <Container className="nav-shell liquid-glass">
        <Logo />
        <nav className="desktop-nav" aria-label="ناوبری اصلی">
          {navLinks.map(({ href, label }) => (
            <a key={href} href={marketingHref(href, onSolution)} tabIndex={0}
              data-section-active={onSolution && href === "#solutions" ? "" : undefined}>{label}</a>
          ))}
        </nav>
        <div className="nav-actions">
          <ButtonLink href="#sign-in" variant="quiet" className="desktop-sign-in">ورود</ButtonLink>
          <DemoButton compact />
          <MobileNavigation onSolution={onSolution} />
        </div>
      </Container>
    </header>
  );
}

export function Footer({ onSolution = false }: { onSolution?: boolean }) {
  return (
    <footer className="site-footer" id="support" tabIndex={-1}>
      <Container>
        <div className="footer-grid">
          <div className="footer-about">
            <Logo light />
            <p className="footer-statement">همه‌چی سر وقت!</p>
            <p className="footer-description">مدیریت رزرو و برنامه‌ریزی برای مجموعه‌های ورزشی.</p>
          </div>

          <nav aria-label="امکانات در فوتر" className="footer-links">
            <h2>امکانات</h2>
            <ul role="list">
              {features.map(({ id, title }) => <li key={id}><a tabIndex={0} href={marketingHref(`#${id}`, onSolution)}>{title}</a></li>)}
            </ul>
          </nav>

          <nav aria-label="راهنمای وقتیمو" className="footer-links">
            <h2>راهنما</h2>
            <ul role="list">
              <li><a tabIndex={0} href={marketingHref("#solutions", onSolution)}>راهکارهای ورزشی</a></li>
              <li><a tabIndex={0} href={marketingHref("#how-it-works", onSolution)}>نحوهٔ کار</a></li>
              <li><a tabIndex={0} href="#faq">سؤالات متداول</a></li>
              <li><a tabIndex={0} href="#support-status">وضعیت پشتیبانی</a></li>
            </ul>
          </nav>
        </div>

        <div className="footer-meta">
          <small>© وقتیمو. همهٔ حقوق محفوظ است.</small>
          <div className="footer-utility">
            <Accordion title="وضعیت دسترسی">
              <dl className="footer-status-list">
                <div id="pricing" tabIndex={-1}>
                  <dt>تعرفه‌ها</dt>
                  <dd>تعرفه‌های رسمی وقتیمو هنوز منتشر نشده‌اند.</dd>
                </div>
                <div id="sign-in" tabIndex={-1}>
                  <dt>ورود</dt>
                  <dd>صفحهٔ ورود به وقتیمو هنوز در دسترس نیست.</dd>
                </div>
                <div id="support-status" tabIndex={-1}>
                  <dt>پشتیبانی</dt>
                  <dd>راه ارتباطی رسمی پشتیبانی هنوز منتشر نشده است.</dd>
                </div>
              </dl>
            </Accordion>
            <Accordion title="قوانین و حریم خصوصی">
              <p>صفحات رسمی قوانین و حریم خصوصی هنوز در دسترس نیستند.</p>
            </Accordion>
          </div>
          <a className="footer-back" tabIndex={0} href="#top">بازگشت به بالا</a>
        </div>
      </Container>
    </footer>
  );
}
