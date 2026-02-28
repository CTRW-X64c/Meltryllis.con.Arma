// src/sys/DB-Engine/links/Embed.ts
import getPool from "../database";
import {debug, error} from "../../logging.js";

interface GuildReplacementConfig {
  custom_url: string | null;
  enabled: boolean;
  user_id: string | null;
}

const guildReplacementCache = new Map<string, Map<string, GuildReplacementConfig>>();

export async function getGuildReplacementConfig(guildId: string): Promise<Map<string, GuildReplacementConfig>> {
  if (guildReplacementCache.has(guildId)) {
    debug(`[BD.Embed] Cache HIT para guild: ${guildId}`, "Database");
    return new Map(guildReplacementCache.get(guildId)!);
  }

  debug(`[BD.Embed] Cache MISS para guild: ${guildId}, consultando BD`, "Database");
  
  try {
    const pool = await getPool();
    const [rows] = await pool.query("SELECT replacement_type, custom_url, enabled, user_id FROM guild_replacements WHERE guild_id = ?", 
      [guildId]
    );
    
    const configMap = new Map<string, GuildReplacementConfig>();

    for (const row of rows as any[]) {
      configMap.set(row.replacement_type, { custom_url: row.custom_url, enabled: row.enabled === 1, user_id: row.user_id });
    }

    guildReplacementCache.set(guildId, configMap);
    debug(`[BD.Embed] Caché actualizada para guild: ${guildId}`, "Database");
    
    return configMap;
  } catch (err) {
    error(`[BD.Embed] Error al cargar config: ${err}`, "Database");
    throw err;
  }
}

export async function setGuildReplacementConfig(guildId: string, replacementType: string, config: GuildReplacementConfig): Promise<void> {
  try {
    const pool = await getPool();
    
    await pool.query(`INSERT INTO guild_replacements (guild_id, replacement_type, custom_url, enabled, user_id) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE custom_url = ?, enabled = ?, user_id = ?`,
      [guildId, replacementType, config.custom_url, config.enabled, config.user_id, config.custom_url, config.enabled, config.user_id
      ]
    );

    if (guildReplacementCache.has(guildId)) {
      const guildMap = guildReplacementCache.get(guildId)!;
      guildMap.set(replacementType, { custom_url: config.custom_url, enabled: config.enabled, user_id: config.user_id });
      debug(`[BD.Embed] Caché actualizada en caliente para guild: ${guildId}, Tipo: ${replacementType}`, "Database");
    } 
  } catch (err) {
    error(`[BD.Embed] Error al guardar config: ${err}`, "Database");
    throw err;
  }
}

export async function deleteAllEmbedConfig(guildId: string): Promise<void> {
  try {
    const pool = await getPool();
    await pool.query(
      "DELETE FROM guild_replacements WHERE guild_id = ?",
      [guildId]
    );

    guildReplacementCache.delete(guildId)
    debug(`[BD.Embed] Invalidando caché del guild: ${guildId}`, "Database");
  } catch (err) {
    error(`[BD.Embed] Error al borrar las configuraciones de guild: ${guildId} Error: ${err}`, "Database");
  }
}
