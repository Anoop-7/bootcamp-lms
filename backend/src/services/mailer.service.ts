import nodemailer, { type Transporter } from "nodemailer";

interface SendOtpOptions {
  to: string;
  otp: string;
  type: "SIGNUP" | "LOGIN" | "PASSWORD_RESET";
}

export interface SendOtpResult {
  delivered: boolean;
  devOtp?: string;
}

export class MailerService {
  private transporter: Transporter | null = null;

  constructor() {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user, pass },
      });
    }
  }

  async sendOtp({ to, otp, type }: SendOtpOptions): Promise<SendOtpResult> {
    const isDev = process.env.NODE_ENV !== "production";

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: `"Bootcamp Platform" <${process.env.SMTP_USER}>`,
          to,
          subject: `${otp} is your verification code`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #262626; border-radius: 12px; background-color: #0c0c0e; color: #ededed;">
              <h2 style="color: #ffffff; font-size: 20px; font-weight: bold; margin-bottom: 8px;">Verification Code</h2>
              <p style="color: #a1a1aa; font-size: 14px; margin-bottom: 20px;">Use the one-time passcode below to complete your <strong>${type.replace("_", " ")}</strong> request:</p>
              <div style="background-color: #18181b; border: 1px solid #27272a; padding: 14px; border-radius: 8px; text-align: center; font-size: 28px; font-family: monospace; font-weight: bold; letter-spacing: 6px; color: #6366f1;">
                ${otp}
              </div>
              <p style="color: #71717a; font-size: 12px; margin-top: 20px;">This code expires in 10 minutes. If you did not request this verification, you can safely ignore this email.</p>
            </div>
          `,
        });

        return { delivered: true };
      } catch (err: any) {
        console.warn(`[MAILER WARNING] SMTP dispatch failed: ${err.message}`);
        if (!isDev) {
          throw new Error("EMAIL_DISPATCH_FAILED");
        }
      }
    }

    console.log(`[AUTH DEV FALLBACK] Recipient: ${to} | Code: ${otp} | Action: ${type}`);
    return {
      delivered: false,
      devOtp: isDev ? otp : undefined,
    };
  }
}