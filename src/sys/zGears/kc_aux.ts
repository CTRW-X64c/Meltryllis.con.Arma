import i18next from "i18next";
import { notifyKC, notifyType } from "../../bgProcess/KanCron";
import { maint, updateKCmant } from "../DB-Engine/links/KancolleBD";
import { debug, error } from "../logging";
import { translate } from "@vitalets/google-translate-api";


// ========================================================= fetchMaint ========================================================= //
let ntfMantData: ntfMant = { MaintDate: null, endMantDate: null, url: null, tweetInfo: null };
const idStart = `maintStart`, idEnd = `mntEnd`;
const minuts = 60 * 1_000;

interface TweetInfoTl { Orginal: string; isoES: string; isoEN: string }
interface ntfMant { MaintDate: Date | null, endMantDate: Date | null, url: string | null, tweetInfo: TweetInfoTl | null };
interface dataGit { MaintInfoLink: string, MaintStart: string, MaintEnd?: string }

export async function mantChk() {
    const fData = await fetchData("https://raw.githubusercontent.com/ElectronicObserverEN/Data/refs/heads/master/update.json")
    if (!fData) return;

    const processData = await fData.json() as dataGit;
    const newMaintStartStr = processData.MaintStart ?? null;
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
        notifyKC("newMante")
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
let kcTimmers = new Map<string, NodeJS.Timeout>();
async function startMant() {
    try {
        if (!maint.lastMaintStart) return;
        const now = getNowJST(), INItime = JSTtoUTC(maint.lastMaintStart);
        if (!INItime) return;
        const maintStart = INItime.getTime();
        const leftStart = maintStart - now;
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


// =========================================================== SitchNotify =========================================================== //
interface presetsKC {
    title: { A: string, B: string },
    desc: { ini: string, l30: string, l15: string, fn: string },
    urlPic: { A?: string, B?: string },
    field: { name: string, value: string, inline?: boolean }[],
    mTimmer: number,
    ntfy: { ntf_30: boolean, ntf_15: boolean, ntf_end: boolean },
    url?: string,
}

export function rawPreset(type: notifyType): presetsKC | null {
    const rst = allLefts(), minuts = 60 * 1_000;
    const vlueTxt = i18next.t("commands:kancolle.bgProsses.siwtchNotify_vText", { a1: rst.pvp, a2: rst.oem, a3: rst.mExp, a4: rst.dQuest, a5: rst.wQuest, a6: rst.mQuest, a7: rst.qQuest, a8: rst.dPtCutof, a9: rst.mPtCutof });
    switch (type) {
        case "pvp":
            const timePvp = leftTimeConv({ type: 'daily', hours: [3, 15] });
            return {
                title: { A: i18next.t("commands:kancolle.bgProsses.siwtchNotify_pvp_title"), B: i18next.t("commands:kancolle.bgProsses.siwtchNotify_pvp_uTitle"), },
                desc: {
                    ini: i18next.t("commands:kancolle.bgProsses.siwtchNotify_pvp_desc"),
                    l30: "TBA",
                    l15: i18next.t("commands:kancolle.bgProsses.siwtchNotify_pvp_desc_15"),
                    fn: i18next.t("commands:kancolle.bgProsses.siwtchNotify_pvp_uDesc"),
                },
                field: [{ name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_nextReset"), value: `${vlueTxt}` }],
                mTimmer: timePvp,
                ntfy: { ntf_30: false, ntf_15: true, ntf_end: true, },
                urlPic: { A: "https://i.imgur.com/rhaHOhq.png" }
            };
        case "quest":
            const timeQuest = leftTimeConv({ type: 'daily', hours: [5] });
            const tx = aQuest();
            return {
                title: { A: i18next.t("commands:kancolle.bgProsses.siwtchNotify_quest_title"), B: i18next.t("commands:kancolle.bgProsses.siwtchNotify_quest_uTitle") },
                desc: {
                    ini: i18next.t("commands:kancolle.bgProsses.siwtchNotify_quest_desc", { a1: tx }),
                    l30: "TBA",
                    l15: i18next.t("commands:kancolle.bgProsses.siwtchNotify_quest_desc_15", { a1: tx }),
                    fn: i18next.t("commands:kancolle.bgProsses.siwtchNotify_quest_uDesc", { a1: tx }),
                },
                field: [{ name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_nextReset"), value: vlueTxt }],
                mTimmer: timeQuest,
                ntfy: { ntf_30: false, ntf_15: true, ntf_end: true, },
                urlPic: { A: "https://i.imgur.com/pJZdK4i.jpeg" }
            };
        // too long time
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
                field: [{ name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_nextReset"), value: vlueTxt }],
                mTimmer: timeOem,
                ntfy: { ntf_30: true, ntf_15: true, ntf_end: true, },
                urlPic: { A: "https://i.imgur.com/72A2KNE.png", }
            };
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
                field: [{ name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_nextReset"), value: vlueTxt }],
                mTimmer: timemExp,
                ntfy: { ntf_30: true, ntf_15: true, ntf_end: true, },
                urlPic: { A: "https://i.redd.it/pbl5gjzvaqy31.png" }
            };
        // Mantenimiento 
        case "newMante":
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
                field: [
                    { name: '> ***Tiempo restante:***', value: `⏰ INICIO: \`${left2start}\` \n⏰ TERMINO:  \`${lef2end}\`` },
                    { name: "> ***🇯🇵 JST*** | ***GMT+9***", value: `📅 INICIO: \`${tim.sJP}\` \n📅 TERMINO: \`${tim.eJP}\`` },
                    { name: "> ***🌐 UTC***", value: `📅 INICIO: \`${tim.sUTC}\` \n📅 TERMINO: \`${tim.eUTC} \`` },
                    { name: "> ***🇲🇽 MX_City*** | ***🇸🇻 SV*** | ***🇨🇷 CR*** | ***GMT-6***", value: `📅 INICO: \`${tim.sMX}\` \n📅 TERMINO: \`${tim.eMX}\`` },
                    { name: "> ***Tweet del anuncio:***", value: ntfMantData.tweetInfo ? ntfMantData.tweetInfo.Orginal : "No disponible!" },
                    { name: "> ***Tweet traducido al Español:***", value: ntfMantData.tweetInfo ? ntfMantData.tweetInfo.isoES : "No disponible!" },
                    { name: "> ***Tweet traducido al Inglés:***", value: ntfMantData.tweetInfo ? ntfMantData.tweetInfo.isoEN : "No disponible!" }
                ],
                mTimmer: 0,
                ntfy: { ntf_30: false, ntf_15: false, ntf_end: false, },
                urlPic: { A: "https://i.imgur.com/sInDmjs.jpeg" },
                url: ntfMantData.url ? ntfMantData.url : undefined
            }
        case "maintStart":
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
                field: [{ name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_nextReset_A"), value: vlueTxt }],
                mTimmer: 60 * minuts,
                ntfy: { ntf_30: true, ntf_15: true, ntf_end: true, },
                urlPic: { A: "https://i.imgur.com/zTF3hlZ.png", B: "https://i.imgur.com/ed3cVTh.png" }
            };
        case "mntEnd":
            return {
                title: { A: i18next.t("commands:kancolle.bgProsses.siwtchNotify_1h_uTitle"), B: "TBA" },
                desc: {
                    ini: i18next.t("commands:kancolle.bgProsses.siwtchNotify_endMant"),
                    l30: "TBA", l15: "TBA", fn: "TBA"
                },
                field: [{ name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_nextReset_A_F"), value: vlueTxt }],
                mTimmer: 0,
                ntfy: { ntf_30: false, ntf_15: false, ntf_end: false, },
                urlPic: { A: "https://i.imgur.com/sInDmjs.jpeg" }
            };
        default:
            return null;
    }
};


// ========================================================= Euxiliares ========================================================= //
export function allLefts() {
    // Reglas mes: 1-31, 100 = ultimo dia del mes; Semana: domingo = 0 - sabado = 6, def= 1 lunes (1); Minutos: 0-59 def 0
    const p0 = leftTimeConv({ type: 'daily', hours: [3, 15] });
    const p1 = leftTimeConv({ type: 'daily', hours: 3 });
    const p2 = leftTimeConv({ type: 'daily', hours: 15 });
    const dQ = leftTimeConv({ type: 'daily', hours: 5 });
    const wQ = leftTimeConv({ type: 'weekly', targetDay: 1, hours: 5 });
    const mQ = leftTimeConv({ type: 'monthly', targetDay: 1, hours: 5 });
    const qQ = leftTimeConv({ type: 'quarterly', targetDay: 1, hours: 5 })
    const oem = leftTimeConv({ type: 'monthly', targetDay: 1, hours: 0 });
    const dPt = leftTimeConv({ type: 'daily', hours: [2, 14] });
    const mPt = leftTimeConv({ type: 'monthly', targetDay: 100, hours: 22 });
    const ex = leftTimeConv({ type: 'monthly', targetDay: 15, hours: 12 });

    return {
        pvp: turnDate(p0), pvp3h: turnDate(p1), pvp15h: turnDate(p2), oem: turnDate(oem),
        dQuest: turnDate(dQ), wQuest: turnDate(wQ), mQuest: turnDate(mQ), qQuest: turnDate(qQ),
        dPtCutof: turnDate(dPt), mPtCutof: turnDate(mPt),
        mExp: turnDate(ex)
    };
}

// === misiones === //
function aQuest() {
    const now = getNowJST(), tokyoDate = new Date(now);
    const dayOfWeek = tokyoDate.getDay(); // 1 = lunes
    const numDay = tokyoDate.getDate(); // 1 - 31
    const month = tokyoDate.getMonth(); // 0 = enero, 11 = diciembre
    // === msg === //
    let aviso = "\n- DIARIAS!!"
    if (dayOfWeek === 1) aviso += "\n- SEMANALES!!"
    if (numDay === 1) aviso += "\n- MENSUALES!!"
    if (numDay === 1 && [2, 5, 8, 11].includes(month)) aviso += "\n- TRIMESTRALES (Quarterly)!" //Marzo, Junio, Septiembre, Diciembre
    return aviso;
}

// === timeDateConvert === //
export function turnDate(data: number) {
    const d = Math.floor(data / 86400000);
    const h = Math.floor((data % 86400000) / 3600000);
    const m = Math.floor((data % 3600000) / 60000);
    const s = Math.floor((data % 60000) / 1000);
    const t = [];

    if (d >= 1) t.push(d === 1 ? "un día" : `${d} días`);
    if (h >= 1) t.push(h === 1 ? "una hora" : `${h} horas`);
    if (m >= 1) t.push(m === 1 ? "un minuto" : `${m} minutos`);
    if (s > 0 && d === 0 && h === 0) t.push(s === 1 ? "un segundo" : `${s} segundos`);
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
    return target.getTime() - nowTime;
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

