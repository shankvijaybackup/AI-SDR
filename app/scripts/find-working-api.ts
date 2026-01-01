
import * as dotenv from 'dotenv'
import fs from 'fs'

// Load environment variables
dotenv.config({ path: '.env' })

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY
const TEST_PROFILE_URL = 'https://www.linkedin.com/in/williamhgates'
const TEST_USERNAME = 'williamhgates'

interface ApiConfig {
    name: string
    host: string
    url: string
}

const CANDIDATES: ApiConfig[] = [
    {
        name: 'Fresh LinkedIn Profile Data',
        host: 'fresh-linkedin-profile-data.p.rapidapi.com',
        // Note: verified this needs raw URL (no encodeURIComponent)
        url: `https://fresh-linkedin-profile-data.p.rapidapi.com/get-linkedin-profile?linkedin_url=${TEST_PROFILE_URL}`
    },
    {
        name: 'LinkedIn Profiles1',
        host: 'linkedin-profiles1.p.rapidapi.com',
        url: `https://linkedin-profiles1.p.rapidapi.com/extract?url=${TEST_PROFILE_URL}`
    },
    {
        name: 'LinkedIn Data Scraper (ScrapingDog)',
        host: 'linkedin-data-scraper.p.rapidapi.com',
        url: `https://linkedin-data-scraper.p.rapidapi.com/person?link=${TEST_PROFILE_URL}`
    },
    {
        name: 'Real-Time LinkedIn Scraper (linkedin-data-api)',
        host: 'linkedin-data-api.p.rapidapi.com',
        url: `https://linkedin-data-api.p.rapidapi.com/scrape-profile-data?username=${TEST_USERNAME}`
    },
    {
        name: 'Voyager (Restyler)',
        host: 'voyager.p.rapidapi.com',
        url: `https://voyager.p.rapidapi.com/?url=${TEST_PROFILE_URL}`
    },
    {
        name: 'Fresh Data (Alternative Endpoint)',
        host: 'fresh-linkedin-profile-data.p.rapidapi.com',
        // Try with encoded URL just in case
        url: `https://fresh-linkedin-profile-data.p.rapidapi.com/get-linkedin-profile?linkedin_url=${encodeURIComponent(TEST_PROFILE_URL)}`
    }
]

async function testApi(candidate: ApiConfig) {
    console.log(`\nTesting ${candidate.name}...`)
    console.log(`URL: ${candidate.url}`)

    try {
        const response = await fetch(candidate.url, {
            method: 'GET',
            headers: {
                'x-rapidapi-key': RAPIDAPI_KEY || '',
                'x-rapidapi-host': candidate.host
            }
        })

        if (response.ok) {
            const data = await response.json()
            console.log(`✅ ${candidate.name}: SUCCESS!`)

            // Save logic
            const filename = `scripts/success-${candidate.host.split('.')[0]}.json`
            fs.writeFileSync(filename, JSON.stringify(data, null, 2))
            console.log(`Saved response to ${filename}`)

            return true
        } else {
            console.log(`❌ ${candidate.name}: Failed (${response.status})`)
            const text = await response.text()
            // Check for explicit "not subscribed"
            if (text.includes('subscribed')) {
                console.log('Reason: Not Subscribed')
            } else {
                console.log('Error:', text.substring(0, 150))
            }
            return false
        }

    } catch (error) {
        console.log(`❌ ${candidate.name}: Network Error`, error)
        return false
    }
}

async function runScanner() {
    if (!RAPIDAPI_KEY) {
        console.error('No RAPIDAPI_KEY found in .env')
        return
    }

    console.log(`Scanning ${CANDIDATES.length} endpoints with provided key...`)

    const results = await Promise.all(CANDIDATES.map(testApi))

    const successes = results.filter(Boolean).length
    console.log(`\nScan Complete. Found ${successes} working APIs.`)
}

runScanner()
