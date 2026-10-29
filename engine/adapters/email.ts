// Rising-claim alert email. Nodemailer over Gmail SMTP (app password) for the demo.
import nodemailer from 'nodemailer'

interface EmailEnv {
  SMTP_HOST?: string
  SMTP_PORT?: string
  SMTP_USER?: string
  SMTP_APP_PASSWORD?: string
  ALERT_FROM_NAME?: string
}

export interface RisingAlert {
  claimText: string
  count: number
  delta: number
  language: string
  dashboardUrl: string
  isDemo: boolean
}

export interface Mailer {
  readonly live: boolean
  sendRisingAlert(to: string[], alert: RisingAlert): Promise<void>
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c)
}

/** Branded HTML. Flat colours from the logo palette, no gradients, table layout for mail clients. */
export function risingAlertHtml(a: RisingAlert): string {
  const demo = a.isDemo ? '<p style="margin:0 0 16px;font-size:12px;font-weight:700;letter-spacing:.96px;text-transform:uppercase;color:#5f5f5f">Demo alert: counts include simulated reports</p>' : ''
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#ffffff;font-family:Inter,Helvetica,Arial,sans-serif;color:#181818">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;border:1px solid #e6e6e6;border-radius:16px;overflow:hidden">
<tr><td style="background:#181818;padding:20px 28px"><span style="display:inline-block;background:#e0b008;color:#181818;font-weight:700;font-size:12px;letter-spacing:.96px;text-transform:uppercase;border-radius:90px;padding:4px 12px">Rising claim</span>
<span style="color:#ffffff;font-weight:700;font-size:18px;margin-left:12px">Sherlock</span></td></tr>
<tr><td style="padding:28px">${demo}
<p style="margin:0 0 8px;font-size:14px;color:#5f5f5f">A claim crossed your rising threshold.</p>
<p style="margin:0 0 20px;font-size:22px;font-weight:700;line-height:1.3;letter-spacing:-.2px">${escape(a.claimText)}</p>
<div style="font-size:0">
<div style="display:inline-block;vertical-align:top;margin:0 28px 12px 0"><div style="font-size:36px;font-weight:700;letter-spacing:-.6px">${a.count}</div><div style="font-size:13px;color:#5f5f5f">reports</div></div>
<div style="display:inline-block;vertical-align:top;margin:0 28px 12px 0"><div style="font-size:36px;font-weight:700;color:#007a5a;letter-spacing:-.6px">&#9650; +${a.delta}</div><div style="font-size:13px;color:#5f5f5f">in the last hour</div></div>
<div style="display:inline-block;vertical-align:top;margin:0 0 12px 0"><div style="font-size:20px;font-weight:700;padding-top:10px">${escape(a.language)}</div><div style="font-size:13px;color:#5f5f5f">first language seen</div></div>
</div>
<p style="margin:16px 0 0"><a href="${escape(a.dashboardUrl)}" style="display:inline-block;background:#181818;color:#ffffff;text-decoration:none;font-weight:700;border-radius:90px;padding:14px 28px">Open the case</a></p>
</td></tr>
<tr><td style="border-top:1px solid #e6e6e6;padding:16px 28px;font-size:12px;color:#5f5f5f">You receive this because rising-claim alerts are on for your Sherlock newsroom account. No sender identities are included.</td></tr>
</table></td></tr></table></body></html>`
}

export function smtpMailer(env: EmailEnv): Mailer {
  const port = Number(env.SMTP_PORT || 465)
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_APP_PASSWORD },
    connectionTimeout: 8000,
    socketTimeout: 10000,
  })
  return {
    live: true,
    async sendRisingAlert(to, alert) {
      if (to.length === 0) return
      await transport.sendMail({
        from: `"${env.ALERT_FROM_NAME || 'Sherlock'}" <${env.SMTP_USER}>`,
        to: to.join(', '),
        subject: `${alert.isDemo ? '[Demo] ' : ''}Rising claim: ${alert.claimText.slice(0, 70)}`,
        text: `${alert.isDemo ? 'DEMO ALERT (includes simulated reports)\n\n' : ''}Rising claim: ${alert.claimText}\n${alert.count} reports, +${alert.delta} in the last hour.\nOpen the case: ${alert.dashboardUrl}`,
        html: risingAlertHtml(alert),
      })
    },
  }
}

export const cannedMailer: Mailer = {
  live: false,
  async sendRisingAlert() {
    // Demo mode: logged as a simulated alert by the caller.
  },
}
