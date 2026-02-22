// src/sys/embeding/ApiReplacement.ts
import { debug, error } from "../../sys/logging";

interface EmbedezApiResponse {
    success: boolean;
    shareUrl?: string;
}

export default class ApiReplacement {
    /**
     * Llama a la API de embedez.com para obtener un embed.
     * @param originalUrl La URL que el bot necesita verificar.
     * @returns La URL de reemplazo de la API o null si falla.
     */

    public async getEmbedUrl(originalUrl: string): Promise<string | null> {
        const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        const MAX_ATTEMPTS = 2; /* # de intentos, por si falla la conexion o no constesta */
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                const fetch = (await import('node-fetch')).default;

                const encodedUrl = encodeURIComponent(originalUrl);
                const apiUrl = `https://embedez.com/api/v1/providers/combined?q=${encodedUrl}`;
                const response = await fetch(apiUrl);           
                
                if (!response.ok) {
                    const responseError = await response.text();
                    debug(`[Intento ${attempt}/${MAX_ATTEMPTS}] API de Embedez devolvió un estado no exitoso: ${response.status} - ${responseError}`, "ApiReplacement");
                    
                    if (attempt === MAX_ATTEMPTS) return null;

                    await wait(1000); // Esperamos 1 segundo antes de volver a intentar
                    continue; 
                }

                const data = (await response.json()) as EmbedezApiResponse;
                if (!data?.success) {
                debug(`API de Embedez falló para la URL: ${originalUrl}. Respuesta: ${JSON.stringify(data)}`, "ApiReplacement");
                return null; 
                }

                if (data.success) {
                debug(`API de Embedez exitosa: ${originalUrl} -> https://embedez.com/download?q=${originalUrl}`, "ApiReplacement");
                return `https://embedez.com/download?q=${originalUrl}`;
                }

            } catch (err) {
            error(`[Intento ${attempt}/${MAX_ATTEMPTS}] Error de red al llamar a la API de Embedez para ${originalUrl}: ${err}`, "ApiReplacement");
            if (attempt === MAX_ATTEMPTS) return null;
            await wait(1000);
            }
        }
        return null; 
    }
}