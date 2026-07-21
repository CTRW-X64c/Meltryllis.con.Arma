import getPool from '../database';
import { debug, error, info } from '../../logging';

export const maint = new Map<string, KCmant>();
export const data = new Map<string, Kancolle[]>();

export interface Kancolle {
    guild: string;
    role: string | null;
    channel: string;
    pvp: boolean;
    quest: boolean;
    oem: boolean;
}
export interface KCmant {
    lastMaintStart: Date | null,
    maintNotified: boolean,
    lastNotificationTime: Date | null
}

// ========================================================= kChe Loader ========================================================= //
export async function startKC(): Promise<boolean> {
    try {
        const pool = await getPool();
        const [rows]: any = await pool.query("SELECT * FROM kc_conf");

        data.clear();
        for (const dbRow of rows) {
            if (!data.has(dbRow.guild_id)) data.set(dbRow.guild_id, []);
            data.get(dbRow.guild_id)!.push({
                guild: dbRow.guild_id,
                role: dbRow.role,
                channel: dbRow.channel,
                pvp: dbRow.pvp,
                quest: dbRow.quest,
                oem: dbRow.oem
            });
        }
        const count = data.size;
        if (count > 0) info(`Kancolle configuraciones cargadas: ${count}`, "database");
        if (data.size > 0) return true;
        else return false;
    } catch (e) {
        error(`Error al procesar configuración de Kancolle: ${e}`, "database");
        return false;
    }
}

export async function kcheMaint() {
    const pool = await getPool();
    const [rows]: any = await pool.query("SELECT * FROM kc_maint");
    maint.clear()
    if (rows && rows.length > 0) {
        rows.forEach((r: any) => {
            maint.set('kcMaint', { lastMaintStart: r.last_maint_start, maintNotified: r.maint_notified, lastNotificationTime: r.last_notification_time })
        });
        debug(`Kancolle maintenance kche cargada`, "database");
    } else {
        maint.set('kcMaint', { lastMaintStart: null, maintNotified: false, lastNotificationTime: null, })
        debug(`Kancolle maintenance usando default kche`)
    }
}

// ========================================================= Melt <=> BD ========================================================= //
export async function addBD(guildId: string, kcData: Kancolle) {
    try {
        const pool = await getPool();
        await pool.query(
            `INSERT INTO kc_conf (guild_id, role, channel, pvp, quest, oem) VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE role = VALUES(role), channel = VALUES(channel), pvp = VALUES(pvp), quest = VALUES(quest), oem = VALUES(oem)`,
            [guildId, kcData.role, kcData.channel, kcData.pvp, kcData.quest, kcData.oem]
        );

        data.set(guildId, [kcData]);
        debug(`Kancolle Config GUARDADA/ACTUALIZADA: Guild ${guildId}`);
    } catch (err) {
        error(`Error guardando Kancolle Config: ${err}`);
    }
}

export async function delBD(guildId: string) {
    try {
        const pool = await getPool();
        await pool.query(`DELETE FROM kc_conf WHERE guild_id = ?`, [guildId]);
        data.delete(guildId);

        debug(`Kancolle Config ELIMINADA para Guild: ${guildId}`);
    } catch (err) {
        error(`Error eliminando Kancolle Config: ${err}`);
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
        await pool.query(`INSERT INTO kc_mant (lastMaintStart, maintNotified, lastNotificationTime) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE lastMaintStart = VALUES(lastMaintStart), maintNotified = VALUES(maintNotified), lastNotificationTime = VALUES(lastNotificationTime)`, [upD.lastMaintStart, upD.maintNotified, upD.lastNotificationTime]);
        maint.set('kcMaint', { lastMaintStart: upD.lastMaintStart, maintNotified: upD.maintNotified, lastNotificationTime: upD.lastNotificationTime });
        debug(`Se actualizo la info del mantenimiento Kancolle`, "KancolleBD");
    } catch (e) { error(`Error al añadir nueva info de mantenimiento Kancolle: ${e}`, "KancolleBD") }
}

