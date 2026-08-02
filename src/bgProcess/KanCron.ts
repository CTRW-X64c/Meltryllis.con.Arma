//import * as cron from 'node-cron';
import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { debug, error, info } from '../sys/logging';
import { startKC, data, maint, updateKCmant, kcheMaint } from '../sys/DB-Engine/links/KancolleBD';
import { getNowJST, JSTtoUTC, sendMSG } from './KanSend';

let kcTimmers = new Map<string, NodeJS.Timeout>();
const TZjp = 'Asia/Tokyo';
const minuts = 60 * 1_000;
const idStart = `maintStart`, idEnd = `mntEnd`;

// ========================================================= Init ========================================================= //
export async function initKC(clnt: Client) {
    let inf = "[Kancolle] Se inicio el servicio:";
    const x = await startKC(), y = await kcheMaint();
    if (x) {
        cronKC(clnt)
        setInterval(() => cronKC(clnt), 120 * minuts)
        inf += "> Avisos!!";
    }
    if (y) {
        mantChk(clnt)
        setInterval(() => mantChk(clnt), 20 * minuts)
        inf += "> Mantenimientos";
    }
    info(inf)
}

export type notifyType = 'pvp' | 'quest' | `oem` | `mExp` | `maintStart` | 'mntEnd';
let notifyTimers = new Map<notifyType, NodeJS.Timeout>();
async function cronKC(clnt: Client) {
    // =========================== pvp =========================== //
    const pvpStr = () => {
        if (notifyTimers.has('pvp')) notifyTimers.delete('pvp');
        const pvp = leftTimeConv({ type: 'daily', hours: [2, 14], minutes: 30 });
        const timer = setTimeout(() => { notifyTimers.delete('pvp'); notifyKC(clnt, 'pvp'); }, pvp);
        debug(`pvpStr establecido para ${pvp} fecha ${turnDate(pvp)}`)
        notifyTimers.set('pvp', timer);
    };
    if (!notifyTimers.has('pvp')) pvpStr();
    // =========================== quest =========================== //
    const questStr = () => {
        if (notifyTimers.has('quest')) notifyTimers.delete('quest');
        const quest = leftTimeConv({ type: 'daily', hours: 4, minutes: 30 });
        const timer = setTimeout(() => { notifyTimers.delete('quest'); notifyKC(clnt, 'quest'); }, quest);
        debug(`questStr establecido para ${quest} fecha ${turnDate(quest)}`)
        notifyTimers.set('quest', timer);
    };
    if (!notifyTimers.has('quest')) questStr();
    // =========================== extra operaciones =========================== //
    const oemStr = () => {
        const oem = leftTimeConv({ type: 'monthly', targetDay: 1, hours: 0, minutes: 0 });
        if (oem > (24 * 60 * minuts)) return;
        if (notifyTimers.has('oem')) notifyTimers.delete('oem');
        const delay = Math.max(0, oem - (30 * minuts));
        const timer = setTimeout(() => { notifyTimers.delete('oem'); notifyKC(clnt, 'oem'); }, delay);
        debug(`oemStr establecido para ${delay} fecha ${turnDate(delay)}`)
        notifyTimers.set('oem', timer);
    };
    if (!notifyTimers.has('oem')) oemStr();
    // =========================== expediciones mensuales =========================== //
    const mExpStr = () => {
        if (notifyTimers.has('mExp')) notifyTimers.delete('mExp');
        const mExp = leftTimeConv({ type: 'monthly', targetDay: 15, hours: 12, minutes: 0 });
        if (mExp > (24 * 60 * minuts)) return;
        const delay = Math.max(0, mExp - (30 * minuts));
        const timer = setTimeout(() => { notifyTimers.delete('mExp'); notifyKC(clnt, 'mExp'); }, delay);
        debug(`mExpStr establecido para ${delay} fecha ${turnDate(delay)}`)
        notifyTimers.set('mExp', timer);
    };
    if (!notifyTimers.has('mExp')) mExpStr();
}

// ========================================================= Main ========================================================= //
const chkType = new Map<notifyType, (cfg: any) => boolean>([
    ['pvp', cfg => cfg.pvp], ['quest', cfg => cfg.quest], ['oem', cfg => cfg.oem], ['mExp', cfg => cfg.mExp],
    ['maintStart', cfg => cfg.mnt], ['mntEnd', cfg => cfg.mnt]]);

async function notifyKC(client: Client, type: notifyType) {
    for (const [guildId, configs] of data.entries()) {
        for (const cfg of configs) {
            const check = chkType.get(type);
            if (!check || !check(cfg)) continue;

            try {
                const guild = await client.guilds.fetch(guildId).catch(() => null);
                if (!guild) continue;
                const channel = await guild.channels.fetch(cfg.channel).catch(() => null);
                if (!channel || !channel.isTextBased()) continue;
                const txtCh = channel as TextChannel, chkRol = cfg.role ? await guild.roles.fetch(cfg.role).catch(() => null) : null;
                sendMSG({ ch: txtCh, rol: chkRol, type: type })
            } catch (err) { error(`Error al notificar: ${guildId} ${err}`); }
        }
    }
}

// ========================================================= fetchMaint ========================================================= //
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
        const tokyoDate = getNowJST(), INItime = JSTtoUTC(newMaintDate), ENDtime = JSTtoUTC(endMantDate);
        const left2start = INItime ? turnDate(INItime.getTime() - tokyoDate) : "TBA"
        const lef2end = ENDtime ? turnDate(ENDtime.getTime() - tokyoDate) : "TBA";
        const emb = new EmbedBuilder()
            .setTitle('🔧 ¡Aviso de Mantenimiento!')
            .setDescription(`Se ha anunciado un nuevo mantenimiento \n ***Fechas en JST / UTC +9***`)
            .setColor('#FFA500');
        if (processData.MaintInfoLink) emb.setURL(processData.MaintInfoLink)
        const endIniStr = newMaintDate.toLocaleString("es-MX", { hour12: false, timeStyle: 'short', dateStyle: 'medium' });
        const endDateStr = endMantDate ? endMantDate.toLocaleString("es-MX", { hour12: false, timeStyle: 'short', dateStyle: 'medium' }) : "TBA";
        emb.addFields(
            { name: '> INICIO: \n', value: `📅 \`${endIniStr} hrs\` \n⏰ \`${left2start}\`` },
            { name: '> TERMINO: \n', value: `📅  \`${endDateStr} hrs\` \n⏰ \`${lef2end}\`` });
        for (const [guildId, configs] of data.entries()) {
            for (const cfg of configs) {
                if (!cfg.mnt) continue;

                const guild = await C.guilds.fetch(guildId).catch(() => null);
                if (!guild) continue;

                const channel = await guild.channels.fetch(cfg.channel).catch(() => null);
                if (!channel || !channel.isTextBased()) continue;
                const txtCh = channel as TextChannel;
                const chkRol = cfg.role ? await guild.roles.fetch(cfg.role).catch(() => null) : null;

                chkRol ? await txtCh.send({ content: `AVISO: ${chkRol}!`, embeds: [emb] }).catch(() => { }) : await txtCh.send({ embeds: [emb] }).catch(() => { });
            }
        }
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

        if (leftStart > 0) {
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
                if (leftEnd > 0) {
                    const endoMeinto = setTimeout(() => {
                        notifyKC(C, idEnd);
                        kcTimmers.delete(idEnd);
                    }, leftEnd);
                    kcTimmers.set(idEnd, endoMeinto);
                }
            }
        }
    } catch (e) {
        error(`Error al programar temporizadores de mantenimiento: ${e}`, "KancolleBD");
    }
}

// ========================================================= Euxiliares ========================================================= //
type timSlap = 'daily' | 'weekly' | 'monthly' | 'quarterly';
interface timeData { type: timSlap; hours: number | number[]; minutes?: number; targetDay?: number; targetMonths?: number[]; }
// === lefTime === //
export function leftTime() {
    // ultimo dia del mes
    const now = new Date(); const jpDate = new Date(now.toLocaleString('en-US', { timeZone: TZjp }));
    const lastday = new Date(jpDate.getFullYear(), jpDate.getMonth() + 1, 0).getDate();
    // Reglas mes: 1-31; Semana: domingo = 0 - sabado = 6, def= 1 lunes (1); Minutos: 0-59 def 0
    const pvpCount = leftTimeConv({ type: 'daily', hours: [3, 15] });
    const pvp3hrs = leftTimeConv({ type: 'daily', hours: 3 });
    const pvp15hrs = leftTimeConv({ type: 'daily', hours: 15 });
    const dQuestCount = leftTimeConv({ type: 'daily', hours: 5 });
    const wQuestCount = leftTimeConv({ type: 'weekly', targetDay: 1, hours: 5 });
    const mQuestCount = leftTimeConv({ type: 'monthly', targetDay: 1, hours: 5 });
    const qQuestCount = leftTimeConv({ type: 'quarterly', targetDay: 1, hours: 5 })
    const oemCount = leftTimeConv({ type: 'monthly', targetDay: 1, hours: 0 });
    const dPtCutof = leftTimeConv({ type: 'daily', hours: [2, 14] });
    const mPtCutof = leftTimeConv({ type: 'monthly', targetDay: lastday, hours: 22 });
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
        target.setDate(opts.targetDay || 1);
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
            target.setDate(opts.targetDay || 1);
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
            target.setDate(opts.targetDay || 1);
            target.setHours(opts.hours as number);
        }
    }
    return target.getTime() - nowTime;;
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

