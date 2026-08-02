// src/sys/embedding/Apis/PixivAPI.ts
import { Message, AttachmentBuilder, TextChannel, EmbedBuilder } from "discord.js";
import { deleteMSG, embeRemove } from "../embedService";
import { ApiHandler } from "../embedingSwitch"
import { debug } from "../../logging";

// ================================= APi: xTwitter Meltrys ================================= //
export class xTwitterCustom implements ApiHandler {
    name = "xTwitterMeltrys";

    isAvailable(): boolean { return true; }

    isDomain(domain: string): boolean {
        return domain.includes("x.com") || domain.includes("twitter.com");
    }

    async guildChk(domain: string, guildId: string | null, guildConfigs: Map<string, any>): Promise<boolean> {
        if (!domain) return false;
        const aDom = "Meltrys.xTwitter";
        const albe = guildConfigs.get(aDom);
        if (!albe || (albe && albe.enabled === false)) {
            debug(`El uso de Meltrys xTwitter no está habilitado en este gremio: ${guildId}`, "ApiReplacement");
            return false;
        }
        return true;
    }

    async process(url: string, message?: Message): Promise<{ fix: string | null, ok: boolean }> {
        if (!message) return { fix: null, ok: false };
        if (!message.channel || !message.channel.isTextBased()) return { fix: null, ok: false };

        const textChannel = message.channel as TextChannel;
        const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/i);
        if (!match) return { fix: null, ok: false };

        const tweetId = match[1];
        await textChannel.sendTyping();

        const xData = await xTwitter.getIllustData(tweetId);
        if (!xData) return { fix: null, ok: false };

        if (xData.bufferPics.length === 0 || xData.videoLinks.length > 0) return { fix: null, ok: false };

        try {
            const files: AttachmentBuilder[] = [];
            const embeds: EmbedBuilder[] = [];

            xData.bufferPics.forEach((buffer, index) => {
                const fileName = `image_${index + 1}.jpg`;
                files.push(new AttachmentBuilder(buffer, { name: fileName }));

                const embed = new EmbedBuilder()
                    .setAuthor({ name: `👤 ${xData.namePost} (@${xData.userPost})`, url: xData.urlPost })
                    .setURL(xData.urlPost)
                    .setImage(`attachment://${fileName}`);

                if (index === 0) {
                    embed.setColor('#1DA1F2')
                        .addFields(
                            { name: '👥 Seguidores', value: xData.followers, inline: true },
                            { name: '❤️ Likes', value: xData.likes, inline: true }
                        )
                        .setFooter({
                            text: `X | Twitter • by Meltryllis Api`,
                            iconURL: 'https://abs.twimg.com/favicons/twitter.ico'
                        });
                }
                embeds.push(embed);
            });


            const msgApi = await message.reply({ embeds: embeds, files: files, allowedMentions: { repliedUser: false } });
            if (!msgApi) return { fix: null, ok: false };

            deleteMSG(msgApi, message.author.id);
            embeRemove(message);

            return { fix: null, ok: true };

        } catch (error) {
            console.error(`[xTwitterCustom] Error al enviar:`, error);
            await message.reply({
                content: '❌ Error al procesar el tweet.',
                allowedMentions: { repliedUser: false }
            }).catch(() => { });
            return { fix: null, ok: false };
        }
    }
}


// ================================= xTwitter Process ================================= //
interface twitterData {
    urlPost: string,
    userPost: string,
    namePost: string,
    followers: string,
    following: string,
    likes: string,
    tweetDesc: string,
    videoLinks: string[],
    bufferPics: Buffer[]
}

interface ApiFxResponse {
    code: number;
    author?: {
        name: string;
        screen_name: string;
        url: string;
        followers: number;
        following: number;
        description: string;
    };
    status?: {
        url: string;
        text?: string;
        likes?: number;
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
            const infoRes = await fetch(`https://api.fxtwitter.com/2/status/${idX}`, { headers: this.headers });
            const infoData = await infoRes.json() as ApiFxResponse;
            if (!infoData || infoData.code !== 200) {
                console.log(`[xTweet] Post borrado o inaccesible. ID: ${idX}`);
                return null;
            }

            const picURLs = infoData.status?.media?.photos?.map(p => p.url) || [];
            const videoURLs = infoData.status?.media?.videos?.map(v => v.url) || [];

            const fetchPromises = picURLs.map(async url => { /* Descargar de imagenes en medium */
                const downUrl = url.replace(/([?&])name=orig/, '$1name=medium')
                console.log(downUrl)
                const res = await fetch(downUrl, { headers: this.headers });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const buffer = await res.arrayBuffer();
                return Buffer.from(buffer);
            });

            const videoLinks = videoURLs.map(url => `[Video](${url})`);
            const imageBuffers = await Promise.all(fetchPromises);

            return {
                urlPost: infoData.status?.url || "https://x.com",
                userPost: infoData.author?.screen_name || "Usuario desconocido",
                namePost: infoData.author?.name || "Usuario desconocido",
                followers: infoData.author?.followers?.toString() || "0",
                following: infoData.author?.following?.toString() || "0",
                likes: infoData.status?.likes?.toString() || "0",
                tweetDesc: infoData.status?.text || "Sin descripcion",
                videoLinks: videoLinks,
                bufferPics: imageBuffers
            };

        } catch (error) {
            console.error(`[xTwitter] Error interno al obtener twitter ${idX}:`, error);
            return null;
        }
    }
}