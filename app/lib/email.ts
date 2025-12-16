import sgMail from '@sendgrid/mail'

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@example.com'
const APP_NAME = process.env.APP_NAME || 'AI SDR'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

interface SendEmailOptions {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  if (!process.env.SENDGRID_API_KEY) {
    console.log('[Email] No SENDGRID_API_KEY configured. Email would be sent to:', to)
    console.log('[Email] Subject:', subject)
    return { success: false, error: 'Email service not configured' }
  }

  try {
    const msg = {
      to,
      from: FROM_EMAIL,
      subject,
      html,
    }

    await sgMail.send(msg)
    console.log('[Email] Sent successfully to:', to)
    return { success: true }
  } catch (error: any) {
    console.error('[Email] SendGrid error:', error?.response?.body || error)
    return { success: false, error: error?.message || 'Failed to send email' }
  }
}

export async function sendInvitationEmail(
  to: string,
  firstName: string,
  verificationUrl: string,
  inviterName?: string
) {
  const subject = `You're invited to join ${APP_NAME}`
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">${APP_NAME}</h1>
      </div>
      
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1f2937; margin-top: 0;">Hi ${firstName}! 👋</h2>
        
        <p style="color: #4b5563;">
          ${inviterName ? `${inviterName} has invited you` : "You've been invited"} to join <strong>${APP_NAME}</strong> - 
          the AI-powered sales development platform.
        </p>
        
        <p style="color: #4b5563;">
          Click the button below to verify your email and activate your account:
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Verify Email & Get Started
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
          Or copy and paste this link into your browser:
          <br>
          <a href="${verificationUrl}" style="color: #667eea; word-break: break-all;">${verificationUrl}</a>
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
          This invitation link will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
        </p>
      </div>
    </body>
    </html>
  `

  return sendEmail({ to, subject, html })
}

export async function sendMagicLinkEmail(
  to: string,
  firstName: string,
  magicLinkUrl: string
) {
  const subject = `Your ${APP_NAME} login link`
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">${APP_NAME}</h1>
      </div>
      
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1f2937; margin-top: 0;">Hi ${firstName}! 🔐</h2>
        
        <p style="color: #4b5563;">
          Click the button below to securely log in to your account:
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${magicLinkUrl}" 
             style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Log In to ${APP_NAME}
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
          Or copy and paste this link into your browser:
          <br>
          <a href="${magicLinkUrl}" style="color: #667eea; word-break: break-all;">${magicLinkUrl}</a>
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
          This link will expire in 15 minutes. If you didn't request this login link, you can safely ignore this email.
        </p>
      </div>
    </body>
    </html>
  `

  return sendEmail({ to, subject, html })
}
