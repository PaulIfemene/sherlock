// Send one demo rising-claim email through Gmail SMTP to check delivery and rendering.
//   npm run email:test -- you@example.com
import 'dotenv/config'
import { smtpMailer } from '../engine/adapters/email'

const to = process.argv[2]
if (!to || !/^\S+@\S+\.\S+$/.test(to)) {
  console.error('Usage: npm run email:test -- you@example.com')
  process.exit(1)
}
if (!process.env.SMTP_USER || !process.env.SMTP_APP_PASSWORD) {
  console.error('Set SMTP_USER and SMTP_APP_PASSWORD (a Gmail app password) in .env first.')
  process.exit(1)
}
await smtpMailer(process.env).sendRisingAlert([to], {
  claimText: 'Monday is an official public holiday, according to a ministry notice.',
  count: 100,
  delta: 99,
  language: 'Luganda',
  dashboardUrl: `${process.env.URL ?? 'http://localhost:5173'}/newsroom`,
  isDemo: true,
})
console.log(`Demo alert sent to ${to}. Check the inbox (and spam folder).`)
