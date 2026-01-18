// src/sys/DB-Engine/links/Reddit.ts
import { ResultSetHeader} from "mysql2/promise";
import { getPool } from "../database";
import {debug, error} from "../../logging";

export interface RedditFeed {
  id: number;
  guild_id: string;
  channel_id: string;
  subreddit_url: string;
  subreddit_name: string;
  last_post_id: string | null;
  created_at: Date;
  filter_mode: 'all' | 'media_only' | 'text_only';  //Añadiendo filtro de tipo contenido
}

const redditFeedCache = new Map<string, RedditFeed[]>();

export function invalidateGuildCache(guildId: string): void {
  redditFeedCache.delete(guildId);
  debug(`[BD.Reddit] Renovando la cache para el guild: ${guildId}`, "Database");
}

export async function getRedditFeeds(guildId: string): Promise<RedditFeed[]> {
  if (redditFeedCache.has(guildId)) {
    debug(`[BD.Reddit] Retornando cache del Guild: ${guildId}`, "Database");
    return [...redditFeedCache.get(guildId)!];
  }

  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT id, guild_id, channel_id, subreddit_url, subreddit_name, last_post_id, created_at FROM reddit_feeds WHERE guild_id = ?",
      [guildId]
    );

    const feeds = (rows as any[]).map(row => ({
      id: row.id,
      guild_id: row.guild_id,
      channel_id: row.channel_id,
      subreddit_url: row.subreddit_url,
      subreddit_name: row.subreddit_name,
      last_post_id: row.last_post_id,
      filter_mode: row.filter_mode,
      created_at: new Date(row.created_at)
    }));

    redditFeedCache.set(guildId, feeds);
    debug(`[BD.Reddit] Cargando cache del Guild: ${guildId}`, "Database");
    return feeds;
  } catch (err) {
    error(`[BD.Reddit] Error al cargar cache del Guild: ${guildId}: ${err}`, "Database");
    throw err;
  }
}

export async function addRedditFeed(feed: Omit<RedditFeed, 'id' | 'created_at'>): Promise<number> {
  try {
    const pool = await getPool();
    const [result] = await pool.query(
      "INSERT INTO reddit_feeds (guild_id, channel_id, subreddit_url, subreddit_name, last_post_id, filter_mode) VALUES (?, ?, ?, ?, ?, ?)",
      [feed.guild_id, feed.channel_id, feed.subreddit_url, feed.subreddit_name, feed.last_post_id, feed.filter_mode]
    );

    const header = result as ResultSetHeader;
    
    redditFeedCache.delete(feed.guild_id);
    debug(`[BD.Reddit] Feed agregado al guild ${feed.guild_id}, renovando cache!`, "Database");
    return header.insertId;
  } catch (err) {
    error(`[BD.Reddit] Error al agregar feed: ${err}`, "Database");
    throw err;
  }
}

export async function updateRedditFeedLastPost(feedId: number, lastPostId: string, guildId: string): Promise<void> {
  try {
    const pool = await getPool();
    await pool.query(
      "UPDATE reddit_feeds SET last_post_id = ? WHERE id = ?",
      [lastPostId, feedId]
    );

    redditFeedCache.delete(guildId);
    debug(`[BD.Reddit] Se actualizo un feed en ${guildId}, renovando cache!`, "Database");
  } catch (err) {
    error(`[BD.Reddit] Error al actualizar feed: ${err}`, "Database");
    throw err;
  }
}

export async function removeRedditFeed(guildId: string, subredditName: string): Promise<boolean> {
  try {
    const pool = await getPool();
    const [result] = await pool.query(
      "DELETE FROM reddit_feeds WHERE guild_id = ? AND subreddit_name = ?",
      [guildId, subredditName]
    );

    const header = result as ResultSetHeader;
   
    redditFeedCache.delete(guildId);
    debug(`[BD.Reddit] Se elimino un feed en ${guildId}, renovando cache!`, "Database");
    return header.affectedRows > 0;
  } catch (err) {
    error(`[BD.Reddit] Error al eliminar feed: ${err}`, "Database");
    throw err;
  }
}

export async function getAllRedditFeeds(): Promise<RedditFeed[]> {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT id, guild_id, channel_id, subreddit_url, subreddit_name, last_post_id, filter_mode, created_at FROM reddit_feeds"
    );

    return (rows as any[]).map(row => ({
      id: row.id,
      guild_id: row.guild_id,
      channel_id: row.channel_id,
      subreddit_url: row.subreddit_url,
      subreddit_name: row.subreddit_name,
      last_post_id: row.last_post_id,
      filter_mode: row.filter_mode,
      created_at: new Date(row.created_at)
    }));
  } catch (err) {
    error(`[BD.Reddit] Error al cargar la lista de feeds. ERROR!: ${err}`, "Database");
    throw err;
  }
}