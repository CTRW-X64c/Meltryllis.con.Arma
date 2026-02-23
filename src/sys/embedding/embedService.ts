// src/sys/embeding/embedService.ts
import { Client, Events, Message } from "discord.js";
import { getGuildReplacementConfig } from "../DB-Engine/links/Embed";
import { getConfigMap } from "../DB-Engine/links/ReplyBots";
import buildReplacements from "./index";
import ApiReplacement from "./ApiReplacement";
import { debug, error } from "../logging";
import i18next from "i18next";

const apiDomains = [
    ...(process.env.EMBEDEZ_SFW ? process.env.EMBEDEZ_SFW.split('|').map(s => s.trim()) : []),
    ...(process.env.EMBEDEZ_NSFW ? process.env.EMBEDEZ_NSFW.split('|').map(s => s.trim()) : [])
    ];
const urlRegex = /(?:\[[^\]]*\]\()?(https?:\/\/[^\s\)]+)/g;
const MAX_EMBEDS = 5;

export default function startEmbedService(client: Client): void {
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
        const noEmb = message.content.startsWith("$$");
        const domEmbedez = message.content.includes("https://embedez.com");
        
        if (noEmb || domEmbedez) {
            debug(`Ignorando mensaje empieza con $$ o embedez.com...`, "Events.MessageCreate");
            return;
        }

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
                const matchingDomain = apiDomains.find(d => domainSite?.endsWith(d)); 
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
    /* ==================================================== Borrado de embed del msg original ==================================================== */
        if (replacedUrls.length > 0) {
            const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
            const suppressEmbedsWithRetry = async (msg: Message) => {
                for (let attempt = 1; attempt <= 4; attempt++) {
                    try {
                        await wait(attempt * 1200);
                        const freshMsg = await msg.channel.messages.fetch(msg.id);
                        if (freshMsg.flags.has('SuppressEmbeds')) {
                            debug(`Se borro el embed de ${msg.id} despues de ${attempt} intentos.`, "Events.MessageCreate");
                            return; 
                        }
                        await freshMsg.suppressEmbeds(true);
                        debug(`Intento ${attempt} para borrar el embed de ${msg.id}.`, "Events.MessageCreate");

                    } catch (err) {
                        const errMsg: string = (err as Error).message;
                        if (errMsg.includes("Unknown Message")) {
                            debug(`Al guien borro el embed antes - Server: ${msg.guild?.id}`, "Events.MessageCreate");
                            return; 
                        }
                        if (errMsg.includes("Missing Permissions")) {
                            debug(`No tengo permisos para borrar mensajes en el canal: ${msg.channel.id} -Server: ${msg.guild?.id}`, "Events.MessageCreate");
                            return; 
                        }
                        if (attempt === 4) {
                            debug(`No se puedo borrar el embed del mensaje original, Error: ${errMsg}`, "Events.MessageCreate");
                        }
                    }
                }
            };
    /* ==================================================== Check para comprobar el nuevo embed ==================================================== */
            suppressEmbedsWithRetry(message);
            for (let i = 0; i < replacedUrls.length; i += MAX_EMBEDS) {
                const currentBatch = replacedUrls.slice(i, i + MAX_EMBEDS);
                const mxRetry = 3;
                let replyContent = currentBatch.join('\n');
        /* Despues de como 8 formas/tiempos para comprobar que el embed si se generara, y despues de probar renviando/borrando el mesanje llegamos a usa edit y tiempos */
                let embMessage: Message | null = null;
                let editMessage: Message | null = null;
                const isFirstBatch = (i === 0);

                for (let attempt = 1; attempt <= mxRetry; attempt++) {
                    try {
                        if (editMessage === null) {
                            if (isFirstBatch) {
                                editMessage = await message.reply({ content: replyContent, allowedMentions: { repliedUser: false } });
                            } else {
                                editMessage = await message.channel.send(replyContent);
                            }
                        } else {
                            if (!editMessage.channel.isTextBased()) continue;
                            await editMessage.edit({ content: i18next.t("embClien_try", { ns: "core", a1: `${attempt - 1}/${mxRetry - 1}`,}), allowedMentions: { repliedUser: false } });
                            await wait(attempt * 1500);
                            await editMessage.edit({ content: replyContent, allowedMentions: { repliedUser: false } });
                        }

                        await wait(attempt === 1 ? 4000 : attempt === 2 ? 4500 : 5500);
                        const freshMessage = await message.channel.messages.fetch({ message: editMessage.id, force: true }).catch(() => null);

                        if (freshMessage && freshMessage.embeds.length > 0) {
                            embMessage = freshMessage;
                            debug(`Embed generado correctamente en intento ${attempt}`, "Events.MessageCreate");
                            break;
                        } else if (attempt === mxRetry && freshMessage?.deletable && freshMessage.editable) {
                            try {
                                let failMsg = i18next.t("embClien_msgFail", { ns: "core"});
                                    if (freshMessage.content.includes("facebed.com/share")) {failMsg = i18next.t("embClien_msgFail_fb", { ns: "core" })};
                                const failureMsg = await freshMessage.edit({ content: failMsg , allowedMentions: { repliedUser: true } });
                                setTimeout(() => failureMsg.delete().catch(() => {}), 10000);
                                error(`Discord no genero el embed tras ${attempt} intentos. Gremio: ${message.guild?.name} | embURL: ${replyContent}`, "Events.MessageCreate");
                            }  catch (e) { }
                        }
                    } catch (err) {
                        error(`Error fatal en intento de envío ${attempt}: ${err}`, "Events.MessageCreate");
                        if (editMessage?.deletable) {
                            await editMessage.delete().catch(() => {});
                        }
                        break; 
                    }
                }             
        /* ==================================================== Borrado mediante emoji ❌ ==================================================== */           
                if (!embMessage) continue;               
                    try {
                        await embMessage.react('❌');                
                        const collector = embMessage.createReactionCollector({ 
                            filter: (mr, u) => mr.emoji.name === '❌' && u.id === originalAuthorId, 
                            max: 1, 
                            time: 20000
                        });

                        collector.on('collect', async () => {
                            try {
                                if (embMessage?.deletable) await embMessage.delete();
                            } catch (e) { debug("Error borrando mensaje tras reacción", "Events.MessageCreate"); }
                        });

                        collector.on('end', async (_, reason) => {
                            if (reason === 'time') {
                                try {
                                    const reaction = embMessage?.reactions.cache.get('❌');
                                    if (reaction?.me) await reaction.users.remove(client.user?.id);
                                } catch (e) { /* Ignorar si el error es por permisos */ }
                            }
                        });
                    } catch (err) {
                    const errMsg: string = (err as Error).message;
                    if (errMsg.includes("Missing Permissions")) {
                        await message.channel.send({ content: i18next.t("embClien_emojErr", { ns: "core"} )});
                        return;
                    }
                    error(`Error al responder: ${errMsg}`, "Events.MessageCreate");                  
                }
            }
        }
    });
}