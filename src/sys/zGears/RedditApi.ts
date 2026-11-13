// src/sys/RedditApi.ts
import { error, debug } from '../logging';

interface RedditApiResponse {
    data: {
        children: {
            data: RedditPost;
        }[];
    };
    reason?: string;
}
// =========== add RedditPost =========== //
interface RedditMMI {
    status: string,
    e: string, // 'Image' | 'AnimatedImage'
    m: string, // 'image/jpg', 'image/png', 'image/gif'
    id: string,
    s: { x: number; y: number; u?: string; gif?: string; }
}

interface itemOrd {
    media_id: string;
    id: number
}

interface souceMedia {
    oembed?: {
        provider_url: string
    },
    reddit_video?: {
        fallback_url?: string,
        has_audio?: boolean,
        is_gif?: boolean
    },
    type?: string
}

// =========== out Json =========== //
export interface RedditPost {
    title: string,
    permalink: string,
    post_hint?: string,
    is_gallery?: boolean,
    is_video?: boolean,
    name: string,
    pinned?: boolean,
    stickied?: boolean,
    over_18?: boolean,
    /// ===== ///
    ups?: number,
    downs?: number,
    upvote_ratio?: number,
    selftext?: string,
    subreddit_name_prefixed?: string,
    url_overridden_by_dest?: string,
    subreddit?: string,
    media_metadata?: Record<string, RedditMMI>,
    author?: string,
    url?: string,
    num_comments?: number,
    gallery_data?: { items: itemOrd[] },
    secure_media?: souceMedia | null,
}

const REDDIT_API_BASE = 'https://oauth.reddit.com';
const REDDIT_AUTH_URL = 'https://www.reddit.com/api/v1/access_token';

export type reddSouceApi = 'user' | 'subreddit';

class RedditApiClient {
    private clientId: string;
    private clientSecret: string;
    private userAgent: string;
    private accessToken: string | null = null;
    private tokenExpiry: number | null = null;

    constructor() {
        this.clientId = process.env.REDDIT_CLIENT_ID || "";
        this.clientSecret = process.env.REDDIT_CLIENT_SECRET || "";
        this.userAgent = 'MeltryllisBot/1.2.0';
    }

    private async getAccessToken(): Promise<string> {
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }

        if (!this.clientId || !this.clientSecret) {
            throw new Error("Faltan credenciales de Reddit (CLIENT_ID / CLIENT_SECRET)");
        }

        try {
            const authString = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
            const response = await fetch(REDDIT_AUTH_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${authString}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': this.userAgent
                },
                body: 'grant_type=client_credentials'
            });

            if (!response.ok) throw new Error(`Auth failed: ${response.status}`);

            const data = await response.json() as { access_token: string; expires_in: number };
            this.accessToken = data.access_token;
            this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Renovar 1 min antes
            debug("🔑 Token de Reddit renovado exitosamente.", "RedditAPI");
            return this.accessToken;

        } catch (err) {
            error(`Error obteniendo token Reddit: ${err}`, "RedditAPI");
            throw err;
        }
    }

    public async fetchAuthenticated(url: string): Promise<Response> {
        const token = await this.getAccessToken();
        const cleanPath = url.replace(/https?:\/\/(www\.)?reddit\.com/, '');
        const targetUrl = cleanPath.startsWith('http') ? cleanPath : `${REDDIT_API_BASE}${cleanPath}`;

        const response = await fetch(targetUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': this.userAgent
            }
        });

        if (response.status === 401 || response.status === 403) {
            this.accessToken = null;
            throw new Error("Token inválido o expirado");
        }

        return response;
    }

    public async getFeed(dta: { souce: string, type: reddSouceApi, limit: number }): Promise<RedditApiResponse> {
        let endpoint: string;

        if (dta.type === 'user') {
            endpoint = `/user/${dta.souce}/submitted.json?limit=${dta.limit}`;
        } else {
            endpoint = `/r/${dta.souce}/new.json?limit=${dta.limit}`;
        }

        const response = await this.fetchAuthenticated(endpoint);
        if (!response) { throw new Error('Fallo al obtener el feed') };
        return response.json() as Promise<RedditApiResponse>;
    }

    public async getPost(dta: { souce: string, posUrl: string, type: reddSouceApi }): Promise<RedditApiResponse> {
        let endpoint: string;
        if (dta.type === 'user') {
            endpoint = `/user/${dta.souce}/comments/${dta.posUrl}.json`;
        } else {
            endpoint = `/r/${dta.souce}/comments/${dta.posUrl}.json`;
        }
        const response = await this.fetchAuthenticated(endpoint);
        const arrayRespond = await response.json() as RedditApiResponse[];
        if (!arrayRespond || arrayRespond.length === 0) { throw new Error('No se encontro el post') }
        return arrayRespond[0];
    }
}

export const redditApi = new RedditApiClient();