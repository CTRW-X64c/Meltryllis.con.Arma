// src/client/coreCommands/redditCheck.ts
import { Client, TextChannel } from 'discord.js';
import { getAllRedditFeeds, updateRedditFeedLastPost, RedditFeed } from '../../sys/DB-Engine/links/Reddit';
import { info, error, debug } from '../../sys/logging';
import i18next from 'i18next';
import { redditApi } from '../../sys/zGears/RedditApi';
import urlStatusManager from '../../sys/embedding/domainChecker';

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
    is_gallery: boolean;
    is_video: boolean;
    name: string;
    pinned: boolean;
    stickied?: boolean;
    over_18: boolean;
}

const BATCH_SIZE = 99;
let currentFeedIndex = 0;

function getSubredditNameFromUrl(input: string): string | null {
    try {
        const urlObject = new URL(input);
        const subredditMatch = urlObject.pathname.match(/\/r\/([a-zA-Z0-9_-]+)/);
        const userMatch = urlObject.pathname.match(/\/(?:user|u)\/([a-zA-Z0-9_-]+)/);
        
        if (subredditMatch) return subredditMatch[1];
        if (userMatch) return userMatch[1];
    } catch (e) {
        // Si falla el URL parsing, intentamos con regex directo
    }

    const urlMatch = input.match(/(?:reddit\.com\/(?:r|user|u)\/|^(?:r|u)\/)([a-zA-Z0-9_-]+)/);
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

        const isUser = feed.subreddit_url.includes('/user/') || feed.subreddit_url.startsWith('/u/');
        const resourceType = isUser ? 'user' : 'subreddit';  
        const jsonData = await redditApi.getPosts(resourceName, resourceType, 20);
        
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
            
            for (const post of newPosts) { 
                const upEmbeddingDomain = urlStatusManager.getActiveUrl("REDDIT_FIX_URL");
                const hint = post.post_hint;
                const noHint = post.is_gallery || post.is_video;
                switch (feed.filter_mode) {
                    case 'media_only':
                        const visualHint = hint === 'image' || hint === 'hosted:video' || hint === 'rich:video' || hint === 'link'; 
                        const isMedia = visualHint || noHint;
                        if (!isMedia) {
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
                const nsfwPost = post.over_18;
                const nsfwChannel = feed.nsfw_protect;
                const nsfwCheck = nsfwPost && !nsfwChannel;
                const permalink = post.permalink;
                const formattedUrl = `https://${upEmbeddingDomain}${permalink}`;
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
                    
                let messageContent;
                if (nsfwCheck) {
                    messageContent = i18next.t("Reduit_pioste_nsfw", { ns: "reddit", a1: displayName, a2: safeTitle.trim(), a3: formattedUrl});
                    debug(`[Reddit Checker]: Post NSFW protegido en #<${feed.channel_id}> de ${displayName}`);
                } else {
                    messageContent = i18next.t("Reduit_pioste", { ns: "reddit", a1: displayName, a2: safeTitle.trim(), a3: formattedUrl});
                }
                     
                await textChannel.send(messageContent);
                await new Promise(resolve => setTimeout(resolve, 1500));
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