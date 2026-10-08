import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type EmailAttachment = {
  filename: string;
  /** UTF-8 text content. */
  content: string;
  contentType: string;
};

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
  /** Same key = same email; the provider drops duplicates (e.g. on retries). */
  idempotencyKey: string;
};

export type SendResult = { ok: true; id: string } | { ok: false; reason: string };

export type EmailTransport = (message: EmailMessage) => Promise<SendResult>;

const RESEND_URL = "https://api.resend.com/emails";

/** Resend REST API. Logs and returns only status codes, never message content. */
export function createResendTransport({
  apiKey,
  from,
  replyTo,
  fetchImpl = fetch,
  timeoutMs = 10_000,
}: {
  apiKey: string;
  from: string;
  replyTo?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): EmailTransport {
  return async (message) => {
    try {
      const response = await fetchImpl(RESEND_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": message.idempotencyKey,
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(replyTo ? { reply_to: replyTo } : {}),
          attachments: message.attachments?.map((a) => ({
            filename: a.filename,
            content: Buffer.from(a.content, "utf8").toString("base64"),
            content_type: a.contentType,
          })),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        return { ok: false, reason: `resend_http_${response.status}` };
      }
      const body = (await response.json()) as { id?: unknown };
      return { ok: true, id: typeof body.id === "string" ? body.id : "" };
    } catch (error) {
      return { ok: false, reason: `resend_${(error as Error).name}` };
    }
  };
}

/**
 * Local development without Resend: writes each email as an HTML preview plus
 * its attachments into `dir` (gitignored).
 */
export function createFileTransport(dir: string): EmailTransport {
  return async (message) => {
    const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${message.idempotencyKey.replace(/[^a-z0-9-]/gi, "_")}`;
    await mkdir(dir, { recursive: true });
    const header = `<!-- To: ${message.to} | Subject: ${message.subject} -->\n`;
    await writeFile(join(dir, `${id}.html`), header + message.html, "utf8");
    await writeFile(join(dir, `${id}.txt`), `To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}`, "utf8");
    for (const attachment of message.attachments ?? []) {
      await writeFile(join(dir, `${id}-${attachment.filename}`), attachment.content, "utf8");
    }
    return { ok: true, id };
  };
}

/**
 * Resend when RESEND_API_KEY is set. Without it: file previews locally, and an
 * error on Vercel (no writable disk; production must send real email).
 */
export function getEmailTransport(
  env: Record<string, string | undefined> = process.env,
): EmailTransport {
  // EMAIL_TRANSPORT=file forces file previews (used by the e2e tests).
  const forceFile = env.EMAIL_TRANSPORT === "file";
  const apiKey = forceFile ? undefined : env.RESEND_API_KEY?.trim();
  if (apiKey) {
    const from = env.EMAIL_FROM?.trim();
    if (!from) throw new Error("Invalid or missing environment variables: EMAIL_FROM");
    return createResendTransport({
      apiKey,
      from,
      replyTo: env.EMAIL_REPLY_TO?.trim() || undefined,
    });
  }
  if (env.VERCEL) {
    throw new Error("Invalid or missing environment variables: RESEND_API_KEY");
  }
  return createFileTransport(join(process.cwd(), ".emails"));
}
