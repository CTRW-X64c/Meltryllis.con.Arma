import * as cron from 'node-cron';
import getPool from '../sys/DB-Engine/database';
import { Client, EmbedBuilder, Message, Role, TextChannel } from 'discord.js';
import { debug, error, info } from '../sys/logging';

type notifyType = 'pvp' | 'quest' | `oem`;
export interface Kancolle {
    guild: string;
    role: string | null;
    channel: string;
    pvp: boolean;
    quest: boolean;
    oem: boolean;
}

const data = new Map<string, Kancolle[]>();
const minuts = 60 * 1_000;
const TZ = 'Asia/Tokyo';

async function startKC(): Promise<boolean> {
    try {
        const pool = await getPool();
        const [rows]: any = await pool.query("SELECT * FROM kc_conf");

        data.clear();
        for (const dbRow of rows) {
            if (!data.has(dbRow.guild_id)) data.set(dbRow.guild_id, []);
            data.get(dbRow.guild_id)!.push({
                guild: dbRow.guild_id,
                role: dbRow.role,
                channel: dbRow.channel,
                pvp: dbRow.pvp,
                quest: dbRow.quest,
                oem: dbRow.oem
            });
        }
        const count = data.size;
        if (count > 0) info(`Kancolle configuraciones cargadas: ${count}`);
        return true;
    } catch (e) {
        error(`Error al procesar configuración de Kancolle: ${e}`);
        return false;
    }
}

// ==== time conversor === //
const aQuest = () => {
    const now = new Date();
    const tokyoDate = new Date(now.toLocaleString('en-US', { timeZone: TZ }));
    const dayOfWeek = tokyoDate.getDay(); // 1 = lunes
    const numDay = tokyoDate.getDate(); // 1 - 31
    const month = tokyoDate.getMonth(); // 0 = enero, 11 = diciembre
    // === msg === //
    let aviso = "Reinicio de Misiones: \n- DIARIAS!!"
    if (dayOfWeek === 1) aviso += "\n- SEMANALES!!"
    if (numDay === 1) aviso += "\n- MENSUALES!!"
    if ((month === 2 /*Marzo*/ || month === 5 /*Junio */ || month === 8 /* Septiembre */ || month === 11 /* Diciembre */) && numDay === 1) aviso += "\n- TRIMESTRALES (Quarterly)!"
    return aviso;
}

async function notifyKC(client: Client, type: notifyType) {
    for (const [guildId, configs] of data.entries()) {
        for (const cfg of configs) {
            if (type === 'pvp' && !cfg.pvp) continue;
            if (type === 'quest' && !cfg.quest) continue;
            if (type === 'oem' && !cfg.oem) continue;

            try {
                let title = "", desc = "", uTitle = "", uDesc = "", pic = "https://i.imgur.com/sInDmjs.jpeg", color = 0xFFA500, wTime: number;
                switch (type) {
                    case 'pvp':
                        title = "⚓ ¡Aviso de PvP!";
                        desc = "El reinicio de Ejercicios (PvP) ocurrirá en **20 minutos**.";
                        pic = "https://i.imgur.com/rhaHOhq.png";
                        uTitle = "⚔️ ¡PvP Reiniciado!";
                        uDesc = "Los PvPs se han restablecido!!";
                        wTime = 20 * minuts;
                        break;
                    case 'quest':
                        const text = aQuest()
                        title = "📝 Aviso sobre las Quest!";
                        desc = `${text} \n\n **Reset en 20 minutos!!** `;
                        pic = "https://i.imgur.com/pJZdK4i.jpeg";
                        uTitle = "✅ ¡Las Quest se han reiniciado!";
                        uDesc = text;
                        wTime = 20 * minuts;
                        break;
                    case `oem`:
                        title = "📦 ¡Aviso de Extra operaciones!"
                        desc = "Las EO se reiniciaran en **30 minutos**."
                        pic = "https://i.imgur.com/72A2KNE.png";
                        uTitle = "🎉 ¡EO Reiniciada!"
                        uDesc = "Las EO se han reiniciado, ve apor tus medallas del mes!"
                        wTime = 30 * minuts
                        break;
                }

                const guild = await client.guilds.fetch(guildId).catch(() => null);
                if (!guild) continue;
                const channel = await guild.channels.fetch(cfg.channel).catch(() => null);
                if (!channel || !channel.isTextBased()) continue;
                const txtCh = channel as TextChannel;

                const emb = new EmbedBuilder()
                    .setTitle(title)
                    .setDescription(desc)
                    .setColor(color)
                    .setImage(pic)
                    .setTimestamp();

                const chkRol = cfg.role ? await guild.roles.fetch(cfg.role).catch(() => null) : null;
                let omsg: Message;
                if (chkRol) omsg = await txtCh.send({ content: `AVISO: ${chkRol}!`, embeds: [emb] });
                else omsg = await txtCh.send({ embeds: [emb] });

                const uEmb = new EmbedBuilder()
                    .setTitle(uTitle)
                    .setDescription(uDesc)
                    .setColor(color)
                    .setTimestamp();

                folloNotify(txtCh, omsg, uEmb, `${guildId}-${type}`, wTime, chkRol);
            } catch (err) { error(`Error al notificar: ${guildId} ${err}`); }
        }
    }
}

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

// ========================================================= Init ========================================================= //
async function cronKC(client: Client) {
    const cronOpt = { timezone: TZ };
    cron.schedule('40 2,14 * * *', async () => { await notifyKC(client, 'pvp'); }, cronOpt); // PvP (03:00 JST y 15:00 JST) 
    cron.schedule('40 4 * * *', async () => { await notifyKC(client, 'quest'); }, cronOpt); // Daily (05:00 JST todos los días)
    cron.schedule('30 23 1 * *', async () => { await notifyKC(client, 'oem'); }, cronOpt); // OEM (00:00 JTS Dia primero del mes) 
}

export async function initKC(C: Client) {
    const kcStart = await startKC();
    if (kcStart) {
        cronKC(C);
        info("Kancolle notify iniciado correctamente!")
    }
}

// ========================================================= Melt <=> BD ========================================================= //
export async function addBD(guildId: string, kcData: Kancolle) {
    try {
        const pool = await getPool();
        await pool.query(
            `INSERT INTO kc_conf (guild_id, role, channel, pvp, quest, oem) VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE role = VALUES(role), channel = VALUES(channel), pvp = VALUES(pvp), quest = VALUES(quest), oem = VALUES(oem)`,
            [guildId, kcData.role, kcData.channel, kcData.pvp, kcData.quest, kcData.oem]
        );

        data.set(guildId, [kcData]);
        debug(`Kancolle Config GUARDADA/ACTUALIZADA: Guild ${guildId}`);
    } catch (err) {
        error(`Error guardando Kancolle Config: ${err}`);
    }
}

export async function delBD(guildId: string) {
    try {
        const pool = await getPool();
        await pool.query(`DELETE FROM kc_conf WHERE guild_id = ?`, [guildId]);
        data.delete(guildId);

        debug(`Kancolle Config ELIMINADA para Guild: ${guildId}`);
    } catch (err) {
        error(`Error eliminando Kancolle Config: ${err}`);
    }
}

export async function getKCConfig(guild: string): Promise<Kancolle[]> {
    if (data.has(guild)) return data.get(guild)!;
    return [];
}
