//import * as cron from 'node-cron';
import { Client, EmbedBuilder, GuildTextBasedChannel, Message, Role } from 'discord.js';
import { debug, error, info } from '../sys/logging';
import { startKC, data, kcheMaint } from '../sys/DB-Engine/links/KancolleBD';
import { leftTimeConv, mantChk, rawPreset } from "../sys/zGears/kc_aux";

let CLIENTE: Client | null = null;
const minuts = 60 * 1_000;

// ========================================================= Init ========================================================= //
export async function initKC(cli: Client) {
    let inf = "[Kancolle] Se inicio el servicio:";
    if (!cli) { inf = "[Kancolle] FALLO EL INICIO DE LOS SERVICIOS DE KANCOLLE!! (No cliente!)"; return }
    else {
        CLIENTE = cli;
        const x = await startKC(), y = await kcheMaint();
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
        info(inf)
    }
}

export type notifyType = 'pvp' | 'quest' | 'oem' | 'mExp' | 'newMante' | 'maintStart' | 'mntEnd';
let notifyTimers = new Map<notifyType, NodeJS.Timeout>();
async function timmerAv() {
    /* ===== pvp ===== */
    const pvpStr = () => {
        if (notifyTimers.has('pvp')) notifyTimers.delete('pvp');
        const pvp = leftTimeConv({ type: 'daily', hours: [2, 14], minutes: 30 });
        const timer = setTimeout(() => { notifyTimers.delete('pvp'); notifyKC('pvp'); }, pvp);
        debug(`[KanCron]: pvpStr establecido en ${pvp / minuts} min`)
        notifyTimers.set('pvp', timer);
    }; if (!notifyTimers.has('pvp')) pvpStr();
    /* ===== quest ===== */
    const questStr = () => {
        if (notifyTimers.has('quest')) notifyTimers.delete('quest');
        const quest = leftTimeConv({ type: 'daily', hours: 4, minutes: 30 });
        const timer = setTimeout(() => { notifyTimers.delete('quest'); notifyKC('quest'); }, quest);
        debug(`[KanCron]: questStr establecido en ${quest / minuts} min`)
        notifyTimers.set('quest', timer);
    }; if (!notifyTimers.has('quest')) questStr();
    /* ===== extra operaciones ===== */
    const oemStr = () => {
        const oem = leftTimeConv({ type: 'monthly', targetDay: 1, hours: 0, minutes: 0 });
        if (oem > (24 * 60 * minuts)) return;
        if (notifyTimers.has('oem')) notifyTimers.delete('oem');
        const delay = Math.max(0, oem - (60 * minuts));
        const timer = setTimeout(() => { notifyTimers.delete('oem'); notifyKC('oem'); }, delay);
        debug(`[KanCron]: oemStr establecido en ${delay / minuts} min`)
        notifyTimers.set('oem', timer);
    }; if (!notifyTimers.has('oem')) oemStr();
    /* ===== expediciones mensuales ===== */
    const mExpStr = () => {
        if (notifyTimers.has('mExp')) notifyTimers.delete('mExp');
        const mExp = leftTimeConv({ type: 'monthly', targetDay: 15, hours: 12, minutes: 0 });
        if (mExp > (24 * 60 * minuts)) return;
        const delay = Math.max(0, mExp - (60 * minuts));
        const timer = setTimeout(() => { notifyTimers.delete('mExp'); notifyKC('mExp'); }, delay);
        debug(`[KanCron]: mExpStr establecido en ${delay / minuts} min`)
        notifyTimers.set('mExp', timer);
    }; if (!notifyTimers.has('mExp')) mExpStr();
}

// ========================================================= Main ========================================================= //
const chkType = new Map<notifyType, (cfg: any) => boolean>([
    ['pvp', cfg => cfg.pvp.av], ['quest', cfg => cfg.quest.av], ['oem', cfg => cfg.oem.av], ['mExp', cfg => cfg.mExp.av],
    ['newMante', cfg => cfg.mnt.av], ['maintStart', cfg => cfg.mnt.av], ['mntEnd', cfg => cfg.mnt.av]]);

const chkRole = new Map<notifyType, (cfg: any) => boolean>([
    ['pvp', cfg => cfg.pvp.ntf], ['quest', cfg => cfg.quest.ntf], ['oem', cfg => cfg.oem.ntf], ['mExp', cfg => cfg.mExp.ntf],
    ['newMante', cfg => cfg.mnt.ntf], ['maintStart', cfg => cfg.mnt.ntf], ['mntEnd', cfg => cfg.mnt.ntf]]);



/* === Core === */
export async function notifyKC(type: notifyType) {
    for (const [guildId, configs] of data.entries()) {
        for (const cfg of configs) {
            const check = chkType.get(type), checkRol = chkRole.get(type)
            if (!check || !check(cfg)) continue;
            try {
                const guild = await CLIENTE!.guilds.fetch(guildId).catch(() => null);
                if (!guild) continue;
                const channel = await guild.channels.fetch(cfg.channel).catch(() => null);
                if (!channel || !channel.isTextBased()) continue;
                const txtCh = channel as GuildTextBasedChannel;
                let chkRol: Role | null = null;
                if (cfg.role && checkRol && checkRol(cfg)) chkRol = await guild.roles.fetch(cfg.role).catch(() => null)
                msgMgr({ ch: txtCh, rol: chkRol, type: type }).catch(err => error(`[${type}] ${guildId}: ${err}`, "KanCron"));
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
    delAf: number
}
/* === kchs === */
interface cachedMsg { msgId: string, chId: string }
const msgkch = new Map<string, cachedMsg>();
const msgEpoch = new Map<string, number>();
const outErase = new Map<string, NodeJS.Timeout>();
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
            const emb = new EmbedBuilder().setTimestamp().setColor(dta.color).setTitle(dta.title).setDescription(dta.desc);
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

            if (dta.delAf > 0 && dat.type !== "newMante" && msg.deletable) {
                const prev = outErase.get(key);
                if (prev) { clearTimeout(prev); outErase.delete(key); }
                const target = msg;
                const erase = setTimeout(async () => {
                    await target.delete().catch(err => error(`Error al borrar msg [${dat.type}]: ${err}`, "KanCron"));
                    const cur = msgkch.get(key);
                    if (cur?.msgId === target.id) msgkch.delete(key);
                    outErase.delete(key);
                }, dta.delAf);
                outErase.set(key, erase);
            }
        } catch (e) { error(`Error enviando notificación [${dat.type}]: ${e}`, "KanCron"); }
    };

    const rMnt = dat.rol ? `AVISO: ${dat.rol}!` : undefined;
    const BORRAR = dat.type === "mntEnd" ? (30 * minuts) : 0;
    /* Now */
    await msgSnd({ ch: dat.ch, title: prst.title.A, fields: prst.field, desc: prst.desc.ini, pic: prst.urlPic.A, rolOn: rMnt, color: 0xFFA500, url: prst.url, delAf: BORRAR });
    /* 30 min */
    if (prst.ntfy.ntf_30 && prst.mTimmer > (30 * minuts)) {
        setTimeout(async () => {
            if (isStale()) return;
            const p = rawPreset(dat.type);
            if (!p) return;
            await msgSnd({ ch: dat.ch, title: p.title.A, fields: p.field, desc: p.desc.l30, pic: p.urlPic.A, rolOn: undefined, color: 0xFFA500, url: p.url, delAf: BORRAR });
        }, prst.mTimmer - (30 * minuts));
    }
    /* 15 min */
    if (prst.ntfy.ntf_15 && prst.mTimmer > (15 * minuts)) {
        setTimeout(async () => {
            if (isStale()) return;
            const p = rawPreset(dat.type);
            if (!p) return;
            await msgSnd({ ch: dat.ch, title: p.title.A, fields: p.field, desc: p.desc.l15, pic: p.urlPic.A, rolOn: undefined, color: 0xFFA500, url: p.url, delAf: BORRAR });
        }, prst.mTimmer - (15 * minuts));
    }
    /* Fin */
    if (prst.ntfy.ntf_end && prst.mTimmer > 0) {
        setTimeout(async () => {
            if (isStale()) return;
            const p = rawPreset(dat.type);
            if (!p) return;
            await msgSnd({ ch: dat.ch, title: p.title.B, fields: p.field, desc: p.desc.fn, pic: p.urlPic.B, rolOn: rMnt, color: 0x00AA00, url: p.url, delAf: 30 * minuts });
        }, prst.mTimmer);
    }
}
