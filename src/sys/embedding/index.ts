// src/sys/embeding/index.ts
import { replacementMetaList } from "./EmbedingConfig";
import urlStatusManager from "./domainChecker"; 

export default function buildReplacements(guildConfig: Map<string, { custom_url: string | null; enabled: boolean }>): {
  [identifier: string]: (messageContent: string) => string | null;
} {

  const replacers = new Map<string, { replaceURLs: (content: string, base?: string) => string | null }>();

  for (const meta of replacementMetaList) {
    const config = guildConfig.get(meta.name) || { enabled: true, custom_url: null };
    if (!config.enabled) continue;

    if (meta.dependsOn) {
      const depConfig = guildConfig.get(meta.dependsOn) || { enabled: true, custom_url: null };
      if (!depConfig.enabled) continue;

      const depUrl = depConfig.custom_url || urlStatusManager.getActiveUrl(meta.envVar);
      
      if (!depUrl) continue;
    }

    const url = config.custom_url || urlStatusManager.getActiveUrl(meta.envVar);

    if (meta.takesUrl && !url) continue;

    const instance = meta.takesUrl ? new meta.Class(url as string) : new meta.Class();
    replacers.set(meta.name, instance);
  }

  const replacements: { [key: string]: (messageContent: string) => string | null } = {};

  for (const meta of replacementMetaList) {
    const instance = replacers.get(meta.name);
    if (!instance) continue;

    for (const key of meta.regexKeys) {
      replacements[key] = (messageContent: string) => {
        if (meta.dependsOn) {
           const depConfig = guildConfig.get(meta.dependsOn);
           const depUrl = depConfig?.custom_url || urlStatusManager.getActiveUrl(meta.envVar);               
           return instance.replaceURLs(messageContent, depUrl || undefined);
        }
        return instance.replaceURLs(messageContent);
      };
    }
  }

  return replacements;
}