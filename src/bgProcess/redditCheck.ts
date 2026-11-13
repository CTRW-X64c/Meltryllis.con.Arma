// src/client/coreCommands/redditCheck.ts
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, GuildTextBasedChannel, MessageFlags } from 'discord.js';
import { getAllRedditFeeds, updateRedditFeedLastPost, RedditFeed, removeRedditFeed } from '../sys/DB-Engine/links/Reddit';
import { debug, error } from '../sys/logging';
import i18next from 'i18next';
import { redditApi, RedditPost, reddSouceApi } from '../sys/zGears/RedditApi';
import urlStatusManager from '../sys/embedding/domainChecker';
import { badEmbed } from '../sys/embedding/embedService';
import { stillOn } from '../sys/zGears/auxiliares';
import { redditMeltrys } from '../sys/embedding/Apis/reddita';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const minuts = 1_000 * 60, second = 1_000;
let isRuning = false;
export async function startRedditChecker(client: Client) {
    if (isRuning) return;
    isRuning = true;
    try {
        await wait(30 * second)
        debug("[Reddit Checker]: Iniciando ciclo de revisión de feeds...");

        const allFeeds = await getAllRedditFeeds() ?? [];
        if (allFeeds.length === 0) return;

        let timeRun = Date.now(), runsCount = 0;
        for (const feed of allFeeds) {
            processSingleFeed(client, feed).catch((e: any) => { error(`[Reddit Checker]: Error en Feed: ${feed.subreddit_name} del Guild: ${feed.guild_id}, error: ${e.message}`) });
            runsCount++;

            if (runsCount >= 75) {
                const lfTime = minuts - (Date.now() - timeRun);
                const tiame = lfTime > 0 ? lfTime + minuts : 2 * minuts;
                await wait(tiame);
                timeRun = Date.now();
                runsCount = 0;
            }
        }
    } catch (e) { error(`[Reddit Checker]: Error en el ciclo principal del checker: ${e} `) }
    finally { isRuning = false }
}

/* ====================================== Process  ====================================== */
async function processSingleFeed(client: Client, feed: RedditFeed) {
    let ch: GuildTextBasedChannel;
    const chkSout = await stillOn({ cli: client, chkChID: feed.channel_id, chkGuiId: feed.guild_id });
    if (!chkSout.ok) {
        if (chkSout.erase) { await removeRedditFeed(feed.guild_id, feed.subreddit_name).catch((ex: any) => { debug(`Error al borrar el feed ${feed.id}: ${ex.message}`, "RedditCheck") }) }
        debug(`${chkSout.msg}`, "RedditCheck");
        return;
    } else { ch = chkSout.canale as GuildTextBasedChannel };

    const solveData = (dt: string): { name: string | undefined; showName: string; resource: reddSouceApi } => {
        const nameTets = dt.match(/(?:reddit\.com\/(?:r|user|u)\/|^(?:r|u)\/)([a-zA-Z0-9_-]+)/);
        const nameOut = nameTets ? nameTets[1] : undefined;
        // == name == //
        const resTest = (dt.includes('/user/') || dt.startsWith('u/'))
        const resOut = resTest ? 'user' : 'subreddit'
        const show = resTest ? `u/${nameOut}` : `r/${nameOut}`
        // == out == //
        return { name: nameOut, showName: show, resource: resOut }
    }

    const getDta = solveData(feed.subreddit_url)
    if (!getDta.name) return;

    try {
        const jsonData = await redditApi.getFeed({ souce: getDta.name, type: getDta.resource, limit: 20 });
        if (jsonData?.reason === 'banned' || jsonData?.reason === 'private' || jsonData?.reason === 'quarantined') {
            try {
                const removed = await removeRedditFeed(feed.guild_id, feed.subreddit_name);
                if (removed && ch) {
                    switch (jsonData.reason) {
                        case 'banned': await ch.send(i18next.t("commands:reddit.check.Reduit_baneado", { a1: getDta.showName }));
                            break;
                        case 'private': await ch.send(i18next.t("commands:reddit.check.Reduit_privado", { a1: getDta.showName }));
                            break;
                        case 'quarantined': await ch.send(i18next.t("commands:reddit.check.Reduit_cuarentena", { a1: getDta.showName }));
                            break;
                        default:
                            break;
                    }
                }
                debug(`[Reddit Checker]: Se eliminó ${getDta.showName} por razón: ${jsonData.reason}.`);
            }
            catch (err) { error(`[Reddit Checker]: Error al eliminar ${getDta.showName}: ${err}`) }
            return;
        }

        /* ====================================== AQUI CONTINUA NORMAL ====================================== */
        if (!jsonData?.data?.children || !Array.isArray(jsonData.data.children)) throw new Error('Estructura de respuesta inválida de Reddit API');

        const posts = jsonData.data.children;
        if (!posts || posts.length === 0) return;

        const lastPostId = feed.last_post_id?.split("#") || [];
        const newPosts: RedditPost[] = [];

        for (const postWrapper of posts) {
            const post = postWrapper.data;
            if (post.pinned || post.stickied) continue;
            if (lastPostId.includes(post.name)) break;
            newPosts.push(post);
        }

        if (newPosts.length > 0) {
            debug(`[Reddit Checker]: ¡${newPosts.length} post(s) nuevo(s) en ${getDta.showName}`);
            const newIds = newPosts.map((p) => p.name);
            const newLastIds = Array.from(new Set([...newIds, ...lastPostId])).slice(0, 5).filter(Boolean);
            newPosts.reverse()

            for (const post of newPosts) {
                let baseUrl: string | null = null;
                const aDmn = urlStatusManager.getActiveUrl("Api");
                const rDmn = urlStatusManager.getActiveUrl("reddit");
                if (process.env.EMBEDEZ_REDDITCHECK !== "off" && aDmn?.includes("embedez.com")) baseUrl = `${aDmn}?q=https://www.reddit.com`;
                else baseUrl = rDmn;
                if (baseUrl === null) { error("[Reddit Checker]: sin dominios disponibles!!"); return };

                const hint = post.post_hint; const noHint = post.is_gallery || post.is_video;
                switch (feed.filter_mode) {
                    case 'media_only':
                        const visualHint = hint === 'image' || hint === 'hosted:video' || hint === 'rich:video' || hint === 'link';
                        const isMedia = visualHint || noHint;
                        if (!isMedia) { continue; } break;
                    case 'text_only':
                        if (hint !== 'self') { continue; } break;
                    case 'all':
                    default: break;
                }

                // Hyperlink Fix & procesamiento de link
                const nsfwPost = !!post.over_18;
                const nsfwCh = ch.isThread() ? ch.parent?.nsfw : ch.nsfw;
                const nsfwCheck = nsfwPost && !nsfwCh;
                const pLink = post.permalink;
                const postLink = `https://${baseUrl}${pLink}`;
                const orgTitle = post.title ?? "Sin Título";
                const shrtTitle = orgTitle.length > 50 ? orgTitle.substring(0, 50) + "..." : orgTitle;
                const emojiRgx = /<a?:[a-zA-Z0-9_]+:\d+>|[\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Component}\u{200D}]+/gu;
                const safeTitle = shrtTitle
                    .replace(/\[/g, '').replace(/\]/g, '').replace(/\\/g, '').replace(/\//g, '').replace(/\|/g, ' ').replace(emojiRgx, '');
                const safeTitleOut = safeTitle.length > 2 ? safeTitle : "Reddit Post!";
                let msg = i18next.t("commands:reddit.check.Reduit_pioste", { a1: getDta.showName, a2: safeTitleOut.trim(), a3: postLink });
                if (nsfwCheck) { msg = i18next.t("commands:reddit.check.Reduit_pioste_nsfw", { a1: getDta.showName, a2: safeTitleOut.trim(), a3: postLink }) }

                publisher(msg, ch, pLink, post.name, nsfwCheck).catch();
                await wait(5 * second);
            }

            const latestPostId = newLastIds.length ? newLastIds.join('#') : 'NoLastPost';
            await updateRedditFeedLastPost(feed.id, latestPostId, feed.guild_id);
        }
    } catch (err) { error(`[Reddit Checker]: Error procesando el feed de ${getDta.showName}: ${err}`) }
}

/* ====================================== Publisher ====================================== */
let failPost = false;
let failPostQueue = new Map<string, data>();
interface data { dch: GuildTextBasedChannel; dlink: string; dnsfw: boolean; }
async function publisher(msg: string, ch: GuildTextBasedChannel, link: string, idPost: string, nsfw: boolean) {
    try {
        const URL = `https://www.reddit.com${link}`;
        try {
            const localAPI = new redditMeltrys()
            const porcessApi = await localAPI.process({ url: URL, isSpoiler: nsfw, intCall: true })
            if (porcessApi.ok && porcessApi.pack) {
                const packData = Object.values(porcessApi.pack[0])[0];
                if (!packData.components || packData.components.length === 0) throw new Error("No data Pack RedditCustom");
                else {
                    const aMsg = await ch.send({ components: packData.components, flags: MessageFlags.IsComponentsV2 });
                    if (aMsg) return
                    else throw new Error("Falla post pack RedditCustom");
                }
            }
        } catch (e) { debug(`[Reddit Publisher]: Error al publicar con Meltryllis Api en RdditFollow: ${e} `) }

        const boton = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setLabel("Original Link").setStyle(ButtonStyle.Link).setURL(URL));
        const sMsg = await ch.send({ content: msg, components: [boton] });
        await wait(5 * second);

        let freshMsg = await ch.messages.fetch(sMsg.id).catch(() => null);
        for (let attempt = 1; attempt <= 2 && freshMsg && freshMsg.embeds.length === 0; attempt++) {
            await sMsg.edit({ content: "⏳", components: [boton] });
            await wait(4 * second);

            await sMsg.edit({ content: msg, components: [boton] });
            await wait(6 * second + (attempt * second));
            freshMsg = await ch.messages.fetch(sMsg.id).catch(() => null);
        }

        if (freshMsg && freshMsg.embeds.length === 0) {
            failPostQueue.set(idPost, { dch: ch, dlink: URL, dnsfw: nsfw }); checkFailQueue().catch();
            await sMsg.delete().catch(() => null);
            debug(`[Reddit Publisher]: Mensaje eliminado - no se generaron embeds para: ${URL} `);
            return;
        }

        if (freshMsg && freshMsg.embeds.length > 0 && badEmbed(freshMsg.embeds[0])) {
            failPostQueue.set(idPost, { dch: ch, dlink: URL, dnsfw: nsfw }); checkFailQueue().catch();
            await sMsg.delete().catch(() => null);
            debug(`[Reddit Publisher]: Mensaje eliminado - bad msg en eembed: ${URL} `);
            return;
        }

    } catch (e) { error(`[Reddit Publisher]: Error al publicar: ${e} `) }
}

// Lista de fallidos
async function checkFailQueue() {
    try {
        if (failPost || failPostQueue.size === 0) return;
        failPost = true;
        await wait(10 * minuts);
        const list = Array.from(failPostQueue.values());
        failPostQueue.clear();

        for (const post of list) {
            const boton = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setLabel("Original Link").setStyle(ButtonStyle.Link).setURL(post.dlink));
            let msg = i18next.t("commands:reddit.check.Reduit_pioste_resend", { a1: post.dlink });
            if (post.dnsfw) msg = i18next.t("commands:reddit.check.Reduit_pioste_nsfw_resend", { a1: post.dlink });
            await post.dch.send({ content: msg, components: [boton] });
            await wait(4 * second);
        }

        failPost = false;
        debug(`[Reddit Publisher]: se volvieron a procesar ${list.length} post fallidos.`)
        if (failPostQueue.size > 0) checkFailQueue().catch();
    } catch (e) { error(`[Reddit Publisher]: Error al republicar: ${e} `) }
}
