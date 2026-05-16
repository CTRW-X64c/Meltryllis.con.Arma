import { warn, info, error, debug } from "../logging";
import { replacementMetaList } from "./EmbedingConfig";
import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import getPool from "../DB-Engine/database";

export let sites: { [key: string]: string } = {};
let sitesCache = false;

export async function startListDomains(): Promise<boolean> {
    try {
        const pool = await getPool();
        const [List]: any = await pool.query("SELECT site, domains FROM domains");
        sites = {};
        if (!List || List.length === 0) { warn("embeding service no esta funcionando!"); return false }
        for (const domain of List) {
            sites[domain.site] = domain.domains;
        }
        sitesCache = true;
        return true;
    } catch (e) {
        error(`Error al obtener la lista de dominios: ${e}`);
        return false;
    }
}

export async function addSite(site: string, domains: string): Promise<boolean> {
    try {
        const pool = await getPool();
        await pool.query(
            "INSERT INTO domains (site, domains) VALUES (?, ?) ON DUPLICATE KEY UPDATE domains = VALUES(domains)",
            [site, domains]
        );
        delete sites[site];
        sites[site] = domains;
        urlStatusManager.runChecks();
        return true;
    } catch (e) {
        error(`Error al insertar dominio: ${e}`);
        return false;
    }
}

export async function deleteSite(site: string): Promise<boolean> {
    try {
        const pool = await getPool();
        await pool.query("DELETE FROM domains WHERE site = ?", [site]);
        delete sites[site];
        return true;
    } catch (e) {
        error(`Error al eliminar dominio: ${e}`);
        return false;
    }
}

export async function listDomains(interaccion: ChatInputCommandInteraction): Promise<void> {
    try {
        const fields: { name: string, value: string, inline: boolean }[] = [];
        if (!sitesCache || Object.keys(sites).length === 0) {
            await interaccion.editReply("No hay lista de dominios disponible");
        }
        for (const [site, domains] of Object.entries(sites)) {
            const dF = domains.split("|").map(d => `🔗 ${d}`).join("\n");
            fields.push({ name: `Sitio: ${site}`, value: `RawDominios:\n > ${domains}` + "\n" + dF, inline: false });
        }

        const emb = new EmbedBuilder()
            .setTitle("Lista de Dominios")
            .addFields(fields)
            .setColor(0x000000);

        await interaccion.editReply({ embeds: [emb] });


    } catch (e) {
        await interaccion.editReply("Hubo un problema al obtener la lista de dominios");
        error(`Error al obtener la lista de dominios: ${e}`);
    }
}

export async function editDomain(s: string, d: string): Promise<boolean> {
    try {
        const pool = await getPool();
        const [update]: any = await pool.query("SELECT site, domains FROM domains WHERE site = ?", [s]);
        if (!update || update.length === 0) { error("No existe el sitio!!"); return false; }
        const x = update[0];
        const newDomains = `${d}|${x.domains}`;
        await pool.query("UPDATE domains SET domains = ? WHERE site = ?", [newDomains, s]);
        delete sites[s];
        sites[s] = newDomains;
        urlStatusManager.runChecks();
        return true;
    } catch (e) {
        error(`Error al editar dominio: ${e}`);
        return false;
    }
}

export async function deletLast(s: string): Promise<boolean> {
    try {
        const pool = await getPool();
        const [dLast]: any = await pool.query("SELECT site, domains FROM domains WHERE site = ?", [s]);
        if (!dLast || dLast.length === 0) { error("No existe el sitio!!"); return false; }
        const Y = dLast[0];
        const X = Y.domains;
        const Z = X.split("|").slice(1).join("|");
        if (Z !== "") {
            await pool.query("UPDATE domains SET domains = ? WHERE site = ?", [Z, s]);
            delete sites[s];
            sites[s] = Z;
            urlStatusManager.runChecks();
            return true;
        } else {
            await pool.query("DELETE FROM domains WHERE site = ?", [s]);
            delete sites[s];
            urlStatusManager.runChecks();
            return true;
        }
    } catch { return false; }
}

/* ================================================ Cheker de dominios ================================================ */
class UrlStatusManager {
    private activeUrls: Map<string, string> = new Map();
    private readonly CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos

    public start() {
        info("🌐 Iniciando servicio de verificación de dominios...");
        this.runChecks(); // Esto poblará activeUrls en la primera pasada
        setInterval(() => this.runChecks(), this.CHECK_INTERVAL);
    }

    public async runChecks() {
        const targets = [
            ...replacementMetaList.map(map => ({ name: map.name, dbKey: map.dbKey })),
            { name: "Api", dbKey: "Api" }
        ];

        for (const meta of targets) {
            const rawString = sites[meta.dbKey];

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
                error(`⚠️ [${meta.name}] Todos los dominios están caídos. Usando default: ${candidates[0]}`);
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
            debug(`[DomainCheck] Error crítico verificando ${domain}: ${e}`);
            return false;
        }
    }

    public getActiveUrl(dbKey: string): string | null {
        return this.activeUrls.get(dbKey) || null;
    }
}

const urlStatusManager = new UrlStatusManager();
export default urlStatusManager;