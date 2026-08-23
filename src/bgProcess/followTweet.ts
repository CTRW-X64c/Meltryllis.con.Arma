import { Client, TextChannel } from "discord.js"
import { deleteFollowTweet, getAllFollowTweet, updateFollowTweet } from "../sys/DB-Engine/links/followTweet"
import { debug, error } from "../sys/logging";
import urlStatusManager from "../sys/embedding/domainChecker";
import { getGuildReplacementConfig } from "../sys/DB-Engine/links/Embed";

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export async function initFolloX(C: Client) {
    await wait(30_000);
    tweEngine(C)
}

// ===================== Engine ===================== //
export async function tweEngine(cli: Client) {
    try {
        let kacheCh: { [key: string]: { chT: TextChannel | null } } = {}, chToSend: TextChannel | null;
        let kacheDom: { [key: string]: { dom: string | null } } = {}, dominio: string | null;
        const dta = await getAllFollowTweet()
        if (!dta) return;
        for (const X of dta) {
            const { id, guild_id, canal, xUser, lastPost, Domain, lang } = X
            const idKch = `${guild_id}-${canal}`
            if (idKch in kacheCh) { chToSend = kacheCh[idKch].chT; }
            else {
                const guild = await cli.guilds.fetch(guild_id)
                if (!guild) { kacheCh[idKch] = { chT: null }; continue }
                const channel = await guild.channels.fetch(canal) as TextChannel
                if (!channel) {
                    kacheCh[idKch] = { chT: null };
                    await deleteFollowTweet(guild_id, id);
                    debug(`No se encontro el canal: ${canal} del server: ${guild_id}`, "BG.TwitterFollow")
                    continue;
                }
                kacheCh[idKch] = { chT: channel }; chToSend = channel;
            }

            if (!chToSend) {
                await deleteFollowTweet(guild_id, id);
                debug(`No se encontro el canal: ${canal} del server: ${guild_id}, Borrado ${xUser}`, "BG.TwitterFollow");
                continue;
            }

            if (guild_id in kacheDom) { dominio = kacheDom[guild_id].dom; }
            else {
                const guildConf = await getGuildReplacementConfig(guild_id)
                const guildCustomD = Domain ? Domain : (guildConf.has("Twitter | X") ? guildConf.get("Twitter | X")?.custom_url : null);
                const myCustomD = guildCustomD ?? urlStatusManager.getActiveUrl("twitter")
                const tweetDomain = guildCustomD ? guildCustomD : myCustomD;
                kacheDom[guild_id] = { dom: tweetDomain }; dominio = tweetDomain;
            }

            await wait(200);
            const newPost = await getting({ gremio: guild_id, userX: xUser, lPost: lastPost, tl: lang, cDom: dominio });
            msgSend({ Api: newPost, channel: chToSend, guild: guild_id, xUser: xUser }).catch(e => error(e, "BG.TwitterFollow"));
        }
    } catch (e) { error(`Fallo el checkTwitterFollow ${e}`, "BG.TwitterFollow") }
}

// === msgSender === //
interface msgSendIn { Api: { lisTweets: string[], lastPosID: string } | null, channel: TextChannel, guild: string, xUser: string }
async function msgSend(out: msgSendIn) {
    try {
        if (out.Api && out.Api.lisTweets.length > 0) {
            for (let i = out.Api.lisTweets.length - 1; i >= 0; i--) {
                await wait(500);
                await out.channel.send(out.Api.lisTweets[i]);
            }
            await updateFollowTweet(out.guild, out.channel.id, out.xUser, out.Api.lastPosID);
            debug(`Se enviaron ${out.Api.lisTweets.length} tweets del gremio: ${out.guild} para @${out.xUser}`, "BG.TwitterFollow")
        }
    } catch (e) { error(`Error en el envio del mensaje del gremio: ${out.guild}`, "BG.TwitterFollow") }
}

// === apiSolver === //
interface todoInt { gremio: string, userX: string, lPost: string | null, tl: string | null, cDom: string | null }
async function getting(dta: todoInt) {
    try {
        const response = await fetch(`https://api.fxtwitter.com/2/profile/${dta.userX}/statuses?count=10`);
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
                apiData.lisTweets.push(tweetURL);
            }
        }

        if (data.results[0].id) apiData.lastPosID = data.results[0].id;
        return apiData;

    } catch {
        error(`Error general del gremio: ${dta.gremio}`, "BG.TwitterFollow");
        return null;
    }
}
