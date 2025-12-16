/**
 * Test script for user invitation and magic link authentication flow
 * Run with: node test-auth-flow.js
 */

const BASE_URL = 'http://localhost:3000'

async function testAuthFlow() {
  console.log('🧪 Testing User Invitation & Magic Link Flow\n')
  console.log('=' .repeat(50))

  // Test 1: Invite a new user
  console.log('\n📧 Test 1: Invite New User')
  const inviteResponse = await fetch(`${BASE_URL}/api/auth/invite`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': 'auth-token=YOUR_AUTH_TOKEN_HERE' // Replace with actual token
    },
    body: JSON.stringify({
      email: 'testuser@example.com',
      firstName: 'Test',
      lastName: 'User'
    })
  })

  if (!inviteResponse.ok) {
    console.log('❌ Invite failed - you need to be logged in first')
    console.log('   Status:', inviteResponse.status)
    const error = await inviteResponse.json()
    console.log('   Error:', error)
  } else {
    const inviteData = await inviteResponse.json()
    console.log('✅ User invited successfully!')
    console.log('   Email:', inviteData.user?.email)
    console.log('   Verification URL:', inviteData.verificationUrl)
    
    // Test 2: Verify email
    if (inviteData.verificationUrl) {
      const token = new URL(inviteData.verificationUrl).searchParams.get('token')
      console.log('\n📬 Test 2: Verify Email')
      
      const verifyResponse = await fetch(`${BASE_URL}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })

      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json()
        console.log('✅ Email verified and account activated!')
        console.log('   User:', verifyData.user?.email)
        console.log('   Message:', verifyData.message)
      } else {
        const error = await verifyResponse.json()
        console.log('❌ Verification failed:', error)
      }
    }
  }

  // Test 3: Magic link login
  console.log('\n🔗 Test 3: Magic Link Login')
  const magicResponse = await fetch(`${BASE_URL}/api/auth/magic-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'testuser@example.com' })
  })

  const magicData = await magicResponse.json()
  console.log('   Message:', magicData.message)
  
  if (magicData.magicLinkUrl) {
    console.log('   Magic Link URL:', magicData.magicLinkUrl)
    
    // Test 4: Verify magic link
    const magicToken = new URL(magicData.magicLinkUrl).searchParams.get('token')
    console.log('\n🔑 Test 4: Verify Magic Link')
    
    const verifyMagicResponse = await fetch(`${BASE_URL}/api/auth/magic-link/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: magicToken })
    })

    if (verifyMagicResponse.ok) {
      const loginData = await verifyMagicResponse.json()
      console.log('✅ Magic link login successful!')
      console.log('   User:', loginData.user?.email)
    } else {
      const error = await verifyMagicResponse.json()
      console.log('❌ Magic link login failed:', error)
    }
  }

  console.log('\n' + '=' .repeat(50))
  console.log('🏁 Test complete!\n')
}

// Manual test instructions
console.log(`
╔════════════════════════════════════════════════════════════════╗
║           USER INVITATION & MAGIC LINK TEST                    ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  MANUAL TEST STEPS:                                            ║
║                                                                ║
║  1. Start the app: npm run dev                                 ║
║  2. Login to existing account: http://localhost:3000/login     ║
║  3. Go to Settings: http://localhost:3000/settings             ║
║  4. Scroll to "Invite New User" section                        ║
║  5. Fill in: First Name, Last Name, Email                      ║
║  6. Click "Send Invitation"                                    ║
║  7. Copy the verification URL shown                            ║
║  8. Open verification URL in incognito/new browser             ║
║  9. User should be activated and logged in                     ║
║                                                                ║
║  MAGIC LINK TEST:                                              ║
║  1. Go to: http://localhost:3000/login                         ║
║  2. Enter email and click "Send Magic Link"                    ║
║  3. Click the magic link shown (or check console)              ║
║  4. User should be logged in                                   ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
`)

// Run test if called directly
if (typeof window === 'undefined') {
  testAuthFlow().catch(console.error)
}
