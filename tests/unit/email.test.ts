import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  buildCancellationEmail,
  buildConfirmationEmail,
  cancelUrlFor,
  type BookingEmailData,
} from "@/lib/email/booking-emails";
import {
  createFileTransport,
  createResendTransport,
  getEmailTransport,
  type EmailMessage,
} from "@/lib/email/transport";

const data: BookingEmailData = {
  bookingId: "b0000000-0000-0000-0000-000000000001",
  fullName: "Мария Петрова",
  email: "maria@example.invalid",
  startsAt: new Date("2026-10-15T06:00:00Z"),
  durationMin: 30,
  campaignTitle: "Профилактични прегледи – Медицински център",
  locationAddress: "гр. София, ул. Примерна 1",
  locationNote: "Етаж 2, кабинет 5",
};

const cancelUrl = cancelUrlFor("https://zapis.example.bg", "c0000000-0000-0000-0000-000000000001");

describe("confirmation email", () => {
  it("contains the appointment, the cancel link and a calendar file", async () => {
    const email = await buildConfirmationEmail(data, cancelUrl);

    expect(email.to).toBe("maria@example.invalid");
    expect(email.subject).toBe("Потвърждение: профилактичен преглед на 15.10.2026 от 09:00");
    expect(email.idempotencyKey).toBe(`booking-confirmation/${data.bookingId}`);
    for (const body of [email.html, email.text]) {
      expect(body).toContain("Вашият профилактичен преглед е записан успешно.");
      expect(body).toContain("15.10.2026");
      expect(body).toContain("четвъртък");
      expect(body).toContain("09:00");
      expect(body).toContain("гр. София, ул. Примерна 1");
      expect(body).toContain("Етаж 2, кабинет 5");
      expect(body).toContain("https://zapis.example.bg/cancel/c0000000-0000-0000-0000-000000000001");
    }
    expect(email.html).toContain('lang="bg"');

    const [ics] = email.attachments ?? [];
    expect(ics.filename).toBe("profilaktichen-pregled.ics");
    expect(ics.contentType).toContain("text/calendar");
    expect(ics.content).toContain("METHOD:PUBLISH");
    expect(ics.content).toContain("DTSTART:20261015T060000Z");
  });

  it("tells the employee to contact the center when online cancellation is disabled", async () => {
    const email = await buildConfirmationEmail(data, null);
    expect(email.text).not.toContain("/cancel/");
    expect(email.text).not.toContain("Отмени записването");
    expect(email.text).toContain("свържете се с медицинския център");
  });

  it("escapes HTML in user-provided values", async () => {
    const email = await buildConfirmationEmail({ ...data, fullName: "<script>alert(1)</script>" }, null);
    expect(email.html).not.toContain("<script>alert(1)</script>");
    expect(email.html).toContain("&lt;script&gt;");
  });
});

describe("cancellation email", () => {
  it("asks to delete the calendar entry and attaches a CANCEL .ics", async () => {
    const email = await buildCancellationEmail(data);

    expect(email.subject).toBe("Отменено: профилактичен преглед на 15.10.2026 от 09:00");
    expect(email.idempotencyKey).toBe(`booking-cancellation/${data.bookingId}`);
    for (const body of [email.html, email.text]) {
      expect(body).toContain("Вашето записване за профилактичен преглед беше отменено.");
      expect(body).toContain("Ако сте добавили прегледа в календара си, моля, изтрийте го.");
      expect(body).toContain("15.10.2026");
      expect(body).toContain("09:00");
    }
    const [ics] = email.attachments ?? [];
    expect(ics.content).toContain("METHOD:CANCEL");
    expect(ics.content).toContain("STATUS:CANCELLED");
    expect(ics.content).toContain(`UID:${data.bookingId}@profilaktika-booking`);
  });
});

const message: EmailMessage = {
  to: "maria@example.invalid",
  subject: "Тема",
  html: "<p>Здравейте</p>",
  text: "Здравейте",
  attachments: [{ filename: "a.ics", content: "BEGIN:VCALENDAR", contentType: "text/calendar" }],
  idempotencyKey: "booking-confirmation/1",
};

describe("Resend transport", () => {
  it("posts the email with idempotency key, reply-to and base64 attachments", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({ id: "email_123" }));
    const send = createResendTransport({
      apiKey: "re_test",
      from: "Център <noreply@example.bg>",
      replyTo: "info@example.bg",
      fetchImpl,
    });

    expect(await send(message)).toEqual({ ok: true, id: "email_123" });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test");
    expect(headers["Idempotency-Key"]).toBe("booking-confirmation/1");
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      from: "Център <noreply@example.bg>",
      to: ["maria@example.invalid"],
      reply_to: "info@example.bg",
      subject: "Тема",
      text: "Здравейте",
    });
    expect(Buffer.from(body.attachments[0].content, "base64").toString("utf8")).toBe("BEGIN:VCALENDAR");
  });

  it("reports HTTP and network failures without content", async () => {
    const httpFail = createResendTransport({
      apiKey: "k",
      from: "f@example.bg",
      fetchImpl: async () => new Response("bad", { status: 422 }),
    });
    expect(await httpFail(message)).toEqual({ ok: false, reason: "resend_http_422" });

    const netFail = createResendTransport({
      apiKey: "k",
      from: "f@example.bg",
      fetchImpl: async () => {
        throw new TypeError("network");
      },
    });
    expect(await netFail(message)).toEqual({ ok: false, reason: "resend_TypeError" });
  });
});

describe("file transport and transport selection", () => {
  it("writes html, text and attachments to the folder", async () => {
    const dir = await mkdtemp(join(tmpdir(), "emails-"));
    try {
      const result = await createFileTransport(dir)(message);
      expect(result.ok).toBe(true);
      const files = (await readdir(dir)).sort();
      expect(files.some((f) => f.endsWith(".html"))).toBe(true);
      expect(files.some((f) => f.endsWith(".txt"))).toBe(true);
      expect(files.some((f) => f.endsWith("a.ics"))).toBe(true);
      const txt = await readFile(join(dir, files.find((f) => f.endsWith(".txt"))!), "utf8");
      expect(txt).toContain("Subject: Тема");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("requires EMAIL_FROM with Resend and refuses file mode on Vercel", () => {
    expect(() => getEmailTransport({ RESEND_API_KEY: "re_x" })).toThrow(
      "EMAIL_FROM",
    );
    expect(() => getEmailTransport({ VERCEL: "1" })).toThrow("RESEND_API_KEY");
    expect(typeof getEmailTransport({})).toBe("function");
  });
});

describe("moved email", () => {
  it("shows the new time, asks to delete the old one and attaches the new .ics", async () => {
    const { buildMovedEmail } = await import("@/lib/email/booking-emails");
    const moved = { ...data, startsAt: new Date("2026-10-16T07:30:00Z") };
    const email = await buildMovedEmail(moved, cancelUrl);

    expect(email.subject).toBe("Промяна на час: профилактичен преглед на 16.10.2026 от 10:30");
    expect(email.idempotencyKey).toBe(`booking-moved/${data.bookingId}/2026-10-16T07:30:00.000Z`);
    for (const body of [email.html, email.text]) {
      expect(body).toContain("16.10.2026");
      expect(body).toContain("10:30");
      expect(body).toContain("Ако сте добавили прегледа в календара си, моля, изтрийте стария час.");
      expect(body).toContain("/cancel/");
    }
    const [ics] = email.attachments ?? [];
    expect(ics.content).toContain("METHOD:PUBLISH");
    expect(ics.content).toContain("DTSTART:20261016T073000Z");
    expect(ics.content).toMatch(/SEQUENCE:[1-9]\d*/);
  });
});
