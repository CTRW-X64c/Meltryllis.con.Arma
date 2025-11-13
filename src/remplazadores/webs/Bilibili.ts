// src/remplazadores/Bilbili.ts
import Ruler from "../RuleReplacement";
import { debug } from "../../sys/logging";

export default class Bilibili extends Ruler {
  constructor(newDomain: string) {
    super(
      newDomain,
      /https?:\/\/(?:www\.)?bilibili\.com\/(?:video\/|list\/[\w-]+\/?(?:\?.*&bvid=))(BV[\w]+)/g,
      /(www\.)?bilibili\.com\//g,
      false, 
    );
  }

  public replaceURLs: (messageContent: string, domainFilter?: string) => string | null = (
    messageContent,
  ) => {
    const matches = [...messageContent.matchAll(this.matchRegex)];
    if (matches === undefined || matches.length < 1) {
      return null;
    }

    return matches
      .map((match) => {
        const videoId = match[1];        
        const newUrl = `https://${this.newDomain}/video/${videoId}`;
        if (process.env.DEBUG_MODE) {
          debug(`replaceURLs()\t${match[0]}\t${newUrl}`, this.constructor.name);
        }
        return newUrl;
      })
      .join("\n");
  };
}