import getPool from '../database';
import { debug, error, info } from '../../logging';

// ========================================================= masterKch ========================================================= //
export const dataKC = new Map<string, Kancolle[]>();
export interface Kancolle {
    guild: string; role: string | null;
    channel: string;
    pvp: { av: boolean; ntf: boolean };
    quest: { av: boolean; ntf: boolean };
    oem: { av: boolean; ntf: boolean };
    mnt: { av: boolean; ntf: boolean };
    mExp: { av: boolean; ntf: boolean };
    rank: { av: boolean; ntf: boolean };
    ver: { av: boolean; ntf: boolean };
}

// ==== masterKch load ==== //
export async function startKC(): Promise<boolean> {
    try {
        const pool = await getPool();
        const [rows]: any = await pool.query("SELECT * FROM kc_conf");
        dataKC.clear();
        for (const db of rows) {
            if (!dataKC.has(db.guild_id)) dataKC.set(db.guild_id, []);
            dataKC.get(db.guild_id)!.push({
                guild: db.guild_id,
                role: db.role,
                channel: db.channel,
                pvp: JSON.parse(db.pvp),
                quest: JSON.parse(db.quest),
                oem: JSON.parse(db.oem),
                mnt: JSON.parse(db.mnt),
                mExp: JSON.parse(db.mExp),
                rank: JSON.parse(db.rank),
                ver: JSON.parse(db.ver)
            });
        }
        const count = dataKC.size;
        if (count > 0) info(`Kancolle configuraciones cargadas: ${count}`, "KancolleBD");
        return true;
    } catch (e) {
        error(`Error al procesar configuración de Kancolle: ${e}`, "KancolleBD");
        return false;
    }
}

// ==== masterKch add ==== //
export async function addBD(guildId: string, kcData: Kancolle) {
    try {
        const pool = await getPool();
        await pool.query(
            `INSERT INTO kc_conf (guild_id, role, channel, pvp, quest, oem, mnt, mExp, rank, ver) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE role = VALUES(role), channel = VALUES(channel), pvp = VALUES(pvp), quest = VALUES(quest), oem = VALUES(oem), mnt = VALUES(mnt), mExp = VALUES(mExp), rank = VALUES(rank), ver = VALUES(ver)`,
            [guildId, kcData.role, kcData.channel, JSON.stringify(kcData.pvp), JSON.stringify(kcData.quest), JSON.stringify(kcData.oem), JSON.stringify(kcData.mnt), JSON.stringify(kcData.mExp), JSON.stringify(kcData.rank), JSON.stringify(kcData.ver)]
        );
        dataKC.set(guildId, [kcData]);
        debug(`Kancolle Config GUARDADA/ACTUALIZADA: Guild ${guildId}`, "KancolleBD");
    } catch (err) {
        error(`Error guardando Kancolle Config: ${err}`, "KancolleBD");
    }
}

// ==== masterKch erase ==== //
export async function delKCBD(guildId: string) {
    try {
        const pool = await getPool();
        await pool.query(`DELETE FROM kc_conf WHERE guild_id = ?`, [guildId]);
        dataKC.delete(guildId);
        debug(`Kancolle Config ELIMINADA para Guild: ${guildId}`, "KancolleBD");
    } catch (err) {
        error(`Error eliminando Kancolle Config: ${err}`, "KancolleBD");
    }
}

// ==== masterKch list ==== //
export async function getKCConfig(guild: string): Promise<Kancolle[]> {
    if (dataKC.has(guild)) return dataKC.get(guild)!;
    return [];
}

// ========================================================= mantKche BD data ========================================================= //
export let maint: KCmant = { lastMaintStart: null, maintNotified: false, lastNotificationTime: null, MaintEnd: null, version: null };
export interface KCmant {
    lastMaintStart: Date | null,
    maintNotified: boolean,
    lastNotificationTime: Date | null,
    MaintEnd: Date | null,
    version: string | null
}

// ==== mantKche upDate ==== //
export async function updateKCmant(upD: KCmant) {
    try {
        const pool = await getPool();
        await pool.query(`INSERT INTO kc_maint (id, lastMaintStart, maintNotified, lastNotificationTime, MaintEnd, version) VALUES (1, ?, ?, ?, ?, ?) 
            ON DUPLICATE KEY UPDATE lastMaintStart = VALUES(lastMaintStart), maintNotified = VALUES(maintNotified), lastNotificationTime = VALUES(lastNotificationTime), MaintEnd = VALUES(MaintEnd), version = VALUES(version)`,
            [upD.lastMaintStart, upD.maintNotified, upD.lastNotificationTime, upD.MaintEnd, upD.version]);

        maint = { lastMaintStart: upD.lastMaintStart, maintNotified: upD.maintNotified, lastNotificationTime: upD.lastNotificationTime, MaintEnd: upD.MaintEnd, version: upD.version };
        debug(`Se actualizo la info del mantenimiento Kancolle`, "KancolleBD");
    } catch (e) {
        error(`Error al añadir nueva info de mantenimiento Kancolle: ${e}`, "KancolleBD");
    }
}

// ==== mantKche load ==== //
export async function kcheMaint() {
    try {
        const pool = await getPool();
        const [rows]: any = await pool.query("SELECT * FROM kc_maint WHERE id = 1");
        if (rows && rows.length > 0) {
            const r = rows[0];
            maint = {
                lastMaintStart: r.lastMaintStart ?? null,
                maintNotified: Boolean(r.maintNotified ?? false),
                lastNotificationTime: r.lastNotificationTime ?? null,
                MaintEnd: r.MaintEnd ?? null,
                version: r.version ?? null,
            }; debug(`Kancolle maintenance kche cargada`, "KancolleBD");
        } else debug(`Kancolle maintenance usando default kche`, "KancolleBD");
        return true
    } catch (e) {
        error(`Fallo la carga de la maintenance kche: ${e}`, "KancolleBD");
        return false
    }
}

// ========================================================= tempBD ========================================================= //
interface kchT {
    guild_id: string;
    id_key: string;
    id_msg: string;
    id_ch: string;
    sup_time: Date;
}

export async function kchTempMSg(upD: kchT) {
    try {
        const pool = await getPool();
        await pool.query(
            `INSERT INTO kc_temp_msg (guild_id, id_key, id_msg, id_ch, sup_time) VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE id_msg = VALUES(id_msg), id_ch = VALUES(id_ch), sup_time = VALUES(sup_time)`,
            [upD.guild_id, upD.id_key, upD.id_msg, upD.id_ch, upD.sup_time]
        );
        debug(`Kancolle Temp Msg GUARDADO/ACTUALIZADO: Key ${upD.id_key} (Guild ${upD.guild_id})`, "KancolleBD");
    } catch (err) {
        error(`Error guardando Kancolle Temp Msg: ${err}`, "KancolleBD");
    }
}

export async function delKchTemp(idkey: string, idguild: string) {
    try {
        const pool = await getPool();
        await pool.query(`DELETE FROM kc_temp_msg WHERE id_key = ? AND guild_id = ?`, [idkey, idguild]);
        debug(`Kancolle Temp ELIMINADA para idkey: ${idkey}`, "KancolleBD");
    } catch (err) {
        error(`Error eliminando Kancolle Temp: ${err}`, "KancolleBD");
    }
}

export async function loadKchMsg(): Promise<kchT[]> {
    try {
        const pool = await getPool();
        const [rows]: any = await pool.query("SELECT guild_id, id_key, id_msg, id_ch, sup_time FROM kc_temp_msg");
        if (rows && rows.length > 0) {
            return rows.map((r: any) => ({
                guild_id: r.guild_id,
                id_key: r.id_key,
                id_msg: r.id_msg,
                id_ch: r.id_ch,
                sup_time: r.sup_time
            }));
        }
        return [];
    } catch (err) {
        error(`Error cargando Kancolle Temp Msg: ${err}`, "KancolleBD");
        return [];
    }
}