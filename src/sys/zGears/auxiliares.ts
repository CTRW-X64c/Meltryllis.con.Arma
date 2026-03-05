// sc/sys/auxiliares.ts
import { Client } from "discord.js";
import { error } from "../logging";

/* ======================================== TIMMERS ======================================== */

const minutos = 60 * 1000;
const hrs = 60 * minutos;
const cooldownsMap = new Map<string, number>();
const COOLDOWN_TIMES: Record<string, number> = {
    "default": 1 * hrs + 30 * minutos,
    "repCommand": 60 * minutos,
    "netCommand": 30 * minutos,
    "playMusic": 5 * minutos,
};

export function startCooldown(guild: string, idCommand: string) {
    const key = `${guild}-${idCommand}`;
    const cooldownDuration = COOLDOWN_TIMES[idCommand] || COOLDOWN_TIMES["default"];
    const expirationTime = Date.now() + cooldownDuration;
    cooldownsMap.set(key, expirationTime);
}

export function checkCooldown(guild: string, idCommand: string): { onCooldown: boolean; timeLeft: string } {
    const key = `${guild}-${idCommand}`;
    const expirationTime = cooldownsMap.get(key);
    if (!expirationTime) {
        return { onCooldown: false, timeLeft: '' };
    }
    const timeRemaining = expirationTime - Date.now();
    if (timeRemaining > 0) {
        const minutesLeft = Math.ceil(timeRemaining / 60000);
        return { onCooldown: true, timeLeft: minutesLeft < hrs ? `${minutesLeft} minuto(s) y ${minutesLeft % 60} segundo(s)` : `${Math.floor(minutesLeft / 60)} hora(s) y ${minutesLeft % 60} minuto(s)`};
    }
    cooldownsMap.delete(key);
    return { onCooldown: false, timeLeft: '' };
}

setInterval(() => {
    const now = Date.now();
    for (const [key, expirationTime] of cooldownsMap.entries()) {
        if (now > expirationTime) {
            cooldownsMap.delete(key);
        }
    }
}, 1 * hrs);

/* ======================================== ReportChannels ======================================== */

let cachedReportConfig: { chReport: boolean, chReportId: string } | null = null; /* Sistema de Cahce */
export async function ChannelReports(client: Client): Promise<{chReport: boolean,  chReportId: string}> {
    if (cachedReportConfig) return cachedReportConfig;

    const ownerId = process.env.HOST_DISCORD_USER_ID;
    const reportIds = process.env.REPORT_CHANNEL_ID;
    if (!ownerId || !reportIds) { /* Check de env */
        error("Falta el ID del dueño del bot o los IDs del canal de reporte en las variables de entorno.");
        cachedReportConfig = { chReport: false, chReportId: '' };
        return cachedReportConfig;
    }

    const [guildId, channelId] = reportIds.split('|');
    if (!guildId || !channelId) { /* Check de datos */
        console.error("El formato de REPORT_CHANNEL_ID es incorrecto. Debe ser 'guildId|channelId'.");
        cachedReportConfig = { chReport: false, chReportId: '' };
        return cachedReportConfig;
    }
    try {
        const guild = await client.guilds.fetch(guildId); /* Chek de server*/
        if (guild.ownerId !== ownerId) {
            error("El dueño del bot no es el dueño del servidor especificado.");
            cachedReportConfig = { chReport: false, chReportId: '' };
            return cachedReportConfig;
        }

        const channel = await guild.channels.fetch(channelId); /* Check de canal */
        if (!channel) {
            error(`El canal con ID ${channelId} no se encontró en el servidor.`);
            cachedReportConfig = { chReport: false, chReportId: '' };
            return cachedReportConfig;
        }
        cachedReportConfig = { chReport: true, chReportId: channel.id };
        return cachedReportConfig;
    } catch (e) {
        error(`Error al verificar el canal de reportes: ${e}`);
        cachedReportConfig = { chReport: false, chReportId: '' };
        return cachedReportConfig;
    }
}
