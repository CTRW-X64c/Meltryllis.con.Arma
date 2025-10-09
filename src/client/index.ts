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
    debug('Preloading rolemoji messages.', "Core");
    const guilds = client.guilds.cache.values();
    for (const guild of guilds) {
        const assignments = await getRoleAssignments(guild.id);
        
        // Corregido: Convertir el iterador en un array
        const messageIds = new Set(Array.from(assignments.values()).map(a => a.messageId));
        
        for (const messageId of messageIds) {
            try {
                const channels = guild.channels.cache.filter(c => c.isTextBased());
                for (const channel of channels.values()) {
                    try {
                        const message = await (channel as TextBasedChannel).messages.fetch(messageId as string);
                        if (message) {
                            debug(`Fetched rolemoji message ${messageId} in guild ${guild.name}`, "Core");
                            break;
                        }
                    } catch (err) {
                        // Ignorar errores si el mensaje no está en este canal
                    }
                }
            } catch (err) {
                error(`Failed to fetch rolemoji message ${messageId} in guild ${guild.name}: ${err}`, "Core");
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
        info(`Logged in as ${eventClient.user.tag}`, "Events.ClientReady");
        const guildCount = eventClient.guilds.cache.size;
        info(`Present in ${guildCount} ${guildCount === 1 ? "guild" : "guilds"}`, "Events.ClientReady");
        const guildNames = eventClient.guilds.cache.map(guild => guild.name).join(", ");
        info(`Servers: ${guildNames}`, "Events.ClientReady");
        info(`Responder a otros bots configurado como: ${replyToOtherBots}`, "Events.ClientReady");

        try {
            await initializeDatabase();
        } catch (err) {
            error(`Failed to initialize database in ClientReady: ${err}`, "Events.ClientReady");
            process.exit(1);
        }

        const statusList = parseStatuses(process.env.BOT_STATUSES);
        setupStatusRotation(client, statusList);

        try {
            await preloadImagesAndFonts();
        } catch (err) {
            error(`Failed to preload images: ${err}`, "Events.ClientReady");
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
            debug(`Ignoring message from bot itself or client.user is null: ${message.author.id}`, "Events.MessageCreate");
            return;
        }

        const guildId = message.guild?.id;
        const channelId = message.channel.id;

        const guildReplacementConfig = guildId ? await getGuildReplacementConfig(guildId) : new Map();

        if (guildId) {
            const channelConfig = (await getConfigMap()).get(guildId)?.get(channelId);
            if (channelConfig?.enabled === false) {
                debug(`Canal ${channelId} deshabilitado, ignorando mensaje`, "Events.MessageCreate");
                return;
            }
            if (channelConfig?.replyBots === false && message.author.bot) {
                debug(`replyBots desactivado en ${channelId}, ignorando mensaje de bot`, "Events.MessageCreate");
                return;
            }
        } else if (!replyToOtherBots && message.author.bot) {
            debug(`Fallback replyToOtherBots=false, ignorando mensaje de bot`, "Events.MessageCreate");
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
                debug(`Invalid URL: ${originalUrl}`, "Events.MessageCreate");
                continue;
            }

            for (const [key, replaceFunc] of Object.entries(replacements)) {
                const manualDomainConfig = guildReplacementConfig.get(key);
                if (manualDomainConfig && manualDomainConfig.enabled === false) {
                    debug(`Dominio manual ${key} deshabilitado, ignorando enlace`, "Events.MessageCreate");
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
                            debug(`Configuración para ${matchingDomain} encontrada. Estado habilitado: ${apiDomainConfig.enabled}`, "Events.MessageCreate");
                            if (apiDomainConfig.enabled === false) {
                                debug(`Dominio de API ${matchingDomain} está deshabilitado, ignorando enlace`, "Events.MessageCreate");
                                continue;
                            }
                        } else {
                            debug(`No se encontró configuración para ${matchingDomain}, asumiendo habilitado por defecto.`, "Events.MessageCreate");
                        }
                        
                        replacedUrl = await apiReplacer.getEmbedUrl(originalUrl);
                    }
                } catch (err) {
                    debug(`Invalid URL: ${originalUrl}`, "Events.MessageCreate");
                }
            }

            if (replacedUrl) {
                const formattedLink = `[Embedding de ${domainSite}](${replacedUrl})`;
                replacedUrls.push(formattedLink);
            }
        }

        if (replacedUrls.length > 0) {
            const suppressEmbedsWithRetry = async (msg: Message, maxAttempts = 5, delayMs = 1000) => {
                for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                    try {
                        await new Promise((resolve) => setTimeout(resolve, delayMs));
                        await msg.suppressEmbeds(true);
                        debug(`Embeds suprimidos en intento ${attempt}`, "Events.MessageCreate");
                        return;
                    } catch (err) {
                        const errMsg: string = (err as Error).message;
                        if (errMsg.includes("Missing Permissions")) {
                            error(`No se pudieron suprimir embeds: Sin permisos`, "Events.MessageCreate");
                            return;
                        }
                        if (attempt === maxAttempts) {
                            error(`No se pudieron suprimir embeds tras ${maxAttempts} intentos: ${errMsg}`, "Events.MessageCreate");
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
                        .setLabel(i18next.t("delete_button_label", { ns: "common" }))
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
                                    content: i18next.t("message_deleted", { ns: "common" }),
                                    flags: MessageFlags.Ephemeral,
                                });
                                debug(`Mensaje borrado`, "Events.MessageCreate");
                                collector.stop();
                            } catch (err) {
                                const errMsg: string = (err as Error).message;
                                if (errMsg.includes("Unknown Message") || errMsg.includes("Interaction has already been acknowledged")) {
                                    return;
                                }
                                error(`Error al borrar mensaje: ${errMsg}`, "Events.MessageCreate");
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
                            debug("Botón deshabilitado", "Events.MessageCreate");
                        } catch (err) {
                            const errMsg: string = (err as Error).message;
                            if (errMsg.includes("Unknown Message")) return;
                            error(`Error al deshabilitar botón: ${errMsg}`, "Events.MessageCreate");
                        }
                    });
                } catch (err) {
                    const errMsg: string = (err as Error).message;
                    if (errMsg.includes("Missing Permissions")) {
                        return;
                    }
                    error(`Failed to reply: ${errMsg}`, "Events.MessageCreate");
                }
            }
        }
    });

    return client;
}

async function main(): Promise<void> {
    try {
        const environmentMode = getEnvironmentMode();
        initLogger(environmentMode, "bot");
        const locale = process.env.LOCALE ?? "es";
        await initI18n(locale);
        const client = createClient();
        await client.login(process.env.DISCORD_BOT_TOKEN);
    } catch (e) {
        const errorObj = e as Error;
        if (loggerAvailable()) {
            error(`Exception thrown from main: ${errorObj.name}: ${errorObj.message}`, "Main");
        } else {
            console.error(`Unhandled exception: ${errorObj.name}: ${errorObj.message}`);
        }
        process.exit(1);
    }
}

main().catch((e: Error) => {
    if (loggerAvailable()) {
        error(`Unhandled exception: ${e.name}: ${e.message}`, "Main");
    } else {
        console.error(`Unhandled exception: ${e.name}: ${e.message}`);
    }
    process.exit(1);
});