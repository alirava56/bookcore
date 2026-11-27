import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const url = process.env.VAGHTIMO_CAPTURE_URL || "http://127.0.0.1:4180/";
const output = process.env.VAGHTIMO_CAPTURE_DIR || "test-results/phase-02-1-captures";
const before = process.env.VAGHTIMO_CAPTURE_STAGE === "before";
const primary = [
  ["desktop-1440", 1440, 900],
  ["mobile-390", 390, 844],
];
const additional = [
  ["laptop-1366", 1366, 768],
  ["tablet-768", 768, 1024],
  ["mobile-320", 320, 568],
  ["mobile-430", 430, 932],
  ["mobile-360", 360, 800],
  ["desktop-1920", 1920, 1080],
];

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
try {
  for (const [name, width, height] of before ? primary : [...primary, ...additional]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "reduce" });
    const response = await page.goto(url, { waitUntil: "networkidle" });
    if (!response?.ok()) throw new Error(`Capture URL returned ${response?.status()}`);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => {
        image.loading = "eager";
        return image.decode();
      }));
    });
    const shot = (file) => path.join(output, file + ".png");
    await page.screenshot({ path: shot(`${before ? "before" : "after"}-${name}`), fullPage: true, animations: "disabled" });
    if (!before && name === "desktop-1440") {
      await page.locator(".hero").screenshot({ path: shot("hero-desktop"), animations: "disabled" });
    }
    if (!before && name === "mobile-390") {
      await page.locator(".hero").screenshot({ path: shot("hero-mobile"), animations: "disabled" });
      await page.getByRole("button", { name: "باز کردن منو" }).click();
      await page.getByRole("dialog", { name: "منوی وقتیمو" }).waitFor();
      await page.screenshot({ path: shot("mobile-navigation"), animations: "disabled" });
      await page.keyboard.press("Escape");
      await page.locator(".hero").getByRole("button", { name: "مشاهده دمو" }).click();
      const dialog = page.getByRole("dialog", { name: "دموی وقتیمو" });
      await dialog.getByRole("button", { name: /تمرین گروهی/ }).click();
      await dialog.getByText("پیش‌نمایش رزرو تمرین گروهی", { exact: true }).waitFor();
      await page.screenshot({ path: shot("interactive-demo"), animations: "disabled" });
    }
    console.log(`Captured ${name} at ${width} × ${height}`);
    await page.close();
  }
} finally {
  await browser.close();
}
