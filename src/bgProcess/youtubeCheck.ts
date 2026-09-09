// src/client/coreCommands/youtubeCheck.ts
import Parser from 'rss-parser';
import { error, debug } from '../sys/logging';
import { YouTubeFeed, getYouTubeFeeds, updateYouTubeFeedLastVideo } from '../sys/DB-Engine/links/Youtube';
import { Client, TextChannel } from 'discord.js';
import i18next from 'i18next';
import axios from 'axios';
import { Proxy } from '../sys/zGears/newAux';

export function extractVideoId(video: any): string | null {
  if (video.id) {
    return video.id;
  }

  if (video.link) {
    const match = video.link.match(/[?&]v=([^&]+)/);
    if (match) return match[1];
  }

  if (video.guid) {
    const match = video.guid.match(/video:video\.([^:]+)/);
    if (match) return match[1];
  }

  return null;
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const parser = new Parser();
const optHead = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

class YTRssService {
  private client: Client;
  private isChecking: boolean = false;

  constructor(client: Client) {
    this.client = client;
  }

  async checkAllFeeds(): Promise<void> {
    if (this.isChecking) {
      debug('Revisando Youtube RSS');
      return;
    }

    this.isChecking = true;

    try {
      const guilds = Array.from(this.client.guilds.cache.values());
      for (const guild of guilds) {
        try { await this.checkGuildFeeds(guild.id); }
        catch (err) { error(`Erro al checar el Feed en el gremio "${guild.name}": ${err}`); }
      }
    } finally { this.isChecking = false; }
  }

  private async checkGuildFeeds(guildId: string): Promise<void> {
    try {
      const callErr = { code500: 0, code404: 0 };
      const feeds = await getYouTubeFeeds(guildId);
      for (const feed of feeds) {
        const delay = Math.floor(Math.random() * 4000) + 3000;
        await wait(delay);

        let xmlText: string;
        try {
          const response = await axios.get(feed.rss_url, { headers: optHead, httpAgent: Proxy, httpsAgent: Proxy });
          if (response.status !== 200) { error(`Error Fetch: ${response.status} - ${response.statusText}`); continue }
          xmlText = response.data;
        } catch (e: any) {
          if (e.message.includes("404")) { callErr.code404++ };
          if (e.message.includes("500")) { callErr.code500++ };
          if (!e.message.includes("404") && !e.message.includes("500")) { error(`Error YoutubeRSS: ${e.message}`) }
          continue;
        }

        const rssFeed = await parser.parseString(xmlText);
        if (!rssFeed.items || rssFeed.items.length === 0) { debug(`El ${feed.youtube_channel_name} parece no tener videos`); continue }

        const latestVideo = rssFeed.items[0];
        const videoId = extractVideoId(latestVideo);
        if (!videoId) { debug(`No se pudo extraer el ID del ultimo video de ${feed.youtube_channel_name}`); continue }

        if (!feed.last_video_id || feed.last_video_id !== videoId) {
          if (feed.last_video_id) { await this.NewVideo(feed, latestVideo, videoId); }
          await updateYouTubeFeedLastVideo(feed.id, videoId, feed.guild_id);
          debug(`Ultimo video de ${feed.youtube_channel_name}: ${videoId}`);
        }
      }

      if (callErr.code404 > 0 || callErr.code500 > 0) error(`Errores 404: ${callErr.code404} | Errores 500: ${callErr.code500} | Guild: ${guildId}`);
    } catch (e: any) { error(`Error en loop YoutubeRSS: ${e.message}`); }
  }


  private async NewVideo(feed: YouTubeFeed, video: any, videoId: string): Promise<void> {
    const guild = this.client.guilds.cache.get(feed.guild_id);
    if (!guild) { debug(`No se encontro el gremio: ${feed.guild_id} `,); return; }

    const channel = guild.channels.cache.get(feed.channel_id) as TextChannel;
    if (!channel) { debug(`No se encontro el ${feed.channel_id} en ${guild.name}`); return; }

    // añadido filtro de caracteres y largo de titulo, ya que rompe los hyperlinks [{{a2}}]({{a3}})
    const videoUrl = video.link || `https://www.youtube.com/watch?v=${videoId}`;
    const MAX_LENGTH = 50;
    const originalTitle = video.title ?? "Sin Título";
    const truncatedTitle = originalTitle.length > MAX_LENGTH ? originalTitle.substring(0, MAX_LENGTH) + "..." : originalTitle;
    const emojiRegex = /<a?:[a-zA-Z0-9_]+:\d+>|[\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Component}\u{200D}]+/gu;
    const safeTitle = truncatedTitle
      .replace(/\[/g, '').replace(/\]/g, '').replace(/\\/g, '').replace(/\//g, '').replace(/\|/g, ' ').replace(emojiRegex, '');

    try {
      await channel.send({
        content: i18next.t("commands:youtube.check.novo_video", { ns: "youtube", a1: feed.youtube_channel_name, a2: safeTitle, a3: videoUrl }),
      });

      debug(`Aviso a ${guild.name} de nuevo video de ${feed.youtube_channel_name} `);
    } catch (err) { error(`Error al notificar a ${guild.name}: ${err} `) }
  }
}

// Inicializador de timer y espera al inicio. 
export function startYoutubeService(client: Client): void {
  const rssYT = new YTRssService(client);
  rssYT.checkAllFeeds().catch(err => { error(`[Youtube Checker]: Error al inciar, Error: ${err} `) });
}
