// src/bgProcess/exeCron.ts
import * as cron from 'node-cron';
import { Client, TextChannel } from 'discord.js';
import getPool from '../sys/DB-Engine/database';
import { info, debug, error } from '../sys/logging';

// Mapa para guardar las tareas y poder detenerlas después si el usuario las borra
export const activeCronTasks = new Map<number, cron.ScheduledTask>();

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

export function programarTarea(client: Client, dbRow: any) {
    const tarea = cron.schedule(dbRow.cron, async () => {
        try {
            const guild = client.guilds.cache.get(dbRow.guild_id);
            if (!guild) return;

            const channel = guild.channels.cache.get(dbRow.channel_id) as TextChannel;
            if (!channel) return;

            const mensajeData = JSON.parse(dbRow.mensaje_data);

            const msgContent: any = {};

            if (mensajeData.content) {
                msgContent.content = mensajeData.content;
            }
            if (mensajeData.embeds && mensajeData.embeds.length > 0) {
                msgContent.embeds = mensajeData.embeds;
            }
            if (mensajeData.attachments && mensajeData.attachments.length > 0) {
                msgContent.files = mensajeData.attachments;
            }

            await channel.send(msgContent);

        } catch (err) {
            error(`[CronManager] Falló al enviar el cron ${dbRow.id}: ${err}`, "cronpost");
        }
    });

    activeCronTasks.set(dbRow.id, tarea);
}

export function detenerTarea(id: number) {
    const tarea = activeCronTasks.get(id);
    if (tarea) {
        tarea.stop();
        activeCronTasks.delete(id);
        debug(`[CronManager] 🛑 Tarea ${id} detenida en memoria.`, "cronpost");
    }
}

export function startCronpost(client: Client) {
    setTimeout(() => {
        initCronManager(client).catch(err => error(`Error al iniciar CronManager: ${err}`));
    }, 10_000);
} 