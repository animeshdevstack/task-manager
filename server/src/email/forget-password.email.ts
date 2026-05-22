import configuration from "../config/configuration";
import { getMailer } from "./mailer";

const ForgetPasswordEmail = async (email: string, token: string) => {
  const link = `${configuration.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const text = `
You requested a password reset.
Open this link (or paste it in your browser):
${link}

If you did not request this, ignore this email.
  `.trim();

  await getMailer().sendMail({
    from: `"Task Planner" <${configuration.EMAIL}>`,
    to: email,
    subject: "Reset your password",
    text,
  });
};

export default ForgetPasswordEmail;
