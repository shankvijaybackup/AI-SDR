


const LINKEDIN_LI_AT = process.env.LINKEDIN_LI_AT

interface LinkedInUpdate {
    urn: string
    text?: string
    url?: string
    authorUrn?: string
    createdAt?: number
    stats?: {
        numLikes: number
        numComments: number
    }
}

export class LinkedInClient {
    private cookie: string
    private csrfToken: string

    constructor() {
        if (!LINKEDIN_LI_AT) {
            // Warn instead of throw to allow build in CI/CD without secrets
            console.warn('LINKEDIN_LI_AT is not configured')
            this.csrfToken = 'dummy'
            this.cookie = ''
        } else {
            // CSRF token must match the JSESSIONID value in the cookie for Voyager API
            this.csrfToken = 'ajax:842345671234'
            this.cookie = `li_at=${LINKEDIN_LI_AT}; JSESSIONID="${this.csrfToken}"`
        }
    }

    private getHeaders() {
        return {
            'cookie': this.cookie,
            'csrf-token': this.csrfToken,
            'x-restli-protocol-version': '2.0.0',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'accept': 'application/vnd.linkedin.normalized+json+2.1',
            'x-li-lang': 'en_US'
        }
    }

    /**
     * Resolve a company URL or Name to a URN ID (numeric)
     */
    async resolveCompanyUrn(query: string): Promise<string | null> {
        if (!this.cookie) return null

        // Basic extraction if URL contains numeric ID
        const navMatch = query.match(/\/company\/([0-9]+)/)
        if (navMatch) return navMatch[1]

        console.log(`[LinkedInClient] Resolving URN for ${query}...`)

        // Attempt Typeahead (Autocomplete)
        const typeaheadUrl = `https://www.linkedin.com/voyager/api/typeahead/hitsV2?keywords=${encodeURIComponent(query)}&type=COMPANY&q=type&count=1`

        try {
            const response = await fetch(typeaheadUrl, { headers: this.getHeaders() })
            if (!response.ok) {
                console.error('[LinkedInClient] Typeahead error:', response.status)
                return null
            }
            const json = await response.json()
            const elements = json.elements || []
            if (elements.length > 0) {
                const urn = elements[0].targetUrn // e.g., urn:li:company:12345
                const id = urn.split(':').pop()
                return id
            }
        } catch (e) {
            console.error('[LinkedInClient] Resolve exception:', e)
        }
        return null
    }

    /**
     * Fetch recent updates (posts) from a company
     */
    async getCompanyUpdates(companyId: string, count: number = 5): Promise<any[]> {
        if (!this.cookie) return []

        const url = `https://www.linkedin.com/voyager/api/feed/updates?count=${count}&q=companyFeed&companyUrn=urn:li:company:${companyId}`
        try {
            const response = await fetch(url, { headers: this.getHeaders() })
            if (!response.ok) {
                const text = await response.text();
                console.error(`[LinkedInClient] Fetch Updates Error ${response.status}:`, text.slice(0, 200));
                return []
            }
            const json = await response.json()
            return json.elements || []
        } catch (e) {
            console.error('[LinkedInClient] GetUpdates exception:', e)
            return []
        }
    }
}

export const linkedInClient = new LinkedInClient()
