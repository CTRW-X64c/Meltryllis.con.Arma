// src/sys/DB-Engine/links/ReplyBots.ts
import getPool from "../database";
import { debug, error } from "../../logging";

interface ChannelConfig {
  enabled: boolean;
  replyBots: boolean;
}

const configMapCache = new Map<string, Map<string, ChannelConfig>>();

export async function getConfigMap(): Promise<Map<string, Map<string, ChannelConfig>>> {
  if (configMapCache.size > 0) {
    debug("[BD.ReplyBots] Cache HIT - Retornando configMap completo", "Database");
    const clone = new Map<string, Map<string, ChannelConfig>>();
    for (const [guildId, channels] of configMapCache) {
      clone.set(guildId, new Map(channels));
    }
    return clone;
  }

  debug("[BD.ReplyBots] Cache MISS - Cargando configMap desde BD", "Database");
  
  try {
    const pool = await getPool();
    const [rows] = await pool.query("SELECT guild_id, channel_id, enabled, reply_bots FROM channel_configs");
    
    configMapCache.clear();

    for (const row of rows as any[]) {
      const guildId = row.guild_id;
      const channelConfig: ChannelConfig = { enabled: row.enabled === 1, replyBots: row.reply_bots === 1 };

      if (!configMapCache.has(guildId)) { configMapCache.set(guildId, new Map());}
      configMapCache.get(guildId)!.set(row.channel_id, channelConfig);
    }

    debug(`[BD.ReplyBots] Caché cargada: ${configMapCache.size} guilds en memoria`, "Database");
    
    const result = new Map<string, Map<string, ChannelConfig>>();
    for (const [guildId, channels] of configMapCache) { result.set(guildId, new Map(channels)); }
    return result;
  } catch (err) {
    error(`[BD.ReplyBots] Error al cargar configMap: ${err}`, "Database");
    throw err;
  }
}

export async function setChannelConfig(guildId: string, channelId: string, config: ChannelConfig): Promise<void> {
  try {
    const pool = await getPool();    
    await pool.query(`INSERT INTO channel_configs (guild_id, channel_id, enabled, reply_bots) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE enabled = ?, reply_bots = ?`,
      [ guildId, channelId, config.enabled, config.replyBots, config.enabled, config.replyBots]
    );

    if (!configMapCache.has(guildId)) {
        configMapCache.set(guildId, new Map());
    }
    
    configMapCache.get(guildId)!.set(channelId, config);
    debug(`[BD.ReplyBots] Config guardada en BD y caché RAM actualizada para guild: ${guildId}, canal: ${channelId}`, "Database");
  } catch (err) {
    error(`[BD.ReplyBots] Error al guardar config: ${err}`, "Database");
    throw err;
  }
}
