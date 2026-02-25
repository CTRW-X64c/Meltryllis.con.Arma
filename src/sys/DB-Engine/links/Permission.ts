// src/sys/DB-Engine/links/Permissions.ts
import { getPool } from "../database";
import { ResultSetHeader } from "mysql2/promise";
import { error, debug } from "../../logging";

export interface PermissionEntry {
    target_id: string;
    target_type: 'USER' | 'ROLE';
    command_name: string;
    user_give_perm: string;
}

const permCache = new Map<string, Map<string, Set<string>>>();

export function invalidatePermCache(guildId: string, commandName?: string) {
    if (commandName) {
        const guildCache = permCache.get(guildId);
        if (guildCache) {
            guildCache.delete(commandName);
            debug(`[BD.Permissions] Renovando cache del guild: ${guildId}, comando: ${commandName}`, "Database");
        }
    } else {
        permCache.delete(guildId);
        debug(`[BD.Permissions] Renovando toda la cache del guild: ${guildId}`, "Database");
    }
}


export async function getCommandPermissions(guildId: string, commandName: string): Promise<Set<string>> {
    let guildCache = permCache.get(guildId);
    if (!guildCache) {
        guildCache = new Map<string, Set<string>>();
        permCache.set(guildId, guildCache);
    }
    
    if (guildCache.has(commandName)) {
        debug(`[BD.Permissions] Retornando cache del guild: ${guildId}, comando: ${commandName}`, "Database");
        return guildCache.get(commandName)!;
    }

    try {
        const pool = await getPool();
        const [rows] = await pool.query(
            "SELECT target_id FROM command_permissions WHERE guild_id = ? AND command_name = ?",
            [guildId, commandName]
        );

        const allowedIds = new Set<string>();
        (rows as any[]).forEach(row => allowedIds.add(row.target_id));

        guildCache.set(commandName, allowedIds);
        debug(`[BD.Permissions] Cargando cache del guild: ${guildId}, comando: ${commandName}`, "Database");
        return allowedIds;
    } catch (err) {
        error(`Error cargando permisos para guild ${guildId}, comando ${commandName}: ${err}`, "DB.Permissions");
        return new Set(); 
    }
}


export async function addCommandPermission(guildId: string, targetId: string, type: 'USER' | 'ROLE', commandName: string, userGivePerm: string): Promise<boolean> {
    try {
        const pool = await getPool();
        await pool.query(
            "INSERT INTO command_permissions (guild_id, target_id, target_type, command_name, user_give_perm) VALUES (?, ?, ?, ?, ?)",
            [guildId, targetId, type, commandName, userGivePerm]
        );
        
        invalidatePermCache(guildId, commandName);
        debug(`[BD.Permissions] Añadiendo permiso al guild: ${guildId}, comando: ${commandName}, target: ${targetId}`, "Database");
        return true;
    } catch (err: any) {
        if (err.code === 'ER_DUP_ENTRY') return false; // Ya existía
        error(`Error añadiendo permiso: ${err}`, "DB.Permissions");
        throw err;
    }
}


export async function removeCommandPermission(guildId: string, targetId: string, commandName: string): Promise<boolean> {
    try {
        const pool = await getPool();
        const [result] = await pool.query(
            "DELETE FROM command_permissions WHERE guild_id = ? AND target_id = ? AND command_name = ?",
            [guildId, targetId, commandName]
        );
        
        const header = result as ResultSetHeader;
        if (header.affectedRows > 0) {
            invalidatePermCache(guildId, commandName);
            debug(`[BD.Permissions] Eliminando permiso del guild: ${guildId}, comando: ${commandName}, target: ${targetId}`, "Database");
            return true;
        }
        debug(`[BD.Permissions] No se encontró el permiso para el guild: ${guildId}, comando: ${commandName}, target: ${targetId}`, "Database");
        return false;
    } catch (err) {
        error(`Error eliminando permiso: ${err}`, "DB.Permissions");
        throw err;
    }
}


export async function listCommandPermissions(guildId: string, commandName?: string): Promise<PermissionEntry[]> {
    try {
        const pool = await getPool();
        let query = "SELECT target_id, target_type, command_name, user_give_perm FROM command_permissions WHERE guild_id = ?";
        const params: any[] = [guildId];
        
        if (commandName) {
            query += " AND command_name = ?";
            params.push(commandName);
        }
        
        query += " ORDER BY command_name, target_type";
        
        const [rows] = await pool.query(query, params);
        debug(`[BD.Permissions] Listando permisos del guild: ${guildId}${commandName ? `, comando: ${commandName}` : ''}`, "Database");
        
        return rows as PermissionEntry[];
    } catch (err) {
        error(`Error listando permisos: ${err}`, "DB.Permissions");
        return [];
    }
}


export async function clearGuildPermissions(guildId: string): Promise<boolean> {
    try {
        const pool = await getPool();
        await pool.query(
            "DELETE FROM command_permissions WHERE guild_id = ?",
            [guildId]
        );
        
        invalidatePermCache(guildId);
        debug(`[BD.Permissions] Limpiando todos los permisos del guild: ${guildId}`, "Database");
        return true;
    } catch (err) {
        error(`Error limpiando permisos: ${err}`, "DB.Permissions");
        return false;
    }
}