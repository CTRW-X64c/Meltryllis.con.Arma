// src/client/coreCommands/mangadexChek.ts
import { Client, TextChannel } from 'discord.js';
import { getAllMangadexFeeds, updateMangadexFeedLastChapter, MangadexFeed } from '../../sys/DB-Engine/links/Mangadex';
import { info, error, debug } from '../../sys/logging';

const BATCH_SIZE = 10; // Número de feeds a procesar por ciclo

let currentFeedIndex = 0;

interface RSSItem {
    title: string;
    link: string;
    guid: string;
    pubDate: string;
}

/**
 * Parseo del XML crudo del RSS de Mangadex
 */
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
                .replace('<![CDATA[', '')
                .replace(']]>', '')
                .trim();
            
            items.push({
                title: cleanTitle,
                link: linkMatch[1].trim(),
                guid: guidMatch[1].trim(),
                pubDate: pubDateMatch ? pubDateMatch[1] : new Date().toISOString()
            });
        }
    }
    return items;
}

async function processSingleFeed(client: Client, feed: MangadexFeed) {
    if (!feed.channel_id || !feed.RSS_manga) return;

    try {
        const response = await fetch(feed.RSS_manga, {
            headers: { 'User-Agent': 'MeltryllisBot/1.2.7' }
        });

        if (!response.ok) {
            debug(`[Mangadex Check] Error HTTP ${response.status} en feed ${feed.id}`, "MangadexCheck");
            return;
        }

        const xmlText = await response.text();
        const allChapters = parseMangadexRSS(xmlText);

        if (allChapters.length === 0) return;

        const latestChapter = allChapters[0];
        if (feed.last_chapter === latestChapter.guid) {
            return;
        }

        if (feed.last_chapter === null) {
            await sendMangaUpdate(client, feed, latestChapter);
            await updateMangadexFeedLastChapter(feed.id, latestChapter.guid, feed.guild_id);
            return;
        }

        const lastKnownIndex = allChapters.findIndex(item => item.guid === feed.last_chapter);

        let newChapters: RSSItem[] = [];

        if (lastKnownIndex === -1) {
            newChapters = [latestChapter];
        } else {
            newChapters = allChapters.slice(0, lastKnownIndex);
        }

        for (const chapter of newChapters.reverse()) {
            await sendMangaUpdate(client, feed, chapter);
        }

        await updateMangadexFeedLastChapter(feed.id, latestChapter.guid, feed.guild_id);

    } catch (err) {
        debug(`[Mangadex Check] Error procesando feed ${feed.manga_title}: ${err}`, "MangadexCheck");
    }
}

async function sendMangaUpdate(client: Client, feed: MangadexFeed, chapter: RSSItem) {
    try {
        const channel = await client.channels.fetch(feed.channel_id) as TextChannel;
        if (!channel) return;
        const MAX_LENGTH = 60; 
        let safeChapterTitle = chapter.title  
        if (safeChapterTitle.length > MAX_LENGTH) {
            safeChapterTitle = safeChapterTitle.substring(0, MAX_LENGTH) + '...';
        }

        const messageContent = `📚 **${feed.manga_title}**\n📄: ${safeChapterTitle}\n🔗​: ${chapter.link}`;
        
        await channel.send({ content: messageContent });
        await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (err) {
        debug(`[Mangadex Check] No se pudo enviar mensaje al canal ${feed.channel_id}: ${err}`, "MangadexCheck");
    }
}

export async function checkMangadexFeeds(client: Client) {
    try {
        const allFeeds = await getAllMangadexFeeds();
        if (allFeeds.length === 0) return;

        if (currentFeedIndex >= allFeeds.length) {
            currentFeedIndex = 0;
        }

        const feedsToProcess = allFeeds.slice(currentFeedIndex, currentFeedIndex + BATCH_SIZE);
        debug(`[Mangadex Check] Revisando ${feedsToProcess.length} mangas...`, "MangadexCheck");

        await Promise.all(feedsToProcess.map(feed => processSingleFeed(client, feed)));
        
        currentFeedIndex += BATCH_SIZE;

    } catch (err) {
        error(`[Mangadex Check] Error general: ${err}`, "MangadexCheck");
    }
}

export function startMangadexChecker(client: Client) {
    const MStoMin = 60000;
    const DEFAULT_Timmer = 20;
    const MIN_TIMMER = 20; // Minimo y Dafeault 20 minutos
    const rawRssTime = process.env.MANGADEX_CHECK_TIMMER;
    const parsedMinutes = rawRssTime ? parseInt(rawRssTime, 10) : NaN;
    const minutes = !isNaN(parsedMinutes) ? Math.max(parsedMinutes, MIN_TIMMER) : DEFAULT_Timmer;
    const rssCheckTimmer = minutes * MStoMin;  
        info(`[Mangadex Check] Servicio iniciado. Revisión cada ${minutes} minutos.`, "MangadexCheck");

    setTimeout(() => {
        checkMangadexFeeds(client).catch(err => error(`Error al iniciar Mangadex: ${err}`));
    }, 10000);

    setInterval(() => {
         checkMangadexFeeds(client).catch(err => error(`Error en intervalo Mangadex: ${err}`));
    }, rssCheckTimmer);
}