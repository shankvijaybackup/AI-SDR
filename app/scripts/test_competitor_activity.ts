
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

async function testCompetitorPosts() {
    // Direct LinkedIn Cookie Approach
    const li_at = process.env.LINKEDIN_LI_AT // Loaded from .env.local
    if (!li_at) {
        console.error('❌ LINKEDIN_LI_AT not found in .env.local')
        process.exit(1)
    }

    const username = 'atomicwork' // Target company

    // NOTE: Private Voyager API URL (Use with caution)
    // GET /voyager/api/feed/updates?count=10&q=companyFeed&companyUrn=urn:li:company:<ID>

    console.log(`🔎 Testing Direct Fetch for ${username} using Cookie...`)

    try {
        // Step 1: Resolve Company URN (simplified for test: Atomicwork ID = 338362130)
        const companyId = '338362130'
        console.log(`Using Company ID: ${companyId}`)

        const updatesUrl = `https://www.linkedin.com/voyager/api/feed/updates?count=5&q=companyFeed&companyUrn=urn:li:company:${companyId}`

        // FIX: Ensure JSESSIONID matches csrf-token for Voyager API
        const csrfToken = 'ajax:123456789'
        const cookieHeader = `li_at=${li_at}; JSESSIONID="${csrfToken}"`

        const response = await fetch(updatesUrl, {
            headers: {
                'cookie': cookieHeader,
                'csrf-token': csrfToken,
                'x-restli-protocol-version': '2.0.0',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'accept': 'application/vnd.linkedin.normalized+json+2.1'
            }
        })

        if (!response.ok) {
            console.error(`❌ Voyager API Error: ${response.status} ${response.statusText}`)
            const text = await response.text()
            console.error(text.slice(0, 200))
            return
        }

        const json = await response.json()
        console.log('✅ Voyager API Response Success!')
        const elements = json.data?.elements || json.elements || []
        console.log(`Found ${elements.length} updates.`)

        if (elements.length > 0) {
            const update = elements[0];
            console.log('Sample Update:', JSON.stringify(update, null, 2).slice(0, 500))
        } else {
            console.log('No updates found (Response structure might differ):', Object.keys(json))
        }

    } catch (e) {
        console.error('❌ Exception:', e)
    }
}

testCompetitorPosts()
