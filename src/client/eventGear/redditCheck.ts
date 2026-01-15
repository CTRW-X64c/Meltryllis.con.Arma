// src/client/coreCommands/redditCheck.ts
import { Client, TextChannel } from 'discord.js';
import { getAllRedditFeeds, updateRedditFeedLastPost, RedditFeed } from '../../sys/database';
import { info, error, debug } from '../../sys/logging';
import i18next from 'i18next';

export interface RedditApiResponse {
    data: {
        children: {
            data: RedditPost;
        }[];
    };
}

interface RedditPost {
    title: string;
    permalink: string;
    post_hint?: string;
    name: string;
    pinned: boolean;
    stickied?: boolean;
}

const redditEmbedDomain = process.env.REDDIT_FIX_URL || "reddit.com";
const BATCH_SIZE = 25;

// Configuración de Reddit API
const REDDIT_API_BASE = 'https://oauth.reddit.com';
const REDDIT_AUTH_URL = 'https://www.reddit.com/api/v1/access_token';

let currentFeedIndex = 0;
let accessToken: string | null = null;
let tokenExpiry: number | null = null;

class RedditApiClient {
    private clientId: string;
    private clientSecret: string;
    private userAgent: string;

    constructor() {
        this.clientId = process.env.REDDIT_CLIENT_ID || '';
        this.clientSecret = process.env.REDDIT_CLIENT_SECRET || '';
        this.userAgent = 'MeltryllisBot/1.0.0';
        
        if (!this.clientId || !this.clientSecret) {
            console.warn('[Reddit API] REDDIT_CLIENT_ID o REDDIT_CLIENT_SECRET no están configurados'); /*<= solo a consola ya que en este punto aun no inicia el logger */
        }
    }

    async getAccessToken(): Promise<string> {
        if (accessToken && tokenExpiry && Date.now() < tokenExpiry - 60000) {
            return accessToken;
        }

        try {
            const authHeader = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
            
            const response = await fetch(REDDIT_AUTH_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${authHeader}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': this.userAgent
                },
                body: 'grant_type=client_credentials'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json() as { access_token: string; expires_in: number };
            accessToken = data.access_token;
            tokenExpiry = Date.now() + (data.expires_in * 1000);
            
            debug('[Reddit API] Token de acceso renovado');
            return accessToken;

        } catch (err) {
            error(`[Reddit API] Error obteniendo token: ${err}`);
            throw err;
        }
    }

// Marca el limite de post a obtener, diferencia enter user y subreddit 
    async getSubredditPosts(resourceName: string, resourceType: 'subreddit' | 'user' = 'subreddit'): Promise<RedditApiResponse> {
        const token = await this.getAccessToken();
        let apiUrl: string;
        if (resourceType === 'user') {
            apiUrl = `${REDDIT_API_BASE}/user/${resourceName}/.json?limit=20`;
        } else {
            apiUrl = `${REDDIT_API_BASE}/r/${resourceName}/new?limit=20`;
        }
        
        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': this.userAgent
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json() as RedditApiResponse;
        return data;
    }
}

// SOLUCIÓN: "lazy" cliente para preavenir fallos al inciar.
let redditApiInstance: RedditApiClient | null = null;

function getRedditApi(): RedditApiClient {
    if (!redditApiInstance) {
        redditApiInstance = new RedditApiClient();
    }
    return redditApiInstance;
}

function getSubredditNameFromUrl(input: string): string | null {
    try {
        const urlObject = new URL(input);
        const subredditMatch = urlObject.pathname.match(/\/r\/([a-zA-Z0-9_-]+)/);
        const userMatch = urlObject.pathname.match(/\/user\/([a-zA-Z0-9_-]+)/);
        
        if (subredditMatch) return subredditMatch[1];
        if (userMatch) return userMatch[1];
    } catch (e) {
    }

    const urlMatch = input.match(/(?:reddit\.com\/(?:r|user)\/|^(?:r|u)\/)([a-zA-Z0-9_-]+)/);
    if (urlMatch) return urlMatch[1];
    
    const rSlashMatch = input.match(/^(?:r|u)\/([a-zA-Z0-9_-]+)$/);
    if (rSlashMatch) return rSlashMatch[1];
    
    const simpleMatch = input.match(/^[a-zA-Z0-9_-]+$/);
    if (simpleMatch) return simpleMatch[0];
    
    return null;
}

function getDisplayNameFromUrl(url: string): string {
    const name = getSubredditNameFromUrl(url);
    if (!name) return 'unknown';
    
    if (url.includes('/user/') || url.startsWith('u/')) {
        return `u/${name}`;
    } else {
        return `r/${name}`;
    }
}

async function processSingleFeed(client: Client, feed: RedditFeed) {
    try {
        const resourceName = getSubredditNameFromUrl(feed.subreddit_url);
        if (!resourceName) {
            error(`[Reddit Checker]: URL inválida en BD: ${feed.subreddit_url}`);
            return;
        }

        const isUser = feed.subreddit_url.includes('/user/');
        const resourceType = isUser ? 'user' : 'subreddit';
        const jsonData = await getRedditApi().getSubredditPosts(resourceName, resourceType);
        
        if (!jsonData?.data?.children || !Array.isArray(jsonData.data.children)) {
            throw new Error('Estructura de respuesta inválida de Reddit API');
        }

        const posts = jsonData.data.children; 

        if (!posts || posts.length === 0) {
            return;
        }

        const lastPostId = feed.last_post_id;
        const newPosts = [];

        for (const postWrapper of posts) {
            const post = postWrapper.data;
            
            if (post.pinned || post.stickied) {
                debug(`[Reddit Checker]: Ignorando post pinned/stickied: ${post.title}`);
                continue;
            }
            
            if (post.name === lastPostId) {
                break;
            }
            newPosts.push(post);
        }

        if (newPosts.length > 0) {
            const displayName = getDisplayNameFromUrl(feed.subreddit_url);
            debug(`[Reddit Checker]: ¡${newPosts.length} post(s) nuevo(s) en ${displayName}`);
            newPosts.reverse(); 

            const channel = await client.channels.fetch(feed.channel_id);
            if (!channel || !channel.isTextBased()) {
                error(`[Reddit Checker]: El canal ${feed.channel_id} para ${displayName} no es un canal de texto.`);
                return;
            }
            const textChannel = channel as TextChannel;
            
        // Switch filtro
            for (const post of newPosts) { 
                const hint = post.post_hint;
                switch (feed.filter_mode) {
                    case 'media_only':
                        if (hint !== 'image' && hint !== 'hosted:video' && hint !== 'rich:video') {
                            continue;
                        } break;
                    case 'text_only':
                        if (hint !== 'self') {
                            continue;
                        } break;
                    case 'all':
                    default:
                        break;
                }
                
        // Hyperlink Fix & procesamiento de link          
                const permalink = post.permalink; 
                const formattedUrl = `https://www.${redditEmbedDomain}${permalink}`;
                const MAX_LENGTH = 50;
                const originalTitle = post.title ?? "Sin Título";
                const truncatedTitle = originalTitle.length > MAX_LENGTH
                    ? originalTitle.substring(0, MAX_LENGTH)
                    + "..." : originalTitle;
                const emojiRegex = /<a?:[a-zA-Z0-9_]+:\d+>|[\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Component}\u{200D}]+/gu;  
                const safeTitle = truncatedTitle
                    .replace(/\[/g, '')
                    .replace(/\]/g, '')
                    .replace(/\\/g, '')
                    .replace(/\//g, '')
                    .replace(/\|/g, ' ')
                    .replace(emojiRegex, '');
                    
                await textChannel.send(
                    i18next.t("Reduit_pioste", 
                        {ns: "reddit", a1: displayName, a2: safeTitle.trim(), a3: formattedUrl}));
                await new Promise(resolve => setTimeout(resolve, 1100));
            }

            const latestPostId = newPosts[newPosts.length - 1].name;
            await updateRedditFeedLastPost(feed.id, latestPostId, feed.guild_id);
        }
    } catch (err) {
        const displayName = getDisplayNameFromUrl(feed.subreddit_url);
        error(`[Reddit Checker]: Error procesando el feed de ${displayName}: ${err}`);
    }
}

async function checkRedditFeeds(client: Client) {
    debug("[Reddit Checker]: Iniciando ciclo de revisión de feeds...");
    try {
        const allFeeds = await getAllRedditFeeds();
        if (allFeeds.length === 0) return;

        if (currentFeedIndex >= allFeeds.length) {
            currentFeedIndex = 0;
        }

        const feedsToProcess = allFeeds.slice(currentFeedIndex, currentFeedIndex + BATCH_SIZE);
        debug(`[Reddit Checker]: Revisando ${feedsToProcess.length} feeds (desde el índice ${currentFeedIndex}).`);

        await Promise.all(feedsToProcess.map(feed => processSingleFeed(client, feed)));
        currentFeedIndex += BATCH_SIZE;

    } catch (err) {
        error(`[Reddit Checker]: Error en el ciclo principal del checker: ${err}`);
    }
}

// Inicializador de timer y espera al inicio. 
export function startRedditChecker(client: Client) {
    const MStoMin = 60000;
    const MIN_TIMMER = 3;
    const DEFAULT_Timmer = 10;
    const rawRssTime = process.env.REDDIT_CHECK_TIMMER;
    const parsedMinutes = rawRssTime ? parseInt(rawRssTime, 10) : NaN;
    const minutes = !isNaN(parsedMinutes) ? Math.max(parsedMinutes, MIN_TIMMER) : DEFAULT_Timmer;
    const rssCheckTimmer = minutes * MStoMin;
        info(`[Reddit Checker] Se revisarán ${BATCH_SIZE} feeds cada ${minutes} minutos.`);

    setTimeout(() => {
        checkRedditFeeds(client).catch(err => {
            error(`[Reddit Checker] Error al iniciar, ERROR: ${err}`);
        });
    }, 30000); 

    setInterval(() => {
        checkRedditFeeds(client).catch(err => {
            error(`[Reddit Checker] Error durante check, ERROR: ${err}`);
        });
    }, rssCheckTimmer);
}