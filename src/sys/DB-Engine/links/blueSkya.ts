import { error } from "../../logging";
import getPool from "../database";

interface bsky {
    id: number,
    guild_id: string,
    chanel: string,
    bskyUserId: string,
    bskyUserName: string,
    lastPost: string,
    addby: string,
    modo: string,
    lang: string,
    created_at: Date,
}


export async function getAllBlueskya(): Promise<bsky[] | null> {
    try {
        const pool = await getPool();
        const [rows] = await pool.query("SELECT id, guild_id, chanel, bskyUserId, bskyUserName, lastPost, addby, modo, lang, created_at FROM blueskya");
        return rows as bsky[];
    } catch (e) {
        error(`Falló la recuperación de datos de blueskya: ${e}`);
        return null;
    }
}