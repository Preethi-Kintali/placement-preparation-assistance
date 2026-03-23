import nodemailer from "nodemailer";
import { env } from "../config/env";

function isConfigured() {
  return Boolean(env.SMTP_ENABLED && env.SMTP_USER && env.SMTP_PASS);
}

function fromAddress() {
  return env.SMTP_FROM || env.SMTP_USER || "no-reply@placeprep";
}

let _transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
      connectionTimeout: 5000,   // 5s to connect
      greetingTimeout: 5000,     // 5s for SMTP greeting
      socketTimeout: 10000,      // 10s per socket operation
    });
  }
  return _transporter;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!isConfigured()) return { ok: true, skipped: true };

  try {
    const transporter = getTransporter();

    await transporter.sendMail({
      from: fromAddress(),
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
    });

    return { ok: true };
  } catch (e: any) {
    console.error("[Mailer] Error:", e?.message ?? e);
    return { ok: false, error: String(e?.message ?? e) };
  }
}

/**
 * Fire-and-forget email: sends in the background without blocking.
 * Use this for notification emails that don't affect the API response.
 */
export function sendEmailInBackground(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  sendEmail(input).catch((e) =>
    console.error("[Mailer] Background send failed:", e?.message ?? e)
  );
}
