import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const pages = [
  { slug: "gyms", tile: "strength", title: /مدیریت رزرو باشگاه ورزشی/, session: "تمرین گروهی", feature: "زمان، مربی و رزرو در برنامهٔ هر شعبه" },
  { slug: "yoga-pilates", tile: "pilates", title: /مدیریت کلاس‌های یوگا و پیلاتس/, session: "پیلاتس ریفورمر", feature: "ظرفیت ریفورمر در سه وضعیت" },
  { slug: "academies", tile: "academy", title: /برنامه‌ریزی جلسات آموزشی و تمرین آکادمی ورزشی/, session: "تمرین مهارت پایه", feature: "برنامهٔ تمرین هر گروه، کنار برنامهٔ مربی" },
  { slug: "pools", tile: "swimming", title: /مدیریت سانس و ظرفیت رزرو استخر/, session: "سانس صبح", feature: "چهار سانس، چهار وضعیت پذیرش" },
];
const sizes = [320, 360, 375, 390, 414, 768, 1024, 1280, 1440, 1920];
const captureSizes = new Set([320, 390, 768, 1280, 1440]);

for (const { slug, tile, title, session, feature } of pages) {
  const path = `/solutions/${slug}`;

  test(`${slug} links, keyboard, and industry demo`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [];
    const writes: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("request", (request) => {
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) writes.push(request.url());
    });
    await page.goto("/");
    await page.locator(`#sport-${tile}`).getByRole("link").press("Enter");
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await page.getByRole("link", { name: "آشنایی با امکانات" }).press("Enter");
    await expect(page.getByRole("heading", { name: feature })).toBeInViewport();

    const summary = page.locator("#faq summary").first();
    await summary.press("Enter");
    await expect(page.locator("#faq details").first()).toHaveAttribute("open", "");
    await summary.press("Enter");
    await expect(page.locator("#faq details").first()).not.toHaveAttribute("open");

    const demo = page.getByRole("dialog", { name: "دموی وقتیمو" });
    const heroDemo = page.locator(".industry-hero").getByRole("button", { name: "مشاهده دمو" });
    await heroDemo.press("Enter");
    await expect(demo).toBeVisible();
    await demo.getByRole("button", { name: new RegExp(session) }).press("Enter");
    await expect(demo.locator("[aria-live]")).toContainText(`پیش‌نمایش رزرو ${session}`);
    await page.keyboard.press("Escape");
    await expect(heroDemo).toBeFocused();

    await page.getByRole("button", { name: "باز کردن منو" }).click();
    await expect(page.getByRole("dialog", { name: "منوی وقتیمو" }).getByRole("link", { name: "راهکارها" })).toHaveAttribute("href", "/#solutions");
    await page.keyboard.press("Escape");
    await expect(page.locator(".industry-related a")).toHaveCount(3);
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "نحوهٔ کار" })).toHaveAttribute("href", "/#how-it-works");
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
  });

  test(`${slug} responsive layout, screenshots, and axe`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);

    for (const width of sizes) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      if (captureSizes.has(width)) {
        await page.locator(".industry-art img").evaluate((image: HTMLImageElement) => image.decode());
        await page.screenshot({ fullPage: true, animations: "disabled", path: testInfo.outputPath(`${slug}-${width}.png`) });
      }
      if (width === 390 || width === 1440) {
        const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
        expect(result.violations).toEqual([]);
      }
    }
  });
}

test("solution content is in the initial HTML and metadata matches the indexing environment", async ({ request }) => {
  const configuredOrigin = process.env.VAGHTIMO_SITE_URL;
  const published = configuredOrigin && process.env.VAGHTIMO_INDEXABLE === "1";
  const titles = new Set<string | undefined>();
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  const sitemapBody = await sitemap.text();
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  if (published) expect(await robots.text()).toContain(new URL("/sitemap.xml", configuredOrigin).href);
  else expect(await robots.text()).not.toContain("Sitemap:");

  for (const { slug, title } of pages) {
    const path = `/solutions/${slug}`;
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html.match(/<h1\b[^>]*>(.*?)<\/h1>/)?.[1]).toMatch(title);
    expect(html).toContain('<meta name="description" content="');
    expect(html).toContain('<meta property="og:title" content="');
    titles.add(html.match(/<title>(.*?)<\/title>/)?.[1]);
    if (published) {
      const canonical = new URL(path, configuredOrigin).href;
      expect(html).toContain(`rel="canonical" href="${canonical}"`);
      expect(html).toContain('"@type":"BreadcrumbList"');
      expect(sitemapBody).toContain(`<loc>${canonical}</loc>`);
    } else {
      expect(html).toContain('<meta name="robots" content="noindex, follow"');
      expect(sitemapBody).not.toContain(path);
    }
  }
  expect(titles.size).toBe(4);
  expect(titles.has(undefined)).toBe(false);
  expect((await request.get("/solutions/not-an-industry")).status()).toBe(404);
  expect((await request.get("/solutions")).status()).toBe(404);
});
