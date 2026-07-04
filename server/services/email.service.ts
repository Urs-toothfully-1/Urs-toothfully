import nodemailer from "nodemailer"

let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_APP_PASSWORD
  if (!user || !pass) {
    throw new Error("Email is not configured — set SMTP_USER and SMTP_APP_PASSWORD in .env")
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    })
  }
  return transporter
}

export async function sendEmailWithAttachment(opts: {
  to: string
  subject: string
  text: string
  attachment: { filename: string; content: Buffer }
}): Promise<void> {
  const fromName = process.env.SMTP_FROM_NAME ?? "Ur's Toothfully"
  await getTransporter().sendMail({
    from: `"${fromName}" <${process.env.SMTP_USER}>`,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    attachments: [{ filename: opts.attachment.filename, content: opts.attachment.content }],
  })
}
