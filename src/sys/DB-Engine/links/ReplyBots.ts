// src/sys/DB-Engine/links/ReplyBots.ts
import { getPool } from "../database";
import {debug, error} from "../../logging";

interface ChannelConfig {
  enabled: boolean;
  replyBots: boolean;
}

const configMapCache = new Map<string, Map<string, ChannelConfig>>();

export function invalidateGuildCache(guildId: string): void {
  configMapCache.delete(guildId);
    debug(`[BD.ReplyBots] Renovando la cache del guild: ${guildId}`, "Database");
}

export async function getConfigMap(): Promise<Map<string, Map<string, ChannelConfig>>> {
  if (configMapCache.size > 0) {
    debug("[BD.ReplyBots] Retornando la chache del configMap", "Database");
    return new Map(configMapCache);
  }

  try {
    const pool = await getPool();
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

    debug("[BD.ReplyBots] Cargando cache del configMap", "Database");
    return configMap;
  } catch (err) {
    error(`[BD.ReplyBots] Error al cargar el configMap. ERROR!: ${err}`, "Database");
    throw err;
  }
}

export async function setChannelConfig(guildId: string, channelId: string, config: ChannelConfig): Promise<void> {
  try {
    const pool = await getPool();
    await pool.query(
      "INSERT INTO channel_configs (guild_id, channel_id, enabled, reply_bots) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE enabled = ?, reply_bots = ?",
      [guildId, channelId, config.enabled, config.replyBots, config.enabled, config.replyBots]
    );

    if (!configMapCache.has(guildId)) {
      configMapCache.set(guildId, new Map());
    }
    configMapCache.get(guildId)!.set(channelId, config);
    debug(`[BD.ReplyBots] Actualizado channelConfig para el guild ${guildId}, canal ${channelId}`, "Database");
  } catch (err) {
    error(`[BD.ReplyBots] Error al actualizar channelConfig para el guild ${guildId}, canal ${channelId}: ${err}`, "Database");
    throw err;
  }
}