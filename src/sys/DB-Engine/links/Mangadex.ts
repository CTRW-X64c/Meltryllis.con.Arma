// sys/DB-Engine/links/Mangadex.ts
import getPool from "../database";
import { ResultSetHeader } from "mysql2/promise";
import { debug, error } from "../../logging";

export interface MangadexFeed {
  id: number;
  guild_id: string;
  channel_id: string;
  RSS_manga: string;
  mangaUrl: string;
  language: string;
  manga_title: string;
  last_chapter: string | null; 
  created_at: Date;
}

const mangadexFeedCache = new Map<string, MangadexFeed[]>();

function invalidateGuildCache(guildId: string): void {
  mangadexFeedCache.delete(guildId);
  debug(`[BD.Mangadex] Invalidando caché del guild: ${guildId}`, "Database");
}

export async function getMangadexFeeds(guildId: string): Promise<MangadexFeed[]> {
  if (mangadexFeedCache.has(guildId)) {
    debug(`[BD.Mangadex] Cache HIT para guild: ${guildId}`, "Database");
    return [...mangadexFeedCache.get(guildId)!];
  }
  debug(`[BD.Mangadex] Cache MISS para guild: ${guildId}, consultando BD`, "Database");
  
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT id, guild_id, channel_id, RSS_manga, mangaUrl, language, manga_title, last_chapter, created_at FROM mangadex_feeds WHERE guild_id = ?",
      [guildId]
    );

    const feeds = (rows as any[]).map(row => ({
      id: row.id,
      guild_id: row.guild_id,
      channel_id: row.channel_id,
      RSS_manga: row.RSS_manga,
      mangaUrl: row.mangaUrl,
      language: row.language,
      manga_title: row.manga_title,
      last_chapter: row.last_chapter,
      created_at: new Date(row.created_at)
    }));

    mangadexFeedCache.set(guildId, feeds);
    debug(`[BD.Mangadex] Caché actualizada para guild: ${guildId} (${feeds.length} feeds)`, "Database");
    
    return feeds;

  } catch (err) {
    error(`[BD.Mangadex] Error al cargar feeds: ${err}`, "Database");
    throw err;
  }
}

export async function AddMangadexFeed(feed: Omit<MangadexFeed, 'id' | 'created_at'>): Promise<number> {
  try {
    const pool = await getPool();
    const [result] = await pool.query(
      "INSERT INTO mangadex_feeds (guild_id, channel_id, RSS_manga, mangaUrl, language, manga_title, last_chapter) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [feed.guild_id, feed.channel_id, feed.RSS_manga, feed.mangaUrl, feed.language, feed.manga_title, feed.last_chapter]
    );

    const header = result as ResultSetHeader;
    
    invalidateGuildCache(feed.guild_id);

    debug(`[BD.Mangadex] Feed agregado (ID: ${header.insertId}) para guild: ${feed.guild_id}`, "Database");
    return header.insertId;
  } catch (err) {
    error(`[BD.Mangadex] Error al agregar feed: ${err}`, "Database");
    throw err;
  }
}

export async function updateMangadexFeedLastChapter(id: number, lastChapter: string, guildId: string): Promise<void> {
  try {
    const pool = await getPool();
    await pool.query(
      "UPDATE mangadex_feeds SET last_chapter = ? WHERE id = ?",
      [lastChapter, id]
    );

    invalidateGuildCache(guildId);
    
    debug(`[BD.Mangadex] Último capítulo actualizado para feed ${id} en guild: ${guildId}`, "Database");
  } catch (err) {
    error(`[BD.Mangadex] Error al actualizar feed: ${err}`, "Database");
    throw err;
  }
}

export async function removeMangadexFeed(guildId: string, feedId: string): Promise<boolean> {
  try {
    const pool = await getPool();
    const [result] = await pool.query(
      "DELETE FROM mangadex_feeds WHERE guild_id = ? AND id = ?",
      [guildId, feedId]
    );

    const header = result as ResultSetHeader;
    if (header.affectedRows > 0) {
        invalidateGuildCache(guildId);
        debug(`[BD.Mangadex] Feed ID ${feedId} eliminado en guild ${guildId}`, "Database");
        return true;
    }
    
    debug(`[BD.Mangadex] No se encontró feed ID ${feedId} en guild ${guildId} para eliminar`, "Database");
    return false;
  } catch (err) {
    error(`[BD.Mangadex] Error al eliminar feed: ${err}`, "Database");
    throw err;
  }
}

export async function getAllMangadexFeeds(): Promise<MangadexFeed[]> {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT id, guild_id, channel_id, RSS_manga, mangaUrl, language, manga_title, last_chapter, created_at FROM mangadex_feeds"
    );

    const feeds = (rows as any[]).map(row => ({
        id: row.id,
        guild_id: row.guild_id,
        channel_id: row.channel_id,
        RSS_manga: row.RSS_manga,
        mangaUrl: row.mangaUrl,
        language: row.language,
        manga_title: row.manga_title,
        last_chapter: row.last_chapter,
        created_at: new Date(row.created_at)
    }));
    
    debug(`[BD.Mangadex] Obtenidos ${feeds.length} feeds totales de la BD`, "Database");
    return feeds;
  } catch (err) {
    error(`[BD.Mangadex] Error al obtener lista de feeds: ${err}`, "Database");
    throw err;
  }
}