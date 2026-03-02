// src/Events-Commands/commands/reddit.ts
import { ChannelType, ChatInputCommandInteraction, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, TextChannel } from "discord.js";
import { addRedditFeed, getRedditFeeds, removeRedditFeed, RedditFeed} from "../../sys/DB-Engine/links/Reddit";
import { RedditApiResponse } from "../eventGear/redditCheck";
import { error, debug} from "../../sys/logging";
import { redditApi } from "../../sys/zGears/RedditApi";
import { hasPermission } from "../../sys/zGears/mPermission";
import i18next from "i18next";

const redditDomain = process.env.REDDIT_FIX_URL || "reddit.com";

function getSubredditNameFromUrl(input: string): string | null {
    try {
    const urlObject = new URL(input);
    const subredditMatch = urlObject.pathname.match(/\/r\/([a-zA-Z0-9_-]+)/);
    const userMatch = urlObject.pathname.match(/\/user\/([a-zA-Z0-9_-]+)/);

    if (subredditMatch) return subredditMatch[1];
    if (userMatch) return userMatch[1];
    } catch (e) { /*regresado, aun que parece inutil esto sirve para algo*/ }

    const urlMatch = input.match(/(?:reddit\.com\/(?:r|user)\/|^(?:r|u)\/)([a-zA-Z0-9_-]+)/);
    if (urlMatch) return urlMatch[1];
    
    const rSlashMatch = input.match(/^(?:r|u)\/([a-zA-Z0-9_-]+)$/);
    if (rSlashMatch) return rSlashMatch[1];
    
    const simpleMatch = input.match(/^[a-zA-Z0-9_-]+$/);
    if (simpleMatch) return simpleMatch[0];
    
    return null;
}

function getRedditResourceInfo(input: string): { name: string; displayName: string; endpoint: string; resourceType: 'subreddit' | 'user'; } | null {
    const name = getSubredditNameFromUrl(input);
    if (!name) return null;

    let displayName: string;
    let endpoint: string;
    let resourceType: 'subreddit' | 'user';  //pusimos sauceType en vez de resourceType

    if (input.includes('/user/') || input.startsWith('u/')) {
        displayName = `u/${name}`;
        endpoint = `/user/${name}`; // Para la API autenticada
        resourceType  = `user`;
    } else {
        displayName = `r/${name}`;
        endpoint = `/r/${name}`; // Para la API autenticada
        resourceType = `subreddit`;
    }
    
    return { name, displayName, endpoint, resourceType };
}

function checkIfNSFW(channel: any): boolean {
    if (!channel) return false;
    return 'nsfw' in channel ? Boolean(channel.nsfw) : false;
}

export async function registerRedditCommand() {
    const reddit = new SlashCommandBuilder()
        .setName("reddit")
        .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
        .setDescription(i18next.t("reddit:slashBuilder.command_reddit"))
        .addSubcommand(subcommand =>
            subcommand
                .setName("seguir")
                .setDescription(i18next.t("reddit:slashBuilder.descripcion"))
                .addStringOption(option =>
                    option.setName("url_reddit")
                        .setDescription(i18next.t("reddit:slashBuilder.seguir"))
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option.setName("canal")
                        .addChannelTypes(ChannelType.GuildText, ChannelType.PrivateThread, ChannelType.PublicThread, ChannelType.GuildAnnouncement)
                        .setDescription(i18next.t("reddit:slashBuilder.canal"))
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName("filtro")
                        .setDescription(i18next.t("reddit:slashBuilder.filtro"))
                        .setRequired(true)
                        .addChoices(
                            { name: i18next.t("reddit:slashBuilder.sin_filtro"), value: 'all' },
                            { name: i18next.t("reddit:slashBuilder.filtro_multimedia"), value: 'media_only'},
                            { name: i18next.t("reddit:slashBuilder.filtro_texto"), value: 'text_only'}
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName("lista")
                .setDescription(i18next.t("reddit:slashBuilder.lista"))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("dejar")
                .setDescription(i18next.t("reddit:slashBuilder.dejar"))
                .addStringOption(option =>
                    option.setName("url_reddit")
                        .setDescription(i18next.t("reddit:slashBuilder.id_canal"))
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("test")
                .setDescription(i18next.t("reddit:slashBuilder.test"))
                .addStringOption(option =>
                    option.setName("url_reddit")
                        .setDescription(i18next.t("reddit:slashBuilder.id_canal"))
                        .setRequired(true)
                )
        );

    return [reddit] as SlashCommandBuilder[];
}

export async function handleRedditCommand(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const isAllowed = await hasPermission(interaction, interaction.commandName);
    if (!isAllowed) {
        await interaction.editReply({
            content: i18next.t("common:Errores.isAllowed"),
        });
        return;
    }
    
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild!.id;

    try {
        switch (subcommand) {
            case "seguir":
                await SeguiReddit(interaction, guildId);
                break;
            case "lista":
                await ListaReddit(interaction, guildId);
                break;
            case "dejar":
                await DejarReddit(interaction, guildId);
                break;
            case "test":
                await TestReddit(interaction, guildId);
                break;
        }
    } catch (err: any) {
        let errorMessage = 'Error';
        if (err instanceof TypeError && err.message === 'Invalid URL') errorMessage = 'Error: URL invalida!';
        error(`Error ejecutando comando Reddit: ${err}`);
        await interaction.editReply({ content: i18next.t("reddit:command_error", { a1: errorMessage })});
    }
}

// =============== SubSeguir =============== //
async function SeguiReddit(interaction: ChatInputCommandInteraction, guildId: string) {
    const userInput = interaction.options.getString("url_reddit", true);
    const discordChannelInput = interaction.options.getChannel("canal", true);
    const discordChannel = interaction.guild!.channels.cache.get(discordChannelInput.id);
    const nsfwStatus = checkIfNSFW(discordChannel);

    if (!discordChannel || !discordChannel.isTextBased()) {
        await interaction.editReply({ content: i18next.t("common:Errores.noChannel")});
        return;
    }
    
    const resourceInfo = getRedditResourceInfo(userInput);
    if (!resourceInfo) {
        await interaction.editReply({ content: i18next.t("reddit:interacciones.subreddit_error")});
        return;
    }

    const { name: resourceName, displayName, endpoint, resourceType } = resourceInfo;
    const filterMode = (interaction.options.getString("filtro") ?? 'all') as 'all' | 'media_only' | 'text_only';

    try {
        const response = await redditApi.fetchAuthenticated(endpoint);
        if (response.status === 404) {
            await interaction.editReply({content: i18next.t("reddit:interacciones.add_not_found", { subreddit: resourceName })});
            return;
        }

        const existingFeeds = await getRedditFeeds(guildId);
        if (existingFeeds.some(feed => feed.subreddit_name.toLowerCase() === resourceName.toLowerCase())) {
            await interaction.editReply({ content: i18next.t("reddit:interacciones.duplicado", { a1: displayName })});
            return;
        }

        let jsonUrl: string;
        if (resourceType === 'subreddit') {
            jsonUrl = `https://www.reddit.com/r/${resourceName}/new.json`;
        } else {
            jsonUrl = `https://www.reddit.com/user/${resourceName}/submitted.json`;
        }
        
        await addRedditFeed({
            guild_id: guildId,
            channel_id: discordChannel.id,
            subreddit_name: resourceName, // Input de url si es tipo User o Subreddit
            subreddit_url: jsonUrl,
            last_post_id: null,
            filter_mode: filterMode, // Parche filtrado
            nsfw_protect: nsfwStatus
        });

        const filterToText = {
            all: i18next.t("reddit:slashBuilder.sin_filtro"),
            media_only: i18next.t("reddit:slashBuilder.filtro_multimedia"),
            text_only: i18next.t("reddit:slashBuilder.filtro_texto")};
        const filterText = filterToText[filterMode] || i18next.t("reddit:slashBuilder.sin_filtro"); 
        
        await interaction.editReply({
            content: nsfwStatus 
                ? i18next.t("reddit:interacciones.seguir_success_nsfw", { a1: displayName, a2: discordChannel.toString(), a3: filterText})
                : i18next.t("reddit:interacciones.seguir_success", { a1: displayName, a2: discordChannel.toString(), a3: filterText})
        });
        debug(`Se registro nuevo follow: ${displayName}`);

    } catch (err) {
        error(`Error al seguir ${displayName}: ${err}`);
        await interaction.editReply({ content: i18next.t("reddit:interacciones.seguir_error")});
    }
}

// =============== SubList =============== //
async function ListaReddit(interaction: ChatInputCommandInteraction, guildId: string) {
    const feeds = await getRedditFeeds(guildId);

    if (feeds.length === 0) {
        await interaction.editReply({ content: i18next.t("reddit:interacciones.lista_vacia")});
        return;
    }

    const feedsPorCanal = new Map<string, RedditFeed[]>();
    const guildName = interaction.guild!.name;
    
    for (const feed of feeds) {
    if (!feedsPorCanal.has(feed.channel_id)) {
        feedsPorCanal.set(feed.channel_id, []);}
        feedsPorCanal.get(feed.channel_id)!.push(feed);
    }

    const embed = new EmbedBuilder()
        .setTitle(i18next.t("reddit:interacciones.lista_titulo", { a1: feeds.length, a2: guildName }))
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
        const sufijo = listaSubreddits.length > TAMANO_BLOQUE ? ` (Parte ${Math.floor(i/TAMANO_BLOQUE) + 1})` : '';
        const nombreCampo = `#${canalClickeable} - ${sufijo}`;
       
        embed.addFields({
            name: i18next.t("reddit:interacciones.lista_name", { a1: nombreCampo, a2: grupo.length }),
            value: bloque || i18next.t("reddit:interacciones.lista_value"),
            inline: false,
        });
    }}

    embed.setFooter({ text: i18next.t("reddit:interacciones.lista_footer")});
    await interaction.editReply({ embeds: [embed] });
}

// =============== SubDejar =============== //
async function DejarReddit(interaction: ChatInputCommandInteraction, guildId: string) {
    const userInput = interaction.options.getString("url_reddit", true);
    const resourceInfo = getRedditResourceInfo(userInput);

    if (!resourceInfo) {
        await interaction.editReply({ content: i18next.t("reddit:interacciones.url_invalida")});
        return;
    }

    const { name: resourceName, displayName } = resourceInfo;

    try {
        const removed = await removeRedditFeed(guildId, resourceName);
        if (removed) {
            await interaction.editReply({ content: i18next.t("reddit:interacciones.dejar_success", { a1: displayName})});
            debug(`Follow eliminado: ${displayName}`);
        } else {
            await interaction.editReply({ content: i18next.t("reddit:interacciones.dejar_error", { a1: displayName})});
        }
    } catch (err) {
        error(`Error al eliminar: ${displayName}: ${err}`);
        await interaction.editReply({ content: i18next.t("reddit:interacciones.borrarSubs_error")});
    }
}

// =============== SubTest =============== //
async function TestReddit(interaction: ChatInputCommandInteraction, guildId: string) {
    const userInput = interaction.options.getString("url_reddit", true);
    const resourceInfo = getRedditResourceInfo(userInput);

    if (!resourceInfo) {
        await interaction.editReply({ content: i18next.t("reddit:interacciones.test_url_invalida")});
        return;
    }
    
    const { name: resourceName, displayName } = resourceInfo;
    const feeds = await getRedditFeeds(guildId);
    const feed = feeds.find(f => f.subreddit_name.toLowerCase() === resourceName.toLowerCase());

    if (!feed) {
        await interaction.editReply({ content: i18next.t("reddit:interacciones.test_subreddit_error")});
        return;
    }

    await interaction.editReply({ content: i18next.t("reddit:interacciones.test_buscando", { a1: displayName })});

    try {
        const response = await fetch(feed.subreddit_url, { headers: { 'User-Agent': 'MeltryllisBot/1.0.0' } });
        if (!response.ok) throw new Error('No se pudo acceder al JSON');
        const jsonData = (await response.json()) as RedditApiResponse; 
        const latestPostData = jsonData.data.children[0]?.data;

        if (!latestPostData) {
            await interaction.editReply({ content: i18next.t("reddit:interacciones.test_noposts")});
            return;
        }
        const canalClickeable = `<#${feed.channel_id}>`;
        const channel = interaction.guild?.channels.cache.get(feed.channel_id);
        if (!channel || !channel.isTextBased()) {
            await interaction.editReply({ content: i18next.t("common:Errores.noChannel", { a1: canalClickeable })});
            return;
        }
        
        const permalink = latestPostData.permalink;
        const formattedUrl = `https://www.${redditDomain}${permalink}`;

        await (channel as TextChannel).send(i18next.t("reddit:interacciones.test_ultimoPost", { a1: displayName, a2: latestPostData.title, a3: formattedUrl }));
        
        await interaction.editReply({
            content: i18next.t("reddit:interacciones.test_pass", { a1: canalClickeable})
        });

    } catch (err) {
        error(`Error en prueba de ${displayName}: ${err}`);
        await interaction.editReply({ content: i18next.t("reddit:interacciones.test_error")});
    }
}
