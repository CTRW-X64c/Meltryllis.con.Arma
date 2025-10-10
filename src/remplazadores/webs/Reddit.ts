// src/remplazadores/Reddit.ts
import { debug } from "../../logging";
import Ruler from "../RuleReplacement";

export default class Reddit extends Ruler {
  constructor(newDomain: string) {
    super(
      newDomain,
      /https?:\/\/(redd.it|(\w+\.)?reddit.com\/(r|u|user)\/\w+\/(s|comments))\/[^\s#]*(#.*)?/gi,
      /(((\w+\.)?reddit\.com)|(redd\.it))\//gi,
      true,
    );
  }

  public replaceURLs: (messageContent: string, domainFilter?: string) => string | null = (
    messageContent,
    domainFilter,
  ) => {
    const urls = this.getURLs(messageContent)?.filter((url) => {
      return domainFilter ? url.includes(domainFilter) : true;
    });

    if (!urls || urls.length < 1) {
      return null;
    }

    return urls
      .map((url) => {
        let cleanUrl = url.replace(/#.*$/, "");
        let replacedUrl = cleanUrl.replace(this.replaceRegex, `${this.newDomain}/`);
        if (this.stripQueryString) {
          replacedUrl = replacedUrl.replace(/\?\w+=.*$/gm, "");
        }
        if (process.env.DEBUG_MODE) {
          debug(`replaceURLs()\t${url}\t${replacedUrl}`, this.constructor.name);
        }
        return replacedUrl;
      })
      .join("\n");
  };
}