
// import fetch from 'node-fetch' // Use native Node fetch
const RAPIDAPI_KEY = '65aec36729msh841cbebb4683693p10045djsn8604546d928e'
const USERNAME = 'williamhgates'

async function testRealTimeApi() {
    console.log(`Testing Real-Time API for username: ${USERNAME}`)

    // API from User's latest request
    const host = 'linkedin-scraper-api-real-time-fast-affordable.p.rapidapi.com'
    const url = `https://${host}/profile/detail?username=${USERNAME}`

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'x-rapidapi-host': host,
                'x-rapidapi-key': RAPIDAPI_KEY
            }
        })

        if (!response.ok) {
            console.log('❌ API Failed:', response.status, response.statusText)
            const text = await response.text()
            console.log('Body:', text)
            return
        }

        const json = await response.json()
        console.log('✅ API Success (Status 200)')

        // Log keys to confirm structure matches user's example
        if (json.data && json.data.basic_info) {
            console.log('Name:', json.data.basic_info.fullname)
            console.log('Headline:', json.data.basic_info.headline)
            console.log('Summary:', json.data.basic_info.about ? json.data.basic_info.about.substring(0, 50) + '...' : 'N/A')
            console.log('Experience Count:', json.data.experience ? json.data.experience.length : 0)
            console.log('Featured Posts:', json.data.featured ? json.data.featured.length : 0)
        } else {
            console.log('❌ Unexpected JSON structure:', JSON.stringify(json).substring(0, 200))
        }

    } catch (error: any) {
        console.log('❌ Error:', error)
    }
}

testRealTimeApi()

export { }
