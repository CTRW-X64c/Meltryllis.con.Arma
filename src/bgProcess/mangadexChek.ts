// src/client/coreCommands/mangadexChek.ts
import { Client, GuildTextBasedChannel } from 'discord.js';
import { getAllMangadexFeeds, updateMangadexFeedLastChapter, MangadexFeed, removeMangadexFeed } from '../sys/DB-Engine/links/Mangadex';
import { error, debug } from '../sys/logging';

const BATCH_SIZE = 10; // Número de feeds a procesar por ciclo
let currentFeedIndex = 0;
interface RSSItem {
    title: string;
    link: string;
    guid: string;
    pubDate: string;
}

/* Parseo del XML crudo del RSS de Mangadex */
function parseMangadexRSS(xml: string): RSSItem[] {
    const items: RSSItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;

    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
        const itemContent = match[1];
        // Extractores
        const titleMatch = itemContent.match(/<title>(.*?)<\/title>/);
        const linkMatch = itemContent.match(/<link>(.*?)<\/link>/);
        const guidMatch = itemContent.match(/<guid>(.*?)<\/guid>/);
        const pubDateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/);
        // Filtros y limpieza
        if (titleMatch && linkMatch && guidMatch) {
            const cleanTitle = titleMatch[1]
                .replace('<![CDATA[', '').replace(']]>', '').trim();

            items.push({
                title: cleanTitle,
                link: linkMatch[1].trim(),
                guid: guidMatch[1].trim(),
                pubDate: pubDateMatch ? pubDateMatch[1] : new Date().toISOString()
            });
        }
    } return items;
}

async function processSingleFeed(client: Client, feed: MangadexFeed) {
    let channel: GuildTextBasedChannel
    try { channel = await client.channels.fetch(feed.channel_id) as GuildTextBasedChannel; }
    catch (e: any) {
        if (e.code === 10003 || e.code === 404 || e.code === 50001) {
            try { await removeMangadexFeed(feed.guild_id, feed.id) }
            catch (ex) { debug(`Error al borrar el feed ${feed.id}: ${ex}`, "MangadexCheck") }
        }
        debug(`[Mangadex Check] No se pudo enviar mensaje al canal ${feed.channel_id}: ${e.message}`, "MangadexCheck")
        return;
    }

    try {
        const response = await fetch(feed.RSS_manga, { headers: { 'User-Agent': 'MeltryllisBot/1.2.7' } });
        if (!response.ok) {
            debug(`[Mangadex Check] Error HTTP ${response.status} en feed ${feed.id}`, "MangadexCheck");
            return;
        }

        const xmlText = await response.text();
        const allChapters = parseMangadexRSS(xmlText);
        if (allChapters.length === 0) return;

        const latestChapter = allChapters[0];
        if (feed.last_chapter === latestChapter.guid) return;

        if (feed.last_chapter === null) {
            await sendMangaUpdate(channel, feed, latestChapter);
            await updateMangadexFeedLastChapter(feed.id, latestChapter.guid, feed.guild_id);
            return;
        }

        const lastKnownIndex = allChapters.findIndex(item => item.guid === feed.last_chapter);
        let newChapters: RSSItem[] = [];

        if (lastKnownIndex === -1) { newChapters = [latestChapter]; }
        else { newChapters = allChapters.slice(0, lastKnownIndex); }

        for (const chapter of newChapters.reverse()) { await sendMangaUpdate(channel, feed, chapter); }

        await updateMangadexFeedLastChapter(feed.id, latestChapter.guid, feed.guild_id);
    } catch (err) { debug(`[Mangadex Check] Error procesando feed ${feed.manga_title}: ${err}`, "MangadexCheck"); }
}

async function sendMangaUpdate(channel: GuildTextBasedChannel, feed: MangadexFeed, chapter: RSSItem) {
    try {
        const MAX_LENGTH = 60;
        const noTiManCha = chapter.title.replace(feed.manga_title, "").trim().replace(/^:/, "").trim();
        const safeChapterTitle = noTiManCha.length > MAX_LENGTH ? noTiManCha.substring(0, MAX_LENGTH) + "..." : noTiManCha;
        const messageContent = `📚 **${feed.manga_title}**\n📄: ${safeChapterTitle}\n🔗​: ${chapter.link}`;

        await channel.send({ content: messageContent });
        await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (err) { debug(`[Mangadex Check] No se pudo enviar mensaje al canal ${feed.channel_id}: ${err}`, "MangadexCheck") }
}

export async function checkMangadexFeeds(client: Client) {
    try {
        debug("[Mangadex Checker]: Iniciando ciclo de revisión de feeds...");
        const allFeeds = await getAllMangadexFeeds();
        if (allFeeds.length === 0) return;
        if (currentFeedIndex >= allFeeds.length) currentFeedIndex = 0;

        const feedsToProcess = allFeeds.slice(currentFeedIndex, currentFeedIndex + BATCH_SIZE);
        debug(`[Mangadex Check] Revisando ${feedsToProcess.length} mangas...`, "MangadexCheck");

        await Promise.all(feedsToProcess.map(feed => processSingleFeed(client, feed)));
        currentFeedIndex += BATCH_SIZE;
    } catch (err) { error(`[Mangadex Check] Error general: ${err}`, "MangadexCheck") }
}

export function startMangadexChecker(client: Client) {
    checkMangadexFeeds(client).catch(err => error(`Error al iniciar Mangadex: ${err}`))
}