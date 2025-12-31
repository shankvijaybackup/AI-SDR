
// Batch Test Script for Hybrid LinkedIn Enrichment
// Tests 15 diverse profiles using the "Real-Time" API (Primary) and "ScrapeNinja" (Secondary)

import fs from 'fs'

const RAPIDAPI_KEY = '65aec36729msh841cbebb4683693p10045djsn8604546d928e'

// CORRECTED PROFILES LIST
const SAFE_PROFILES = [
    'williamhgates',
    'satyanadella',
    'sundarpichai',
    'reidhoffman',
    'marcbenioff',
    'brianchesky',         // CORRECTED: Was 'bchesky'
    'dara-khosrowshahi-1a52535', // CORRECTED: Was 'dkhos'
    'ariannahuffington',
    'brenebrown',
    'richardbranson',
    'melindagates',
    'jessicaalba',
    'simonsinek',
    'oprah',
    'guykawasaki'
]

async function testProfile(username: string) {
    console.log(`\n🔎 Testing: ${username}`)
    const start = Date.now()

    // 1. Try Primary (Real-Time)
    try {
        const host = 'linkedin-scraper-api-real-time-fast-affordable.p.rapidapi.com'
        const url = `https://${host}/profile/detail?username=${username}`

        console.log(`   Attempting Primary API...`)
        const response = await fetch(url, {
            headers: {
                'x-rapidapi-host': host,
                'x-rapidapi-key': RAPIDAPI_KEY
            }
        })

        if (response.ok) {
            const json = await response.json()
            if (json.data && json.data.basic_info) {
                console.log(`   ✅ Primary Success (${Date.now() - start}ms)`)
                return {
                    username,
                    success: true,
                    source: 'Real-Time API',
                    name: json.data.basic_info.fullname,
                    headline: (json.data.basic_info.headline || '').substring(0, 50),
                    company: json.data.basic_info.current_company || 'N/A'
                }
            } else {
                console.log(`   ⚠️ Primary returned 200 but invalid structure`)
            }
        } else {
            console.log(`   ❌ Primary Failed: ${response.status}`)
        }
    } catch (e: any) {
        console.log(`   ❌ Primary Exception: ${e.message}`)
    }

    // 2. Fallback (ScrapeNinja)
    console.log(`   Attempting Secondary API (ScrapeNinja)...`)
    try {
        const response = await fetch('https://scrapeninja.p.rapidapi.com/scrape', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-rapidapi-key': RAPIDAPI_KEY,
                'x-rapidapi-host': 'scrapeninja.p.rapidapi.com'
            },
            body: JSON.stringify({ url: `https://www.linkedin.com/in/${username}` })
        })

        if (response.ok) {
            const json = await response.json()
            const html = json.body || ''
            const match = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/)
            if (match && match[1]) {
                const data = JSON.parse(match[1])
                const graph = data['@graph'] || []
                const person = graph.find((n: any) => n['@type'] === 'Person')
                if (person) {
                    console.log(`   ✅ Secondary Success (${Date.now() - start}ms)`)
                    return {
                        username,
                        success: true,
                        source: 'ScrapeNinja (Fallback)',
                        name: person.name,
                        headline: (person.jobTitle || '').toString().substring(0, 50),
                        company: 'Parsed from WorksFor' // stub for brief report
                    }
                }
            }
        }
        console.log(`   ❌ Secondary Failed`)
    } catch (e: any) {
        console.log(`   ❌ Secondary Exception: ${e.message}`)
    }

    return { username, success: false, error: 'Both APIs failed' }
}

async function runBatch() {
    const results = []
    console.log(`Starting Batch Test for ${SAFE_PROFILES.length} profiles...`)

    for (const user of SAFE_PROFILES) {
        const res = await testProfile(user)
        results.push(res)
        // small delay to avoid strict rate limits
        await new Promise(r => setTimeout(r, 1500))
    }

    console.log('\n=== BATCH SUMMARY ===')
    const success = results.filter(r => r.success)
    console.log(`Total: ${results.length}`)
    console.log(`Success: ${success.length}`)
    console.log(`Failed: ${results.length - success.length}`)

    fs.writeFileSync('scripts/batch-results.json', JSON.stringify(results, null, 2))
    console.log('Results saved to scripts/batch-results.json')
}


runBatch()

export { }
