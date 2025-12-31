
// import fetch from 'node-fetch' // Using native Node fetch
const RAPIDAPI_KEY = '65aec36729msh841cbebb4683693p10045djsn8604546d928e'
const PROFILE_URL = 'https://www.linkedin.com/in/williamhgates'

async function testScrapeNinja() {
    console.log('Testing ScrapeNinja for:', PROFILE_URL)

    try {
        const response = await fetch('https://scrapeninja.p.rapidapi.com/scrape', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-rapidapi-key': RAPIDAPI_KEY,
                'x-rapidapi-host': 'scrapeninja.p.rapidapi.com'
            },
            body: JSON.stringify({
                url: PROFILE_URL
            })
        })

        if (!response.ok) {
            console.log('❌ API Failed:', response.status, response.statusText)
            const text = await response.text()
            console.log('Body:', text)
            return
        }

        const json = await response.json()
        console.log('✅ API Success (Status 200)')

        const html = json.body || ''
        console.log('HTML Length:', html.length)

        // Test Parsing Logic
        const match = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/)
        if (!match || !match[1]) {
            console.log('❌ No LD+JSON script found')
            return
        }

        const rawData = JSON.parse(match[1])
        const graph = rawData['@graph'] || []
        const person = graph.find((node: any) => node['@type'] === 'Person')

        if (person) {
            console.log('\n✅ Parsed Person Data:')
            console.log('Name:', person.name)
            console.log('Headline:', person.jobTitle)
            console.log('Description:', person.description ? person.description.substring(0, 100) + '...' : 'N/A')
            console.log('Location:', person.address?.addressLocality)
            console.log('Works For (Current):', person.worksFor?.map((w: any) => w.name).join(', '))
            console.log('Alumni Of (Education):', person.alumniOf?.map((a: any) => a.name).join(', '))
        } else {
            console.log('❌ LD+JSON found but no Person node')
            console.log('Graph Types:', graph.map((g: any) => g['@type']))
        }

    } catch (error) {
        console.log('❌ Error:', error)
    }
}

testScrapeNinja()
