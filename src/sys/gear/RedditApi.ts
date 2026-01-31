// src/sys/RedditApi.ts
import { error, debug } from '../logging';   

const REDDIT_API_BASE = 'https://oauth.reddit.com';
const REDDIT_AUTH_URL = 'https://www.reddit.com/api/v1/access_token';

export class RedditApiClient {
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

    public async getPosts(resourceName: string, resourceType: 'subreddit' | 'user' = 'subreddit', limit: number = 20): Promise<any> {
        let endpoint: string;
        
        if (resourceType === 'user') {
            endpoint = `/user/${resourceName}/submitted.json?limit=${limit}`;
        } else {
            endpoint = `/r/${resourceName}/new.json?limit=${limit}`;
        }
        
        const response = await this.fetchAuthenticated(endpoint);
        return response.json();
    }
}

export const redditApi = new RedditApiClient();