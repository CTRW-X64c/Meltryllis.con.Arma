// src/sys/embeding/index.ts
import { rMetaList } from "./embedingConfig";
import urlStatusManager from "./domainChecker";

export default class localEmb {
  public static getParam(guildConfig: Map<string, { custom_url: string | null; enabled: boolean }>) {
    const replacers = new Map<string, { replaceURLs: (content: string) => string | null }>();
    for (const meta of rMetaList) {
      const config = guildConfig.get(meta.name) ?? { enabled: true, custom_url: null };
      if (!config.enabled) continue;

      const url = config.custom_url ?? urlStatusManager.getActiveUrl(meta.dbKey);
      if (!url) continue;

      const instance = new meta.Class(url as string);
      if (instance) replacers.set(meta.name, instance);
    }
    return this.testRgx(replacers);
  }

  private static testRgx(replacers: Map<string, { replaceURLs: (content: string) => string | null }>) {
    const replacements: { [key: string]: (messageContent: string) => string | null } = {};
    for (const meta of rMetaList) {
      const instance = replacers.get(meta.name);
      if (!instance) continue;
      replacements[meta.regexKeys] = (messageContent: string) => { return instance.replaceURLs(messageContent) };
    }
    return replacements;
  }
}
