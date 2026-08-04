//import * as cron from 'node-cron';
import { Client, EmbedBuilder, Role, TextChannel } from 'discord.js';
import { debug, error, info } from '../sys/logging';
import { startKC, data, maint, updateKCmant, kcheMaint } from '../sys/DB-Engine/links/KancolleBD';
import { configs } from "../sys/zGears/kc_aux";

let kcTimmers = new Map<string, NodeJS.Timeout>();
const minuts = 60 * 1_000;
const idStart = `maintStart`, idEnd = `mntEnd`;

// ========================================================= Init ========================================================= //
export async function initKC(clnt: Client) {
    let inf = "[Kancolle] Se inicio el servicio:";
    const x = await startKC(), y = await kcheMaint();
    if (x) {
        cronKC(clnt)
        setInterval(() => cronKC(clnt), 120 * minuts)
        inf += " > Avisos < ";
    }
    if (y) {
        mantChk(clnt)
        setInterval(() => mantChk(clnt), 20 * minuts)
        inf += " > Mantenimientos < ";
    }
    info(inf)
}

export type notifyType = 'pvp' | 'quest' | `oem` | `mExp` | `newMante` | `maintStart` | 'mntEnd';
let notifyTimers = new Map<notifyType, NodeJS.Timeout>();
async function cronKC(clnt: Client) {
    // =========================== pvp =========================== //
    const pvpStr = () => {
        if (notifyTimers.has('pvp')) notifyTimers.delete('pvp');
        const pvp = leftTimeConv({ type: 'daily', hours: [2, 14], minutes: 30 });
        const timer = setTimeout(() => { notifyTimers.delete('pvp'); notifyKC(clnt, 'pvp'); }, pvp);
        debug(`[KanCron]: pvpStr establecido para ${pvp} fecha ${turnDate(pvp)}`)
        notifyTimers.set('pvp', timer);
    }; if (!notifyTimers.has('pvp')) pvpStr();
    // =========================== quest =========================== //
    const questStr = () => {
        if (notifyTimers.has('quest')) notifyTimers.delete('quest');
        const quest = leftTimeConv({ type: 'daily', hours: 4, minutes: 30 });
        const timer = setTimeout(() => { notifyTimers.delete('quest'); notifyKC(clnt, 'quest'); }, quest);
        debug(`[KanCron]: questStr establecido para ${quest} fecha ${turnDate(quest)}`)
        notifyTimers.set('quest', timer);
    }; if (!notifyTimers.has('quest')) questStr();
    // =========================== extra operaciones =========================== //
    const oemStr = () => {
        const oem = leftTimeConv({ type: 'monthly', targetDay: 1, hours: 0, minutes: 0 });
        if (oem > (24 * 60 * minuts)) return;
        if (notifyTimers.has('oem')) notifyTimers.delete('oem');
        const delay = Math.max(0, oem - (60 * minuts));
        const timer = setTimeout(() => { notifyTimers.delete('oem'); notifyKC(clnt, 'oem'); }, delay);
        debug(`[KanCron]: oemStr establecido para ${delay} fecha ${turnDate(delay)}`)
        notifyTimers.set('oem', timer);
    }; if (!notifyTimers.has('oem')) oemStr();
    // =========================== expediciones mensuales =========================== //
    const mExpStr = () => {
        if (notifyTimers.has('mExp')) notifyTimers.delete('mExp');
        const mExp = leftTimeConv({ type: 'monthly', targetDay: 15, hours: 12, minutes: 0 });
        if (mExp > (24 * 60 * minuts)) return;
        const delay = Math.max(0, mExp - (60 * minuts));
        const timer = setTimeout(() => { notifyTimers.delete('mExp'); notifyKC(clnt, 'mExp'); }, delay);
        debug(`[KanCron]: mExpStr establecido para ${delay} fecha ${turnDate(delay)}`)
        notifyTimers.set('mExp', timer);
    }; if (!notifyTimers.has('mExp')) mExpStr();
}

// ========================================================= Main ========================================================= //
const chkType = new Map<notifyType, (cfg: any) => boolean>([
    ['pvp', cfg => cfg.pvp.av], ['quest', cfg => cfg.quest.av], ['oem', cfg => cfg.oem.av], ['mExp', cfg => cfg.mExp.av],
    ['newMante', cfg => cfg.mnt.av], ['maintStart', cfg => cfg.mnt.av], ['mntEnd', cfg => cfg.mnt.av]]);

const chkRoleT = new Map<notifyType, (cfg: any) => boolean>([
    ['pvp', cfg => cfg.pvp.ntf], ['quest', cfg => cfg.quest.ntf], ['oem', cfg => cfg.oem.ntf], ['mExp', cfg => cfg.mExp.ntf],
    ['newMante', cfg => cfg.mnt.ntf], ['maintStart', cfg => cfg.mnt.ntf], ['mntEnd', cfg => cfg.mnt.ntf]]);

async function notifyKC(client: Client, type: notifyType) {
    for (const [guildId, configs] of data.entries()) {
        for (const cfg of configs) {
            const check = chkType.get(type), checkRol = chkRoleT.get(type)
            if (!check || !check(cfg)) continue;
            try {
                const guild = await client.guilds.fetch(guildId).catch(() => null);
                if (!guild) continue;
                const channel = await guild.channels.fetch(cfg.channel).catch(() => null);
                if (!channel || !channel.isTextBased()) continue;
                const txtCh = channel as TextChannel;
                let chkRol: Role | null = null;
                if (cfg.role && checkRol && checkRol(cfg)) chkRol = await guild.roles.fetch(cfg.role).catch(() => null)
                sendMSG({ ch: txtCh, rol: chkRol, type: type })
            } catch (err) { error(`Error al notificar: ${guildId} ${err}`); }
        }
    }
}

// ========================================================= fetchMaint ========================================================= //
export let ntfMantData: ntfMant = { MaintDate: null, endMantDate: null, url: null };
interface ntfMant { MaintDate: Date | null; endMantDate: Date | null; url: string | null; }
interface dataGit { MaintInfoLink: string; MaintStart: string; MaintEnd?: string; }
async function mantChk(C: Client) {
    const gitData = "https://raw.githubusercontent.com/ElectronicObserverEN/Data/refs/heads/master/update.json";
    let chkData;
    try {
        chkData = await fetch(gitData);
    } catch (e) { error(`❌ Error de red al obtener JSON: ${e}`, "KancolleBD"); return }

    if (!chkData.ok) { error(`❌ Error HTTP: ${chkData.status}`, "KancolleBD"); return }

    const processData = await chkData.json() as dataGit;
    const newMaintStartStr = processData.MaintStart ?? null;
    const newMaintEndStr = processData.MaintEnd ?? null;

    if (!newMaintStartStr) return;

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
        debug(`🔧 Anunciando nuevo mantenimiento a los servidores: ${newMaintStartStr}`, "KancolleBD");
        ntfMantData = { MaintDate: newMaintDate, endMantDate: endMantDate, url: processData.MaintInfoLink };
        notifyKC(C, "newMante")
        maint.maintNotified = true;
        await updateKCmant({ lastMaintStart: newMaintDate, maintNotified: true, lastNotificationTime: new Date(), MaintEnd: endMantDate });
    }
    if (!kcTimmers.has(idStart) || !kcTimmers.has(idEnd)) startMant(C);
}

// ===== notifyMaint ===== //
async function startMant(C: Client) {
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
                    notifyKC(C, idStart);
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
                        notifyKC(C, idEnd);
                        kcTimmers.delete(idEnd);
                    }, leftEnd);
                    kcTimmers.set(idEnd, endoMeinto);
                }
            }
        }
    } catch (e) { error(`Error al programar temporizadores de mantenimiento: ${e}`, "KancolleBD"); }
}

// ========================================================= msg Builder ========================================================= //
interface Params { ch: TextChannel, rol: Role | null, type: notifyType }
interface msgData { ch: TextChannel, title: string, fields: any[], desc: string, pic: string | undefined, roleContent: string | undefined, color: number, url: string | undefined }
// === sndManager === //
const sendAutoDelete = async (dta: msgData) => {
    const emb = new EmbedBuilder().setColor(dta.color).setTitle(dta.title).setDescription(dta.desc)
    if (dta.pic) emb.setImage(dta.pic);
    if (dta.url) emb.setURL(dta.url);
    if (dta.fields && dta.fields.length > 0) emb.addFields(dta.fields);
    try {
        const msg = await dta.ch.send({ content: dta.roleContent, embeds: [emb] });
        if (msg.deletable) {
            setTimeout(() => {
                msg.delete().catch(err => error(`Error al borrar msg: ${err}`, "KanCron"));
            }, 10 * minuts);
        }
    } catch (e) { error(`Error enviando notificación: ${e}`, "KanCron"); }
}

// === mainMsgNotify === //
async function sendMSG(dat: Params) {
    const preset = configs(dat.type);
    if (!preset) return;

    const roleMention = dat.rol ? `AVISO: ${dat.rol}!` : undefined;
    await sendAutoDelete({ ch: dat.ch, title: preset.title.A, fields: preset.field, desc: preset.desc.ini, pic: preset.urlPic.A, roleContent: roleMention, color: 0xFFA500, url: preset.url });

    if (preset.ntfy.ntf_30 && preset.mTimmer > (30 * minuts)) {
        setTimeout(async () => {
            await sendAutoDelete({ ch: dat.ch, title: preset.title.A, fields: [], desc: preset.desc.l30, pic: preset.urlPic.A, roleContent: undefined, color: 0xFFA500, url: preset.url });
        }, preset.mTimmer - (30 * minuts));
    }

    if (preset.ntfy.ntf_15 && preset.mTimmer > (15 * minuts)) {
        setTimeout(async () => {
            await sendAutoDelete({ ch: dat.ch, title: preset.title.A, fields: [], desc: preset.desc.l15, pic: preset.urlPic.A, roleContent: undefined, color: 0xFFA500, url: preset.url });
        }, preset.mTimmer - (15 * minuts));
    }

    if (preset.ntfy.ntf_end && preset.mTimmer > 0) {
        setTimeout(async () => {
            await sendAutoDelete({ ch: dat.ch, title: preset.title.B, fields: [], desc: preset.desc.fn, pic: preset.urlPic.B, roleContent: roleMention, color: 0x00AA00, url: preset.url });
        }, preset.mTimmer);
    }
}

// ========================================================= Euxiliares ========================================================= //
type timSlap = 'daily' | 'weekly' | 'monthly' | 'quarterly';
interface timeData { type: timSlap; hours: number | number[]; minutes?: number; targetDay?: number; targetMonths?: number[]; }
// === lefTime === //
export function leftTime() {
    // Reglas mes: 1-31, 100 = ultimo dia del mes; Semana: domingo = 0 - sabado = 6, def= 1 lunes (1); Minutos: 0-59 def 0
    const pvpCount = leftTimeConv({ type: 'daily', hours: [3, 15] });
    const pvp3hrs = leftTimeConv({ type: 'daily', hours: 3 });
    const pvp15hrs = leftTimeConv({ type: 'daily', hours: 15 });
    const dQuestCount = leftTimeConv({ type: 'daily', hours: 5 });
    const wQuestCount = leftTimeConv({ type: 'weekly', targetDay: 1, hours: 5 });
    const mQuestCount = leftTimeConv({ type: 'monthly', targetDay: 1, hours: 5 });
    const qQuestCount = leftTimeConv({ type: 'quarterly', targetDay: 1, hours: 5 })
    const oemCount = leftTimeConv({ type: 'monthly', targetDay: 1, hours: 0 });
    const dPtCutof = leftTimeConv({ type: 'daily', hours: [2, 14] });
    const mPtCutof = leftTimeConv({ type: 'monthly', targetDay: 100, hours: 22 });
    const exped = leftTimeConv({ type: 'monthly', targetDay: 15, hours: 12 });

    return {
        pvp: turnDate(pvpCount), pvp3h: turnDate(pvp3hrs), pvp15h: turnDate(pvp15hrs), oem: turnDate(oemCount),
        dQuest: turnDate(dQuestCount), wQuest: turnDate(wQuestCount), mQuest: turnDate(mQuestCount), qQuest: turnDate(qQuestCount),
        dPtCutof: turnDate(dPtCutof), mPtCutof: turnDate(mPtCutof),
        mExp: turnDate(exped)
    };
}

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

// === misiones === //
export function aQuest() {
    const now = getNowJST();
    const tokyoDate = new Date(now);
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

// == TZcore == //
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
