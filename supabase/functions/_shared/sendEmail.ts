import type { EmailJob } from "./emailTypes.ts";
import { renderEmailTemplate } from "./renderEmailTemplate.ts";

export async function sendEmail(
  job: EmailJob,
  resendApiKey: string,
): Promise<void> {
  const FROM_EMAIL = Deno.env.get("RESEND_FROM") || "hello@mail.allagentconnect.com";
  const FROM_NAME = Deno.env.get("RESEND_FROM_NAME") || "All Agent Connect";

  const toList: string[] = Array.isArray(job.payload.to)
    ? job.payload.to
    : typeof job.payload.to === "string"
      ? job.payload.to
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  if (toList.length === 0) throw new Error("No valid recipients");

  const html =
    job.payload.html ||
    renderEmailTemplate(job.payload.template, job.payload.variables || {});

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: toList,
      subject: job.payload.subject,
      html,
      reply_to: job.payload.reply_to,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Resend API ${res.status}: ${JSON.stringify(err)}`,
    );
  }
}
