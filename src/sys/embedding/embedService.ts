// src/sys/embeding/embedService.ts
import { Client, Events, Message } from "discord.js";
import { getGuildReplacementConfig } from "../DB-Engine/links/Embed";
import { getConfigMap } from "../DB-Engine/links/ReplyBots";
import localEmb from "./index";
import { debug, error } from "../logging";
import i18next from "i18next";
import { contPack, urlProcess } from "./embedingSwitch";

const urlRegex = /(?:\[[^\]]*\]\()?(https?:\/\/[^\s\)]+)/g;
export default function startEmbedService(client: Client): void {
    client.on(Events.MessageCreate, async (message) => {
        if (!client.user || message.author.id === client.user.id) return;
        if (message.content.startsWith("$$")) return;
        if (message.content.includes("https://embedez.com")) return;

        const gld = message.guild?.id;
        if (!gld) return

        const extractedUrls = [...message.content.matchAll(urlRegex)].map(match => {
            const rawUrl = match[1];
            const matchIndex = match.index || 0;

            const textBefore = message.content.substring(0, matchIndex);
            const spoilerCount = (textBefore.match(/\|\|/g) || []).length;

            const isSpoiler = spoilerCount % 2 !== 0;
            const cleanUrl = rawUrl.replace(/\|\|.*$/, '');

            return { url: cleanUrl, isSpoiler: isSpoiler };
        });

        if (extractedUrls.length === 0) return;

        const chConfig = (await getConfigMap()).get(gld)?.get(message.channel.id);
        if (chConfig?.enabled === false) return;
        if (message.author.bot && chConfig?.replyBots !== true) return;

        const gConfigs = await getGuildReplacementConfig(gld)
        const rmpLocal = localEmb.getParam(gConfigs);

        const iFix: string[] = [], iPack: contPack[] = [];
        for (const item of extractedUrls) {
            let domainSite: string | null = null;
            const originalUrl = item.url;
            try {
                const urlObject = new URL(originalUrl);
                domainSite = urlObject.hostname.replace('www.', '');
            } catch (err) { debug(`URL Invalida: ${originalUrl}`, "Events.MessageCreate"); continue }

            const apiResult = await urlProcess({ oURL: originalUrl, domain: domainSite, guild: gld, gConf: gConfigs, remp: rmpLocal, msg: message, isSpoiler: item.isSpoiler });
            if (apiResult.ok) {
                if (apiResult.fix) {
                    let messageContent = i18next.t("common:embedService.format_link", { Site: domainSite, RemUrl: apiResult.fix });
                    if (item.isSpoiler) messageContent = i18next.t("common:embedService.format_link_spoiler", { Site: domainSite, RemUrl: apiResult.fix });
                    iFix.push(messageContent);
                }
                if (apiResult.pack) iPack.push(...apiResult.pack);
            }
        }

        if (iFix.length > 0) { post(message, iFix, message.author.id); embeRemove(message) };
        if (iPack.length > 0) { sPost(message, iPack, message.author.id); embeRemove(message) };
    });
};

// ================================= sPost ================================= //
async function sPost(msg: Message, dta: contPack[], autorId: string) {
    const data = dta.map(r => Object.values(r)[0]);
    let isFirst = true;
    for (const post of data) {
        try {
            if (isFirst) {
                const sntMsgFirst = await msg.reply({ content: post.content, embeds: post.embeds, files: post.files, allowedMentions: { repliedUser: false } })
                if (sntMsgFirst) deleteMSG(sntMsgFirst, autorId);
                isFirst = false;
            } else {
                const sntMsg = msg.channel.isSendable() ? await msg.channel.send({ content: post.content, embeds: post.embeds, files: post.files }) :
                    await msg.reply({ content: post.content, embeds: post.embeds, files: post.files, allowedMentions: { repliedUser: false } });
                if (sntMsg) deleteMSG(sntMsg, autorId);
            }
        } catch (err) {
            const errMsg = (err as Error).message;
            if (!errMsg.includes("Missing Access") && !errMsg.includes("Missing Permissions")) {
                error(`Error en sPost grupo: ${errMsg}, Guild: ${msg.guild?.name}`, "EmbedService");
                break;
            }
        }
    }
}

// ================================= post ================================= //
async function post(msg: Message, replacedUrls: string[], autorId: string) {
    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const MAX_MSG = 5;
    const mxAtt = 3;
    const canSend = msg.channel.isSendable();
    const content = replacedUrls.join(' | ');
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

    if (replacedUrls.length <= MAX_MSG) {
        let sentMsg: Message;
        try {
            sentMsg = await msg.reply({ content: content, allowedMentions: { repliedUser: false } });
        } catch (err) {
            const errMsg = (err as Error).message;
            if (!errMsg.includes("Missing Access") && !errMsg.includes("Missing Permissions")) {
                error(`Error al enviar embed inicial: ${errMsg}, Guild: ${msg.guild?.name}`, "EmbedService");
            } return
        }

        await wait(3_000);

        let freshMsg = await msg.channel.messages.fetch(sentMsg.id).catch(() => null);
        try {
            for (let attempt = 1; attempt <= mxAtt && freshMsg && freshMsg.embeds.length === 0; attempt++) {
                debug(`Sin embed, forzando regeneración - Intento ${attempt}`, "Events.MessageCreate");
                const t = 3_000 + (1_000 * attempt)

                await sentMsg.edit({ content: i18next.t("common:embedService.try", { a1: `${attempt}/${mxAtt}` }), allowedMentions: { repliedUser: false } });
                await wait(t);

                await sentMsg.edit({ content: content, allowedMentions: { repliedUser: false } });
                await wait(t);
                freshMsg = await msg.channel.messages.fetch(sentMsg.id).catch(() => null);
            }

            if (freshMsg && freshMsg.embeds.length === 0) {
                debug(`No se pudo generar embed después de reintentos, Guild: ${msg.guild?.name}.`, "Events.MessageCreate");
                await sentMsg.edit({ content: i18next.t("common:embedService.msgFail"), allowedMentions: { repliedUser: false } }).catch(() => null);
                await wait(10_000);
                await sentMsg.delete().catch(() => null);
                return;
            }

            if (freshMsg && freshMsg.embeds.length > 0 && badEmbed(freshMsg.embeds[0])) {
                await sentMsg.edit({ content: i18next.t("common:embedService.badEmbed"), allowedMentions: { repliedUser: false } }).catch(() => null);
                await wait(10_000);
                await sentMsg.delete().catch(() => null);
                return;
            }

        } catch (e) {
            error(`error al generar embeds: ${e}, Guild: ${msg.guild?.name}`, "Events.MessageCreate")
        }

        if (sentMsg && autorId) deleteMSG(sentMsg, autorId);
        return;
    }

    for (let i = 0; i < replacedUrls.length; i += MAX_MSG) {
        const batch = replacedUrls.slice(i, i + MAX_MSG);

        try {
            const sentMsg = i === 0
                ? await msg.reply({ content: batch.join(' | '), allowedMentions: { repliedUser: false } })
                : await msg.channel.send({ content: batch.join(' | '), });
            if (sentMsg && autorId) deleteMSG(sentMsg, autorId);
        } catch (err) {
            const errMsg = (err as Error).message;
            if (!errMsg.includes("Missing Access") && !errMsg.includes("Missing Permissions")) {
                error(`Error en ráfaga de embeds: ${errMsg}, Guild: ${msg.guild?.name}`, "EmbedService");
            }
            break;
        }
        await wait(1000);
    }
}

// ================================= embdClean ================================= //
export async function embeRemove(msg: Message) {
    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    for (let attempt = 1; attempt <= 4; attempt++) {
        try {
            await wait(attempt * 1_500);
            const freshMsg = await msg.channel.messages.fetch(msg.id);
            if (freshMsg.flags.has('SuppressEmbeds')) {
                return;
            }
            await freshMsg.suppressEmbeds(true);
            debug(`Intento ${attempt} para borrar el embed de ${msg.id}, Guild: ${msg.guild?.name}`, "Events.MessageCreate");

        } catch (err) {
            const errMsg: string = (err as Error).message;
            if (errMsg.includes("Unknown Message")) {
                debug(`Al guien borro el embed antes - Server: ${msg.guild?.name}`, "Events.MessageCreate");
                return;
            }
            if (errMsg.includes("Missing Permissions")) {
                debug(`No tengo permisos para borrar mensajes en el canal: ${msg.channel.id} -Server: ${msg.guild?.name}`, "Events.MessageCreate");
                return;
            }
            if (attempt === 4) {
                debug(`No se puedo borrar el embed del mensaje original, , Guild: ${msg.guild?.name}, Error: ${errMsg}`, "Events.MessageCreate");
            }
        }
    }
};

// ================================= emojiDelet ================================= //
async function deleteMSG(msg: Message, autorId: string) {
    if (!msg.channel.isSendable() || !msg.deletable) return;
    try {
        await msg.react('❌');
        const collector = msg.createReactionCollector({
            filter: (reaction, user) => reaction.emoji.name === '❌' && user.id === autorId,
            max: 1,
            time: 20_000
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
            error(`Error en deleteMSG: ${errMsg}, Guild: ${msg.guild?.name}`, "Events.MessageCreate");
        }
    }
};
