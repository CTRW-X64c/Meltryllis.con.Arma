// src/sys/DB-Engine/links/Cronpost.ts
import getPool from "../database";
import { debug, error } from "../../logging.js";
import { detenerTarea } from "../../../bgProcess/exeCron";

export interface CronBDs {
    id: number;
    guild_id: string;
    channel_id: string;
    cron: string;
    mensaje_data: string;
    created_at: Date;
    exec_date: string;
}

// =============== Añadir =============== //

export async function addCronpost(guildId: string, channelId: string, cron: string, mensajeData: string, execDate: string): Promise<number | undefined> {
    try {
        const pool = await getPool();
        const [result]: any = await pool.query(
            "INSERT INTO cronpost_config (guild_id, channel_id, cron, mensaje_data, exec_date) VALUES (?, ?, ?, ?, ?)",
            [guildId, channelId, cron, mensajeData, execDate]
        );
        debug(`[BD.Cronpost] Config guardada en BD y caché invalidada para guild: ${guildId}`, "Database");
        return result.insertId;
    } catch (e) {
        error(`[BD.Cronpost] Error al guardar configuración: ${e}`)
        return undefined;
    }
}

// =============== Listar =============== //

export async function getCronpost(guildId: string): Promise<CronBDs[]> {
    try {
        const pool = await getPool();
        const [rows] = await pool.query(
            "SELECT id, guild_id, channel_id, cron, mensaje_data, exec_date, created_at FROM cronpost_config WHERE guild_id = ?",
            [guildId]
        );
        return rows as CronBDs[];
    } catch (e) {
        error(`BD.Cronpost] Error al obtener configuración: ${e}`);
        return [];
    }
}

// =============== Remover =============== //

export async function removeCronpost(guildId: string, id: number): Promise<boolean> {
    try {
        const pool = await getPool();
        const [result]: any = await pool.query(
            "DELETE FROM cronpost_config WHERE guild_id = ? AND id = ?",
            [guildId, id]
        );
        debug(`[BD.Cronpost] Mensaje borrado de BD y caché invalidado para guild: ${guildId}`, "Database");
        return result.affectedRows > 0;
    } catch (e) {
        error(`[BD.Cronpost] Error al borrar mensaje: ${e}`)
        return false;
    }
}

// =============== PURGA BD Y PROCESOS =============== //

export async function deleteAllCronPosts(guildId: string): Promise<number> {
    try {
        const pool = await getPool();
        const [rows]: any = await pool.query(
            "SELECT id FROM cronpost_config WHERE guild_id = ?",
            [guildId]
        );

        const ids = rows.map((row: any) => row.id);
        if (ids.length === 0) {
            debug(`No hay tareas para limpiar en ${guildId}`, "Database");
            return 0;
        }

        ids.forEach((id: number) => detenerTarea(id));
        await pool.query("DELETE FROM cronpost_config WHERE guild_id = ?",
            [guildId]
        );
        debug(`[BD.Cronpost] Eliminadas ${ids.length} tareas de ${guildId}`, "Database");
        return ids.length;
    } catch (err) {
        error(`[BD.Cronpost] Error en limpieza masiva de cron para ${guildId}: ${err}`, "Database");
        throw err;
    }
}

// =============== Preview Msg =============== //

export async function getMSGPreview(guildId: string, id: number): Promise<CronBDs | null> {
    try {
        const pool = await getPool();
        const [rows]: any = await pool.query(
            "SELECT id, guild_id, channel_id, cron, mensaje_data, exec_date, created_at FROM cronpost_config WHERE guild_id = ? AND id = ?",
            [guildId, id]
        );
        return rows.length > 0 ? rows[0] as CronBDs : null;
    } catch (e) {
        error(`[BD.Cronpost] Error al obtener tarea única: ${e}`);
        return null;
    }
}