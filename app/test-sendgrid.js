/**
 * SendGrid Email Test Script
 * Run with: node test-sendgrid.js
 */

require('dotenv').config()
const sgMail = require('@sendgrid/mail')

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL

console.log('📧 SendGrid Configuration Test\n')
console.log('='.repeat(50))

// Validate configuration
console.log('\n🔍 Checking configuration...')
console.log(`   SENDGRID_API_KEY: ${SENDGRID_API_KEY ? '✅ Set (' + SENDGRID_API_KEY.substring(0, 10) + '...)' : '❌ Not set'}`)
console.log(`   FROM_EMAIL: ${FROM_EMAIL ? '✅ ' + FROM_EMAIL : '❌ Not set'}`)

if (!SENDGRID_API_KEY || !FROM_EMAIL) {
  console.log('\n❌ Missing configuration. Please set SENDGRID_API_KEY and FROM_EMAIL in .env')
  process.exit(1)
}

// Initialize SendGrid
sgMail.setApiKey(SENDGRID_API_KEY)

async function sendTestEmail(to, subject, html) {
  try {
    const msg = {
      to,
      from: FROM_EMAIL,
      subject,
      html,
    }
    
    console.log(`\n📤 Sending to: ${to}`)
    console.log(`   Subject: ${subject}`)
    
    const response = await sgMail.send(msg)
    console.log(`   ✅ Sent! Status: ${response[0].statusCode}`)
    return { success: true, statusCode: response[0].statusCode }
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`)
    if (error.response) {
      console.log(`   Error body:`, JSON.stringify(error.response.body, null, 2))
    }
    return { success: false, error: error.message }
  }
}

async function runTests() {
  console.log('\n' + '='.repeat(50))
  console.log('🧪 Sending Test Emails...\n')

  // Test 1: Simple test email
  const test1 = await sendTestEmail(
    'vj@atomicwork.com',
    '🧪 Test Email - SendGrid Integration',
    `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">✅ SendGrid is working!</h2>
        <p>This is a test email from your AI SDR application.</p>
        <p>If you're seeing this, your email configuration is correct.</p>
        <hr style="border: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
          Sent at: ${new Date().toISOString()}<br>
          From: ${FROM_EMAIL}
        </p>
      </div>
    `
  )

  // Test 2: Invitation-style email
  const test2 = await sendTestEmail(
    'vj@atomicwork.com',
    "🎉 You're invited to join AI SDR",
    `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">AI SDR</h1>
        </div>
        <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #1f2937;">Hi Vijay! 👋</h2>
          <p>You've been invited to join <strong>AI SDR</strong> - the AI-powered sales development platform.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="http://localhost:3000/auth/verify?token=test123" 
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">
              Verify Email & Get Started
            </a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">This is a test invitation email.</p>
        </div>
      </div>
    `
  )

  // Summary
  console.log('\n' + '='.repeat(50))
  console.log('📊 Test Results:\n')
  console.log(`   Test 1 (Simple): ${test1.success ? '✅ PASSED' : '❌ FAILED'}`)
  console.log(`   Test 2 (Invitation): ${test2.success ? '✅ PASSED' : '❌ FAILED'}`)
  
  if (test1.success && test2.success) {
    console.log('\n🎉 All tests passed! Check your inbox at vj@atomicwork.com')
  } else {
    console.log('\n⚠️  Some tests failed. Check the error messages above.')
  }
  
  console.log('\n' + '='.repeat(50))
}

runTests().catch(console.error)
