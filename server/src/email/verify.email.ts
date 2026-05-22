import configuration from "../config/configuration";

import { getMailer } from "./mailer";



const VerifyEmail = async (email: string, token: string) => {

  const verifyUrl = `${configuration.API_PUBLIC_URL}/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`;



  const text = `

Verify your Task Planner account by opening this link in your browser:

${verifyUrl}



If you did not create an account, you can ignore this email.

  `.trim();



  const html = `

<!DOCTYPE html>

<html lang="en">

<head><meta charset="utf-8" /></head>

<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #0f172a;">

  <p>Thanks for signing up. Please confirm your email address.</p>

  <p>

    <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background: hsl(262.1 83.3% 57.8%); color: #fafafa; text-decoration: none; border-radius: 6px; font-weight: 600;">Verify Email</a>

  </p>

  <p style="font-size: 12px; color: #64748b;">If you did not create an account, you can ignore this message.</p>

</body>

</html>

  `.trim();



  await getMailer().sendMail({

    from: `"Task Planner" <${configuration.EMAIL}>`,

    to: email,

    subject: "Verify your email",

    text,

    html,

  });

};



export default VerifyEmail;

