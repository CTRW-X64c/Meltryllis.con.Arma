import { error } from "../../logging";
import getPool from "../database";

// Mejorado: PascalCase para la interfaz
interface FollowTweetX {
    id: number;
    guild_id: string;
    canal: string;
    xUser: string;
    lastPost: string | null;
    lang: string | null;
    Domain: string | null;
    addBy: string;
    created_at: Date;
}

/// ============================ BD4Sys ============================ ///
export async function getAllFollowTweet(): Promise<FollowTweetX[] | null> {
    try {
        const pool = await getPool();
        const [rows] = await pool.query("SELECT id, guild_id, canal, xUser, lastPost, lang, customDomain, addBy, created_at FROM followTweetX");
        return rows as FollowTweetX[];
    } catch (e) {
        error(`Falló la recuperación de datos de followTweet: ${e}`);
        return null;
    }
}

export async function updateFollowTweet(gremio: string, canal: string, xUser: string, lastPost: string): Promise<boolean> {
    try {
        const pool = await getPool();
        await pool.query(`UPDATE followTweetX SET lastPost = ? WHERE guild_id = ? AND canal = ? AND xUser = ?`, [lastPost, gremio, canal, xUser]);
        return true;
    } catch (e) {
        error(`Falló la actualización de datos de followTweet: ${e}`);
        return false;
    }
}

export async function deleteFollowTweetByGuild(guild: string): Promise<boolean> {
    try {
        const pool = await getPool();
        await pool.query(`DELETE FROM followTweetX WHERE guild_id = ?`, [guild]);
        return true;
    } catch (e) {
        error(`Falló la eliminación de datos de followTweet (Guild): ${e}`);
        return false;
    }
}

/// ============================ BD4Comands ============================ ///

export async function addFollowTweet(dta: FollowTweetX): Promise<{ success: boolean; message: string }> {
    try {
        const pool = await getPool();
        await pool.query("INSERT INTO followTweetX (guild_id, canal, xUser, lang, customDomain, addBy) VALUES (?, ?, ?, ?, ?, ?)", [dta.guild_id, dta.canal, dta.xUser, dta.lang, dta.Domain, dta.addBy]);
        return { success: true, message: "Se añadio correctamente!!" };
    } catch (e: any) {
        if (e.code === 'ER_DUP_ENTRY') { return { success: false, message: "Este usuario ya está siendo seguido en el servidor." }; }
        error(`Falló la adición de datos de followTweet: ${e}`);
        return { success: false, message: "Algo salio mal!!" };
    }
}

export async function followTweetonGuild(gremio: string): Promise<FollowTweetX[] | null> {
    try {
        const pool = await getPool();
        const [rows] = await pool.query("SELECT id, guild_id, canal, xUser, lastPost, lang, customDomain, addBy, created_at FROM followTweetX WHERE guild_id = ?", [gremio]);
        return rows as FollowTweetX[];
    } catch (e) {
        error(`Falló la recuperación de datos de followTweet en guild: ${e}`);
        return null;
    }
}

export async function deleteFollowTweet(gremio: string, id: number): Promise<boolean> {
    try {
        const pool = await getPool();
        await pool.query(`DELETE FROM followTweetX WHERE guild_id = ? AND id = ?`, [gremio, id]);
        return true;
    } catch (e) {
        error(`Falló la eliminación de datos de followTweet (ID): ${e}`);
        return false;
    }
}