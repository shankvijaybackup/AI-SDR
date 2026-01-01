
import * as dotenv from 'dotenv'
// import fetch from 'node-fetch' // Use native fetch
import fs from 'fs'

// Load environment variables
dotenv.config({ path: '.env' })

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY
const TEST_PROFILE_URL = 'https://www.linkedin.com/in/williamhgates'

async function testApi(name: string, host: string, url: string) {
    console.log(`\nTesting ${name}...`)
    console.log(`URL: ${url}`)

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'x-rapidapi-key': RAPIDAPI_KEY || '',
                'x-rapidapi-host': host
            }
        })

        if (response.ok) {
            const data = await response.json()
            console.log(`✅ ${name}: SUCCESS!`)
            fs.writeFileSync('scripts/api-success.json', JSON.stringify(data, null, 2));
            console.log('Response saved to scripts/api-success.json');
            return true
        } else {
            console.log(`❌ ${name}: Failed (${response.status})`)
            const text = await response.text()
            console.log('Error:', text.substring(0, 200))
            return false
        }

    } catch (error) {
        console.log(`❌ ${name}: Network Error`, error)
        return false
    }
}

async function runTests() {
    if (!RAPIDAPI_KEY) {
        console.error('No RAPIDAPI_KEY found in .env')
        return
    }

    // Candidate 1: Fresh LinkedIn Profile Data
    // Endpoint: /get-linkedin-profile?linkedin_url=...
    await testApi(
        'Fresh LinkedIn Profile Data',
        'fresh-linkedin-profile-data.p.rapidapi.com',
        `https://fresh-linkedin-profile-data.p.rapidapi.com/get-linkedin-profile?linkedin_url=${TEST_PROFILE_URL}`
    )
}

runTests()
