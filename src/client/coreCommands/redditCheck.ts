// src/client/coreCommand/redditCheck.ts
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
}

const redditEmbedDomain = process.env.REDDIT_FIX_URL || "reddit.com";
const BATCH_SIZE = 5;

let currentFeedIndex = 0;

async function processSingleFeed(client: Client, feed: RedditFeed) {
    try {
        const response = await fetch(feed.subreddit_url, {
            headers: { 'User-Agent': 'MeltryllisBot/1.0.0' }
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status} al fetchear ${feed.subreddit_url}`);
        }

        const jsonData = (await response.json()) as RedditApiResponse;
        const posts = jsonData.data.children; 

        if (!posts || posts.length === 0) {
            return;
        }

        const lastPostId = feed.last_post_id;
        const newPosts = [];

        for (const postWrapper of posts) {
            const post = postWrapper.data; 
            if (post.name === lastPostId) {
                break;
            }
            newPosts.push(post);
        }

        if (newPosts.length > 0) {
            debug(`[Reddit Checker]: ¡${newPosts.length} post(s) nuevo(s) en r/${feed.subreddit_name}`);
            newPosts.reverse(); 

            const channel = await client.channels.fetch(feed.channel_id);
            if (!channel || !channel.isTextBased()) {
                error(`[Reddit Checker]: El canal ${feed.channel_id} para r/${feed.subreddit_name} no es un canal de texto.`);
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
                        {ns: "reddit", a1: feed.subreddit_name, a2: safeTitle.trim(), a3: formattedUrl}));
                await new Promise(resolve => setTimeout(resolve, 1100));
            }

            const latestPostId = newPosts[newPosts.length - 1].name;
            await updateRedditFeedLastPost(feed.id, latestPostId, feed.guild_id);
        }
    } catch (err) {
        error(`[Reddit Checker]: Error procesando el feed de r/${feed.subreddit_name}: ${err}`);
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