// src/sys/embeding/embedService.ts
import { Client, Events, Message } from "discord.js";
import { getGuildReplacementConfig } from "../DB-Engine/links/Embed";
import { getConfigMap } from "../DB-Engine/links/ReplyBots";
import buildReplacements from "./index";
import ApiReplacement from "./ApiReplacement";
import { debug, error } from "../logging";
import i18next from "i18next";
import urlStatusManager, { embedingList } from "./domainChecker"

const urlRegex = /(?:\[[^\]]*\]\()?(https?:\/\/[^\s\)]+)/g;
export default function startEmbedService(client: Client): void {
    client.on(Events.MessageCreate, async (message) => {
        if (!client.user || message.author.id === client.user.id) return;
        if (message.content.startsWith("$$")) return;
        if (message.content.includes("https://embedez.com")) return;

        const urls = [...message.content.matchAll(urlRegex)];
        if (urls.length === 0) return;

        const guildId = message.guild?.id;
        const channelId = message.channel.id;
        const isBot = message.author.bot;
        const autorId = message.author.id;

        if (guildId) {
            const channelConfig = (await getConfigMap()).get(guildId)?.get(channelId);
            if (channelConfig?.enabled === false) return;
            if (isBot && channelConfig?.replyBots !== true) return;
        }

        const guildReplacementConfig = guildId ? await getGuildReplacementConfig(guildId) : new Map();
        const apiDomains = [
            ...(embedingList["API_SFW"] ? embedingList["API_SFW"].split('|').map(s => s.trim()) : []),
            ...(embedingList["API_NSFW"] ? embedingList["API_NSFW"].split('|').map(s => s.trim()) : []),
        ];

        const replacements = buildReplacements(guildReplacementConfig);
        const API = urlStatusManager.getActiveUrl("Api")
        const apiReplacer = new ApiReplacement();
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
                if (API !== null && API.includes("embedez.com")) {
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
                const hiddenMessage = message.content.split("||").length > 2;
                let messageContent = i18next.t("common:embedService.format_link", { Site: domainSite, RemUrl: replacedUrl });
                if (hiddenMessage) {
                    messageContent = i18next.t("common:embedService.format_link_spoiler", { Site: domainSite, RemUrl: replacedUrl });
                }
                replacedUrls.push(messageContent);
            }
        }
        if (replacedUrls.length > 0) {
            embeRemove(message);
            post(message, replacedUrls, autorId);
        }
    });
};

// =========== embdClean =========== //
const embeRemove = async (msg: Message) => {
    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
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

// =========== post =========== //
const post = async (msg: Message, replacedUrls: string[], autorId: string) => {
    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const MAX_MSG = 5;
    const canSend = msg.channel.isSendable();
    if (!canSend) return;

    const badEmbed = (embed: any): boolean => {
        const embedText = JSON.stringify(embed).toLowerCase();
        const noAllowed = [
            "log in or sign up to view",
            "sign up to continue",
            "login to view",
            "you need to log in",
            "content is private",
            "this content is only available to",
            "that post doesn't exist :("
        ];
        return noAllowed.some(p => embedText.includes(p));
    };

    const content = replacedUrls.join(' | ');
    if (replacedUrls.length <= MAX_MSG) {
        let sentMsg = await msg.reply({ content: content, allowedMentions: { repliedUser: false } });
        await wait(3000);

        let freshMsg = await msg.channel.messages.fetch(sentMsg.id).catch(() => null);
        try {
            for (let attempt = 1; attempt <= 2 && freshMsg && freshMsg.embeds.length === 0; attempt++) {
                debug(`Sin embed, forzando regeneración - Intento ${attempt}`, "Events.MessageCreate");

                await sentMsg.edit({ content: i18next.t("common:embedService.try", { a1: `${attempt}/2` }), allowedMentions: { repliedUser: false } });
                await wait(1500);

                await sentMsg.edit({ content: content, allowedMentions: { repliedUser: false } });
                await wait(2000 * attempt);
                freshMsg = await msg.channel.messages.fetch(sentMsg.id).catch(() => null);
            }

            if (freshMsg && freshMsg.embeds.length === 0) {
                debug(`No se pudo generar embed después de reintentos`, "Events.MessageCreate");
                await sentMsg.edit({ content: i18next.t("common:embedService.msgFail"), allowedMentions: { repliedUser: false } }).catch(() => null);
                await wait(10000);
                await sentMsg.delete().catch(() => null);
                return;
            }

            if (freshMsg && freshMsg.embeds.length > 0 && badEmbed(freshMsg.embeds[0])) {
                await sentMsg.edit({ content: i18next.t("common:embedService.badEmbed"), allowedMentions: { repliedUser: false } }).catch(() => null);
                await wait(10000);
                await sentMsg.delete().catch(() => null);
                return;
            }

        } catch (e) {
            error(`error al generar embeds: ${e}`, "Events.MessageCreate")
        }

        if (sentMsg && autorId) deleteMSG(sentMsg, autorId);
        return;
    }

    for (let i = 0; i < replacedUrls.length; i += MAX_MSG) {
        const batch = replacedUrls.slice(i, i + MAX_MSG);
        const sentMsg = i === 0
            ? await msg.reply({ content: batch.join(' | '), allowedMentions: { repliedUser: false } })
            : await msg.channel.send(batch.join(' | '));
        if (sentMsg && autorId) deleteMSG(sentMsg, autorId);
        await wait(1000);
    }
};

// =========== emojiDelet =========== //
const deleteMSG = async (msg: Message, autorId: string) => {
    if (!msg.channel.isSendable() || !msg.deletable) return;
    try {
        await msg.react('❌');
        const collector = msg.createReactionCollector({
            filter: (reaction, user) => reaction.emoji.name === '❌' && user.id === autorId,
            max: 1,
            time: 20000
        });

        collector.on('collect', async () => {
            if (msg.deletable) {
                await msg.delete().catch(() => { });
            }
            collector.stop();
        });

        collector.on('end', async (_, reason) => {
            if (reason === 'time' && msg.reactions.cache.has('❌')) {
                const reaction = msg.reactions.cache.get('❌');
                if (reaction?.me) {
                    await reaction.users.remove(msg.client.user?.id).catch(() => { });
                }
            }
        });
    } catch (err) {
        const errMsg = (err as Error).message;
        if (errMsg.includes("Missing Permissions") && msg.channel.isSendable()) {
            await msg.channel.send({
                content: i18next.t("common:embedService.emojErr"),
                allowedMentions: { repliedUser: false }
            }).catch(() => { });
        }
        // No loguear errores menores como Missing Access
        if (!errMsg.includes("Missing Access")) {
            error(`Error en deleteMSG: ${errMsg}`, "Events.MessageCreate");
        }
    }
};
