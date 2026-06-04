import { ChatInputCommandInteraction, Client, EmbedBuilder, Events, GuildMember, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { error } from "../sys/logging";
import getPool from "../sys/DB-Engine/database";
import i18next from "i18next";
import { hasPermission } from "../sys/zGears/mPermission";
import { testPermisos } from "../sys/zGears/auxiliares";

let banCount: { [key: string]: number } = {};
let time4ban: Map<string, NodeJS.Timeout> = new Map();
const banSpam = (member: GuildMember): boolean => {
    try {
        const id = `${member.guild.id}-${member.id}`;
        banCount[id] = (banCount[id] || 0) + 1;
        if (time4ban.has(id)) clearTimeout(time4ban.get(id));
        time4ban.set(id, setTimeout(() => { delete banCount[id]; time4ban.delete(id); }, 60_000));
        if (banCount[id] >= 3) {
            delete banCount[id]; clearTimeout(time4ban.get(id)); time4ban.delete(id); member.timeout(60 * 60_000, "No se permite el spam de menciones globales").catch(() => { });
            return true;
        } return false;
    } catch { return false; }
}

let cacheGuilds: { [key: string]: { state: boolean, penality: boolean, rol: string | null } } = {};
const mentionRegex = /@(here|everyone)\b/i;
function noEveryone(client: Client): void {
    client.on(Events.MessageCreate, async (message) => {
        if (!mentionRegex.test(message.content)) return;
        if (!client.user || message.author.bot) return;
        if (!message.guild?.id || !message.member) return;

        const guildConfig = cacheGuilds[message.guild.id];
        if (!guildConfig || !guildConfig.state) return;

        const allowedRole = guildConfig.rol;
        if (allowedRole && message.member.roles.cache.has(allowedRole)) return;
        try {
            let response = "";
            if (message.deletable) { await message.delete(); response = `❌ <@${message.author.id}>, las menciones globales \`@here/@everyone\` no están permitidas aquí.`; }
            if (guildConfig.penality) {
                const ban = banSpam(message.member);
                if (ban) { response = `🔨 <@${message.author.id}> fue suspendido 60 minutos por el anti-spam.`; }
            }
            if (response !== "") {
                const msg = await message.channel.send(response);
                setTimeout(async () => { if (msg.deletable) await msg.delete().catch(() => { }); }, 10_000);
            }
        } catch (e) {
            const err = (e as Error).message;
            if (!err.includes("Missing Permissions") && !err.includes("Missing Access")) { error(`Error en sistema anti-menciones, Guild: ${message.guild.name}, Error: ${e}`) }
        }
    });
}

/* ======================================== BD system ======================================== */
async function genCache(): Promise<boolean> {
    try {
        const pool = await getPool();
        const [rows]: any = await pool.query("SELECT guild_id, state, penality, role FROM noeveryone");
        cacheGuilds = {};
        for (const config of rows) {
            cacheGuilds[config.guild_id] = { state: Boolean(config.state), penality: Boolean(config.penality), rol: config.role || null };
        } return true;
    } catch (e) { error(`Error cargando cache de anti-menciones: ${e}`); return false }
}

async function updateCache(guildId: string, state: boolean, penality: boolean, role: string | null): Promise<void> {
    try {
        const pool = await getPool();
        await pool.query("INSERT INTO noeveryone (guild_id, state, penality, role) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE state = ?, penality = ?, role = ? ", [guildId, state, penality, role, state, penality, role]);
        cacheGuilds[guildId] = { state, penality, rol: role };
    } catch (e) { error(`Error actualizando cache de anti-menciones: ${e}`) }
}

/* ======================================== Init ======================================== */
export async function initNoEveryone(client: Client) {
    const rdy = await genCache();
    if (!rdy) error("¡No se pudo cargar la cache de anti-menciones!");
    noEveryone(client);
}

/* ======================================== Comando ======================================== */
export async function registernoEveryoneCommand(): Promise<SlashCommandBuilder[]> {
    const noEveryoneCommand = new SlashCommandBuilder()
        .setName("noeveryone")
        .setDescription(i18next.t("commands:noeveryone.slashBuilder.description"))
        .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
        .addBooleanOption(o => o.setName("activado").setRequired(false).setDescription(i18next.t("commands:noeveryone.slashBuilder.estado_description")))
        .addRoleOption(o => o.setName("rol").setRequired(false).setDescription(i18next.t("commands:noeveryone.slashBuilder.rol_description")))
        .addBooleanOption(o => o.setName("penalizar").setRequired(false).setDescription(i18next.t("commands:noeveryone.slashBuilder.penalidad_description")));
    return [noEveryoneCommand] as SlashCommandBuilder[];
}

export async function handleNoEveryoneCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        const guildId = interaction.guildId;
        if (!guildId) { await interaction.editReply({ content: i18next.t("commands:test.interacciones.dont_gg"), }); return }

        const isAllowed = await hasPermission(interaction, interaction.commandName);
        if (!isAllowed) { await interaction.editReply({ content: i18next.t("common:Errores.isAllowed"), }); return }

        const im = interaction.guild?.members.me?.permissions;
        const serPrm = testPermisos(im, "viewCh|readMsg|msgManager");
        if (serPrm.some(p => p.includes("❌"))) { await interaction.editReply({ content: i18next.t("commands:noeveryone.interacciones.no_Perms", { a1: serPrm.join("\n") }) }); return }
        let desc = i18next.t("commands:noeveryone.interacciones.embMaker_desc")
        const state = interaction.options.getBoolean("activado");
        const role = interaction.options.getRole("rol");
        const punish = interaction.options.getBoolean("penalizar");
        const actual = cacheGuilds[guildId];
        const tState = state !== null ? state : (actual?.state ?? false);
        let castigo = punish !== null ? punish : (actual?.penality ?? false);
        let tRole = role ? role.id : (actual?.rol ?? null);
        if (role?.id === actual?.rol) tRole = null;
        const x = testPermisos(im, "moderateMembers");
        if (x.some(p => p.includes("❌"))) { castigo = false; desc += i18next.t("commands:noeveryone.interacciones.embMaker_desc_2") }

        await updateCache(guildId, tState, castigo, tRole);

        const emb = new EmbedBuilder()
            .setTitle(i18next.t("commands:noeveryone.interacciones.embMaker_title"))
            .setDescription(desc)
            .addFields(
                { name: i18next.t("commands:noeveryone.interacciones.embMaker_estado"), value: tState ? i18next.t("commands:noeveryone.interacciones.embMaker_estado_on") : i18next.t("commands:noeveryone.interacciones.embMaker_estado_off") },
                { name: i18next.t("commands:noeveryone.interacciones.embMaker_penalidad"), value: castigo ? i18next.t("commands:noeveryone.interacciones.embMaker_estado_on") : i18next.t("commands:noeveryone.interacciones.embMaker_estado_off") },
                { name: i18next.t("commands:noeveryone.interacciones.embMaker_rol"), value: tRole ? `<@&${tRole}>` : i18next.t("commands:noeveryone.interacciones.embMaker_rol_none") }
            )
            .setColor(0x00AE86)
            .setTimestamp();

        await interaction.editReply({ embeds: [emb] });
    } catch (e) { error(`Error ejecutando comando noeveryone: ${e}`, "Commands.NoEveryone"); }
}