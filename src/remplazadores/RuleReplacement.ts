import { debug } from "../logging";

export default class Ruler {
  protected newDomain: string;
  protected matchRegex: RegExp;
  protected replaceRegex: RegExp;
  protected stripQueryString: boolean;

  /**
   * @param newDomain - Sitio sustitutor.
   * @param matchRegex - Filtro Rgex para encontrar URLs en el mensaje.
   * @param replaceRegex - Parte que reemplaza en la URL.
   * @param stripQueryString - Descartes.
   */
  
  constructor(
    newDomain: string,
    matchRegex: RegExp,
    replaceRegex: RegExp,
    stripQueryString: boolean = true,
  ) {
    this.newDomain = newDomain;
    this.matchRegex = matchRegex;
    this.replaceRegex = replaceRegex;
    this.stripQueryString = stripQueryString;
  }

  /**
   * @param messageContent - Mensaje original de Discord
   * @returns La URL de reemplazo o null si falla.
   */
  protected getURLs: (messageContent: string) => RegExpMatchArray | null = (messageContent) => {
    return messageContent.match(this.matchRegex);
  };

  /**
   * @param messageContent Mensaje original de Discord.
   * @param domainFilter Filtro de dominios.
   * @returns La URL de reemplazo o null si falla.
   */

  public replaceURLs: (messageContent: string, domainFilter?: string) => string | null = (
    messageContent,
    domainFilter?,
  ) => {
    const urls = this.getURLs(messageContent)?.filter((url) => {
      return domainFilter ? url.includes(domainFilter) : url;
    });

    if (urls === undefined || urls.length < 1) {
      return null;
    }

    return urls
      .map((url) => {
        let c = url.replace(this.replaceRegex, `${this.newDomain}/`);

        if (this.stripQueryString) {
          c = c.replace(/\?\w+=.*$/gm, "");
        }

        if (process.env.DEBUG_MODE) {
          debug(`replaceURLs()\t${url}\t${c}`, this.constructor.name);
        }

        return c;
      })
      .join("\n");
  };
}
