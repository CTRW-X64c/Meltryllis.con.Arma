// src/client/coreCommands/redditCheck.ts
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, TextChannel } from 'discord.js';
import { getAllRedditFeeds, updateRedditFeedLastPost, RedditFeed, removeRedditFeed } from '../sys/DB-Engine/links/Reddit';
import { info, debug, error } from '../sys/logging';
import i18next from 'i18next';
import { redditApi } from '../sys/zGears/RedditApi';
import urlStatusManager from '../sys/embedding/domainChecker';

export interface RedditApiResponse {
    data: {
        children: {
            data: RedditPost;
        }[];
    };
    reason?: string;
}

interface RedditPost {
    title: string;
    permalink: string;
    post_hint?: string;
    is_gallery?: boolean;
    is_video?: boolean;
    name: string;
    pinned?: boolean;
    stickied?: boolean;
    over_18?: boolean;
}

const BATCH_SIZE = 99;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
let currentFeedIndex = 0;

function getSubredditNameFromUrl(input: string): string | null {
    try {
        const urlObject = new URL(input);
        const subredditMatch = urlObject.pathname.match(/\/r\/([a-zA-Z0-9_-]+)/);
        const userMatch = urlObject.pathname.match(/\/(?:user|u)\/([a-zA-Z0-9_-]+)/);

        if (subredditMatch) return subredditMatch[1];
        if (userMatch) return userMatch[1];
    } catch (e) { /* Si falla el URL parsing, intentamos con regex directo */ }

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
    const displayName = getDisplayNameFromUrl(feed.subreddit_url);
    const resourceName = getSubredditNameFromUrl(feed.subreddit_url);
    try {
        if (!resourceName) {
            error(`[Reddit Checker]: URL inválida en BD: ${feed.subreddit_url}`);
            return;
        }

        const isUser = feed.subreddit_url.includes('/user/') || feed.subreddit_url.startsWith('/u/');
        const resourceType = isUser ? 'user' : 'subreddit';
        const jsonData = await redditApi.getPosts(resourceName, resourceType, 20);

        /* ====================================== CHEQUEO DE DISPONIBILIDAD ====================================== */

        if (jsonData?.reason === 'banned' || jsonData?.reason === 'private' || jsonData?.reason === 'quarantined') {
            try {
                const removed = await removeRedditFeed(feed.guild_id, feed.subreddit_name);
                const channel = await client.channels.fetch(feed.channel_id) as TextChannel;
                if (removed && channel) {
                    switch (jsonData.reason) {
                        case 'banned': await channel.send(i18next.t("commands:reddit.check.Reduit_baneado", { a1: displayName }));
                            break;
                        case 'private': await channel.send(i18next.t("commands:reddit.check.Reduit_privado", { a1: displayName }));
                            break;
                        case 'quarantined': await channel.send(i18next.t("commands:reddit.check.Reduit_cuarentena", { a1: displayName }));
                            break;
                        default:
                            break;
                    }
                }
                debug(`[Reddit Checker]: Se eliminó ${displayName} por razón: ${jsonData.reason}.`);
            }
            catch (err) { error(`[Reddit Checker]: Error al eliminar ${displayName}: ${err}`) }
            return;
        }

        /* ====================================== AQUI CONTINUA NORMAL ====================================== */

        if (!jsonData?.data?.children || !Array.isArray(jsonData.data.children)) throw new Error('Estructura de respuesta inválida de Reddit API');

        const posts = jsonData.data.children;
        if (!posts || posts.length === 0) return;

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
            debug(`[Reddit Checker]: ¡${newPosts.length} post(s) nuevo(s) en ${displayName}`);
            newPosts.reverse();

            const channel = await client.channels.fetch(feed.channel_id);
            if (!channel || !channel.isTextBased()) { error(`[Reddit Checker]: El canal ${feed.channel_id} para ${displayName} no es un canal de texto.`); return }
            const ch = channel as TextChannel;

            for (const post of newPosts) {
                let baseUrl: string | null = null;
                const aDmn = urlStatusManager.getActiveUrl("Api");
                const rDmn = urlStatusManager.getActiveUrl("reddit");
                if (process.env.EMBEDEZ_REDDITCHECK !== "off" && aDmn?.includes("embedez.com")) baseUrl = `${aDmn}?q=https://www.reddit.com`;
                else baseUrl = rDmn;

                const hint = post.post_hint; const noHint = post.is_gallery || post.is_video;
                switch (feed.filter_mode) {
                    case 'media_only':
                        const visualHint = hint === 'image' || hint === 'hosted:video' || hint === 'rich:video' || hint === 'link';
                        const isMedia = visualHint || noHint;
                        if (!isMedia) { continue; } break;
                    case 'text_only':
                        if (hint !== 'self') { continue; } break;
                    case 'all':
                    default: break;
                }

                // Hyperlink Fix & procesamiento de link
                const nsfwPost = post.over_18;
                const nsfwCh = feed.nsfw_protect;
                const nsfwCheck = nsfwPost && !nsfwCh;
                const pLink = post.permalink;
                const postLink = `https://${baseUrl}${pLink}`;
                const orgTitle = post.title ?? "Sin Título";
                const shrtTitle = orgTitle.length > 50 ? orgTitle.substring(0, 50) + "..." : orgTitle;
                const emojiRgx = /<a?:[a-zA-Z0-9_]+:\d+>|[\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Component}\u{200D}]+/gu;
                const safeTitle = shrtTitle
                    .replace(/\[/g, '').replace(/\]/g, '').replace(/\\/g, '').replace(/\//g, '').replace(/\|/g, ' ').replace(emojiRgx, '');

                let msg;
                if (nsfwCheck) { msg = i18next.t("commands:reddit.check.Reduit_pioste_nsfw", { a1: displayName, a2: safeTitle.trim(), a3: postLink }) }
                else { msg = i18next.t("commands:reddit.check.Reduit_pioste", { a1: displayName, a2: safeTitle.trim(), a3: postLink }) }

                await publisher(msg, ch, pLink, post.name);
                await wait(2_000);
            }

            const latestPostId = newPosts[newPosts.length - 1].name;
            await updateRedditFeedLastPost(feed.id, latestPostId, feed.guild_id);
        }
    } catch (err) { error(`[Reddit Checker]: Error procesando el feed de ${displayName}: ${err}`) }
}

/* ====================================== Publisher ====================================== */
let failPost = false;
let failPostQueue = new Map<string, data>();
interface data { dmsg: string; dch: TextChannel; dlink: string; }
const publisher = async (msg: string, ch: TextChannel, link: string, idPost?: string) => {
    try {
        const URL = `https://www.reddit.com${link}`;
        const boton = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(new ButtonBuilder().setLabel("Original Link").setStyle(ButtonStyle.Link).setURL(URL));

        const sMsg = await ch.send({ content: msg, components: [boton] });
        await wait(3_000);

        let freshMsg = await ch.messages.fetch(sMsg.id).catch(() => null);
        for (let attempt = 1; attempt <= 2 && freshMsg && freshMsg.embeds.length === 0; attempt++) {
            await sMsg.edit({ content: "⏳", components: [boton] });
            await wait(2_000);

            await sMsg.edit({ content: msg, components: [boton] });
            await wait(2_500 + (attempt + 1_000));
            freshMsg = await ch.messages.fetch(sMsg.id).catch(() => null);
        }

        if (freshMsg && freshMsg.embeds.length === 0) {
            if (idPost) { failPostQueue.set(idPost, { dmsg: msg, dch: ch, dlink: link }); checkFailQueue(); }
            await sMsg.delete().catch(() => null);
            debug(`[Reddit Publisher]: Mensaje eliminado - no se generaron embeds para: ${URL}`);
            return;
        }
    } catch (e) { error(`[Reddit Publisher]: Error al publicar: ${e}`) }
}

// Lista de fallidos
const checkFailQueue = async () => {
    if (failPost || failPostQueue.size === 0) return;
    failPost = true;
    await wait(8 * 60_000);
    const list = Array.from(failPostQueue.values());
    failPostQueue.clear();

    for (const post of list) {
        await publisher(post.dmsg, post.dch, post.dlink);
        await wait(2_000);
    }

    failPost = false;
    debug(`[Reddit Publisher]: se volvieron a procesar ${list.length} post fallidos.`)
    if (failPostQueue.size > 0) checkFailQueue();
}

/* ====================================== Inicio de porceso ====================================== */
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
    } catch (err) { error(`[Reddit Checker]: Error en el ciclo principal del checker: ${err}`) }
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