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

export function startEmbedService(client: Client): void {
    client.on(Events.MessageCreate, async (message) => {
        if (!client.user || message.author.id === client.user.id) {
            debug(`Ignorando mensaje propio...`, "Events.MessageCreate");
            return;
        }

        const guildId = message.guild?.id;
        const channelId = message.channel.id;
        const guildReplacementConfig = guildId ? await getGuildReplacementConfig(guildId) : new Map();
        const originalAuthorId = message.author.id;
        const isBot = message.author.bot;

        if (guildId) {
            const channelConfig = (await getConfigMap()).get(guildId)?.get(channelId);
            if (channelConfig?.enabled === false) {
                debug(`Canal: ${channelId} deshabilitado en gremio: ${guildId}`, "Events.MessageCreate");
                return;
            }
            if (isBot && channelConfig?.replyBots !== true) {
                debug(`No respondere a bots en canal: ${channelId} del gremio: ${guildId}`, "Events.MessageCreate");
                return;
            }
        } else if (isBot) {
            debug(`Ignorando mensaje de BOT`, "Events.MessageCreate");
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
                debug(`URL Invalida: ${originalUrl}`, "Events.MessageCreate");
                continue;
            }
    /* ==================================================== Ajuste para prioridad del API ==================================================== */
            try {
                const matchingDomain = apiReplacementDomainsEnv.find(d => domainSite?.endsWith(d)); 
                if (matchingDomain) {
                    const apiDomainConfig = guildReplacementConfig.get(matchingDomain);
                    let apiEnabled = true;
                    if (apiDomainConfig) {
                        if (apiDomainConfig.enabled === false) {
                            debug(`El uso del API esta deshabilitado para el dominio: ${matchingDomain} en el gremio: ${guildId}`, "Events.MessageCreate");
                            apiEnabled = false;
                        }
                    } 

                    if (apiEnabled) {
                        const apiResult = await apiReplacer.getEmbedUrl(originalUrl);
                        if (apiResult) {
                            replacedUrl = apiResult;
                            debug(`Sitio: ${domainSite} a sido procesado por ApiReplacement`, "Events.MessageCreate");
                        }
                    }
                }
            } catch (err) {
                debug(`Erro en el API: ${(err as Error).message}`, "Events.MessageCreate");
            }
    /* ==================================================== No API ==================================================== */
            if (!replacedUrl) {
                for (const [key, replaceFunc] of Object.entries(replacements)) {
                    const manualDomainConfig = guildReplacementConfig.get(key); 
                    if (manualDomainConfig && manualDomainConfig.enabled === false) {
                        continue;
                    }
                    
                    if (new RegExp(key).test(originalUrl)) {
                        const result = (replaceFunc as any)(originalUrl.replace(/\|/g, ""));
                        if (result) {
                            replacedUrl = result;
                            debug(`Se uso el reemplazador local: ${key}`, "Events.MessageCreate");
                            break; 
                        }
                    }
                }
            }
    /* ==================================================== Procesamiento del mensaje ==================================================== */
            if (replacedUrl) {
                const hiddenMessage = message.content.includes("||")
                let messageContent = i18next.t("format_link", { ns: "core", Site: domainSite, RemUrl: replacedUrl });
                if (hiddenMessage) {
                    messageContent = i18next.t("format_link_spoiler", { ns: "core", Site: domainSite, RemUrl: replacedUrl });
                }
                replacedUrls.push(messageContent);
            }
        }
    /* ==================================================== Borrado de embed y Emoji ==================================================== */
        if (replacedUrls.length > 0) {
            const suppressEmbedsWithRetry = async (msg: Message, maxAttempts = 5, delayMs = 1000) => {
                for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                    try {
                        await new Promise((resolve) => setTimeout(resolve, delayMs));
                        await msg.suppressEmbeds(true);
                        debug(`Se eilimino el embed del mensaje en el gremio: ${msg.guild?.id} en ${attempt} intentos`, "Events.MessageCreate");
                        return;
                    } catch (err) {
                        const errMsg: string = (err as Error).message;
                        if (errMsg.includes("Missing Permissions")) {
                            error(`No pude borrar el embed por falta de permisos!!`, "Events.MessageCreate");
                            return;
                        }
                        if (attempt === maxAttempts) {
                            error(`Se intento borrar el embed ${maxAttempts} veces, pero no se pudo. Error: ${errMsg}`, "Events.MessageCreate");
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
                        debug(`Añadiendo reaccion "❌" a mensaje.`, "Events.MessageCreate");
                    } catch (err) {
                        error(`Ocurrio un error al añadir la reaccion "❌" al mensaje: ${err}`, "Events.MessageCreate");
                    }
                    const filter = (reaction: MessageReaction, user: User) => {
                        return reaction.emoji.name === '❌' && user.id === originalAuthorId;
                    };

                    const collector = botMessage.createReactionCollector({ filter, max: 1, time: 20000 });

                    collector.on('collect', async (_reaction: MessageReaction) => {
                        debug(`El autor reacciono con "❌" al mensaje. Borrando mensaje...`, "Events.MessageCreate");
                        try {
                            await botMessage.delete();
                            debug("Se borro el mensaje correctamente", "Events.MessageCreate");
                        } catch (err) {
                            const errMsg: string = (err as Error).message;
                            error(`No pude borrar el mensaje reaccionado: ${errMsg}`, "Events.MessageCreate");
                            const failureMessage = await message.channel.send(i18next.t("message_delete_failed", { ns: "core" }));
                            setTimeout(() => {
                                failureMessage.delete().catch((e: Error) => {
                                    if (e.message.includes("Unknown Message")) return;
                                    debug(`Tampoco pude borrar la noticacion de error de borrado por reaccion: ${e.message}`, "Events.MessageCreate");
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
                                    debug("Tiempo agotado, se removio la reaccion ❌", "Events.MessageCreate");
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
                    error(`Error al responder: ${errMsg}`, "Events.MessageCreate");                  
                }
            }
        }
    });
}