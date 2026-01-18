// src/sys/DB-Engine/links/Welcome.ts
import { getPool } from "../database";
import {debug, error} from "../../logging";

interface WelcomeConfig {
  channelId: string | null;
  enabled: boolean;
  customMessage: string | null;
}

const welcomeConfigCache = new Map<string, WelcomeConfig>();

export function invalidateGuildCache(guildId: string): void {
  welcomeConfigCache.delete(guildId);
    debug(`[BD.Welcome] Renovando la cache del guild: ${guildId}`, "Database");
}

export async function getWelcomeConfig(guildId: string): Promise<WelcomeConfig> {
  if (welcomeConfigCache.has(guildId)) {
    debug(`[BD.Welcome] Retornando la cache del guild: ${guildId}`, "Database");
    
    const cached = welcomeConfigCache.get(guildId)!;
    return {
      channelId: cached.channelId,
      enabled: cached.enabled,
      customMessage: cached.customMessage
    };
  }
  
  try {
    const pool = await getPool();
    const [rows] = await pool.query("SELECT channel_id, enabled, custom_message FROM welcome_configs WHERE guild_id = ?", [guildId]);
    const row = (rows as any[])[0];

    const config: WelcomeConfig = row ? { channelId: row.channel_id, enabled: row.enabled === 1, customMessage: row.custom_message } : { channelId: null, enabled: false, customMessage: null };

    welcomeConfigCache.set(guildId, config);
    debug(`[BD.Welcome] Obteniendo welcomeConfig para el guild: ${guildId}`, "Database");   
    return { ...config };
  } catch (err) {
    error(`[BD.Welcome] Error al cargar cache del guild: ${guildId}, ERROR!: ${err}`, "Database");
    throw err;
  }
}

export async function setWelcomeConfig(guildId: string, config: WelcomeConfig): Promise<void> {
  try {
    const pool = await getPool();
    await pool.query(
      "INSERT INTO welcome_configs (guild_id, channel_id, enabled, custom_message) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE channel_id = ?, enabled = ?, custom_message = ?",
      [guildId, config.channelId, config.enabled, config.customMessage, config.channelId, config.enabled, config.customMessage]
    );

    welcomeConfigCache.set(guildId, config);
    debug(`[BD.Welcome] Actualizado welcomeConfig para el guild: ${guildId}`, "Database");
  } catch (err) {
    error(`[BD.Welcome] Error al actualizar welcomeConfig para el guild: ${guildId}, ERROR!: ${err}`, "Database");
    throw err;
  }
}