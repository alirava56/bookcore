import axe from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const viewports = [
  [320, 568], [360, 800], [375, 812], [390, 844], [430, 932],
  [768, 1024], [1024, 768], [1280, 900], [1366, 768], [1440, 900], [1920, 1080],
] as const;
const axeTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

for (const [width, height] of viewports) {
  test(`homepage fits at ${width}px with readable controls and no browser errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") errors.push(message.text());
    });
    page.on("requestfailed", (request) => errors.push(`Failed request ${request.url()}`));
    await page.setViewportSize({ width, height });
    expect((await page.goto("/"))?.status()).toBe(200);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("html")).toHaveAttribute("lang", "fa");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("مدیریت و رزرو نوبت، ساده‌تر از همیشه");
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(page.locator(".hero-art img")).toBeVisible();

    const geometry = await page.evaluate(() => {
      const viewport = document.documentElement.clientWidth;
      const layout = [...document.querySelectorAll("main section, .nav-shell, .hero-art, .values-strip, .solutions-grid, .feature-explorer, .product-stage, .workflow-grid, .final-banner, .footer-grid, .button")];
      const outside = layout.filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && (box.left < -1 || box.right > viewport + 1);
      }).map((element) => element.className);
      const brokenAnchors = [...document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')]
        .map((link) => link.hash).filter((hash) => !hash || !document.getElementById(hash.slice(1)));
      const overflowingText = [...document.querySelectorAll("h1, h2, h3, .hero-description, .button, .values-strip li, .solution-tile summary")]
        .filter((el) => el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent);
      const smallControls = [...document.querySelectorAll(".button, .site-header nav a, .site-footer summary, .feature-option, .solution-tile summary")]
        .filter((el) => {
          const box = el.getBoundingClientRect();
          return box.width > 0 && box.height < 47.5;
        }).map((el) => el.textContent);
      return { viewport, scrollWidth: document.documentElement.scrollWidth, outside, brokenAnchors, overflowingText, smallControls };
    });
    expect(geometry.scrollWidth).toEqual(geometry.viewport);
    expect(geometry.outside).toEqual([]);
    expect(geometry.brokenAnchors).toEqual([]);
    expect(geometry.overflowingText).toEqual([]);
    expect(geometry.smallControls).toEqual([]);
    for (const image of await page.locator("img").all()) {
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0))
        .toBe(true);
    }
    expect(errors).toEqual([]);
  });
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`full-page evidence and axe at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((item) => { item.loading = "eager"; return item.decode(); }));
    });
    await page.screenshot({ path: testInfo.outputPath("homepage.png"), fullPage: true, animations: "disabled" });
    const results = await new axe({ page }).withTags(axeTags).analyze();
    expect(results.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map((node) => node.target) }))).toEqual([]);
  });
}

test("keyboard skip and desktop navigation reach live sections and status", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "ناوبری اصلی" });
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "رفتن به محتوای اصلی" });
  await expect(skip).toBeFocused();
  await expect(skip).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await nav.getByRole("link", { name: "امکانات" }).click();
  await expect(page).toHaveURL(/#features$/);
  await expect(page.locator("#features")).toBeFocused();
  await nav.getByRole("link", { name: "تعرفه‌ها" }).click();
  await expect(page.locator("#pricing")).toBeVisible();
  await expect(page.locator("#pricing")).toContainText("هنوز منتشر نشده‌اند");
  await page.getByRole("banner").getByRole("link", { name: "ورود" }).click();
  await expect(page.locator("#sign-in")).toBeVisible();
  await page.getByText("قوانین و حریم خصوصی", { exact: true }).press("Enter");
  await expect(page.getByText("صفحات رسمی قوانین و حریم خصوصی هنوز در دسترس نیستند.")).toBeVisible();
});

test("mobile drawer supports focus, backdrop, escape, and anchor selection", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "باز کردن منو" });
  const drawer = page.getByRole("dialog", { name: "منوی وقتیمو" });
  const close = drawer.getByRole("button", { name: "بستن" });
  await menu.press("Enter");
  await expect(close).toBeFocused();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  const duration = await drawer.evaluate((element) => Number.parseFloat(getComputedStyle(element).animationDuration));
  expect(duration).toBeLessThan(0.001);
  await page.keyboard.press("Tab");
  await expect(drawer.getByRole("link", { name: "امکانات" })).toBeFocused();
  expect((await new axe({ page }).withTags(axeTags).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(menu).toBeFocused();
  await menu.click();
  await page.mouse.click(5, 200);
  await expect(drawer).toBeHidden();
  await menu.click();
  await drawer.getByRole("link", { name: "راهکارها" }).click();
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL(/#solutions$/);
  await expect(page.locator("#solutions")).toBeFocused();
  await menu.click();
  await page.setViewportSize({ width: 1024, height: 844 });
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "ناوبری اصلی" })).toBeVisible();
});

test("demo CTAs open the same sample and allow a preview without sending data", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const triggers = [page.getByRole("banner"), page.locator(".hero"), page.locator(".final-section")]
    .map((section) => section.getByRole("button", { name: "مشاهده دمو" }));
  triggers.push(page.getByRole("complementary", { name: "نمونهٔ رزرو باشگاه" }).getByRole("button", { name: "رزرو جلسه" }));
  const writes: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET") writes.push(request.url()); });

  for (const trigger of triggers) {
    await expect(trigger).toHaveAttribute("aria-controls", "vaghtimo-product-demo");
    await trigger.press("Enter");
    const dialog = page.getByRole("dialog", { name: "دموی وقتیمو" });
    const close = dialog.getByRole("button", { name: "بستن" });
    await expect(close).toBeFocused();
    await expect(dialog).toContainText("این دمو رزروی ثبت نمی‌کند");
    await expect(dialog.getByText("برای دیدن جزئیات، یک جلسهٔ دارای ظرفیت را انتخاب کنید.")).toBeVisible();

    const wednesday = dialog.getByRole("button", { name: "چهارشنبه" });
    await wednesday.press("Enter");
    await expect(wednesday).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByRole("button", { name: /تمرین قدرتی/ })).toBeDisabled();
    await dialog.getByRole("button", { name: /پیلاتس مقدماتی/ }).press("Enter");
    await expect(dialog.getByText("پیش‌نمایش رزرو پیلاتس مقدماتی")).toBeVisible();
    expect((await new axe({ page }).withTags(axeTags).analyze()).violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  }

  expect(writes).toEqual([]);
});

test("the interactive preview fits a 320px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await page.getByRole("banner").getByRole("button", { name: "مشاهده دمو" }).click();
  const dialog = page.getByRole("dialog", { name: "دموی وقتیمو" });
  await dialog.getByRole("button", { name: /جلسه با مربی/ }).press("Enter");
  await expect(dialog.getByText("پیش‌نمایش رزرو جلسه با مربی")).toBeVisible();
  const { x, right, width, scrollWidth } = await dialog.evaluate((el) => {
    const box = el.getBoundingClientRect();
    return { x: box.x, right: box.right, width: el.clientWidth, scrollWidth: el.scrollWidth };
  });
  expect(x).toBeGreaterThanOrEqual(0);
  expect(right).toBeLessThanOrEqual(320);
  expect(scrollWidth).toBe(width);
  await dialog.getByRole("button", { name: "بستن" }).press("Enter");
  await expect(dialog).toBeHidden();
});
test("sports cards and common questions expand by keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const sport = page.locator("#sport-pilates");
  await sport.locator("summary").press("Enter");
  await expect(sport.getByText("زمان برگزاری و ظرفیت کلاس‌ها را مشخص کنید.")).toBeVisible();
  await sport.locator("summary").press("Enter");
  await expect(sport.getByText("زمان برگزاری و ظرفیت کلاس‌ها را مشخص کنید.")).toBeHidden();
  const faq = page.locator("#faq");
  await faq.getByText("مدیریت ظرفیت جلسات چگونه انجام می‌شود؟", { exact: true }).press("Enter");
  await expect(faq.getByText(/مجموعه ظرفیت هر جلسه/)).toBeVisible();
});

test("gym solution leads on desktop and mobile and its CTA reaches the product", async ({ page }, testInfo) => {
  await page.goto("/");
  const section = page.getByRole("region", { name: "هر مجموعه، برنامهٔ خودش" });
  const gym = section.getByRole("article", { name: "باشگاه‌های ورزشی" });
  const academy = section.locator("#sport-academy");
  const screenshotStyle = ".site-header, .skip-link { visibility: hidden !important; }";
  await expect(section.getByRole("listitem")).toHaveCount(4);
  await expect(section.getByRole("listitem").first()).toContainText("باشگاه‌های ورزشی");
  await expect(section.getByRole("complementary", { name: "نمونهٔ رزرو باشگاه" })).toContainText("۴ جای خالی");
  for (const width of [1586, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => document.fonts.ready);
    for (const image of await section.locator("img").all()) {
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    }
    const featured = await gym.boundingBox();
    const secondary = await academy.boundingBox();
    expect(featured).not.toBeNull();
    expect(secondary).not.toBeNull();
    if (width > 1000) {
      expect(featured!.width).toBeGreaterThan(secondary!.width * 1.7);
      expect(featured!.x).toBeGreaterThan(secondary!.x);
      expect(Math.abs(featured!.y - secondary!.y)).toBeLessThan(2);
    } else {
      expect(featured!.y + featured!.height).toBeLessThan(secondary!.y);
    }
    await section.screenshot({ path: testInfo.outputPath(`solutions-${width}.png`), animations: "disabled", style: screenshotStyle });
  }
  await gym.getByRole("link", { name: "مشاهده راهکار باشگاه‌ها" }).click();
  await expect(page).toHaveURL(/#features$/);
  await expect(page.getByRole("heading", { name: "از اولین رزرو تا آخرین سانس" })).toBeInViewport();
});


test("the product preview changes view and footer links target the selected feature", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#reports");
  const preview = page.getByRole("region", { name: "ظرفیت جلسه‌ها" });
  await expect(preview.getByRole("progressbar")).toHaveCount(3);
  await page.locator(".feature-option#booking").click();
  await expect(page.locator(".calendar-event")).toHaveCount(6);
  const pilates = page.locator(".calendar-event").filter({ hasText: "پیلاتس مقدماتی" });
  await pilates.press("Enter");
  await expect(pilates).toHaveAttribute("aria-pressed", "true");
  const selection = page.getByRole("complementary", { name: "جزئیات جلسهٔ انتخاب‌شده" });
  await expect(selection.getByRole("heading", { name: "پیلاتس مقدماتی" })).toBeVisible();
  await expect(selection.getByText("چهارشنبه، ۱۲ آذر")).toBeVisible();
  await expect(selection.getByRole("progressbar")).toHaveAttribute("value", "6");
  await page.locator(".feature-option#reports").click();
  const branches = page.getByRole("button", { name: "مدیریت چند شعبه" });
  await branches.press("Enter");
  await expect(branches).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "شعبه‌های مجموعه" }).getByText("شعبهٔ غرب")).toBeVisible();
  await expect(page).toHaveURL(/#branches$/);
  const footer = page.getByRole("navigation", { name: "امکانات در فوتر" });
  await footer.getByRole("link", { name: "گزارش‌های عملیاتی" }).click();
  await expect(page.getByRole("button", { name: "گزارش‌های عملیاتی" })).toHaveAttribute("aria-pressed", "true");
  await expect(preview.getByRole("progressbar")).toHaveCount(3);
});


test("the glass tint stays inside the frame and the booking steps show a consistent sample", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/");
  const result = await page.locator(".benefits-scene").evaluate((scene) => {
    const lens = scene.querySelector(".benefits-light");
    const frame = scene.querySelector(".values-strip");
    if (!lens || !frame) throw new Error("Glass layers missing");
    const tint = lens.getBoundingClientRect();
    const border = frame.getBoundingClientRect();
    return {
      inside: tint.left > border.left && tint.right < border.right && tint.top > border.top && tint.bottom < border.bottom,
      curvedClip: getComputedStyle(lens).clipPath.includes("round"),
    };
  });
  expect(result).toEqual({ inside: true, curvedClip: true });
  const workflow = page.getByRole("region", { name: "از ثبت مجموعه تا دریافت رزرو" });
  await expect(workflow.getByRole("listitem")).toHaveCount(3);
  await expect(workflow.getByText("باشگاه ورزشی آرنا")).toBeVisible();
  await expect(workflow.getByText("۱۲ نفر", { exact: true })).toBeVisible();
  await expect(workflow.getByText("رزرو با موفقیت ثبت شد")).toBeVisible();
  await expect(workflow.getByText(/مسیر نمونه یک کلاس گروهی/)).toBeVisible();
  await expect(workflow.locator(".workflow-booking-row")).toHaveCount(3);
  await expect(workflow.locator(".workflow-connector")).toHaveCount(2);
  // Keep viewport-fixed chrome out of the section-only reference captures.
  const captureStyle = ".site-header, .skip-link { visibility: hidden !important; }";
  await page.setViewportSize({ width: 984, height: 900 });
  await workflow.screenshot({ path: testInfo.outputPath("workflow-reference-size.png"), animations: "disabled", style: captureStyle });
  await page.setViewportSize({ width: 390, height: 844 });
  await workflow.screenshot({ path: testInfo.outputPath("workflow-mobile.png"), animations: "disabled", style: captureStyle });
});

test("footer support opens its notice and back to top returns to the start", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  const support = footer.getByRole("link", { name: "وضعیت پشتیبانی" });
  await support.press("Enter");
  await expect(page.locator("#support-status")).toBeVisible();
  await expect(page.locator("#support-status")).toContainText("راه ارتباطی رسمی پشتیبانی هنوز منتشر نشده است.");
  await footer.getByRole("link", { name: "بازگشت به بالا" }).press("Enter");
  await expect(page).toHaveURL(/#top$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(2);
});
