// sc/sys/auxiliares.ts
import { Client, PermissionFlagsBits } from "discord.js";
import { error } from "../logging";
import i18next from "i18next";

/* ======================================== TIMMERS ======================================== */

const minutos = 60 * 1000;
const hrs = 60 * minutos;
const cooldownsMap = new Map<string, number>();
const COOLDOWN_TIMES: Record<string, number> = {
    "default": 1 * hrs + 30 * minutos,
    "repCommand": 60 * minutos,
    "netCommand": 30 * minutos,
    "playMusic": 5 * minutos,
    "netCommandNoWait": 5 * minutos,
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
        return { onCooldown: true, timeLeft: minutesLeft < hrs ? `${minutesLeft} minuto(s) y ${minutesLeft % 60} segundo(s)` : `${Math.floor(minutesLeft / 60)} hora(s) y ${minutesLeft % 60} minuto(s)` };
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

let cachedReportConfig: { upChannel: boolean, channelId: string } | null = null; /* Sistema de Cahce */
export async function adminChannel(client: Client): Promise<{ upChannel: boolean, channelId: string }> {
    if (cachedReportConfig) return cachedReportConfig;

    const ownerId = process.env.HOST_DISCORD_USER_ID;
    const reportIds = process.env.REPORT_CHANNEL_ID;
    if (!ownerId || !reportIds) { /* Check de env */
        error("Falta el ID del dueño del bot o los IDs del canal de reporte en las variables de entorno.");
        cachedReportConfig = { upChannel: false, channelId: '' };
        return cachedReportConfig;
    }
    const [guildId, channelId] = reportIds.split('|');
    if (!guildId || !channelId) { /* Check de datos */
        console.error("El formato de REPORT_CHANNEL_ID es incorrecto. Debe ser 'guildId|channelId'.");
        cachedReportConfig = { upChannel: false, channelId: '' };
        return cachedReportConfig;
    }
    try {
        const guild = await client.guilds.fetch(guildId); /* Chek de server*/
        if (guild.ownerId !== ownerId) {
            error("El dueño del bot no es el dueño del servidor especificado.");
            cachedReportConfig = { upChannel: false, channelId: '' };
            return cachedReportConfig;
        }
        const channel = await guild.channels.fetch(channelId); /* Check de canal */
        if (!channel) {
            error(`El canal con ID ${channelId} no se encontró en el servidor.`);
            cachedReportConfig = { upChannel: false, channelId: '' };
            return cachedReportConfig;
        }
        cachedReportConfig = { upChannel: true, channelId: channel.id };
        return cachedReportConfig;
    } catch (e) {
        error(`Error al verificar el canal de reportes: ${e}`);
        cachedReportConfig = { upChannel: false, channelId: '' };
        return cachedReportConfig;
    }
}

/* ======================================== Check Permisos ======================================== */

export function testPermisos(chkPerm: any, idComamnd: string) {
    const mngrBitsList = [
        { id: "admin", name: i18next.t("help:embMaker.bitAdmin"), bit: PermissionFlagsBits.Administrator },
        { id: "srvManager", name: i18next.t("help:embMaker.bitSrvManager"), bit: PermissionFlagsBits.ManageGuild },
        { id: "banMember", name: i18next.t("help:embMaker.bitBanMember"), bit: PermissionFlagsBits.BanMembers },
        { id: "kickMember", name: i18next.t("help:embMaker.bitKickMember"), bit: PermissionFlagsBits.KickMembers },
        { id: "auditLog", name: i18next.t("help:embMaker.bitViewAuditLog"), bit: PermissionFlagsBits.ViewAuditLog, },
    ];

    const meltrysList = [
        { id: "viewCh", name: i18next.t("help:embMaker.bitChSee"), bit: PermissionFlagsBits.ViewChannel },
        { id: "msgManager", name: i18next.t("help:embMaker.bitMsgManager"), bit: PermissionFlagsBits.ManageMessages },
        { id: "readMsg", name: i18next.t("help:embMaker.bitReedMsg"), bit: PermissionFlagsBits.ReadMessageHistory },
        { id: "sendMsg", name: i18next.t("help:embMaker.bitSendMessages"), bit: PermissionFlagsBits.SendMessages },
        { id: "addlink", name: i18next.t("help:embMaker.bitAddLink"), bit: PermissionFlagsBits.EmbedLinks },
        { id: "addfiles", name: i18next.t("help:embMaker.bitAddFiles"), bit: PermissionFlagsBits.AttachFiles },
        { id: "roles", name: i18next.t("help:embMaker.bitRoles"), bit: PermissionFlagsBits.ManageRoles },
        { id: "reactions", name: i18next.t("help:embMaker.bitReacciones"), bit: PermissionFlagsBits.AddReactions },
        { id: "emojis", name: i18next.t("help:embMaker.bitEmojis"), bit: PermissionFlagsBits.UseExternalEmojis },
        { id: "chManager", name: i18next.t("help:embMaker.bitChManager"), bit: PermissionFlagsBits.ManageChannels },
        { id: "voiceMove", name: i18next.t("help:embMaker.bitVoiceMove"), bit: PermissionFlagsBits.MoveMembers },
        { id: "voiceConnect", name: i18next.t("help:embMaker.bitVoiceConnect"), bit: PermissionFlagsBits.Connect },
    ];

    const allBits = [...mngrBitsList, ...meltrysList];

    let bits;
    switch (idComamnd) {
        case "meltrys":
            bits = meltrysList; break;
        case "mngrBits":
            bits = mngrBitsList; break;
        case "todos":
            bits = allBits; break;
        default:
            const choisdBit = idComamnd.split("|");
            bits = allBits.filter(bit => choisdBit.includes(bit.id)); break;
    }

    return bits.map(bitObj => {
        const hasPerm = chkPerm?.has(bitObj.bit) ?? false;
        const chkEmoji = hasPerm ? "✅" : "❌";
        return `> **${bitObj.name}**ㅤ${chkEmoji}`;
    });
}

// Nota: Modulo para llamar el check 
/* Tipo por canal!!
    const me = canalDestino.permissionsFor(guild.members.me!);
    const perChTo = testPermisos(me, "viewCh|sendMsg|addlink|addfiles");
    if (perChTo.some(p => p.includes("❌"))) {
        await interaction.editReply({ content: i18next.t("common:Errores.missing_permissions", { a1: `<#${discordChannel.id}>`, a2: perChTo.join("\n") }) });
        return;
    }
*/ /* Tipo General!!
    const im = interaction.guild?.members.me?.permissions;
    const serPrm = testPermisos(im, "viewCh|sendMsg|addlink|addfiles");
    if (serPrm.some(p => p.includes("❌"))) {
        await interaction.editReply({ content: `❌ El bot no tiene permisos suficientes en <#${canalDestino.id}>:\n${serPrm.join("\n")}` });
        return;
    }
*/

