import { error } from "../../logging";
import getPool from "../database";

interface bsky {
    id: number,
    guild_id: string,
    chanel: string,
    bskyUserId: string,
    bskyUserName: string,
    lastPost: string | null,
    addby: string,
    modo: boolean,
    lang: string | null,
    created_at: Date,
}


export async function getAllBlueskya(): Promise<bsky[] | null> {
    try {
        const pool = await getPool();
        const [rows] = await pool.query("SELECT id, guild_id, chanel, bskyUserId, bskyUserName, lastPost, addby, modo, lang, created_at FROM blueskya");
        return rows as bsky[];
    } catch (e: any) {
        error(`Falló la recuperación de datos de blueskya: ${e.message}`, "DB.blueskya");
        return null;
    }
}

interface delInt { gremio: string, id?: number, userId?: string }
export async function deleteBskyFollow(dta: delInt) {
    if (!dta.id && !dta.userId) return;
    const pool = await getPool();
    try {
        if (dta.id) await pool.query("DELETE FROM blueskya WHERE guild_id = ? AND id = ?", [dta.gremio, dta.id]);
        else { await pool.query("DELETE FROM blueskya WHERE guild_id = ? AND bskyUserId = ?", [dta.gremio, dta.userId]); }
        return true
    } catch (e: any) { error(`Error al eliminar el seguimiento de blueskya: ${e.message}`, "DB.blueskya"); return false }
}

interface updatePost { guild_id: string, user_id: string, post_id: string }
export async function updateBskyLastPost(dta: updatePost) {
    const pool = await getPool();
    try {
        await pool.query("UPDATE blueskya SET lastPost = ? WHERE guild_id = ? AND bskyUserId = ?", [dta.post_id, dta.guild_id, dta.user_id]);
    } catch (e: any) { error(`Error al actualizar el último post de blueskya: ${e.message}`, "DB.blueskya") }
}

// ============================================ commandas ============================================ //

export async function addFollowBSky(dta: Omit<bsky, "id" | "created_at" | "lastPost">) {
    const pool = await getPool();
    try {
        await pool.query(`INSERT INTO blueskya (guild_id, chanel, bskyUserId, bskyUserName, addby, modo, lang) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE chanel = ?, lang = ?, modo = ?`,
            [dta.guild_id, dta.chanel, dta.bskyUserId, dta.bskyUserName, dta.addby, dta.modo, dta.lang, dta.chanel, dta.lang, dta.modo]);
        return true
    } catch (e: any) { error(`Error al añadir el seguimiento de blueskya: ${e.message}`, "DB.blueskya"); return false }

}

export async function getGuildBSky(guild: string) {
    const pool = await getPool();
    try {
        const [rows] = await pool.query("SELECT id, guild_id, chanel, bskyUserId, bskyUserName, lastPost, addby, modo, lang, created_at FROM blueskya WHERE guild_id = ?", [guild]);
        return rows as bsky[];
    } catch (e: any) {
        error(`Falló la recuperación de datos de blueskya: ${e.message}`, "DB.blueskya");
        return null;
    }
}