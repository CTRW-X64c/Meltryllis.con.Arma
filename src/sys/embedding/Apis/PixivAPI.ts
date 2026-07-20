// src/sys/embedding/Apis/PixivAPI.ts
import { Message, AttachmentBuilder, TextChannel, EmbedBuilder } from "discord.js";
import { deleteMSG, embeRemove } from "../embedService";
import { ApiHandler } from "../embedingSwitch"
import { debug } from "../../logging";

// ================================= APi: Pixiv Meltrys ================================= //
export class apiPixivCustom implements ApiHandler {
    name = "PixivMeltrys";

    isAvailable(): boolean { return true; }
    isDomain(domain: string): boolean { return domain.includes("pixiv.net") || domain.includes("pximg.net"); }
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

    async process(url: string, message?: Message): Promise<{ fix: string | null, ok: boolean }> {
        if (!message) return { fix: null, ok: false };
        if (!message.channel || !message.channel.isTextBased()) return { fix: null, ok: false };

        const textChannel = message.channel as TextChannel;
        const match = url.match(/pixiv\.net\/(?:en\/)?artworks\/(\d+)/i);
        if (!match) return { fix: null, ok: false };

        const illustId = match[1];
        await textChannel.sendTyping();

        const pixivData = await PixivAPI.getIllustData(illustId);
        if (!pixivData || pixivData.buffers.length === 0) return { fix: null, ok: false };
        const delet = 15 * 1_000

        if (pixivData.fPic === 2) {
            const delF = await message.reply({ content: `⚠️ Nuestra api no soporta animaciones! \nUsando metodo externo...`, allowedMentions: { repliedUser: false } });
            setTimeout(async () => { await delF.delete() }, delet);
            return { fix: null, ok: false };
        }
        if (pixivData.isNSFW && !textChannel.nsfw) {
            const delN = await message.reply({ content: `⚠️ Por normas de Discord nuestra API no publica contenido NSFW en canales no NSFW!! \nUsando metodo externo...`, allowedMentions: { repliedUser: false } });
            setTimeout(async () => { await delN.delete() }, delet);
            return { fix: null, ok: false };
        }

        try {
            const embeds: EmbedBuilder[] = [];
            const files: AttachmentBuilder[] = [];

            pixivData.buffers.forEach((buffer, index) => {
                const fileName = `image${index}.png`;
                const attachment = new AttachmentBuilder(buffer, { name: fileName });
                let desc = `🖼️ **Galeria de ${pixivData.buffers.length > 1 ? `${pixivData.buffers.length} imagenes` : 'una imagen!'}**`
                if (pixivData.buffers.length > 5) desc = `🖼️ **Mostrando ${pixivData.buffers.length} de ${pixivData.sizePag} imagenes!**`
                files.push(attachment);
                const embed = new EmbedBuilder()
                    .setURL(pixivData.url)
                    .setImage(`attachment://${fileName}`);
                if (index === 0) {
                    embed.setTitle(pixivData.title)
                        .setAuthor({ name: `👤 ${pixivData.author}` })
                        .setDescription(desc)
                        .setColor('#0096fa')
                        .setFooter({
                            text: `Pixiv • by Meltryllis Api`,
                            iconURL: 'https://s.pximg.net/common/images/apple-touch-icon.png'
                        });
                }
                embeds.push(embed);
            });
            const msgApi = await message.reply({
                embeds: embeds,
                files: files,
                allowedMentions: { repliedUser: false }
            });

            if (!msgApi) { return { fix: null, ok: false }; }
            else {
                deleteMSG(msgApi, message.author.id);
                embeRemove(message)
                return { fix: null, ok: true };
            }
        } catch (error) {
            console.error(`[apiPixivCustom] Error al enviar embeds:`, error);
            return { fix: null, ok: false };
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
}

interface PixivInfoResponse {
    error: boolean;
    body?: {
        title: string;
        userName: string;
        xRestrict: number;
        illustType: number;
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
            const maxPics = 5;

            if (infoData.error || !infoData.body) {
                console.log(`[PixivAPI] Post borrado o inaccesible. ID: ${illustId}`);
                return null;
            }

            const isNsfwContent = infoData.body.xRestrict > 0;
            const typePic = infoData.body.illustType
            const pagesRes = await fetch(`https://www.pixiv.net/ajax/illust/${illustId}/pages`, { headers: this.headers });
            const pagesData = await pagesRes.json() as PixivPagesResponse;
            if (pagesData.error || !pagesData.body || pagesData.body.length === 0) {
                console.log(`[PixivAPI] Error al obtener páginas para ID: ${illustId}`);
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
            return {
                title: infoData.body.title || 'Pixiv Art',
                author: infoData.body.userName || 'Autor Desconocido',
                url: `https://www.pixiv.net/en/artworks/${illustId}`,
                buffers: imageBuffers,
                sizePag: pagesData.body.length,
                isNSFW: isNsfwContent,
                fPic: typePic
            };

        } catch (error) {
            console.error(`[PixivAPI] Error interno al obtener ilustracion ${illustId}:`, error);
            return null;
        }
    }
}