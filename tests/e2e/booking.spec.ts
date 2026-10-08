import { expect, test } from "@playwright/test";

import { waitForEmail } from "./helpers";

// Employee flow on a phone: book -> confirmation email -> cancel link -> cancel.
test("employee books a slot and cancels it from the email link", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.invalid`;

  await page.goto("/book/profilaktika-test");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Профилактични прегледи – Медицински център",
  );

  // Inputs stay disabled until the page is hydrated.
  const freeSlot = page.locator("label").filter({ has: page.locator('input[name="slot"]:not([disabled])') }).first();
  await expect(freeSlot.locator("input")).toBeEnabled();
  const time = (await freeSlot.innerText()).trim();
  await freeSlot.click();
  await expect(page.getByText(`Избран час:`)).toContainText(time);

  await page.getByLabel(/Име и фамилия/).fill("Е2Е Тестов");
  await page.getByLabel(/Телефон/).fill("0888 123 456");
  await page.getByLabel(/Имейл/).fill(email);
  await page.getByLabel(/Работно място/).fill("Тестова фирма");
  await page.getByRole("checkbox", { name: /Съгласен/ }).click();

  // Cloudflare's test site key passes automatically.
  await expect(page.locator('input[name="cf-turnstile-response"]')).not.toHaveValue("", { timeout: 20_000 });

  await page.getByRole("button", { name: "Запази час" }).click();
  await expect(page.getByRole("heading", { name: "Вашият профилактичен преглед е записан успешно." })).toBeVisible();
  await expect(page.getByText(time, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Добави в календар" })).toBeVisible();

  const confirmation = await waitForEmail(email, "Потвърждение: профилактичен преглед");
  expect(confirmation).toContain("Здравейте, Е2Е Тестов");
  expect(confirmation).toContain(time);
  const cancelUrl = confirmation.match(/http:\/\/localhost:3100\/cancel\/[0-9a-f-]{36}/)?.[0];
  expect(cancelUrl).toBeTruthy();

  // Opening the link must not cancel anything.
  await page.goto(cancelUrl!);
  await expect(page.getByText("Е2Е Тестов")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Отмени записването" })).toBeEnabled();

  await page.getByRole("button", { name: "Отмени записването" }).click();
  await expect(page.getByText("Записването беше отменено успешно.")).toBeVisible();
  await expect(page.getByText("Ако сте добавили прегледа в календара си, моля, изтрийте го.")).toBeVisible();

  const cancellation = await waitForEmail(email, "Отменено: профилактичен преглед");
  expect(cancellation).toContain("Ако сте добавили прегледа в календара си, моля, изтрийте го.");

  // The slot is free again.
  await page.goto("/book/profilaktika-test");
  await expect(page.locator("label").filter({ hasText: time }).first().locator("input")).toBeEnabled();
});
