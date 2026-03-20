import { Resend } from "resend";

const FROM_EMAIL = process.env.EMAIL_FROM || "BankLens Support <onboarding@resend.dev>";

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  return new Resend(apiKey);
}

export async function sendSupportReplyEmail({
  email,
  name,
  subject,
  ticketId,
  replyBody,
}: {
  email: string;
  name: string;
  subject: string;
  ticketId: string;
  replyBody: string;
}) {
  const resend = getResendClient();

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Re: ${subject} [Ticket #${ticketId.slice(-8)}]`,
    html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #374151;">
  <div style="background: #0a0a0f; padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: #00ffd8; margin: 0; font-size: 24px; letter-spacing: -0.025em; font-weight: 800;">BankLens Nigeria</h1>
    <p style="color: rgba(255, 255, 255, 0.6); margin-top: 4px; font-size: 14px;">Support Desk</p>
  </div>
  
  <div style="padding: 40px 32px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
    <p style="font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 24px;">Hi ${name || "there"},</p>
    
    <p style="font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
      Our support team has replied to your ticket: <strong style="color: #111827;">${subject}</strong>
    </p>
    
    <div style="background: #f8fafc; border-left: 4px solid #E4A051; padding: 24px; border-radius: 0 12px 12px 0; margin: 32px 0; font-size: 15px; line-height: 1.7; color: #1e293b; box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.05);">
      ${replyBody}
    </div>
    
    <p style="font-size: 14px; color: #64748b; line-height: 1.5; margin-top: 32px;">
      If you have further questions, simply reply directly to this email or submit a new request via your dashboard.
    </p>
  </div>
  
  <div style="padding: 32px 24px; text-align: center; color: #94a3b8; font-size: 12px; line-height: 1.5;">
    <div>
      &copy; ${new Date().getFullYear()} <a href="https://banklens.flowiselabs.com" style="color: #94a3b8; text-decoration: underline;">BankLens Nigeria</a>. All rights reserved.<br/>
      <span style="color: #cbd5e1;">Personal Income Tax Compliance Platform for Nigerian Taxpayers</span>
    </div>
  </div>
</div>
    `,
  });
}

export async function sendBroadcastEmail({
  email,
  name,
  subject,
  body,
}: {
  email: string;
  name: string;
  subject: string;
  body: string;
}) {
  const resend = getResendClient();

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject,
    html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #374151;">
  <div style="background: #0a0a0f; padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: #00ffd8; margin: 0; font-size: 24px; letter-spacing: -0.025em; font-weight: 800;">BankLens Nigeria</h1>
  </div>
  
  <div style="padding: 40px 32px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
    <p style="font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 24px;">Hi ${name || "there"},</p>
    
    <div style="font-size: 15px; line-height: 1.7; color: #1e293b;">
      ${body}
    </div>
  </div>
  
  <div style="padding: 32px 24px; text-align: center; color: #94a3b8; font-size: 12px; line-height: 1.5;">
    <div>
      &copy; ${new Date().getFullYear()} <a href="https://banklens.flowiselabs.com" style="color: #94a3b8; text-decoration: underline;">BankLens Nigeria</a>. All rights reserved.<br/>
      <span style="color: #cbd5e1;">Personal Income Tax Compliance Platform for Nigerian Taxpayers</span>
    </div>
  </div>
</div>
    `,
  });
}
