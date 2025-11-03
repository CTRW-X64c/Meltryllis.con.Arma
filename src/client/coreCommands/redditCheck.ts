// src/client/coreCommand/redditCheck.ts
import { Client, TextChannel } from 'discord.js';
import { getAllRedditFeeds, updateRedditFeedLastPost, RedditFeed } from '../../sys/database';
import { info, error, debug } from '../../sys/logging';
import Parser from 'rss-parser';
import i18next from 'i18next';

const redditEmbedDomain = process.env.REDDIT_FIX_URL || "rxddit.com";
const BATCH_SIZE = 5;

const parser = new Parser();
let currentFeedIndex = 0;

async function processSingleFeed(client: Client, feed: RedditFeed) {
    try {
        const rssData = await parser.parseURL(feed.subreddit_url);
        if (!rssData.items || rssData.items.length === 0) {
            return;
        }

        const lastPostId = feed.last_post_id;
        const newPosts = [];

        for (const item of rssData.items) {
            if (item.id === lastPostId) {
                break;
            }
            newPosts.push(item);
        }

        if (newPosts.length > 0) {
            debug(`[Reddit Checker] ¡${newPosts.length} post(s) nuevo(s) en r/${feed.subreddit_name}!`);
            newPosts.reverse();

            const channel = await client.channels.fetch(feed.channel_id);
            if (!channel || !channel.isTextBased()) {
                error(`[Reddit Checker] El canal ${feed.channel_id} para r/${feed.subreddit_name} no es un canal de texto o no se encontró.`);
                return;
            }
            // añadido filtro de caracteres y largo de titulo, ya que rompe los hyperlinks [{{a2}}]({{a3}})
            const textChannel = channel as TextChannel;
            for (const post of newPosts) {
                const permalink = new URL(post.link!).pathname;
                const formattedUrl = `https://www.${redditEmbedDomain}${permalink}`;
                const MAX_LENGTH = 50;
                const originalTitle = post.title ?? "Sin Título";
                const truncatedTitle = originalTitle.length > MAX_LENGTH ? originalTitle.substring(0, MAX_LENGTH) + "..." : originalTitle;
                const safeTitle = truncatedTitle.replace(/\[/g, ' ').replace(/\]/g, ' ').replace(/\\/g, ' ').replace(/\|/g, ' ');
            await textChannel.send(i18next.t("Reduit_pioste", {ns: "reddit", a1: feed.subreddit_name, a2: safeTitle, a3: formattedUrl}));
            }

            const latestPostId = newPosts[newPosts.length - 1].id!;
            await updateRedditFeedLastPost(feed.id, latestPostId, feed.guild_id);
        }
    } catch (err) {
        error(`[Reddit Checker] Error procesando el feed de r/${feed.subreddit_name}: ${err}`);
    }
}

async function checkRedditFeeds(client: Client) {
    debug("[Reddit Checker] Iniciando ciclo de revisión de feeds...");
    try {
        const allFeeds = await getAllRedditFeeds();
        if (allFeeds.length === 0) return;

        if (currentFeedIndex >= allFeeds.length) {
            currentFeedIndex = 0;
        }

        const feedsToProcess = allFeeds.slice(currentFeedIndex, currentFeedIndex + BATCH_SIZE);
        debug(`[Reddit Checker] Revisando ${feedsToProcess.length} feeds (desde el índice ${currentFeedIndex}).`);

        await Promise.all(feedsToProcess.map(feed => processSingleFeed(client, feed)));
        currentFeedIndex += BATCH_SIZE;

    } catch (err) {
        error("[Reddit Checker] Error en el ciclo principal del checker:",);
    }
}

// ajustado para que sea como la de YT con su Timeout para no saturar el incio del bot
export function startRedditChecker(client: Client) {
    const MStoMin = 60000;
    const MIN_TIMMER = 3;
    const DEFAULT_Timmer = 10;
    const rawRssTime = process.env.REDDIT_RSSCHECK_TIME;
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