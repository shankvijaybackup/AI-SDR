import sgMail from '@sendgrid/mail';

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const SENDER_EMAIL = process.env.SENDER_EMAIL || 'vj@atomicwork.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Send user invitation email
 */
async function sendInvitationEmail({ email, token, inviterName, role, companyName }) {
  const activationLink = `${FRONTEND_URL}/activate?token=${token}`;

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
        .button { display: inline-block; padding: 14px 28px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .role-badge { display: inline-block; padding: 4px 12px; background: #f0f0f0; border-radius: 4px; font-size: 14px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">Welcome to Atomicwork AI SDR</h1>
        </div>
        <div class="content">
          <p>Hi there,</p>
          <p><strong>${inviterName}</strong> has invited you to join <strong>${companyName}</strong> on Atomicwork AI SDR platform.</p>

          <div class="role-badge">Your Role: ${role === 'account_owner' ? 'Account Owner' : 'Agent'}</div>

          <p>As an ${role === 'account_owner' ? 'Account Owner' : 'Agent'}, you'll be able to:</p>
          <ul>
            <li>Import and manage leads</li>
            <li>Enrich leads with AI-powered LinkedIn data</li>
            <li>Generate and customize call scripts</li>
            <li>Upload knowledge base content</li>
            <li>Make AI-powered calls (1-by-1 and bulk)</li>
            ${role === 'account_owner' ? '<li>Invite and manage team members</li><li>Configure company settings</li>' : ''}
          </ul>

          <p>Click the button below to activate your account and set your password:</p>

          <center>
            <a href="${activationLink}" class="button">Activate Account</a>
          </center>

          <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
          <p style="background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px; word-break: break-all;">${activationLink}</p>

          <p style="margin-top: 30px; color: #666; font-size: 13px;"><strong>Note:</strong> This invitation link will expire in 7 days.</p>
        </div>
        <div class="footer">
          <p>Atomicwork - AI-Native Employee Service Management</p>
          <p>Founded by ex-Nutanix and ex-Freshworks leaders | $40M funded</p>
          <p style="margin-top: 10px;">
            <a href="https://atomicwork.com" style="color: #667eea; text-decoration: none;">atomicwork.com</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textBody = `
Welcome to Atomicwork AI SDR!

${inviterName} has invited you to join ${companyName} on Atomicwork AI SDR platform.

Your Role: ${role === 'account_owner' ? 'Account Owner' : 'Agent'}

To activate your account and set your password, visit:
${activationLink}

This invitation link will expire in 7 days.

---
Atomicwork - AI-Native Employee Service Management
Founded by ex-Nutanix and ex-Freshworks leaders | $40M funded
https://atomicwork.com
  `;

  const msg = {
    to: email,
    from: SENDER_EMAIL,
    subject: `You've been invited to join ${companyName} on Atomicwork AI SDR`,
    text: textBody,
    html: htmlBody,
  };

  try {
    const response = await sgMail.send(msg);
    console.log(`[SendGrid] Invitation email sent to ${email}`);
    return { success: true, messageId: response[0].headers['x-message-id'] };
  } catch (error) {
    console.error(`[SendGrid] Failed to send invitation email to ${email}:`, error);
    throw error;
  }
}

/**
 * Send password reset email
 */
async function sendPasswordResetEmail({ email, token, firstName }) {
  const resetLink = `${FRONTEND_URL}/reset-password?token=${token}`;

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
        .button { display: inline-block; padding: 14px 28px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">Reset Your Password</h1>
        </div>
        <div class="content">
          <p>Hi ${firstName},</p>
          <p>We received a request to reset your password for your Atomicwork AI SDR account.</p>

          <p>Click the button below to reset your password:</p>

          <center>
            <a href="${resetLink}" class="button">Reset Password</a>
          </center>

          <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
          <p style="background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px; word-break: break-all;">${resetLink}</p>

          <p style="margin-top: 30px; color: #666; font-size: 13px;"><strong>Note:</strong> This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          <p>Atomicwork - AI-Native Employee Service Management</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const msg = {
    to: email,
    from: SENDER_EMAIL,
    subject: 'Reset Your Atomicwork AI SDR Password',
    html: htmlBody,
  };

  try {
    const response = await sgMail.send(msg);
    console.log(`[SendGrid] Password reset email sent to ${email}`);
    return { success: true, messageId: response[0].headers['x-message-id'] };
  } catch (error) {
    console.error(`[SendGrid] Failed to send password reset email to ${email}:`, error);
    throw error;
  }
}

/**
 * Send welcome email after activation
 */
async function sendWelcomeEmail({ email, firstName, role, companyName }) {
  const loginLink = `${FRONTEND_URL}/login`;

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
        .button { display: inline-block; padding: 14px 28px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">🎉 Welcome to Atomicwork AI SDR!</h1>
        </div>
        <div class="content">
          <p>Hi ${firstName},</p>
          <p>Your account has been successfully activated! You're now ready to start using Atomicwork AI SDR.</p>

          <h3>Quick Start Guide:</h3>
          <ol>
            <li><strong>Import Leads:</strong> Upload your contacts or sync from CRM</li>
            <li><strong>Enrich Data:</strong> Let AI analyze LinkedIn profiles and generate personas</li>
            <li><strong>Generate Scripts:</strong> Create hyper-personalized call scripts</li>
            <li><strong>Upload Knowledge:</strong> Add your product docs, case studies, battle cards</li>
            <li><strong>Start Calling:</strong> Launch 1-by-1 or bulk AI-powered calls</li>
          </ol>

          <center>
            <a href="${loginLink}" class="button">Login to Your Account</a>
          </center>

          <p style="margin-top: 30px; color: #666;">Need help getting started? Check out our documentation or reach out to support.</p>
        </div>
        <div class="footer">
          <p>Atomicwork - AI-Native Employee Service Management</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const msg = {
    to: email,
    from: SENDER_EMAIL,
    subject: `Welcome to Atomicwork AI SDR, ${firstName}!`,
    html: htmlBody,
  };

  try {
    const response = await sgMail.send(msg);
    console.log(`[SendGrid] Welcome email sent to ${email}`);
    return { success: true, messageId: response[0].headers['x-message-id'] };
  } catch (error) {
    console.error(`[SendGrid] Failed to send welcome email to ${email}:`, error);
    // Don't throw - welcome email is non-critical
    return { success: false, error: error.message };
  }
}

export {
  sendInvitationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
};
