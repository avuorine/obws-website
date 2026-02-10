import { resend } from './resend'

interface Attachment {
  filename: string
  content: Buffer
}

interface SendEmailOptions {
  from: string
  to: string
  subject: string
  html: string
  attachments?: Attachment[]
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    const nodemailer = await import('nodemailer')
    const transport = nodemailer.createTransport({
      host: 'localhost',
      port: 1025,
      secure: false,
    })
    await transport.sendMail({
      from: options.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    })
    return
  }

  await resend.emails.send({
    from: options.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    attachments: options.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
    })),
  })
}
