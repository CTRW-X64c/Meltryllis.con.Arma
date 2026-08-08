//import * as cron from 'node-cron';
import { Client, EmbedBuilder, Role, TextChannel } from 'discord.js';
import { debug, error, info } from '../sys/logging';
import { startKC, data, maint, updateKCmant, kcheMaint } from '../sys/DB-Engine/links/KancolleBD';
import { rawPreset } from "../sys/zGears/kc_aux";

let kcTimmers = new Map<string, NodeJS.Timeout>();
const minuts = 60 * 1_000;
const idStart = `maintStart`, idEnd = `mntEnd`;

// ========================================================= Init ========================================================= //
export async function initKC(cli: Client) {
    let inf = "[Kancolle] Se inicio el servicio:";
    const x = await startKC(), y = await kcheMaint();
    if (x) {
        timmerAv(cli)
        setInterval(() => timmerAv(cli), 120 * minuts)
        inf += " > Avisos < ";
    }
    if (y) {
        mantChk(cli)
        setInterval(() => mantChk(cli), 20 * minuts)
        inf += " > Mantenimientos < ";
    } info(inf)
}

export type notifyType = 'pvp' | 'quest' | 'oem' | 'mExp' | 'newMante' | 'maintStart' | 'mntEnd';
let notifyTimers = new Map<notifyType, NodeJS.Timeout>();
async function timmerAv(cli: Client) {
    /* ===== pvp ===== */
    const pvpStr = () => {
        if (notifyTimers.has('pvp')) notifyTimers.delete('pvp');
        const pvp = leftTimeConv({ type: 'daily', hours: [2, 14], minutes: 30 });
        const timer = setTimeout(() => { notifyTimers.delete('pvp'); notifyKC(cli, 'pvp'); }, pvp);
        debug(`[KanCron]: pvpStr establecido en ${pvp / minuts} min`)
        notifyTimers.set('pvp', timer);
    }; if (!notifyTimers.has('pvp')) pvpStr();
    /* ===== quest ===== */
    const questStr = () => {
        if (notifyTimers.has('quest')) notifyTimers.delete('quest');
        const quest = leftTimeConv({ type: 'daily', hours: 4, minutes: 30 });
        const timer = setTimeout(() => { notifyTimers.delete('quest'); notifyKC(cli, 'quest'); }, quest);
        debug(`[KanCron]: questStr establecido en ${quest / minuts} min`)
        notifyTimers.set('quest', timer);
    }; if (!notifyTimers.has('quest')) questStr();
    /* ===== extra operaciones ===== */
    const oemStr = () => {
        const oem = leftTimeConv({ type: 'monthly', targetDay: 1, hours: 0, minutes: 0 });
        if (oem > (24 * 60 * minuts)) return;
        if (notifyTimers.has('oem')) notifyTimers.delete('oem');
        const delay = Math.max(0, oem - (60 * minuts));
        const timer = setTimeout(() => { notifyTimers.delete('oem'); notifyKC(cli, 'oem'); }, delay);
        debug(`[KanCron]: oemStr establecido en ${delay / minuts} min`)
        notifyTimers.set('oem', timer);
    }; if (!notifyTimers.has('oem')) oemStr();
    /* ===== expediciones mensuales ===== */
    const mExpStr = () => {
        if (notifyTimers.has('mExp')) notifyTimers.delete('mExp');
        const mExp = leftTimeConv({ type: 'monthly', targetDay: 15, hours: 12, minutes: 0 });
        if (mExp > (24 * 60 * minuts)) return;
        const delay = Math.max(0, mExp - (60 * minuts));
        const timer = setTimeout(() => { notifyTimers.delete('mExp'); notifyKC(cli, 'mExp'); }, delay);
        debug(`[KanCron]: mExpStr establecido en ${delay / minuts} min`)
        notifyTimers.set('mExp', timer);
    }; if (!notifyTimers.has('mExp')) mExpStr();
}

// ========================================================= Main ========================================================= //
interface msgBuild { ch: TextChannel, rol: Role | null, type: notifyType }
interface msgSend { ch: TextChannel, title: string, fields: any[], desc: string, pic: string | undefined, roleContent: string | undefined, color: number, url: string | undefined }
const chkType = new Map<notifyType, (cfg: any) => boolean>([
    ['pvp', cfg => cfg.pvp.av], ['quest', cfg => cfg.quest.av], ['oem', cfg => cfg.oem.av], ['mExp', cfg => cfg.mExp.av],
    ['newMante', cfg => cfg.mnt.av], ['maintStart', cfg => cfg.mnt.av], ['mntEnd', cfg => cfg.mnt.av]]);

const chkRole = new Map<notifyType, (cfg: any) => boolean>([
    ['pvp', cfg => cfg.pvp.ntf], ['quest', cfg => cfg.quest.ntf], ['oem', cfg => cfg.oem.ntf], ['mExp', cfg => cfg.mExp.ntf],
    ['newMante', cfg => cfg.mnt.ntf], ['maintStart', cfg => cfg.mnt.ntf], ['mntEnd', cfg => cfg.mnt.ntf]]);
/* === Core === */
async function notifyKC(cli: Client, type: notifyType) {
    for (const [guildId, configs] of data.entries()) {
        for (const cfg of configs) {
            const check = chkType.get(type), checkRol = chkRole.get(type)
            if (!check || !check(cfg)) continue;
            try {
                const guild = await cli.guilds.fetch(guildId).catch(() => null);
                if (!guild) continue;
                const channel = await guild.channels.fetch(cfg.channel).catch(() => null);
                if (!channel || !channel.isTextBased()) continue;
                const txtCh = channel as TextChannel;
                let chkRol: Role | null = null;
                if (cfg.role && checkRol && checkRol(cfg)) chkRol = await guild.roles.fetch(cfg.role).catch(() => null)
                msgMgr({ ch: txtCh, rol: chkRol, type: type })
            } catch (err) { error(`Error al notificar: ${guildId} ${err}`); }
        }
    }
}
/* === msgManager === */
async function msgMgr(dat: msgBuild) {
    const prst = rawPreset(dat.type);
    if (!prst) return;

    const msgSnd = async (dta: msgSend) => {
        try {
            const emb = new EmbedBuilder().setColor(dta.color).setTitle(dta.title).setDescription(dta.desc);
            if (dta.pic) emb.setImage(dta.pic); if (dta.url) emb.setURL(dta.url); if (dta.fields && dta.fields.length > 0) emb.addFields(dta.fields);
            const msg = await dta.ch.send({ content: dta.roleContent, embeds: [emb] });
            if (dat.type !== "newMante" && msg.deletable) { setTimeout(() => { msg.delete().catch(err => error(`Error al borrar msg: ${err}`, "KanCron")) }, 10 * minuts); }
        } catch (e) { error(`Error enviando notificación: ${e}`, "KanCron"); }
    }

    const rMnt = dat.rol ? `AVISO: ${dat.rol}!` : undefined;
    await msgSnd({ ch: dat.ch, title: prst.title.A, fields: prst.field, desc: prst.desc.ini, pic: prst.urlPic.A, roleContent: rMnt, color: 0xFFA500, url: prst.url });
    if (prst.ntfy.ntf_30 && prst.mTimmer > (30 * minuts)) {
        setTimeout(async () => {
            await msgSnd({ ch: dat.ch, title: prst.title.A, fields: [], desc: prst.desc.l30, pic: prst.urlPic.A, roleContent: undefined, color: 0xFFA500, url: prst.url });
        }, prst.mTimmer - (30 * minuts));
    }
    if (prst.ntfy.ntf_15 && prst.mTimmer > (15 * minuts)) {
        setTimeout(async () => {
            await msgSnd({ ch: dat.ch, title: prst.title.A, fields: [], desc: prst.desc.l15, pic: prst.urlPic.A, roleContent: undefined, color: 0xFFA500, url: prst.url });
        }, prst.mTimmer - (15 * minuts));
    }
    if (prst.ntfy.ntf_end && prst.mTimmer > 0) {
        setTimeout(async () => {
            await msgSnd({ ch: dat.ch, title: prst.title.B, fields: [], desc: prst.desc.fn, pic: prst.urlPic.B, roleContent: rMnt, color: 0x00AA00, url: prst.url });
        }, prst.mTimmer);
    }
}

// ========================================================= fetchMaint ========================================================= //
export let ntfMantData: ntfMant = { MaintDate: null, endMantDate: null, url: null };
interface ntfMant { MaintDate: Date | null, endMantDate: Date | null, url: string | null; };
interface dataGit { MaintInfoLink: string, MaintStart: string, MaintEnd?: string }
async function mantChk(cli: Client) {
    const gitData = "https://raw.githubusercontent.com/ElectronicObserverEN/Data/refs/heads/master/update.json";
    let chkData;
    try { chkData = await fetch(gitData); }
    catch (e) { error(`❌ Error de red al obtener JSON: ${e}`, "KancolleBD"); return }

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
        notifyKC(cli, "newMante")
        maint.maintNotified = true;
        await updateKCmant({ lastMaintStart: newMaintDate, maintNotified: true, lastNotificationTime: new Date(), MaintEnd: endMantDate });
    }
    if (!kcTimmers.has(idStart) || !kcTimmers.has(idEnd)) startMant(cli);
}

// ===== notifyMaint ===== //
async function startMant(cli: Client) {
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
                    notifyKC(cli, idStart);
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
                        notifyKC(cli, idEnd);
                        kcTimmers.delete(idEnd);
                    }, leftEnd);
                    kcTimmers.set(idEnd, endoMeinto);
                }
            }
        }
    } catch (e) { error(`Error al programar temporizadores de mantenimiento: ${e}`, "KancolleBD"); }
}

// ========================================================= Euxiliares ========================================================= //
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

