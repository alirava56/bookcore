import axe from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { build } from "esbuild";

test("form primitives retain native semantics, loading, errors and tooltip behavior", async ({ page }) => {
  const bundle = await build({ bundle: true, entryPoints: ["tests/primitives.fixture.tsx"], write: false, format: "iife" });
  await page.goto("/");
  const styles = await page.locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => link.outerHTML).join(""));
  expect(styles).toContain("stylesheet");
  await page.route("**/__component_fixture", (route) => route.fulfill({
    contentType: "text/html; charset=utf-8",
    body: `<!doctype html><html lang="fa" dir="rtl"><head><title>آزمون سامانهٔ طراحی</title>${styles}</head><body><div id="fixture"></div></body></html>`,
  }));
  await page.goto("/__component_fixture");
  const script = bundle.outputFiles?.[0]?.text;
  if (!script) throw new Error("Fixture bundle was empty.");
  await page.addScriptTag({ content: script });

  const input = page.getByRole("textbox", { name: "نام مجموعه" });
  await input.fill("مجموعهٔ ورزشی");
  await expect(input).toHaveAccessibleDescription("نام را وارد کنید.");
  const textarea = page.getByRole("textbox", { name: "توضیح" });
  await expect(textarea).toHaveAttribute("aria-invalid", "true");
  await expect(textarea).toHaveAccessibleDescription("توضیح لازم است.");
  await textarea.fill("جلسهٔ نمونه");
  await expect(textarea).toHaveValue("جلسهٔ نمونه");
  const select = page.getByRole("combobox", { name: "شعبه", exact: true });
  await select.selectOption("north");
  await expect(select).toHaveValue("north");
  const busy = page.getByRole("combobox", { name: "دریافت شعبه‌ها" });
  await expect(busy).toHaveAttribute("aria-busy", "true");
  await expect(busy).toBeDisabled();
  const checkbox = page.getByRole("checkbox", { name: "پذیرش" });
  await checkbox.press("Space");
  await expect(checkbox).toBeChecked();
  await page.getByRole("radio", { name: "صبح" }).press("ArrowDown");
  await expect(page.getByRole("radio", { name: "عصر" })).toBeChecked();
  const toggle = page.getByRole("switch", { name: "فعال", exact: true });
  await toggle.press("Space");
  await expect(toggle).toBeChecked();
  await expect(page.getByRole("switch", { name: "غیرفعال" })).toBeDisabled();

  const loading = page.getByRole("button", { name: "در حال ارسال" });
  await expect(loading).toHaveAttribute("aria-busy", "true");
  await expect(loading).toBeDisabled();
  await loading.evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.getByLabel("تعداد ارسال")).toHaveText("0");
  await expect(page.getByRole("button", { name: "ارسال غیرفعال" })).toBeDisabled();
  await page.getByRole("button", { name: "ارسال", exact: true }).click();
  await expect(page.getByLabel("تعداد ارسال")).toHaveText("1");

  const guide = page.getByRole("button", { name: "راهنمای ظرفیت" });
  const tooltip = page.getByRole("tooltip");
  await guide.hover();
  await expect(tooltip).toBeVisible();
  await guide.focus();
  await expect(guide).toHaveAccessibleDescription("اطلاعات بیشتر دربارهٔ ظرفیت");
  await guide.press("Escape");
  await expect(tooltip).toBeHidden();
  await expect(page.getByRole("alert")).toHaveText("خطای نمونه");
  const results = await new axe({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map((node) => node.target) }))).toEqual([]);
});
