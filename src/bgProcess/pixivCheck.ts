import { Client, Guild, TextChannel } from "discord.js";
import { deletePixi, getAllPixis, updatePixi } from "../sys/DB-Engine/links/PixivData";
import { debug, error } from "../sys/logging";
import urlStatusManager from "../sys/embedding/domainChecker";
import { getGuildReplacementConfig } from "../sys/DB-Engine/links/Embed";
import axios, { AxiosResponse } from "axios";
import { Proxy } from "../sys/zGears/newAux";

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
let galleta: string | null = null;
export async function initPixivCheck(cli: Client) {
    galleta = process.env.PIXIV_COOKIE ? `PHPSESSID=${process.env.PIXIV_COOKIE}` : null;
    if (!galleta) { error("❌ No se encontro la cookie de Pixiv", "BG.PixivFollow"); return };
    await wait(30_000)
    enginePixi(cli);
    setInterval(async () => enginePixi(cli), 1_000 * 60 * 30) // 30 minutos; para evitar ratelimit este no se podra modificar
    debug("✅ Inicaido el sistema PixivFollow")
}

// ============================================================== core ============================================================== //
interface apichek {
    id: number,
    ch: TextChannel,
    guild: string,
    doman: string | null,
    pUser: string,
    pUserName: string,
    iOn: boolean,
    mOn: boolean,
    nOn: boolean,
    lastPost: {
        illust: string | null,
        manga: string | null,
        novel: string | null,
    }
}

async function enginePixi(cli: Client) {
    try {
        const data = await getAllPixis()
        if (!data.length) return;
        // kche
        let kacheCh: { [key: string]: { chT: TextChannel | null } } = {};
        let kacheDom: { [key: string]: { dom: string | null } } = {};
        // BDelepa
        const depurBD = async (guildy: string, idBDpos: number, idDelKach: string) => {
            kacheCh[idDelKach] = { chT: null };
            try {
                await deletePixi({ gldPi: guildy, idPi: idBDpos });
                debug(`Borrando de la BD el Pixiv con ID: ${idBDpos} del server: ${guildy}`, "BG.PixivFollow");
            } catch (e) { error(`Algo fallo en la BD ${e}`, "BG.PixivFollow"); }
        };
        // work
        for (const pixi of data) {
            const idKch = `${pixi.guild_id}-${pixi.chGuild}`;

            let chToSend: TextChannel | null = null, dominio: string | null;
            if (idKch in kacheCh) { chToSend = kacheCh[idKch].chT; }
            else {
                let guild: Guild;
                try { guild = await cli.guilds.fetch(pixi.guild_id) }
                catch (e: any) {
                    if (e.code === 10004 || e.code === 50001) { await depurBD(pixi.guild_id, pixi.id, idKch) };
                    continue;
                }

                let channel: TextChannel | null = null;
                try { channel = await guild.channels.fetch(pixi.chGuild) as TextChannel }
                catch (e: any) {
                    if (e.code === 404 || e.code === 10003 || e.code === 50001) { await depurBD(pixi.guild_id, pixi.id, idKch) }
                    else { debug(`Error al comrobar el ${pixi.chGuild} en ${pixi.guild_id}: ${e.message}`, "BG.PixivFollow") };
                    continue;
                }

                if (!channel) { await depurBD(pixi.guild_id, pixi.id, idKch); continue }

                kacheCh[idKch] = { chT: channel }; chToSend = channel;
            }

            if (!chToSend) { await depurBD(pixi.guild_id, pixi.id, idKch); continue }

            if (pixi.guild_id in kacheDom) { dominio = kacheDom[pixi.guild_id].dom; }
            else {
                const gldCnfDom = await getGuildReplacementConfig(pixi.guild_id);
                const hasCustom = (gldCnfDom.get("Pixiv")?.custom_url ?? null);
                const localDomain = urlStatusManager.getActiveUrl("pixiv") ?? null;
                const outDom = hasCustom ? hasCustom : localDomain;
                kacheDom[pixi.guild_id] = { dom: outDom }; dominio = outDom;
            }

            await wait(300);
            await proccesData({ id: pixi.id, guild: pixi.guild_id, ch: chToSend, pUser: pixi.pixiUser, pUserName: pixi.pixiUserName, doman: dominio, iOn: pixi.illustOn, mOn: pixi.mangaOn, nOn: pixi.novelOn, lastPost: { illust: pixi.lstPostIllust, manga: pixi.lstPostManga, novel: pixi.lstPostNovel } })
        }
    } catch (e) { error(`Fallo el checkPixivFollow ${e}`, "BG.PixivFollow") }
}

// ============================================================== Prosses ============================================================== //
interface datApi {
    error: boolean;
    body: {
        illusts: Record<string, null>,
        manga: Record<string, null>,
        novels: Record<string, null>,
    }
}

async function proccesData(dta: apichek) {
    const url = `https://www.pixiv.net/ajax/user/${dta.pUser}/profile/all`
    const options = {
        headers: {
            'Referer': 'https://www.pixiv.net/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Cookie': galleta!
        },
        httpAgent: Proxy,
        httpsAgent: Proxy,
    }

    let data: AxiosResponse | null = null;
    try {
        data = await axios(url, options)
        if (!data || data.status !== 200) return;
    } catch (e: any) { error(`Fallo el fetch de Pixis ${e.message}`, "BG.PixivFollow"); return }

    const dataJson = await data.data as datApi;
    if (dataJson.error) return;

    const illusIds = Object.keys(dataJson.body.illusts || {});
    const mangaIds = Object.keys(dataJson.body.manga || {});
    const novelIds = Object.keys(dataJson.body.novels || {});

    const domaindo = dta.doman ? dta.doman : "pixiv.net";

    let listas = { illusList: [] as string[], mangaList: [] as string[], novelList: [] as string[] };
    let newLastIds = { illust: "NoAsignado", manga: "NoAsignado", novel: "NoAsignado" };

    if (dta.iOn && illusIds.length > 0) {
        const illusLastIds = dta.lastPost.illust?.split("#") ?? [];
        for (let inv = illusIds.length - 1; inv >= 0; inv--) {
            const x = illusIds[inv];
            if (illusLastIds.includes(x)) break;
            if ((!dta.lastPost.illust || dta.lastPost.illust === "NoAsignado") && listas.illusList.length >= 2) break;
            const ilusURL = `https://${domaindo}/artworks/${x}`;
            listas.illusList.push(ilusURL)
        }
        newLastIds.illust = illusIds.slice(-4).reverse().join("#")
    }

    if (dta.mOn && mangaIds.length > 0) {
        const mangaLastIds = dta.lastPost.manga?.split("#") ?? [];
        for (let inv = mangaIds.length - 1; inv >= 0; inv--) {
            const x = mangaIds[inv];
            if (mangaLastIds.includes(x)) break;
            if ((!dta.lastPost.manga || dta.lastPost.manga === "NoAsignado") && listas.mangaList.length >= 2) break;
            const mangaURL = `https://${domaindo}/artworks/${x}`;
            listas.mangaList.push(mangaURL)
        }
        newLastIds.manga = mangaIds.slice(-4).reverse().join("#")
    }

    if (dta.nOn && novelIds.length > 0) {
        const novelLastIds = dta.lastPost.novel?.split("#") ?? [];
        for (let inv = novelIds.length - 1; inv >= 0; inv--) {
            const x = novelIds[inv];
            if (novelLastIds.includes(x)) break;
            if ((!dta.lastPost.novel || dta.lastPost.novel === "NoAsignado") && listas.novelList.length >= 2) break;
            const novelURL = `https://${domaindo}/artworks/${x}`;
            listas.novelList.push(novelURL)
        }
        newLastIds.novel = novelIds.slice(-4).reverse().join("#")
    }

    await sendPost({ gld: dta.guild, ch: dta.ch, pUser: dta.pUser, pUserName: dta.pUserName, postList: listas, lastIds: newLastIds });
}

// ============================================================== sndMSG ============================================================== //
interface outMsg {
    gld: string,
    ch: TextChannel,
    pUser: string,
    pUserName: string,
    postList: { illusList: string[], mangaList: string[], novelList: string[] },
    lastIds: { illust: string, manga: string, novel: string }
}

async function sendPost(out: outMsg) {
    try {
        if (out.postList.illusList.length === 0 && out.postList.mangaList.length === 0 && out.postList.novelList.length === 0) return;

        const outMsg = async (url: string, tipo: "t1" | "t2" | "t3") => {
            const tipoStr = tipo === "t1" ? `Nueva [Ilustración](${url})` : tipo === "t2" ? `Nuevo [Manga](${url})` : `Nueva [Novela](${url})`
            await out.ch.send(`> ## Pixiv:  ${tipoStr} de ${out.pUserName}`)
        }

        if (out.postList.illusList.length > 0) {
            for (let inv = out.postList.illusList.length - 1; inv >= 0; inv--) {
                await wait(250);
                await outMsg(out.postList.illusList[inv], "t1")
            }
        };

        if (out.postList.mangaList.length > 0) {
            for (let inv = out.postList.mangaList.length - 1; inv >= 0; inv--) {
                await wait(250);
                await outMsg(out.postList.mangaList[inv], "t2")
            }
        };

        if (out.postList.novelList.length > 0) {
            for (let inv = out.postList.novelList.length - 1; inv >= 0; inv--) {
                await wait(250);
                await outMsg(out.postList.novelList[inv], "t3")
            }
        };

        await updatePixi(out.gld, out.pUser, out.lastIds.illust, out.lastIds.manga, out.lastIds.novel)

    } catch (e: any) { error(`Fallo al enviar el Post en pixivCheck: ${e.message}`, "BG.PixivFollow") }
}