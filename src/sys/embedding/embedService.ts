// src/sys/embeding/embedService.ts
import { Client, Events, Message, MessageReaction, User } from "discord.js";
import { getGuildReplacementConfig } from "../DB-Engine/links/Embed";
import { getConfigMap } from "../DB-Engine/links/ReplyBots";
import { buildReplacements } from "./index";
import ApiReplacement from "./ApiReplacement";
import { debug, error } from "../logging";
import i18next from "i18next";

const apiReplacementDomainsEnv = process.env.API_REPLACEMENT_DOMAINS ? process.env.API_REPLACEMENT_DOMAINS.split(',').map(s => s.trim()) : [];
const urlRegex = /(?:\[[^\]]*\]\()?(https?:\/\/[^\s\)]+)/g;
const MAX_EMBEDS = 5;
const replyToOtherBots = process.env.REPLY_OTHER_BOTS === "true";

export function startEmbedService(client: Client): void {
    client.on(Events.MessageCreate, async (message) => {
        if (!client.user || message.author.id === client.user.id) {
            debug(i18next.t("Ignoring_message", {ns: "core", authorId: message.author.id }), "Events.MessageCreate");
            return;
        }

        const guildId = message.guild?.id;
        const channelId = message.channel.id;
        const guildReplacementConfig = guildId ? await getGuildReplacementConfig(guildId) : new Map();
        const originalAuthorId = message.author.id; 

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
                   let botMessage: Message;

                    if (i === 0) {
                        botMessage = await message.reply({
                            content: replyContent,
                            allowedMentions: { repliedUser: false },
                        });
                    } else if (message.channel && message.channel.isTextBased()) {
                        botMessage = await message.channel.send({
                            content: replyContent,
                        });
                    } else {
                        continue;
                    }
                    try {
                        await botMessage.react('❌'); 
                        debug("Reaction ❌ added to bot message.", "Events.MessageCreate");
                    } catch (err) {
                        error(`Failed to react with ❌ on bot message: ${err}`, "Events.MessageCreate");
                    }
                    const filter = (reaction: MessageReaction, user: User) => {
                        return reaction.emoji.name === '❌' && user.id === originalAuthorId;
                    };

                    const collector = botMessage.createReactionCollector({ filter, max: 1, time: 20000 });

                    collector.on('collect', async (_reaction: MessageReaction) => {
                        debug(`Reaction ❌ collected. Deleting message...`, "Events.MessageCreate");
                        try {
                            await botMessage.delete();
                            debug("Bot message deleted successfully via reaction.", "Events.MessageCreate");
                        } catch (err) {
                            const errMsg: string = (err as Error).message;
                            error(`Failed to delete message via reaction: ${errMsg}`, "Events.MessageCreate");
                            const failureMessage = await message.channel.send(i18next.t("message_delete_failed", { ns: "core" }));
                            setTimeout(() => {
                                failureMessage.delete().catch((e: Error) => {
                                    if (e.message.includes("Unknown Message")) return;
                                    debug(`Could not delete follow-up failure message: ${e.message}`, "Events.MessageCreate");
                                });
                            }, 5000);
                        }
                    });

                    collector.on('end', async (_collected, reason) => {
                        if (reason === 'time') { 
                            try {
                                const reactionToRemove = botMessage.reactions.cache.get('❌');
                                if (reactionToRemove) {
                                    await reactionToRemove.remove(); 
                                    debug("❌ reaction removed after 20s timeout.", "Events.MessageCreate");
                                }
                            } catch (err) {
                                const errMsg: string = (err as Error).message;
                                if (errMsg.includes("Unknown Message")) return;
                                error(`Error al remover reacción ❌: ${errMsg}`, "Events.MessageCreate");                             
                            }
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
}
