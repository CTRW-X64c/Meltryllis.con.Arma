// src/sys/DB-Engine/links/Welcome.ts
import getPool from "../database";
import { debug, error } from "../../logging";

interface welcomeNew {
  channelId: string;
  customMessage: string;
  fText: { text: string, color: string, font: string, size: number }
  sText: { text: string, color: string, font: string, size: number } | null;
  tText: { text: string, color: string, font: string, size: number } | null;
  background: string;
  ringcolor: string;
  exitmesseng: boolean;
}

const welcomeCache = new Map<string, welcomeNew>();
export async function getNewConfiWelcome(guildId: string): Promise<welcomeNew | null> {
  try {
    if (welcomeCache.has(guildId)) {
      debug(`[BD.Welcome] Cache HIT para guild: ${guildId}`, "Database");
      const cached = welcomeCache.get(guildId);
      if (!cached) return null;

      return {
        channelId: cached.channelId, customMessage: cached.customMessage,
        fText: { text: cached.fText.text, color: cached.fText.color, font: cached.fText.font, size: cached.fText.size },
        sText: cached.sText ? { text: cached.sText.text, color: cached.sText.color, font: cached.sText.font, size: cached.sText.size } : null,
        tText: cached.tText ? { text: cached.tText.text, color: cached.tText.color, font: cached.tText.font, size: cached.tText.size } : null,
        background: cached.background, ringcolor: cached.ringcolor, exitmesseng: cached.exitmesseng
      };
    }

    const parseJson = (data: any) => typeof data === 'string' ? JSON.parse(data) : data;
    const pool = await getPool();
    const [rows] = await pool.query("SELECT channel_id, custom_message, fText, sText, tText, background, ringcolor, exitmesseng FROM welcome_banner WHERE guild_id = ?",
      [guildId]
    );

    const row = (rows as any[])[0];
    if (!row) { welcomeCache.set(guildId, null as any); return null; }

    const config: welcomeNew = {
      channelId: row.channel_id, customMessage: row.custom_message,
      fText: parseJson(row.fText), sText: parseJson(row.sText), tText: parseJson(row.tText),
      background: row.background, ringcolor: row.ringcolor, exitmesseng: row.exitmesseng
    };

    welcomeCache.set(guildId, config);
    return { ...config };
  } catch (e) {
    error(`[BD.Welcome] Error en getNewConfiWelcome: ${e}`, "Database");
    return null;
  }
}

export async function setNewConfiWelcome(guildId: string, config: welcomeNew): Promise<void> {
  try {
    const pool = await getPool();
    await pool.query(`INSERT INTO welcome_banner (guild_id, channel_id, custom_message, fText, sText, tText, background, ringcolor, exitmesseng) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE channel_id = ?, custom_message = ?, fText = ?, sText = ?, tText = ?, background = ?, ringcolor = ?, exitmesseng = ?`,
      [guildId, config.channelId, config.customMessage, JSON.stringify(config.fText), JSON.stringify(config.sText), JSON.stringify(config.tText), config.background, config.ringcolor, config.exitmesseng, config.channelId, config.customMessage, JSON.stringify(config.fText), JSON.stringify(config.sText), JSON.stringify(config.tText), config.background, config.ringcolor, config.exitmesseng]
    );
    welcomeCache.set(guildId, config);
  } catch (e) {
    error(`[BD.Welcome] Error en setNewConfiWelcome: ${e}`, "Database");
    throw e;
  }
}

export async function removeWelcome(guildId: string): Promise<void> {
  try {
    const pool = await getPool();
    await pool.query(
      "DELETE FROM welcome_banner WHERE guild_id = ?",
      [guildId]
    );
    welcomeCache.delete(guildId);
  } catch (e) {
    error(`[BD.Welcome] Error en removeWelcome: ${e}`, "Database");
    throw e;
  }
}