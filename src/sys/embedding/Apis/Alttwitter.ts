// src/sys/embedding/Apis/PixivAPI.ts
import { AttachmentBuilder, GuildTextBasedChannel, MediaGalleryBuilder, MediaGalleryItemBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } from "discord.js";
import { ApiHandler, pMSGin, pResult } from "../embedingSwitch"
import { debug, error } from "../../logging";
import { translate } from '@vitalets/google-translate-api';
import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';
import ffmpegStatic from 'ffmpeg-static';
import axios from "axios";
import { Proxy } from "../../zGears/newAux";
import emojis from '../../../../adds/otros/emojis.json'

// ================================= APi: xTwitter Meltrys ================================= //

export class xTwitterCustom implements ApiHandler {
    name = "xTwitterMeltrys";

    isAvailable(): boolean { return true; }
    isDomain(domain: string): boolean { return /(^|:\/\/|\.)(x|twitter)\.com/.test(domain); }
    async guildChk(domain: string, guildConfigs: Map<string, any>): Promise<boolean> {
        if (!domain) return false;
        const aDom = "Meltrys.xTwitter", albe = guildConfigs.get(aDom);
        if (!albe || (albe && albe.enabled === false)) return false;
        return true;
    }

    public async process(pMsg: pMSGin): Promise<pResult> {
        let ch: GuildTextBasedChannel | undefined = undefined;
        if (pMsg.message && !pMsg.message.channel.isDMBased()) {
            ch = pMsg.message.channel;
            await ch.sendTyping();
        }
        // url para
        const matchLang = pMsg.url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/\d+.*?\/([a-z]+)(?:\/|$)/i);
        const lang = matchLang ? matchLang[1].toLowerCase() : undefined;
        let iLang: string | undefined = undefined;
        if (lang && ["es", "en", "pt", "it", "ja", "ru"].includes(lang)) iLang = lang;
        let wQuote = true;
        if (pMsg.url.endsWith("/q") || pMsg.url.endsWith("/Q")) wQuote = false;
        // chk
        const match = pMsg.url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/i);
        if (!match) return { ok: false };
        const xId = match[1];
        // get dta
        const xData = await xTwitter.getTweetData(xId, iLang);
        if (!xData) return { ok: false };
        if (!xData.hasMedias && !xData.tweetDesc) return { ok: false };
        try {
            let files: AttachmentBuilder[] = [], filesQuo: AttachmentBuilder[] = [], components: any[] = [];
            // Formato plano
            const TopTxt = `> ### ${emojis.int.user} ${xData.userName.length > 28 ? xData.userName.slice(0, 25) + `...` : xData.userName} ([@${xData.showName}](${xData.urlPost})) \n${xData.stats}`
            const BottomTxt = `${emojis.logos.twitter} ***X|Twitter • by Meltryllis Api *** `;

            let tweDes = "";
            let tweTl = "";
            if (xData.tweetDesc) {
                tweDes = xData.tweetDesc;
                if (!xData.tweetTl && tweDes.length > 2000) tweDes = tweDes.slice(0, 2000) + "...";
                if (xData.tweetTl && tweDes.length > 400) tweDes = tweDes.slice(0, 387) + "...";
            }

            if (xData.tweetTl && xData.tweetTl.oTxT) {
                tweTl = xData.tweetTl.oTxT.length > 2000 ? xData.tweetTl.oTxT.slice(0, 2000) + "..." : xData.tweetTl.oTxT;
            }

            const textBlocks: string[] = [];
            if (tweTl.length > 0 && xData.tweetTl) {
                textBlocks.push(`### 📄 Traducido al ${xData.tweetTl.oLng}:\n${tweTl}`);
            }
            if (tweDes.length > 0) {
                if (tweTl.length > 0) { textBlocks.push(`### 📃 Texto original:\n> ${tweDes}`); }
                else { textBlocks.push(tweDes); }
            }

            const outText = textBlocks.length > 0 ? textBlocks.join("\n\n") : undefined;

            // originalMedia
            const gallegry = new MediaGalleryBuilder(), gallegryExt = new MediaGalleryBuilder();
            const GalBuildMas = xData.kchMedia.dtaMedia;
            if (GalBuildMas.length > 0) {
                const fPart = GalBuildMas.slice(0, 10);
                for (const XRa of fPart) {
                    if (XRa.file) {
                        gallegry.addItems(new MediaGalleryItemBuilder().setURL(`attachment://${XRa.file.name}`));
                        filesQuo.push(XRa.file)
                    }
                    else { gallegry.addItems(new MediaGalleryItemBuilder().setURL(XRa.url)) }
                }
                // add 2da prt
                if (GalBuildMas.length > 10) {
                    const sPart = GalBuildMas.slice(10, 20);
                    for (const XRb of sPart) {
                        if (XRb.file) {
                            gallegryExt.addItems(new MediaGalleryItemBuilder().setURL(`attachment://${XRb.file.name}`));
                            filesQuo.push(XRb.file)
                        } else { gallegryExt.addItems(new MediaGalleryItemBuilder().setURL(XRb.url)) }
                    }
                }
            }
            // === QuoMedia == //
            const gallegryQuo = new MediaGalleryBuilder(), gallegryQuoExt = new MediaGalleryBuilder();
            const GalBuildQuo = xData.tQuote.kchMedia.dtaMedia;
            if (GalBuildQuo.length > 0) {
                const fPart = GalBuildQuo.slice(0, 10);
                for (const XTa of fPart) {
                    if (XTa.file) {
                        gallegryQuo.addItems(new MediaGalleryItemBuilder().setURL(`attachment://${XTa.file.name}`));
                        filesQuo.push(XTa.file)
                    }
                    else { gallegryQuo.addItems(new MediaGalleryItemBuilder().setURL(XTa.url)) }
                }
                // add 2da prt
                if (GalBuildQuo.length > 10) {
                    const sPart = GalBuildQuo.slice(10, 20);
                    for (const XTb of sPart) {
                        if (XTb.file) {
                            gallegryQuoExt.addItems(new MediaGalleryItemBuilder().setURL(`attachment://${XTb.file.name}`));
                            filesQuo.push(XTb.file)
                        } else { gallegryQuoExt.addItems(new MediaGalleryItemBuilder().setURL(XTb.url)) }
                    }
                }
            }
            // ensambler
            const parte = new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
            const spoiler = pMsg.isSpoiler === true;
            const container = new ContainerBuilder();
            if (pMsg.intCall) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`> ## Nuevo Post de @${xData.showName}`)).addSeparatorComponents(parte)
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(TopTxt + (xData.kchMedia.overFile ? `\n> En galerías con más de 5 videos puede mostrarse mal o no cargar!!` : ""))).addSeparatorComponents(parte);
            if (outText) { container.addTextDisplayComponents(new TextDisplayBuilder().setContent(outText)) };
            if (gallegry.items.length > 0) container.addMediaGalleryComponents(gallegry);
            if (gallegryExt.items.length > 0) container.addSeparatorComponents(parte).addMediaGalleryComponents(gallegryExt);
            // txtQue
            if (wQuote) {
                let outTxtQuote: string | undefined = undefined;
                if (xData.tQuote && (xData.tQuote.author || xData.tQuote.url || xData.tQuote.txt)) {
                    const quoUser = xData.tQuote.name ? (xData.tQuote.name.length > 28 ? xData.tQuote.name.slice(0, 25) + `...` : xData.tQuote.name) : "Usuario desconocido!!";
                    const quoUrl = (xData.tQuote.url && xData.tQuote.author) ? `([@${xData.tQuote.author}](${xData.tQuote.url}))` : `URL no encontrada!`
                    const citTxt = xData.tQuote?.txt ?? "...";
                    outTxtQuote = `**Citado:** \n ${`> ** ${emojis.int.user} ${quoUser} ${quoUrl}** \n ${xData.tQuote.stats}`} \n\n ${(outText && outText.length > 2000) ? citTxt.slice(0, 1000) + "..." : citTxt}`;
                }
                if (outTxtQuote) { container.addSeparatorComponents(parte).addTextDisplayComponents(new TextDisplayBuilder().setContent(outTxtQuote)); }
                if (gallegryQuo.items.length > 0) { container.addMediaGalleryComponents(gallegryQuo); }
                if (gallegryQuoExt.items.length > 0) { container.addSeparatorComponents(parte).addMediaGalleryComponents(gallegryQuoExt); }
            };
            // close
            container.addSeparatorComponents(parte).addTextDisplayComponents(new TextDisplayBuilder().setContent(BottomTxt)).setAccentColor(0x000055).setSpoiler(spoiler);

            components.push(container);
            // === filesitos === //
            let outFiles: AttachmentBuilder[] = [];
            if (files) outFiles.push(...files);
            if (wQuote && filesQuo) outFiles.push(...filesQuo);
            // out
            return { ok: true, pack: [{ [xId]: { files: outFiles, components: components, isV2: true } }] };

        } catch (e) {
            error(`[xTwitterCustom] Error al enviar:`);
            return { ok: false };
        }
    }
}

// ================================= xTwitter Process ================================= //
interface mediosDta { dtaMedia: { url: string; file?: AttachmentBuilder }[], overFile: boolean };

interface twitterData {
    urlPost: string, showName: string, userName: string, avatarPic: string, stats: string,
    hasMedias: boolean, tweetDesc?: string, tweetTl?: { oTxT: string, oLng: string },
    kchMedia: mediosDta,
    tQuote: {
        txt?: string, author?: string, url?: string, name?: string,
        kchMedia: mediosDta,
        stats: string
    }
};

interface allMedia {
    id: number,
    url: string,
    type: string,
    formats?: { url: string, bit_rate?: number, bitrate?: number, container: string, duration?: number }[],
};

interface ApiFxResponse {
    code: number;
    status?: {
        url: string;
        text?: string;
        likes?: number;
        replies?: number;
        reposts?: number;
        views?: number;
        bookmarks?: number;
        media?: {
            all?: allMedia[]
        };
        translation?: {
            text?: string
        }
        // autor
        author?: {
            name: string;
            screen_name: string;
            url: string;
            description: string;
            avatar_url?: string;
        };
        // quote
        quote?: {
            url?: string;
            text?: string;
            author?: {
                screen_name?: string;
                name?: string;
            }
            likes?: number;
            replies?: number;
            reposts?: number;
            views?: number;
            bookmarks?: number;
            media?: {
                all?: allMedia[];
            }
            translation?: {
                text: string
            }
        }
    };
};

interface tlInt { txt?: string, lang?: string }

class xTwitter {

    private static get headers() { return { method: 'GET' }; }

    public static async getTweetData(idX: string, tlLang?: string): Promise<twitterData | null> {
        try {
            let callURl = tlLang ? `https://api.fxtwitter.com/2/status/${idX}?lang=${tlLang}` : `https://api.fxtwitter.com/2/status/${idX}`;
            const call = await fetch(callURl, { headers: this.headers });
            const Data = await call.json() as ApiFxResponse;
            if (!Data || Data.code !== 200) return null;
            let hasMedia = false;

            const postDta = Data.status?.media?.all?.map(v => v) || [];
            const quoDta = Data.status?.quote?.media?.all?.map(v => v) || [];

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

            const gets = await this.downMedias(postDta);
            const getsQuo = await this.downMedias(quoDta);

            if ((postDta.length + quoDta.length) > 0) hasMedia = true;

            return {
                urlPost: Data.status?.url || "https://x.com",
                showName: Data.status?.author?.screen_name || "Usuario desconocido",
                userName: Data.status?.author?.name || "Usuario desconocido",
                stats: this.numShort({ likes: Data.status?.likes, reTwi: Data.status?.reposts, resp: Data.status?.replies, views: Data.status?.views, book: Data.status?.bookmarks }),
                tweetDesc: txtOut,
                tweetTl: TlData, //fixDes.Tl ? { oTxT: tlReq, oLng: fixDes.Tl.oLng } : undefined, //fixDes.Tl.oTxt
                avatarPic: Data.status?.author?.avatar_url || 'https://abs.twimg.com/favicons/twitter.ico',
                hasMedias: hasMedia,
                kchMedia: gets,
                //quoteData
                tQuote: {
                    txt: tlLang ? ((Data.status?.quote?.translation?.text && Data.status?.quote?.translation?.text.length > 0) ? (`📄 Traducido al ${this.wereLang(tlLang)}: \n\n ${Data.status?.quote?.translation?.text}`) : Data.status?.quote?.text) : Data.status?.quote?.text,
                    author: Data.status?.quote?.author?.screen_name,
                    name: Data.status?.quote?.author?.name,
                    url: Data.status?.quote?.url,
                    kchMedia: getsQuo,
                    stats: this.numShort({ likes: Data.status?.quote?.likes, reTwi: Data.status?.quote?.reposts, resp: Data.status?.quote?.replies, views: Data.status?.quote?.views, book: Data.status?.quote?.bookmarks }),
                },
            };

        } catch (e: any) {
            if (!e.message.includes("ABORT")) error(`[xTwitter] Error interno al obtener twitter ${idX}:${e}`);
            return null;
        }
    }

    private static numShort(dta: { likes?: number, reTwi?: number, resp?: number, views?: number, book?: number }): string {
        const pipe = emojis.pipe;
        const doIt = (pNumber: number | null | undefined) => {
            if (!pNumber) return "0";
            else if (pNumber >= 1_000_000_000) return `${(pNumber / 1_000_000_000).toFixed(1)}B`;
            else if (pNumber >= 1_000_000) return `${(pNumber / 1_000_000).toFixed(1)}M`;
            else if (pNumber >= 1_000) return `${(pNumber / 1_000).toFixed(1)}K`;
            else return pNumber.toString();
        }

        return (`> ${emojis.int.like}: ${doIt(dta.likes)} ${pipe} ${emojis.int.bookmarks}: ${doIt(dta.book)} ${pipe} ${emojis.int.rtweet}: ${doIt(dta.reTwi)} ${pipe} ${emojis.int.comento}: ${doIt(dta.resp)} ${pipe} ${emojis.int.see}: ${doIt(dta.views)}`)
    }

    private static async downMedias(dta: allMedia[]): Promise<mediosDta> {
        const dtaMedia: { url: string, file?: AttachmentBuilder }[] = [];
        let overFile = false;

        if (dta.length === 0) return { dtaMedia, overFile }

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

        if (dta.filter((X) => X.type !== "photo").length > 4) { overFile = true }

        for (const inf of dta) {
            let downUrl = inf.url;

            if (inf.type === "photo") {
                const fixUrl = inf.url.replace(/([?&])name=orig/, '$1name=large')
                dtaMedia.push({ url: fixUrl })
            }

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

                if (dta.length > 4) {
                    dtaMedia.push({ url: downUrl })
                    continue;
                }

                const downVideo = await downMedia(downUrl)
                if (!downVideo) { throw new Error("ABORT") /*downData.links.push(downUrl)*/ }
                else {
                    const arch = new AttachmentBuilder(downVideo, { name: `${inf.id}.mp4` })
                    dtaMedia.push({ url: downUrl, file: arch })
                }
            }

            if (inf.type === 'gif') {
                const trg = inf.url.match(/(?:video\.twimg\.com)\/tweet_video\/([\w-]+)/i);
                const match = trg ? trg[1] : null;

                if (dta.length > 4) {
                    downUrl = match ? `https://gif.fxtwitter.com/tweet_video/${match}.webp` : inf.url;
                    dtaMedia.push({ url: downUrl })
                    continue;
                }


                let chk: Response | null = await fetch(`https://gif.fxtwitter.com/tweet_video/${match}.webp`, { method: 'HEAD' }).catch((e) => {
                    error(`ERROR EN FETCH REVISAR POR BLOQUEO DE HEAD!!: ${e}`); return null
                });
                downUrl = (chk && chk.ok) ? chk.url : inf.url;
                if (downUrl === inf.url) { // verifi el Gif
                    const downGif = await downMedia(downUrl)
                    if (downGif) {
                        if (this.isWebp(downGif)) {
                            const arch = new AttachmentBuilder(downGif, { name: `${inf.id}.webp` })
                            dtaMedia.push({ url: downUrl, file: arch })
                        }
                        else {
                            const convert = await this.turnMp4ToWebp(downGif);
                            if (convert) {
                                const arch = new AttachmentBuilder(convert, { name: `${inf.id}.webp` })
                                dtaMedia.push({ url: downUrl, file: arch })
                            }
                            else { dtaMedia.push({ url: downUrl }); }
                        }
                    } else { dtaMedia.push({ url: downUrl }) };
                } else { dtaMedia.push({ url: downUrl }) }

            }
        }

        return { dtaMedia, overFile }
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
        if (fromApi) outTl = fromApi
        else return undefined;

        if (hashtags.length > 0) { outTl = outTl.replace(/__H(\d+)__/g, (_, index) => hashtags[parseInt(index)]); }
        if (links.length > 0) { outTl = outTl.replace(/__L(\d+)__/g, (_, index) => links[parseInt(index)]); }
        if (users.length > 0) { outTl = outTl.replace(/__U(\d+)__/g, (_, index) => users[parseInt(index)]); }

        outTl = (outTl + (cut ? '...' : ""));
        return outTl;
    }

    private static wereLang(lang: string): string {
        const langName: Record<string, string> = {
            "en": "Inglés", "es": "Español", "pt": "Portugués", "it": "Italiano",
            "ja": "Japones", "ru": "Ruso", "hi": "Hindi", "ar": "Árabe",
            "zh": "Chino", "fr": "Francés", "de": "Alemán", "ko": "Coreano",
            "tr": "Turco", "nl": "Holandés", "sv": "Sueco", "fi": "Finlandés",
            "da": "Danés", "no": "Noruego", "pl": "Polaco", "cs": "Checo",
            "el": "Griego", "he": "Hebreo", "th": "Tailandés", "id": "Indonesio",
            "vi": "Vietnamita", "ms": "Malayo", "uk": "Ucraniano", "ro": "Rumano",
            "hu": "Húngaro"
        };
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
