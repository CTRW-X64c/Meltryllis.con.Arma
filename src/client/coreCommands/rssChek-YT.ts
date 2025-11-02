// src/client/coreCommands/rssChek-YT.ts
import Parser from 'rss-parser';
import { error, debug, info } from '../../sys/logging';
import { YouTubeFeed, getYouTubeFeeds, updateYouTubeFeedLastVideo } from '../../sys/database';
import { Client, TextChannel } from 'discord.js';
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
    const videoId = this.extractVideoId(latestVideo);
    
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

    const videoUrl = video.link || `https://www.youtube.com/watch?v=${videoId}`;
    
    try {
      await channel.send({
        content: i18next.t("novo_video", {ns: "youtube", a1: feed.youtube_channel_name, a2: video.title, a3: videoUrl}),
      });
      
      info(`Aviso a ${guild.name} de nuevo video de ${feed.youtube_channel_name}`);
    } catch (err) {
      error(`Error al notificar a ${guild.name}: ${err}`);
    }
  }

  private extractVideoId(video: any): string | null {

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
}