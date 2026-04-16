// src/Events-Commands/commands/reddit.ts
import { ChannelType, ChatInputCommandInteraction, EmbedBuilder, Guild, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { addRedditFeed, getRedditFeeds, removeRedditFeed, RedditFeed } from "../../sys/DB-Engine/links/Reddit";
import { RedditApiResponse } from "../../bgProcess/redditCheck";
import { error, debug } from "../../sys/logging";
import { redditApi } from "../../sys/zGears/RedditApi";
import { hasPermission } from "../../sys/zGears/mPermission";
import i18next from "i18next";
import { testPermisos } from "../../sys/zGears/auxiliares";
import urlStatusManager from "../../sys/embedding/domainChecker";

export async function registerRedditCommand() {
    const reddit = new SlashCommandBuilder()
        .setName("reddit")
        .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
        .setDescription(i18next.t("commands:reddit.slashBuilder.command_reddit"))
        .addSubcommand(subcommand =>
            subcommand
                .setName("seguir")
                .setDescription(i18next.t("commands:reddit.slashBuilder.descripcion"))
                .addStringOption(option =>
                    option.setName("url_reddit")
                        .setDescription(i18next.t("commands:reddit.slashBuilder.seguir"))
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option.setName("canal")
                        .addChannelTypes(ChannelType.GuildText, ChannelType.PrivateThread, ChannelType.PublicThread, ChannelType.GuildAnnouncement)
                        .setDescription(i18next.t("commands:reddit.slashBuilder.canal"))
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName("filtro")
                        .setDescription(i18next.t("commands:reddit.slashBuilder.filtro"))
                        .setRequired(true)
                        .addChoices(
                            { name: i18next.t("commands:reddit.slashBuilder.sin_filtro"), value: 'all' },
                            { name: i18next.t("commands:reddit.slashBuilder.filtro_multimedia"), value: 'media_only' },
                            { name: i18next.t("commands:reddit.slashBuilder.filtro_texto"), value: 'text_only' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName("lista")
                .setDescription(i18next.t("commands:reddit.slashBuilder.lista"))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("dejar")
                .setDescription(i18next.t("commands:reddit.slashBuilder.dejar"))
                .addStringOption(option =>
                    option.setName("url_reddit")
                        .setDescription(i18next.t("commands:reddit.slashBuilder.id_canal"))
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("test")
                .setDescription(i18next.t("commands:reddit.slashBuilder.test"))
                .addStringOption(option =>
                    option.setName("url_reddit")
                        .setDescription(i18next.t("commands:reddit.slashBuilder.id_canal"))
                        .setRequired(true)
                )
        );

    return [reddit] as SlashCommandBuilder[];
}

export async function handleRedditCommand(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guild = interaction.guild;
    if (!guild) {
        await interaction.editReply(i18next.t("common:Errores.noGuild"));
        return;
    }

    const isAllowed = await hasPermission(interaction, interaction.commandName);
    if (!isAllowed) {
        await interaction.editReply({
            content: i18next.t("common:Errores.isAllowed"),
        });
        return;
    }

    try {
        const subcommand = interaction.options.getSubcommand();
        switch (subcommand) {
            case "seguir":
                await SeguiReddit(interaction, guild);
                break;
            case "lista":
                await ListaReddit(interaction, guild);
                break;
            case "dejar":
                await DejarReddit(interaction, guild);
                break;
            case "test":
                await TestReddit(interaction, guild);
                break;
        }
    } catch (e) {
        error(`Error ejecutando comando Reddit: ${e}`);
        await interaction.editReply({ content: i18next.t("common.Errores.switchGeneral") });
    }
}

// =============== SubSeguir =============== //
async function SeguiReddit(interaction: ChatInputCommandInteraction, guild: Guild) {
    const urlReddit = interaction.options.getString("url_reddit", true);
    const channelOut = interaction.options.getChannel("canal", true);

    const discordChannel = guild.channels.cache.get(channelOut.id);
    if (!discordChannel || !discordChannel.isTextBased()) {
        await interaction.editReply({ content: i18next.t("common:Errores.noChannel") });
        return;
    }

    const me = discordChannel.permissionsFor(guild.members.me!);
    const perChTo = testPermisos(me, "chsee|sendmsg|addlink");
    if (perChTo.some(p => p.includes("❌"))) {
        await interaction.editReply({ content: i18next.t("common:Errores.missing_permissions", { a1: `<#${discordChannel.id}>`, a2: perChTo.join("\n") }) });
        return;
    }

    const checkIfNSFW = (channel: any): boolean => {
        if (!channel) return false;
        return 'nsfw' in channel ? Boolean(channel.nsfw) : false;
    }

    const resourceInfo = getRedditResourceInfo(urlReddit);
    if (!resourceInfo) {
        await interaction.editReply({ content: i18next.t("commands:reddit.interacciones.subreddit_error") });
        return;
    }

    const nsfwStatus = checkIfNSFW(discordChannel);
    const { name: resourceName, displayName, endpoint, resourceType } = resourceInfo;
    const filterMode = (interaction.options.getString("filtro") ?? 'all') as 'all' | 'media_only' | 'text_only';

    try {
        const response = await redditApi.fetchAuthenticated(endpoint);
        if (response.status === 404) {
            await interaction.editReply({ content: i18next.t("commands:reddit.interacciones.add_not_found", { a1: resourceName }) });
            return;
        }

        const existingFeeds = await getRedditFeeds(guild.id);
        if (existingFeeds.some(feed => feed.subreddit_name.toLowerCase() === resourceName.toLowerCase())) {
            await interaction.editReply({ content: i18next.t("commands:reddit.interacciones.duplicado", { a1: displayName }) });
            return;
        }

        let jsonUrl: string;
        if (resourceType === 'subreddit') {
            jsonUrl = `https://www.reddit.com/r/${resourceName}/new.json`;
        } else {
            jsonUrl = `https://www.reddit.com/user/${resourceName}/submitted.json`;
        }

        await addRedditFeed({
            guild_id: guild.id,
            channel_id: discordChannel.id,
            subreddit_name: resourceName, // Input de url si es tipo User o Subreddit
            subreddit_url: jsonUrl,
            last_post_id: null,
            filter_mode: filterMode, // Parche filtrado
            nsfw_protect: nsfwStatus
        });

        const filterToText = {
            all: i18next.t("commands:reddit.slashBuilder.sin_filtro"),
            media_only: i18next.t("commands:reddit.slashBuilder.filtro_multimedia"),
            text_only: i18next.t("commands:reddit.slashBuilder.filtro_texto")
        };
        const filterText = filterToText[filterMode] || i18next.t("commands:reddit.slashBuilder.sin_filtro");

        await interaction.editReply({
            content: nsfwStatus
                ? i18next.t("commands:reddit.interacciones.seguir_success_nsfw", { a1: displayName, a2: discordChannel.toString(), a3: filterText })
                : i18next.t("commands:reddit.interacciones.seguir_success", { a1: displayName, a2: discordChannel.toString(), a3: filterText })
        });
        debug(`Se registro nuevo follow: ${displayName}`);

    } catch (err) {
        error(`Error al seguir ${displayName}: ${err}`);
        await interaction.editReply({ content: i18next.t("commands:reddit.interacciones.seguir_error") });
    }
}

// =============== SubList =============== //
async function ListaReddit(interaction: ChatInputCommandInteraction, guild: Guild) {
    const feeds = await getRedditFeeds(guild.id);

    if (feeds.length === 0) {
        await interaction.editReply({ content: i18next.t("commands:reddit.interacciones.lista_vacia") });
        return;
    }

    const feedsPorCanal = new Map<string, RedditFeed[]>();
    const guildName = guild.name;

    for (const feed of feeds) {
        if (!feedsPorCanal.has(feed.channel_id)) {
            feedsPorCanal.set(feed.channel_id, []);
        }
        feedsPorCanal.get(feed.channel_id)!.push(feed);
    }

    const embed = new EmbedBuilder()
        .setTitle(i18next.t("commands:reddit.interacciones.lista_titulo", { a1: feeds.length, a2: guildName }))
        .setColor(0xFF4500);

    for (const [canalId, grupo] of feedsPorCanal) {
        const canalClickeable = `<#${canalId}>`;
        const listaSubreddits = grupo.map(feed => {
            const displayName = feed.subreddit_url.includes('/user/') ? `u/${feed.subreddit_name}` : `r/${feed.subreddit_name}`;
            return `**${displayName}**`;
        })

        /* Mangadex nos enseño que a esto le podria pasar lo mismo */
        const TAMANO_BLOQUE = 40;
        for (let i = 0; i < listaSubreddits.length; i += TAMANO_BLOQUE) {
            const bloque = listaSubreddits.slice(i, i + TAMANO_BLOQUE).join('\n');
            const sufijo = listaSubreddits.length > TAMANO_BLOQUE ? ` (Parte ${Math.floor(i / TAMANO_BLOQUE) + 1})` : '';
            const nombreCampo = `#${canalClickeable} - ${sufijo}`;

            embed.addFields({
                name: i18next.t("commands:reddit.interacciones.lista_name", { a1: nombreCampo, a2: grupo.length }),
                value: bloque || i18next.t("commands:reddit.interacciones.lista_value"),
                inline: false,
            });
        }
    }

    embed.setFooter({ text: i18next.t("commands:reddit.interacciones.lista_footer") });
    await interaction.editReply({ embeds: [embed] });
}

// =============== SubDejar =============== //
async function DejarReddit(interaction: ChatInputCommandInteraction, guild: Guild) {
    const userInput = interaction.options.getString("url_reddit", true);
    const resourceInfo = getRedditResourceInfo(userInput);

    if (!resourceInfo) {
        await interaction.editReply({ content: i18next.t("commands:reddit.interacciones.url_invalida") });
        return;
    }

    const { name: resourceName, displayName } = resourceInfo;

    try {
        const removed = await removeRedditFeed(guild.id, resourceName);
        if (removed) {
            await interaction.editReply({ content: i18next.t("commands:reddit.interacciones.dejar_success", { a1: displayName }) });
            debug(`Follow eliminado: ${displayName}`);
        } else {
            await interaction.editReply({ content: i18next.t("commands:reddit.interacciones.dejar_error", { a1: displayName }) });
        }
    } catch (err) {
        error(`Error al eliminar: ${displayName}: ${err}`);
        await interaction.editReply({ content: i18next.t("commands:reddit.interacciones.borrarSubs_error") });
    }
}

// =============== SubTest =============== //
async function TestReddit(interaction: ChatInputCommandInteraction, guild: Guild) {
    const userInput = interaction.options.getString("url_reddit", true);
    const resourceInfo = getRedditResourceInfo(userInput);

    if (!resourceInfo) {
        await interaction.editReply({ content: i18next.t("commands:reddit.interacciones.test_url_invalida") });
        return;
    }

    const { name: resourceName, displayName } = resourceInfo;
    const feeds = await getRedditFeeds(guild.id);
    const feed = feeds.find(f => f.subreddit_name.toLowerCase() === resourceName.toLowerCase());

    if (!feed) {
        await interaction.editReply({ content: i18next.t("commands:reddit.interacciones.test_subreddit_error") });
        return;
    }

    await interaction.editReply({ content: i18next.t("commands:reddit.interacciones.test_buscando", { a1: displayName }) });

    try {
        const response = await fetch(feed.subreddit_url, { headers: { 'User-Agent': 'MeltryllisBot/1.0.0' } });
        if (!response.ok) throw new Error('No se pudo acceder al JSON');
        const jsonData = (await response.json()) as RedditApiResponse;
        const latestPostData = jsonData.data.children[0]?.data;

        if (!latestPostData) {
            await interaction.editReply({ content: i18next.t("commands:reddit.interacciones.test_noposts") });
            return;
        }
        const canalClickeable = `<#${feed.channel_id}>`;
        const channel = guild.channels.cache.get(feed.channel_id);
        if (!channel || !channel.isTextBased()) {
            await interaction.editReply({ content: i18next.t("common:Errores.noChannel", { a1: canalClickeable }) });
            return;
        }

        const permalink = latestPostData.permalink;

        let apiDomain = urlStatusManager.getActiveUrl("APIs_FIX_URL");
        if (process.env.EMBEDEZ_REDDITCHECK === "0" || !apiDomain?.includes("embedez.com")) { apiDomain = null; }
        const redditDomain = urlStatusManager.getActiveUrl("REDDIT_FIX_URL");
        const upEmbeddingDomain = apiDomain ? `${apiDomain}?q=https://www.reddit.com` : redditDomain;

        const formattedUrl = `https://${upEmbeddingDomain}${permalink}`;

        await channel.send(i18next.t("commands:reddit.interacciones.test_ultimoPost", { a1: displayName, a2: latestPostData.title, a3: formattedUrl }));

        await interaction.editReply({
            content: i18next.t("commands:reddit.interacciones.test_pass", { a1: canalClickeable })
        });

    } catch (err) {
        error(`Error en prueba de ${displayName}: ${err}`);
        await interaction.editReply({ content: i18next.t("commands:reddit.interacciones.test_error") });
    }
}

// =============== Helpers =============== //
function getRedditResourceInfo(input: string): { name: string; displayName: string; endpoint: string; resourceType: 'subreddit' | 'user'; } | null {
    const getNameReddit = (url: string) => {
        try {
            const urlObject = new URL(url);
            const subredditMatch = urlObject.pathname.match(/\/r\/([a-zA-Z0-9_-]+)/);
            const userMatch = urlObject.pathname.match(/\/user\/([a-zA-Z0-9_-]+)/);

            if (subredditMatch) return subredditMatch[1];
            if (userMatch) return userMatch[1];
        } catch (e) { /*regresado, aun que parece inutil esto sirve para algo*/ }

        const urlMatch = url.match(/(?:reddit\.com\/(?:r|user)\/|^(?:r|u)\/)([a-zA-Z0-9_-]+)/);
        if (urlMatch) return urlMatch[1];

        const rSlashMatch = url.match(/^(?:r|u)\/([a-zA-Z0-9_-]+)$/);
        if (rSlashMatch) return rSlashMatch[1];

        const simpleMatch = url.match(/^[a-zA-Z0-9_-]+$/);
        if (simpleMatch) return simpleMatch[0];

        return null;
    }

    const name = getNameReddit(input);
    if (!name) return null;

    let displayName: string;
    let endpoint: string;
    let resourceType: 'subreddit' | 'user';  //pusimos sauceType en vez de resourceType

    if (input.includes('/user/') || input.startsWith('u/')) {
        displayName = `u/${name}`;
        endpoint = `/user/${name}`; // Para la API autenticada
        resourceType = `user`;
    } else {
        displayName = `r/${name}`;
        endpoint = `/r/${name}`; // Para la API autenticada
        resourceType = `subreddit`;
    }

    return { name, displayName, endpoint, resourceType };
}
