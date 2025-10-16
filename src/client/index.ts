// src/client/core.ts
import { error, info, debug, initLogger, loggerAvailable } from "../logging";
import { getEnvironmentMode } from "../environment";
import { initI18n } from "../i18n";
import i18next from "i18next";
import { buildReplacements } from "../remplazadores/index";
import { registerCommands, handleCommandInteraction } from "./upCommands";
import { initializeDatabase, getConfigMap, getGuildReplacementConfig, getRoleAssignments } from "./database";
import { parseStatuses, setupStatusRotation } from "./setStatus";
import { Client, Events, GatewayIntentBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, Interaction, Message, MessageFlags, TextBasedChannel, ButtonInteraction } from "discord.js";
import ApiReplacement from "../remplazadores/ApiReplacement";
import { registerWelcomeEvents, preloadImagesAndFonts } from "./events/welcomeEvents";
import { registerRolemojiEvents } from "./events/rolemojiEvents";

const apiReplacementDomainsEnv = process.env.API_REPLACEMENT_DOMAINS ? process.env.API_REPLACEMENT_DOMAINS.split(',').map(s => s.trim()) : [];
const urlRegex = /(?:\[[^\]]*\]\()?(https?:\/\/[^\s\)]+)/g;
const replyToOtherBots = process.env.REPLY_OTHER_BOTS === "true";
const MAX_EMBEDS = 5;

async function preloadRolemojiMessages(client: Client) {
    debug(i18next.t("Preloading_rolemoji", { ns: "core"}), "Core");
    const guilds = client.guilds.cache.values();
    for (const guild of guilds) {
        const assignments = await getRoleAssignments(guild.id);        
        const messageIds = new Set(Array.from(assignments.values()).map(a => a.messageId));
        
        for (const messageId of messageIds) {
            try {
                const channels = guild.channels.cache.filter(c => c.isTextBased());
                for (const channel of channels.values()) {
                    try {
                        const message = await (channel as TextBasedChannel).messages.fetch(messageId as string);
                        if (message) {
                            debug(i18next.t("Fetched_rolemoji", {ns: "core", mensjid: messageId, gremio: guild.name }), "Core");
                            break;
                        }
                    } catch (err) {
                    }
                }
            } catch (err) {
                error(i18next.t("error_fetch_role_fail", {ns: "core", messageId: messageId, guild: guild.name, error: err }), "Core");
            }
        }
    }
}

export function createClient(): Client {
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.GuildMembers,
        ],
    });

    client.once(Events.ClientReady, async (eventClient) => {
        info(i18next.t("login_success", {ns: "core", userTag: eventClient.user.tag }), "Events.ClientReady");
        const guildCount = eventClient.guilds.cache.size;
        info(i18next.t("guilds_count", {ns: "core", guildCount: guildCount, pluralGuilds: guildCount === 1 ? "guild" : "guilds"}), "Events.ClientReady");
        const guildNames = eventClient.guilds.cache.map(guild => guild.name).join(", ");
        info(i18next.t("servers_list", {ns: "core", guildNames:guildNames}))
        info(i18next.t("reply_to_bots_config", {ns: "core", config:replyToOtherBots}))          

        try {
            await initializeDatabase();
        } catch (err) {
            error(i18next.t("database_init_fail", {ns: "core", error: err}))           
            process.exit(1);
        }

        const statusList = parseStatuses(process.env.BOT_STATUSES);
        setupStatusRotation(client, statusList);

        try {
            await preloadImagesAndFonts();
        } catch (err) {
            error(i18next.t("preload_images_fail", {ns: "core", error:err}));
        }
        
        await preloadRolemojiMessages(client);        
        registerWelcomeEvents(client);
        registerRolemojiEvents(client);
        registerCommands(client);
    });

    client.on(Events.InteractionCreate, async (interaction: Interaction) => {
        if (interaction.isChatInputCommand()) {
            await handleCommandInteraction(interaction);
        }
    });

    client.on(Events.MessageCreate, async (message) => {
        if (!client.user || message.author.id === client.user.id) {
            debug(i18next.t("Ignoring_message", {ns: "core", authorId: message.author.id }), "Events.MessageCreate");
            return;
        }

        const guildId = message.guild?.id;
        const channelId = message.channel.id;
        const guildReplacementConfig = guildId ? await getGuildReplacementConfig(guildId) : new Map();

        if (guildId) {
            const channelConfig = (await getConfigMap()).get(guildId)?.get(channelId);
            if (channelConfig?.enabled === false) {
                debug(i18next.t("channel_disabled", {ns: "core", channelId }), "Events.MessageCreate");
                return;
            }
            if (channelConfig?.replyBots === false && message.author.bot) {
                debug(i18next.t("reply_bots_disabled", {ns: "core", channelId }), "Events.MessageCreate");
                return;
            }
        } else if (!replyToOtherBots && message.author.bot) {
            debug(i18next.t("fallback_reply_bots_disabled", {ns: "core" }), "Events.MessageCreate");
            return;
        }
        
        const replacements = buildReplacements(guildReplacementConfig);
        const apiReplacer = new ApiReplacement();
        const urls = [...message.content.matchAll(urlRegex)];
        const replacedUrls: string[] = [];

        for (const match of urls) {
            let replacedUrl: string | null = null;
            let domainSite: string | null = null;
            const originalUrl = match[1];
            
            try {
                const urlObject = new URL(originalUrl);
                domainSite = urlObject.hostname.replace('www.', '');
            } catch (err) {
                debug(i18next.t("invalid_url", {ns: "core", url: originalUrl }), "Events.MessageCreate");
                continue;
            }

            for (const [key, replaceFunc] of Object.entries(replacements)) {
                const manualDomainConfig = guildReplacementConfig.get(key);
                if (manualDomainConfig && manualDomainConfig.enabled === false) {
                    debug(i18next.t("api_domain_disabled", {ns: "core", domain: key }), "Events.MessageCreate");
                    continue;
                }
                
                if (new RegExp(key).test(originalUrl)) {
                    const result = (replaceFunc as any)(originalUrl.replace(/\|/g, ""));
                    if (result) {
                        replacedUrl = result;
                        break;
                    }
                }
            }

            if (!replacedUrl) {
                try {
                    const matchingDomain = apiReplacementDomainsEnv.find(d => domainSite?.endsWith(d));
                    if (matchingDomain) {
                        const apiDomainConfig = guildReplacementConfig.get(matchingDomain);
                        if (apiDomainConfig) {
                            debug(i18next.t("config_found", {ns: "core", domain: matchingDomain, enabled: apiDomainConfig.enabled }), "Events.MessageCreate");
                            if (apiDomainConfig.enabled === false) {
                                debug(i18next.t("api_domain_disabled", {ns: "core", domain: matchingDomain }), "Events.MessageCreate");
                                continue;
                            }
                        } else {
                            debug(i18next.t("config_not_found", {ns: "core", domain: matchingDomain }), "Events.MessageCreate");
                        }
                        
                        replacedUrl = await apiReplacer.getEmbedUrl(originalUrl);
                    }
                } catch (err) {
                    debug(i18next.t("invalid_url", {ns: "core", url: originalUrl }), "Events.MessageCreate");
                }
            }

            if (replacedUrl) {
                const formattedLink = i18next.t("format_link", {ns: "core", Site: domainSite, RemUrl: replacedUrl });
                replacedUrls.push(formattedLink);
            }
        }

        if (replacedUrls.length > 0) {
            const suppressEmbedsWithRetry = async (msg: Message, maxAttempts = 5, delayMs = 1000) => {
                for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                    try {
                        await new Promise((resolve) => setTimeout(resolve, delayMs));
                        await msg.suppressEmbeds(true);
                        debug(i18next.t("embeds_suppressed", {ns: "core", attempt }), "Events.MessageCreate");
                        return;
                    } catch (err) {
                        const errMsg: string = (err as Error).message;
                        if (errMsg.includes("Missing Permissions")) {
                            error(i18next.t("suppress_embeds_fail_permissions", {ns: "core" }), "Events.MessageCreate");
                            return;
                        }
                        if (attempt === maxAttempts) {
                            error(i18next.t("suppress_embeds_fail_retries", {ns: "core", maxAttempts, error: errMsg }), "Events.MessageCreate");
                        }
                    }
                }
            };
            await suppressEmbedsWithRetry(message);

            for (let i = 0; i < replacedUrls.length; i += MAX_EMBEDS) {
                const currentBatch = replacedUrls.slice(i, i + MAX_EMBEDS);
                const replyContent = currentBatch.join('\n');

                try {
                    const deleteButton = new ButtonBuilder()
                        .setCustomId("delete_message")
                        .setLabel(i18next.t("delete_button_label", { ns: "core" }))
                        .setStyle(ButtonStyle.Danger);
                    
                    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(deleteButton);
                    
                    let botMessage: Message;

                    if (i === 0) {
                        botMessage = await message.reply({
                            content: replyContent,
                            components: [row],
                            allowedMentions: { repliedUser: false },
                        });
                    } else if (message.channel && message.channel.isTextBased()) {
                        botMessage = await message.channel.send({
                            content: replyContent,
                            components: [row],
                        });
                    } else {
                        continue;
                    }

                    const collector = botMessage.createMessageComponentCollector({
                        filter: (interaction: Interaction) => {
                            return interaction.isButton() && interaction.user.id === message.author.id;
                        },
                        time: 20_000,
                    });
                
                    collector.on("collect", async (interaction: ButtonInteraction) => {
                        if (interaction.isButton() && interaction.customId === "delete_message") {
                            try {
                                await botMessage.delete();
                                await interaction.reply({
                                    content: i18next.t("message_deleted", { ns: "core" }),
                                    flags: MessageFlags.Ephemeral,
                                });
                                debug(i18next.t("message_deleted_log", {ns: "core" }), "Events.MessageCreate");
                                collector.stop();
                            } catch (err) {
                                const errMsg: string = (err as Error).message;
                                if (errMsg.includes("Unknown Message") || errMsg.includes("Interaction has already been acknowledged")) {
                                    return;
                                }
                                error(i18next.t("delete_message_fail", {ns: "core", error: errMsg }), "Events.MessageCreate");
                                await interaction.reply({
                                    content: i18next.t("message_delete_failed", { ns: "common" }),
                                    flags: MessageFlags.Ephemeral,
                                });
                            }
                        }
                    });
                
                    collector.on("end", async (reason: string) => {
                        if (reason === "messageDelete" || reason === "user") return;
                        try {
                            await botMessage.edit({ components: [] });
                            debug(i18next.t("button_disabled_log", {ns: "core" }), "Events.MessageCreate");
                        } catch (err) {
                            const errMsg: string = (err as Error).message;
                            if (errMsg.includes("Unknown Message")) return;
                            error(i18next.t("disable_button_fail", {ns: "core", error: errMsg }), "Events.MessageCreate");
                        }
                    });
                } catch (err) {
                    const errMsg: string = (err as Error).message;
                    if (errMsg.includes("Missing Permissions")) {
                        return;
                    }
                    error(i18next.t("reply_fail", {ns: "core", error: errMsg }), "Events.MessageCreate");
                }
            }
        }
    });

    return client;
}

async function main(): Promise<void> {
    try {
        const environmentMode = getEnvironmentMode();
        initLogger(environmentMode);
        const locale = process.env.LOCALE ?? "es";
        await initI18n(locale);
        const client = createClient();
        await client.login(process.env.DISCORD_BOT_TOKEN)
            .catch(error => {
                console.error('Error al iniciar sesión con el bot:', error);
                process.exit(1);
        });     
    } catch (e) {
        const errorObj = e as Error;
        if (loggerAvailable()) {
            error(i18next.t("main_exception", {ns: "core", errorName: errorObj.name, errorMessage: errorObj.message }), "Main");
        } else {
            console.error(`Unhandled exception: ${errorObj.name}: ${errorObj.message}`);
        }
        process.exit(1);
    }
}

main().catch((e: Error) => {
    const errorObj = e as Error;
    if (loggerAvailable()) {
        error(i18next.t("main_exception", {ns: "core", errorName: errorObj.name, errorMessage: errorObj.message }), "Main");
    } else {
        console.error(`Unhandled exception: ${errorObj.name}: ${errorObj.message}`);
    }
    process.exit(1);
});