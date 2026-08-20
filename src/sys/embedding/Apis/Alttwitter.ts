// src/sys/embedding/Apis/PixivAPI.ts
import { Message, AttachmentBuilder, TextChannel, EmbedBuilder } from "discord.js";
import { ApiHandler, pResult } from "../embedingSwitch"
import { debug, error } from "../../logging";
import { translate } from '@vitalets/google-translate-api';

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
        const matchLang = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/.*\/([a-z]+)/i);
        const lang = matchLang ? matchLang[1].toLowerCase() : undefined;
        if (lang && !["es", "en", "pt", "it"].includes(lang)) return { ok: false };

        if (!message) return { ok: false };
        if (!message.channel || !message.channel.isTextBased()) return { ok: false };

        const tx = message.channel as TextChannel;
        await tx.sendTyping();

        const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/i);
        if (!match) return { ok: false };
        const xId = match[1];

        const xData = await xTwitter.getTweetData(xId, lang);
        if (!xData) return { ok: false };
        if (xData.bufferPics.length === 0 && !xData.hasVideo && xData.tweetDesc) return { ok: false };
        try {
            let files: AttachmentBuilder[] = [], embeds: EmbedBuilder[] = [], packTxt: string | undefined = undefined;
            const statTxt = `❤️: **${xData.likes}** | 🔁: **${xData.reTwi}** | 💬: **${xData.resp}** | 👀: **${xData.views}**`
            if (xData.hasVideo) { // Formato plano
                let outText: string | undefined = undefined
                outText = `> ### 👤 ${xData.userName} (@${xData.showName})`
                if (xData.tweetTl && xData.tweetTl.length > 0) outText += xData.tweetTl
                if (xData.tweetDesc && xData.tweetDesc.length > 0) outText += `\n${xData.tweetDesc}`
                outText += `\n> ${statTxt}`
                outText += `${xData.rawUrl.join(" ")}`;
                outText += `\n> ***X | Twitter • by Meltryllis Api***`;
                // addItems
                packTxt = outText;
                xData.bufferVideo.forEach((buffer, index) => {
                    const fileName = `Xvideo_${xId}_${index}.mp4`;
                    files.push(new AttachmentBuilder(buffer, { name: fileName }));
                });
                xData.bufferGifs.forEach((buffer, index) => {
                    const fileName = `Xgif_${xId}_${index}.webp`;
                    files.push(new AttachmentBuilder(buffer, { name: fileName }));
                });
                xData.bufferPics.forEach((buffer, index) => {
                    const fileName = `Ximg_${xId}_${index}.jpg`;
                    files.push(new AttachmentBuilder(buffer, { name: fileName }));
                });
            }
            if (!xData.hasVideo) { // Formato embed
                xData.bufferPics.forEach((buffer, index) => {
                    const fileName = `Ximg_${xId}_${index}.jpg`;
                    const embed = new EmbedBuilder()
                        .setURL(xData.urlPost)
                        .setImage(`attachment://${fileName}`);
                    let desct: string | undefined = undefined;
                    if (index === 0) {
                        if (xData.tweetTl && xData.tweetTl.length > 0) desct = xData.tweetTl;
                        if (xData.tweetDesc && xData.tweetDesc.length > 0) desct ? desct += xData.tweetDesc : desct = xData.tweetDesc;
                        desct ? desct += `\n\n${statTxt}` : desct = statTxt;
                        embed.setAuthor({ name: `${xData.userName} (@${xData.showName})`, url: xData.urlPost, iconURL: xData.avatarPic })
                            .setColor('#1DA1F2')
                            .setDescription(desct)
                            .setFooter({ text: `X | Twitter • by Meltryllis Api`, iconURL: 'https://abs.twimg.com/favicons/twitter.ico' });
                    }
                    // addItems
                    files.push(new AttachmentBuilder(buffer, { name: fileName }));
                    embeds.push(embed);
                });
            }
            return { ok: true, pack: [{ [xId]: { content: packTxt, embeds: embeds, files: files } }] };
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
    tweetTl?: string,
    avatarPic: string,
    resp: string,
    reTwi: string,
    views: string,
    hasVideo: boolean,
    rawUrl: string[],
    bufferPics: Buffer[],
    bufferVideo: Buffer[],
    bufferGifs: Buffer[]
}

interface ApiFxVido {
    url: string
    type: string
    formats?: Array<{ url: string, bit_rate?: number, bitrate?: number, container: string, duration?: number }>
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
            videos?: ApiFxVido[];
        };
    };
}

interface tlInt { noLinks: boolean, txt?: string, lang?: string }

class xTwitter {
    private static get headers() {
        return {
            method: 'GET'
        };
    }

    public static async getTweetData(idX: string, tlLang?: string): Promise<twitterData | null> {
        try {
            const call = await fetch(`https://api.fxtwitter.com/2/status/${idX}`, { headers: this.headers });
            const Data = await call.json() as ApiFxResponse;
            if (!Data || Data.code !== 200) return null;
            let imageBuffers: Buffer[] = [], videoBuffers: Buffer[] = [], gifBuffers: Buffer[] = [], rawLinks: string[] = [], wVideo = false;

            const picURLs = Data.status?.media?.photos?.map(p => p.url);
            const videoURLs = Data.status?.media?.videos?.map(v => v);

            if (videoURLs && videoURLs.length > 0) wVideo = true;

            const fixDes = await this.genDes({ noLinks: wVideo, txt: Data.status?.text, lang: tlLang });
            if (tlLang && (Data.status?.text && Data.status.text.length > 0) && !fixDes.Tl) return null;

            const gets = await this.downMedias(videoURLs, picURLs);
            if (gets) {
                gifBuffers = gets.gifs;
                videoBuffers = gets.videos;
                imageBuffers = gets.imagenes;
                rawLinks = gets.links;
            }

            return {
                urlPost: Data.status?.url || "https://x.com",
                showName: Data.author?.screen_name || "Usuario desconocido",
                userName: Data.author?.name || "Usuario desconocido",
                likes: this.numShort(Data.status?.likes),
                reTwi: this.numShort(Data.status?.reposts),
                resp: this.numShort(Data.status?.replies),
                views: this.numShort(Data.status?.views),
                tweetDesc: fixDes.Org,
                tweetTl: fixDes.Tl,
                avatarPic: Data.author?.avatar_url || 'https://abs.twimg.com/favicons/twitter.ico',
                hasVideo: wVideo,
                rawUrl: rawLinks,
                bufferPics: imageBuffers,
                bufferVideo: videoBuffers,
                bufferGifs: gifBuffers
            };

        } catch (e) {
            error(`[xTwitter] Error interno al obtener twitter ${idX}:${e}`);
            return null;
        }
    }

    private static numShort(total?: number): string {
        if (total === undefined) return "?";
        if (total >= 1_000) return `${(total / 1_000).toFixed(1)}K`;
        if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(1)}M`;
        if (total >= 1_000_000_000) return `${(total / 1_000_000_000).toFixed(1)}B`;
        return total.toString();
    }

    private static async downMedias(vid?: ApiFxVido[], pic?: string[]): Promise<{ links: string[]; imagenes: Buffer[]; gifs: Buffer[]; videos: Buffer[]; } | null> {
        if (!vid && !pic) return null

        let downData = { links: [] as string[], imagenes: [] as Buffer[], gifs: [] as Buffer[], videos: [] as Buffer[] }
        const downMedia = async (downUrl: string) => {
            try {
                const limiteBytes = 9_961_472; // ~9.5 MB
                const controller = new AbortController();
                const res = await fetch(downUrl, { headers: this.headers, signal: controller.signal });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const contentLength = res.headers.get('content-length');
                if (contentLength && parseInt(contentLength, 10) > limiteBytes) { controller.abort(); return null; }

                const chunks: Uint8Array[] = [];
                let downloadedBytes = 0, exceeded = false;
                if (res.body) {
                    try {
                        for await (const chunk of res.body as any) {
                            downloadedBytes += chunk.length;
                            if (downloadedBytes > limiteBytes) { exceeded = true; controller.abort(); break; }
                            chunks.push(chunk);
                        }
                    } catch (err: any) { if (err.name !== 'AbortError') throw err; }
                }
                if (exceeded) return null;
                return Buffer.concat(chunks);
            } catch (e) { error(`Erro en el procesa de descarga: ${e}`); return null }
        }

        if (vid) {
            for (const inf of vid) {
                let downUrl = inf.url;

                if (inf.type !== "gif" && inf.formats && inf.formats.length > 0) {
                    const mp4Formats = inf.formats.filter(fm => fm.container && fm.container.toLowerCase() === "mp4");
                    if (mp4Formats.length > 2) {
                        const sorted = mp4Formats.sort((a, b) => {
                            const bitA = a.bitrate || a.bit_rate || 0;
                            const bitB = b.bitrate || b.bit_rate || 0;
                            return bitA - bitB;
                        });
                        const numBit = (mp4Formats.length - 2), x = (numBit <= 0) ? 1 : numBit;
                        downUrl = sorted[x].url;
                    }

                    const downVideo = await downMedia(downUrl)
                    if (!downVideo) { downData.links.push(`[.](${inf.url})`) }
                    else { downData.videos.push(downVideo) }
                }

                if (inf.type === 'gif') {
                    const trg = inf.url.match(/(?:video\.twimg\.com)\/tweet_video\/(\w+)/i);
                    const match = trg ? trg[1] : null;
                    if (match) {
                        let chk: Response | null = null;
                        try { chk = await fetch(`https://gif.fxtwitter.com/tweet_video/${match}.webp`, { headers: { method: 'HEAD' } }); }
                        catch (e) { error(`ERROR EN FETCH REVISAR POR BLOQUEO DE HEAD!!: ${e}`); }
                        downUrl = (chk && chk.ok) ? chk.url : inf.url;
                    }
                    const downGif = await downMedia(downUrl)
                    if (!downGif) { downData.links.push(`[.](${downUrl})`); }
                    else { downData.gifs.push(downGif); }
                }
            }
        }

        if (pic) {
            for (const url of pic) {
                const downUrl = url.replace(/([?&])name=orig/, '$1name=large')
                const downPic = await downMedia(downUrl)
                if (!downPic) { downData.links.push(`[.](${url})`); }
                else { downData.imagenes.push(downPic); }
            }
        }
        return downData;
    }

    private static async genDes(dta: tlInt): Promise<{ Org?: string, Tl?: string }> {
        if (dta.txt === undefined) return {};

        const urlRegex = /(?:\()?\[?(https?:\/\/[^\s\)]+)\)?/g;
        let txtOut = dta.txt, tooLong = false;
        if (txtOut.length > 800) { txtOut = txtOut.slice(0, 800); tooLong = true }

        if (!dta.lang) {
            if (dta.noLinks) {
                txtOut = txtOut.replace(urlRegex, '`$&`');
                txtOut = tooLong ? txtOut + '\n...' : txtOut;
                return { Org: txtOut };
            } else {
                txtOut = tooLong ? txtOut + '\n...' : txtOut;
                return { Org: txtOut };
            }
        }

        else {
            let txt4Tl: string, cut = false, outTl: string | undefined = undefined;
            if (txtOut.length > 700) return { Org: txtOut, Tl: outTl };
            const hashtags: string[] = [], links: string[] = [], users: string[] = [];

            txt4Tl = txtOut.replace(urlRegex, y => { const idx = links.push(y) - 1; return `__L${idx}__`; }); // save urls
            txt4Tl = txt4Tl.replace(/#[^\s]*/gm, x => { const idx = hashtags.push(x) - 1; return `__H${idx}__`; }); // save hashtags
            txt4Tl = txt4Tl.replace(/@[^\s]*/gm, x => { const idx = users.push(x) - 1; return `__U${idx}__`; }); //save users
            //txt4Tl = txt4Tl.replace(/\r\n/g, '\n').replace(/\n{2,}/g, '\n').trim(); // quita doble saltos
            //txt4Tl = txt4Tl.replace(/\s{2,}/g, ' ').trim(); // removedor de doble espacios

            const langName: Record<string, string> = { "en": "Inglés", "es": "Español", "pt": "Portugués", "it": "Italiano" };
            const nLang = langName[dta.lang];

            if (txt4Tl.length > 600) { txt4Tl = txt4Tl.slice(0, 600); cut = true; }

            const fromApi = await this.googleTranslate(txt4Tl, dta.lang)
            if (!fromApi) return { Org: txtOut, Tl: outTl };
            else outTl = fromApi;

            if (dta.noLinks) txtOut = txtOut.replace(urlRegex, '`$&`');
            if (hashtags.length > 0) { outTl = outTl.replace(/__H(\d+)__/g, (_, index) => hashtags[parseInt(index)]); }
            if (links.length > 0) { outTl = outTl.replace(/__L(\d+)__/g, (_, index) => dta.noLinks ? `\`${links[parseInt(index)]}\`` : links[parseInt(index)]); }
            if (users.length > 0) { outTl = outTl.replace(/__U(\d+)__/g, (_, index) => users[parseInt(index)]); }

            outTl = (`\n## 📄 Traducido al ${nLang}:\n` + outTl + (cut ? '...' : "") + `\n## 📃 Texto original:\n`);
            return { Org: txtOut, Tl: outTl };
        }
    }

    private static async googleTranslate(text: string, lang: string) {
        try {
            const { text: out } = await translate(text, { to: lang });
            return out;
        } catch (err) { return undefined; }
    }

    /*
    private static async libreTraslate(txt: string, lng: string): Promise<{ ApiTL?: string; ApiClave?: string; }> {
        interface out { translatedText?: string, detectedLanguage?: { language?: string } }
        const get = await fetch(`http://${IpTL}/translate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ q: txt, source: "auto", target: lng, format: "text" })
        });
        if (!get.ok) return {};
        const data = await get.json() as out;
        if (!data.translatedText) return {};
        return { ApiTL: data.translatedText, ApiClave: data.detectedLanguage?.language };
    }
    */
}




