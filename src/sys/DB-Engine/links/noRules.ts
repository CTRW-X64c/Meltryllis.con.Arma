import { debug, error } from "../../logging";
import getPool from "../database";

export interface GuildLimits {
    guildId: string;
    cronLimited: number;
    chkDomain: boolean;
    noWaitNode: boolean;
    dexMax: number;
    redMax: number;
    ytMax: number;
    tweetMax: number;
    pixiMax: number;
}

const dLimites: Omit<GuildLimits, 'guildId'> = { cronLimited: 5, chkDomain: false, noWaitNode: false, dexMax: 10, redMax: 10, ytMax: 10, tweetMax: 10, pixiMax: 10 };
const cacheRules = new Map<string, GuildLimits>();

export async function getGuildLimits(guildId: string): Promise<GuildLimits> {
    if (cacheRules.has(guildId)) {
        debug(`[Limits] Cache hit para ${guildId}`, "Database");
        return cacheRules.get(guildId)!;
    }

    try {
        const pool = await getPool();
        const [rows] = await pool.query(
            `SELECT guild_id, cron_limited, chk_domain, no_wait_node, dex_max, red_max, yt_max, tweet_max, pixi_max FROM guild_limits WHERE guild_id = ?`,
            [guildId]
        );

        const row = (rows as any[])[0];
        let limits: GuildLimits;

        if (row) {
            limits = { guildId: row.guild_id, cronLimited: row.cron_limited, chkDomain: Boolean(row.chk_domain), noWaitNode: Boolean(row.no_wait_node), dexMax: row.dex_max, redMax: row.red_max, ytMax: row.yt_max, tweetMax: row.tweet_max, pixiMax: row.pixi_max };
            debug(`[Limits] Cargado desde BD para ${guildId}`, "Database");
        } else {
            limits = { guildId, ...dLimites };
            debug(`[Limits] Usando defaults para ${guildId}`, "Database");
        }
        cacheRules.set(guildId, limits);
        return limits;

    } catch (e) {
        error(`[Limits] Error al obtener límites para ${guildId}: ${e}`);
        return { guildId, ...dLimites };
    }
}

export async function setGuildLimits(guildId: string, updates: Partial<Omit<GuildLimits, 'guildId'>>): Promise<GuildLimits> {
    try {
        const current = await getGuildLimits(guildId);
        const updated: GuildLimits = { ...current, ...updates };

        const pool = await getPool();
        await pool.query(
            `INSERT INTO guild_limits (guild_id, cron_limited, chk_domain, no_wait_node, dex_max, red_max, yt_max, tweet_max, pixi_max) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE cron_limited = VALUES(cron_limited), chk_domain = VALUES(chk_domain), no_wait_node = VALUES(no_wait_node), dex_max = VALUES(dex_max), red_max = VALUES(red_max), yt_max = VALUES(yt_max), tweet_max = VALUES(tweet_max), pixi_max = VALUES(pixi_max)`,
            [updated.guildId, updated.cronLimited, updated.chkDomain ? 1 : 0, updated.noWaitNode ? 1 : 0, updated.dexMax ?? updated.dexMax, updated.redMax ?? updated.redMax, updated.ytMax ?? updated.ytMax, updated.tweetMax ?? updated.tweetMax, updated.pixiMax ?? updated.pixiMax]
        );
        cacheRules.set(guildId, updated);
        debug(`[Limits] Guardados límites para ${guildId}`, "Database");
        return updated;

    } catch (e) {
        error(`[Limits] Error al guardar límites para ${guildId}: ${e}`);
        throw e;
    }
}

export async function resetGuildLimits(guildId: string): Promise<GuildLimits> {
    debug(`[Limits] Reiniciando límites para ${guildId}`, "Database");
    return setGuildLimits(guildId, dLimites);
}

export async function removeGuildLimits(guildId: string): Promise<void> {
    try {
        const pool = await getPool();
        await pool.query(
            `DELETE FROM guild_limits WHERE guild_id = ?`,
            [guildId]
        );
        cacheRules.delete(guildId);
        debug(`[Limits] Cahce y BD eliminados para ${guildId}`, "Database");
    } catch (e) {
        error(`[Limits] Error al eliminar límites para ${guildId}: ${e} `);
        throw e;
    }
}
