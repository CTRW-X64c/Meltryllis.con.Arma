// src/sys/embedding/Apis/PixivAPI.ts
import { Message, AttachmentBuilder, TextChannel, EmbedBuilder } from "discord.js";
import { ApiHandler, pResult } from "../embedingSwitch"
import { debug, error } from "../../logging";

// ================================= APi: xTwitter Meltrys ================================= //
export class xTwitterCustom implements ApiHandler {
    name = "xTwitterMeltrys";

    isAvailable(): boolean { return true; }
    isDomain(domain: string): boolean { return /(^|:\/\/|\.)(x|twitter)\.com/.test(domain); }
    async guildChk(domain: string, guildId: string | null, guildConfigs: Map<string, any>): Promise<boolean> {
        if (!domain) return false;
        const aDom = "Meltrys.xTwitter", albe = guildConfigs.get(aDom);
        if (!albe || (albe && albe.enabled === false)) {
            debug(`El uso de Meltrys xTwitter no está habilitado en este gremio: ${guildId}`, "ApiReplacement");
            return false;
        }
        return true;
    }

    async process(url: string, message?: Message): Promise<pResult> {
        if (!message) return { ok: false };
        if (!message.channel || !message.channel.isTextBased()) return { ok: false };

        const tx = message.channel as TextChannel;
        await tx.sendTyping();

        const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/i);
        if (!match) return { ok: false };
        const xId = match[1];

        const xData = await xTwitter.getIllustData(xId);
        if (!xData) return { ok: false };

        if (xData.bufferPics.length === 0 || xData.videoLinks.length > 0) return { ok: false };

        try {
            const files: AttachmentBuilder[] = [];
            const embeds: EmbedBuilder[] = [];

            xData.bufferPics.forEach((buffer, index) => {
                const fileName = `Ximg_${xId}_${index}.jpg`;
                files.push(new AttachmentBuilder(buffer, { name: fileName }));
                const statTxt = `❤️: **${xData.likes}** | 🔁: **${xData.reTwi}** | 💬: **${xData.resp}** | 👀: **${xData.views}**`
                const embed = new EmbedBuilder()
                    .setURL(xData.urlPost)
                    .setImage(`attachment://${fileName}`);
                let desct: string | undefined = undefined;
                if (index === 0) {
                    if (xData.tweetDesc && xData.tweetDesc.length > 0) desct = xData.tweetDesc;
                    desct ? desct += `\n\n${statTxt}` : desct = statTxt;
                    embed.setAuthor({ name: `${xData.showName} (@${xData.userName})`, url: xData.urlPost, iconURL: xData.avatarPic })
                        .setColor('#1DA1F2')
                        .setDescription(desct)
                        .setFooter({ text: `X | Twitter • by Meltryllis Api`, iconURL: 'https://abs.twimg.com/favicons/twitter.ico' });
                }
                embeds.push(embed);
            });
            return { ok: true, pack: [{ [xId]: { embeds: embeds, files: files } }] };
        } catch (e) {
            error(`[xTwitterCustom] Error al enviar:`);
            return { ok: false };
        }
    }
}

// ================================= xTwitter Process ================================= //
interface twitterData {
    urlPost: string,
    showName: string,
    userName: string,
    likes: string,
    tweetDesc?: string,
    avatarPic: string,
    resp: string,
    reTwi: string,
    views: string,
    videoLinks: string[],
    bufferPics: Buffer[]
}

interface ApiFxResponse {
    code: number;
    author?: {
        name: string;
        screen_name: string;
        url: string;
        description: string;
        avatar_url?: string;
    };
    status?: {
        url: string;
        text?: string;
        likes?: number;
        replies?: number;
        reposts?: number;
        views?: number;
        media?: {
            photos?: Array<{ url: string; }>;
            videos?: Array<{ url: string; }>;
        };
    };
}

class xTwitter {
    private static get headers() {
        return {
            method: 'GET'
        };
    }

    public static async getIllustData(idX: string): Promise<twitterData | null> {
        try {
            const call = await fetch(`https://api.fxtwitter.com/2/status/${idX}`, { headers: this.headers });
            const Data = await call.json() as ApiFxResponse;
            if (!Data || Data.code !== 200) return null;
            if (Data.status?.media?.videos) return null; // temp Patch

            const picURLs = Data.status?.media?.photos?.map(p => p.url) || [];
            //const videoURLs = Data.status?.media?.videos?.map(v => v.url) || [];

            const fetchPromises = picURLs.map(async url => { /* Descargar de imagenes a large */
                const downUrl = url.replace(/([?&])name=orig/, '$1name=large')
                const res = await fetch(downUrl, { headers: this.headers });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const buffer = await res.arrayBuffer();
                return Buffer.from(buffer);
            });

            //const videoLinks = videoURLs.map(url => `[Video](${url})`);
            const imageBuffers = await Promise.all(fetchPromises);
            const cutDesc = (txt?: string): string | undefined => {
                let txtOut: string | undefined = undefined
                if (txt) txtOut = txt;
                if (txt && txt.length > 280) txtOut = txt.slice(0, 275) + "...";
                /*if (txtOut && lang) {
                    let tempTxt = txtOut
                }*/
                return txtOut;
            }

            const numShort = (total?: number): string => {
                if (total === undefined) return "?";
                if (total >= 1_000) return `${(total / 1_000).toFixed(1)}K`;
                if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(1)}M`;
                if (total >= 1_000_000_000) return `${(total / 1_000_000_000).toFixed(1)}B`;
                return total.toString();
            }

            return {
                urlPost: Data.status?.url || "https://x.com",
                showName: Data.author?.screen_name || "Usuario desconocido",
                userName: Data.author?.name || "Usuario desconocido",
                likes: numShort(Data.status?.likes),
                reTwi: numShort(Data.status?.reposts),
                resp: numShort(Data.status?.replies),
                views: numShort(Data.status?.views),
                tweetDesc: cutDesc(Data.status?.text),
                avatarPic: Data.author?.avatar_url || 'https://abs.twimg.com/favicons/twitter.ico',
                videoLinks: [],
                bufferPics: imageBuffers
            };

        } catch (e) {
            error(`[xTwitter] Error interno al obtener twitter ${idX}:${e}`);
            return null;
        }
    }
}
