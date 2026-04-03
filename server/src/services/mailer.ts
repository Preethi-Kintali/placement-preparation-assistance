import nodemailer from "nodemailer";
import { env } from "../config/env";

function isConfigured() {
  return Boolean(env.SMTP_ENABLED && env.SMTP_USER && env.SMTP_PASS);
}

function fromAddress() {
  return env.SMTP_FROM || env.SMTP_USER || "no-reply@placeprep";
}

let _transporter: any = null;

function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
      connectionTimeout: 8000,   // 8s to connect
      greetingTimeout: 8000,     // 8s for SMTP greeting
      socketTimeout: 15000,      // 15s per socket operation
      pool: true,                // use connection pooling
      maxConnections: 3,         // max 3 simultaneous connections
      maxMessages: 20,           // max 20 messages per connection
    });
  }
  return _transporter;
}

// Pre-warm the SMTP connection pool on startup (non-blocking)
let _verified = false;
function warmupTransporter() {
  if (!isConfigured() || _verified) return;
  try {
    const t = getTransporter();
    if (!t) return;
    t.verify()
      .then(() => {
        _verified = true;
        console.log("[Mailer] SMTP connection verified ✅");
      })
      .catch((e) => {
        console.warn("[Mailer] SMTP verify failed (emails may still work):", e?.message);
      });
  } catch {
    // silent — will retry on first send
  }
}

// Call warmup after 2 seconds of server start
setTimeout(warmupTransporter, 2000);

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!isConfigured()) return { ok: true, skipped: true };

  try {
    const transporter = getTransporter();
    if (!transporter) return { ok: false, error: "Transporter not available" };

    await transporter.sendMail({
      from: fromAddress(),
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
    });

    console.log(`[Mailer] Email sent to ${input.to}: "${input.subject}"`);
    return { ok: true };
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    console.error("[Mailer] Error:", msg);

    // If auth failed, log helpful message
    if (msg.includes("XOAUTH2") || msg.includes("Username and Password not accepted")) {
      console.error("[Mailer] 💡 Gmail requires an App Password. Go to https://myaccount.google.com/apppasswords to generate one.");
    }
    if (msg.includes("ECONNREFUSED") || msg.includes("EHOSTUNREACH")) {
      console.error("[Mailer] 💡 Cannot reach SMTP server. Check your internet connection or firewall.");
    }

    return { ok: false, error: msg };
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
  // Use setTimeout to fully detach from the current request context
  setTimeout(() => {
    sendEmail(input).catch((e) =>
      console.error("[Mailer] Background send failed:", e?.message ?? e)
    );
  }, 50);
}
