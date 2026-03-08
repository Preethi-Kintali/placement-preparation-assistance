import nodemailer from "nodemailer";
import { env } from "../config/env";

function isConfigured() {
  return Boolean(env.SMTP_ENABLED && env.SMTP_USER && env.SMTP_PASS);
}

function fromAddress() {
  return env.SMTP_FROM || env.SMTP_USER || "no-reply@placeprep";
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!isConfigured()) return { ok: true, skipped: true };

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: fromAddress(),
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
    });

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}
