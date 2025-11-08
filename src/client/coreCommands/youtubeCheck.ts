// src/client/coreCommands/youtubeCheck.ts
import Parser from 'rss-parser';
import { error, debug, info } from '../../sys/logging';
import { YouTubeFeed, getYouTubeFeeds, updateYouTubeFeedLastVideo } from '../../sys/database';
import { Client, TextChannel } from 'discord.js';
import { extractVideoId } from './yTools';
import i18next from 'i18next';

const parser = new Parser();

export class YTRssService {
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
      const guilds = this.client.guilds.cache.values();
      
      for (const guild of guilds) {
        try {
          await this.checkGuildFeeds(guild.id);
        } catch (err) {
          error(`Erro al checar el Feed en el gremio "${guild.name}": ${err}`);
        }
      }
    } finally {
      this.isChecking = false;
    }
  }

  private async checkGuildFeeds(guildId: string): Promise<void> {
    const feeds = await getYouTubeFeeds(guildId);
    
    for (const feed of feeds) {
      try {
        await this.checkFeed(feed);
      } catch (err) {
        error(`Erro al checar el feed "${feed.youtube_channel_name}" en el gremio ${guildId}: ${err}`,);
      }
    }
  }

  private async checkFeed(feed: YouTubeFeed): Promise<void> {
    debug(`Revisando feed: ${feed.youtube_channel_name}`,);
    
    const rssFeed = await parser.parseURL(feed.rss_url);
    
    if (!rssFeed.items || rssFeed.items.length === 0) {
      debug(`El ${feed.youtube_channel_name} parece no tener videos`);
      return;
    }

    const latestVideo = rssFeed.items[0];
    const videoId = extractVideoId(latestVideo);
    
    if (!videoId) {
      debug(`No se pudo extraer el ID del ultimo video de ${feed.youtube_channel_name}`);
      return;
    }

    if (!feed.last_video_id || feed.last_video_id !== videoId) {
      if (feed.last_video_id) {
        await this.NewVideo(feed, latestVideo, videoId);
      }
      
      await updateYouTubeFeedLastVideo(feed.id, videoId, feed.guild_id);
      debug(`Ultimo video de ${feed.youtube_channel_name}: ${videoId}`);
    }
  }

  private async NewVideo(feed: YouTubeFeed, video: any, videoId: string): Promise<void> {
    const guild = this.client.guilds.cache.get(feed.guild_id);
    if (!guild) {
      debug(`No se encontro el gremio: ${feed.guild_id} `,);
      return;
    }

    const channel = guild.channels.cache.get(feed.channel_id) as TextChannel;
    if (!channel) {
      debug(`No se encontro el ${feed.channel_id} en ${guild.name}`);
      return;
    }
    
  // añadido filtro de caracteres y largo de titulo, ya que rompe los hyperlinks [{{a2}}]({{a3}})
    const videoUrl = video.link || `https://www.youtube.com/watch?v=${videoId}`;
    const MAX_LENGTH = 50;
    const originalTitle = video.title ?? "Sin Título";
    const truncatedTitle = originalTitle.length > MAX_LENGTH ? originalTitle.substring(0, MAX_LENGTH) + "..." : originalTitle;
    const emojiRegex = /<a?:[a-zA-Z0-9_]+:\d+>|[\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Component}\u{200D}]+/gu;
    const safeTitle = truncatedTitle
        .replace(/\[/g, '')
        .replace(/\]/g, '')
        .replace(/\\/g, '')
        .replace(/\//g, '')
        .replace(/\|/g, ' ')
        .replace(emojiRegex, '');
    
    try {
      await channel.send({
        content: i18next.t("novo_video", {ns: "youtube", a1: feed.youtube_channel_name, a2: safeTitle, a3: videoUrl}),
      });
      
      info(`Aviso a ${guild.name} de nuevo video de ${feed.youtube_channel_name}`);
    } catch (err) {
      error(`Error al notificar a ${guild.name}: ${err}`);
    }
  }
}

// Inicializador de timer y espera al inicio. 
export function startYoutubeService(client: Client): void {
  const MStoMin = 60000;
  const DEFAULT_Timmer = 10;
  const MIN_TIMMER = 5;
  const rawRssTime = process.env.YOUTUBE_CHECK_TIMMER;
  const parsedMinutes = rawRssTime ? parseInt(rawRssTime, 10) : NaN;
  const minutes = !isNaN(parsedMinutes) ? Math.max(parsedMinutes, MIN_TIMMER) : DEFAULT_Timmer;
  const rssCheckTimmer = minutes * MStoMin;  
    info(`[Youtube Checker]: Timmer establecido en ${minutes} minutos`);

  const youtubeRssService = new YTRssService(client);

  setTimeout(() => {
    youtubeRssService.checkAllFeeds().catch(err => {
      error(`[Youtube Checker]: Error al inciar, Error: ${err}`);
      });
  }, 30000); 

  setInterval(() => {
    youtubeRssService.checkAllFeeds().catch(err => {
      error(`[Youtube Checker]: Error en RSS, Error: ${err}`);
      });
  }, rssCheckTimmer);
}
