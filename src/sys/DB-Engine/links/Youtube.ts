// src/sys/DB-Engine/links/Youtube.ts
import { ResultSetHeader } from "mysql2/promise";
import getPool from "../database";
import { debug, error } from "../../logging";

export interface YouTubeFeed {
  id: number;
  guild_id: string;
  channel_id: string;
  youtube_channel_id: string;
  youtube_channel_name: string;
  rss_url: string;
  last_video_id: string | null;
  created_at: Date;
}

const youtubeFeedCache = new Map<string, YouTubeFeed[]>();

function invalidateGuildCache(guildId: string): void {
  youtubeFeedCache.delete(guildId);
  debug(`[BD.Youtube] Invalidando caché del guild: ${guildId}`, "Database");
}

export async function getYouTubeFeeds(guildId: string): Promise<YouTubeFeed[]> {
  if (youtubeFeedCache.has(guildId)) {
    debug(`[BD.Youtube] Cache HIT para guild: ${guildId}`, "Database");
    return [...youtubeFeedCache.get(guildId)!];
  }

  debug(`[BD.Youtube] Cache MISS para guild: ${guildId}, consultando BD`, "Database");
  
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT id, guild_id, channel_id, youtube_channel_id, youtube_channel_name, rss_url, last_video_id, created_at FROM youtube_feeds WHERE guild_id = ?",
      [guildId]
    );

    const feeds = (rows as any[]).map(row => ({
      id: row.id,
      guild_id: row.guild_id,
      channel_id: row.channel_id,
      youtube_channel_id: row.youtube_channel_id,
      youtube_channel_name: row.youtube_channel_name,
      rss_url: row.rss_url,
      last_video_id: row.last_video_id,
      created_at: new Date(row.created_at)
    }));

    youtubeFeedCache.set(guildId, feeds);
    debug(`[BD.Youtube] Caché actualizada para guild: ${guildId} (${feeds.length} feeds)`, "Database");
    return feeds;
  } catch (err) {
    error(`[BD.Youtube] Error al cargar feeds: ${err}`, "Database");
    throw err;
  }
}

export async function addYouTubeFeed(feed: Omit<YouTubeFeed, 'id' | 'created_at'>): Promise<number> {
  try {
    const pool = await getPool();
    const [result] = await pool.query(
      "INSERT INTO youtube_feeds (guild_id, channel_id, youtube_channel_id, youtube_channel_name, rss_url, last_video_id) VALUES (?, ?, ?, ?, ?, ?)",
      [feed.guild_id, feed.channel_id, feed.youtube_channel_id, feed.youtube_channel_name, feed.rss_url, feed.last_video_id]
    );

    const header = result as ResultSetHeader;
    
    invalidateGuildCache(feed.guild_id);
    
    debug(`[BD.Youtube] Feed agregado (ID: ${header.insertId}) para guild: ${feed.guild_id}`, "Database");
    return header.insertId;
  } catch (err) {
    error(`[BD.Youtube] Error al agregar feed: ${err}`, "Database");
    throw err;
  }
}

export async function updateYouTubeFeedLastVideo(id: number, lastVideoId: string, guildId: string): Promise<void> {
  try {
    const pool = await getPool();
    await pool.query(
      "UPDATE youtube_feeds SET last_video_id = ? WHERE id = ?",
      [lastVideoId, id]
    );

    invalidateGuildCache(guildId);
    
    debug(`[BD.Youtube] Último video actualizado para feed ${id} en guild: ${guildId}`, "Database");
  } catch (err) {
    error(`[BD.Youtube] Error al actualizar feed: ${err}`, "Database");
    throw err;
  }
}

export async function removeYouTubeFeed(guildId: string, youtubeChannelId: string): Promise<boolean> {
  try {
    const pool = await getPool();
    const [result] = await pool.query(
      "DELETE FROM youtube_feeds WHERE guild_id = ? AND youtube_channel_id = ?",
      [guildId, youtubeChannelId]
    );

    const header = result as ResultSetHeader;
      if (header.affectedRows > 0) {
      invalidateGuildCache(guildId);
      debug(`[BD.Youtube] Feed eliminado para guild: ${guildId}, canal YouTube: ${youtubeChannelId}`, "Database");
      return true;
    }
    
    debug(`[BD.Youtube] No se encontró feed para eliminar en guild: ${guildId}, canal YouTube: ${youtubeChannelId}`, "Database");
    return false;
  } catch (err) {
    error(`[BD.Youtube] Error al eliminar feed: ${err}`, "Database");
    throw err;
  }
}
