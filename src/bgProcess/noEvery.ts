import { ChatInputCommandInteraction, Client, EmbedBuilder, Events, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { error } from "../sys/logging";
import getPool from "../sys/DB-Engine/database";
import i18next from "i18next";
import { hasPermission } from "../sys/zGears/mPermission";
import { testPermisos } from "../sys/zGears/auxiliares";

let cacheGuilds: { [key: string]: { state: boolean, rol: string | null } } = {};
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
            if (message.deletable) {
                await message.delete();
                const msg = await message.channel.send(`❌ <@${message.author.id}>, las menciones globales \`@here/@everyone\` no están permitidas aquí.`);
                setTimeout(async () => { if (msg.deletable) await msg.delete().catch(() => { }); }, 4000);
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
        const [rows]: any = await pool.query("SELECT guild_id, state, role FROM noeveryone");
        cacheGuilds = {};
        for (const config of rows) {
            cacheGuilds[config.guild_id] = { state: Boolean(config.state), rol: config.role || null };
        } return true;
    } catch (e) { error(`Error cargando cache de anti-menciones: ${e}`); return false }
}

async function updateCache(guildId: string, state: boolean, role: string | null): Promise<void> {
    try {
        const pool = await getPool();
        await pool.query("INSERT INTO noeveryone (guild_id, state, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE state = ?, role = ?", [guildId, state, role, state, role]);
        cacheGuilds[guildId] = { state, rol: role };
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
        .addRoleOption(o => o.setName("rol").setRequired(false).setDescription(i18next.t("commands:noeveryone.slashBuilder.rol_description")));
    return [noEveryoneCommand] as SlashCommandBuilder[];
}

export async function handleNoEveryoneCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        const guildId = interaction.guildId;
        if (!guildId) { await interaction.reply({ content: i18next.t("commands:test.interacciones.dont_gg"), ephemeral: true, }); return }

        const isAllowed = await hasPermission(interaction, interaction.commandName);
        if (!isAllowed) { await interaction.editReply({ content: i18next.t("common:Errores.isAllowed"), }); return }

        const im = interaction.guild?.members.me?.permissions;
        const serPrm = testPermisos(im, "viewCh|readMsg|msgManager");
        if (serPrm.some(p => p.includes("❌"))) { await interaction.editReply({ content: `❌ No tengo permisos suficientes para ejecutar este comando: \n > ${serPrm.join("\n >")}` }); return }

        const state = interaction.options.getBoolean("estado");
        const role = interaction.options.getRole("rol");
        const actual = cacheGuilds[guildId];
        const tState = state !== null ? state : (actual?.state ?? false);
        let tRole = role ? role.id : (actual?.rol ?? null);
        if (role?.id === actual?.rol) tRole = null;

        await updateCache(guildId, tState, tRole);

        const emb = new EmbedBuilder()
            .setTitle(i18next.t("commands:noeveryone.interacciones.embMaker_title"))
            .setDescription(i18next.t("commands:noeveryone.interacciones.embMaker_footer"))
            .addFields(
                { name: i18next.t("commands:noeveryone.interacciones.embMaker_estado"), value: tState ? i18next.t("commands:noeveryone.interacciones.embMaker_estado_on") : i18next.t("commands:noeveryone.interacciones.embMaker_estado_off") },
                { name: i18next.t("commands:noeveryone.interacciones.embMaker_rol"), value: tRole ? `<@&${tRole}>` : i18next.t("commands:noeveryone.interacciones.embMaker_rol_none") })
            .setColor(0x00AE86)
            .setTimestamp();

        await interaction.editReply({ embeds: [emb] });
    } catch (e) { error(`Error ejecutando comando noeveryone: ${e}`, "Commands.NoEveryone"); }
}