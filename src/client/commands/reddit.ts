import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, TextChannel } from "discord.js";
import { addRedditFeed, getRedditFeeds, removeRedditFeed } from "../../sys/database";
import { error, info } from "../../sys/logging";
import i18next from "i18next";
import Parser from 'rss-parser';

const parser = new Parser();
const redditDomain = process.env.REDDIT_FIX_URL || "rxddit.com";

// --- FUNCIÓN AUXILIAR QUE FALTABA ---
function getSubredditNameFromUrl(url: string): string | null {
    try {
        const urlObject = new URL(url);
        const match = urlObject.pathname.match(/\/r\/([a-zA-Z0-9_]+)/);
        return match ? match[1] : null;
    } catch (e) {
        const simpleMatch = url.match(/^[a-zA-Z0-9_]+$/);
        return simpleMatch ? simpleMatch[1] : null;
    }
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
        )
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
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("test")
                .setDescription(i18next.t("command_reddit_test", { ns: "reddit" }))
                .addStringOption(option =>
                    option.setName("url_reddit")
                        .setDescription(i18next.t("command_reddit_id_canal", { ns: "reddit" }))
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("help")
                .setDescription(i18next.t("command_reddit_help", { ns: "reddit" }))
        );

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

    const rssUrl = `https://www.reddit.com/r/${subredditName}/.rss`;

    try {
        const existingFeeds = await getRedditFeeds(guildId);
        if (existingFeeds.some(feed => feed.subreddit_name.toLowerCase() === subredditName.toLowerCase())) {
            await interaction.editReply({ content: i18next.t("command_reddit_duplicado", { ns: "reddit", a1: subredditName })});
            return;
        }

        await addRedditFeed({
            guild_id: guildId,
            channel_id: discordChannel.id,
            subreddit_name: subredditName,
            subreddit_url: rssUrl,
            last_post_id: null
        });

        await interaction.editReply({
            content: i18next.t("command_reddit_seguir_success", { ns: "reddit", a1: subredditName, a2: discordChannel.toString() })
        });
        info(`Nuevo subreddit seguido: r/${subredditName} en servidor ${guildId}`);

    } catch (err) {
        error(`Error siguiendo r/${subredditName}: ${err}`);
        await interaction.editReply({ content: i18next.t("command_reddit_seguir_error", { ns: "reddit" })});
    }
}

async function ListaReddit(interaction: ChatInputCommandInteraction, guildId: string) {
    const feeds = await getRedditFeeds(guildId);

    if (feeds.length === 0) {
        await interaction.editReply({ content: i18next.t("command_reddit_lista_vacia", { ns: "reddit" })});
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle(`📡 Subreddits seguidos en este servidor (${feeds.length})`)
        .setColor(0xFF4500);

    let description = "";
    for (const feed of feeds) {
        const channel = interaction.guild?.channels.cache.get(feed.channel_id);
        description += i18next.t("command_reddit_lista_entry", { ns: "reddit", a1: feed.subreddit_name, a2: channel || `Canal no entrado`,});
    }

    embed.setDescription(description);
    embed.setFooter({ text: i18next.t("command_reddit_lista_footer", { ns: "reddit" })});

    await interaction.editReply({ embeds: [embed] });
}

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
        const rssFeed = await parser.parseURL(feed.subreddit_url);
        const latestPost = rssFeed.items[0];

        if (!latestPost) {
            await interaction.editReply({ content: i18next.t("command_reddit_test_noposts", { ns: "reddit" })});
            return;
        }

        const channel = interaction.guild?.channels.cache.get(feed.channel_id);
        if (!channel || !channel.isTextBased()) {
            await interaction.editReply({ content: i18next.t("command_reddit_test_noexisteCH", { ns: "reddit", a1: feed.channel_id })});
            return;
        }
        
        const permalink = new URL(latestPost.link!).pathname;
        const formattedUrl = `https://www.${redditDomain}${permalink}`;

        await (channel as TextChannel).send(i18next.t("command_reddit_test_ultimoPost", { ns: "reddit", a1: subredditName, a2: latestPost.title, a3: formattedUrl }));
        
        await interaction.editReply({
            content: i18next.t("command_reddit_test_pass", { ns: "reddit", a1: channel})
        });

    } catch (err) {
        error(`Error en prueba de r/${subredditName}: ${err}`);
        await interaction.editReply({ content: i18next.t("command_reddit_test_error", { ns: "reddit" })});
    }
}

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