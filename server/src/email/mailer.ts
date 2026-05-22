import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import configuration from "../config/configuration";

/** Gmail app passwords are often shown with spaces; SMTP auth expects the raw 16 characters */
function normalizeSmtpPassword(pass: string): string {
  return pass.replace(/\s+/g, "").trim();
}

let transporter: Transporter | null = null;

export function getMailer(): Transporter {
  if (transporter) return transporter;

  const { EMAIL, PASSWORD, SMTP_HOST, SMTP_PORT, SMTP_SECURE } = configuration;
  if (!EMAIL || !PASSWORD) {
    throw new Error(
      "Missing EMAIL or PASSWORD in configuration — set them in .env to send mail.",
    );
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: EMAIL,
      pass: normalizeSmtpPassword(PASSWORD),
    },
  });

  return transporter;
}
