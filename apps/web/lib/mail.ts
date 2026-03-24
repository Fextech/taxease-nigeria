import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const rawEmailFrom = process.env.EMAIL_FROM || "onboarding@resend.dev";
const senderName = process.env.SENDER_NAME || "Banklens";
const FROM_EMAIL = rawEmailFrom.includes("<")
  ? rawEmailFrom
  : `${senderName} <${rawEmailFrom}>`;

const LOGO_SVG = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1500 600" width="180" height="72" style="display:block;">
<style type="text/css">.st0{fill:#2D484C;}.st1{fill:#E39F51;}.st2{fill:#FFFFFF;stroke:#2D484C;stroke-miterlimit:10;}.st3{fill:#E2EBEE;}.st4{fill:#A4BCCA;}.st5{fill:#00FFFF;fill-opacity:0.1;}.st6{fill:#22494C;}</style>
<g id="Layer_1"><g>
<path class="st0" d="M294.5,386.6V188.8h75.9c14.3,0,26.1,2.2,35.6,6.7c9.5,4.5,16.6,10.6,21.2,18.3c4.7,7.7,7,16.5,7,26.2c0,8.1-1.5,14.9-4.6,20.6c-3.1,5.7-7.2,10.3-12.4,13.9c-5.2,3.5-11.1,6.1-17.5,7.7v2c7.1,0.3,13.8,2.4,20.2,6.3c6.4,3.9,11.7,9.4,15.8,16.5c4.1,7.1,6.2,15.6,6.2,25.6c0,10.3-2.5,19.5-7.4,27.6c-4.9,8.1-12.3,14.5-22.3,19.3c-10,4.7-22.5,7.1-37.6,7.1H294.5z M330.4,272.9H366c6.1,0,11.6-1.1,16.6-3.5c5-2.3,8.9-5.6,11.8-9.8c2.9-4.2,4.3-9.2,4.3-14.9c0-7.6-2.7-13.9-8.1-18.9c-5.4-5-13.3-7.5-23.8-7.5h-36.4V272.9z M330.4,356.7h38.5c13,0,22.4-2.5,28.2-7.6c5.8-5,8.7-11.5,8.7-19.3c0-5.9-1.5-11.2-4.4-15.9c-2.9-4.7-7.1-8.4-12.4-11.2c-5.4-2.7-11.7-4.1-18.9-4.1h-39.7V356.7z"/>
<path class="st0" d="M497.7,389.7c-9.5,0-18-1.7-25.5-5.1c-7.5-3.4-13.5-8.4-17.8-15.1c-4.3-6.6-6.5-14.8-6.5-24.6c0-8.3,1.5-15.2,4.6-20.7c3.1-5.5,7.3-9.9,12.7-13.1c5.4-3.3,11.4-5.8,18.1-7.5c6.7-1.7,13.7-2.9,20.8-3.7c8.8-1,15.8-1.8,21.2-2.5c5.4-0.7,9.3-1.9,11.8-3.5c2.4-1.6,3.7-4.1,3.7-7.4v-0.7c0-7.2-2.1-12.7-6.4-16.7c-4.2-4-10.4-6-18.6-6c-8.6,0-15.4,1.9-20.4,5.6c-5,3.7-8.4,8.1-10.2,13.1l-32.5-4.6c2.6-9,6.8-16.6,12.7-22.6c5.9-6.1,13.2-10.6,21.7-13.7c8.5-3.1,18-4.6,28.3-4.6c7.1,0,14.2,0.8,21.2,2.5c7.1,1.6,13.6,4.4,19.5,8.3c5.9,3.9,10.7,9.1,14.2,15.7c3.5,6.6,5.3,14.7,5.3,24.6v99.3h-33.6v-20.4h-1.1c-2.1,4.1-5.1,7.9-9,11.5s-8.6,6.5-14.3,8.7C512.2,388.5,505.4,389.7,497.7,389.7z M506.6,363.9c7.1,0,13.2-1.4,18.3-4.2c5.1-2.8,9.1-6.5,12-11.2c2.8-4.6,4.2-9.7,4.2-15.2V316c-1.2,0.9-3,1.7-5.6,2.5c-2.6,0.8-5.5,1.4-8.8,2.1c-3.3,0.6-6.5,1.2-9.6,1.6c-3.1,0.4-5.9,0.8-8.2,1.1c-5.2,0.7-9.9,1.9-14,3.5c-4.1,1.6-7.4,3.9-9.8,6.7c-2.4,2.8-3.6,6.5-3.6,11c0,6.5,2.3,11.3,7,14.6C493.3,362.3,499.3,363.9,506.6,363.9z"/>
<path class="st0" d="M629.9,299.8v86.8H595V238.2h34.3v25.4h1.7c3.4-8.3,8.7-14.9,15.9-19.9c7.2-4.9,16.4-7.4,27.6-7.4c10.3,0,19.2,2.2,26.8,6.5c7.6,4.3,13.5,10.7,17.7,19.1c4.2,8.4,6.3,18.5,6.3,30.3v94.4h-34.9v-89c0-9.9-2.6-17.7-7.7-23.3c-5.1-5.6-12.2-8.4-21.2-8.4c-6.1,0-11.5,1.3-16.3,4c-4.7,2.7-8.5,6.5-11.2,11.5C631.2,286.4,629.9,292.5,629.9,299.8z"/>
<path class="st0" d="M744.2,386.6V188.8h34.9v197.8H744.2z M776,340.1l-0.1-42.4h5.7l53.2-59.6h40.9l-65.6,73.2h-7.3L776,340.1z M837.3,386.6l-48.3-67.5l23.6-24.7l66.5,92.1H837.3z"/>
</g><g>
<path class="st1" d="M901,392.8V195H919v181.6h94.4v16.2H901z"/>
<path class="st1" d="M1095.2,396c-13.8,0-25.8-3.3-36-9.8c-10.2-6.5-18-15.5-23.5-27c-5.5-11.5-8.2-24.7-8.2-39.7c0-15,2.7-28.2,8.2-39.8c5.4-11.6,13-20.7,22.8-27.4c9.7-6.6,21-10,33.9-10c8,0,15.7,1.5,23.2,4.4c7.5,3,14.3,7.5,20.3,13.5c6,6,10.8,13.7,14.2,22.9c3.5,9.3,5.2,20.2,5.2,33v7.7h-115.9v-15.1h106.6l-7.8,5.8c0-10.8-1.8-20.4-5.5-28.9c-3.7-8.5-8.9-15.2-15.7-20.2c-6.8-5-15-7.4-24.6-7.4c-9.5,0-17.8,2.5-25,7.5c-7.2,5-12.7,11.6-16.7,19.9c-3.9,8.3-5.9,17.3-5.9,27.2v8.9c0,11.9,2.1,22.2,6.2,31c4.1,8.8,10,15.6,17.5,20.5c7.6,4.9,16.5,7.3,26.8,7.3c7,0,13.1-1.1,18.5-3.3c5.3-2.2,9.8-5.2,13.4-9c3.6-3.8,6.4-7.9,8.2-12.3l16.3,5.4c-2.3,6.2-6,11.9-11.1,17.2c-5.1,5.3-11.5,9.5-19.1,12.7C1113.8,394.4,1105,396,1095.2,396z"/>
<path class="st1" d="M1194.1,300.2v92.7H1177V244.4h16.6v23.5h1.7c3.5-7.7,8.9-13.9,16.2-18.5c7.3-4.6,16.5-6.9,27.4-6.9c10,0,18.8,2.1,26.4,6.2c7.6,4.2,13.5,10.3,17.7,18.3c4.2,8.1,6.4,18,6.4,29.7v96h-17.1v-94.9c0-12.1-3.4-21.8-10.2-28.9c-6.8-7.2-15.9-10.8-27.4-10.8c-7.8,0-14.7,1.7-20.8,5.1c-6.1,3.4-10.9,8.2-14.4,14.5C1195.9,284,1194.1,291.5,1194.1,300.2z"/>
<path class="st1" d="M1419,277.2l-15.7,4.2c-2.3-6.6-6.1-12.3-11.5-16.9c-5.4-4.6-13-7-23-7c-10,0-18.2,2.4-24.7,7.2c-6.5,4.8-9.7,11-9.7,18.5c0,6.3,2.2,11.4,6.6,15.5c4.4,4,11.2,7.2,20.4,9.5l22.4,5.4c12.4,3.1,21.7,7.9,28,14.4c6.2,6.5,9.4,14.7,9.4,24.6c0,8.3-2.3,15.8-7,22.3c-4.6,6.6-11.1,11.7-19.3,15.4c-8.2,3.7-17.8,5.6-28.7,5.6c-14.5,0-26.5-3.3-35.9-9.9c-9.4-6.6-15.4-16-18.1-28.3l16.5-4c2,8.8,6.2,15.4,12.5,19.9c6.3,4.5,14.5,6.8,24.7,6.8c11.3,0,20.4-2.6,27.4-7.7c6.9-5.1,10.4-11.5,10.4-19.1c0-12.2-8.1-20.3-24.3-24.3l-24.2-5.8c-12.9-3.1-22.5-8-28.7-14.6c-6.2-6.6-9.3-14.9-9.3-24.8c0-8.1,2.2-15.4,6.7-21.6c4.5-6.3,10.6-11.2,18.4-14.7c7.8-3.5,16.6-5.3,26.6-5.3c13.6,0,24.5,3.1,32.7,9.4C1409.6,258,1415.5,266.5,1419,277.2z"/>
</g></g>
<g id="icon"><g><g>
<path class="st2" d="M187.6,324.7H86.8c-4.4,0-8-3.6-8-8V167.8c0-4.4,3.6-8,8-8h100.8c4.4,0,8,3.6,8,8v148.9C195.6,321.1,192,324.7,187.6,324.7z"/>
<path class="st3" d="M80.1,221.3c2.8,11.7,25,92.1,88.7,102.8l-77.2,0c-6.3,0.1-11.5-5-11.5-11.4V221.3z"/>
<circle class="st4" cx="109.2" cy="200.2" r="11.5"/>
<path class="st4" d="M170.3,197.5h-39.8c-0.9,0-1.7-0.8-1.7-1.7v-1.7c0-0.9,0.8-1.7,1.7-1.7h39.8c0.9,0,1.7,0.8,1.7,1.7v1.7C172,196.8,171.2,197.5,170.3,197.5z"/>
<path class="st4" d="M156.4,234.2H98.2c-0.9,0-1.7-0.8-1.7-1.7v-1.7c0-0.9,0.8-1.7,1.7-1.7h58.2c0.9,0,1.7,0.8,1.7,1.7v1.7C158.1,233.4,157.3,234.2,156.4,234.2z"/>
</g><g>
<path class="st2" d="M246.7,389H125.3c-4.4,0-8-3.6-8-8V203c0-4.4,3.6-8,8-8h121.4c4.4,0,8,3.6,8,8v178C254.7,385.4,251.1,389,246.7,389z"/>
<path class="st3" d="M118.8,267.3c3.3,13.8,29.4,108.4,104.4,121l-90.8,0c-7.5,0.1-13.6-5.9-13.6-13.4V267.3z"/>
<circle class="st4" cx="153" cy="242.5" r="13.6"/>
<path class="st1" d="M222.3,354c-36.3,0-65.9-29.6-65.9-65.9s29.6-65.9,65.9-65.9c36.3,0,65.9,29.6,65.9,65.9S258.6,354,222.3,354z M222.3,237.1c-28.1,0-51,22.9-51,51c0,28.1,22.9,51,51,51s51-22.9,51-51C273.3,260,250.4,237.1,222.3,237.1z"/>
<path class="st1" d="M354,368.2l-4.4,6.9c-3.4,5.2-10.3,6.7-15.5,3.3l-40.4-26.1c-5.2-3.4-6.7-10.3-3.3-15.5l4.4-6.9c3.4-5.2,10.3-6.7,15.5-3.3l40.4,26.1C355.9,356.1,357.4,363,354,368.2z"/>
</g></g></g>
</svg>`;

export async function sendWelcomeEmail(email: string, name: string) {
  const firstName = name.split(" ")[0];
  const appUrl = process.env.NEXTAUTH_URL || "https://app.banklensng.com";

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Welcome to Banklens Nigeria 🎉",
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Banklens Nigeria</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header with brand gradient -->
          <tr>
            <td style="background:linear-gradient(135deg,#2D484C 0%,#1a3639 100%);padding:36px 40px 28px;text-align:center;">
              <div style="background-color:#ffffff;border-radius:12px;padding:16px 24px;display:inline-block;box-shadow:0 2px 8px rgba(0,0,0,0.15);">
                ${LOGO_SVG}
              </div>
              <p style="margin:20px 0 0;font-size:13px;color:#a4bcca;letter-spacing:0.5px;text-transform:uppercase;">Statement Analysis & Annotation for PIT</p>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h1 style="margin:0 0 12px;font-size:26px;font-weight:700;color:#1a3639;line-height:1.3;">
                Welcome aboard, ${firstName}! 🎉
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.7;">
                You've successfully created your Banklens account. We're excited to help you take the stress out of personal income tax compliance — no accountant required.
              </p>

              <!-- Feature list -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="padding:14px 16px;background:#f8fafb;border-radius:10px;margin-bottom:10px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="36" style="font-size:20px;">📂</td>
                        <td>
                          <p style="margin:0;font-size:14px;font-weight:600;color:#1a3639;">Upload your bank statements</p>
                          <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">PDF, CSV, or Excel — we handle them all</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr><td style="height:8px;"></td></tr>
                <tr>
                  <td style="padding:14px 16px;background:#f8fafb;border-radius:10px;margin-bottom:10px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="36" style="font-size:20px;">🤖</td>
                        <td>
                          <p style="margin:0;font-size:14px;font-weight:600;color:#1a3639;">AI-powered transaction parsing</p>
                          <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">AI extracts your transactions automatically for easy review and annotation</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr><td style="height:8px;"></td></tr>
                <tr>
                  <td style="padding:14px 16px;background:#f8fafb;border-radius:10px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="36" style="font-size:20px;">🧮</td>
                        <td>
                          <p style="margin:0;font-size:14px;font-weight:600;color:#1a3639;">Accurate PITA tax computation</p>
                          <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">Nigeria's Personal Income Tax Act graduated bands, computed for you</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA button -->
              <div style="text-align:center;margin-bottom:32px;">
                <a href="${appUrl}/sign-in"
                   style="display:inline-block;padding:15px 40px;background:#E39F51;color:#ffffff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.3px;">
                  Get Started →
                </a>
              </div>

              <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.7;">
                Have any questions? Reach out to our support team at
                <a href="mailto:${process.env.SUPPORT_EMAIL || "support@flowiselabs.com"}" style="color:#2D484C;text-decoration:none;font-weight:600;">${process.env.SUPPORT_EMAIL || "support@flowiselabs.com"}</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
                © ${new Date().getFullYear()} Banklens Nigeria by <a href="https://www.flowiselabs.com" style="color:#9ca3af;text-decoration:underline;">Flowiselabs</a> · All rights reserved<br/>
                You're receiving this because you created an account on Banklens Nigeria.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  });
}

// send password reset email

export async function sendPasswordResetEmail(email: string, token: string) {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Reset your Banklens password",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 24px; color: #1a3639; margin-bottom: 8px;">Banklens Nigeria</h1>
          <p style="font-size: 14px; color: #6b7280;">Password Reset Request</p>
        </div>
        <p style="font-size: 15px; color: #374151; line-height: 1.6;">
          You requested a password reset. Click the button below to set a new password.
          This link expires in <strong>1 hour</strong>.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background: #f0a030; color: #ffffff; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px;">
            Reset Password
          </a>
        </div>
        <p style="font-size: 13px; color: #9ca3af; line-height: 1.5;">
          If you didn't request this, you can safely ignore this email. Your password will remain unchanged.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">
          Banklens Nigeria — Simplify your tax returns
        </p>
      </div>
    `,
  });
}

export async function sendPasswordChangedEmail(email: string, name: string) {
  const firstName = name?.split(" ")[0] || "there";
  const supportEmail = process.env.SUPPORT_EMAIL || "support@flowiselabs.com";
  const appUrl = process.env.NEXTAUTH_URL || "https://app.banklensng.com";
  const changedAt = new Date().toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
    timeZoneName: "short",
  });

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Your Banklens password was changed",
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Password Changed</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#2D484C 0%,#1a3639 100%);padding:36px 40px 28px;text-align:center;">
              <div style="background-color:#ffffff;border-radius:12px;padding:16px 24px;display:inline-block;box-shadow:0 2px 8px rgba(0,0,0,0.15);">
                ${LOGO_SVG}
              </div>
            </td>
          </tr>

          <!-- Alert banner -->
          <tr>
            <td style="background:#fff7ed;border-left:4px solid #E39F51;padding:16px 40px;">
              <p style="margin:0;font-size:13px;color:#92400e;font-weight:600;">
                🔐 Security Notice — Password Changed
              </p>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td style="padding:36px 40px 32px;">
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1a3639;">
                Hi ${firstName},
              </h1>
              <p style="margin:0 0 20px;font-size:15px;color:#4b5563;line-height:1.7;">
                We're letting you know that the password for your Banklens account was successfully changed on <strong>${changedAt}</strong>.
              </p>

              <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.7;">
                If you made this change, no further action is needed.
              </p>

              <!-- 2FA tip -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#15803d;">🛡️ Keep your account extra secure</p>
                    <p style="margin:0 0 12px;font-size:13px;color:#6b7280;line-height:1.6;">
                      Enable two-factor authentication (2FA) so that even if your password is ever compromised, no one can access your account without your authenticator app.
                    </p>
                    <a href="${appUrl}/settings?tab=security" style="display:inline-block;padding:9px 20px;background:#15803d;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;">
                      Enable 2FA →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Warning box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;background:#fef2f2;border-radius:10px;border:1px solid #fecaca;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#b91c1c;">⚠️ Didn't make this change?</p>
                    <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
                      If you did not change your password, your account may be compromised. Please
                      <a href="${appUrl}/forgot-password" style="color:#b91c1c;font-weight:600;text-decoration:none;">reset your password immediately</a>
                      and contact our support team.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.7;">
                Need help? Contact us at
                <a href="mailto:${supportEmail}" style="color:#2D484C;text-decoration:none;font-weight:600;">${supportEmail}</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
                © ${new Date().getFullYear()} Banklens Nigeria by <a href="https://www.flowiselabs.com" style="color:#9ca3af;text-decoration:underline;">Flowiselabs</a> · All rights reserved<br/>
                You're receiving this because a password change was made to your account.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  });
}
