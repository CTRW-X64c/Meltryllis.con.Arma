// src/client/commands/reddit.ts
import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, TextChannel } from "discord.js";
import { addRedditFeed, getRedditFeeds, removeRedditFeed, RedditFeed} from "../../sys/DB-Engine/links/Reddit";
import { RedditApiResponse } from "../eventGear/redditCheck";
import { error, debug} from "../../sys/logging";
import { redditApi } from "../../sys/RedditApi";
import { hasPermission } from "../../sys/managerPermission";
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
        .setDescription(i18next.t("command_reddit", { ns: "reddit" }))
        .addSubcommand(subcommand =>
            subcommand
                .setName("seguir")
                .setDescription(i18next.t("command_reddit_descripcion", { ns: "reddit" }))
                .addStringOption(option =>
                    option.setName("url_reddit")
                        .setDescription(i18next.t("command_reddit_seguir", { ns: "reddit" }))
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option.setName("canal")
                        .setDescription(i18next.t("command_reddit_canal", { ns: "reddit" }))
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName("filtro")
                        .setDescription(i18next.t("command_reddit_filtro", { ns: "reddit" }))
                        .setRequired(true)
                        .addChoices(
                            { name: i18next.t("command_reddit_sin_filtro", { ns: "reddit" }), value: 'all' },
                            { name: i18next.t("command_reddit_filtro_multimedia", { ns: "reddit" }), value: 'media_only'},
                            { name: i18next.t("command_reddit_filtro_texto", { ns: "reddit" }), value: 'text_only'}
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName("lista")
                .setDescription(i18next.t("command_reddit_lista", { ns: "reddit" }))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("dejar")
                .setDescription(i18next.t("command_reddit_dejar", { ns: "reddit" }))
                .addStringOption(option =>
                    option.setName("url_reddit")
                        .setDescription(i18next.t("command_reddit_id_canal", { ns: "reddit" }))
                        .setRequired(true)
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName("test")
                .setDescription(i18next.t("command_reddit_test", { ns: "reddit" }))
                .addStringOption(option =>
                    option.setName("url_reddit")
                        .setDescription(i18next.t("command_reddit_id_canal", { ns: "reddit" }))
                        .setRequired(true)
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName("help")
                .setDescription(i18next.t("command_reddit_help", { ns: "reddit" })));

    return [reddit] as SlashCommandBuilder[];
}

export async function handleRedditCommand(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const isAllowed = hasPermission(interaction, interaction.commandName);
    if (!isAllowed) {
        await interaction.editReply({
            content: i18next.t("command_permission_error", { ns: "rolemoji" }),
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
            case "help":
                await RedditHelp(interaction);
                break;
        }
    } catch (err: any) {
        let errorMessage = 'Error';
        if (err instanceof TypeError && err.message === 'Invalid URL') errorMessage = 'Error: URL invalida!';
        error(`Error ejecutando comando Reddit: ${err}`);
        await interaction.editReply({ content: i18next.t("command_error", { ns: "reddit", a1: errorMessage })});
    }
}

// =============== SubSeguir =============== //
async function SeguiReddit(interaction: ChatInputCommandInteraction, guildId: string) {
    const userInput = interaction.options.getString("url_reddit", true);
    const discordChannelInput = interaction.options.getChannel("canal", true);
    const discordChannel = interaction.guild!.channels.cache.get(discordChannelInput.id);
    const nsfwStatus = checkIfNSFW(discordChannel);

    if (!discordChannel || !discordChannel.isTextBased()) {
        await interaction.editReply({ content: i18next.t("command_reddit_canal_error", { ns: "reddit" })});
        return;
    }
    
    const resourceInfo = getRedditResourceInfo(userInput);
    if (!resourceInfo) {
        await interaction.editReply({ content: i18next.t("command_reddit_subreddit_error", { ns: "reddit" })});
        return;
    }

    const { name: resourceName, displayName, endpoint, resourceType } = resourceInfo;
    const filterMode = (interaction.options.getString("filtro") ?? 'all') as 'all' | 'media_only' | 'text_only';

    try {
        const response = await redditApi.fetchAuthenticated(endpoint);
        if (response.status === 404) {
            await interaction.editReply({content: i18next.t("command_reddit_add_not_found", { ns: "reddit", subreddit: resourceName })});
            return;
        }

        const existingFeeds = await getRedditFeeds(guildId);
        if (existingFeeds.some(feed => feed.subreddit_name.toLowerCase() === resourceName.toLowerCase())) {
            await interaction.editReply({ content: i18next.t("command_reddit_duplicado", { ns: "reddit", a1: displayName })});
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
            all: i18next.t("command_reddit_sin_filtro", { ns: "reddit" }),
            media_only: i18next.t("command_reddit_filtro_multimedia", { ns: "reddit" }),
            text_only: i18next.t("command_reddit_filtro_texto", { ns: "reddit" })};
        const filterText = filterToText[filterMode] || i18next.t("command_reddit_sin_filtro", { ns: "reddit" }); 
        
        await interaction.editReply({
            content: nsfwStatus 
                ? i18next.t("command_reddit_seguir_success_nsfw", { ns: "reddit", a1: displayName, a2: discordChannel.toString(), a3: filterText})
                : i18next.t("command_reddit_seguir_success", { ns: "reddit", a1: displayName, a2: discordChannel.toString(), a3: filterText})
        });
        debug(`Se registro nuevo follow: ${displayName}`);

    } catch (err) {
        error(`Error al seguir ${displayName}: ${err}`);
        await interaction.editReply({ content: i18next.t("command_reddit_seguir_error", { ns: "reddit" })});
    }
}

// =============== SubList =============== //
async function ListaReddit(interaction: ChatInputCommandInteraction, guildId: string) {
    const feeds = await getRedditFeeds(guildId);

    if (feeds.length === 0) {
        await interaction.editReply({ content: i18next.t("command_reddit_lista_vacia", { ns: "reddit" })});
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
        .setTitle(i18next.t("command_reddit_lista_titulo", { ns: "reddit", a1: feeds.length, a2: guildName }))
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
            name: i18next.t("command_reddit_lista_name", { ns: "reddit", a1: nombreCampo, a2: grupo.length }),
            value: bloque || i18next.t("command_reddit_lista_value", { ns: "reddit" }),
            inline: false,
        });
    }}

    embed.setFooter({ text: i18next.t("command_reddit_lista_footer", { ns: "reddit" })});
    await interaction.editReply({ embeds: [embed] });
}

// =============== SubDejar =============== //
async function DejarReddit(interaction: ChatInputCommandInteraction, guildId: string) {
    const userInput = interaction.options.getString("url_reddit", true);
    const resourceInfo = getRedditResourceInfo(userInput);

    if (!resourceInfo) {
        await interaction.editReply({ content: i18next.t("command_reddit_url_invalida", { ns: "reddit" })});
        return;
    }

    const { name: resourceName, displayName } = resourceInfo;

    try {
        const removed = await removeRedditFeed(guildId, resourceName);
        if (removed) {
            await interaction.editReply({ content: i18next.t("command_reddit_dejar_success", { ns: "reddit", a1: displayName})});
            debug(`Follow eliminado: ${displayName}`);
        } else {
            await interaction.editReply({ content: i18next.t("command_reddit_dejar_error", { ns: "reddit", a1: displayName})});
        }
    } catch (err) {
        error(`Error al eliminar: ${displayName}: ${err}`);
        await interaction.editReply({ content: i18next.t("command_reddit_borrarSubs_error", { ns: "reddit" })});
    }
}

// =============== SubTest =============== //
async function TestReddit(interaction: ChatInputCommandInteraction, guildId: string) {
    const userInput = interaction.options.getString("url_reddit", true);
    const resourceInfo = getRedditResourceInfo(userInput);

    if (!resourceInfo) {
        await interaction.editReply({ content: i18next.t("command_reddit_test_url_invalida", { ns: "reddit" })});
        return;
    }
    
    const { name: resourceName, displayName } = resourceInfo;
    const feeds = await getRedditFeeds(guildId);
    const feed = feeds.find(f => f.subreddit_name.toLowerCase() === resourceName.toLowerCase());

    if (!feed) {
        await interaction.editReply({ content: i18next.t("command_reddit_test_subreddit_error", { ns: "reddit" })});
        return;
    }

    await interaction.editReply({ content: i18next.t("command_reddit_test_buscando", { ns: "reddit" , a1: displayName })});

    try {
        const response = await fetch(feed.subreddit_url, { headers: { 'User-Agent': 'MeltryllisBot/1.0.0' } });
        if (!response.ok) throw new Error('No se pudo acceder al JSON');
        const jsonData = (await response.json()) as RedditApiResponse; 
        const latestPostData = jsonData.data.children[0]?.data;

        if (!latestPostData) {
            await interaction.editReply({ content: i18next.t("command_reddit_test_noposts", { ns: "reddit" })});
            return;
        }
        const canalClickeable = `<#${feed.channel_id}>`;
        const channel = interaction.guild?.channels.cache.get(feed.channel_id);
        if (!channel || !channel.isTextBased()) {
            await interaction.editReply({ content: i18next.t("command_reddit_test_noexisteCH", { ns: "reddit", a1: canalClickeable })});
            return;
        }
        
        const permalink = latestPostData.permalink;
        const formattedUrl = `https://www.${redditDomain}${permalink}`;

        await (channel as TextChannel).send(i18next.t("command_reddit_test_ultimoPost", { ns: "reddit", a1: displayName, a2: latestPostData.title, a3: formattedUrl }));
        
        await interaction.editReply({
            content: i18next.t("command_reddit_test_pass", { ns: "reddit", a1: canalClickeable})
        });

    } catch (err) {
        error(`Error en prueba de ${displayName}: ${err}`);
        await interaction.editReply({ content: i18next.t("command_reddit_test_error", { ns: "reddit" })});
    }
}

// =============== SubHelp =============== //
async function RedditHelp(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
        .setTitle(i18next.t("command_reddit_HelpEmb_titulo", { ns: "reddit" }))
        .setColor(0xFF4500)
        .setDescription(i18next.t("command_reddit_HelpEmb_descripcion", { ns: "reddit" }))
        .addFields(
            {
            name: i18next.t("command_reddit_HelpEmb_Field_Name_1", { ns: "reddit" }),
            value: i18next.t("command_reddit_HelpEmb_Field_Value_1", { ns: "reddit" }),
            },
            { 
            name: i18next.t("command_reddit_HelpEmb_Field_Name_2", { ns: "reddit" }),
            value: i18next.t("command_reddit_HelpEmb_Field_Value_2", { ns: "reddit" }),
            },
            { 
            name: i18next.t("command_reddit_HelpEmb_Field_Name_3", { ns: "reddit" }),
            value: i18next.t("command_reddit_HelpEmb_Field_Value_3", { ns: "reddit" }),
            },
            { 
            name: i18next.t("command_reddit_HelpEmb_Field_Name_4", { ns: "reddit" }),
            value: i18next.t("command_reddit_HelpEmb_Field_Value_4", { ns: "reddit" }),
            }
        );
    await interaction.editReply({ embeds: [embed] });
}