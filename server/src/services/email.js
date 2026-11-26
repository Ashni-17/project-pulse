
import 'dotenv/config';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  requireTLS: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function verifyEmailConnection() {
  await transporter.verify();
}

export async function sendVerificationEmail(email, otp) {
  return transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'Verify your Project Pulse account',

    text: `Your Project Pulse verification code is ${otp}.
This code expires in 5 minutes.
Do not share this code with anyone.
If you did not request this code, ignore this email.`,

    html: `
      <div style="font-family:Arial,sans-serif;
                  background:#f4f7fb;padding:30px;">
        <div style="max-width:480px;margin:auto;
                    background:white;padding:32px;
                    border-radius:16px;">

          <h1 style="color:#0d9488;">
            Project Pulse
          </h1>

          <h2 style="color:#172033;">
            Verify your email address
          </h2>

          <p style="color:#64748b;line-height:1.6;">
            Welcome to Project Pulse!
            Use the verification code below to
            complete your account registration.
          </p>

          <div style="background:#ecfdf5;
                      padding:22px;text-align:center;
                      border-radius:12px;
                      font-size:32px;font-weight:bold;
                      letter-spacing:10px;color:#0f766e;">
            ${otp}
          </div>

          <p style="color:#64748b;">
            This code expires in <strong>5 minutes</strong>.
          </p>

          <p style="color:#64748b;font-size:13px;">
            Do not share this code with anyone.
            If you did not request this verification,
            you can safely ignore this email.
          </p>

          <hr style="border:0;
                     border-top:1px solid #e2e8f0;">

          <p style="color:#94a3b8;font-size:12px;">
            Project Pulse | Plan. Collaborate. Deliver.
          </p>

        </div>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(email, otp) {
  return transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'Reset your Project Pulse password',

    text: `
Your Project Pulse password reset code is ${otp}.

This code expires in 5 minutes.

Do not share this code with anyone.

If you did not request a password reset,
you can safely ignore this email.
    `,

    html: `
      <div style="background:#f1f5f9;padding:30px;font-family:Arial,sans-serif;">
        <div style="max-width:500px;margin:auto;background:#ffffff;border-radius:16px;padding:32px;">

          <h2 style="color:#0d9488;margin-top:0;">
            Project Pulse
          </h2>

          <h2 style="color:#0f172a;">
            Reset your password
          </h2>

          <p style="color:#475569;line-height:1.6;">
            We received a request to reset your Project Pulse password.
            Use the verification code below to continue.
          </p>

          <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:22px;text-align:center;margin:24px 0;">

            <span style="font-size:32px;font-weight:bold;letter-spacing:10px;color:#0f766e;">
              ${otp}
            </span>

          </div>

          <p style="color:#475569;">
            This code expires in <strong>5 minutes.</strong>
          </p>

          <p style="color:#b45309;font-size:13px;">
            For your security, do not share this code with anyone.
          </p>

          <hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0;">

          <p style="font-size:12px;color:#64748b;">
            If you did not request a password reset,
            you can safely ignore this email.
          </p>

          <p style="font-size:12px;color:#94a3b8;">
            Project Pulse | Plan. Collaborate. Deliver.
          </p>

        </div>
      </div>
    `,
  });
}