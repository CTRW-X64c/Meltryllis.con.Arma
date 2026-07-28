import * as cron from 'node-cron';
import { Client, EmbedBuilder, Message, Role, TextChannel } from 'discord.js';
import { debug, error, info } from '../sys/logging';
import { startKC, data, maint, updateKCmant, kcheMaint } from '../sys/DB-Engine/links/KancolleBD';
import i18next from 'i18next';

const TZjp = 'Asia/Tokyo';
const minuts = 60 * 1_000;
const id1h = `1hMaint-Notify`, id15m = `15mMaint-Notify`, idEnd = `maintEnd`;

// ========================================================= Init ========================================================= //
export async function initKC(C: Client) {
    let inf = "Algo fallo, no se pudieron iniciar los servicios de Kancolle";
    const x = await startKC(), y = await kcheMaint();
    if (x) {
        cronKC(C)
        inf = "Se inicio unicamente el modulo Cron de Kancolle!"
        if (y) {
            mantChk(C);
            setInterval(() => mantChk(C), 15 * minuts)
            inf = "Se inciaron todos los modulos de Kancolle"
            notifyKC(C, 'pvp');
            notifyKC(C, 'quest');
            notifyKC(C, 'oem');
            notifyKC(C, 'mntStart1h');
            notifyKC(C, 'mntStart15m');
            notifyKC(C, 'mntEnd');
        }
    } info(inf)
}

async function cronKC(client: Client) {
    const cronOpt = { timezone: TZjp };
    cron.schedule('40 2,14 * * *', async () => { await notifyKC(client, 'pvp'); }, cronOpt); // PvP (03:00 JST y 15:00 JST) 
    cron.schedule('40 4 * * *', async () => { await notifyKC(client, 'quest'); }, cronOpt); // Daily (05:00 JST todos los días)
    cron.schedule('30 23 1 * *', async () => { await notifyKC(client, 'oem'); }, cronOpt); // OEM (00:00 JTS Dia primero del mes)
}

// ========================================================= Main ========================================================= //
type notifyType = 'pvp' | 'quest' | `oem` | `mntStart1h` | `mntStart15m` | 'mntEnd';
const chkType = new Map<notifyType, (cfg: any) => boolean>([
    ['pvp', cfg => cfg.pvp], ['quest', cfg => cfg.quest], ['oem', cfg => cfg.oem],
    ['mntStart1h', cfg => cfg.mnt], ['mntStart15m', cfg => cfg.mnt], ['mntEnd', cfg => cfg.mnt]]);

async function notifyKC(client: Client, type: notifyType) {
    for (const [guildId, configs] of data.entries()) {
        for (const cfg of configs) {
            const check = chkType.get(type);
            if (!check || !check(cfg)) continue;

            try {
                let title = "", desc = "", uTitle = "", uDesc = "", pic = "https://i.imgur.com/sInDmjs.jpeg", color = 0xFFA500, rTime: number, fields: { name: string; value: string; inline?: boolean }[] = [];
                const guild = await client.guilds.fetch(guildId).catch(() => null);
                if (!guild) continue;
                const channel = await guild.channels.fetch(cfg.channel).catch(() => null);
                if (!channel || !channel.isTextBased()) continue;
                const txtCh = channel as TextChannel, tx = aQuest(), rst = leftTime(), chkRol = cfg.role ? await guild.roles.fetch(cfg.role).catch(() => null) : null;
                const vlueTxt = i18next.t("commands:kancolle.bgProsses.siwtchNotify_vText", { a1: rst.pvp, a2: rst.oem, a3: rst.mExp, a4: rst.dQuest, a5: rst.wQuest, a6: rst.mQuest, a7: rst.qQuest, a8: rst.dPtCutof, a9: rst.mPtCutof });

                switch (type) {
                    case 'pvp':
                        rTime = 20;
                        title = i18next.t("commands:kancolle.bgProsses.siwtchNotify_pvp_title");
                        desc = i18next.t("commands:kancolle.bgProsses.siwtchNotify_pvp_desc");
                        fields = [{ name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_pvp_field_A"), value: vlueTxt },];
                        pic = "https://i.imgur.com/rhaHOhq.png";
                        uTitle = i18next.t("commands:kancolle.bgProsses.siwtchNotify_pvp_uTitle");
                        uDesc = i18next.t("commands:kancolle.bgProsses.siwtchNotify_pvp_uDesc");
                        break;
                    case 'quest':
                        rTime = 20;
                        title = i18next.t("commands:kancolle.bgProsses.siwtchNotify_quest_title");
                        desc = i18next.t("commands:kancolle.bgProsses.siwtchNotify_quest_desc", { a1: rTime });
                        fields = [
                            { name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_quest_field_A"), value: tx },
                            { name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_quest_field_B"), value: vlueTxt },
                        ];
                        pic = "https://i.imgur.com/pJZdK4i.jpeg";
                        uTitle = i18next.t("commands:kancolle.bgProsses.siwtchNotify_quest_uTitle");
                        uDesc = i18next.t("commands:kancolle.bgProsses.siwtchNotify_quest_uDesc", { a1: tx });
                        break;
                    case `oem`:
                        rTime = 30;
                        title = i18next.t("commands:kancolle.bgProsses.siwtchNotify_oem_title");
                        desc = i18next.t("commands:kancolle.bgProsses.siwtchNotify_oem_desc", { a1: rTime });
                        fields = [{ name: i18next.t("commands:kancolle.bgProsses.siwtchNotify_oem_field_A"), value: vlueTxt },];
                        pic = "https://i.imgur.com/72A2KNE.png";
                        uTitle = i18next.t("commands:kancolle.bgProsses.siwtchNotify_oem_uTitle");
                        uDesc = i18next.t("commands:kancolle.bgProsses.siwtchNotify_oem_uDesc");
                        break;
                    case `mntStart1h`:
                        rTime = 30;
                        title = i18next.t("commands:kancolle.bgProsses.siwtchNotify_1h_title");
                        desc = i18next.t("commands:kancolle.bgProsses.siwtchNotify_1h_desc");
                        uTitle = i18next.t("commands:kancolle.bgProsses.siwtchNotify_1h_uTitle");
                        uDesc = i18next.t("commands:kancolle.bgProsses.siwtchNotify_1h_uDesc");
                        break;
                    case `mntStart15m`:
                        rTime = 15;
                        title = i18next.t("commands:kancolle.bgProsses.siwtchNotify_15m_title");
                        desc = i18next.t("commands:kancolle.bgProsses.siwtchNotify_15m_desc");
                        uTitle = i18next.t("commands:kancolle.bgProsses.siwtchNotify_15m_uTitle");
                        uDesc = i18next.t("commands:kancolle.bgProsses.siwtchNotify_15m_uDesc");
                        break;
                    case 'mntEnd':
                        rTime = 5;
                        title = i18next.t("commands:kancolle.bgProsses.siwtchNotify_end_title");
                        desc = i18next.t("commands:kancolle.bgProsses.siwtchNotify_end_desc");
                        uTitle = i18next.t("commands:kancolle.bgProsses.siwtchNotify_end_uTitle");
                        uDesc = i18next.t("commands:kancolle.bgProsses.siwtchNotify_end_uDesc");
                        break;
                }

                const emb = new EmbedBuilder().setTitle(title).setColor(color).setImage(pic).setDescription(desc)
                if (fields.length > 0) emb.addFields(fields);
                let omsg: Message;
                chkRol ? omsg = await txtCh.send({ content: `AVISO: ${chkRol}!`, embeds: [emb] }) : omsg = await txtCh.send({ embeds: [emb] });

                const uEmb = new EmbedBuilder().setTitle(uTitle).setDescription(uDesc).setColor(color);
                const delTimmer = rTime * minuts, id = `${guildId}-${type}`;
                folloNotify(txtCh, omsg, uEmb, id, delTimmer, chkRol);
            } catch (err) { error(`Error al notificar: ${guildId} ${err}`); }
        }
    }
}


// ===== eraser ===== //
let kcTimmers = new Map<string, NodeJS.Timeout>();
function folloNotify(ch: TextChannel, oldMsg: Message, emb: EmbedBuilder, timerId: string, delay: number, role: Role | null) {
    if (kcTimmers.has(timerId)) clearTimeout(kcTimmers.get(timerId)!);
    const mainTimer = setTimeout(async () => {
        await oldMsg.delete().catch(() => { });
        let newMsg: Message | null = null;
        if (role) newMsg = await ch.send({ content: `AVISO: ${role}!`, embeds: [emb] }).catch(() => null);
        else newMsg = await ch.send({ embeds: [emb] }).catch(() => null);
        kcTimmers.delete(timerId);
        if (newMsg) {
            const delTimerId = `B-${timerId}`;
            const destroyTimer = setTimeout(() => {
                newMsg.delete().catch(() => { });
                kcTimmers.delete(delTimerId);
            }, 5 * minuts);
            kcTimmers.set(delTimerId, destroyTimer);
        }
    }, delay);
    kcTimmers.set(timerId, mainTimer);
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
    const lastMantTime = maint.lastMaintStart ? maint.lastMaintStart.getTime() : null;
    const newMantTime = newMaintDate.getTime();
    // endManteTimes
    const endMantDate = newMaintEndStr ? new Date(newMaintEndStr) : null;
    const lastEndTime = maint.MaintEnd ? maint.MaintEnd.getTime() : null;
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
        const left2start = turnDate(newMaintDate.getTime() - Date.now());
        const emb = new EmbedBuilder()
            .setTitle('🔧 ¡Aviso de Mantenimiento!')
            .setDescription(`Se ha anunciado un nuevo mantenimiento \n\n📅 **Inicio:** \`${newMaintStartStr}\` \n⏰ **Inicia en:** \`${left2start}\``)
            .setColor('#FFA500');
        if (processData.MaintInfoLink) emb.setURL(processData.MaintInfoLink)
        if (processData.MaintEnd) { emb.addFields({ name: 'Termina:', value: `\`${processData.MaintEnd}\`` }); }
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
    if (!kcTimmers.has(id1h) || !kcTimmers.has(id15m) || !kcTimmers.has(idEnd)) startMant(C);
}

// ===== notifyMaint ===== //
async function startMant(C: Client) {
    try {
        if (!maint.lastMaintStart) return;
        const now = Date.now();
        const maintStart = maint.lastMaintStart.getTime();
        const leftStart = maintStart - now;
        const HORA = 60 * minuts;

        if (leftStart > 0) {
            if (leftStart > HORA && !kcTimmers.has(id1h)) {
                const timer1h = setTimeout(() => {
                    notifyKC(C, `mntStart1h`);
                    kcTimmers.delete(id1h);
                }, leftStart - HORA);
                kcTimmers.set(id1h, timer1h);
            }

            if (leftStart > (15 * minuts) && !kcTimmers.has(id15m)) {
                const timer15m = setTimeout(() => {
                    notifyKC(C, `mntStart15m`);
                    kcTimmers.delete(id15m);
                }, leftStart - (15 * minuts));
                kcTimmers.set(id15m, timer15m);
            }
        }

        if (maint.MaintEnd && !kcTimmers.has(idEnd)) {
            const maintEndMs = new Date(maint.MaintEnd).getTime();
            const leftEnd = maintEndMs - now;
            if (leftEnd > 0) {
                const endoMeinto = setTimeout(() => {
                    notifyKC(C, `mntEnd`);
                    kcTimmers.delete(idEnd);
                }, leftEnd);
                kcTimmers.set(idEnd, endoMeinto);
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

function leftTimeConv(opts: timeData): number {
    const now = new Date();
    const tokyoDate = new Date(now.toLocaleString('en-US', { timeZone: TZjp }));
    const nowTime = tokyoDate.getTime();

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

// === misiones === //
function aQuest() {
    const now = new Date();
    const tokyoDate = new Date(now.toLocaleString('en-US', { timeZone: TZjp }));
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

