// src/sys/DB-Engine/links/JointoVoice.ts
import { getPool } from "../database";
import {debug, error} from "../../logging";

export interface VoiceConfig {
  channelId: string;
  enabled: boolean;
}

export interface TempVoiceChannel {
  channelId: string;
  guildId: string;
  ownerId: string;
}

const voiceConfigCache = new Map<string, VoiceConfig>();

export function invalidateGuildCache(guildId: string): void {
  voiceConfigCache.delete(guildId);
    debug(`[BD.JointoVoice] Renovando la cache del gremio: ${guildId}`, "Database");
}

export async function getVoiceConfig(guildId: string): Promise<VoiceConfig | null> {
  if (voiceConfigCache.has(guildId)) {
    return voiceConfigCache.get(guildId)!;
  }

  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT channel_id, enabled FROM voice_configs WHERE guild_id = ?",
      [guildId]
    );
    const row = (rows as any[])[0];

    if (!row) return null;

    const config: VoiceConfig = {
      channelId: row.channel_id,
      enabled: row.enabled === 1
    };

    voiceConfigCache.set(guildId, config);
    return config;
  } catch (err) {
    error(`[BD.JointoVoice] Error al cargar cache del guild: ${guildId}: ${err}`, "Database");
    throw err;
  }
}

export async function setVoiceConfig(guildId: string, channelId: string, enabled: boolean = true): Promise<void> {
  try {
    const pool = await getPool();
    await pool.query(
      "INSERT INTO voice_configs (guild_id, channel_id, enabled) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE channel_id = VALUES(channel_id), enabled = VALUES(enabled)",
      [guildId, channelId, enabled]
    );

    voiceConfigCache.set(guildId, { channelId, enabled });
    debug(`[BD.JointoVoice] Actualizado la cache del guild: ${guildId}`, "Database");
  } catch (err) {
    error(`[BD.JointoVoice] Error al actualizar la cache del guild: ${guildId}. ERROR!: ${err}`, "Database");
    throw err;
  }
}

export async function addTempVoiceChannel(channelId: string, guildId: string, ownerId: string): Promise<void> {
  try {
    const pool = await getPool();
    await pool.query(
      "INSERT INTO temp_voice_channels (channel_id, guild_id, owner_id) VALUES (?, ?, ?)",
      [channelId, guildId, ownerId]
    );
    debug(`[BD.JointoVoice] Nuevo canal de voz temporal (${channelId}) registrado en el guild: ${guildId}`, "Database");
  } catch (err) {
    error(`[BD.JointoVoice] Error al registrar canal de voz temporal. ERROR!: ${err}`, "Database");
    throw err;
  }
}

export async function removeTempVoiceChannel(channelId: string): Promise<void> {
  try {
    const pool = await getPool();
    await pool.query("DELETE FROM temp_voice_channels WHERE channel_id = ?", [channelId]);
    debug(`[BD.JointoVoice] Eliminado canal de voz temporal ${channelId}`, "Database");
  } catch (err) {
    error(`[BD.JointoVoice] Error al eliminar canal de voz temporal. ERROR!: ${err}`, "Database");
    throw err;
  }
}

export async function isTempVoiceChannel(channelId: string): Promise<boolean> {
  try {
    const pool = await getPool();
    const [rows] = await pool.query("SELECT 1 FROM temp_voice_channels WHERE channel_id = ?", [channelId]);
    return (rows as any[]).length > 0;
  } catch (err) {
    error(`[BD.JointoVoice] Error al verificar si es un canal temporal: ERROR!: ${err}`, "Database");
    return false;
  }
}

export async function getAllTempVoiceChannels(): Promise<TempVoiceChannel[]> {
  try {
    const pool = await getPool();
    const [rows] = await pool.query("SELECT channel_id, guild_id, owner_id FROM temp_voice_channels");
    
    return (rows as any[]).map(row => ({
      channelId: row.channel_id,
      guildId: row.guild_id,
      ownerId: row.owner_id
    }));
  } catch (err) {
    error(`[BD.JointoVoice] Error al cargar la lista de canales temporales: ${err}`, "Database");
    throw err;
  }
}

export async function getGuildTempChannelCount(guildId: string): Promise<number> {
  try {
    const pool = await getPool();
    const [rows] = await pool.query("SELECT COUNT(*) as count FROM temp_voice_channels WHERE guild_id = ?", [guildId]);
    return (rows as any[])[0].count;
  } catch (err) {
    return 0;
  }
}
