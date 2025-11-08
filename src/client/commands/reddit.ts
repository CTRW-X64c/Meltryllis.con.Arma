import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, TextChannel } from "discord.js";
import { addRedditFeed, getRedditFeeds, removeRedditFeed, RedditFeed} from "../../sys/database";
import { error, info } from "../../sys/logging";
import i18next from "i18next";
import { RedditApiResponse } from "../coreCommands/redditCheck"

const redditDomain = process.env.REDDIT_FIX_URL || "reddit.com";

function getSubredditNameFromUrl(input: string): string | null {
    try {
        const urlObject = new URL(input);
        const match = urlObject.pathname.match(/\/r\/([a-zA-Z0-9_]+)/);
        if (match) return match[1];
    } catch (e) {
    }
    const rSlashMatch = input.match(/^r\/([a-zA-Z0-9_]+)$/);
    if (rSlashMatch) return rSlashMatch[1];
    const simpleMatch = input.match(/^[a-zA-Z0-9_]+$/);
    if (simpleMatch) return simpleMatch[1];
    return null;
}

export async function registerRedditCommand() {
    const reddit = new SlashCommandBuilder()
        .setName("reddit")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
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

    const memberPermissions = interaction.memberPermissions;
    const isAdmin = memberPermissions?.has(PermissionFlagsBits.ManageGuild) || interaction.guild?.ownerId === interaction.user.id;
    if (!isAdmin) {
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
    } catch (err) {
        error(`Error ejecutando comando Reddit: ${err}`);
        await interaction.editReply({ content: i18next.t("command_error", { ns: "reddit" })});
    }
}

// =============== SubSeguir =============== //
async function SeguiReddit(interaction: ChatInputCommandInteraction, guildId: string) {
    const userInput = interaction.options.getString("url_reddit", true);
    const discordChannelInput = interaction.options.getChannel("canal", true);
    const discordChannel = interaction.guild!.channels.cache.get(discordChannelInput.id);

    if (!discordChannel || !discordChannel.isTextBased()) {
        await interaction.editReply({ content: i18next.t("command_reddit_canal_error", { ns: "reddit" })});
        return;
    }
    
    const subredditName = getSubredditNameFromUrl(userInput);
    if (!subredditName) {
        await interaction.editReply({ content: i18next.t("command_reddit_subreddit_error", { ns: "reddit" })});
        return;
    }
    const filterMode = (interaction.options.getString("filtro") ?? 'all') as 'all' | 'media_only' | 'text_only';

    const jsonUrl = `https://www.reddit.com/r/${subredditName}/new/.json`;
    
    try {
        const response = await fetch(jsonUrl, { headers: { 'User-Agent': 'MeltryllisBot/1.0.0' } });
        if (!response.ok) {
            throw new Error('Subreddit no encontrado o privado');
        }

        const existingFeeds = await getRedditFeeds(guildId);
        if (existingFeeds.some(feed => feed.subreddit_name.toLowerCase() === subredditName.toLowerCase())) {
            await interaction.editReply({ content: i18next.t("command_reddit_duplicado", { ns: "reddit", a1: subredditName })});
            return;
        }

        await addRedditFeed({
            guild_id: guildId,
            channel_id: discordChannel.id,
            subreddit_name: subredditName,
            subreddit_url: jsonUrl,
            last_post_id: null,
            filter_mode: filterMode  // Parche filtrado
        });

       const filterToText = {
            all: i18next.t("command_reddit_sin_filtro", { ns: "reddit" }),
            media_only: i18next.t("command_reddit_filtro_multimedia", { ns: "reddit" }),
            text_only: i18next.t("command_reddit_filtro_texto", { ns: "reddit" })};
        const filterText = filterToText[filterMode] || i18next.t("command_reddit_sin_filtro", { ns: "reddit" }); 
        await interaction.editReply({
            content: i18next.t("command_reddit_seguir_success", { ns: "reddit", a1: subredditName, a2: discordChannel.toString(), a3: filterText})
        });
        info(`Nuevo subreddit seguido: r/${subredditName} en servidor ${guildId}`);

    } catch (err) {
        error(`Error siguiendo r/${subredditName}: ${err}`);
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
    
    const guildName = interaction.guild!.name;
    const embed = new EmbedBuilder()
        .setTitle(i18next.t("command_reddit_lista_titulo", { ns: "reddit", a1: feeds.length, a2: guildName }))
        .setColor(0xFF4500);

    const feedsPorCanal = new Map<string, RedditFeed[]>();

    for (const feed of feeds) {
        if (!feedsPorCanal.has(feed.channel_id)) {
            feedsPorCanal.set(feed.channel_id, []);
        }
        feedsPorCanal.get(feed.channel_id)!.push(feed);
    }

    for (const [canalId, grupo] of feedsPorCanal) {
        const canalClickeable = `<#${canalId}>`;
        const listaSubreddits = grupo.map(feed =>
        `**r/${feed.subreddit_name}**`
        ).join('\n');

        embed.addFields({
        name: i18next.t("command_reddit_lista_name", { ns: "reddit", a1: canalClickeable, a2: grupo.length }),
        value: listaSubreddits || i18next.t("command_reddit_lista_value", { ns: "reddit" }),
        inline: false,
        });
    }
    
    embed.setFooter({ text: i18next.t("command_reddit_lista_footer", { ns: "reddit" })});
    await interaction.editReply({ embeds: [embed] });
}

// =============== SubDejar =============== //
async function DejarReddit(interaction: ChatInputCommandInteraction, guildId: string) {
    const userInput = interaction.options.getString("url_reddit", true);
    const subredditName = getSubredditNameFromUrl(userInput);

    if (!subredditName) {
        await interaction.editReply({ content: i18next.t("command_reddit_url_invalida", { ns: "reddit" })});
        return;
    }

    try {
        const removed = await removeRedditFeed(guildId, subredditName);
        if (removed) {
            await interaction.editReply({ content: i18next.t("command_reddit_dejar_success", { ns: "reddit", a1: subredditName})});
            info(`Subreddit eliminado: r/${subredditName} del servidor ${guildId}`);
        } else {
            await interaction.editReply({ content: i18next.t("command_reddit_dejar_error", { ns: "reddit", a1: subredditName})});
        }
    } catch (err) {
        error(`Error eliminando r/${subredditName}: ${err}`);
        await interaction.editReply({ content: i18next.t("command_reddit_borrarSubs_error", { ns: "reddit" })});
    }
}

// =============== SubTest =============== //
async function TestReddit(interaction: ChatInputCommandInteraction, guildId: string) {
    const userInput = interaction.options.getString("url_reddit", true);
    const subredditName = getSubredditNameFromUrl(userInput);

    if (!subredditName) {
        await interaction.editReply({ content: i18next.t("command_reddit_test_url_invalida", { ns: "reddit" })});
        return;
    }
    
    const feeds = await getRedditFeeds(guildId);
    const feed = feeds.find(f => f.subreddit_name.toLowerCase() === subredditName.toLowerCase());

    if (!feed) {
        await interaction.editReply({ content: i18next.t("command_reddit_test_subreddit_error", { ns: "reddit" })});
        return;
    }

    await interaction.editReply({ content: i18next.t("command_reddit_test_buscando", { ns: "reddit" , a1: subredditName })});

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

        await (channel as TextChannel).send(i18next.t("command_reddit_test_ultimoPost", { ns: "reddit", a1: subredditName, a2: latestPostData.title, a3: formattedUrl }));
        
        await interaction.editReply({
            content: i18next.t("command_reddit_test_pass", { ns: "reddit", a1: canalClickeable})
        });

    } catch (err) {
        error(`Error en prueba de r/${subredditName}: ${err}`);
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