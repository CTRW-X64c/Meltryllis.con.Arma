// src/bgProcess/exeCron.ts
import * as cron from 'node-cron';
import { Client, TextChannel } from 'discord.js';
import getPool from '../sys/DB-Engine/database';
import { info, debug, error } from '../sys/logging';
import { countExecUpdate, removeCronpost } from '../sys/DB-Engine/links/Cronpost';

/* ======================================= Cron Manager ======================================= */
/* ====== Cron Client ====== */
const activeCronTasks = new Map<number, cron.ScheduledTask>();
async function initCronManager(client: Client) {
    try {
        const pool = await getPool();
        const [rows]: any = await pool.query("SELECT * FROM cronpost_config");
        let count = 0;
        for (const fila of rows) {
            programarTarea(client, fila);
            count++;
        }
        info(`[CronManager] 🕒 Se programaron ${count} mensajes automáticos.`, "cronpost");
    } catch (err) {
        error(`[CronManager] Error al iniciar las tareas: ${err}`, "cronpost");
    }
}

/* ====== Cron Post ====== */
export function programarTarea(client: Client, dbRow: any) {
    if (activeCronTasks.has(dbRow.id)) {
        activeCronTasks.get(dbRow.id)!.stop();
        activeCronTasks.delete(dbRow.id);
    }

    const tarea = cron.schedule(dbRow.cron, async () => {
        try {
            const guild = client.guilds.cache.get(dbRow.guild_id);
            if (!guild) return;

            const channel = guild.channels.cache.get(dbRow.channel_id) as TextChannel;
            if (!channel) return;

            const mensajeData = JSON.parse(dbRow.mensaje_data);
            const msgContent: any = {};

            if (mensajeData.content) msgContent.content = mensajeData.content;
            if (mensajeData.embeds && mensajeData.embeds.length > 0) msgContent.embeds = mensajeData.embeds;
            if (mensajeData.attachments && mensajeData.attachments.length > 0) msgContent.files = mensajeData.attachments;

            const msg = await channel.send(msgContent);

            const delet = Number(dbRow.dlt_msg) || 0;
            if (delet > 0) await registerTimeout(client, channel.id, msg.id, delet);

            const repet = Number(dbRow.stop_after) || 0;
            if (repet > 0) {
                const runs = Number(dbRow.count_exec) || 0;
                dbRow.count_exec = runs + 1;
                if (dbRow.count_exec >= repet) {
                    detenerTarea(dbRow.id);
                    await removeCronpost(dbRow.guild_id, dbRow.id);
                } else {
                    await countExecUpdate(dbRow.id, dbRow.count_exec);
                }
            }
        } catch (err) {
            error(`[CronManager] Falló al enviar el cron ${dbRow.id}: ${err}`, "cronpost");
        }
    });
    activeCronTasks.set(dbRow.id, tarea);
}

/* ====== Stop Cron ====== */
export function detenerTarea(id: number) {
    const tarea = activeCronTasks.get(id);
    if (tarea) {
        tarea.stop();
        activeCronTasks.delete(id);
        debug(`[CronManager] 🛑 Tarea ${id} detenida en memoria.`, "cronpost");
    }
}

/* ======================================= TimeOuts Manager ======================================= */
/* ====== timeOuts Client ====== */
const deltMsg = new Map<string, NodeJS.Timeout>();
export async function timeOutsLoad(client: Client) {
    try {
        const pool = await getPool();
        const [rows]: any = await pool.query("SELECT * FROM cron_timeout");

        let recuperados = 0;
        let vencidos = 0;
        const ahora = Date.now();

        for (const row of rows) {
            const tiempoRestante = Number(row.delete_at) - ahora;

            if (tiempoRestante <= 0) {
                await deleTimmer(row.channel_id, row.message_id, client);
                vencidos++;
            } else {
                registerTimeout(client, row.channel_id, row.message_id, tiempoRestante);
                recuperados++;
            }
        }

        if (recuperados > 0 || vencidos > 0) {
            debug(`[TimeOutManager] ♻️ Recuperados: ${recuperados} temporizadores | Borrados atrasados: ${vencidos}`, "cronpost");
        }

    } catch (err) {
        error(`Error recuperando auto-deletions: ${err}`);
    }
}

/* ====== Registrador de TimeOuts  ====== */
export async function registerTimeout(client: Client, channelId: string, messageId: string, rawTimmer: number) {
    const delayMs = rawTimmer * 60 * 1000;
    const deleteAt = Date.now() + delayMs;

    try {
        const pool = await getPool();
        await pool.query(
            "INSERT INTO cron_timeout (message_id, channel_id, delete_at) VALUES (?, ?, ?)",
            [messageId, channelId, deleteAt]
        );

        mewTimeout(client, channelId, messageId, delayMs);
    } catch (err) {
        error(`Error guardando auto-delete en BD: ${err}`);
    }
}

/* ====== Inicador de TimeOuts  ====== */
function mewTimeout(client: Client, channelId: string, messageId: string, timmer: number) {
    if (deltMsg.has(messageId)) {
        clearTimeout(deltMsg.get(messageId)!);
    }
    deltMsg.set(messageId, setTimeout(async () => {
        await deleTimmer(channelId, messageId, client);
    }, timmer));
}

/* ====== Borrador de TimeOuts  ====== */
async function deleTimmer(channelId: string, messageId: string, client: Client) {
    deltMsg.delete(messageId);
    try {
        const pool = await getPool();
        await pool.query("DELETE FROM cron_timeout WHERE message_id = ?", [messageId]);

        if (!client) { error(`${messageId} no cuenta con cliente para ser borrado.`); return; }
        const channel = client.channels.cache.get(channelId) as TextChannel;
        if (channel) {
            const msg = await channel.messages.fetch(messageId).catch(() => null);
            if (msg && msg.deletable) {
                await msg.delete();
                debug(`[AutoDelete] Mensaje ${messageId} borrado.`, "cronpost");
            }
        }
    } catch (err: any) {
        if (err?.code !== 10008) {
            error(`Error al borrar el mensaje ${messageId}: ${err}`);
        }
    }
}

/* ======================================= Inicializador ======================================= */
export function startCronpost(client: Client) {
    setTimeout(() => {
        initCronManager(client).catch(err => error(`Error al iniciar CronManager: ${err}`));
        timeOutsLoad(client).catch(err => error(`Error al recuperar auto-deletions: ${err}`));
    }, 10_000);
}
