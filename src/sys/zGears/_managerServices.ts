// sc/sys/_managerServices.ts
import { Client } from "discord.js";
import { error, info } from "../logging";
import getPool from "../DB-Engine/database";
import { startYoutubeService } from "../../bgProcess/youtubeCheck";
import { startMangadexChecker } from "../../bgProcess/mangadexChek";
import { startRedditChecker } from "../../bgProcess/redditCheck";
import { initFolloX } from "../../bgProcess/followTweet";

export type chkServices = "youtube" | "mangadex" | "reddit" | "twitter";
let serviceYoutube: NodeJS.Timeout | null = null;
let serviceMangadex: NodeJS.Timeout | null = null;
let serviceReddit: NodeJS.Timeout | null = null;
let serviceTwitter: NodeJS.Timeout | null = null;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const bdTimmers = new Map<string, number>();
const minutos = 60 * 1_000;
const envKeys: Record<chkServices, string | undefined> = {
    youtube: process.env.YOUTUBE_CHECK_TIMMER,
    mangadex: process.env.MANGADEX_CHECK_TIMMER,
    reddit: process.env.REDDIT_CHECK_TIMMER,
    twitter: process.env.TWITTER_CHECK_TIMMER,
};

const cleanService = (serv: string) => {
    if (serv === "youtube" && serviceYoutube) { clearInterval(serviceYoutube); serviceYoutube = null; }
    if (serv === "mangadex" && serviceMangadex) { clearInterval(serviceMangadex); serviceMangadex = null; }
    if (serv === "reddit" && serviceReddit) { clearInterval(serviceReddit); serviceReddit = null; }
    if (serv === "twitter" && serviceTwitter) { clearInterval(serviceTwitter); serviceTwitter = null; }
}

const runService = (serv: chkServices, time: number, client: Client) => {
    cleanService(serv);
    if (time === 0) { info(`[_managerServices]: El servicio ${serv} ha sido desactivado`); return };
    const t = time * minutos;
    switch (serv) {
        case "youtube":
            startYoutubeService(client);
            serviceYoutube = setInterval(() => startYoutubeService(client), t);
            info(`[Youtube Checker]: Timer establecido en ${time} minutos.`);
            break;
        case "mangadex":
            startMangadexChecker(client);
            serviceMangadex = setInterval(() => startMangadexChecker(client), t);
            info(`[Mangadex Checker]: Timer establecido en ${time} minutos.`);
            break;
        case "reddit":
            startRedditChecker(client);
            serviceReddit = setInterval(() => startRedditChecker(client), t);
            info(`[Reddit Checker]: Timer establecido en ${time} minutos.`);
            break;
        case "twitter":
            initFolloX(client);
            serviceTwitter = setInterval(() => initFolloX(client), t);
            info(`[Twitter Checker]: Timer establecido en ${time} minutos.`);
            break;
    }
}

export async function startServices(client: Client) {
    try {
        bdTimmers.clear();
        const pool = await getPool();
        const [timmerBD]: any = await pool.query("SELECT service, timmer FROM timmersServices");
        for (const fila of (timmerBD as any[])) { bdTimmers.set(fila.service, fila.timmer); }

        const servicios: chkServices[] = ["youtube", "mangadex", "reddit", "twitter"];
        for (const serv of servicios) {
            const envVal = envKeys[serv];
            const envTimmer = envVal ? parseInt(envVal, 10) : NaN;
            const fTimmer = bdTimmers.get(serv) ?? envTimmer;

            if (!isNaN(fTimmer) && (fTimmer >= 5 || fTimmer === 0)) { bdTimmers.set(serv, fTimmer); }
            else { bdTimmers.set(serv, 15); }

            const mTimmer = bdTimmers.get(serv)!;
            runService(serv, mTimmer, client);
        }
    } catch (e) { error(`[_managerServices]: Ocurrió un error al establecer la secuencia de timers en el arranque: ${e}`) }
}

export async function newTimmerService(serv: string, time: number, client: Client): Promise<string> {
    try {
        const validServices: string[] = ["youtube", "mangadex", "reddit", "twitter"];
        if (!validServices.includes(serv)) { return "❌ ¡No existe un servicio registrado con ese nombre!"; }
        if (time < 5 && time !== 0) { return "⚠️ El timer mínimo configurado debe ser igual o mayor a 10 minutos."; }
        cleanService(serv);
        bdTimmers.set(serv, time);
        runService(serv as chkServices, time, client);
        const pool = await getPool();
        await pool.query(
            "INSERT INTO timmersServices (service, timmer) VALUES (?, ?) ON DUPLICATE KEY UPDATE timmer = VALUES(timmer)",
            [serv, time]
        );
        return `✅ Timer de **${serv}** ${time > 0 ? `actualizado a **${time} minutos** y reiniciado.` : "desactivado por completo."}`;
    } catch (e) {
        error(`[_managerServices]: Ocurrió un error en el comando dinámico de timers: ${e}`);
        return `❌ Ocurrió un error interno al establecer el timer: ${e}`;
    }
}

export async function restartService(srv: chkServices, cli: Client): Promise<string> {
    if (!bdTimmers.has(srv)) return `❌ No existe un timemer establecido para ${srv}`
    cleanService(srv)
    await wait(30_000)
    runService(srv, bdTimmers.get(srv)!, cli)
    return `✅ Se forzo la ejecucion de ${srv}`
}

export async function restore(serv: chkServices, cli: Client): Promise<string> {
    try {
        const pool = await getPool();
        await pool.query("DELETE FROM timmersServices WHERE service = ?", [serv]);

        const envVal = envKeys[serv];
        const envTimmer = envVal ? parseInt(envVal, 10) : NaN;
        const dTime = (!isNaN(envTimmer) && (envTimmer >= 10 || envTimmer === 0)) ? envTimmer : 20;

        bdTimmers.set(serv, dTime);
        runService(serv, dTime, cli);
        return `✅ Timer de **${serv}** restaurado al valor por defecto (${dTime} minutos) y reiniciado.`;
    } catch (e) {
        error(`Ocurrió un error al restaurar el timer: ${e}`, "[Services.Restore]");
        return `❌ Ocurrió un error al restaurar el timer: ${e}`;
    }
}

export function list(): string[] {
    const lista: string[] = []
    for (const [key, value] of bdTimmers) { lista.push(`${key}:` + (value === 0 ? ` desactivado!!` : ` ${value} minutos`)) }
    if (lista.length === 0) return ["Parece que algo anda mal!!"]
    return lista
}