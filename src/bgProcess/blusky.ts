import { Client, Guild, GuildTextBasedChannel } from "discord.js";
import { deleteBskyFollow, getAllBlueskya, updateBskyLastPost } from "../sys/DB-Engine/links/blueSkya";
import { debug, error } from "../sys/logging";
import { getGuildReplacementConfig } from "../sys/DB-Engine/links/Embed";
import urlStatusManager from "../sys/embedding/domainChecker";


const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
// ===================== Engine ===================== //
export async function bskyEngine(cli: Client): Promise<void> {
    try {
        const dta = await getAllBlueskya();
        if (!dta) return;
        // Kche
        let kacheCh: { [key: string]: { chT: GuildTextBasedChannel | null } } = {};
        let kacheDom: { [key: string]: { dom: string | null } } = {};
        // BDelepa
        const depurBD = async (guildy: string, idBDpos: number, idDelKach: string) => {
            kacheCh[idDelKach] = { chT: null };
            try {
                await deleteBskyFollow({ gremio: guildy, id: idBDpos });
                debug(`Borrando de la BD el Blueskya con ID: ${idBDpos} del server: ${guildy}`, "BG.bskyFollow");
            } catch (e) { error(`Algo fallo en la BD ${e}`, "BG.bskyFollow"); }
        };
        // work
        for (const bky of dta) {
            const idKch = `${bky.guild_id}-${bky.chanel}`;

            let chToSend: GuildTextBasedChannel | null = null, dominio: string | null;
            if (idKch in kacheCh) { chToSend = kacheCh[idKch].chT; }
            else {
                let guild: Guild;
                try { guild = await cli.guilds.fetch(bky.guild_id) }
                catch (e: any) {
                    if (e.code === 10004 || e.code === 50001) { await depurBD(bky.guild_id, bky.id, idKch) };
                    continue;
                }

                let channel: GuildTextBasedChannel | null = null;
                try { channel = await guild.channels.fetch(bky.chanel) as GuildTextBasedChannel }
                catch (e: any) {
                    if (e.code === 404 || e.code === 10003 || e.code === 50001) { await depurBD(bky.guild_id, bky.id, idKch) }
                    else { debug(`Error al comrobar el ${bky.chanel} en ${bky.guild_id}: ${e.message}`, "BG.bskyFollow") };
                    continue;
                }

                if (!channel) { await depurBD(bky.guild_id, bky.id, idKch); continue }

                kacheCh[idKch] = { chT: channel }; chToSend = channel;
            }

            if (!chToSend) { await depurBD(bky.guild_id, bky.id, idKch); continue }

            if (bky.guild_id in kacheDom) { dominio = kacheDom[bky.guild_id].dom; }
            else {
                const gldCnfDom = await getGuildReplacementConfig(bky.guild_id);
                const hasCustom = (gldCnfDom.get("Bluesky")?.custom_url ?? null);
                const localDomain = urlStatusManager.getActiveUrl("bluesky") ?? null;
                const outDom = hasCustom ? hasCustom : localDomain;
                kacheDom[bky.guild_id] = { dom: outDom }; dominio = outDom;
            }

            await wait(100);
            await getFeed({
                guild: bky.guild_id, ch: chToSend, dominio: dominio, lang: bky.lang, usrID: bky.bskyUserId, usrName: bky.bskyUserName, modo: bky.modo, lastPost: bky.lastPost
            });
        }
    } catch (e) { error(`Fallo el checkTwitterFollow ${e}`, "BG.TwitterFollow") }
}

//========================================== apiGet ========================================== //
interface ApiData {
    usrID: string,
    usrName: string,
    modo: boolean,
    lastPost: string | null,
    lang: string | null,
    dominio: string | null,
    guild: string,
    ch: GuildTextBasedChannel
}

async function getFeed(dta: ApiData) {
    const modoGet = dta.modo ? "media" : "statuses";
    const urlGet = `https://api.fxbsky.app/2/profile/${dta.usrID}/${modoGet}?count=20&lang=es`;

    let getData: Response | null;
    try { getData = await fetch(urlGet, { method: 'GET' }) }
    catch (e: any) { error(`Fallo al obtener datos de ${dta.usrID}: ${e.message}`, "BG.bskyGetFeed"); return };
    if (!getData.ok) return;

    interface BSkyData { code?: number, results?: { id?: string, url?: string }[] };
    const datJson = await getData.json() as BSkyData;
    if (!datJson || datJson.code !== 200 || !datJson.results || datJson.results.length === 0) return;

    const bskyPosts: string[] = [];
    const lastIds = dta.lastPost?.split("#") ?? [];

    for (const pst of datJson.results) {
        if (pst.id && pst.url) {
            if (lastIds.includes(pst.id)) break;
            if (!dta.lastPost && bskyPosts.length >= 2) break;
            bskyPosts.push(pst.url)
        }
    }

    const topIds = datJson.results.slice(0, 4).map(r => r.id).filter(Boolean);
    const lastPosIDs = topIds.length ? topIds.join('#') : "noLastPost";

    await msgOutSend({ guild: dta.guild, ch: dta.ch, domain: dta.dominio, lang: dta.lang, bskyPosts, lastPosID: lastPosIDs, usrID: dta.usrID, usrName: dta.usrName })
}

// ========================================== outMsg ========================================== //
interface msgOutSendIn {
    guild: string,
    ch: GuildTextBasedChannel,
    domain: string | null,
    lang: string | null,
    usrID: string,
    usrName: string,
    bskyPosts: string[],
    lastPosID: string,
}

async function msgOutSend(out: msgOutSendIn) {
    try {
        for (const exit of out.bskyPosts.reverse()) {
            let outUrl = exit;
            if (out.domain) outUrl = outUrl.replace(/:?(?:bsky\.app)/g, out.domain);
            if (out.lang) outUrl = `${outUrl}/${out.lang}`

            const msgEmb = await out.ch.send({ content: `> ## BSky: Nuevo [Post](${outUrl}) de @${out.usrName}` }).catch(() => null);
            await wait(3_000);

            if (msgEmb && msgEmb.embeds.length === 0) {
                let freshMsg = await out.ch.messages.fetch(msgEmb.id).catch(() => null);
                if (!freshMsg) continue;
                if (freshMsg.embeds.length > 0) continue;

                let embOk = false;
                for (let att = 1; att <= 2; att++) {
                    await freshMsg.edit({ content: "⏳" }).catch(() => { });
                    await wait(2_000 * att);

                    await freshMsg.edit({ content: `> ## BSky: Nuevo [Post](${outUrl}) de @${out.usrName}` }).catch(() => { });
                    await wait(3_000 * att);

                    freshMsg = await freshMsg.channel.messages.fetch(freshMsg.id).catch(() => null);

                    if (!freshMsg) break;
                    if (freshMsg.embeds.length > 0) { embOk = true; break }
                }

                if (freshMsg && !embOk) {
                    freshMsg.delete().catch(() => { })
                    const lasTry = await out.ch.send({ content: `> ## BSky: Nuevo [Post](${outUrl}) de @${out.usrName}` }).catch(() => { });
                    await wait(3_500)
                    if (lasTry && lasTry.embeds.length === 0) {
                        await lasTry.edit({ content: `> ## BSky: Nuevo [Post](${exit}) de @${out.usrName} \n> ***No genero embed, devuelto link original***` }).catch(() => { });
                    }
                }
            }
        }

        await updateBskyLastPost({ guild_id: out.guild, user_id: out.usrID, post_id: out.lastPosID });
    } catch (e: any) { error(e, "BG.bskySend") }
}
