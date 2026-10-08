import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { adminSignInUrl, waitForEmail } from "./helpers";

// Admin flow: sign in -> generate slots -> manual booking -> table -> export.
test("admin signs in, generates slots, books manually and exports", async ({ page, baseURL }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);

  await page.goto(await adminSignInUrl(baseURL!));
  await page.getByRole("button", { name: "Влез" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  // Campaign and generator.
  await page.getByRole("link", { name: "Кампании" }).click();
  await page.getByRole("link", { name: "Профилактични прегледи – Медицински център" }).click();
  await page.getByRole("link", { name: "Часове" }).click();

  const day = new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("От дата").fill(day);
  await page.getByLabel("До дата").fill(day);
  // Make sure the chosen day is included whatever weekday it is.
  for (const name of ["събота", "неделя"]) {
    const box = page.getByRole("checkbox", { name });
    if (!(await box.isChecked())) await box.check({ force: true });
  }
  await page.getByLabel("Начален час").fill("13:00");
  await page.getByLabel("Краен час").fill("14:00");
  await page.getByRole("button", { name: "Преглед" }).click();
  await expect(page.getByRole("button", { name: "Създай 2 часа" })).toBeEnabled();
  await page.getByRole("button", { name: "Създай 2 часа" }).click();
  await expect(page.getByText("Създадени часове: 2.")).toBeVisible();

  // Manual booking with an email: confirmation is sent.
  const email = `phone-${Date.now()}@example.invalid`;
  await page.goto("/admin/bookings/new");
  await page.getByLabel("Час").selectOption({ index: 1 });
  await page.getByLabel("Име и фамилия").fill("Обадил Се");
  await page.getByLabel("Телефон").fill("0899 555 444");
  await page.getByLabel("Имейл (по желание)").fill(email);
  await page.getByLabel(/устно съгласие/).click();
  await page.getByRole("button", { name: "Запиши" }).click();
  await expect(page.getByRole("heading", { name: "Обадил Се" })).toBeVisible();
  await expect(page.getByText("Въведено от админ")).toBeVisible();
  await waitForEmail(email, "Потвърждение: профилактичен преглед");

  // Table and search.
  await page.goto("/admin/bookings?q=0899");
  await expect(page.getByRole("link", { name: "Обадил Се" })).toBeVisible();
  await expect(page.getByText("0899 555 444")).toBeVisible();

  // Export of the filtered rows.
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^zapisvania-\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = readFileSync(await download.path()!, "utf8");
  expect(csv.charCodeAt(0)).toBe(0xfeff); // BOM
  expect(csv).toContain("Име и фамилия;Телефон;Имейл");
  expect(csv).toContain("Обадил Се;0899 555 444;");
});
