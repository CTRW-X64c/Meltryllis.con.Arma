// src/sys/embeding/ApiReplacement.ts
import { debug, error } from "../../sys/logging";

interface EmbedezApiResponse {
    success: boolean;
    data: {
        shareUrl: string;        
    };
    error?: string; 
}

export default class ApiReplacement {
    /**
     * Llama a la API de embedez.com para obtener un embed.
     * @param originalUrl La URL que el bot necesita verificar.
     * @returns La URL de reemplazo de la API o null si falla.
     */
    public async getEmbedUrl(originalUrl: string): Promise<string | null> {
        try {
            const fetch = (await import('node-fetch')).default;

            const encodedUrl = encodeURIComponent(originalUrl);
            const apiUrl = `https://embedez.com/api/v1/providers/combined?q=${encodedUrl}`;
            const response = await fetch(apiUrl);           
            if (!response.ok) {
                const responseError = await response.text();
                debug(`API de Embedez devolvió un estado no exitoso: ${response.status} - ${responseError}`, "ApiReplacement");
                return null;
            }

            const data = (await response.json()) as EmbedezApiResponse;
            if (data.success && data.data && data.data.shareUrl) {
                debug(`API de Embedez exitosa: ${originalUrl} -> ${data.data.shareUrl}`, "ApiReplacement");
                return data.data.shareUrl;
            } else {
                debug(`API de Embedez falló para la URL: ${originalUrl}. Respuesta: ${JSON.stringify(data)}`, "ApiReplacement");
                return null;
            }
        } catch (err) {
            error(`Error al llamar a la API de Embedez para ${originalUrl}: ${err}`, "ApiReplacement");
            return null;
        }
    }
}