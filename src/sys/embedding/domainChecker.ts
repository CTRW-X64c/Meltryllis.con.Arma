import { warn, info, error } from "../logging";
import { replacementMetaList } from "./embedingConfig";
import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import getPool from "../DB-Engine/database";

export let embedingList: { [key: string]: string } = {};
export let embedezSFW: string[] = [];
export let embedezNSFW: string[] = [];

let autoRunChecks: NodeJS.Timeout | null = null;
let wait: NodeJS.Timeout | null = null;

// ======== Api ======== //
export const ApiList = () => {
    embedezSFW = embedingList["API_SFW"]
        ? embedingList["API_SFW"].split('|').map(x => x.trim())
        : [];
    embedezNSFW = embedingList["API_NSFW"]
        ? embedingList["API_NSFW"].split('|').map(y => y.trim())
        : [];
    info(`Embedez Api ready con ${embedezSFW.length} SFW y ${embedezNSFW.length} NSFW sitios!!`, "embedingService");
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

// ======== Command ======== //
export async function listDomains(i: ChatInputCommandInteraction): Promise<void> {
    try {
        const fields: { name: string, value: string, inline: boolean }[] = [];
        if (Object.keys(embedingList).length === 0) { await i.editReply("No hay lista de dominios disponible"); return; }
        for (const [site, domains] of Object.entries(embedingList)) {
            const list = domains.split("|").map(d => `🔗 ${d}`).join("\n");
            fields.push({ name: `Sitio: ${site}`, value: `RawDominios:\n > ${domains}` + "\n\n" + list, inline: false });
        }
        const emb = new EmbedBuilder()
            .setTitle("Lista de Dominios")
            .addFields(fields)
            .setColor(0x000000);

        await i.editReply({ embeds: [emb] });
    } catch (e) {
        await i.editReply("Hubo un problema al obtener la lista de dominios");
        error(`Error al obtener la lista de dominios: ${e}`, "embedingService");
    }
}

/* ================================================ Cheker de dominios ================================================ */
class UrlStatusManager {
    private activeUrls: Map<string, string> = new Map();
    private readonly CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos

    public start() {
        this.runChecks(); // Peimer run al iniciar
        if (autoRunChecks) clearInterval(autoRunChecks);
        autoRunChecks = setInterval(() => this.runChecks(), this.CHECK_INTERVAL);
    }

    private async runChecks() {
        const targets = [
            ...replacementMetaList.map(map => ({ name: map.name, dbKey: map.dbKey })),
            { name: "Api", dbKey: "Api" }
        ];

        for (const meta of targets) {
            const rawString = embedingList[meta.dbKey];

            if (!rawString) {
                this.activeUrls.delete(meta.dbKey);
                continue;
            }

            const candidates = rawString.split('|').map(url => url.trim()).filter(url => url.length > 0);

            if (candidates.length <= 1) {
                this.activeUrls.set(meta.dbKey, candidates[0]);
                continue;
            }

            let foundWorking = false;

            for (const domain of candidates) {
                const isUp = await this.checkDomain(domain);
                if (isUp) {
                    if (this.activeUrls.get(meta.dbKey) !== domain) {
                        info(`✅ [${meta.name}] Cambiado a: ${domain}`);
                    }
                    this.activeUrls.set(meta.dbKey, domain);
                    foundWorking = true;
                    break; // Nos quedamos con la primera que sirva
                }
            }

            if (!foundWorking && candidates.length > 0) {
                error(`⚠️ [${meta.name}] Todos los dominios están caídos. Usando default: ${candidates[0]}, "embedingService"`);
                this.activeUrls.set(meta.dbKey, candidates[0]);
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
            error(`[DomainCheck] Error crítico verificando ${domain}: ${e}`, "embedingService");
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