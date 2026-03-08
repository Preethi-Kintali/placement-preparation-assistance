import cron from "node-cron";
import { User } from "../models/User";
import { fetchJobs } from "./jobSearch";
import { sendEmail } from "./mailer";
import { env } from "../config/env";

/**
 * Build an HTML email body from job results.
 */
function buildJobEmailHtml(
    name: string,
    careerPath: string,
    jobs: Array<{ title: string; company: string; location: string; applyLink: string; posted: string }>
): string {
    const jobRows = jobs
        .map(
            (j) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;">
          <strong style="color:#1a1a2e;">${j.title}</strong><br/>
          <span style="color:#555;">${j.company} · ${j.location}</span><br/>
          <span style="color:#888;font-size:12px;">${j.posted || "Recently"}</span>
          ${j.applyLink ? `<br/><a href="${j.applyLink}" style="color:#667eea;font-weight:600;text-decoration:none;">Apply →</a>` : ""}
        </td>
      </tr>`
        )
        .join("");

    return `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;">
    <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:24px;border-radius:12px 12px 0 0;">
      <h1 style="color:#fff;margin:0;font-size:22px;">🎯 Your Daily Job Digest</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;">Hi ${name}, here are today's top jobs for <strong>${careerPath}</strong></p>
    </div>
    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #eee;border-top:none;">
      ${jobRows}
    </table>
    <div style="padding:16px;text-align:center;background:#f9fafb;border-radius:0 0 12px 12px;border:1px solid #eee;border-top:none;">
      <p style="color:#888;font-size:12px;margin:0;">Sent by PlacePrep · Personalized Placement Assistance System</p>
    </div>
  </div>`;
}

/**
 * Send daily job emails to all registered students.
 */
async function sendDailyJobEmails() {
    console.log("[JobEmailCron] Starting daily job email dispatch...");

    try {
        const students = await User.find({ role: "student" }).lean();
        console.log(`[JobEmailCron] Found ${students.length} students`);

        let sent = 0;
        let failed = 0;

        for (const student of students) {
            const email = (student as any).profile?.email;
            const name = (student as any).profile?.fullName?.split(" ")[0] || "Student";
            const careerPath = (student as any).profile?.career?.careerPath || "Full Stack Developer";

            if (!email) continue;

            try {
                const jobs = await fetchJobs(careerPath);
                if (!jobs.length) continue;

                const html = buildJobEmailHtml(name, careerPath, jobs);

                const result = await sendEmail({
                    to: email,
                    subject: `🎯 Daily Job Digest – ${careerPath} (${new Date().toLocaleDateString("en-IN")})`,
                    text: `Hi ${name}, here are today's top ${careerPath} jobs:\n\n${jobs.map((j) => `${j.title} at ${j.company} (${j.location}) - ${j.applyLink}`).join("\n")}\n\nSent by PlacePrep`,
                    html,
                });

                if (result.skipped) {
                    // SMTP not configured, stop trying
                    console.log("[JobEmailCron] SMTP not configured, skipping all emails.");
                    return;
                }

                if (result.ok) sent++;
                else failed++;
            } catch (err) {
                console.error(`[JobEmailCron] Error for ${email}:`, err);
                failed++;
            }
        }

        console.log(`[JobEmailCron] Done: ${sent} sent, ${failed} failed`);
    } catch (err) {
        console.error("[JobEmailCron] Fatal error:", err);
    }
}

/**
 * Initialize the daily job email cron.
 * Runs at 21:00 IST (15:30 UTC) every day.
 */
export function initJobEmailCron() {
    if (!env.RAPIDAPI_KEY) {
        console.log("[JobEmailCron] Skipped – RAPIDAPI_KEY not set");
        return;
    }

    // 21:00 IST = 15:30 UTC
    cron.schedule("30 15 * * *", () => {
        sendDailyJobEmails();
    });

    console.log("[JobEmailCron] Scheduled daily job emails at 21:00 IST");
}
