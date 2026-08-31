import { debug, error } from "../../logging";
import getPool from "../database";

interface FollowTweetX {
    id: number;
    guild_id: string;
    canal: string;
    xUser: string;
    lastPost: string | null;
    lang: string | null;
    Domain: string | null;
    addBy: string;
    onlyMedia: boolean;
    created_at: Date;
}

/// ============================ BD4Sys ============================ ///
export async function getAllFollowTweet(): Promise<FollowTweetX[] | null> {
    try {
        const pool = await getPool();
        const [rows] = await pool.query("SELECT id, guild_id, canal, xUser, lastPost, lang, Domain, addBy, onlyMedia, created_at FROM followTweetX");
        return rows as FollowTweetX[];
    } catch (e) {
        error(`Falló la recuperación de datos de followTweet: ${e}`);
        return null;
    }
}

export async function updateFollowTweet(gremio: string, canal: string, xUser: string, lastPost: string): Promise<boolean> {
    try {
        const pool = await getPool();
        await pool.query(`UPDATE followTweetX SET lastPost = ? WHERE guild_id = ? AND canal = ? AND xUser = ?`,
            [lastPost, gremio, canal, xUser]);
        return true;
    } catch (e) {
        error(`Falló la actualización de datos de followTweet: ${e}`);
        return false;
    }
}

export async function deleteFollowTweetByGuild(guild: string): Promise<void> {
    try {
        const pool = await getPool();
        await pool.query(`DELETE FROM followTweetX WHERE guild_id = ?`, [guild]);
    } catch (e) {
        error(`Falló la eliminación de datos de followTweet (Guild): ${e}`);
    }
}

/// ============================ BD4Comands ============================ ///
export async function addFollowTweet(dta: Omit<FollowTweetX, 'id' | 'created_at'>): Promise<boolean> {
    try {
        const pool = await getPool();
        await pool.query(`
            INSERT INTO followTweetX (guild_id, canal, xUser, lang, Domain, addBy, onlyMedia) VALUES (?, ?, ?, ?, ?, ?, ?) 
            ON DUPLICATE KEY UPDATE canal = ?, lang = ?, Domain = ?, onlyMedia = ?`,
            [dta.guild_id, dta.canal, dta.xUser, dta.lang, dta.Domain, dta.addBy, dta.onlyMedia,
            dta.canal, dta.lang, dta.Domain, dta.onlyMedia]);
        return true;
    } catch (e) {
        error(`Falló la operación en followTweet: ${e}`);
        return false;
    }
}

export async function checFollowUser(gremio: string, user: string): Promise<FollowTweetX[] | null> {
    try {
        const pool = await getPool();
        const [rows] = await pool.query("SELECT id, guild_id, canal, xUser, lastPost, lang, Domain, addBy, onlyMedia, created_at FROM followTweetX WHERE guild_id = ? AND xUser = ?",
            [gremio, user]);
        return rows as FollowTweetX[];
    } catch (e) {
        error(`Falló la recuperación de datos de followTweet en guild: ${e} `);
        return null;
    }
}

export async function followTweetonGuild(gremio: string): Promise<FollowTweetX[] | undefined> {
    debug(`Cache MISS para guild: ${gremio} `, "Database");
    try {
        const pool = await getPool();
        const [rows] = await pool.query("SELECT id, guild_id, canal, xUser, lastPost, lang, Domain, addBy, onlyMedia, created_at FROM followTweetX WHERE guild_id = ?",
            [gremio]);
        return rows as FollowTweetX[];
    } catch (e) {
        error(`Falló la recuperación de datos de followTweet en guild: ${e} `);
        return undefined;
    }
}

interface deleteFollowInt { gremio: string, id?: number, xUser?: string }
export async function deleteFollowTweet(dta: deleteFollowInt): Promise<boolean> {
    try {
        const { gremio, id, xUser } = dta;
        if (!id && !xUser) return false;
        const pool = await getPool();
        if (id) await pool.query(`DELETE FROM followTweetX WHERE guild_id = ? AND id = ? `, [gremio, id]);
        else await pool.query(`DELETE FROM followTweetX WHERE guild_id = ? AND xUser = ? `, [gremio, xUser]);
        return true;
    } catch (e) {
        error(`Falló la eliminación de datos de followTweet(ID): ${e} `);
        return false;
    }
}
