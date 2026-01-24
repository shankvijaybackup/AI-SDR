
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET
const REDDIT_USERNAME = process.env.REDDIT_USERNAME
const REDDIT_PASSWORD = process.env.REDDIT_PASSWORD
const REDDIT_USER_AGENT = process.env.REDDIT_USER_AGENT || 'AtomicworkAgent/0.1'

interface RedditPost {
    title: string
    selftext: string
    url: string
    author: string
    created_utc: number
    permalink: string
}

export class RedditClient {
    private accessToken: string | null = null
    private tokenExpiresAt: number = 0

    private async getAccessToken() {
        if (this.accessToken && Date.now() < this.tokenExpiresAt) {
            return this.accessToken
        }

        const auth = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64')

        try {
            const params = new URLSearchParams()
            params.append('grant_type', 'password')
            params.append('username', REDDIT_USERNAME!)
            params.append('password', REDDIT_PASSWORD!)

            const res = await fetch('https://www.reddit.com/api/v1/access_token', {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'User-Agent': REDDIT_USER_AGENT,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params
            })

            const data = await res.json()
            if (data.access_token) {
                this.accessToken = data.access_token
                this.tokenExpiresAt = Date.now() + (data.expires_in * 1000)
                return this.accessToken
            } else {
                console.error('[Reddit] Auth failed:', data)
            }
        } catch (e) {
            console.error('[Reddit] Auth exception:', e)
        }
        return null
    }

    async searchPosts(keyword: string, limit: number = 5): Promise<RedditPost[]> {
        const token = await this.getAccessToken()
        if (!token) return []

        try {
            // Search globally for the keyword
            const res = await fetch(`https://oauth.reddit.com/search?q=${encodeURIComponent(keyword)}&sort=new&limit=${limit}&t=week`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'User-Agent': REDDIT_USER_AGENT
                }
            })

            if (!res.ok) {
                console.error('[Reddit] Search error:', res.status)
                return []
            }

            const json = await res.json()
            const posts = json.data?.children?.map((c: any) => c.data) || []
            return posts
        } catch (e) {
            console.error('[Reddit] Search exception:', e)
            return []
        }
    }
}

export const redditClient = new RedditClient()
