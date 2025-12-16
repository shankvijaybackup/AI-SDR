/**
 * SendGrid Debug Test - Check why emails aren't being delivered
 */

require('dotenv').config()
const sgMail = require('@sendgrid/mail')

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL

console.log('🔍 SendGrid Debug Test\n')
console.log('='.repeat(50))

console.log('\n📋 Configuration:')
console.log(`   API Key: ${SENDGRID_API_KEY?.substring(0, 15)}...`)
console.log(`   From Email: ${FROM_EMAIL}`)

sgMail.setApiKey(SENDGRID_API_KEY)

async function testWithFullResponse() {
  const testEmail = 'vj@atomicwork.com'
  
  console.log(`\n📤 Sending test email to: ${testEmail}`)
  
  try {
    const msg = {
      to: testEmail,
      from: {
        email: FROM_EMAIL,
        name: 'AI SDR'
      },
      subject: '🔍 Debug Test - ' + new Date().toISOString(),
      text: 'This is a plain text test email from AI SDR.',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Debug Test Email</h2>
          <p>Sent at: ${new Date().toISOString()}</p>
          <p>From: ${FROM_EMAIL}</p>
          <p>To: ${testEmail}</p>
          <p>If you see this, SendGrid delivery is working!</p>
        </div>
      `,
    }

    const [response] = await sgMail.send(msg)
    
    console.log('\n✅ SendGrid Response:')
    console.log(`   Status Code: ${response.statusCode}`)
    console.log(`   Headers:`, JSON.stringify(response.headers, null, 2))
    
    if (response.statusCode === 202) {
      console.log('\n⚠️  Status 202 means SendGrid ACCEPTED the email.')
      console.log('   But delivery depends on:')
      console.log('   1. Sender verification (is notifications@atomicwork.com verified?)')
      console.log('   2. Domain authentication (SPF/DKIM records)')
      console.log('   3. Recipient spam filters')
      console.log('\n📌 Check SendGrid Dashboard:')
      console.log('   https://app.sendgrid.com/email_activity')
      console.log('\n📌 Verify Sender:')
      console.log('   https://app.sendgrid.com/settings/sender_auth')
    }
    
  } catch (error) {
    console.log('\n❌ Error:', error.message)
    if (error.response) {
      console.log('   Status:', error.response.statusCode)
      console.log('   Body:', JSON.stringify(error.response.body, null, 2))
    }
  }
}

testWithFullResponse()
