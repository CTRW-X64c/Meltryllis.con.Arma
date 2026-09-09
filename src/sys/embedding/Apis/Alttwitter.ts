// src/sys/embedding/Apis/PixivAPI.ts
import { Message, AttachmentBuilder, TextChannel, EmbedBuilder } from "discord.js";
import { ApiHandler, pResult } from "../embedingSwitch"
import { debug, error } from "../../logging";
import { translate } from '@vitalets/google-translate-api';
import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';
import ffmpegStatic from 'ffmpeg-static';
import axios from "axios";
import { Proxy } from "../../zGears/newAux";

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

    async process(url: string, message?: Message, isSpoiler?: boolean): Promise<pResult> {
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

            if (xData.hasVideo || isSpoiler) { // Formato plano
                let outText: string | undefined = undefined, tweDes: string | undefined = undefined, tweTl: string | undefined = undefined
                const urlRegex = /(?:\()?\[?(https?:\/\/[^\s\)]+)\)?/g;
                if (xData.tweetDesc) {
                    tweDes = xData.tweetDesc.replace(urlRegex, '`$&`');
                    if (!xData.tweetTl && xData.tweetDesc.length > 1100) tweDes = (xData.tweetDesc.slice(0, 1010).replace(urlRegex, '`$&`') + "...");
                    if (xData.tweetTl && xData.tweetTl.oTxT.length > 350) tweDes = xData.tweetDesc.slice(0, 350).replace(urlRegex, '`$&`') + "...";
                }
                if (xData.tweetTl) tweTl = xData.tweetTl.oTxT.length > 1050 ? (xData.tweetTl.oTxT.slice(0, 1010).replace(urlRegex, '`$&`') + "...") : xData.tweetTl.oTxT.replace(urlRegex, '`$&`');
                outText = `> ### 👤 ${xData.userName} (@${xData.showName})`
                outText += `\n> ${statTxt}` + `\n> ***X | Twitter • by Meltryllis Api***`;
                if (xData.rawUrl.length > 0) outText += xData.rawUrl.join(" ");
                if (xData.tweetTl && xData.tweetTl.oTxT.length > 0) outText += `\n### 📄 Traducido al ${xData.tweetTl.oLng}:\n` + tweTl;
                if (xData.tweetDesc && xData.tweetDesc.length > 0) outText += (xData.tweetTl ? `\n### 📃 Texto original:\n` : "\n") + tweDes;
                // addItems
                packTxt = outText;
                xData.bufferVideo.forEach((buffer, index) => {
                    const fileName = isSpoiler ? `SPOILER_Xvideo_${xId}_${index}.mp4` : `Xvideo_${xId}_${index}.mp4`;
                    files.push(new AttachmentBuilder(buffer, { name: fileName }));
                });
                xData.bufferGifs.forEach((buffer, index) => {
                    const fileName = isSpoiler ? `SPOILER_Xgif_${xId}_${index}.webp` : `Xgif_${xId}_${index}.webp`;
                    files.push(new AttachmentBuilder(buffer, { name: fileName }));
                });
                xData.bufferPics.forEach((buffer, index) => {
                    const fileName = isSpoiler ? `SPOILER_Ximg_${xId}_${index}.jpg` : `Ximg_${xId}_${index}.jpg`;
                    files.push(new AttachmentBuilder(buffer, { name: fileName }));
                });
            }

            else { // Formato embed
                const fields: { name: string, value: string, inline?: boolean }[] = [];
                xData.bufferPics.forEach((buffer, index) => {
                    const fileName = `Ximg_${xId}_${index}.jpg`;
                    const embed = new EmbedBuilder()
                        .setURL(xData.urlPost)
                        .setImage(`attachment://${fileName}`);
                    let desct = statTxt;
                    if (xData.rawUrl.length > 0) { desct += xData.rawUrl.join(" ") }
                    if (index === 0) {
                        embed.setAuthor({ name: `${xData.userName} (@${xData.showName})`, url: xData.urlPost, iconURL: xData.avatarPic })
                            .setColor('#1DA1F2')
                            .setDescription(desct)
                            .setFooter({ text: `X | Twitter • by Meltryllis Api`, iconURL: 'https://abs.twimg.com/favicons/twitter.ico' });
                        if (xData.tweetTl && xData.tweetDesc) {
                            fields.push(
                                { name: `📄 Traducido al ${xData.tweetTl.oLng}:`, value: (xData.tweetTl.oTxT.length > 1010 ? xData.tweetTl.oTxT.slice(0, 1010) + "..." : xData.tweetTl.oTxT), inline: false },
                                { name: "📃 Texto original:", value: (xData.tweetDesc.length > 1010 ? xData.tweetDesc.slice(0, 1010) + "..." : xData.tweetDesc), inline: false },
                            )
                        } else if (!xData.tweetTl && xData.tweetDesc) {
                            fields.push({ name: "Tweet:", value: (xData.tweetDesc.length > 1020 ? xData.tweetDesc.slice(0, 1010) + "..." : xData.tweetDesc), inline: false });
                        }
                        if (fields.length > 0) { embed.addFields(fields) }
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
    urlPost: string, showName: string, userName: string,
    likes: string, resp: string, reTwi: string, views: string, avatarPic: string,
    hasVideo: boolean, tweetDesc?: string, tweetTl?: { oTxT: string, oLng: string },
    rawUrl: string[], bufferPics: Buffer[], bufferVideo: Buffer[], bufferGifs: Buffer[]
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
        translation?: {
            text?: string
        }
    };
}

interface tlInt { txt?: string, lang?: string }

class xTwitter {

    private static get headers() { return { method: 'GET' }; }

    public static async getTweetData(idX: string, tlLang?: string): Promise<twitterData | null> {
        try {
            let callURl = tlLang ? `https://api.fxtwitter.com/2/status/${idX}?lang=${tlLang}` : `https://api.fxtwitter.com/2/status/${idX}`;
            const call = await fetch(callURl, { headers: this.headers });
            const Data = await call.json() as ApiFxResponse;
            if (!Data || Data.code !== 200) return null;
            let imageBuffers: Buffer[] = [], videoBuffers: Buffer[] = [], gifBuffers: Buffer[] = [], rawLinks: string[] = [], wVideo = false;

            const picURLs = Data.status?.media?.photos?.map(p => p.url);
            const videoURLs = Data.status?.media?.videos?.map(v => v);

            if (videoURLs && videoURLs.length > 0) wVideo = true;

            let txtOut: string | undefined = undefined, txtTlOut: string | undefined = undefined;
            let TlData: { oTxT: string, oLng: string } | undefined = undefined;
            if (Data.status && Data.status.text) {
                txtOut = Data.status.text.length > 1050 ? Data.status.text.slice(0, 1050) : Data.status.text
                if (tlLang) {
                    const apiTLgoogle = await this.getTra({ txt: txtOut, lang: tlLang });
                    if (apiTLgoogle) txtTlOut = apiTLgoogle
                    else {
                        const TlText = Data.status.translation?.text;
                        if (TlText) txtTlOut = TlText;
                    }
                    if (!txtTlOut) return null;
                    else { TlData = { oTxT: txtTlOut, oLng: this.wereLang(tlLang) } }
                }
            }

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
                tweetDesc: txtOut,
                tweetTl: TlData, //fixDes.Tl ? { oTxT: tlReq, oLng: fixDes.Tl.oLng } : undefined, //fixDes.Tl.oTxt
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
        if (total >= 1_000_000_000) return `${(total / 1_000_000_000).toFixed(1)}B`;
        if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(1)}M`;
        if (total >= 1_000) return `${(total / 1_000).toFixed(1)}K`;
        return total.toString();
    }

    private static async downMedias(vid?: ApiFxVido[], pic?: string[]): Promise<{ links: string[]; imagenes: Buffer[]; gifs: Buffer[]; videos: Buffer[]; } | null> {
        if (!vid && !pic) return null

        let downData = { links: [] as string[], imagenes: [] as Buffer[], gifs: [] as Buffer[], videos: [] as Buffer[] }
        const downMedia = async (downUrl: string) => {
            try {
                const limiteBytes = 9_961_472; // ~9.5 MB
                const controller = new AbortController();
                const res = await axios.get(downUrl, {
                    headers: this.headers,
                    signal: controller.signal,
                    httpAgent: Proxy,
                    httpsAgent: Proxy,
                    responseType: 'stream'
                });
                if (res.status !== 200) throw new Error(`HTTP ${res.status}`);

                const headerContentLength = res.headers['content-length'];
                const contentLength = typeof headerContentLength === 'string' ? headerContentLength : Array.isArray(headerContentLength) ? headerContentLength[0] : undefined;
                if (contentLength && parseInt(contentLength, 10) > limiteBytes) { controller.abort(); return null; }

                const chunks: Buffer[] = [];
                let downloadedBytes = 0, exceeded = false;
                if (res.data) {
                    try {
                        for await (const chunk of res.data) {
                            const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                            downloadedBytes += bufferChunk.length;
                            if (downloadedBytes > limiteBytes) { exceeded = true; controller.abort(); break; }
                            chunks.push(bufferChunk);
                        }
                    } catch (err: any) { if (err.name !== 'AbortError') throw err; }
                }
                if (exceeded) return null;
                return Buffer.concat(chunks);
            } catch (e: any) { error(`Erro en el procesa de descarga: ${e} | Causa: ${e.cause}`); return null }
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
                        try { chk = await fetch(`https://gif.fxtwitter.com/tweet_video/${match}.webp`, { method: 'HEAD' }); }
                        catch (e) { error(`ERROR EN FETCH REVISAR POR BLOQUEO DE HEAD!!: ${e}`); }
                        downUrl = (chk && chk.ok) ? chk.url : inf.url;
                    }
                    const downGif = await downMedia(downUrl)
                    if (downGif) {
                        if (this.isWebp(downGif)) { downData.gifs.push(downGif); }
                        else {
                            const convert = await this.turnMp4ToWebp(downGif);
                            if (convert) { downData.gifs.push(convert); }
                            else { downData.links.push(`[.](${downUrl})`); }
                        }
                    } else { downData.links.push(`[.](${downUrl})`); }
                }
            }
        }

        if (pic) {
            for (const url of pic) {
                const downUrl = url.replace(/([?&])name=orig/, '$1name=large')
                const liks = [url, downUrl]
                let foDown = false
                for (const dliks of liks) {
                    const downPic = await downMedia(dliks)
                    if (downPic) { downData.imagenes.push(downPic); foDown = true; break; }
                }
                if (!foDown) { downData.links.push(`[.](${url})`); }
            }
        }
        return downData;
    }

    private static async getTra(dta: tlInt): Promise<string | undefined> {
        if (dta.txt === undefined) return undefined

        let txt4Tl: string, cut = false, outTl: string | undefined = undefined;
        const hashtags: string[] = [], links: string[] = [], users: string[] = [];
        txt4Tl = dta.txt.replace(/(?:\()?\[?(https?:\/\/[^\s\)]+)\)?/g, y => { const idx = links.push(y) - 1; return `__L${idx}__`; }); // save urls
        txt4Tl = txt4Tl.replace(/#[^\s]*/gm, x => { const idx = hashtags.push(x) - 1; return `__H${idx}__`; }); // save hashtags
        txt4Tl = txt4Tl.replace(/@[^\s]*/gm, x => { const idx = users.push(x) - 1; return `__U${idx}__`; }); //save users
        if (txt4Tl.length > 1000) { txt4Tl = txt4Tl.slice(0, 1000); cut = true; }

        const googleTranslate = async () => {
            try {
                const { text: out } = await translate(txt4Tl, { to: dta.lang });
                return out;
            } catch (err) { return undefined; }
        }

        const fromApi = await googleTranslate();
        if (!fromApi) return undefined;
        else outTl = fromApi;

        if (hashtags.length > 0) { outTl = outTl.replace(/__H(\d+)__/g, (_, index) => hashtags[parseInt(index)]); }
        if (links.length > 0) { outTl = outTl.replace(/__L(\d+)__/g, (_, index) => links[parseInt(index)]); }
        if (users.length > 0) { outTl = outTl.replace(/__U(\d+)__/g, (_, index) => users[parseInt(index)]); }

        outTl = (outTl + (cut ? '...' : ""));
        return outTl;
    }

    private static wereLang(lang: string) {
        const langName: Record<string, string> = { "en": "Inglés", "es": "Español", "pt": "Portugués", "it": "Italiano" };
        const nLang = langName[lang];
        if (!nLang) return lang;
        return nLang;
    }

    private static isWebp(buffer: Buffer): boolean {
        if (!buffer || buffer.length < 12) return false;
        const riff = buffer.toString('ascii', 0, 4);
        const webp = buffer.toString('ascii', 8, 12);
        return riff === 'RIFF' && webp === 'WEBP';
    }

    private static turnMp4ToWebp(mp4Buffer: Buffer): Promise<Buffer | null> {
        if (ffmpegStatic) { ffmpeg.setFfmpegPath(ffmpegStatic); }
        debug("[SYTEM CONVERT]: Se incio una conversion a webp")
        return new Promise((resolve) => {
            const inputStream = new PassThrough();
            inputStream.end(mp4Buffer);

            const outputStream = new PassThrough();
            const chunks: Buffer[] = [];

            outputStream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            outputStream.on('end', () => resolve(Buffer.concat(chunks)));

            ffmpeg(inputStream)
                .outputOptions([
                    '-loop 0',
                    '-qscale:v 75',
                    '-r 12',
                    //'-vf scale=480:-1',

                ])
                .format('webp')
                .on('error', (err) => {
                    console.error(`Error procesando video con FFmpeg: ${err.message}`);
                    resolve(null);
                })
                .pipe(outputStream, { end: true });
        });
    }
}

//txt4Tl = txt4Tl.replace(/\r\n/g, '\n').replace(/\n{2,}/g, '\n').trim(); // quita doble saltos
//txt4Tl = txt4Tl.replace(/\s{2,}/g, ' ').trim(); // removedor de doble espacios
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
