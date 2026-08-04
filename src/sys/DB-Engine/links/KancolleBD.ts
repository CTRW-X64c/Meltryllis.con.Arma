import getPool from '../database';
import { debug, error, info } from '../../logging';

// ========================================================= kChe Loader ========================================================= //
// ==== regularKche ==== //
export const data = new Map<string, Kancolle[]>();
export interface Kancolle {
    guild: string; role: string | null;
    channel: string;
    pvp: { av: boolean; ntf: boolean };
    quest: { av: boolean; ntf: boolean };
    oem: { av: boolean; ntf: boolean };
    mnt: { av: boolean; ntf: boolean };
    mExp: { av: boolean; ntf: boolean };
}

export async function startKC(): Promise<boolean> {
    try {
        const pool = await getPool();
        const [rows]: any = await pool.query("SELECT * FROM kc_conf");

        data.clear();
        for (const db of rows) {
            if (!data.has(db.guild_id)) data.set(db.guild_id, []);
            data.get(db.guild_id)!.push({
                guild: db.guild_id, role: db.role, channel: db.channel, pvp: JSON.parse(db.pvp), quest: JSON.parse(db.quest), oem: JSON.parse(db.oem), mnt: JSON.parse(db.mnt), mExp: JSON.parse(db.mExp)
            });
        }
        const count = data.size;
        if (count > 0) info(`Kancolle configuraciones cargadas: ${count}`, "KancolleBD");
        return true;
    } catch (e) {
        error(`Error al procesar configuración de Kancolle: ${e}`, "KancolleBD");
        return false;
    }
}

// ==== mantKche ==== //
export let maint: KCmant = { lastMaintStart: null, maintNotified: false, lastNotificationTime: null, MaintEnd: null };
export interface KCmant { lastMaintStart: Date | null, maintNotified: boolean, lastNotificationTime: Date | null, MaintEnd: Date | null, }
export async function kcheMaint() {
    try {
        const pool = await getPool();
        const [rows]: any = await pool.query("SELECT * FROM kc_maint WHERE id = 1");
        if (rows && rows.length > 0) {
            const r = rows[0];
            maint = { lastMaintStart: r.lastMaintStart || r.last_maint_start || null, maintNotified: r.maintNotified ?? r.maint_notified ?? false, lastNotificationTime: r.lastNotificationTime || r.last_notification_time || null, MaintEnd: r.MaintEnd || r.MaintEnd || null };
            debug(`Kancolle maintenance kche cargada`, "KancolleBD");
        } else debug(`Kancolle maintenance usando default kche`, "KancolleBD");
        return true
    } catch (e) {
        error(`Fallo la carga de la maintenance kche: ${e}`, "KancolleBD");
        return false
    }
}

// ========================================================= Melt <=> BD ========================================================= //
export async function addBD(guildId: string, kcData: Kancolle) {
    try {
        const pool = await getPool();
        await pool.query(
            `INSERT INTO kc_conf (guild_id, role, channel, pvp, quest, oem, mnt, mExp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE role = VALUES(role), channel = VALUES(channel), pvp = VALUES(pvp), quest = VALUES(quest), oem = VALUES(oem), mnt = VALUES(mnt), mExp = VALUES(mExp)`,
            [guildId, kcData.role, kcData.channel, JSON.stringify(kcData.pvp), JSON.stringify(kcData.quest), JSON.stringify(kcData.oem), JSON.stringify(kcData.mnt), JSON.stringify(kcData.mExp)]
        );
        data.set(guildId, [kcData]);
        debug(`Kancolle Config GUARDADA/ACTUALIZADA: Guild ${guildId}`, "KancolleBD");
    } catch (err) {
        error(`Error guardando Kancolle Config: ${err}`, "KancolleBD");
    }
}

export async function delBD(guildId: string) {
    try {
        const pool = await getPool();
        await pool.query(`DELETE FROM kc_conf WHERE guild_id = ?`, [guildId]);
        data.delete(guildId);
        debug(`Kancolle Config ELIMINADA para Guild: ${guildId}`, "KancolleBD");
    } catch (err) {
        error(`Error eliminando Kancolle Config: ${err}`, "KancolleBD");
    }
}

export async function getKCConfig(guild: string): Promise<Kancolle[]> {
    if (data.has(guild)) return data.get(guild)!;
    return [];
}

// ========================================================= Cheker BD ========================================================= //
export async function updateKCmant(upD: KCmant) {
    try {
        const pool = await getPool();
        await pool.query(`INSERT INTO kc_maint (id, lastMaintStart, maintNotified, lastNotificationTime, MaintEnd) VALUES (1, ?, ?, ?, ?) 
            ON DUPLICATE KEY UPDATE lastMaintStart = VALUES(lastMaintStart), maintNotified = VALUES(maintNotified), lastNotificationTime = VALUES(lastNotificationTime), MaintEnd = VALUES(MaintEnd)`,
            [upD.lastMaintStart, upD.maintNotified, upD.lastNotificationTime, upD.MaintEnd]);

        maint = { lastMaintStart: upD.lastMaintStart, maintNotified: upD.maintNotified, lastNotificationTime: upD.lastNotificationTime, MaintEnd: upD.MaintEnd };
        debug(`Se actualizo la info del mantenimiento Kancolle`, "KancolleBD");
    } catch (e) {
        error(`Error al añadir nueva info de mantenimiento Kancolle: ${e}`, "KancolleBD");
    }
}