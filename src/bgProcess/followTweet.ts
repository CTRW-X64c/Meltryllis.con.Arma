import { Client, Guild, TextChannel } from "discord.js"
import { deleteFollowTweet, getAllFollowTweet, updateFollowTweet } from "../sys/DB-Engine/links/followTweet"
import { debug, error } from "../sys/logging";
import urlStatusManager from "../sys/embedding/domainChecker";
import { getGuildReplacementConfig } from "../sys/DB-Engine/links/Embed";

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export async function initFolloX(C: Client): Promise<void> {
    await wait(30_000);
    tweEngine(C)
}

// ===================== Engine ===================== //
export async function tweEngine(cli: Client): Promise<void> {
    try {
        let kacheCh: { [key: string]: { chT: TextChannel | null } } = {};
        let kacheDom: { [key: string]: { dom: string | null } } = {};

        const depurBD = async (guildy: string, idBDpos: number, idDelKach: string) => {
            kacheCh[idDelKach] = { chT: null };
            try {
                await deleteFollowTweet({ gremio: guildy, id: idBDpos });
                debug(`Borrando de la BD el X/Twitter con ID: ${idBDpos} del server: ${guildy}`, "BG.TwitterFollow");
            } catch (e) { error(`Algo fallo en la BD ${e}`, "BG.TwitterFollow"); }
        };

        const dta = await getAllFollowTweet();
        if (!dta) return;

        for (const X of dta) {
            const { id, guild_id, canal, xUser, lastPost, Domain, lang, onlyMedia } = X;
            const idKch = `${guild_id}-${canal}`;

            let chToSend: TextChannel | null = null, dominio: string | null;
            if (idKch in kacheCh) { chToSend = kacheCh[idKch].chT; }
            else {
                let guild: Guild;
                try { guild = await cli.guilds.fetch(guild_id) }
                catch (e: any) {
                    if (e.code === 10004 || e.code === 50001) { await depurBD(guild_id, id, idKch) };
                    continue;
                }

                let channel: TextChannel | null = null;
                try { channel = await guild.channels.fetch(canal) as TextChannel }
                catch (e: any) {
                    if (e.code === 404 || e.code === 10003 || e.code === 50001) { await depurBD(guild_id, id, idKch) }
                    else { debug(`Error al comrobar el ${canal} en ${guild_id}: ${e.message}`, "BG.TwitterFollow") };
                    continue;
                }

                if (!channel) { await depurBD(guild_id, id, idKch); continue }

                kacheCh[idKch] = { chT: channel }; chToSend = channel;
            }

            if (!chToSend) { await depurBD(guild_id, id, idKch); continue }

            if (guild_id in kacheDom) { dominio = kacheDom[guild_id].dom; }
            else {
                const guildConf = await getGuildReplacementConfig(guild_id)
                const guildCustomD = Domain ? Domain : (guildConf.has("Twitter | X") ? guildConf.get("Twitter | X")?.custom_url : null);
                const myCustomD = guildCustomD ?? urlStatusManager.getActiveUrl("twitter")
                const tweetDomain = guildCustomD ? guildCustomD : myCustomD;
                kacheDom[guild_id] = { dom: tweetDomain }; dominio = tweetDomain;
            }

            await wait(200);
            const newPost = await getting({ gremio: guild_id, userX: xUser, typeUserX: onlyMedia, lPost: lastPost, tl: lang, cDom: dominio });
            msgSend({ Api: newPost, channel: chToSend, guild: guild_id, xUser: xUser }).catch(e => error(e, "BG.TwitterFollow"));
        }
    } catch (e) { error(`Fallo el checkTwitterFollow ${e}`, "BG.TwitterFollow") }
}

// === msgSender === //
interface msgSendIn { Api: { lisTweets: string[], lastPosID: string } | null, channel: TextChannel, guild: string, xUser: string }
async function msgSend(out: msgSendIn): Promise<void> {
    try {
        if (!out.Api || out.Api.lisTweets.length === 0) return;
        const { Api, channel, guild, xUser } = out
        const { lisTweets, lastPosID } = Api;

        for (let i = lisTweets.length - 1; i >= 0; i--) {
            const msgEmb = await channel.send(lisTweets[i]);
            await wait(3_000);

            if (msgEmb.embeds.length === 0) {
                let freshMsg = await channel.messages.fetch(msgEmb.id).catch(() => null);
                if (!freshMsg) continue;
                if (freshMsg.embeds.length > 0) continue;

                let embOk = false;
                for (let att = 1; att <= 2; att++) {
                    await freshMsg.edit({ content: "⏳" }).catch(() => { });
                    await wait(2_000 * att);

                    await freshMsg.edit({ content: lisTweets[i] }).catch(() => { });
                    await wait(3_000 * att);

                    freshMsg = await freshMsg.channel.messages.fetch(freshMsg.id).catch(() => null);

                    if (!freshMsg) break;
                    if (freshMsg.embeds.length > 0) { embOk = true; break }
                }

                if (freshMsg && !embOk) { await freshMsg.edit({ content: lisTweets[i] }).catch(() => { }); }
            }
        }

        await updateFollowTweet(guild, channel.id, xUser, lastPosID);
        debug(`Se enviaron ${lisTweets.length} tweets del gremio: ${guild} para @${xUser}`, "BG.TwitterFollow")

    } catch (e) { error(`Error en el envio del mensaje del gremio: ${out.guild}`, "BG.TwitterFollow") }
}

// === apiSolver === //
interface todoInt { gremio: string, userX: string, typeUserX: boolean, lPost: string | null, tl: string | null, cDom: string | null }
async function getting(dta: todoInt): Promise<{ lisTweets: string[]; lastPosID: string; } | null> {
    try {
        let typePostGet = dta.typeUserX ? "media" : "statuses";
        const response = await fetch(`https://api.fxtwitter.com/2/profile/${dta.userX}/${typePostGet}?count=15`, { method: 'GET' });
        if (!response.ok) return null;

        interface tweetData { code?: number, results?: { id?: string, url?: string }[] };
        const data = await response.json() as tweetData;
        if (!data || data.code !== 200 || !data.results || data.results.length === 0) {
            error(`Error en el fetch a @${dta.userX} del gremio: ${dta.gremio}`, "BG.TwitterFollow");
            return null;
        }

        let apiData = { lisTweets: [] as string[], lastPosID: "noLastPost" };
        for (const x of data.results) {
            if (x.url && x.id) {
                if (x.id === dta.lPost) {
                    debug(`Se salto el follow: ${dta.userX} del gremio: ${dta.gremio}, no cuenta con actualizaciones`, "BG.TwitterFollow");
                    break;
                }
                let tweetURL = x.url;
                dta.cDom ? tweetURL = tweetURL.replace(/:?(?:twitter\.com|x\.com)/g, dta.cDom) : x.url;
                dta.tl ? tweetURL = (tweetURL + `/${dta.tl}`) : tweetURL;
                apiData.lisTweets.push(`New tweet de @${dta.userX}: [Tweet!](${tweetURL})`);
            }
        }

        if (data.results[0].id) apiData.lastPosID = data.results[0].id;
        return apiData;

    } catch (e: any) {
        error(`Error al processar el follow del gremio: ${dta.gremio} | Error: ${e.message}`, "BG.TwitterFollow");
        return null;
    }
}
