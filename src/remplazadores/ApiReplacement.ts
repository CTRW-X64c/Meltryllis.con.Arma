// src/remplazadores/ApiReplacement.ts
import { debug, error } from "../logging";
//import type { Response } from "node-fetch";

// Definimos una interfaz para el tipo de datos que esperamos de la API
interface EmbedezApiResponse {
    success: boolean;
    data: {
        shareUrl: string;
        // Puedes añadir más campos si los necesitas, como 'type', 'key', etc.
    };
    error?: string; // El error es opcional
}

export default class ApiReplacement {
    /**
     * Llama a la API de embedez.com para obtener un embed.
     * @param originalUrl La URL que el bot necesita verificar.
     * @returns La URL de reemplazo de la API o null si falla.
     */
    public async getEmbedUrl(originalUrl: string): Promise<string | null> {
        try {
            // Importación dinámica de node-fetch
            const fetch = (await import('node-fetch')).default;

            const encodedUrl = encodeURIComponent(originalUrl);
            const apiUrl = `https://embedez.com/api/v1/providers/combined?q=${encodedUrl}`;

            const response = await fetch(apiUrl);
            
            // Verificamos si la respuesta es exitosa antes de procesar el JSON
            if (!response.ok) {
                const responseError = await response.text();
                debug(`API de Embedez devolvió un estado no exitoso: ${response.status} - ${responseError}`, "ApiReplacement");
                return null;
            }

            // Aserción de tipo para indicarle a TypeScript la estructura de los datos
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