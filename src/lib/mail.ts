/**
 * Email abstraction. Ships with a Resend-ready integration that is disabled
 * unless RESEND_API_KEY is set; in development it logs to the console.
 *
 * Swapping providers (SendGrid, Postmark, SES) only requires reworking this
 * one module — callers are unchanged.
 */

type MailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

async function sendViaResend(input: MailInput): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM ?? "TaskFlow <no-reply@taskflow.app>",
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });
  if (!res.ok) throw new Error(`Email provider error: ${res.status}`);
}

export async function sendMail(input: MailInput): Promise<void> {
  if (process.env.RESEND_API_KEY) {
    await sendViaResend(input);
    return;
  }
  // Development logger — never throw so invites still work without a provider.
  console.info(`[mail:dev] to=${input.to} subject="${input.subject}"`);
}

export function buildInviteEmail(opts: {
  workspaceName: string;
  inviterName: string;
  inviteUrl: string;
  role: string;
}): { subject: string; html: string } {
  const { workspaceName, inviterName, inviteUrl, role } = opts;
  const subject = `${inviterName} invited you to ${workspaceName} on TaskFlow`;
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>You're invited!</h2>
      <p><strong>${inviterName}</strong> invited you to join the <strong>${workspaceName}</strong> workspace on TaskFlow as <strong>${role}</strong>.</p>
      <p style="margin: 24px 0;">
        <a href="${inviteUrl}" style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">
          Accept invitation
        </a>
      </p>
      <p style="color:#666;font-size:13px;">This invitation expires in 7 days. If you weren't expecting this, you can ignore this email.</p>
    </div>`;
  return { subject, html };
}