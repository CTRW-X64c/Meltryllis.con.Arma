// src/sys/embedding/Apis/reddita.ts
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, GuildTextBasedChannel, MediaGalleryBuilder, MediaGalleryItemBuilder, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder } from "discord.js";
import { ApiHandler, pMSGin, pResult } from "../embedingSwitch";
import { RedditPost } from "../../zGears/RedditApi";
import { error } from "../../logging";
import { redditApi, reddSouceApi } from "../../zGears/RedditApi";
import emojis from '../../../../adds/otros/emojis.json'

// ================================= APi: Reddit Meltrys ================================= //

export class redditMeltrys implements ApiHandler {
    name = "redditMeltrys";

    isAvailable(): boolean { return true; }
    isDomain(domain: string): boolean { return /(^|:\/\/|\.)reddit.com/.test(domain); }
    async guildChk(domain: string, guildConfigs: Map<string, any>): Promise<boolean> {
        if (!domain) return false;
        const aDom = "Meltrys.Reddit", albe = guildConfigs.get(aDom);
        if (albe && albe.enabled === false) return false;
        return true;
    }

    public async process(pMsg: pMSGin): Promise<pResult> {
        const ch: GuildTextBasedChannel | null = (pMsg.message && !pMsg.message.channel.isDMBased()) ? pMsg.message.channel : null;
        if (ch) await ch.sendTyping();

        const dta = await RedditSolve.prossesPost(pMsg.url)
        if (!dta) return { ok: false }

        if (ch) {
            const chNSFW = ch.isThread() ? ch.parent?.nsfw : ch.nsfw;
            if (dta.is18Pin && !chNSFW) {
                const delN = await pMsg.message!.reply({
                    content: `⚠️ Por normas de Discord nuestra API no publica contenido NSFW en canales no NSFW!! \nUsando metodo externo...`,
                    allowedMentions: { repliedUser: false }
                });
                setTimeout(async () => { await delN.delete() }, 10_000);
                return { ok: false };
            }
        }

        const spoiler = pMsg.isSpoiler === true;
        const itemPack: any[] = []

        let text = `> ### ${dta.title}`, toptxt = "";
        if (dta.desc) { text += ("\n\n" + dta.desc) }
        // === //
        toptxt += dta.autor ? (`### Publicado por ${dta.autor} en ${dta.from}`) : (`### Publicado en ${dta.from}`);
        if (dta.score) toptxt += ("\n" + `**${dta.score}**`);
        const BottomTxt = `${emojis.logos.reddit} *** Reddit Gallery • by Meltryllis Api *** `;
        // === //
        const parte = new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
        const gallery = new MediaGalleryBuilder(), galleryExt = new MediaGalleryBuilder();
        if (dta.media && dta.media.length > 0) {
            const urls = dta.media;
            const firstTen = urls.slice(0, 10);
            for (const url of firstTen) {
                gallery.addItems(new MediaGalleryItemBuilder().setURL(url));
            }
            if (urls.length > 10) {
                const remaining = urls.slice(10);
                for (const url of remaining) {
                    galleryExt.addItems(new MediaGalleryItemBuilder().setURL(url));
                }
            }
        }

        const box = new ContainerBuilder();
        const inCall = `> ## Nuevo post en Reddit ${dta.from ? ` de ${dta.from}` : ""}` + (pMsg.isSpoiler ? "\n NSFW POST EN CANAL NO NSFW" : "");
        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setLabel("URL Post").setURL(dta.url).setStyle(ButtonStyle.Link));
        // dataComp
        if (pMsg.intCall) box.addTextDisplayComponents(new TextDisplayBuilder().setContent(inCall)).addSeparatorComponents(parte);
        if (dta.from) box.addTextDisplayComponents(new TextDisplayBuilder().setContent(toptxt)).addSeparatorComponents(parte)
        box.addTextDisplayComponents(new TextDisplayBuilder().setContent(text)).addSeparatorComponents(parte);
        box.addMediaGalleryComponents(gallery);
        if (galleryExt.items.length > 0) { box.addSeparatorComponents(parte).addTextDisplayComponents(new TextDisplayBuilder().setContent("> **Galeria parte 2**")).addMediaGalleryComponents(galleryExt) }
        box.addActionRowComponents(actionRow);
        box.addSeparatorComponents(parte).addTextDisplayComponents(new TextDisplayBuilder().setContent(BottomTxt)).setAccentColor(0xFF4500).setSpoiler(spoiler);

        itemPack.push(box);

        return { ok: true, pack: [{ [dta.exitPostId]: { components: itemPack, isV2: true } }] }
    }
}

interface outRedditSolve {
    exitPostId: string,
    title: string,
    desc: string | undefined,
    from: string | undefined,
    autor: string | undefined,
    url: string,
    score: string | undefined,
    is18Pin: boolean,
    media: string[],
}

class RedditSolve {
    public static async prossesPost(url: string): Promise<outRedditSolve | null> {
        const varPost = await this.getPara(url)
        if (!varPost) return null

        const getDta = await redditApi.getPost({ souce: varPost.name, posUrl: varPost.id, type: varPost.type as reddSouceApi })
        if (!getDta.data?.children || !Array.isArray(getDta.data.children)) return null

        const dta = getDta.data.children[0].data
        if (!dta) { error("Error en getr data"); return null }

        const hasMMI = !!(dta.media_metadata && Object.keys(dta.media_metadata).length > 0);
        const isGallery = dta.post_hint === 'image' || !!dta.is_gallery;
        const isGifOnly = !!(dta.secure_media?.reddit_video?.is_gif && !dta.secure_media?.reddit_video?.has_audio);
        if (!hasMMI && !isGallery && !isGifOnly) return null;

        const isVideo = dta.post_hint ? ['rich:video', "hosted:video"].includes(dta.post_hint) : false;
        if (isVideo) return null;
        // ======= down pics ======= //
        const urlMedia = await this.medios(dta);
        if (urlMedia.length === 0) return null;
        // ======= other ======= //
        const isNSFW = !!dta.over_18
        const getScore = this.karmeter({ up: dta.ups ?? 0, down: dta.downs ?? 0, ratio: dta.upvote_ratio ?? 0, comento: dta.num_comments ?? 0 })
        const urlPost = `https://www.reddit.com` + dta.permalink;
        // ======= out ======= // 
        return {
            exitPostId: `${varPost.id}-${varPost.name}`, // id-Nomover
            title: dta.title,
            desc: dta.selftext,
            from: dta.subreddit_name_prefixed ?? dta.subreddit,
            url: urlPost,
            autor: dta.author,
            score: getScore,
            is18Pin: isNSFW,
            media: urlMedia
        }
    }
    // === GET DATOS LINK === //
    private static async getPara(url: string) {
        let dta = { type: "", name: "", id: "" };
        let woUrl = url;
        if (url.includes("/s/")) {
            const response = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': 'Meltrys 1.1' } });
            if (!response.ok) return null
            woUrl = response.url
        };

        if (woUrl.includes("?")) woUrl = woUrl.split("?")[0];

        const subGex = woUrl.match(/reddit.com\/(r|user)\/([^\/]+)/i);
        if (subGex) dta.name = subGex[2];
        else return null;

        const idPostGex = woUrl.match(/reddit.com\/(r|user)\/[^\/]+\/comments\/(.*)/i);
        if (idPostGex) dta.id = idPostGex[2];
        else return null;

        const isUser = woUrl.includes('/user/');
        dta.type = isUser ? 'user' : 'subreddit';

        return dta
    }
    // === BUILDING LINKLS === //
    private static async medios(dta: RedditPost): Promise<string[]> {
        let rawLink: string[] = [];
        // ======= pics ======= //
        if (dta.media_metadata && dta.gallery_data?.items) { // ordenador de galeria
            for (const item of dta.gallery_data.items) {
                const gen = dta.media_metadata[item.media_id];
                if (gen && gen.status === 'valid') {
                    const ext = gen.m.split('/')[1] || 'jpg';
                    const urlBuil = `https://i.redd.it/${gen.id}.${ext}`;
                    rawLink.push(urlBuil);
                }
            }
        } else if (dta.media_metadata) { // galeria sin orden
            for (const gen of Object.values(dta.media_metadata)) {
                if (gen.status === 'valid') {
                    const ext = gen.m.split('/')[1] || 'jpg';
                    const urlBuil = `https://i.redd.it/${gen.id}.${ext}`;
                    rawLink.push(urlBuil);
                }
            }
        }
        // ======= singlePic ======= //
        const onePic = dta.url_overridden_by_dest;
        if (onePic && (onePic.endsWith(".gif") || onePic.endsWith(".jpg") || onePic.endsWith(".png") || onePic.endsWith(".jpeg"))) {
            rawLink.push(onePic);
        }
        // ======= singleGif ======= //
        if (dta.secure_media) {
            const urlRedd = dta.secure_media.reddit_video?.fallback_url
            const isGif = !!dta.secure_media.reddit_video?.is_gif;
            const hasAudo = !!dta.secure_media.reddit_video?.has_audio;
            if (urlRedd && !hasAudo && !isGif) {
                const vidCMAF = urlRedd.split("?")[0]
                rawLink.push(vidCMAF)
            }
        }

        return rawLink
    }
    // === BUILD STATS === //
    private static karmeter(dta: { up: number, down: number, ratio: number, comento: number }): string | undefined {
        if (dta.up === 0 && dta.down === 0) return undefined

        let workNum: number, flow: string;
        if (dta.up > dta.down) { workNum = dta.up; flow = emojis.int.up }
        else { workNum = dta.down; flow = emojis.int.down }

        const abrNum = (count: number) => {
            let outNum: string
            if (count >= 1_000_000_000) outNum = `${(count / 1_000_000_000).toFixed(1)}B`;
            else if (count >= 1_000_000) outNum = `${(count / 1_000_000).toFixed(1)}M`;
            else if (count >= 1_000) outNum = `${(count / 1_000).toFixed(1)}K`;
            else outNum = count.toString();
            return outNum
        }

        const rat = (dta.ratio * 100).toFixed(0);
        return `${flow} ${abrNum(workNum)} ${emojis.pipe} ${emojis.int.yy} ${rat}% ${emojis.pipe} ${emojis.int.comento} ${abrNum(dta.comento)}`
    }
}

