// src/sys/embedding/embedingSwitch.ts
import { Message } from "discord.js";
import { debug } from "../logging";
import { apiEmbedez } from "./Apis/embedez"
import { apiPixivCustom } from "./Apis/pixivAPI"
import { fakeApiFB } from "./Apis/fbFakeApi";

export interface ApiHandler {
    name: string;
    isAvailable(): boolean;
    isDomain(domain: string): boolean;
    guildChk(domain: string, guildId: string, guildConfigs: Map<string, any>): Promise<boolean>;
    process(url: string, message?: Message): Promise<{ fix: string | null, ok: boolean }>;
}

// =========== Registro de APIs =========== //
const apiHandlers: ApiHandler[] = [
    new apiEmbedez(),
    new apiPixivCustom(),
    new fakeApiFB(),
];

// =========== Procesador principal =========== //
export async function urlProcess(originalUrl: string, domainSite: string, guildId: string, guildConfigs: Map<string, any>, replacements: Record<string, any>, message?: Message): Promise<string | null> {
    for (const apiHandler of apiHandlers) {
        if (!apiHandler.isAvailable()) continue;
        if (!apiHandler.isDomain(domainSite)) continue;

        const shouldUse = await apiHandler.guildChk(domainSite, guildId, guildConfigs);
        if (!shouldUse) continue;

        try {
            const apiResult = await apiHandler.process(originalUrl, message);
            if (apiResult.ok === true) return apiResult.fix;
        } catch (err) {
            debug(`Error crítico en API ${apiHandler.name}: ${(err as Error).message}`, "Events.MessageCreate");
        }
    }

    for (const [key, replaceFunc] of Object.entries(replacements)) {
        const manualDomainConfig = guildConfigs.get(key);
        if (manualDomainConfig && manualDomainConfig.enabled === false) continue;

        if (new RegExp(key).test(originalUrl)) {
            const result = (replaceFunc as any)(originalUrl.replace(/\|/g, ""));
            if (result) {
                debug(`Se usó el reemplazador local: ${key}`, "Events.MessageCreate");
                return result
            }
        }
    } return null
}