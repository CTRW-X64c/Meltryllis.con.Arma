// src/sys/embeding/webs/Pixiv.ts
import Ruler from "../RuleReplacement";

export default class Pixiv extends Ruler {
  constructor(newDomain: string) {
    super(
      newDomain,
      /https?:\/\/(\w+\.)?pixiv\.net\/(\w+\/)?(artworks|member_illust\.php)(\/|\?illust_id=)\d+(\/?\d+)?[^\s]+/g,
      /(\w+\.)?(pixiv\.net\/)/,
      false,
    );

    const originalReplace = this.replaceURLs;
    this.replaceURLs = (messageContent: string, domainFilter?: string) => {
      const replaced = originalReplace(messageContent, domainFilter);
      if (!replaced) return null;

      return replaced
        .split("\n")
        .map((url) => /\/\d+\/\d+(-\d+)?$/.test(url) ? url : `${url}/1-4`)
        .join("\n");
    };
  }
}
