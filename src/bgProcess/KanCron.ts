// src/bgProcess/KanCron.ts
import { Client, EmbedBuilder, GuildTextBasedChannel, Message, Role } from 'discord.js';
import { debug, error, info } from '../sys/logging';
import { startKC, data, kcheMaint, kchTempMSg, loadKchMsg, delKchTemp, delBD } from '../sys/DB-Engine/links/KancolleBD';
import { leftTimeConv, mantChk, rawPreset } from "../sys/zGears/kc_aux";
import { stillOn } from '../sys/zGears/auxiliares';

let CLIENTE: Client | null = null;
const minuts = 60 * 1_000;
const hours = 60 * minuts;

// ========================================================= Init ========================================================= //
export async function initKC(cli: Client) {
    let inf = "[Kancolle] Se inicio el servicio:";
    CLIENTE = cli;
    if (!CLIENTE) { inf = "[Kancolle] FALLO EL INICIO DE LOS SERVICIOS DE KANCOLLE!! (No cliente!)"; return }
    else {
        const z = await loadingKc(), x = await startKC(), y = await kcheMaint();
        if (z) {
            if (x) {
                timmerAv()
                setInterval(() => timmerAv(), 120 * minuts)
                inf += " > Avisos < ";
            }
            if (y) {
                mantChk()
                setInterval(() => mantChk(), 10 * minuts)
                inf += " > Mantenimientos < ";
            }
        }
    } info(inf)
};

// ========================================================= engineTimmers ========================================================= //
export type notifyType = 'pvp' | 'quest' | 'lQuest' | 'oem' | 'loem' | 'mExp' | 'lmExp' | 'newMante' | 'maintStart' | 'mntEnd';
let notifyTimers = new Map<notifyType, NodeJS.Timeout>();
async function timmerAv() {
    /* =============== pvp =============== */
    const pvpStr = () => { teki("pvp") };
    if (!notifyTimers.has('pvp')) pvpStr();
    /* =============== quest =============== */
    const questStr = () => { teki("quest") };
    if (!notifyTimers.has('quest')) questStr();
    // // qQuest
    const qQuestStr = () => { teki("lQuest", true) };
    if (!notifyTimers.has('lQuest')) qQuestStr();
    /* =============== oem =============== */
    const oemStr = () => { teki("oem") };
    if (!notifyTimers.has('oem')) oemStr();
    // // longOem
    const oemLong = () => { teki("loem", true) };
    if (!notifyTimers.has('loem')) oemLong();
    /* =============== mExp =============== */
    const mExpStr = () => { teki("mExp") };
    if (!notifyTimers.has('mExp')) mExpStr();
    // // long mExp
    const mExpLong = () => { teki("lmExp", true) };
    if (!notifyTimers.has('lmExp')) mExpLong();
}
// === setTimmers === //
function teki(tpy: notifyType, long?: boolean) {
    let toChk: number;
    switch (tpy) {
        case 'pvp': { toChk = leftTimeConv({ type: 'daily', hours: [3, 15], minutes: 0 }); break };
        case 'quest': { toChk = leftTimeConv({ type: 'daily', hours: 5, minutes: 0 }); break };
        case 'lQuest': { toChk = leftTimeConv({ type: 'monthly', targetDay: 1, hours: 5, minutes: 0 }); break };
        case 'oem': case 'loem': { toChk = leftTimeConv({ type: 'monthly', targetDay: 1, hours: 0, minutes: 0 }); break };
        case 'mExp': case 'lmExp': { toChk = leftTimeConv({ type: 'monthly', targetDay: 15, hours: 12, minutes: 0 }); break };
        default: { error(`[KanCron]: Tipo introducido sin parametro: ${tpy}`); return }
    }
    if (toChk > 30 * hours) return;
    toChk = long ? Math.max(0, toChk - (24 * hours)) : Math.max(0, toChk - hours);
    if (toChk <= 0 || toChk < 4) { debug(`[KanCron]: ${tpy} Paso horario de notificacion`); return }
    const timer = setTimeout(() => { notifyTimers.delete(tpy); notifyKC(tpy); }, toChk);
    notifyTimers.set(tpy, timer);
    debug(`[KanCron]: Establecido ${tpy} en ${Math.round(toChk / minuts)} min`)
}

// ========================================================= Main ========================================================= //
const chkType = new Map<notifyType, (cfg: any) => boolean>([
    ['pvp', cfg => cfg.pvp.av], /*QUEST*/['quest', cfg => cfg.quest.av], ['lQuest', cfg => cfg.quest.av],
    /*OEM*/['oem', cfg => cfg.oem.av], ['loem', cfg => cfg.oem.av],
    /*EXP*/['mExp', cfg => cfg.mExp.av], ['lmExp', cfg => cfg.mExp.av],
    /*Mante*/['newMante', cfg => cfg.mnt.av], ['maintStart', cfg => cfg.mnt.av], ['mntEnd', cfg => cfg.mnt.av]]);

const chkRole = new Map<notifyType, (cfg: any) => boolean>([
    ['pvp', cfg => cfg.pvp.ntf], /*QUEST*/['quest', cfg => cfg.quest.ntf], ['lQuest', cfg => cfg.quest.ntf],
    /*OEM*/['oem', cfg => cfg.oem.ntf], ['loem', cfg => cfg.oem.ntf],
    /*EXP*/['mExp', cfg => cfg.mExp.ntf], ['lmExp', cfg => cfg.mExp.ntf],
    /*Mante*/['newMante', cfg => cfg.mnt.ntf], ['maintStart', cfg => cfg.mnt.ntf], ['mntEnd', cfg => cfg.mnt.ntf]]);

/* === Core === */
export async function notifyKC(type: notifyType) {
    if (data.size === 0) return;
    for (const [guildId, configs] of data.entries()) {
        for (const cfg of configs) {
            const check = chkType.get(type), checkRol = chkRole.get(type)
            if (!check || !check(cfg)) continue;
            try {
                let chkRol: Role | null = null, channel: GuildTextBasedChannel;
                const chkSout = await stillOn({ cli: CLIENTE!, chkChID: cfg.channel, chkGuiId: cfg.guild, roley: cfg.role });
                if (!chkSout.ok) {
                    if (chkSout.erase) { delBD(cfg.guild).catch((ex: any) => { debug(`Error al borrar el feed ${cfg.guild}: ${ex.message}`, "KanCron") }); }
                    debug(`${chkSout.msg}`, "KanCron");
                    continue;
                }
                else {
                    channel = chkSout.canale as GuildTextBasedChannel;
                    if (cfg.role && !chkSout.rolito) { cfg.role = null }
                    else if (cfg.role && checkRol && checkRol(cfg)) chkRol = chkSout.rolito
                }
                msgMgr({ ch: channel, rol: chkRol, type: type }).catch(err => error(`[${type}] ${guildId}: ${err}`, "KanCron"));
            } catch (err) { error(`Error al notificar: ${guildId} ${err}`); }
        }
    }
}

// ========================================================= OutNotify ========================================================= //
interface msgBuild { ch: GuildTextBasedChannel, rol: Role | null, type: notifyType }
interface msgSend {
    ch: GuildTextBasedChannel,
    title: string,
    fields: { name: string, value: string, inline?: boolean }[],
    desc: string,
    pic: string | undefined,
    rolOn: string | undefined,
    color: number,
    url: string | undefined,
    delAft: number
}
/* === kchs === */
interface cachedMsg { msgId: string, chId: string }
const msgkch = new Map<string, cachedMsg>();
const msgEpoch = new Map<string, number>();
const outErase = new Map<string, NodeJS.Timeout>();

/* === loadKchs === */
async function loadingKc(): Promise<boolean> {
    const tempKche = await loadKchMsg();
    if (tempKche.length === 0) return true;
    for (const kChe of tempKche) {
        try {
            const guild = await CLIENTE!.guilds.fetch(kChe.guild_id).catch(() => null);
            const rawCh = guild ? await guild.channels.fetch(kChe.id_ch).catch(() => null) : null;
            const channel = rawCh && rawCh.isTextBased() ? rawCh as GuildTextBasedChannel : null;

            if (kChe.sup_time.getTime() <= Date.now()) {
                if (channel) {
                    const oldMsg = await channel.messages.fetch(kChe.id_msg).catch(() => null);
                    if (oldMsg) await oldMsg.delete().catch(e => error(`Error borrando msg vencido [${kChe.id_key}]: ${e}`, "KanCron"));
                }
                await delKchTemp(kChe.id_key, kChe.guild_id).catch(e => error(`Error delKchTemp [${kChe.id_key}]: ${e}`, "KanCron"));
                continue;
            }

            if (!channel) {
                await delKchTemp(kChe.id_key, kChe.guild_id).catch(() => { });
                continue;
            }

            msgkch.set(kChe.id_key, { msgId: kChe.id_msg, chId: kChe.id_ch });
            const t = setTimeout(async () => {
                const retMsg = await channel.messages.fetch(kChe.id_msg).catch(() => null);
                if (retMsg) await retMsg.delete().catch(e => error(`Error borrando msg [${kChe.id_key}]: ${e}`, "KanCron"));
                await delKchTemp(kChe.id_key, kChe.guild_id).catch(e => error(`Error delKchTemp [${kChe.id_key}]: ${e}`, "KanCron"));
                msgkch.delete(kChe.id_key);
                outErase.delete(kChe.id_key);
            }, kChe.sup_time.getTime() - Date.now());
            outErase.set(kChe.id_key, t);
        } catch (err) {
            error(`Error recuperando [${kChe.id_key}]: ${err}`, "KanCron");
            await delKchTemp(kChe.id_key, kChe.guild_id).catch(() => { });
        }
    }
    return true;
}

/* === msgManager === */
async function msgMgr(dat: msgBuild) {
    const prst = rawPreset(dat.type);
    if (!prst) return;

    const key = `${dat.ch.guildId}-${dat.type}`;
    const myEpoch = (msgEpoch.get(key) ?? 0) + 1;
    msgEpoch.set(key, myEpoch);
    const isStale = () => msgEpoch.get(key) !== myEpoch;

    const msgSnd = async (dta: msgSend) => {
        try {
            const emb = new EmbedBuilder().setColor(dta.color).setTitle(dta.title).setDescription(dta.desc).setFooter({ text: "Kantai Collection", iconURL: "https://upload.wikimedia.org/wikipedia/ru/0/02/Kantai_Collection_logo.png" }).setTimestamp();
            if (dta.pic) emb.setImage(dta.pic);
            if (dta.url) emb.setURL(dta.url);
            if (dta.fields.length > 0) emb.addFields(dta.fields);

            /* Buscar mensaje */
            const reUsed = dat.type !== "newMante";
            let msg: Message | null = null;
            if (reUsed) {
                const cached = msgkch.get(key);
                if (cached) {
                    if (cached.chId === dta.ch.id) {
                        msg = await dta.ch.messages.fetch(cached.msgId).catch(() => null);
                        if (!msg) msgkch.delete(key);
                    } else { msgkch.delete(key); }
                }
            }

            if (msg) {
                try { await msg.edit({ content: dta.rolOn, embeds: [emb] }); }
                catch {
                    msg = await dta.ch.send({ content: dta.rolOn, embeds: [emb] });
                    msgkch.delete(key);
                }
            } else { msg = await dta.ch.send({ content: dta.rolOn, embeds: [emb] }); }

            if (reUsed) msgkch.set(key, { msgId: msg.id, chId: dta.ch.id });

            if (dat.type !== "newMante" && msg.deletable) {
                const target = msg;
                const fire = dta.delAft > 10_000 ? dta.delAft : (prst.mTimmer * 2);
                if (dta.delAft > 10_000) {
                    const prev = outErase.get(key);
                    if (prev) { clearTimeout(prev); outErase.delete(key); }
                    const erase = setTimeout(async () => {
                        await target.delete().catch(e => error(`Error al borrar msg [${dat.type}]: ${e}`, "KanCron"));
                        const cur = msgkch.get(key);
                        if (cur?.msgId === target.id) msgkch.delete(key);
                        outErase.delete(key);
                        delKchTemp(key, dta.ch.guildId).catch(e => error(`Erase temp db [${dat.type}]: ${e}`, "KanCron"));
                    }, fire);
                    outErase.set(key, erase);
                }
                const timeToErase = Date.now() + fire;
                await kchTempMSg({ guild_id: dta.ch.guildId, id_key: key, id_msg: target.id, id_ch: dta.ch.id, sup_time: new Date(timeToErase) });
            }
        } catch (e: any) { error(`Error enviando notificación [${dat.type}]: ${e.message} | ${e.stack}`, "KanCron"); }
    };
    // ==== timmerDelControl ==== //
    let rMnt: string | undefined = undefined, del30 = 0, del15 = 0;
    if (dat.rol) { rMnt = `AVISO: ${dat.rol}!`; del30 = (30 * minuts) - 20_000; del15 = (15 * minuts) - 20_000; }
    if (dat.type === "mntEnd") del30 = hours;
    const preNtfy = (["loem", "lmExp", "qQuest"] as notifyType[]).includes(dat.type);
    if (preNtfy) del30 = 23 * hours;
    /* Now */
    await msgSnd({ ch: dat.ch, title: prst.title.A, fields: prst.field, desc: prst.desc.ini, pic: prst.urlPic.A, rolOn: rMnt, color: 0xFFA500, url: prst.url, delAft: del30 });
    /* 30 min */
    if (prst.ntfy.ntf_30 && prst.mTimmer > (30 * minuts)) {
        setTimeout(async () => {
            if (isStale()) return;
            const p = rawPreset(dat.type);
            if (!p) return;
            await msgSnd({ ch: dat.ch, title: p.title.A, fields: p.field, desc: p.desc.l30, pic: p.urlPic.A, rolOn: rMnt, color: 0xFFA500, url: p.url, delAft: del15 });
        }, prst.mTimmer - (30 * minuts));
    }
    /* 15 min */
    if (prst.ntfy.ntf_15 && prst.mTimmer > (15 * minuts)) {
        setTimeout(async () => {
            if (isStale()) return;
            const p = rawPreset(dat.type);
            if (!p) return;
            await msgSnd({ ch: dat.ch, title: p.title.A, fields: p.field, desc: p.desc.l15, pic: p.urlPic.A, rolOn: rMnt, color: 0xFFA500, url: p.url, delAft: del15 });
        }, prst.mTimmer - (15 * minuts));
    }
    /* Fin */
    if (prst.ntfy.ntf_end && prst.mTimmer > 0) {
        setTimeout(async () => {
            if (isStale()) return;
            const p = rawPreset(dat.type);
            if (!p) return;
            await msgSnd({ ch: dat.ch, title: p.title.B, fields: p.field, desc: p.desc.fn, pic: p.urlPic.B, rolOn: rMnt, color: 0x00AA00, url: p.url, delAft: hours });
        }, prst.mTimmer);
    }
}


