import { ChatInputCommandInteraction, EmbedBuilder, Guild, GuildTextBasedChannel, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import i18next from "i18next";
import { hasPermission } from "../../sys/zGears/mPermission";
import { error } from "../../sys/logging";
import emjs from '../../../adds/otros/emojis.json'
import { getGuildReplacementConfig } from "../../sys/DB-Engine/links/Embed";
import { countItems, FeedTables } from "../../sys/DB-Engine/database";
import { getConfigMap } from "../../sys/DB-Engine/links/ReplyBots";
import { getRoleAssignments } from "../../sys/DB-Engine/links/Rolemoji";

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
                `**Premium:** ${premLvl[premiumTier]} ${premiumSubscriptionCount ? `|| **Mejoras:** ${premiumSubscriptionCount}` : ""}`,
                `**Creado:** <t:${Math.floor(createdAt.getTime() / 1000)}:R>`,
                `**Verificado:** ${verified ? emjs.cmn.ok : emjs.cmn.fail}`,
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
                "",
                `## MIS CONFIGURACIONES!`
            ];
            return txtL.join("\n");
        };

        const embDta = await embed(guild.id)
        const redSoc = await sociales(guild.id)
        const workDta = await workHer(guild.id)
        const roleMoji = await rolEmj(guild.id)

        const fieldSrv = [
            { name: "> Follow en redes sociales", value: redSoc },
            { name: "> Configuraciones de /embed", value: embDta },
            { name: "> Configuraciones de canles /work", value: workDta },
            { name: "> Configuraciones de /rolemoji", value: roleMoji }
        ]

        const dtaFoot = { text: `${interaction.user.tag} para mas info usa /help `, iconURL: interaction.user.displayAvatarURL() };
        const emb = new EmbedBuilder().setDescription(txtDesc()).setTimestamp().setFooter(dtaFoot).setColor(0x5865F2).addFields(fieldSrv);

        if (guild.iconURL()) emb.setThumbnail(guild.iconURL());
        if (guild.bannerURL()) emb.setImage(guild.bannerURL());

        await interaction.editReply({ embeds: [emb] })
    } catch (e: any) {
        error(`Fallo al obtener stats del server | Guild: ${guild.id} | Error: ${e.message} `);
    }
}


// ============== Aux ============== //
async function sociales(guild: string) { // X, Reddit, Youtube, Pixiv...
    const social: FeedTables[] = ['mangadex_feeds', 'reddit_feeds', 'youtube_feeds', 'followTweetX', 'pixivData', `blueskya`]
    const AT: Record<string, string> = { "mangadex_feeds": "Mangadex", "reddit_feeds": "Reddit", "youtube_feeds": "Youtube", "followTweetX": "Twitter", "pixivData": "Pixiv", "blueskya": "Bluesky" }
    const lines: string[] = [];

    for (const sc of social) {
        const count = await countItems(guild, sc)
        lines.push(`**${AT[sc]}:** ${count ?? 0} Suscripciones`)
    }

    return lines.join("\n")
}

async function embed(guild: string): Promise<string> { // embed
    const getDta = await getGuildReplacementConfig(guild);
    if (!getDta || getDta.size === 0) return "No hay configuraciones establecidas!";

    const lines: string[] = [];
    let count = 0;
    for (const [key, dta] of getDta) {
        count++;
        lines.push(`**Clave:** ${key} | **Enable:** ${dta.enabled ? emjs.cmn.ok : emjs.cmn.fail} | **Custom:** ${dta.custom_url ? dta.custom_url : emjs.cmn.fail}`);
        if (count >= 8) break;
    };
    if (count >= 8) lines.push(`mostrando ${count}/${getDta.size} usa \`/test\` para mas info`)

    return lines.join("\n");
}

async function workHer(guild: string) { // workhere
    const dtaWork = await getConfigMap();
    const guildDta = dtaWork.get(guild)
    if (!guildDta || guildDta.size === 0) return "Sin configuraciones"

    const lines: string[] = []
    let count = 0;
    for (const [ch, dta] of guildDta) {
        count++;
        lines.push(`**Canal:** <#${ch}> | **Reply:** ${dta.replyBots ? emjs.cmn.ok : emjs.cmn.fail} | **Work:** ${dta.enabled ? emjs.cmn.ok : emjs.cmn.fail}`);
        if (count >= 8) break;
    }
    if (count >= 8) lines.push(`mostrando ${count}/${guildDta.size} usa \`/test\` para mas info`)

    return lines.join("\n")
}

async function rolEmj(guil: string) { // rolemoji
    const emojis = await getRoleAssignments(guil);
    if (!emojis || emojis.size === 0) return "No existen configuraciones";

    const lines: string[] = [];
    let count = 0
    for (const dta of emojis.values()) {
        count++
        lines.push(`ID: ${dta.id} | Emoji: ${dta.emoji} | Rol: <@&${dta.roleId}>`);
        if (count >= 8) break;
    };
    if (count >= 8) lines.push(`mostrando ${count}/${emojis.size} usa \`/rolemoji list\` para mas info`)

    return lines.join("\n");
}