import * as cron from 'node-cron';
import { Client, EmbedBuilder, Message, Role, TextChannel } from 'discord.js';
import { error, info } from '../sys/logging';
import { startKC, data, /*kcheMaint, updateKCmant, maint*/ } from '../sys/DB-Engine/links/KancolleBD';

type notifyType = 'pvp' | 'quest' | `oem`;
let kcTimmers = new Map<string, NodeJS.Timeout>();
const TZ = 'Asia/Tokyo';
const minuts = 60 * 1_000;

// ========================================================= Init ========================================================= //
export async function initKC(C: Client) {
    setTimeout(async () => {
        const kcStart = await startKC();
        if (kcStart) {
            cronKC(C);
            //kcheMaint()
            info(`Se iniciaron los modulos de Kancolle`)
        } else { error(`No se pudieron cargar los modulos de Kancolle`) }

    }, 1 * minuts)
}

async function cronKC(client: Client) {
    const cronOpt = { timezone: TZ };
    cron.schedule('40 2,14 * * *', async () => { await notifyKC(client, 'pvp'); }, cronOpt); // PvP (03:00 JST y 15:00 JST) 
    cron.schedule('40 4 * * *', async () => { await notifyKC(client, 'quest'); }, cronOpt); // Daily (05:00 JST todos los días)
    cron.schedule('30 23 1 * *', async () => { await notifyKC(client, 'oem'); }, cronOpt); // OEM (00:00 JTS Dia primero del mes)
}

// ========================================================= Main ========================================================= //
async function notifyKC(client: Client, type: notifyType) {
    for (const [guildId, configs] of data.entries()) {
        for (const cfg of configs) {
            if (type === 'pvp' && !cfg.pvp) continue;
            if (type === 'quest' && !cfg.quest) continue;
            if (type === 'oem' && !cfg.oem) continue;

            try {
                let title = "", desc = "", uTitle = "", uDesc = "", pic = "https://i.imgur.com/sInDmjs.jpeg", color = 0xFFA500, rTime: number, fields: { name: string; value: string; inline?: boolean }[] = [];
                const guild = await client.guilds.fetch(guildId).catch(() => null);
                if (!guild) continue;
                const channel = await guild.channels.fetch(cfg.channel).catch(() => null);
                if (!channel || !channel.isTextBased()) continue;
                const txtCh = channel as TextChannel;
                const chkRol = cfg.role ? await guild.roles.fetch(cfg.role).catch(() => null) : null;
                const tx = aQuest();
                const rst = jpTime();

                switch (type) {
                    case 'pvp':
                        rTime = 20;
                        title = "⚓ ¡Aviso de PvP!";
                        desc = `Los Ejercicios (PvP) se reiniciaran en **${rTime} minutos**.`;
                        fields = [
                            { name: `Misiones Reseteadas:`, value: `${tx}` },
                            { name: `Proximos resets:`, value: `**PVP**: ${rst.pvp}\n **Diarias**: ${rst.dQuest}\n **Semanales**: ${rst.wQuest}\n **Extra Operaciones**: ${rst.oem}` },
                        ];
                        pic = "https://i.imgur.com/rhaHOhq.png";
                        uTitle = "⚔️ ¡PvP Reiniciado!";
                        uDesc = "✅ Los PvPs se han reiniciado!";
                        break;
                    case 'quest':
                        rTime = 20;
                        title = "📝 Aviso sobre las Quest!";
                        desc = `**Reinicio de misiones en ${rTime} minutos!!**`;
                        fields = [
                            { name: `Misiones Reseteadas:`, value: `${tx}` },
                            { name: `Proximos resets:`, value: `**PVP**: ${rst.pvp}\n **Diarias**: ${rst.dQuest}\n **Semanales**: ${rst.wQuest}\n **Extra Operaciones**: ${rst.oem}` },
                        ];
                        pic = "https://i.imgur.com/pJZdK4i.jpeg";
                        uTitle = "✅ ¡Las Quest se han reiniciado!";
                        uDesc = `Se han reiniciado las misones: ${tx}`;
                        break;
                    case `oem`:
                        rTime = 30;
                        title = "📦 ¡Aviso de Extra operaciones!"
                        desc = `Las EO se reiniciaran en ${rTime} minutos.`
                        fields = [
                            { name: `Misiones Reseteadas:`, value: `${tx}` },
                            { name: `Proximos resets:`, value: `**PVP**: ${rst.pvp}\n **Diarias**: ${rst.dQuest}\n **Semanales**: ${rst.wQuest}\n **Extra Operaciones**: ${rst.oem}` },
                        ];
                        pic = "https://i.imgur.com/72A2KNE.png";
                        uTitle = "🎉 Las EO se han reiniciado!"
                        uDesc = "Las EO se han reiniciado, ve apor tus medallas del mes!"
                        break;
                }

                const emb = new EmbedBuilder().setTitle(title).setColor(color).setImage(pic).setDescription(desc).addFields(fields);
                let omsg: Message;
                chkRol ? omsg = await txtCh.send({ content: `AVISO: ${chkRol}!`, embeds: [emb] }) : omsg = await txtCh.send({ embeds: [emb] });

                const uEmb = new EmbedBuilder().setTitle(uTitle).setDescription(uDesc).setColor(color);

                const delTimmer = rTime * minuts;
                folloNotify(txtCh, omsg, uEmb, `${guildId}-${type}`, delTimmer, chkRol);
            } catch (err) { error(`Error al notificar: ${guildId} ${err}`); }
        }
    }
}

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


// ========================================================= lefTimes ========================================================= //
export function jpTime() {
    const now = new Date();
    const tokyoDate = new Date(now.toLocaleString('en-US', { timeZone: TZ }));
    const nowTime = tokyoDate.getTime();

    // PvPs
    const pvp3hrs = new Date(tokyoDate);
    pvp3hrs.setHours(3, 0, 0, 0);
    const pvp15hrs = new Date(tokyoDate);
    pvp15hrs.setHours(15, 0, 0, 0);
    let pvpCount: number;
    if (nowTime >= pvp15hrs.getTime()) {
        const nextPvp3hrs = new Date(pvp3hrs);
        nextPvp3hrs.setDate(nextPvp3hrs.getDate() + 1);
        pvpCount = nextPvp3hrs.getTime() - nowTime;
    } else if (nowTime >= pvp3hrs.getTime()) { pvpCount = pvp15hrs.getTime() - nowTime; }
    else { pvpCount = pvp3hrs.getTime() - nowTime; }

    // DailyQuest
    const dQuest = new Date(tokyoDate);
    dQuest.setHours(5, 0, 0, 0);
    let dQuestCount: number;
    if (nowTime >= dQuest.getTime()) {
        const nextQuest = new Date(dQuest);
        nextQuest.setDate(nextQuest.getDate() + 1);
        dQuestCount = nextQuest.getTime() - nowTime;
    }
    else { dQuestCount = dQuest.getTime() - nowTime; }

    // OEM
    const oem = new Date(tokyoDate);
    oem.setDate(1);
    oem.setHours(0, 0, 0, 0);

    let OEMCount: number;
    if (nowTime >= oem.getTime()) {
        const nextMonthly = new Date(oem);
        nextMonthly.setMonth(nextMonthly.getMonth() + 1);
        OEMCount = nextMonthly.getTime() - nowTime;
    } else { OEMCount = oem.getTime() - nowTime; }

    // WeeklyQuest
    const wQuest = new Date(tokyoDate);
    const targetDay = 1;
    const currentDay = wQuest.getDay();
    let daysUntilTarget = targetDay - currentDay;
    if (daysUntilTarget < 0) daysUntilTarget += 7;
    if (daysUntilTarget === 0) {
        const todayTarget = new Date(tokyoDate);
        todayTarget.setHours(5, 0, 0, 0);
        if (nowTime >= todayTarget.getTime()) { daysUntilTarget = 7; }
    }
    wQuest.setDate(wQuest.getDate() + daysUntilTarget);
    wQuest.setHours(0, 0, 0, 0);
    let wQuestCount: number;
    if (nowTime >= wQuest.getTime()) {
        const nextWeekly = new Date(wQuest);
        nextWeekly.setDate(nextWeekly.getDate() + 7);
        wQuestCount = nextWeekly.getTime() - nowTime;
    } else { wQuestCount = wQuest.getTime() - nowTime; }

    return { pvp: turnDate(pvpCount), dQuest: turnDate(dQuestCount), wQuest: turnDate(wQuestCount), oem: turnDate(OEMCount) };
}

// ========================================================= Euxiliares ========================================================= //
function turnDate(data: number) {
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
    const tokyoDate = new Date(now.toLocaleString('en-US', { timeZone: TZ }));
    const dayOfWeek = tokyoDate.getDay(); // 1 = lunes
    const numDay = tokyoDate.getDate(); // 1 - 31
    const month = tokyoDate.getMonth(); // 0 = enero, 11 = diciembre
    // === msg === //
    let aviso = "\n- DIARIAS!!"
    if (dayOfWeek === 1) aviso += "\n- SEMANALES!!"
    if (numDay === 1) aviso += "\n- MENSUALES!!"
    if (numDay === 1 && (month === 2 /*Marzo*/ || month === 5 /*Junio */ || month === 8 /* Septiembre */ || month === 11 /* Diciembre */)) aviso += "\n- TRIMESTRALES (Quarterly)!"
    return aviso;
}
