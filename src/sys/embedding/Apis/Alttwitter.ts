// src/sys/embedding/Apis/PixivAPI.ts
import { Message, AttachmentBuilder, TextChannel, EmbedBuilder } from "discord.js";
import { deleteMSG, embeRemove } from "../embedService";
import { ApiHandler } from "../embedingSwitch"
import { debug } from "../../logging";

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

    async process(url: string, message?: Message): Promise<{ fix: string | null, ok: boolean }> {
        if (!message) return { fix: null, ok: false };
        if (!message.channel || !message.channel.isTextBased()) return { fix: null, ok: false };

        const tx = message.channel as TextChannel;
        await tx.sendTyping();

        const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/i);
        if (!match) return { fix: null, ok: false };
        const xId = match[1];

        const xData = await xTwitter.getIllustData(xId);
        if (!xData) return { fix: null, ok: false };

        if (xData.bufferPics.length === 0 || xData.videoLinks.length > 0) return { fix: null, ok: false };

        try {
            const files: AttachmentBuilder[] = [];
            const embeds: EmbedBuilder[] = [];

            xData.bufferPics.forEach((buffer, index) => {
                const fileName = `image_${index + 1}.jpg`;
                files.push(new AttachmentBuilder(buffer, { name: fileName }));

                const embed = new EmbedBuilder()
                    .setAuthor({ name: `👤 ${xData.showName} (@${xData.userName})`, url: xData.urlPost })
                    .setURL(xData.urlPost)
                    .setImage(`attachment://${fileName}`)
                    .setThumbnail(xData.avatarPic)
                if (xData.tweetDesc.length > 0) embed.setDescription(xData.tweetDesc)
                if (index === 0) {
                    embed.setColor('#1DA1F2')
                        .addFields(
                            { name: '👥 Seguidores', value: xData.followers, inline: true },
                            { name: '👥 Siguiendo', value: xData.following, inline: true },
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
    showName: string,
    userName: string,
    followers: string,
    following: string,
    likes: string,
    tweetDesc: string,
    avatarPic: string,
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
        avatar_url?: string;
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
            const call = await fetch(`https://api.fxtwitter.com/2/status/${idX}`, { headers: this.headers });
            const Data = await call.json() as ApiFxResponse;
            if (!Data || Data.code !== 200) return null;

            const picURLs = Data.status?.media?.photos?.map(p => p.url) || [];
            const videoURLs = Data.status?.media?.videos?.map(v => v.url) || [];

            const fetchPromises = picURLs.map(async url => { /* Descargar de imagenes a large */
                const downUrl = url.replace(/([?&])name=orig/, '$1name=large')
                const res = await fetch(downUrl, { headers: this.headers });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const buffer = await res.arrayBuffer();
                return Buffer.from(buffer);
            });

            //const videoLinks = videoURLs.map(url => `[Video](${url})`);
            if (videoURLs.length > 0) return null; // temp Patch
            const imageBuffers = await Promise.all(fetchPromises);

            return {
                urlPost: Data.status?.url || "https://x.com",
                showName: Data.author?.screen_name || "Usuario desconocido",
                userName: Data.author?.name || "Usuario desconocido",
                followers: Data.author?.followers?.toString() || "0",
                following: Data.author?.following?.toString() || "0",
                likes: Data.status?.likes?.toString() || "0",
                tweetDesc: Data.status?.text || "...",
                avatarPic: Data.author?.avatar_url || "https://i.pinimg.com/1200x/c8/d3/d4/c8d3d4d12a8ea35b58e35de9ec820a22.jpg",
                videoLinks: [],
                bufferPics: imageBuffers
            };

        } catch (error) {
            console.error(`[xTwitter] Error interno al obtener twitter ${idX}:`, error);
            return null;
        }
    }
}
