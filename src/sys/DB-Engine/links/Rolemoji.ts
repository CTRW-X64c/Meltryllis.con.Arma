// src/sys/DB-Engine/links/Rolemoji.ts
import {ResultSetHeader} from "mysql2/promise";
import {getPool} from "../database";
import {debug, error} from "../../logging";

interface RoleAssignment {
  id: number;
  messageId: string;
  channelId: string;
  emoji: string;
  roleId: string;
}

const roleAssignmentCache = new Map<string, Map<string, RoleAssignment>>();

export function invalidateGuildCache(guildId: string): void {
  roleAssignmentCache.delete(guildId);
    debug(`[BD.Rolemoji] Renovando la cache del guild: ${guildId}`, "Database");
}

export async function getRoleAssignments(guildId: string): Promise<Map<string, RoleAssignment>> {
  if (roleAssignmentCache.has(guildId)) {
    debug(`[BD.Rolemoji] Retornando la cache de Rolemoji para el guild: ${guildId}`, "Database");
    return new Map(roleAssignmentCache.get(guildId)!);
  }

  try {
    const pool = await getPool();
    const [rows] = await pool.query("SELECT id, message_id, channel_id, emoji, role_id FROM role_assignments WHERE guild_id = ?", [guildId]);
    const assignmentMap = new Map<string, RoleAssignment>();

    for (const row of rows as any[]) {
      const key = `${row.message_id}:${row.emoji}`;
      assignmentMap.set(key, { id: row.id, messageId: row.message_id, channelId: row.channel_id, emoji: row.emoji, roleId: row.role_id });
    }

    roleAssignmentCache.set(guildId, assignmentMap);
    debug(`[BD.Rolemoji] Cargando cache de Rolemoji para el guild: ${guildId}`, "Database");
    return assignmentMap;
  } catch (err) {
    error(`[BD.Rolemoji] Error al cargar la cache de Rolemoji para el guild: ${guildId}: ${err}`, "Database");
    throw err;
  }
}

export async function setRoleAssignment(guildId: string, messageId: string, channelId: string, emoji: string, roleId: string): Promise<void> {
  try {
    const pool = await getPool();
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
    debug(`[BD.Rolemoji] Actualizado role assignment para el guild ${guildId}.\n Mensaje: ${messageId}, Emoji: ${emoji}, ID: ${assignmentId}`, "Database");
  } catch (err) {
    error(`[BD.Rolemoji] Error al actualizar role assignment para el guild ${guildId},\n Mensaje: ${messageId}, Emoji: ${emoji}, ERROR!: ${err}`, "Database");
    throw err;
  }
}

export async function removeRoleAssignment(guildId: string, id: number): Promise<boolean> {
  try {
    const pool = await getPool();
    const [result] = await pool.query("DELETE FROM role_assignments WHERE id = ? AND guild_id = ?", [id, guildId]);
    const header = result as ResultSetHeader;

    if (header.affectedRows > 0) {
      const assignments = roleAssignmentCache.get(guildId);
      if (assignments) {
        for (const [key, assignment] of assignments.entries()) {
          if (assignment.id === id) {
            assignments.delete(key);
            debug(`[BD.Rolemoji] Eliminado role assignment con ID: ${id} de la cache del guild ${guildId}`, "Database");
            return true;
          }
        }
      }
    }
    return false;
  } catch (err) {
    error(`[BD.Rolemoji] Error al remover el role assignment con ID: ${id}, ERROR!: ${err}`, "Database");
    throw err;
  }
}