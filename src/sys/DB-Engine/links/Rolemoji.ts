// src/sys/DB-Engine/links/Rolemoji.ts
import { ResultSetHeader } from "mysql2/promise";
import getPool from "../database";
import {debug, error} from "../../logging";

interface RoleAssignment {
  id: number;
  messageId: string;
  channelId: string;
  emoji: string;
  roleId: string;
}

const roleAssignmentCache = new Map<string, Map<string, RoleAssignment>>();

function invalidateGuildCache(guildId: string): void {
  roleAssignmentCache.delete(guildId);
  debug(`[BD.Rolemoji] Invalidando caché del guild: ${guildId}`, "Database");
}

export async function getRoleAssignments(guildId: string): Promise<Map<string, RoleAssignment>> {
  if (roleAssignmentCache.has(guildId)) {
    debug(`[BD.Rolemoji] Cache HIT para guild: ${guildId}`, "Database");
    return new Map(roleAssignmentCache.get(guildId)!);
  }
  debug(`[BD.Rolemoji] Cache MISS para guild: ${guildId}, consultando BD`, "Database");
  
  try {
    const pool = await getPool();
    const [rows] = await pool.query("SELECT id, message_id, channel_id, emoji, role_id FROM role_assignments WHERE guild_id = ?", 
      [guildId]
    );
    
    const assignmentMap = new Map<string, RoleAssignment>();

    for (const row of rows as any[]) {
      const key = `${row.message_id}:${row.emoji}`;
      assignmentMap.set(key, { id: row.id, messageId: row.message_id, channelId: row.channel_id, emoji: row.emoji, roleId: row.role_id });
    }

    roleAssignmentCache.set(guildId, assignmentMap);
    debug(`[BD.Rolemoji] Caché actualizada para guild: ${guildId} (${assignmentMap.size} asignaciones)`, "Database");
    return assignmentMap;
  } catch (err) {
    error(`[BD.Rolemoji] Error al cargar asignaciones: ${err}`, "Database");
    throw err;
  }
}

export async function setRoleAssignment( guildId: string, messageId: string, channelId: string, emoji: string, roleId: string ): Promise<void> {
  try {
    const pool = await getPool();
    
    await pool.query(`INSERT INTO role_assignments (guild_id, message_id, channel_id, emoji, role_id) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE role_id = VALUES(role_id), channel_id = VALUES(channel_id)`,
      [guildId, messageId, channelId, emoji, roleId]
    );

    invalidateGuildCache(guildId);
  
    debug(`[BD.Rolemoji] Asignación guardada en BD y caché invalidada para guild: ${guildId}, Mensaje: ${messageId}, Emoji: ${emoji}`, "Database");
  } catch (err) {
    error(`[BD.Rolemoji] Error al guardar asignación: ${err}`, "Database");
    throw err;
  }
}

export async function removeRoleAssignment(guildId: string, id: number): Promise<boolean> {
  try {
    const pool = await getPool();
    const [result] = await pool.query(
      "DELETE FROM role_assignments WHERE id = ? AND guild_id = ?", 
      [id, guildId]
    );
    
    const header = result as ResultSetHeader;
    if (header.affectedRows > 0) {
      invalidateGuildCache(guildId);
      debug(`[BD.Rolemoji] Asignación ID ${id} eliminada de BD y caché invalidada para guild: ${guildId}`, "Database");
      return true;
    }
    
    debug(`[BD.Rolemoji] No se encontró asignación ID ${id} en guild ${guildId} para eliminar`, "Database");
    return false;
  } catch (err) {
    error(`[BD.Rolemoji] Error al eliminar asignación ID ${id}: ${err}`, "Database");
    throw err;
  }
}

export async function getRoleAssignment( guildId: string, messageId: string, emoji: string ): Promise<RoleAssignment | null> {
  try {
    const allAssignments = await getRoleAssignments(guildId);
    const key = `${messageId}:${emoji}`;
    return allAssignments.get(key) || null;
  } catch (err) {
    error(`[BD.Rolemoji] Error al obtener asignación específica: ${err}`, "Database");
    throw err;
  }
}