/**
 * Email utilities using Postmark.
 */

interface SendEmailOptions {
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  fromName?: string;
  replyTo?: string;
}

interface EmailConfig {
  postmarkToken: string;
  fromEmail: string;
  messageStream?: string;
}

function formatFromAddress(fromEmail: string, fromName?: string): string {
  if (!fromName) {
    return fromEmail;
  }

  const safeName = fromName.replace(/[\r\n<>]/g, " ").replace(/"/g, '\\"').trim();
  if (!safeName) {
    return fromEmail;
  }

  return `"${safeName}" <${fromEmail}>`;
}

export async function sendEmail(
  config: EmailConfig,
  options: SendEmailOptions,
): Promise<boolean> {
  try {
    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": config.postmarkToken,
      },
      body: JSON.stringify({
        From: formatFromAddress(config.fromEmail, options.fromName),
        To: options.to,
        Subject: options.subject,
        TextBody: options.textBody,
        HtmlBody: options.htmlBody,
        ReplyTo: options.replyTo,
        MessageStream: config.messageStream || "outbound",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Postmark error:", error);
    }

    return response.ok;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

export async function sendAuthCodeEmail(
  config: EmailConfig,
  email: string,
  code: string,
): Promise<boolean> {
  const subject = `Your Human Soup sign-in code: ${code}`;

  const textBody = `Your Human Soup sign-in code is: ${code}

This code expires in 10 minutes.

If you didn't request this code, you can safely ignore this email.

- thehumansoup.app`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; background: #f4eee3;">
  <div style="max-width: 420px; margin: 0 auto; background: #fffaf1; border-radius: 14px; padding: 36px; text-align: center; border: 1px solid rgba(47, 42, 37, 0.12);">
    <h1 style="margin: 0 0 8px; font-size: 24px; color: #2f2a25;">The Human Soup</h1>
    <p style="margin: 0 0 28px; color: #6c5a4a; font-size: 14px;">Publish once. Feed many.</p>
    <p style="margin: 0 0 16px; color: #2f2a25; font-size: 16px;">Your sign-in code is:</p>
    <div style="background: #efe4d1; border-radius: 10px; padding: 18px; margin: 0 0 22px;">
      <span style="font-size: 30px; font-weight: 700; letter-spacing: 8px; color: #2f2a25;">${code}</span>
    </div>
    <p style="margin: 0 0 8px; color: #6c5a4a; font-size: 14px;">This code expires in 10 minutes.</p>
    <p style="margin: 0; color: #8a7d70; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
  </div>
</body>
</html>
`;

  return sendEmail(config, {
    to: email,
    subject,
    textBody,
    htmlBody,
    fromName: "The Human Soup",
  });
}
