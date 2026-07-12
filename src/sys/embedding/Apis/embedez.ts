// src/sys/embedding/Apis/embedez.ts
import { debug, error } from "../../logging";
import urlStatusManager, { embedezNSFW, embedezSFW } from "../domainChecker";
import { ApiHandler } from "../embedingSwitch";

// ================================= APi: Embedez ================================= //
export class apiEmbedez implements ApiHandler {
    name = "Embedez";

    isAvailable(): boolean {
        const apiUrl = urlStatusManager.getActiveUrl("Api");
        return apiUrl !== null && apiUrl.includes("embedez.com");
    }

    isDomain(domain: string): boolean {
        if (!domain) return false;
        return embedezSFW.some(d => domain.endsWith(d)) || embedezNSFW.some(d => domain.endsWith(d));
    }

    async guildChk(domain: string, guildId: string | null, guildConfigs: Map<string, any>): Promise<boolean> {
        if (!domain) return false;
        const matchingDomain = embedezSFW.find(d => domain.endsWith(d)) || embedezNSFW.find(d => domain.endsWith(d));
        if (!matchingDomain) return false;

        const apiDomainConfig = guildConfigs.get(matchingDomain);
        if (apiDomainConfig && apiDomainConfig.enabled === false) {
            debug(`El uso del API EmbedEz está deshabilitado para el dominio: ${matchingDomain} en el gremio: ${guildId}`, "Events.MessageCreate");
            return false;
        } return true;
    }

    async process(originalUrl: string): Promise<{ fix: string | null, ok: boolean }> {
        const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        interface embedezApi { success: boolean; shareUrl?: string; }
        const MAX_ATTEMPTS = 2;

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                const encodedUrl = encodeURIComponent(originalUrl);
                const apiUrl = `https://embedez.com/api/v1/providers/combined?q=${encodedUrl}`;
                const response = await fetch(apiUrl);

                if (!response.ok) {
                    const responseError = await response.text();
                    debug(`[Intento ${attempt}/${MAX_ATTEMPTS}] API de Embedez devolvió estado: ${response.status} - ${responseError}`, "ApiReplacement");
                    if (attempt === MAX_ATTEMPTS) return { fix: null, ok: false };
                    await wait(1000);
                    continue;
                }

                const data = (await response.json()) as embedezApi;
                if (!data?.success) {
                    debug(`API de Embedez falló para la URL: ${originalUrl}. Respuesta: ${JSON.stringify(data)}`, "ApiReplacement");
                    return { fix: null, ok: false };
                }

                debug(`API de Embedez exitosa: ${originalUrl} -> https://embedez.com/download?q=${originalUrl}`, "ApiReplacement");
                return { fix: `https://embedez.com/download?q=${originalUrl}`, ok: true };

            } catch (err) {
                error(`[Intento ${attempt}/${MAX_ATTEMPTS}] Error de red al llamar a la API de Embedez para ${originalUrl}: ${err}`, "ApiReplacement");
                if (attempt === MAX_ATTEMPTS) return { fix: null, ok: false };
                await wait(1000);
            }
        } return { fix: null, ok: false };
    }
}