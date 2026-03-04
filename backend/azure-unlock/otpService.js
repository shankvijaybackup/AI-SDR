/**
 * OTP Service
 * Handles OTP generation, validation, and delivery via SMS/Email
 */

const crypto = require('crypto');
const redis = require('redis');
const twilio = require('twilio');
const nodemailer = require('nodemailer');
require('dotenv').config();

class OTPService {
  constructor() {
    // Initialize Redis client for OTP storage
    this.redisClient = redis.createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
      },
      password: process.env.REDIS_PASSWORD || undefined
    });

    this.redisClient.on('error', (err) => console.error('Redis error:', err));
    this.redisClient.connect();

    // Initialize Twilio for SMS
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      this.twilioPhone = process.env.TWILIO_PHONE_NUMBER;
    }

    // Initialize Nodemailer for Email
    this.emailTransporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });

    this.otpExpiry = parseInt(process.env.OTP_EXPIRY_SECONDS) || 300; // 5 minutes
    this.otpLength = parseInt(process.env.OTP_LENGTH) || 6;
    this.maxAttempts = parseInt(process.env.MAX_OTP_ATTEMPTS) || 3;
  }

  /**
   * Generate a cryptographically secure OTP
   */
  generateOTP() {
    const digits = '0123456789';
    let otp = '';

    // Use crypto for cryptographically secure random numbers
    const randomBytes = crypto.randomBytes(this.otpLength);

    for (let i = 0; i < this.otpLength; i++) {
      otp += digits[randomBytes[i] % digits.length];
    }

    return otp;
  }

  /**
   * Store OTP in Redis with expiry
   */
  async storeOTP(email, otp) {
    const key = `otp:${email}`;
    const data = {
      otp: otp,
      attempts: 0,
      createdAt: new Date().toISOString()
    };

    await this.redisClient.setEx(key, this.otpExpiry, JSON.stringify(data));

    return {
      success: true,
      expiresIn: this.otpExpiry
    };
  }

  /**
   * Verify OTP
   */
  async verifyOTP(email, otp) {
    const key = `otp:${email}`;

    try {
      const data = await this.redisClient.get(key);

      if (!data) {
        return {
          valid: false,
          reason: 'OTP expired or not found'
        };
      }

      const otpData = JSON.parse(data);

      // Check if max attempts exceeded
      if (otpData.attempts >= this.maxAttempts) {
        await this.redisClient.del(key); // Delete OTP
        return {
          valid: false,
          reason: 'Maximum verification attempts exceeded',
          accountLocked: true
        };
      }

      // Verify OTP
      if (otpData.otp === otp) {
        await this.redisClient.del(key); // Delete OTP after successful verification
        return {
          valid: true,
          message: 'OTP verified successfully'
        };
      } else {
        // Increment attempt counter
        otpData.attempts += 1;
        const ttl = await this.redisClient.ttl(key);
        await this.redisClient.setEx(key, ttl, JSON.stringify(otpData));

        return {
          valid: false,
          reason: 'Invalid OTP',
          attemptsRemaining: this.maxAttempts - otpData.attempts
        };
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return {
        valid: false,
        reason: 'Error verifying OTP',
        error: error.message
      };
    }
  }

  /**
   * Send OTP via SMS
   */
  async sendOTPSMS(phoneNumber, otp, userName) {
    if (!this.twilioClient) {
      console.warn('Twilio not configured. OTP:', otp);
      return {
        success: false,
        reason: 'SMS service not configured',
        otp: process.env.NODE_ENV === 'development' ? otp : undefined
      };
    }

    try {
      // Format phone number (must include country code)
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;

      const message = await this.twilioClient.messages.create({
        body: `Hi ${userName},\n\nYour account was locked and has been unlocked by IT Support.\n\nYour OTP is: ${otp}\n\nValid for ${this.otpExpiry / 60} minutes.\n\n- Exide IT Support`,
        from: this.twilioPhone,
        to: formattedPhone
      });

      return {
        success: true,
        messageSid: message.sid,
        method: 'sms'
      };
    } catch (error) {
      console.error('Error sending SMS:', error);
      return {
        success: false,
        reason: error.message,
        otp: process.env.NODE_ENV === 'development' ? otp : undefined
      };
    }
  }

  /**
   * Send OTP via Email
   */
  async sendOTPEmail(email, otp, userName) {
    try {
      const mailOptions = {
        from: `"Exide IT Support" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Account Unlock - OTP Verification',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #0078d4; color: white; padding: 20px; text-align: center; }
              .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
              .otp { font-size: 32px; font-weight: bold; color: #0078d4; text-align: center; padding: 20px; background: white; border: 2px dashed #0078d4; margin: 20px 0; letter-spacing: 8px; }
              .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Account Unlock Notification</h1>
              </div>
              <div class="content">
                <p>Hi <strong>${userName}</strong>,</p>

                <p>Your account was locked due to multiple failed login attempts and has been <strong>automatically unlocked</strong> by our IT Support system.</p>

                <p>To complete the password reset process, please use the following One-Time Password (OTP):</p>

                <div class="otp">${otp}</div>

                <div class="warning">
                  <strong>⚠️ Security Notice:</strong>
                  <ul>
                    <li>This OTP is valid for <strong>${this.otpExpiry / 60} minutes</strong></li>
                    <li>Do not share this OTP with anyone</li>
                    <li>You have <strong>${this.maxAttempts} attempts</strong> to enter the correct OTP</li>
                  </ul>
                </div>

                <p>If you did not request this unlock, please contact IT Support immediately at <a href="mailto:itsupport@exide.com">itsupport@exide.com</a></p>

                <p>Best regards,<br>
                <strong>Exide IT Support</strong></p>
              </div>
              <div class="footer">
                <p>This is an automated message. Please do not reply to this email.</p>
                <p>&copy; ${new Date().getFullYear()} Exide Industries. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.emailTransporter.sendMail(mailOptions);

      return {
        success: true,
        messageId: info.messageId,
        method: 'email'
      };
    } catch (error) {
      console.error('Error sending email:', error);
      return {
        success: false,
        reason: error.message,
        otp: process.env.NODE_ENV === 'development' ? otp : undefined
      };
    }
  }

  /**
   * Generate and send OTP (smart routing: SMS if phone available, else email)
   */
  async generateAndSendOTP(email, userName, phoneNumber = null) {
    const otp = this.generateOTP();

    // Store OTP in Redis
    await this.storeOTP(email, otp);

    // Try SMS first if phone number is available
    if (phoneNumber) {
      const smsResult = await this.sendOTPSMS(phoneNumber, otp, userName);
      if (smsResult.success) {
        return {
          success: true,
          method: 'sms',
          phone: phoneNumber,
          expiresIn: this.otpExpiry,
          otp: process.env.NODE_ENV === 'development' ? otp : undefined
        };
      }
      // If SMS fails, fall back to email
      console.log('SMS failed, falling back to email');
    }

    // Send via email
    const emailResult = await this.sendOTPEmail(email, otp, userName);

    return {
      success: emailResult.success,
      method: 'email',
      email: email,
      expiresIn: this.otpExpiry,
      otp: process.env.NODE_ENV === 'development' ? otp : undefined,
      reason: emailResult.reason
    };
  }

  /**
   * Check rate limiting for OTP requests
   */
  async checkRateLimit(email, action = 'otp') {
    const key = `ratelimit:${action}:${email}`;
    const maxRequests = parseInt(process.env.MAX_OTP_REQUESTS_PER_HOUR) || 5;
    const windowSeconds = 3600; // 1 hour

    try {
      const count = await this.redisClient.get(key);

      if (count && parseInt(count) >= maxRequests) {
        const ttl = await this.redisClient.ttl(key);
        return {
          allowed: false,
          reason: 'Rate limit exceeded',
          retryAfter: ttl
        };
      }

      // Increment counter
      if (count) {
        await this.redisClient.incr(key);
      } else {
        await this.redisClient.setEx(key, windowSeconds, '1');
      }

      return {
        allowed: true,
        remaining: maxRequests - (parseInt(count) || 0) - 1
      };
    } catch (error) {
      console.error('Error checking rate limit:', error);
      return { allowed: true }; // Fail open
    }
  }

  /**
   * Clean up expired OTPs (optional, Redis handles this automatically)
   */
  async cleanup() {
    // Redis automatically removes expired keys, but you can add custom cleanup here
    console.log('OTP cleanup running...');
  }
}

module.exports = new OTPService();
