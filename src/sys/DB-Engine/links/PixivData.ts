import { error } from "../../logging";
import getPool from "../database";

interface PixiData {
    id: number,
    guild_id: string,
    chGuild: string,
    pixiUser: string,
    pixiUserName: string,
    illustOn: boolean,
    lstPostIllust: string | null,
    mangaOn: boolean,
    lstPostManga: string | null,
    novelOn: boolean,
    lstPostNovel: string | null,
    addby: string,
    created_at: Date;
}

export async function getAllPixis(): Promise<PixiData[]> {
    const pool = await getPool()
    try {
        const [rows] = await pool.query("SELECT * FROM pixivdata")
        return rows as PixiData[]
    } catch (e: any) {
        error(e.message)
        return []
    }
}

interface delFoll { gldPi: string, idPi?: number, usrPi?: string }
export async function deletePixi(dta: delFoll) {
    if (!dta.idPi && !dta.usrPi) return false;
    const pool = await getPool();
    try {
        if (dta.idPi) { await pool.query("DELETE FROM pixivdata WHERE guild_id = ? AND id = ?", [dta.gldPi, dta.idPi]); }
        else if (dta.usrPi) { await pool.query("DELETE FROM pixivdata WHERE guild_id = ? AND pixiUser = ?", [dta.gldPi, dta.usrPi]); }
        return true;
    } catch (e: any) {
        error(e.message);
        return false;
    }
}

export async function updatePixi(guild: string, pixiUser: string, lstPostIllust: string, lstPostManga: string, lstPostNovel: string) {
    const pool = await getPool()
    try {
        await pool.query("UPDATE pixivdata SET lstPostIllust = ?, lstPostManga = ?, lstPostNovel = ? WHERE guild_id = ? AND pixiUser = ?", [lstPostIllust, lstPostManga, lstPostNovel, guild, pixiUser])
        return true
    } catch (e: any) {
        error(e.message)
        return false
    }
}

// ============================= commands ============================= //
export async function addPixiFollow(dta: Omit<PixiData, "id" | "created_at" | "lstPostIllust" | "lstPostManga" | "lstPostNovel">) {
    const pool = await getPool()
    try {
        await pool.query(`
            INSERT INTO pixivdata (guild_id, chGuild, pixiUser, pixiUserName, illustOn, mangaOn, novelOn, addby) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE chGuild = ?, illustOn = ?, mangaOn = ?, novelOn = ?`,
            [dta.guild_id, dta.chGuild, dta.pixiUser, dta.pixiUserName, dta.illustOn, dta.mangaOn, dta.novelOn, dta.addby, dta.chGuild, dta.illustOn, dta.mangaOn, dta.novelOn]);
        return true
    } catch (e: any) {
        error(e.message)
        return false
    }
}

export async function guildPixiFollow(guild: string): Promise<PixiData[]> {
    const pool = await getPool()
    try {
        const [rows] = await pool.query("SELECT id, guild_id, chGuild, pixiUser, pixiUserName, illustOn, lstPostIllust, mangaOn, lstPostManga, novelOn, lstPostNovel, addby, created_at FROM pixivdata WHERE guild_id = ?", [guild])
        return rows as PixiData[]
    } catch (e: any) {
        error(e.message)
        return []
    }
}

