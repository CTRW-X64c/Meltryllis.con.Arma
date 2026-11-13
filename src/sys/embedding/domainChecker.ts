import { warn, info, error, debug } from "../logging";
import { rMetaList } from "./embedingConfig";
import getPool from "../DB-Engine/database";

export let embedingList: { [key: string]: string } = {};
export let embedezSFW: string[] = [];
export let embedezNSFW: string[] = [];

let autoRunChecks: NodeJS.Timeout | null = null;
let wait: NodeJS.Timeout | null = null;

// ======== Api ======== //
const ApiList = () => {
    embedezSFW = embedingList["API_SFW"]
        ? embedingList["API_SFW"].split('|').map(x => x.trim())
        : [];
    embedezNSFW = embedingList["API_NSFW"]
        ? embedingList["API_NSFW"].split('|').map(y => y.trim())
        : [];
    regenList();
    info(`Embedez Api ready con ${embedezSFW.length} SFW y ${embedezNSFW.length} NSFW sitios!!`, "embedingService");
}

// ======== local Api ======== //
export const meltrillisApi: string[] = [
    "Meltrys.Pixiv",
    "Meltrys.xTwitter",
    "Meltrys.Reddit"
];

// ======== lists ======== //
export let masterList: { name: string, value: string }[] = [];
export let isApiList: string[] = [];
const regenList = () => {
    const hostList = rMetaList.map((itm) => ({ name: "Remplacer: " + itm.name, value: itm.name }));
    const sfwList = embedezSFW.map((itm) => ({ name: "Api.SFW: " + itm, value: itm }));
    const nsfwList = embedezNSFW.map((itm) => ({ name: "Api.NSFW: " + itm, value: itm }));
    const melList = meltrillisApi.map((itm) => ({ name: "Meltryllis.Api: " + itm, value: itm }));
    masterList = [...hostList, ...sfwList, ...nsfwList, ...melList];
    isApiList = [...embedezSFW, ...embedezNSFW, ...meltrillisApi];
}

// ======== core ======== //
export const updateList = (s: string, d?: string) => {
    if (s && d) { embedingList[s] = d; }
    else { delete embedingList[s]; }
    if (s === "API_SFW" || s === "API_NSFW") ApiList();
    if (autoRunChecks) clearInterval(autoRunChecks);
    if (wait) clearTimeout(wait);
    wait = setTimeout(() => { urlStatusManager.start(); }, 30_000);
    info(`Lista de dominios actualizada (Esperando 30s para hacer ping a: ${s})!!`, "embedingService");
};

export async function startListDomains(): Promise<boolean> {
    try {
        const pool = await getPool();
        const [List]: any = await pool.query("SELECT site, domains FROM domains");
        if (!List || List.length === 0) { warn("embeding service no esta funcionando!"); return false }
        embedingList = {};
        for (const emb of List) {
            embedingList[emb.site] = emb.domains;
        };
        ApiList();
        return true;
    } catch (e) { error(`Error al obtener la lista de dominios: ${e}`, "embedingService"); return false }
}

// ======== BD ======== //
export async function addSite(s: string, d: string): Promise<boolean> {
    try {
        const pool = await getPool();
        await pool.query("INSERT INTO domains (site, domains) VALUES (?, ?) ON DUPLICATE KEY UPDATE domains = VALUES(domains)", [s, d]);
        updateList(s, d);
        return true;
    } catch (e) { error(`Error al insertar dominio: ${e}`, "embedingService"); return false }
}

export async function deleteSite(s: string): Promise<boolean> {
    try {
        const pool = await getPool();
        await pool.query("DELETE FROM domains WHERE site = ?", [s]);
        updateList(s);
        return true;
    } catch (e) { error(`Error al eliminar dominio: ${e}`, "embedingService"); return false }
}

export async function editDomain(s: string, d: string): Promise<boolean> {
    try {
        const pool = await getPool();
        const [edit]: any = await pool.query("SELECT site, domains FROM domains WHERE site = ?", [s]);
        if (!edit || edit.length === 0) { error("No existe el sitio!!"); return false; }
        const x = edit[0];
        const dx = `${d}|${x.domains}`;
        await pool.query("UPDATE domains SET domains = ? WHERE site = ?", [dx, s]);
        updateList(s, dx);
        return true;
    } catch (e) { error(`Error al editar dominio: ${e}`, "embedingService"); return false; }
}

export async function deletLast(s: string): Promise<boolean> {
    try {
        const pool = await getPool();
        const [dLast]: any = await pool.query("SELECT site, domains FROM domains WHERE site = ?", [s]);
        if (!dLast || dLast.length === 0) { error("No existe el sitio!!", "embedingService"); return false }
        const X = dLast[0];
        const Y = X.domains;
        const d = Y.split("|").slice(1).join("|");
        if (d !== "") {
            await pool.query("UPDATE domains SET domains = ? WHERE site = ?", [d, s]);
            updateList(s, d);
            return true;
        } else {
            await pool.query("DELETE FROM domains WHERE site = ?", [s]);
            updateList(s);
            return true;
        }
    } catch (e) { error("Error al eliminar el ultimo dominio", "embedingService"); return false }
}

/* ================================================ Cheker de dominios ================================================ */
class UrlStatusManager {
    private activeUrls: Map<string, string> = new Map();
    private isPining: Map<string, boolean> = new Map();
    private readonly CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos

    public start() {
        this.runChecks(); // Peimer run al iniciar
        if (autoRunChecks) clearInterval(autoRunChecks);
        autoRunChecks = setInterval(() => this.runChecks(), this.CHECK_INTERVAL);
    }

    private async runChecks() {
        const targets = [
            ...rMetaList.map(map => ({ name: map.name, dbKey: map.dbKey })),
            { name: "Api", dbKey: "Api" }
        ];

        for (const meta of targets) {
            const rawString = embedingList[meta.dbKey];

            if (!rawString) {
                this.activeUrls.delete(meta.dbKey);
                continue;
            }

            if (this.isPining.get(meta.dbKey)) continue;

            const embSites = rawString.split('|').map(url => url.trim()).filter(url => url.length > 0);
            if (embSites.length === 0) continue;

            const dft = embSites[embSites.length - 1];
            const candidates = embSites.slice(0, -1);

            if (candidates.length === 0) {
                this.activeUrls.set(meta.dbKey, dft);
                continue;
            }

            let foundWorking = false;
            for (const domain of candidates) {
                const isUp = await this.checkDomain(domain);
                if (isUp) {
                    const actualDom = this.activeUrls.get(meta.dbKey) ?? `"Sin dominio"`;
                    if (actualDom !== domain) {
                        info(`✅ [${meta.name}]: Pasando de ${actualDom} a ${domain}`);
                    }
                    this.activeUrls.set(meta.dbKey, domain);
                    foundWorking = true;
                    break;
                }
            }

            if (!foundWorking) {
                error(`⚠️ [${meta.name}]: Todos los alternos caídos. Usando default (${dft}) e iniciando pings.`);
                this.activeUrls.set(meta.dbKey, dft);
                this.isPining.set(meta.dbKey, true);
                // ping constante para rapida deteccion de up
                this.fallDomaind({ domains: candidates, key: meta.dbKey })
                    .catch((e) => { error(`[${meta.name}] Error en ping continuo | ${e.message}`); })
                    .finally(() => { this.isPining.delete(meta.dbKey); });
            }
        }
    }

    private async fallDomaind(dta: { domains: string[], key: string }): Promise<void> {
        let intento = 0;
        const maxIntentos = 50;

        while (intento < maxIntentos) {
            for (const domain of dta.domains) {
                intento++;

                const upDomain = await this.checkDomain(domain);
                if (upDomain) {
                    this.activeUrls.set(dta.key, domain);
                    info(`✅ [${dta.key}]: usando ${domain} después de ${intento} intentos`);
                    return;
                }

                if (intento >= maxIntentos) throw new Error(`Se alcanzaron los ${maxIntentos} intentos sin respuesta en alternos para ${dta.key}.`);

                await new Promise(resolve => setTimeout(resolve, 2_500));
            }
        }
    }

    private async checkDomain(domain: string): Promise<boolean> {
        try {
            const url = domain.startsWith("http") ? domain : `https://${domain}`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
            const header = { 'User-Agent': 'MeltryllistHealthCheck/1.0' }

            const response = await fetch(url, {
                method: 'HEAD',
                signal: controller.signal,
                headers: header
            }).catch(() => {
                return fetch(url, { method: 'GET', signal: controller.signal, headers: header });
            });

            clearTimeout(timeoutId);
            return response.status < 500;

        } catch (e) {
            debug(`[DomainCheck] Error crítico verificando ${domain}: ${e}`, "embedingService");
            return false;
        }
    }

    public getActiveUrl(dbKey: string): string | null {
        return this.activeUrls.get(dbKey) || null;
    }
}

const urlStatusManager = new UrlStatusManager();
export const startUrlStatusManager = () => {
    urlStatusManager.start();
    info("🌐 Iniciando servicio de verificación de dominios...");
};
export default urlStatusManager;

/* ==================================================================================================================== */