
const RAPIDAPI_KEY = '65aec36729msh841cbebb4683693p10045djsn8604546d928e'
// Try cleaner slug without ID
const URL_TO_TEST = 'https://www.linkedin.com/in/dara-khosrowshahi'

async function debugDara() {
    console.log(`Debug ScrapeNinja: ${URL_TO_TEST}`)

    try {
        const response = await fetch('https://scrapeninja.p.rapidapi.com/scrape', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-rapidapi-key': RAPIDAPI_KEY,
                'x-rapidapi-host': 'scrapeninja.p.rapidapi.com'
            },
            body: JSON.stringify({ url: URL_TO_TEST })
        })

        console.log(`Status: ${response.status}`)
        if (!response.ok) {
            console.log(await response.text())
            return
        }

        const json = await response.json()
        const html = json.body || ''
        console.log(`HTML Length: ${html.length}`)

        const match = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/)
        if (match && match[1]) {
            console.log('✅ LD+JSON Found!')
            console.log(match[1].substring(0, 200))
        } else {
            console.log('❌ No LD+JSON')
        }

    } catch (e) {
        console.log('Error:', e)
    }
}

debugDara()
