import nodemailer from 'nodemailer'
import { config } from '../config.js'

export class MailDeliveryError extends Error {}

export function actionLink(path, token) {
  const base = new URL(config.mail.appUrl)
  if (
    base.username ||
    base.password ||
    !['https:', 'http:'].includes(base.protocol) ||
    (base.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))
  ) {
    throw new MailDeliveryError('set MORROW_APP_URL to the app HTTPS address')
  }
  const link = new URL(path, base.origin)
  link.hash = new URLSearchParams({ token }).toString()
  return link.toString()
}

export async function sendEmail(message) {
  const settings = config.mail
  if (settings.transport === 'console') {
    console.info(`[dev email] To: ${message.to}\n${message.subject}\n${message.text}`)
    return
  }
  if (!settings.user || !settings.password || !settings.from) {
    throw new MailDeliveryError('email sending is not configured yet')
  }
  const transport = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    requireTLS: settings.port !== 465,
    auth: { user: settings.user, pass: settings.password },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true,
  })
  try {
    const result = await transport.sendMail({ ...message, from: settings.from })
    if (!result.accepted?.length) throw new Error('no recipient accepted')
  } catch {
    throw new MailDeliveryError('email could not be sent; please try again')
  } finally {
    transport.close()
  }
}
