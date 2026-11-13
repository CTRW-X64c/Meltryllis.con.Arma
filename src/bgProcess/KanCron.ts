// src/bgProcess/KanCron.ts
import { Client, EmbedBuilder, GuildTextBasedChannel, Role } from 'discord.js';
import { debug, error, info } from '../sys/logging';
import { startKC, dataKC, kcheMaint, kchTempMSg, loadKchMsg, delKchTemp, delKCBD } from '../sys/DB-Engine/links/KancolleBD';
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
            setInterval(() => chkOldMsg().catch(() => null), 4 * hours)
        }
    } info(inf)
};

// ========================================================= engineTimmers ========================================================= //
export type notifyType = 'pvp' | 'quest' | 'quest24h' | 'oem' | 'oem24h' | 'mExp' | 'mExp24h' | 'rank' | 'verntf' | 'mntAviso' | 'mntStar' | 'mntStar24h' | 'mntEnd';
const notifyTimers = new Map<notifyType, NodeJS.Timeout>();
function timmerAv() {
    const ntfList: notifyType[] = ['pvp', 'quest', 'quest24h', 'oem', 'oem24h', 'mExp', 'mExp24h', 'rank'];
    for (const ntf of ntfList) { if (!notifyTimers.has(ntf)) { teki(ntf) }; }
}

// === setTimmers === //
function teki(tpy: notifyType) {
    let toChk: number;
    switch (tpy) {
        case 'pvp': { toChk = leftTimeConv({ type: 'daily', hours: [3, 15], minutes: 0 }); break };
        case 'quest': { toChk = leftTimeConv({ type: 'daily', hours: 5, minutes: 0 }); break };
        case 'quest24h': { toChk = leftTimeConv({ type: 'monthly', targetDay: 1, hours: 5, minutes: 0 }); break };
        case 'oem': case 'oem24h': { toChk = leftTimeConv({ type: 'monthly', targetDay: 1, hours: 0, minutes: 0 }); break };
        case 'mExp': case 'mExp24h': { toChk = leftTimeConv({ type: 'monthly', targetDay: 15, hours: 12, minutes: 0 }); break };
        case 'rank': { toChk = leftTimeConv({ type: 'daily', hours: [3, 15], minutes: 0 }); break }; //ajustado una hora, se avisa al momento
        default: { error(`[KanCron]: Tipo introducido sin parametro: ${tpy}`); return };
    }
    if (toChk > 30 * hours) return;
    const is24h = tpy.endsWith("24h");
    toChk = is24h ? Math.max(0, toChk - (24 * hours)) : Math.max(0, toChk - hours);
    if (toChk <= 0 || toChk < 4) { debug(`[KanCron]: ${tpy} Paso horario de notificacion`); return };
    const timer = setTimeout(() => { notifyTimers.delete(tpy); notifyKC(tpy).catch((e) => { error(`[KanCron]: Fallo notifyKC: ${tpy} Err: ${e}`) }); }, toChk);
    notifyTimers.set(tpy, timer);
    debug(`[KanCron]: Establecido ${tpy} en ${Math.round(toChk / minuts)} min`);
};

// ========================================================= Main ========================================================= //
const chkType = new Map<notifyType, (cfg: any) => boolean>([
    ['pvp', cfg => cfg.pvp.av], /*QUEST*/['quest', cfg => cfg.quest.av], /*RANK*/['rank', cfg => cfg.rank.av], /*ver*/['verntf', cfg => cfg.rank.av],
    /*OEM*/['oem', cfg => cfg.oem.av], /*EXP*/['mExp', cfg => cfg.mExp.av],
    /*Mante*/['mntAviso', cfg => cfg.mnt.av], ['mntStar', cfg => cfg.mnt.av], ['mntEnd', cfg => cfg.mnt.av],
    /*pre24*/['oem24h', cfg => cfg.oem.av], ['mExp24h', cfg => cfg.mExp.av], ['quest24h', cfg => cfg.quest.av], ['mntStar24h', cfg => cfg.mnt.av]]);

const chkRole = new Map<notifyType, (cfg: any) => boolean>([
    ['pvp', cfg => cfg.pvp.ntf], /*QUEST*/['quest', cfg => cfg.quest.ntf], /*RANK*/['rank', cfg => cfg.rank.ntf], /*ver*/['verntf', cfg => cfg.rank.ntf],
    /*OEM*/['oem', cfg => cfg.oem.ntf], /*EXP*/['mExp', cfg => cfg.mExp.ntf],
    /*Mante*/['mntAviso', cfg => cfg.mnt.ntf], ['mntStar', cfg => cfg.mnt.ntf], ['mntStar24h', cfg => cfg.mnt.ntf], ['mntEnd', cfg => cfg.mnt.ntf]]);

/* === Core === */
export async function notifyKC(type: notifyType) {
    if (dataKC.size === 0) return;
    for (const [guildId, configs] of dataKC.entries()) {
        for (const cfg of configs) {
            const check = chkType.get(type), checkRol = chkRole.get(type)
            if (!check || !check(cfg)) continue;
            try {
                let chkRol: Role | null = null, channel: GuildTextBasedChannel;
                const chkSout = await stillOn({ cli: CLIENTE!, chkChID: cfg.channel, chkGuiId: cfg.guild, roley: cfg.role });
                if (!chkSout.ok) {
                    if (chkSout.erase) { delKCBD(cfg.guild).catch((ex: any) => { debug(`Error al borrar el feed ${cfg.guild}: ${ex.message}`, "KanCron") }); }
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
    title: string,
    fields: { name: string, value: string, inline?: boolean }[],
    desc: string,
    pic: string | undefined,
    rolOn: string | undefined,
    url: string | undefined,
    delAft: number,
    key: string,
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
            const guild = CLIENTE!.guilds.cache.get(kChe.guild_id) ?? await CLIENTE!.guilds.fetch(kChe.guild_id).catch(() => null);
            const rawCh = guild ? (guild.channels.cache.get(kChe.id_ch) ?? await guild.channels.fetch(kChe.id_ch).catch(() => null)) : null;
            const channel = rawCh && rawCh.isTextBased() ? rawCh as GuildTextBasedChannel : null;

            if (kChe.sup_time.getTime() <= Date.now()) {
                if (channel) {
                    const oldMsg = channel.messages.cache.get(kChe.id_msg) ?? await channel.messages.fetch(kChe.id_msg).catch(() => null);
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
                const retMsg = channel.messages.cache.get(kChe.id_msg) ?? await channel.messages.fetch(kChe.id_msg).catch(() => null);
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

/* === msgBuilder === */
async function msgMgr(dat: msgBuild) {
    const prst = await rawPreset(dat.type).catch(() => null);
    if (!prst) return;

    const key = `${dat.ch.guildId}-${dat.type}`;
    const myEpoch = (msgEpoch.get(key) ?? 0) + 1;
    msgEpoch.set(key, myEpoch);
    const isStale = () => msgEpoch.get(key) !== myEpoch;

    // ==== timmerDelControl ==== //
    const fisRol = dat.rol ? `AVISO: ${dat.rol}!` : undefined;
    const msgVal = msgParam(dat.type, !!dat.rol);
    /* Now */
    await msgSnd({ title: prst.title.A, fields: prst.field.A, desc: prst.desc.ini, pic: prst.urlPic.A, rolOn: fisRol, url: prst.url, delAft: msgVal.aTimm, key }, dat);
    /* 30 min */
    if (prst.ntfy.ntf_30 && prst.mTimmer > (30 * minuts)) {
        setTimeout(async () => {
            if (isStale()) return;
            const p = await rawPreset(dat.type).catch(() => null);
            if (!p) return;
            await msgSnd({ title: p.title.A, fields: p.field.B ?? p.field.A, desc: p.desc.l30, pic: p.urlPic.A, rolOn: undefined, url: p.url, delAft: msgVal.bTimm, key }, dat);
        }, prst.mTimmer - (30 * minuts));
    }
    /* 15 min */
    if (prst.ntfy.ntf_15 && prst.mTimmer > (15 * minuts)) {
        setTimeout(async () => {
            if (isStale()) return;
            const p = await rawPreset(dat.type).catch(() => null);
            if (!p) return;
            await msgSnd({ title: p.title.A, fields: p.field.B ?? p.field.A, desc: p.desc.l15, pic: p.urlPic.A, rolOn: undefined, url: p.url, delAft: msgVal.bTimm, key }, dat);
        }, prst.mTimmer - (15 * minuts));
    }
    /* Fin */
    if (prst.ntfy.ntf_end && prst.mTimmer > 0) {
        setTimeout(async () => {
            if (isStale()) return;
            const p = await rawPreset(dat.type).catch(() => null);
            if (!p) return;
            await msgSnd({ title: p.title.B, fields: p.field.B ?? p.field.A, desc: p.desc.fn, pic: p.urlPic.B, rolOn: undefined, url: p.url, delAft: hours, key }, dat);
        }, prst.mTimmer);
    }
}

/* === msgAux === */
function msgParam(nt: notifyType, aRol: boolean) {
    let aTimm = hours, bTimm = 0;

    if (nt === "mntStar24h") {
        aTimm = 5 * hours;
        return { aTimm, bTimm };
    }

    if (nt.endsWith("24h")) {
        aTimm = 23 * hours;
        return { aTimm, bTimm };
    };

    if (aRol) {
        aTimm = 30 * minuts;
        bTimm = 15 * minuts;
    };

    return { aTimm, bTimm };
}

/* === msgSender === */
async function msgSnd(dta: msgSend, dat: msgBuild) {
    try {
        const emb = new EmbedBuilder().setColor(0x00AA00).setTitle(dta.title).setDescription(dta.desc);
        if (dta.pic) emb.setImage(dta.pic);
        if (dta.url) emb.setURL(dta.url);
        if (dta.fields.length > 0) emb.addFields(dta.fields);
        emb.setFooter({ text: "Kantai Collection", iconURL: "https://upload.wikimedia.org/wikipedia/ru/0/02/Kantai_Collection_logo.png" }).setTimestamp();

        /* Buscar mensaje */
        const hasOldMsg = msgkch.get(dta.key);
        if (hasOldMsg) {
            const oldMsg = dat.ch.messages.cache.get(hasOldMsg.msgId) ?? await dat.ch.messages.fetch(hasOldMsg.msgId).catch(() => null);
            if (oldMsg && oldMsg.deletable) { await oldMsg.delete().catch(() => null) };
            msgkch.delete(dta.key);
            const hasErase = outErase.get(dta.key);
            if (hasErase) { clearTimeout(hasErase); outErase.delete(dta.key); };
            delKchTemp(dta.key, dat.ch.guildId).catch(e => error(`Erase temp db [${dat.type}]: ${e}`, "KanCron"));
        };

        const fire = dta.delAft > 10_000 ? dta.delAft : (hours);
        const timeToErase = Date.now() + fire;

        const noDel = dat.type === "mntAviso";
        const outMsg = await dat.ch.send({ content: dta.rolOn, embeds: [emb] }).catch(() => null);

        if (!noDel && outMsg) {
            const erase = setTimeout(async () => {
                await outMsg.delete().catch(e => error(`Error al borrar msg [${dat.type}]: ${e}`, "KanCron"));
                const cur = msgkch.get(dta.key);
                if (cur) msgkch.delete(dta.key);
                outErase.delete(dta.key);
                delKchTemp(dta.key, dat.ch.guildId).catch(e => error(`Erase temp db [${dat.type}]: ${e}`, "KanCron"));
            }, fire);

            outErase.set(dta.key, erase);

            msgkch.set(dta.key, { msgId: outMsg.id, chId: dat.ch.id });
            await kchTempMSg({ guild_id: dat.ch.guildId, id_key: dta.key, id_msg: outMsg.id, id_ch: dat.ch.id, sup_time: new Date(timeToErase) });
        }
    } catch (e: any) { error(`Error enviando notificación [${dat.type}]: ${e.message} | ${e.stack}`, "KanCron"); }
};

/* === msgOlder === */
async function chkOldMsg() {
    const bdResdt = await loadKchMsg().catch(() => null);
    if (!bdResdt || bdResdt.length === 0) return;

    for (const para of bdResdt) {
        const guild = CLIENTE!.guilds.cache.get(para.guild_id) ?? await CLIENTE!.guilds.fetch(para.guild_id).catch(() => null);
        const rawCh = guild ? (guild.channels.cache.get(para.id_ch) ?? await guild.channels.fetch(para.id_ch).catch(() => null)) : null;
        const channel = rawCh && rawCh.isTextBased() ? rawCh : null;

        if (para.sup_time.getTime() <= Date.now()) {
            if (channel) {
                const oldMsg = channel.messages.cache.get(para.id_msg) ?? await channel.messages.fetch(para.id_msg).catch(() => null);
                if (oldMsg) await oldMsg.delete().catch(() => null);
            };

            await delKchTemp(para.id_key, para.guild_id).catch(() => null);
        };
    }
}
