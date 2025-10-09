// src/remplazadores/BilibiliReplacement.ts
import BaseReplacement from "../BaseReplacement";
import { debug } from "../../logging";

export default class BilibiliReplacement extends BaseReplacement {
  constructor(newDomain: string) {
    // La clase BaseReplacement espera tres expresiones regulares,
    // pero como vamos a anular la lógica de reemplazo,
    // podemos pasar una expresión regular de reemplazo dummy.
    super(
      newDomain,
      // Expresión regular unificada para capturar el ID de video (BV...)
      /https?:\/\/(?:www\.)?bilibili\.com\/(?:video\/|list\/[\w-]+\/?(?:\?.*&bvid=))(BV[\w]+)/g,
      // Expresión regular de reemplazo dummy (no se usará)
      /(www\.)?bilibili\.com\//g,
      false, // Deshabilita el "stripQueryString" de la clase base
    );
  }

  /**
   * Anula el método replaceURLs de la clase base.
   * Busca los enlaces de Bilibili y los reemplaza con el formato correcto,
   * extrayendo el ID del video de la URL original.
   */
  public replaceURLs: (messageContent: string, domainFilter?: string) => string | null = (
    messageContent,
//    domainFilter?,
  ) => {
    // Usa matchAll() para obtener un iterador de todas las coincidencias
    // incluyendo los grupos de captura.
    const matches = [...messageContent.matchAll(this.matchRegex)];

    // Si no hay coincidencias, retorna null.
    if (matches === undefined || matches.length < 1) {
      return null;
    }

    return matches
      .map((match) => {
        // match[0] es la coincidencia completa, match[1] es el primer grupo de captura.
        const videoId = match[1];
        
        // Construye la nueva URL con el formato que deseas.
        const newUrl = `https://${this.newDomain}/video/${videoId}`;

        if (process.env.DEBUG_MODE) {
          debug(`replaceURLs()\t${match[0]}\t${newUrl}`, this.constructor.name);
        }

        return newUrl;
      })
      .join("\n");
  };
}