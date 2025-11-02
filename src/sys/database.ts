// src/sys/database.ts
import { createPool, Pool, ResultSetHeader } from "mysql2/promise";
import { error, debug, info } from "./logging";

interface ChannelConfig {
  enabled: boolean;
  replyBots: boolean;
}

interface GuildReplacementConfig {
  custom_url: string | null;
  enabled: boolean;
  user_id: string | null;
}

interface WelcomeConfig {
  channelId: string | null;
  enabled: boolean;
  customMessage: string | null;
}

export interface RoleAssignment {
  id: number;
  messageId: string;
  channelId: string;
  emoji: string;
  roleId: string;
}

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

export interface RedditFeed {
  id: number;
  guild_id: string;
  channel_id: string;
  subreddit_url: string;
  subreddit_name: string;
  last_post_id: string | null;
  created_at: Date;
}

let pool: Pool | null = null;
let isInitialized = false; 
let initializationPromise: Promise<void> | null = null;

const configMapCache = new Map<string, Map<string, ChannelConfig>>();
const guildReplacementCache = new Map<string, Map<string, GuildReplacementConfig>>();
const welcomeConfigCache = new Map<string, WelcomeConfig>();
const roleAssignmentCache = new Map<string, Map<string, RoleAssignment>>();
const youtubeFeedCache = new Map<string, YouTubeFeed[]>();
const redditFeedCache = new Map<string, RedditFeed[]>();

export async function initializeDatabase(): Promise<void> {
  if (isInitialized) {
    return;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  const maxRetries = 3;
  const retryDelay = 5000;

  initializationPromise = (async () => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        info(`Intentando conectar a la base de datos (Intento ${attempt}/${maxRetries})...`, "Database");

        pool = createPool({
          host: process.env.DB_HOST,
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_DATABASE,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
        });

        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();

        await pool.query(`
          CREATE TABLE IF NOT EXISTS channel_configs (
            guild_id VARCHAR(30) NOT NULL,
            channel_id VARCHAR(30) NOT NULL,
            enabled BOOLEAN DEFAULT TRUE,
            reply_bots BOOLEAN DEFAULT TRUE,
            PRIMARY KEY (guild_id, channel_id)
          )
        `);

        await pool.query(`
          CREATE TABLE IF NOT EXISTS guild_replacements (
            guild_id VARCHAR(30) NOT NULL,
            replacement_type VARCHAR(50) NOT NULL,
            custom_url VARCHAR(255),
            enabled BOOLEAN DEFAULT TRUE,
            user_id VARCHAR(30),
            PRIMARY KEY (guild_id, replacement_type)
          )
        `);

        await pool.query(`
          CREATE TABLE IF NOT EXISTS welcome_configs (
            guild_id VARCHAR(30) NOT NULL,
            channel_id VARCHAR(30),
            enabled BOOLEAN DEFAULT FALSE,
            custom_message TEXT,
            PRIMARY KEY (guild_id)
          )
        `);

        await pool.query(`
          CREATE TABLE IF NOT EXISTS role_assignments (
            id INT AUTO_INCREMENT,
            guild_id VARCHAR(30) NOT NULL,
            message_id VARCHAR(30) NOT NULL,
            channel_id VARCHAR(30) NOT NULL,
            emoji VARCHAR(50) NOT NULL,
            role_id VARCHAR(30) NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY unique_assignment (guild_id, message_id, emoji)
          )
        `);

        await pool.query(`
          CREATE TABLE IF NOT EXISTS youtube_feeds (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(30) NOT NULL,
          channel_id VARCHAR(30) NOT NULL,
          youtube_channel_id VARCHAR(50) NOT NULL,
          youtube_channel_name VARCHAR(100) NOT NULL,
          rss_url VARCHAR(255) NOT NULL,
          last_video_id VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_guild_youtube (guild_id, youtube_channel_id)
          )
        `);

        await pool.query(`
          CREATE TABLE IF NOT EXISTS reddit_feeds (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(30) NOT NULL,
          channel_id VARCHAR(30) NOT NULL,
          subreddit_url VARCHAR(50) NOT NULL,
          subreddit_name VARCHAR(100) NOT NULL,
          last_post_id VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_guild_subreddit (guild_id, subreddit_name)
          )
        `);

        info(`✅ Conectado a la base de datos: ${process.env.DB_DATABASE}`, "Database");

        isInitialized = true;
        return;

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        error(`❌ Intento ${attempt}/${maxRetries} fallido: ${errorMessage}`, "Database");
        
        if (pool) {
          try {
            await pool.end();
          } catch (endErr) {
            debug(`Error al cerrar pool: ${endErr}`, "Database");
          }
          pool = null;
        }

        if (attempt < maxRetries) {
          info(`🔄 Reintentando...`, "Database");
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          error(`⚡🔌 No se pudo conectar a la base de datos!!`, "Database");
          error(`📋 Revisa que tu APP/Docker BD se está ejecutando y tu configuración de conexión es correcta`, "Database");
          process.exit(1);
        }
      }
    }
  })();

  return initializationPromise;
}

export function isDatabaseInitialized(): boolean {
  return isInitialized;
}

export function getDatabasePool(): Pool | null {
  return pool;
}

//Replybots [BD]

export async function getConfigMap(): Promise<Map<string, Map<string, ChannelConfig>>> {
  if (configMapCache.size > 0) {
    debug("Returning cached configMap", "Database");
    return configMapCache;
  }

  if (!pool) throw new Error("Database pool not initialized");

  try {
    const [rows] = await pool.query("SELECT guild_id, channel_id, enabled, reply_bots FROM channel_configs");
    const configMap = new Map<string, Map<string, ChannelConfig>>();

    for (const row of rows as any[]) {
      const guildId = row.guild_id;
      const channelConfig = { enabled: row.enabled, replyBots: row.reply_bots };

      if (!configMap.has(guildId)) {
        configMap.set(guildId, new Map());
      }
      configMap.get(guildId)!.set(row.channel_id, channelConfig);
    }

    configMapCache.clear();
    for (const [guildId, channels] of configMap) {
      configMapCache.set(guildId, channels);
    }

    debug("Fetched and cached configMap", "Database");
    return configMap;
  } catch (err) {
    error(`Failed to fetch configMap: ${err}`, "Database");
    throw err;
  }
}

export async function setChannelConfig(guildId: string, channelId: string, config: ChannelConfig): Promise<void> {
  if (!pool) throw new Error("Database pool not initialized");

  try {
    await pool.query(
      "INSERT INTO channel_configs (guild_id, channel_id, enabled, reply_bots) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE enabled = ?, reply_bots = ?",
      [guildId, channelId, config.enabled, config.replyBots, config.enabled, config.replyBots]
    );

    if (!configMapCache.has(guildId)) {
      configMapCache.set(guildId, new Map());
    }
    configMapCache.get(guildId)!.set(channelId, config);
    debug(`Updated channelConfig for guild ${guildId}, channel ${channelId}`, "Database");
  } catch (err) {
    error(`Failed to set channelConfig for guild ${guildId}, channel ${channelId}: ${err}`, "Database");
    throw err;
  }
}

//Embed [BD]

export async function getGuildReplacementConfig(guildId: string): Promise<Map<string, GuildReplacementConfig>> {
  if (guildReplacementCache.has(guildId)) {
    debug(`Returning cached guildReplacementConfig for guild ${guildId}`, "Database");
    return guildReplacementCache.get(guildId)!;
  }

  if (!pool) throw new Error("Database pool not initialized");

  try {
    const [rows] = await pool.query("SELECT replacement_type, custom_url, enabled, user_id FROM guild_replacements WHERE guild_id = ?", [guildId]);
    const configMap = new Map<string, GuildReplacementConfig>();

    for (const row of rows as any[]) {
      configMap.set(row.replacement_type, { custom_url: row.custom_url, enabled: row.enabled === 1, user_id: row.user_id });
    }

    guildReplacementCache.set(guildId, configMap);
    debug(`Fetched and cached guildReplacementConfig for guild ${guildId}`, "Database");
    return configMap;
  } catch (err) {
    error(`Failed to fetch guildReplacementConfig for guild ${guildId}: ${err}`, "Database");
    throw err;
  }
}

export async function setGuildReplacementConfig(guildId: string, replacementType: string, config: GuildReplacementConfig): Promise<void> {
  if (!pool) throw new Error("Database pool not initialized");

  try {
    await pool.query(
      "INSERT INTO guild_replacements (guild_id, replacement_type, custom_url, enabled, user_id) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE custom_url = ?, enabled = ?, user_id = ?",
      [guildId, replacementType, config.custom_url, config.enabled, config.user_id, config.custom_url, config.enabled, config.user_id]
    );

    if (!guildReplacementCache.has(guildId)) {
      guildReplacementCache.set(guildId, new Map());
    }
    guildReplacementCache.get(guildId)!.set(replacementType, config);
    debug(`Updated guildReplacementConfig for guild ${guildId}, replacement_type ${replacementType}`, "Database");
  } catch (err) {
    error(`Failed to set guildReplacementConfig for guild ${guildId}, replacement_type ${replacementType}: ${err}`, "Database");
    throw err;
  }
}

// Welcome [BD]

export async function getWelcomeConfig(guildId: string): Promise<WelcomeConfig> {
  if (welcomeConfigCache.has(guildId)) {
    debug(`Returning cached welcomeConfig for guild ${guildId}`, "Database");
    return welcomeConfigCache.get(guildId)!;
  }

  if (!pool) throw new Error("Database pool not initialized");

  try {
    const [rows] = await pool.query("SELECT channel_id, enabled, custom_message FROM welcome_configs WHERE guild_id = ?", [guildId]);
    const row = (rows as any[])[0];

    const config: WelcomeConfig = row ? { channelId: row.channel_id, enabled: row.enabled === 1, customMessage: row.custom_message } : { channelId: null, enabled: false, customMessage: null };

    welcomeConfigCache.set(guildId, config);
    debug(`Fetched and cached welcomeConfig for guild ${guildId}`, "Database");
    return config;
  } catch (err) {
    error(`Failed to fetch welcomeConfig for guild ${guildId}: ${err}`, "Database");
    throw err;
  }
}

export async function setWelcomeConfig(guildId: string, config: WelcomeConfig): Promise<void> {
  if (!pool) throw new Error("Database pool not initialized");

  try {
    await pool.query(
      "INSERT INTO welcome_configs (guild_id, channel_id, enabled, custom_message) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE channel_id = ?, enabled = ?, custom_message = ?",
      [guildId, config.channelId, config.enabled, config.customMessage, config.channelId, config.enabled, config.customMessage]
    );

    welcomeConfigCache.set(guildId, config);
    debug(`Updated welcomeConfig for guild ${guildId}`, "Database");
  } catch (err) {
    error(`Failed to set welcomeConfig for guild ${guildId}: ${err}`, "Database");
    throw err;
  }
}

// Rolemoji [BD]

export async function getRoleAssignments(guildId: string): Promise<Map<string, RoleAssignment>> {
  if (roleAssignmentCache.has(guildId)) {
    debug(`Returning cached role assignments for guild ${guildId}`, "Database");
    return roleAssignmentCache.get(guildId)!;
  }

  if (!pool) throw new Error("Database pool not initialized");

  try {
    const [rows] = await pool.query("SELECT id, message_id, channel_id, emoji, role_id FROM role_assignments WHERE guild_id = ?", [guildId]);
    const assignmentMap = new Map<string, RoleAssignment>();

    for (const row of rows as any[]) {
      const key = `${row.message_id}:${row.emoji}`;
      assignmentMap.set(key, { id: row.id, messageId: row.message_id, channelId: row.channel_id, emoji: row.emoji, roleId: row.role_id });
    }

    roleAssignmentCache.set(guildId, assignmentMap);
    debug(`Fetched and cached role assignments for guild ${guildId}`, "Database");
    return assignmentMap;
  } catch (err) {
    error(`Failed to fetch role assignments for guild ${guildId}: ${err}`, "Database");
    throw err;
  }
}

export async function setRoleAssignment(guildId: string, messageId: string, channelId: string, emoji: string, roleId: string): Promise<void> {
  if (!pool) throw new Error("Database pool not initialized");

  try {
    const [result] = await pool.query(
      "INSERT INTO role_assignments (guild_id, message_id, channel_id, emoji, role_id) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE role_id = VALUES(role_id), channel_id = VALUES(channel_id), guild_id = VALUES(guild_id)",
      [guildId, messageId, channelId, emoji, roleId]
    );

    const header = result as ResultSetHeader;
    let assignmentId = header.insertId;

    if (header.affectedRows === 2) {
      const [rows] = await pool.query("SELECT id FROM role_assignments WHERE guild_id = ? AND message_id = ? AND emoji = ?", [guildId, messageId, emoji]);
    
      const assignedRows = rows as any[]; 
      
      if (assignedRows.length > 0) {
        assignmentId = assignedRows[0].id;
      }
    }
    
    const key = `${messageId}:${emoji}`;
    if (!roleAssignmentCache.has(guildId)) {
      roleAssignmentCache.set(guildId, new Map());
    }
    roleAssignmentCache.get(guildId)!.set(key, { id: assignmentId, messageId, channelId, emoji, roleId });
    debug(`Updated role assignment for guild ${guildId}, message ${messageId}, emoji ${emoji} with ID ${assignmentId}`, "Database");
  } catch (err) {
    error(`Failed to set role assignment for guild ${guildId}, message ${messageId}, emoji ${emoji}: ${err}`, "Database");
    throw err;
  }
}

export async function removeRoleAssignment(guildId: string, id: number): Promise<boolean> {
  if (!pool) throw new Error("Database pool not initialized");

  try {
    const [result] = await pool.query("DELETE FROM role_assignments WHERE id = ? AND guild_id = ?", [id, guildId]);
    
    const header = result as ResultSetHeader;

    if (header.affectedRows > 0) {
      const assignments = roleAssignmentCache.get(guildId);
      if (assignments) {
        for (const [key, assignment] of assignments.entries()) {
          if (assignment.id === id) {
            assignments.delete(key);
            debug(`Removed role assignment with ID ${id} from cache for guild ${guildId}`, "Database");
            return true;
          }
        }
      }
    }
    return false;
  } catch (err) {
    error(`Failed to remove role assignment with ID ${id}: ${err}`, "Database");
    throw err;
  }
}

//Youtube [BD]

export async function getYouTubeFeeds(guildId: string): Promise<YouTubeFeed[]> {
  if (youtubeFeedCache.has(guildId)) {
    return youtubeFeedCache.get(guildId)!;
  }

  if (!pool) throw new Error("Database pool not initialized");

  try {
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
    return feeds;
  } catch (err) {
    error(`Failed to fetch YouTube feeds for guild ${guildId}: ${err}`, "Database");
    throw err;
  }
}

export async function addYouTubeFeed(feed: Omit<YouTubeFeed, 'id' | 'created_at'>): Promise<number> {
  if (!pool) throw new Error("Database pool not initialized");

  try {
    const [result] = await pool.query(
      "INSERT INTO youtube_feeds (guild_id, channel_id, youtube_channel_id, youtube_channel_name, rss_url, last_video_id) VALUES (?, ?, ?, ?, ?, ?)",
      [feed.guild_id, feed.channel_id, feed.youtube_channel_id, feed.youtube_channel_name, feed.rss_url, feed.last_video_id]
    );

    const header = result as ResultSetHeader;
    youtubeFeedCache.delete(feed.guild_id); // Invalidar cache
    return header.insertId;
  } catch (err) {
    error(`Failed to add YouTube feed: ${err}`, "Database");
    throw err;
  }
}

export async function updateYouTubeFeedLastVideo(id: number, lastVideoId: string, guildId: string): Promise<void> {
  if (!pool) throw new Error("Database pool not initialized");

  try {
    await pool.query(
      "UPDATE youtube_feeds SET last_video_id = ? WHERE id = ?",
      [lastVideoId, id]
    );

    // Invalidar cache para forzar refresco
    youtubeFeedCache.delete(guildId);
  } catch (err) {
    error(`Failed to update YouTube feed last video: ${err}`, "Database");
    throw err;
  }
}

export async function removeYouTubeFeed(guildId: string, youtubeChannelId: string): Promise<boolean> {
  if (!pool) throw new Error("Database pool not initialized");

  try {
    const [result] = await pool.query(
      "DELETE FROM youtube_feeds WHERE guild_id = ? AND youtube_channel_id = ?",
      [guildId, youtubeChannelId]
    );

    const header = result as ResultSetHeader;
    youtubeFeedCache.delete(guildId);
    return header.affectedRows > 0;
  } catch (err) {
    error(`Failed to remove YouTube feed: ${err}`, "Database");
    throw err;
  }
}

export async function getAllYouTubeFeeds(): Promise<YouTubeFeed[]> {
  if (!pool) throw new Error("Database pool not initialized");

  try {
    const [rows] = await pool.query(
      "SELECT id, guild_id, channel_id, youtube_channel_id, youtube_channel_name, rss_url, last_video_id, created_at FROM youtube_feeds"
    );

    return (rows as any[]).map(row => ({
      id: row.id,
      guild_id: row.guild_id,
      channel_id: row.channel_id,
      youtube_channel_id: row.youtube_channel_id,
      youtube_channel_name: row.youtube_channel_name,
      rss_url: row.rss_url,
      last_video_id: row.last_video_id,
      created_at: new Date(row.created_at)
    }));
  } catch (err) {
    error(`Failed to fetch all YouTube feeds: ${err}`, "Database");
    throw err;
  }
}

// Reddit [BD]

export async function getRedditFeeds(guildId: string): Promise<RedditFeed[]> {
  if (redditFeedCache.has(guildId)) {
    return redditFeedCache.get(guildId)!;
  }

  if (!pool) throw new Error("Database pool not initialized");

  try {
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
      created_at: new Date(row.created_at)
    }));

    redditFeedCache.set(guildId, feeds);
    return feeds;
  } catch (err) {
    error(`Failed to fetch Reddit feeds for guild ${guildId}: ${err}`, "Database");
    throw err;
  }
}

export async function addRedditFeed(feed: Omit<RedditFeed, 'id' | 'created_at'>): Promise<number> {
  if (!pool) throw new Error("Database pool no iniciada");

  try {
    const [result] = await pool.query(
      "INSERT INTO reddit_feeds (guild_id, channel_id, subreddit_url, subreddit_name, last_post_id) VALUES (?, ?, ?, ?, ?)",
      [feed.guild_id, feed.channel_id, feed.subreddit_url, feed.subreddit_name, feed.last_post_id]
    );

    const header = result as ResultSetHeader;
    redditFeedCache.delete(feed.guild_id); 
    return header.insertId;
  } catch (err) {
    error(`Failed to add Reddit feed: ${err}`, "Database");
    throw err;
  }
}

export async function updateRedditFeedLastPost(feedId: number, lastPostId: string, guildId: string): Promise<void> {
  if (!pool) throw new Error("Database pool not initialized");

  try {
    await pool.query(
      "UPDATE reddit_feeds SET last_post_id = ? WHERE id = ?",
      [lastPostId, feedId]
    );

    // Invalidar cache para forzar refresco
    redditFeedCache.delete(guildId);
  } catch (err) {
    error(`Failed to update Reddit feed last video: ${err}`, "Database");
    throw err;
  }
}

export async function removeRedditFeed(guildId: string, subredditName: string): Promise<boolean> {
  if (!pool) throw new Error("Database pool not initialized");

  try {
    const [result] = await pool.query(
      "DELETE FROM reddit_feeds WHERE guild_id = ? AND subreddit_name = ?",
      [guildId, subredditName]
    );

    const header = result as ResultSetHeader;
    redditFeedCache.delete(guildId);
    return header.affectedRows > 0;
  } catch (err) {
    error(`Failed to remove Reddit feed: ${err}`, "Database");
    throw err;
  }
}

export async function getAllRedditFeeds(): Promise<RedditFeed[]> {
  if (!pool) throw new Error("Database pool not initialized");

  try {
    const [rows] = await pool.query(
      "SELECT id, guild_id, channel_id, subreddit_url, subreddit_name, last_post_id, created_at FROM reddit_feeds"
    );

    return (rows as any[]).map(row => ({
      id: row.id,
      guild_id: row.guild_id,
      channel_id: row.channel_id,
      subreddit_url: row.subreddit_url,
      subreddit_name: row.subreddit_name,
      last_post_id: row.last_post_id,
      created_at: new Date(row.created_at)
    }));
  } catch (err) {
    error(`Failed to fetch all Reddit feeds: ${err}`, "Database");
    throw err;
  }
}

// LIMITE [BD]