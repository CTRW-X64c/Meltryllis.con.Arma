import * as cron from 'node-cron';
import { Client, EmbedBuilder, Message, Role, TextChannel } from 'discord.js';
import { error, info } from '../sys/logging';
import { startKC, data, /*kcheMaint, updateKCmant, maint*/ } from '../sys/DB-Engine/links/KancolleBD';

type notifyType = 'pvp' | 'quest' | `oem`;
type timSlap = 'daily' | 'weekly' | 'monthly';
interface timeData { type: timSlap; hours: number | number[]; minutes?: number; targetDay?: number; }
let kcTimmers = new Map<string, NodeJS.Timeout>();
const TZjp = 'Asia/Tokyo';
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
    const cronOpt = { timezone: TZjp };
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
                const rst = leftTime();
                const vlueTxt = `**PVP:** ${rst.pvp}\n**EO:** ${rst.oem}\n>Misiones:\n**Diarias:** ${rst.dQuest}\n**Semanales:** ${rst.wQuest}\n**Mensuales:**${rst.mQuest}\n>Rank:\n**Cutoff Diario:** ${rst.dPtCutof}\n**Cutoff Mesual:** ${rst.mPtCutof}`

                switch (type) {
                    case 'pvp':
                        rTime = 20;
                        title = "⚓ ¡Aviso de PvP!";
                        desc = `Los Ejercicios (PvP) se reiniciaran en **${rTime} minutos**.`;
                        fields = [{ name: `Proximos resets:`, value: vlueTxt },];
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
                            { name: `Proximos resets:`, value: vlueTxt },
                        ];
                        pic = "https://i.imgur.com/pJZdK4i.jpeg";
                        uTitle = "✅ ¡Las Quest se han reiniciado!";
                        uDesc = `Se han reiniciado las misones: ${tx}`;
                        break;
                    case `oem`:
                        rTime = 30;
                        title = "📦 ¡Aviso de Extra operaciones!"
                        desc = `Las EO se reiniciaran en ${rTime} minutos.`
                        fields = [{ name: `Proximos resets:`, value: vlueTxt },];
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
export function leftTime() {
    // ultimo dia del mes
    const now = new Date(); const jpDate = new Date(now.toLocaleString('en-US', { timeZone: TZjp }));
    const lastday = new Date(jpDate.getFullYear(), jpDate.getMonth() + 1, 0).getDate();
    // Reglas mes: 1-31; Semana: domingo = 0 - sabado = 6, def= 1 lunes (1); Minutos: 0-59 def 0
    const pvpCount = leftTimeConv({ type: 'daily', hours: [3, 15] });
    const dQuestCount = leftTimeConv({ type: 'daily', hours: 5 });
    const wQuestCount = leftTimeConv({ type: 'weekly', targetDay: 1, hours: 5 });
    const mQuestCount = leftTimeConv({ type: 'monthly', targetDay: 1, hours: 5 });
    const oemCount = leftTimeConv({ type: 'monthly', targetDay: 1, hours: 0 });
    const dPtCutof = leftTimeConv({ type: 'daily', hours: [2, 14] });
    const mPtCutof = leftTimeConv({ type: 'monthly', targetDay: lastday, hours: 22 })

    return {
        pvp: turnDate(pvpCount),
        dQuest: turnDate(dQuestCount),
        wQuest: turnDate(wQuestCount),
        mQuest: turnDate(mQuestCount),
        oem: turnDate(oemCount),
        dPtCutof: turnDate(dPtCutof),
        mPtCutof: turnDate(mPtCutof),
    };
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
    const tokyoDate = new Date(now.toLocaleString('en-US', { timeZone: TZjp }));
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

// === leftTimeAux === //
function leftTimeConv(opts: timeData): number {
    const now = new Date();
    const tokyoDate = new Date(now.toLocaleString('en-US', { timeZone: TZjp }));
    const nowTime = tokyoDate.getTime();

    let target = new Date(tokyoDate);
    target.setMinutes(opts.minutes || 0, 0, 0);  /* hora target */
    if (opts.type === 'daily') { /* Soporte para multi horas del dia*/
        const hours = Array.isArray(opts.hours) ? opts.hours : [opts.hours];
        hours.sort((a, b) => a - b); // Ordenar de menor a mayor

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
    }
    const out = target.getTime() - nowTime;
    return out;
}