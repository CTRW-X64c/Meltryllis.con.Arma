// src/sys/DB-Engine/links/Embed.ts
import { getPool } from "../database";
import {debug, error} from "../../logging.js";

interface GuildReplacementConfig {
  custom_url: string | null;
  enabled: boolean;
  user_id: string | null;
}

const guildReplacementCache = new Map<string, Map<string, GuildReplacementConfig>>();

export function invalidateGuildCache(guildId: string): void {
  guildReplacementCache.delete(guildId);
  debug(`[BD.Embed] Invalidando la chache del guild: ${guildId}`, "Database");
}

export async function getGuildReplacementConfig(guildId: string): Promise<Map<string, GuildReplacementConfig>> {
  if (guildReplacementCache.has(guildId)) {
    debug(`[BD.Embed] Retornando la chache del guild: ${guildId}`, "Database");
    return new Map(guildReplacementCache.get(guildId)!);
  }

  try {
    const pool = await getPool();
    const [rows] = await pool.query("SELECT replacement_type, custom_url, enabled, user_id FROM guild_replacements WHERE guild_id = ?", [guildId]);
    const configMap = new Map<string, GuildReplacementConfig>();

    for (const row of rows as any[]) {
      configMap.set(row.replacement_type, { custom_url: row.custom_url, enabled: row.enabled === 1, user_id: row.user_id });
    }

    guildReplacementCache.set(guildId, configMap);
    debug(`[BD.Embed] Cargando cache del guild: ${guildId}`, "Database");
    return configMap;
  } catch (err) {
    error(`[BD.Embed] Error al cargar cache del guild: ${guildId}: ${err}`, "Database");
    throw err;
  }
}

export async function setGuildReplacementConfig(guildId: string, replacementType: string, config: GuildReplacementConfig): Promise<void> {
  try {
    const pool = await getPool();
    await pool.query(
      "INSERT INTO guild_replacements (guild_id, replacement_type, custom_url, enabled, user_id) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE custom_url = ?, enabled = ?, user_id = ?",
      [guildId, replacementType, config.custom_url, config.enabled, config.user_id, config.custom_url, config.enabled, config.user_id]
    );

    if (!guildReplacementCache.has(guildId)) {
      guildReplacementCache.set(guildId, new Map());
    }
    guildReplacementCache.get(guildId)!.set(replacementType, config);
    debug(`[BD.Embed] Actualizado la cache del guild: ${guildId}, Tipo de remplazo: ${replacementType}`, "Database");
  } catch (err) {
    error(`[BD.Embed] Error al actualizar la cache del guild: ${guildId}, Tipo de remplazo fallido: ${replacementType}: ${err}`, "Database");
    throw err;
  }
}

