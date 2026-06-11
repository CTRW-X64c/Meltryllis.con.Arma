// src/sys/embeding/embedService.ts
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, Events, Message } from "discord.js";
import { getGuildReplacementConfig } from "../DB-Engine/links/Embed";
import { getConfigMap } from "../DB-Engine/links/ReplyBots";
import buildReplacements from "./index";
import { debug, error } from "../logging";
import i18next from "i18next";
import { urlProcess } from "./embedingSwitch";

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

        const guildConfigs = guildId ? await getGuildReplacementConfig(guildId) : new Map();
        const replacements = buildReplacements(guildConfigs);
        const replacedUrls: string[] = [];
        const origLink: string[] = [];

        for (const match of urls) {
            let domainSite: string | null = null;
            const originalUrl = match[1];

            try {
                const urlObject = new URL(originalUrl);
                domainSite = urlObject.hostname.replace('www.', '');
            } catch (err) {
                debug(`URL Invalida: ${originalUrl}`, "Events.MessageCreate");
                continue;
            }

            const replacedUrl = await urlProcess(originalUrl, domainSite, guildId!, guildConfigs, replacements);

            if (replacedUrl) {
                const hiddenMessage = message.content.split("||").length > 2;
                let messageContent = i18next.t("common:embedService.format_link", { Site: domainSite, RemUrl: replacedUrl.remp });
                if (hiddenMessage) {
                    messageContent = i18next.t("common:embedService.format_link_spoiler", { Site: domainSite, RemUrl: replacedUrl.remp });
                }
                replacedUrls.push(messageContent);
                origLink.push(replacedUrl.org);
            }
        }

        if (replacedUrls.length > 0 && origLink.length > 0) {
            embeRemove(message);
            post(message, replacedUrls, autorId, origLink);
        }
    });
};

// =========== embdClean =========== //
const embeRemove = async (msg: Message) => {
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

// =========== post =========== //
const post = async (msg: Message, replacedUrls: string[], autorId: string, origLink: string[]) => {
    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const MAX_MSG = 5;
    const mxAtt = 3;
    const canSend = msg.channel.isSendable();
    const content = replacedUrls.join(' | ');
    if (!canSend) return;

    const xy = new ActionRowBuilder<ButtonBuilder>()
    xy.addComponents(new ButtonBuilder().setLabel("Original Link").setStyle(ButtonStyle.Link).setURL(origLink[0]));
    if (origLink[1]) xy.addComponents(new ButtonBuilder().setLabel("Original Link").setStyle(ButtonStyle.Link).setURL(origLink[1]));
    if (origLink[2]) xy.addComponents(new ButtonBuilder().setLabel("Original Link").setStyle(ButtonStyle.Link).setURL(origLink[2]));
    if (origLink[3]) xy.addComponents(new ButtonBuilder().setLabel("Original Link").setStyle(ButtonStyle.Link).setURL(origLink[3]));
    if (origLink[4]) xy.addComponents(new ButtonBuilder().setLabel("Original Link").setStyle(ButtonStyle.Link).setURL(origLink[4]));

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
            sentMsg = await msg.reply({ content: content, components: [xy], allowedMentions: { repliedUser: false } });
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

                await sentMsg.edit({ content: i18next.t("common:embedService.try", { a1: `${attempt}/${mxAtt}` }), allowedMentions: { repliedUser: false } });
                await wait(2_000);

                await sentMsg.edit({ content: content, allowedMentions: { repliedUser: false } });
                await wait(2_500 * attempt);
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
        const buttonBatch = origLink.slice(i, i + MAX_MSG);
        const yx = new ActionRowBuilder<ButtonBuilder>();
        if (buttonBatch[0]) yx.addComponents(new ButtonBuilder().setLabel("Original Link").setStyle(ButtonStyle.Link).setURL(buttonBatch[0]));
        if (buttonBatch[1]) yx.addComponents(new ButtonBuilder().setLabel("Original Link").setStyle(ButtonStyle.Link).setURL(buttonBatch[1]));
        if (buttonBatch[2]) yx.addComponents(new ButtonBuilder().setLabel("Original Link").setStyle(ButtonStyle.Link).setURL(buttonBatch[2]));
        if (buttonBatch[3]) yx.addComponents(new ButtonBuilder().setLabel("Original Link").setStyle(ButtonStyle.Link).setURL(buttonBatch[3]));
        if (buttonBatch[4]) yx.addComponents(new ButtonBuilder().setLabel("Original Link").setStyle(ButtonStyle.Link).setURL(buttonBatch[4]));
        try {
            const sentMsg = i === 0
                ? await msg.reply({ content: batch.join(' | '), components: [yx], allowedMentions: { repliedUser: false } })
                : await msg.channel.send({ content: batch.join(' | '), components: [yx] });
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
};

// =========== emojiDelet =========== //
const deleteMSG = async (msg: Message, autorId: string) => {
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
