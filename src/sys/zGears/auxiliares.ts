// src/sys/zGears/auxiliares.ts
import { Client, Guild, GuildBasedChannel, GuildMember, PermissionFlagsBits, PermissionsBitField } from "discord.js";
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
    "skip": 2_500,
};

const left = (time: number): string => {
    const h = Math.floor(time / 3600000);
    const m = Math.floor((time % 3600000) / 60000);
    const s = Math.floor((time % 60000) / 1000);
    const t = [];
    if (h >= 1) t.push(h === 1 ? "una hora" : `${h} horas`);
    if (m >= 1) t.push(m === 1 ? "un minuto" : `${m} minutos`);
    if (s > 0 && h === 0) t.push(s === 1 ? "un segundo" : `${s} segundos`);
    return t.join(' y ') || '0 segundos';
}

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
        return { onCooldown: true, timeLeft: left(timeRemaining) };
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
const listBits = (lis?: string): { id: string, name: string, bit: bigint }[] => {
    const mngrBits = [
        // --- Maximo nivel ---
        { id: "admin", name: i18next.t("help:embMaker.bitAdmin"), bit: PermissionFlagsBits.Administrator },
        { id: "srvManager", name: i18next.t("help:embMaker.bitSrvManager"), bit: PermissionFlagsBits.ManageGuild },
        { id: "guildInsights", name: i18next.t("help:embMaker.bitGuildInsights"), bit: PermissionFlagsBits.ViewGuildInsights },
        { id: "guildMoney", name: i18next.t("help:embMaker.bitGuildMoney"), bit: PermissionFlagsBits.ViewCreatorMonetizationAnalytics },

        // --- Gestión Estructural ---
        { id: "roles", name: i18next.t("help:embMaker.bitRoles"), bit: PermissionFlagsBits.ManageRoles },
        { id: "chManager", name: i18next.t("help:embMaker.bitChManager"), bit: PermissionFlagsBits.ManageChannels },
        { id: "manageWebhooks", name: i18next.t("help:embMaker.bitManageWebhooks"), bit: PermissionFlagsBits.ManageWebhooks },
        { id: "manageEmojisAndStickers", name: i18next.t("help:embMaker.bitManageEmojisAndStickers"), bit: PermissionFlagsBits.ManageGuildExpressions },
        { id: "manageEvents", name: i18next.t("help:embMaker.bitManageEvents"), bit: PermissionFlagsBits.ManageEvents },

        // --- Moderación de Texto y Usuarios ---
        { id: "auditLog", name: i18next.t("help:embMaker.bitViewAuditLog"), bit: PermissionFlagsBits.ViewAuditLog },
        { id: "msgManager", name: i18next.t("help:embMaker.bitMsgManager"), bit: PermissionFlagsBits.ManageMessages },
        { id: "manageThreads", name: i18next.t("help:embMaker.bitManageThreads"), bit: PermissionFlagsBits.ManageThreads },
        { id: "manageNicknames", name: i18next.t("help:embMaker.bitManageNicknames"), bit: PermissionFlagsBits.ManageNicknames },
        { id: "moderateMembers", name: i18next.t("help:embMaker.bitModerateMembers"), bit: PermissionFlagsBits.ModerateMembers },
        { id: "kickMember", name: i18next.t("help:embMaker.bitKickMember"), bit: PermissionFlagsBits.KickMembers },
        { id: "banMember", name: i18next.t("help:embMaker.bitBanMember"), bit: PermissionFlagsBits.BanMembers },

        // --- Moderación de Voz ---
        { id: "muteMembers", name: i18next.t("help:embMaker.bitMuteMembers"), bit: PermissionFlagsBits.MuteMembers },
        { id: "deafenMembers", name: i18next.t("help:embMaker.bitDeafenMembers"), bit: PermissionFlagsBits.DeafenMembers },
        { id: "voiceMove", name: i18next.t("help:embMaker.bitVoiceMove"), bit: PermissionFlagsBits.MoveMembers },
    ];

    const commonBits = [
        // --- Ver canales ---
        { id: "viewCh", name: i18next.t("help:embMaker.bitChSee"), bit: PermissionFlagsBits.ViewChannel },
        { id: "readMsg", name: i18next.t("help:embMaker.bitReedMsg"), bit: PermissionFlagsBits.ReadMessageHistory },
        { id: "sendMsg", name: i18next.t("help:embMaker.bitSendMessages"), bit: PermissionFlagsBits.SendMessages },

        // --- Hilos (Threads) ---
        { id: "sendMsgThreads", name: i18next.t("help:embMaker.bitSendMessagesInThreads"), bit: PermissionFlagsBits.SendMessagesInThreads },
        { id: "cPublicT", name: i18next.t("help:embMaker.bitCreatePublicThreads"), bit: PermissionFlagsBits.CreatePublicThreads },
        { id: "cPrivateT", name: i18next.t("help:embMaker.bitCreatePrivateThreads"), bit: PermissionFlagsBits.CreatePrivateThreads },

        // --- Multimedia y Formato ---
        { id: "addlink", name: i18next.t("help:embMaker.bitAddLink"), bit: PermissionFlagsBits.EmbedLinks },
        { id: "addfiles", name: i18next.t("help:embMaker.bitAddFiles"), bit: PermissionFlagsBits.AttachFiles },
        { id: "reactions", name: i18next.t("help:embMaker.bitReacciones"), bit: PermissionFlagsBits.AddReactions },
        { id: "emojis", name: i18next.t("help:embMaker.bitEmojis"), bit: PermissionFlagsBits.UseExternalEmojis },
        { id: "useExStickers", name: i18next.t("help:embMaker.bitUseExternalStickers"), bit: PermissionFlagsBits.UseExternalStickers },

        // --- Interacción ---
        { id: "useComm", name: i18next.t("help:embMaker.bitUseApplicationCommands"), bit: PermissionFlagsBits.UseApplicationCommands },
        { id: "everyone", name: i18next.t("help:embMaker.bitMentionEveryone"), bit: PermissionFlagsBits.MentionEveryone },
        { id: "createInvite", name: i18next.t("help:embMaker.bitCreateInvite"), bit: PermissionFlagsBits.CreateInstantInvite },
        { id: "changeNickname", name: i18next.t("help:embMaker.bitChangeNickname"), bit: PermissionFlagsBits.ChangeNickname },

        // --- Permisos de Voz ---
        { id: "voiceConnect", name: i18next.t("help:embMaker.bitVoiceConnect"), bit: PermissionFlagsBits.Connect },
        { id: "speak", name: i18next.t("help:embMaker.bitSpeak"), bit: PermissionFlagsBits.Speak },
        { id: "stream", name: i18next.t("help:embMaker.bitStream"), bit: PermissionFlagsBits.Stream },
        { id: "useVAD", name: i18next.t("help:embMaker.bitUseVAD"), bit: PermissionFlagsBits.UseVAD },
        { id: "prioSpeak", name: i18next.t("help:embMaker.bitPrioritySpeaker"), bit: PermissionFlagsBits.PrioritySpeaker },
        { id: "toSpeak", name: i18next.t("help:embMaker.bitRequestToSpeak"), bit: PermissionFlagsBits.RequestToSpeak },
        { id: "embActiviti", name: i18next.t("help:embMaker.bitUseEmbeddedActivities"), bit: PermissionFlagsBits.UseEmbeddedActivities },
        { id: "panelSound", name: i18next.t("help:embMaker.bitUseSoundboard"), bit: PermissionFlagsBits.UseSoundboard },
        { id: "extSound", name: i18next.t("help:embMaker.bitUseExternalSounds"), bit: PermissionFlagsBits.UseExternalSounds },

        // --- Mensajería Especial y Aplicaciones ---
        { id: "sendTTS", name: i18next.t("help:embMaker.bitSendTTS"), bit: PermissionFlagsBits.SendTTSMessages },
        { id: "sendVoiceMsg", name: i18next.t("help:embMaker.bitSendVoiceMessages"), bit: PermissionFlagsBits.SendVoiceMessages },
        { id: "sendPolls", name: i18next.t("help:embMaker.bitSendPolls"), bit: PermissionFlagsBits.SendPolls },
        { id: "useExApps", name: i18next.t("help:embMaker.bitUseExternalApps"), bit: PermissionFlagsBits.UseExternalApps },
    ];

    if (lis === "mngrList") return mngrBits;
    if (lis === "commonList") return commonBits;
    return [...mngrBits, ...commonBits];
}

export function testPermisos(chkPerm: Readonly<PermissionsBitField>, idComamnd: string): string[] {
    let bits: { id: string, name: string, bit: bigint }[] = [];
    switch (idComamnd) {
        case "meltrys":
            bits = listBits("mngrList"); break;
        case "mngrBits":
            bits = listBits("commonList"); break;
        case "todos":
            bits = listBits(); break;
        default:
            const choisdBit = idComamnd.split("|");
            bits = listBits().filter(bit => choisdBit.includes(bit.id)); break;
    }

    const result: string[] = bits.map(bitObj => {
        const hasPerm = chkPerm?.has(bitObj.bit) ?? false;
        return `> ${hasPerm ? "✅" : "❌"} | **${bitObj.name}**`;
    });

    const chunks: string[] = [];
    let builChunk = "";
    for (const line of result) {
        const testBuild = builChunk ? `${builChunk}\n${line}` : line;
        if (testBuild.length > 1024) { chunks.push(builChunk); builChunk = line; }
        else { builChunk = testBuild; }
    }
    if (builChunk) chunks.push(builChunk);
    return chunks;
}

export function masterPerm(iMe: Guild | GuildBasedChannel, toTest: string): { ok: boolean, msg: string[] } {
    let im: Readonly<PermissionsBitField>
    if (iMe instanceof Guild) im = iMe.members.me!.permissions
    else im = iMe.permissionsFor(iMe.guild.members.me!)

    const testing = testPermisos(im, toTest);
    if (testing.some(p => p.includes("❌"))) { return { ok: false, msg: testing } }
    else { return { ok: true, msg: testing } }
}
/*
const testPerm = masterPerm(im, null)
if (!testPerm.ok) { await i.editReply({ content: i18next.t("common:Errores.missing_permissions", { a1: `<#${inCh.id}>`, a2: testPerm.msg.join('\n') }) }); return; }
*/
/* ======================================== Check Permisos ======================================== */
export async function topRol(guild: Guild, chkPerm: GuildMember, permIds?: string): Promise<string[]> {
    try {
        let myTopRol = 0;
        if (permIds) {
            const needPerm = permIds.split("|");
            const allBits = listBits();
            const bitChk = allBits.filter(bitObj => needPerm.includes(bitObj.id)).map(bitObj => bitObj.bit);
            if (bitChk.length > 0) {
                const sortedRoles = chkPerm.roles.cache.sort((a, b) => b.position - a.position);
                let foundPerm = false;
                for (const role of sortedRoles.values()) {
                    const hasPerms = bitChk.every(bit => role.permissions.has(bit));
                    if (hasPerms) { myTopRol = role.position; foundPerm = true; break; }
                }
                if (!foundPerm) { return [i18next.t("help:rolemaker.sin_roles_con_permisos_a")]; }
            } else { myTopRol = chkPerm.roles.highest.position; }
        } else { myTopRol = chkPerm.roles.highest.position; }

        const allRoles = await guild.roles.fetch();
        let vRoles = allRoles.filter(r => r.position < myTopRol && !r.managed && r.id !== guild.id);
        const rLines: string[] = vRoles.sort((a, b) => b.position - a.position).map(r => `> <@&${r.id}>`);

        if (rLines.length === 0) return [i18next.t("help:rolemaker.sin_roles_con_permisos")];

        const chunks: string[] = [];
        let builChunk = "";

        for (const line of rLines) {
            const tBuild = builChunk ? `${builChunk}\n${line}` : line;
            if (tBuild.length > 1024) { chunks.push(builChunk); builChunk = line; }
            else { builChunk = tBuild; }
        }
        if (builChunk) chunks.push(builChunk);
        return chunks;
    } catch (e) { error(`Error en generar topRol, Error: ${e}`); return [`ERROR AL GENERAR LISTA DE ROLES`]; };
}
