import { ChatInputCommandInteraction, EmbedBuilder, Guild, GuildTextBasedChannel, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import i18next from "i18next";
import { hasPermission } from "../../sys/zGears/mPermission";
import { error } from "../../sys/logging";
import emjs from '../../../adds/otros/emojis.json'

export async function registerSrvStatsCommand(): Promise<SlashCommandBuilder[]> {
    const myStsts = new SlashCommandBuilder()
        .setName("srv_stats")
        .setDescription("Muestra las estadisticas del server!!")
        .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
    return [myStsts] as SlashCommandBuilder[];
}


const isRunning = new Map<string, boolean>()
export async function handleSrvStatsCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const { guild, channel, commandName } = interaction;

    const isAllowed = await hasPermission(interaction, commandName);
    if (!isAllowed) { await interaction.reply({ content: i18next.t("common:Errores.isAllowed") }); return; };

    if (!guild) { await interaction.reply(i18next.t("common:Errores.noGuild")); return };

    const ch: GuildTextBasedChannel | null = (channel && !channel.isDMBased() && channel.isSendable()) ? channel : null;
    if (!ch) { await interaction.reply("No tengo permisos para responer en el canal!") };

    try {
        if (isRunning.get(guild.id)) { await interaction.reply({ content: i18next.t("common:Errores.isRunning", { a1: commandName }) }); return; };
        isRunning.set(guild.id, true)

        await getStats(interaction, guild)

    } catch (e) {
        error(`Fallo al procesar el coamndo /srv_stats || Guidl: ${guild.id} Error: ${e}`);
        if (interaction.replied || interaction.deferred) { await interaction.editReply(i18next.t("common:Errores.switch_catch_err", { a1: commandName })); }
        else { await interaction.reply({ content: i18next.t("common:Errores.switch_catch_err", { a1: commandName }), flags: MessageFlags.Ephemeral }); }
    } finally { isRunning.delete(guild.id) }
}


async function getStats(interaction: ChatInputCommandInteraction, guild: Guild) {
    await interaction.deferReply()
    const { memberCount, createdAt, id, name, afkChannel, ownerId, nsfwLevel, roles, description, emojis, premiumTier, premiumSubscriptionCount, channels, verified } = guild

    try {
        const nsfwLvl: Record<number, string> = { 0: "Predeterminado", 1: "Tiene contenido para adultos", 2: "Libre de contenido para adultos", 3: "Requiere verificación de edad!" };
        const premLvl: Record<number, string> = { 0: "Ninguno", 1: "Tier 1", 2: "Tier 2", 3: "Tier 3" };
        const emojisAvi = emojis.cache.filter(x => x.available);

        const txtDesc = () => {
            const txtL = [
                `## 📊 Server stats!`,
                "",
                `**Nombre:** ${name}`,
                `**ID del Servidor:** \`${id}\``,
                `**Dueño:** <@${ownerId}>`,
                `**Premium:** ${premLvl[premiumTier]} ${premiumSubscriptionCount ? `| **Mejoras:** ${premiumSubscriptionCount}` : ""}`,
                `**Creado:** <t:${Math.floor(createdAt.getTime() / 1000)}:R>`,
                `**Verificado:** ${verified ? emjs.common.grnMark : emjs.common.redMark}`,
                "",
                `** Descripción:** ${description || 'Sin descripción'} `,
                `** Canal AFK:** ${afkChannel || 'Sin asignar'} `,
                `** Filtro NSFW:** ${nsfwLvl[nsfwLevel] || 'Desconocido'} `,
                "",
                `** Miembros:** ${memberCount} `,
                `** Canales:** ${channels.cache.size} `,
                `** Roles:** ${roles.cache.size} `,
                "",
                `** EMOJIS(${emojisAvi.size}):** ${emojisAvi.size > 0 ? emojisAvi.map(e => e.toString()).join(" ") : 'Sin Emojis'} `,
            ];
            return txtL.join("\n");
        };

        const dtaFoot = { text: `Solicitado por @${interaction.user.tag} `, iconURL: interaction.user.displayAvatarURL() };
        const emb = new EmbedBuilder().setDescription(txtDesc()).setTimestamp().setFooter(dtaFoot).setColor(0x5865F2);

        if (guild.iconURL()) emb.setThumbnail(guild.iconURL());
        if (guild.bannerURL()) emb.setImage(guild.bannerURL());

        await interaction.editReply({ embeds: [emb] })
    } catch (e: any) {
        error(`Fallo al obtener stats del server | Guild: ${guild.id} | Error: ${e.message} `);
    }
}