// src/sys/embedding/Apis/PixivAPI.ts
import { Message, AttachmentBuilder, TextChannel, MediaGalleryBuilder, MediaGalleryItemBuilder, SeparatorBuilder, ContainerBuilder, SeparatorSpacingSize, TextDisplayBuilder } from "discord.js";
import { ApiHandler, pResult } from "../embedingSwitch"
import { debug, error } from "../../logging";

// ================================= APi: Pixiv Meltrys ================================= //
export class apiPixivCustom implements ApiHandler {
    name = "PixivMeltrys";

    isAvailable(): boolean { return true; }
    isDomain(domain: string): boolean { return /(^|:\/\/|\.)pixiv\.net/.test(domain); }
    async guildChk(domain: string, guildId: string | null, guildConfigs: Map<string, any>): Promise<boolean> {
        if (!domain) return false;
        const aDom = "Meltrys.Pixiv";
        const albe = guildConfigs.get(aDom)
        if (albe && albe.enabled === false) {
            debug(`El uso de Meltrys Pixiv está deshabilitado en este gremio: ${guildId}`, "ApiReplacement");
            return false;
        }
        return true;
    }

    async process(url: string, message?: Message, isSpoiler?: boolean): Promise<pResult> {
        if (!message) return { ok: false };
        if (!message.channel || !message.channel.isTextBased()) return { ok: false };

        const textChannel = message.channel as TextChannel;
        const match = url.match(/pixiv\.net\/(?:en\/)?artworks\/(\d+)/i);
        if (!match) return { ok: false };

        const illustId = match[1];
        await textChannel.sendTyping();

        const pixivData = await PixivAPI.getIllustData(illustId);
        if (!pixivData || pixivData.buffers.length === 0) return { ok: false };
        const delet = 15 * 1_000

        if (pixivData.fPic === 2) return { ok: false };

        if (pixivData.isNSFW && !textChannel.nsfw) {
            const delN = await message.reply({ content: `⚠️ Por normas de Discord nuestra API no publica contenido NSFW en canales no NSFW!! \nUsando metodo externo...`, allowedMentions: { repliedUser: false } });
            setTimeout(async () => { await delN.delete() }, delet);
            return { ok: false };
        }

        try {
            const files: AttachmentBuilder[] = [];
            const gallegry = new MediaGalleryBuilder();
            const components: any[] = []
            const spoiler = isSpoiler === true;

            let desc = `> 👤 [${pixivData.author}](${pixivData.url})`;
            if (pixivData.stats) desc += `\n> ❤️ **${pixivData.stats.likes}** | 👁️ **${pixivData.stats.view}** | 💬 **${pixivData.stats.comments}** | 🔖 **${pixivData.stats.guardados}**`;
            if (pixivData.sizePag > 10) desc += `\n> 🖼️ **Mostrando 10 de ${pixivData.sizePag} imagenes!**`
            else desc += `\n> 🖼️ **Galeria de ${pixivData.sizePag === 1 ? 'una imagen!' : `${pixivData.buffers.length} imagenes`}**`;
            if (pixivData.isIA) desc += `\n> 🤖 **Esta galeria esta marcada como generada por IA**`;

            let midleTxt: string | undefined = undefined;
            if (pixivData.title) midleTxt = `**${pixivData.title}**`
            if (pixivData.descripcion) midleTxt += "\n\n" + pixivData.descripcion;
            if (pixivData.tags) midleTxt += "\n\n" + pixivData.tags;

            pixivData.buffers.forEach((buffer, index) => {
                const fileName = `PXimg_${illustId}_${index}.png`;
                files.push(new AttachmentBuilder(buffer, { name: fileName }));
            })

            for (const fol of files) { gallegry.addItems(new MediaGalleryItemBuilder().setURL(`attachment://${fol.name}`)); }

            const container = new ContainerBuilder();
            const parte = new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(desc)).setAccentColor(0x0096FA).setSpoiler(spoiler).addSeparatorComponents(parte);
            if (midleTxt) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(midleTxt));
            if (gallegry.items.length > 0) container.addSeparatorComponents(parte).addMediaGalleryComponents(gallegry);
            container.addSeparatorComponents(parte).addTextDisplayComponents(new TextDisplayBuilder().setContent(`> Pixiv • by Meltryllis Api`))

            components.push(container);
            return { ok: true, pack: [{ [pixivData.author]: { components: components, files: files, isV2: true } }] };

        } catch (e) {
            error(`[apiPixivCustom] Error al enviar embeds: ${e}`);
            return { ok: false };
        }
    }
}

// ================================= Pixiv Process ================================= //
interface PixivPostData {
    title: string;
    author: string;
    url: string;
    buffers: Buffer[];
    sizePag: number;
    isNSFW: boolean;
    fPic: number;
    isIA: boolean;
    stats: { view: string, comments: string, likes: string, guardados: string };
    descripcion?: string;
    tags?: string;
}

interface PixivInfoResponse {
    error: boolean;
    body?: {
        title: string;
        userName: string;
        xRestrict: number;
        illustType: number;
        aiType?: number;
        description?: string;
        viewCount?: number;
        likeCount?: number;
        commentCount?: number;
        bookmarkCount?: number;
        tags: { tags: Array<{ tag: string }> }
    };
}

interface PixivPagesResponse {
    error: boolean;
    body?: Array<{
        urls: {
            regular: string;
            original: string;
        }
    }>;
}

const cookiePixiv = process.env.PIXIV_COOKIE ? `PHPSESSID=${process.env.PIXIV_COOKIE}` : "";
export class PixivAPI {
    private static get headers() {
        return {
            'Referer': 'https://www.pixiv.net/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Cookie': cookiePixiv
        };
    }

    public static async getIllustData(illustId: string): Promise<PixivPostData | null> {
        try {
            const infoRes = await fetch(`https://www.pixiv.net/ajax/illust/${illustId}`, { headers: this.headers });
            const infoData = await infoRes.json() as PixivInfoResponse;
            const maxPics = 10;

            if (infoData.error || !infoData.body) {
                debug(`[PixivAPI] Post borrado o inaccesible. ID: ${illustId}`);
                return null;
            }

            const isNsfwContent = infoData.body.xRestrict > 0;
            const typePic = infoData.body.illustType
            const pagesRes = await fetch(`https://www.pixiv.net/ajax/illust/${illustId}/pages`, { headers: this.headers });
            const pagesData = await pagesRes.json() as PixivPagesResponse;
            if (pagesData.error || !pagesData.body || pagesData.body.length === 0) {
                debug(`[PixivAPI] Error al obtener páginas para ID: ${illustId}`);
                return null;
            }

            const maxImages = Math.min(pagesData.body.length, maxPics);
            const fetchPromises = [];

            for (let i = 0; i < maxImages; i++) {
                const exactUrl = pagesData.body[i].urls.regular || pagesData.body[i].urls.original;
                fetchPromises.push(
                    fetch(exactUrl, { headers: this.headers })
                        .then(res => res.arrayBuffer())
                        .then(a => Buffer.from(a))
                );
            }

            const imageBuffers = await Promise.all(fetchPromises);
            const listTag: string[] = infoData.body.tags?.tags.map(t => t.tag) || [];
            const tageos = listTag.length > 0 ? this.buildTageo(listTag) : undefined;

            return {
                title: infoData.body.title || 'Pixiv Art',
                author: infoData.body.userName || 'Autor Desconocido',
                url: `https://www.pixiv.net/en/artworks/${illustId}`,
                buffers: imageBuffers,
                sizePag: pagesData.body.length,
                isNSFW: isNsfwContent,
                fPic: typePic,
                isIA: infoData.body.aiType === 2,
                stats: { view: this.numShort(infoData.body.viewCount), comments: this.numShort(infoData.body.commentCount), likes: this.numShort(infoData.body.likeCount), guardados: this.numShort(infoData.body.bookmarkCount) },
                descripcion: infoData.body.description ? this.clenDesc(infoData.body.description) : undefined,
                tags: tageos ? tageos.join(" ") : undefined,
            };

        } catch (e) {
            error(`[PixivAPI] Error interno al obtener ilustracion ${illustId}: ${e}`);
            return null;
        }
    }

    private static numShort(total?: number | null): string {
        if (!total) return "0";
        if (total >= 1_000_000_000) return `${(total / 1_000_000_000).toFixed(1)}B`;
        if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(1)}M`;
        if (total >= 1_000) return `${(total / 1_000).toFixed(1)}K`;
        return total.toString();
    }

    private static buildTageo(list: string[]): string[] {
        const stgTags = [];
        for (const t of list) {
            stgTags.push(`[#${t}](https://www.pixiv.net/tags/${t})`);
        }
        return stgTags;
    }

    private static clenDesc(texto: string) {
        return texto
            .replace(/<\s*br\s*\/?\s*>/gi, '\n')
            .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/[ \t]+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }
}

