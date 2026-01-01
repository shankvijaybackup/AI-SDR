
import * as dotenv from 'dotenv'
import fs from 'fs'

// Load environment variables
dotenv.config({ path: '.env' })

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY

async function debugApi() {
    const username = 'williamhgates'
    // Ensure we use the exact same URL format that worked: www.linkedin.com and encoded
    const url = `https://fresh-linkedin-profile-data.p.rapidapi.com/get-linkedin-profile?linkedin_url=${encodeURIComponent('https://www.linkedin.com/in/' + username)}`

    console.log('Fetching:', url)

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'x-rapidapi-key': RAPIDAPI_KEY || '',
                'x-rapidapi-host': 'fresh-linkedin-profile-data.p.rapidapi.com'
            }
        })

        const text = await response.text()
        console.log('Status:', response.status)

        // Write to file
        fs.writeFileSync('scripts/api-response.json', text)
        console.log('Response written to scripts/api-response.json')

    } catch (error) {
        console.error('Error:', error)
    }
}

debugApi()
