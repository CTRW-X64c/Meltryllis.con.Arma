import { debug } from "../logging";
import { embedezAPI } from "./ApiReplacement";
import urlStatusManager, { embedezNSFW, embedezSFW } from "./domainChecker";

interface ApiHandler {
    name: string;
    isAvailable(): boolean;
    isDommain(domain: string): boolean;
    guildChk(domain: string, guildId: string | null, guildReplacementConfig: Map<string, any>): Promise<boolean>;
    process(url: string, domain: string, guildId?: string | null, guildReplacementConfig?: Map<string, any>): Promise<string | null>;
}

// =========== Embedez Api =========== //
class apiEmbedez implements ApiHandler {
    name = "EmbedEzAPI";
    private apiReplacer = new embedezAPI();

    isAvailable(): boolean {
        const apiUrl = urlStatusManager.getActiveUrl("Api");
        return apiUrl !== null && apiUrl.includes("embedez.com");
    }

    isDommain(domain: string): boolean {
        if (!domain) return false;
        return embedezSFW.some(d => domain.endsWith(d)) || embedezNSFW.some(d => domain.endsWith(d));
    }

    async guildChk(domain: string, guildId: string | null, guildReplacementConfig: Map<string, any>): Promise<boolean> {
        if (!domain) return false;
        const matchingDomain = embedezSFW.find(d => domain.endsWith(d)) || embedezNSFW.find(d => domain.endsWith(d));
        if (!matchingDomain) return false;

        const apiDomainConfig = guildReplacementConfig.get(matchingDomain);
        if (apiDomainConfig && apiDomainConfig.enabled === false) {
            debug(`El uso del API EmbedEz esta deshabilitado para el dominio: ${matchingDomain} en el gremio: ${guildId}`, "Events.MessageCreate");
            return false;
        }
        return true;
    }
    async process(url: string, domain: string): Promise<string | null> {
        const result = await this.apiReplacer.getEmbedUrl(url);
        if (result) {
            debug(`Sitio: ${domain} ha sido procesado por EmbedEzApi`, "Events.MessageCreate");
        }
        return result;
    }
}

// =========== Espacio para nuevas Apis =========== //

// =========== Registro de APIs =========== //
const apiHandlers: ApiHandler[] = [
    new apiEmbedez(),
];

// =========== Procesador principal de URLs =========== //
export async function urlProsses(originalUrl: string, domainSite: string, guildId: string | null, guildReplacementConfig: Map<string, any>, replacements: Record<string, any>): Promise<string | null> {
    for (const apiHandler of apiHandlers) {
        if (!apiHandler.isAvailable()) continue;
        if (!apiHandler.isDommain(domainSite)) continue;

        const shouldUse = await apiHandler.guildChk(domainSite, guildId, guildReplacementConfig);
        if (!shouldUse) continue;

        try {
            const apiResult = await apiHandler.process(originalUrl, domainSite, guildId, guildReplacementConfig);
            if (apiResult) {
                return apiResult;
            }
        } catch (err) {
            debug(`Error crítico en API ${apiHandler.name}: ${(err as Error).message}`, "Events.MessageCreate");
        }
    }

    // 2. Fase de Reemplazos Locales (Fallback)
    for (const [key, replaceFunc] of Object.entries(replacements)) {
        const manualDomainConfig = guildReplacementConfig.get(key);
        if (manualDomainConfig && manualDomainConfig.enabled === false) {
            continue;
        }

        if (new RegExp(key).test(originalUrl)) {
            const result = (replaceFunc as any)(originalUrl.replace(/\|/g, ""));
            if (result) {
                debug(`Se usó el reemplazador local: ${key}`, "Events.MessageCreate");
                return result;
            }
        }
    }

    return null;
}