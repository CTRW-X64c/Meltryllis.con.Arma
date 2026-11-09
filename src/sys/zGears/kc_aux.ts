// src/sys/zGears/kc_aux.ts
import i18next from "i18next";
import { notifyKC, notifyType } from "../../bgProcess/KanCron";
import { maint, updateKCmant } from "../DB-Engine/links/KancolleBD";
import { debug, error } from "../logging";
import { translate } from "@vitalets/google-translate-api";
import * as cheerio from 'cheerio';
import emj from '../../../adds/otros/emojis.json'

// ========================================================= fetchMaint ========================================================= //
let kcTimmers = new Map<string, NodeJS.Timeout>();
let ntfMantData: ntfMant = { MaintDate: null, endMantDate: null, url: null, tweetInfo: null };
const idStart = `mntStar`, idStarPre = 'mntStar24h', idEnd = `mntEnd`;
const minuts = 60 * 1_000;

interface TweetInfoTl { Orginal: string; isoES: string; isoEN: string }
interface ntfMant { MaintDate: Date | null, endMantDate: Date | null, url: string | null, tweetInfo: TweetInfoTl | null };
interface dataGit { MaintInfoLink: string, mntStar: string, MaintEnd?: string }

export async function mantChk() {
    const fData = await fetchData("https://raw.githubusercontent.com/ElectronicObserverEN/Data/refs/heads/master/update.json")
    if (!fData) return;

    const processData = await fData.json() as dataGit;
    const newMaintStartStr = processData.mntStar ?? null;
    if (!newMaintStartStr) return;
    const newMaintEndStr = processData.MaintEnd ?? null;
    //startManteTimes
    const newMaintDate = new Date(newMaintStartStr);
    const lastMantTime = maint?.lastMaintStart ? maint.lastMaintStart.getTime() : null;
    const newMantTime = newMaintDate.getTime();
    // endManteTimes
    const endMantDate = newMaintEndStr ? new Date(newMaintEndStr) : null;
    const lastEndTime = maint?.MaintEnd ? maint.MaintEnd.getTime() : null;
    const endMantTime = endMantDate ? endMantDate.getTime() : null;

    if (lastMantTime !== newMantTime) {
        maint.lastMaintStart = newMaintDate;
        maint.MaintEnd = endMantDate;
        maint.maintNotified = false;
        await updateKCmant({ lastMaintStart: newMaintDate, maintNotified: false, lastNotificationTime: null, MaintEnd: endMantDate });
    }

    if ((lastEndTime && endMantTime) && lastEndTime !== endMantTime) {
        if (kcTimmers.has(idEnd)) kcTimmers.delete(idEnd)
        maint.MaintEnd = endMantDate;
        await updateKCmant({ lastMaintStart: maint.lastMaintStart, maintNotified: maint.maintNotified, lastNotificationTime: maint.lastNotificationTime, MaintEnd: endMantDate });
    }

    if (maint.maintNotified === false) {
        if (newMantTime < Date.now()) {
            debug(`🔧 Mantenimiento pasado detectado en BD. Marcando como notificado silenciosamente.`, "KancolleBD");
            maint.maintNotified = true;
            await updateKCmant({ lastMaintStart: newMaintDate, maintNotified: true, lastNotificationTime: null, MaintEnd: endMantDate });
            return;
        }

        const datTwet = await tweetKC.geTwiitter(processData.MaintInfoLink)
        debug(`🔧 Anunciando nuevo mantenimiento a los servidores: ${newMaintStartStr}`, "KancolleBD");
        ntfMantData = { MaintDate: newMaintDate, endMantDate: endMantDate, url: processData.MaintInfoLink, tweetInfo: datTwet };
        notifyKC("mntAviso")
        maint.maintNotified = true;
        await updateKCmant({ lastMaintStart: newMaintDate, maintNotified: true, lastNotificationTime: new Date(), MaintEnd: endMantDate });
    }
    if (!kcTimmers.has(idStart) || !kcTimmers.has(idEnd)) startMant();
}

class tweetKC {
    private static get headers() { return { method: 'GET' }; }

    public static async geTwiitter(tweet: string): Promise<TweetInfoTl> {
        let traslates = { Orginal: "Error al obtener el Tweet 😩", isoES: "Traduccion no disponible", isoEN: "Translation not available" };
        try {
            const match = tweet.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/i);
            if (!match) return traslates;
            const xId = match[1];

            const call = await fetch(`https://api.fxtwitter.com/2/status/${xId}`, { headers: this.headers });
            if (!call.ok) return traslates;

            interface xTweet { code: number, status?: { text?: string } }
            const Data = await call.json() as xTweet;
            const orgTxT = Data.status?.text;
            if (!Data || Data.code !== 200 || !orgTxT) return traslates;
            traslates.Orginal = orgTxT.length > 1015 ? orgTxT.slice(0, 1015) + "..." : orgTxT;

            const tlList = ["es", "en"];
            for (const lang of tlList) {
                try {
                    const callGoogle = await this.googleTranslate(orgTxT, lang);
                    if (callGoogle) {
                        if (lang == "es") traslates.isoES = callGoogle.length > 1015 ? callGoogle.slice(0, 1015) + `...` : callGoogle;
                        else traslates.isoEN = callGoogle.length > 1015 ? callGoogle.slice(0, 1015) + `...` : callGoogle;
                    }
                    await new Promise(X => setTimeout(X, 2_000)); // una pausa de hidratacion "emoji de wea guiñando"
                } catch (e) { error(`Error obteniendo tweet: ${e}`, "KanCron"); }
            }

            return traslates;
        } catch (e) { error(`Error obteniendo tweet: ${e}`, "KanCron"); return traslates }
    }

    private static async googleTranslate(text: string, lang: string): Promise<string | null> {
        try {
            const { text: out } = await translate(text, { to: lang });
            return out;
        } catch { return null; }
    }
}

// ===== notifyMaint ===== //
async function startMant() {
    try {
        if (!maint.lastMaintStart) return;
        const now = getNowJST(), INItime = JSTtoUTC(maint.lastMaintStart);
        if (!INItime) return;
        const mntStar = INItime.getTime();
        const leftStart = mntStar - now;
        const HORA = 60 * minuts;

        if (leftStart > 0 && leftStart < (12 * HORA)) {
            if (leftStart > HORA && !kcTimmers.has(idStart)) {
                const timer1h = setTimeout(() => {
                    notifyKC(idStart);
                    kcTimmers.delete(idStart);
                }, leftStart - HORA);
                kcTimmers.set(idStart, timer1h);
            }
        }

        if (leftStart > 0 && leftStart < (24 * HORA)) { // pre Start24h
            if (leftStart > 24 * HORA && !kcTimmers.has(idStarPre)) {
                const timer24hS = setTimeout(() => {
                    notifyKC(idStarPre);
                    kcTimmers.delete(idStarPre);
                }, leftStart - (24 * HORA));
                kcTimmers.set(idStarPre, timer24hS);
            }
        }

        if (maint.MaintEnd && !kcTimmers.has(idEnd)) {
            const ENDtime = JSTtoUTC(maint.MaintEnd);
            if (ENDtime) {
                const maintEndMs = new Date(ENDtime).getTime();
                const leftEnd = maintEndMs - now;
                if (leftEnd > 0 && leftEnd < (12 * HORA)) {
                    const endoMeinto = setTimeout(() => {
                        notifyKC(idEnd);
                        kcTimmers.delete(idEnd);
                    }, leftEnd);
                    kcTimmers.set(idEnd, endoMeinto);
                }
            }
        }
    } catch (e) { error(`Error al programar temporizadores de mantenimiento: ${e}`, "KancolleBD"); }
}

// ========================================================= Euxiliares ========================================================= //
export function allLefts() {
    // Reglas mes: 1-31, 100 = ultimo dia del mes; Semana: domingo = 0 - sabado = 6, def= 1 lunes (1); Minutos: 0-59 def 0
    return {
        pvp: turnDate(leftTimeConv({ type: 'daily', hours: [3, 15] })), // PvP Dual
        pvp3h: turnDate(leftTimeConv({ type: 'daily', hours: 3 })), // PvP 03:00
        pvp15h: turnDate(leftTimeConv({ type: 'daily', hours: 15 })), // PvP 15:00
        oem: turnDate(leftTimeConv({ type: 'monthly', targetDay: 1, hours: 0 })), // Extra Operaciones
        dQuest: turnDate(leftTimeConv({ type: 'daily', hours: 5 })), // Misiones diarias
        wQuest: turnDate(leftTimeConv({ type: 'weekly', targetDay: 1, hours: 5 })), // Misiones semanales
        mQuest: turnDate(leftTimeConv({ type: 'monthly', targetDay: 1, hours: 5 })), // Misiones Mensuales
        qQuest: turnDate(leftTimeConv({ type: 'quarterly', targetDay: 1, hours: 5 })), // Misiones trimestrales
        dPtCutof: turnDate(leftTimeConv({ type: 'daily', hours: [2, 14] })), // Rank cutoof
        mPtCutof: turnDate(leftTimeConv({ type: 'monthly', targetDay: 100, hours: 22 })), // Rank cutoof mensuales
        mExp: turnDate(leftTimeConv({ type: 'monthly', targetDay: 15, hours: 12 })) // Expediciones mensuales
    };
}

// === misiones === //
function aQuest() {
    const now = getNowJST(), tokyoDate = new Date(now);
    const dayOfWeek = tokyoDate.getDay(); // 1 = lunes
    const numDay = tokyoDate.getDate(); // 1 - 31
    const month = tokyoDate.getMonth(); // 0 = enero, 11 = diciembre
    // === msg === //
    let aviso = `\n## ${emj.KC.Daily} DIARIAS!!`
    if (dayOfWeek === 1) aviso += `\n## ${emj.KC.Weekly} SEMANALES!!`
    if (numDay === 1) aviso += `\n## ${emj.KC.Monthly} MENSUALES!!`
    if (numDay === 1 && [2, 5, 8, 11].includes(month)) aviso += `\n## ${emj.KC.Quarterly} TRIMESTRALES (Quarterly)!!` //Marzo, Junio, Septiembre, Diciembre
    return aviso;
}

function lQusty() {
    const cmpDay = 23 * 60 * minuts; // Fix por chek de 24hrs
    const now = getNowJST() + cmpDay, tokyoDate = new Date(now);
    const month = tokyoDate.getMonth(); // 0 = enero, 11 = diciembre
    // === msg === //
    let aviso = `## PREAVISO DE RESET DE MISONES: \n\n# ${emj.KC.Monthly} MENSUALES!!`
    if ([2, 5, 8, 11].includes(month)) aviso += `\n# ${emj.KC.Quarterly} TRIMESTRALES (Quarterly)!!` //Marzo, Junio, Septiembre, Diciembre 
    return aviso;
}

// === timeDateConvert === //
export function turnDate(data: number) {
    const fixTime = data + 20_000; // añadido tiempo de compensacion
    const d = Math.floor(fixTime / 86400000);
    const h = Math.floor((fixTime % 86400000) / 3600000);
    const m = Math.floor((fixTime % 3600000) / 60000);
    const s = Math.floor((fixTime % 60000) / 1000);
    const t = [];

    if (d >= 1) t.push(d === 1 ? "1 día" : `${d} días`);
    if (h >= 1) t.push(h === 1 ? "1 hora" : `${h} horas`);
    if (m >= 1) t.push(m === 1 ? "1 minuto" : `${m} minutos`);
    if (s > 0 && d === 0 && h === 0 && m === 0) t.push(s === 1 ? "1 segundo" : `${s} segundos`);
    return t.join(', ') || '0 segundos';
}

// === multiTz === //
export function mantDates(start: Date | null, end: Date | null) {
    let sJP = "TBA", eJP = "TBA", sUTC = "TBA", eUTC = "TBA", sMX = "TBA", eMX = "TBA";
    const aUTC = 9 * 60 * 60 * 1000, aMX = 15 * 60 * 60 * 1000;
    if (start) { // Start Date
        const sDate = start.getTime(), UCTMant = sDate - aUTC, MXmant = sDate - aMX;
        sJP = new Date(start).toLocaleString("es-MX", { hour12: false, timeStyle: 'short', dateStyle: 'medium' }) + " hrs";
        sUTC = new Date(UCTMant).toLocaleString("es-MX", { hour12: false, timeStyle: 'short', dateStyle: 'medium' }) + " hrs";
        sMX = new Date(MXmant).toLocaleString("es-MX", { hour12: false, timeStyle: 'short', dateStyle: 'medium' }) + " hrs";
    }
    if (end) { // End Date
        const eDate = end.getTime(), UTCendMant = eDate - aUTC, MXmantEnd = eDate - aMX;
        eJP = new Date(end).toLocaleString("es-MX", { hour12: false, timeStyle: 'short', dateStyle: 'medium' }) + " hrs";
        eUTC = new Date(UTCendMant).toLocaleString("es-MX", { hour12: false, timeStyle: 'short', dateStyle: 'medium' }) + " hrs";
        eMX = new Date(MXmantEnd).toLocaleString("es-MX", { hour12: false, timeStyle: 'short', dateStyle: 'medium' }) + " hrs";
    }
    return { sJP, eJP, sUTC, eUTC, sMX, eMX }
}

// === getLeftTime === //
type timSlap = 'daily' | 'weekly' | 'monthly' | 'quarterly';
interface timeData { type: timSlap; hours: number | number[]; minutes?: number; targetDay?: number; targetMonths?: number[]; }
export function leftTimeConv(opts: timeData): number {
    const nowTime = getNowJST();
    const tokyoDate = new Date(nowTime)
    const getLastDay = new Date(tokyoDate.getFullYear(), tokyoDate.getMonth() + 1, 0).getDate();
    const isLastDay = (opts.targetDay === 100) ? getLastDay : (opts.targetDay || 1);

    let target = new Date(tokyoDate);
    target.setMinutes(opts.minutes || 0, 0, 0); /* hora target */
    if (opts.type === 'daily') { /* Soporte para multi horas del dia*/
        const hours = Array.isArray(opts.hours) ? opts.hours : [opts.hours];
        hours.sort((a, b) => a - b);

        let found = false;
        for (const h of hours) {
            target.setHours(h);
            if (target.getTime() > nowTime) {
                found = true;
                break;
            }
        }
        if (!found) { // Si ya paso el dia/hora pasamos al siguiente dia
            target.setHours(hours[0]);
            target.setDate(target.getDate() + 1);
        }

    } else if (opts.type === 'monthly') {
        target.setDate(isLastDay);
        target.setHours(opts.hours as number);

        if (target.getTime() <= nowTime) { /*Si ya fue lo cambiamos a la sigueinte mes */
            target.setMonth(target.getMonth() + 1);
        }

    } else if (opts.type === 'weekly') {
        const tDay = opts.targetDay || 1; // Por defecto Lunes (1)
        target.setHours(opts.hours as number);

        let daysUntilTarget = tDay - target.getDay();
        if (daysUntilTarget < 0) daysUntilTarget += 7;

        if (daysUntilTarget === 0 && target.getTime() <= nowTime) { /*Si ya fue lo cambiamos a la sigueinte semana */
            daysUntilTarget = 7;
        }

        target.setDate(target.getDate() + daysUntilTarget);

    } else if (opts.type === 'quarterly') {
        const months = opts.targetMonths || [2, 5, 8, 11]; //KC default
        months.sort((a, b) => a - b);

        const currentYear = tokyoDate.getFullYear();
        let targetFound = false;
        for (const m of months) {
            target.setDate(1); // Anti desbordamientos
            target.setFullYear(currentYear);
            target.setMonth(m);
            target.setDate(isLastDay);
            target.setHours(opts.hours as number);

            if (target.getTime() > nowTime) {
                targetFound = true;
                break;
            }
        }

        if (!targetFound) { /* ya no esta en el año*/
            target.setDate(1);
            target.setFullYear(currentYear + 1);
            target.setMonth(months[0]);
            target.setDate(isLastDay);
            target.setHours(opts.hours as number);
        }
    }
    const fnTime = target.getTime() - nowTime; // NO TOCAR!!
    return fnTime;
}

// === TZcore === //
export function JSTtoUTC(dateInput: string | Date | null | undefined): Date | null {
    if (!dateInput) return null;
    if (dateInput instanceof Date) return new Date(dateInput.getTime());
    const match = dateInput.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (match) {
        const [_, year, month, day, hours, minutes, seconds] = match.map(Number);
        return new Date(Date.UTC(year, month - 1, day, hours - 9, minutes, seconds));
    }

    try {
        const parsed = new Date(dateInput);
        return isNaN(parsed.getTime()) ? null : parsed;
    } catch {
        return null;
    }
}

export function getNowJST(): number {
    const now = new Date();
    return now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + (9 * 60 * 60 * 1000);
}

// === fetchData === //
export async function fetchData(url: string) {
    let chkData;
    try { chkData = await fetch(url); }
    catch (e) { error(`❌ Error de red al obtener DATA: ${e}`); return null }
    if (!chkData.ok) return null;
    return chkData
}

// =================================================================================================================================== //
// =========================================================== SitchNotify =========================================================== //
// =================================================================================================================================== //
interface fiDo { name: string, value: string, inline?: boolean };
interface presetsKC {
    title: { A: string, B: string },
    desc: { ini: string, l30: string, l15: string, fn: string },
    urlPic: { A?: string, B?: string },
    field: { A: fiDo[], B?: fiDo[] },
    mTimmer: number,
    ntfy: { ntf_30: boolean, ntf_15: boolean, ntf_end: boolean },
    url?: string,
};

export async function rawPreset(type: notifyType): Promise<presetsKC | null> {
    const rst = allLefts(), minuts = 60 * 1_000;
    let vlueTxt = i18next.t("commands:kancolle.bgProsses.siwtchNotify_vText", { a1: rst.pvp, a2: rst.oem, a3: rst.mExp, a4: rst.dQuest, a5: rst.wQuest, a6: rst.mQuest, a7: rst.qQuest, a8: rst.dPtCutof, a9: rst.mPtCutof });
    if (maint.lastMaintStart && (maint.lastMaintStart.getTime() > getNowJST())) {
        const resTime = maint.lastMaintStart.getTime() - getNowJST();
        const mantData = "\n" + "> Mantenimiento:" + "\n" + `**⏰ INICIA EN:** ${turnDate(resTime)}` + "\n\n"
        if (type !== "mntStar") vlueTxt += mantData;
    }
    // ===== switch ===== //
    switch (type) {
        case "pvp": // Aviso PvPs
            const timePvp = leftTimeConv({ type: 'daily', hours: [3, 15] });
            return {
                title: { A: i18next.t("commands:kancolle.bgProsses.siwtchNotify_pvp_title"), B: i18next.t("commands:kancolle.bgProsses.siwtchNotify_pvp_uTitle"), },
                desc: {
                    ini: i18next.t("commands:kancolle.bgProsses.siwtchNotify_pvp_desc"),
                    l30: i18next.t("commands:kancolle.bgProsses.siwtchNotify_pvp_desc_30"),
                    l15: i18next.t("commands:kancolle.bgProsses.siwtchNotify_pvp_desc_15"),
                    fn: i18next.t("commands:kancolle.bgProsses.siwtchNotify_pvp_uDesc"),
                },
                field: { A: [{ name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_nextReset"), value: vlueTxt }] },
                mTimmer: timePvp,
                ntfy: { ntf_30: true, ntf_15: true, ntf_end: true, },
                urlPic: { A: "https://i.imgur.com/rhaHOhq.png" }
            };
        // ======================================== QUEST ======================================== //
        case "quest": // Aviso Diarias
            const timeQuest = leftTimeConv({ type: 'daily', hours: 5 });
            const tx = aQuest();
            return {
                title: { A: i18next.t("commands:kancolle.bgProsses.siwtchNotify_quest_title"), B: i18next.t("commands:kancolle.bgProsses.siwtchNotify_quest_uTitle") },
                desc: {
                    ini: i18next.t("commands:kancolle.bgProsses.siwtchNotify_quest_desc", { a1: tx }),
                    l30: i18next.t("commands:kancolle.bgProsses.siwtchNotify_quest_desc_30m", { a1: tx }),
                    l15: i18next.t("commands:kancolle.bgProsses.siwtchNotify_quest_desc_15", { a1: tx }),
                    fn: i18next.t("commands:kancolle.bgProsses.siwtchNotify_quest_uDesc", { a1: tx }),
                },
                field: { A: [{ name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_nextReset"), value: vlueTxt }] },
                mTimmer: timeQuest,
                ntfy: { ntf_30: true, ntf_15: true, ntf_end: true, },
                urlPic: { A: "https://i.imgur.com/pJZdK4i.jpeg" }
            };
        case "quest24h": // Aviso Mensuales/Quaterly
            const reset = lQusty()
            return {
                title: { A: i18next.t("commands:kancolle.bgProsses.siwtchNotify_quest_title"), B: "TBA" },
                desc: {
                    ini: `${reset} \n\n ## > RESET EN 24 HRS`,
                    l30: "TBA", l15: "TBA", fn: "TBA"
                },
                field: { A: [{ name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_nextReset_A_F"), value: vlueTxt }] },
                mTimmer: 0,
                ntfy: { ntf_30: false, ntf_15: false, ntf_end: false, },
                urlPic: { A: "https://i.imgur.com/2pCJyiW.jpeg" }
            };
        // ======================================== OEM NTFY ======================================== //
        case "oem":
            const timeOem = leftTimeConv({ type: 'monthly', targetDay: 1, hours: [0] });
            return {
                title: { A: i18next.t("commands:kancolle.bgProsses.siwtchNotify_oem_title"), B: i18next.t("commands:kancolle.bgProsses.siwtchNotify_oem_uTitle") },
                desc: {
                    ini: i18next.t("commands:kancolle.bgProsses.siwtchNotify_oem_desc"),
                    l30: i18next.t("commands:kancolle.bgProsses.siwtchNotify_oem_desc_30m"),
                    l15: i18next.t("commands:kancolle.bgProsses.siwtchNotify_oem_desc_15"),
                    fn: i18next.t("commands:kancolle.bgProsses.siwtchNotify_oem_uDesc"),
                },
                field: { A: [{ name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_nextReset"), value: vlueTxt }] },
                mTimmer: timeOem,
                ntfy: { ntf_30: true, ntf_15: true, ntf_end: true, },
                urlPic: { A: "https://i.imgur.com/72A2KNE.png", }
            };
        case "oem24h": // pre aviso OEM
            return {
                title: { A: i18next.t("commands:kancolle.bgProsses.siwtchNotify_oem_title"), B: "TBA" },
                desc: {
                    ini: `# REINICIO EN 24 HRS!!`,
                    l30: "TBA", l15: "TBA", fn: "TBA"
                },
                field: { A: [{ name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_nextReset_A_F"), value: vlueTxt }] },
                mTimmer: 0,
                ntfy: { ntf_30: false, ntf_15: false, ntf_end: false, },
                urlPic: { A: "https://pbs.twimg.com/media/FOqFIkaXIAMbdMy.jpg" }
            };
        // ========================================  MEXP NTFY ======================================== //
        case "mExp":
            const timemExp = leftTimeConv({ type: 'monthly', targetDay: 15, hours: 12 });
            return {
                title: { A: i18next.t("commands:kancolle.bgProsses.siwtchNotify_mExp_title"), B: i18next.t("commands:kancolle.bgProsses.siwtchNotify_mExp_uTitle") },
                desc: {
                    ini: i18next.t("commands:kancolle.bgProsses.siwtchNotify_mExp_desc"),
                    l30: i18next.t("commands:kancolle.bgProsses.siwtchNotify_mExp_desc_30m"),
                    l15: i18next.t("commands:kancolle.bgProsses.siwtchNotify_mExp_desc_15"),
                    fn: i18next.t("commands:kancolle.bgProsses.siwtchNotify_mExp_uDesc"),
                },
                field: { A: [{ name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_nextReset"), value: vlueTxt }] },
                mTimmer: timemExp,
                ntfy: { ntf_30: true, ntf_15: true, ntf_end: true, },
                urlPic: { A: "https://i.redd.it/pbl5gjzvaqy31.png" }
            };
        case "mExp24h": // pre aviso mExp
            return {
                title: { A: "EXPEDICIONES MENSUALES!", B: "TBA" },
                desc: {
                    ini: `# REINICIO EN 24 HRS!!`,
                    l30: "TBA", l15: "TBA", fn: "TBA"
                },
                field: { A: [{ name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_nextReset_A_F"), value: vlueTxt }] },
                mTimmer: 0,
                ntfy: { ntf_30: false, ntf_15: false, ntf_end: false, },
                urlPic: { A: "https://i.redd.it/pbl5gjzvaqy31.png" }
            }
        // ======================================== Mantenimiento ======================================== //
        case "mntStar24h": // preaviso 24hrs
            return {
                title: { A: "MANTENIMIENTO!!", B: "TBA" },
                desc: {
                    ini: `# EL MANTENIMIENTO INICIA EN 24 HRS!!`,
                    l30: "TBA", l15: "TBA", fn: "TBA"
                },
                field: { A: [{ name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_nextReset_A"), value: vlueTxt }] },
                mTimmer: 0,
                ntfy: { ntf_30: false, ntf_15: false, ntf_end: false, },
                urlPic: { A: "https://i.imgur.com/zTF3hlZ.png" }
            };
        case "mntStar": // aviso inico
            const endRawDate = JSTtoUTC(maint.MaintEnd);
            const endDate = endRawDate ? new Date(endRawDate).toLocaleString('es-MX', { hour12: false }) : `\`TBA!\``;
            return {
                title: { A: i18next.t("commands:kancolle.bgProsses.siwtchNotify_1h_uTitle"), B: i18next.t("commands:kancolle.bgProsses.siwtchNotify_1h_uTitle") },
                desc: {
                    ini: i18next.t("commands:kancolle.bgProsses.siwtchNotify_mntsStart", { a1: endDate }),
                    l30: i18next.t("commands:kancolle.bgProsses.siwtchNotify_mntsStart_30"),
                    l15: i18next.t("commands:kancolle.bgProsses.siwtchNotify_mntsStart_15"),
                    fn: i18next.t("commands:kancolle.bgProsses.siwtchNotify_1h_uDesc", { a1: endDate }),
                },
                field: { A: [{ name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_nextReset_A"), value: vlueTxt }] },
                mTimmer: 60 * minuts,
                ntfy: { ntf_30: true, ntf_15: true, ntf_end: true, },
                urlPic: { A: "https://i.imgur.com/zTF3hlZ.png", B: "https://i.imgur.com/ed3cVTh.png" }
            };
        case "mntAviso": // aviso de nuevo mante
            if (!ntfMantData.MaintDate) return null;
            const tokyoDate = getNowJST(), INItime = JSTtoUTC(ntfMantData.MaintDate), ENDtime = JSTtoUTC(ntfMantData.endMantDate);;
            const left2start = INItime ? turnDate(INItime.getTime() - tokyoDate) : "TBA";
            const lef2end = ENDtime ? turnDate(ENDtime.getTime() - tokyoDate) : "TBA";
            const tim = mantDates(ntfMantData.MaintDate, ntfMantData.endMantDate)
            return {
                title: { A: i18next.t("commands:kancolle.bgProsses.siwtchNotify_1h_uTitle"), B: "TBA" },
                desc: {
                    ini: i18next.t("commands:kancolle.bgProsses.siwtchNotify_mntStart_des"), l30: "TBA", l15: "TBA", fn: "TBA"
                },
                field: {
                    A: [
                        { name: '> ***Tiempo restante:***', value: `⏰ INICIO: \`${left2start}\` \n⏰ TERMINO:  \`${lef2end}\`` },
                        { name: "> ***🇯🇵 JST*** | ***GMT+9***", value: `📅 INICIO: \`${tim.sJP}\` \n📅 TERMINO: \`${tim.eJP}\`` },
                        { name: "> ***🌐 UTC***", value: `📅 INICIO: \`${tim.sUTC}\` \n📅 TERMINO: \`${tim.eUTC} \`` },
                        { name: "> ***🇲🇽 MX_City*** | ***🇸🇻 SV*** | ***🇨🇷 CR*** | ***GMT-6***", value: `📅 INICO: \`${tim.sMX}\` \n📅 TERMINO: \`${tim.eMX}\`` },
                        { name: "> ***Tweet del anuncio:***", value: ntfMantData.tweetInfo ? ntfMantData.tweetInfo.Orginal : "No disponible!" },
                        { name: "> ***Tweet traducido al Español:***", value: ntfMantData.tweetInfo ? ntfMantData.tweetInfo.isoES : "No disponible!" },
                        { name: "> ***Tweet traducido al Inglés:***", value: ntfMantData.tweetInfo ? ntfMantData.tweetInfo.isoEN : "No disponible!" }
                    ]
                },
                mTimmer: 0,
                ntfy: { ntf_30: false, ntf_15: false, ntf_end: false, },
                urlPic: { A: "https://i.imgur.com/sInDmjs.jpeg" },
                url: ntfMantData.url ? ntfMantData.url : undefined
            }
        case "mntEnd": // aviso fin mante
            return {
                title: { A: i18next.t("commands:kancolle.bgProsses.siwtchNotify_1h_uTitle"), B: "TBA" },
                desc: {
                    ini: i18next.t("commands:kancolle.bgProsses.siwtchNotify_endMant"),
                    l30: "TBA", l15: "TBA", fn: "TBA"
                },
                field: { A: [{ name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_nextReset_A_F"), value: vlueTxt }] },
                mTimmer: 0,
                ntfy: { ntf_30: false, ntf_15: false, ntf_end: false, },
                urlPic: { A: "https://i.imgur.com/sInDmjs.jpeg" }
            };
        case "rank":
            const rank = leftTimeConv({ type: 'daily', hours: [3, 15], minutes: 0 })
            const jpF = new Date().toLocaleString("es-MX", { timeZone: 'Asia/Tokyo', hour12: false, timeStyle: 'short', dateStyle: 'short' });
            let isActual = `### Hora de actualizacion: ${jpF} JP Time`;
            const newFields: { name: string, value: string, inline?: boolean }[] = [];
            const senkDta = await senkaTables()
            if (senkDta.length > 0) {
                for (const sSnk of senkDta) {
                    newFields.push(
                        {
                            name: `ID: ${sSnk.num} | Name: ${gimeName(sSnk.name)} \n> upDate: ${sSnk.isUpdate ? emj.cmn.ok : emj.cmn.fail} | Hora: ${sSnk.updatedIn}`,
                            value: `**Top 1:** ${sSnk.top1}pts | **Top 5:** ${sSnk.top5}pts | **Top 20:** ${sSnk.top20}pts \n **Top 100:** ${sSnk.top100}pts | **Top 500:** ${sSnk.top500}pts`
                        }
                    )
                }
            }
            else {
                const dtaRnk = await rankServers();
                if (!dtaRnk.ok || !dtaRnk.data) {
                    if (dtaRnk.data) { isActual = ` > Cache: ${dtaRnk.date} JP time`; }
                    else { return null }
                }
                for (const srv of dtaRnk.data) {
                    const upDate = new Date(srv.lastModified).toLocaleString("es-MX", { timeZone: 'Asia/Tokyo', hour12: false, timeStyle: 'short', dateStyle: 'short' });
                    newFields.push({
                        name: `ID: ${srv.number} | Name: ${srv.jpName} (${srv.enName}) \n> Actual: ${dtaRnk.ok ? (srv.updated ? emj.cmn.ok : emj.cmn.fail) : emj.cmn.fail} | ${upDate} JP Time`,
                        value: `**Top 1:** ${srv.cutoff[1]}pts | **Top 5:** ${srv.cutoff[5]}pts | **Top 20:** ${srv.cutoff[20]}pts \n **Top 100:** ${srv.cutoff[100]}pts | **Top 500:** ${srv.cutoff[500]}pts`
                    });
                }
            }

            return {
                title: { A: `**Senka.su - Ranking Cutoff!!**`, B: "**Mostrando actualizacion de pts.**" },
                desc: { ini: `## Ranking Cutoff!`, l30: "TBA", l15: "TBA", fn: (isActual + `\n **${emj.cmn.ok} = Puntaje actualizado.**` + `\n \`/kancolle rank\``) },
                field: { A: [], B: newFields },
                mTimmer: rank,
                ntfy: { ntf_30: false, ntf_15: false, ntf_end: true, },
                urlPic: { A: "https://i.imgur.com/ZzQLWQ6.png" }
            }

        // ======================================== END ======================================== //
        default:
            return null;
    }
};

// =========================================================== RankData(bonder) =========================================================== //
export type RankLevel = '1' | '5' | '20' | '100' | '500';
type Cutoff = Record<RankLevel, number>;
export interface RecordEntry {
    value: number;
    year: number;
    month: number;
}

export interface RankData {
    number: number;
    enName: string;
    jpName: string;
    cutoff: Cutoff;
    lastModified: string | Date;
    updated: boolean;
    records: {
        higest: Record<RankLevel, RecordEntry>;
        lowest: Record<RankLevel, RecordEntry>;
    };
}

let kcheRank: RankData[] | null = null
export async function rankServers(): Promise<{ ok: boolean, data: RankData[] | null, date?: string }> {
    const urlDta = `https://bonodere.famluro.es/api/misc/serverdata`;
    const para: RequestInit = { method: 'GET' };
    const jstDate = new Date().toLocaleString("es-MX", { timeZone: 'Asia/Tokyo', hour12: false, timeStyle: 'short', dateStyle: 'short' });

    try {
        const getData = await fetch(urlDta, para);
        if (!getData.ok) return { ok: false, data: kcheRank ?? null, date: jstDate };

        const data = (await getData.json()) as RankData[];
        kcheRank = data;
        return { ok: true, data };
    } catch (error) {
        return { ok: false, data: kcheRank ?? null, date: jstDate };
    }
}


// =========================================================== RankData(senku) =========================================================== //
interface ServerStatus {
    num: number;
    name: string;
    updatedIn: string;
}

interface ServerRanking {
    serverName: string;
    isUpdated: boolean;
    top1: number;
    top5: number;
    top20: number;
    top100: number;
    top500: number;
}

export interface SenkaData {
    num: number;
    name: string;
    isUpdate: boolean;
    updatedIn: string;
    top1: number;
    top5: number;
    top20: number;
    top100: number;
    top500: number;
}

export async function senkaTables(): Promise<SenkaData[]> {
    const senkData = await fetch("https://senka.su/en").catch(() => null);
    if (!senkData || !senkData.ok) return [];

    const html = await senkData.text();
    const $ = cheerio.load(html);

    const serverStatuses: ServerStatus[] = [];

    $('.server-list .ant-table-tbody tr td').each((_, td) => {
        const $a = $(td).find('.server a');
        const href = $a.attr('href') || '';
        const numMatch = href.match(/num=(\d+)/);

        if (numMatch) {
            const num = parseInt(numMatch[1], 10);
            const rawText = $a.text().trim();
            const name = rawText.replace(/^\[\d+\]\s*/, '');
            const updatedIn = $(td).find('.server-status').text().trim();

            serverStatuses.push({ num, name, updatedIn });
        }
    });

    const serverRankings: ServerRanking[] = [];

    $('.server-ranking .ant-table-tbody tr').each((_, tr) => {
        const cells = $(tr).find('td');

        if (cells.length >= 6) {
            const firstCell = $(cells[0]);
            const serverName = firstCell.attr('title')?.trim() || firstCell.text().trim();

            const nameCellDiv = firstCell.find('.cell');
            const isUpdated = nameCellDiv.hasClass('text-success'); // true si tiene text-success

            const parseVal = (index: number) => {
                const valText = $(cells[index]).find('.cell.val').text().trim();
                return parseInt(valText, 10) || 0;
            };

            serverRankings.push({
                serverName,
                isUpdated,
                top1: parseVal(1),
                top5: parseVal(2),
                top20: parseVal(3),
                top100: parseVal(4),
                top500: parseVal(5),
            });
        }
    });

    const rankingsByName = new Map(
        serverRankings.map(r => [r.serverName.toLowerCase().trim(), r])
    );

    const combinedServers: SenkaData[] = serverStatuses.map((status, index) => {
        const rank = rankingsByName.get(status.name.toLowerCase().trim()) ?? serverRankings[index];
        return {
            ...status,
            isUpdate: rank?.isUpdated ?? false,
            top1: rank?.top1 ?? 0,
            top5: rank?.top5 ?? 0,
            top20: rank?.top20 ?? 0,
            top100: rank?.top100 ?? 0,
            top500: rank?.top500 ?? 0,
        };
    });

    return combinedServers;
}

export function gimeName(name: string) {
    const srvFixName: Record<string, string> = {
        /*1*/ "Yokosuka": "横须贺镇守府 (Yokosuka)", /*2*/ "Kure": "呉镇守府 (Kure)", /*3*/ "Sasebo": "佐世保镇守府 (Sasebo)", /*4*/ "Maizuru": " 舞鹤镇守府 (Maizuru)",
        /*5*/ "Ominato": "大凑警备府 (Ominato)", /*6*/ "Truk": " トラック泊地 (Truk)", /*7*/ "Lingga": "リンガ泊地 (Lingga)", /*8*/ "Rabaul": "ラバウル基地 (Rabaul)",
        /*9*/ "Shortland": " ショートランド泊地 (Shortland)", /*10*/ "Buin": "ブイン基地 (Buin)", /*11*/ "Tawi-Tawi": " タウイタウイ泊地 (Tawi-Tawi)", /*12*/ "Palau": "パラオ泊地 (Palau)",
        /*13*/ "Brunei": "ブルネイ泊地 (Brunei)", /*14*/ "Hitokappu": "単冠湾泊地 (Hitokappu)", /*15*/ "Paramushir": "幌筵泊地 (Paramushir)", /*16*/ "Sukumo": "宿毛湾泊地 (Sukumo)",
        /*17*/ "Kanoya": "鹿屋基地 (Kanoya)", /*18*/ "Iwagawa": "岩川基地 (Iwagawa)", /*19*/ "Saiki": "佐伯湾泊地 (Saiki)", /*20*/ "Hashirajima": "柱岛泊地 (Hashirajima)"
    };
    return srvFixName[name] ?? name;
}

