import { Message, EmbedBuilder, AttachmentBuilder } from "discord.js"
import { debug } from "../logging"
import { apiEmbedez } from "./Apis/embedez"
import { apiPixivCustom } from "./Apis/PixivAPI"
import { fakeApiFB } from "./Apis/fbFakeApi"
import { xTwitterCustom } from "./Apis/Alttwitter"

export interface contPack { [key: string]: { content?: string, embeds?: EmbedBuilder[], files?: AttachmentBuilder[] } }
export interface pResult {
    ok: boolean;
    fix?: string;
    pack?: contPack[]
}

export interface ApiHandler {
    name: string;
    isAvailable(): boolean;
    isDomain(domain: string): boolean;
    guildChk(domain: string, guildId: string, guildConfigs: Map<string, any>): Promise<boolean>;
    process(url: string, message?: Message): Promise<pResult>;
}

// =========== Registro de APIs =========== //
const apiHandlers: ApiHandler[] = [
    new apiEmbedez(),
    new apiPixivCustom(),
    new fakeApiFB(),
    new xTwitterCustom()
];

// =========== Procesador principal =========== //
interface urlData { oURL: string, domain: string, guild: string, gConf: Map<string, any>, remp: Record<string, any>, msg?: Message }
export async function urlProcess(dta: urlData): Promise<pResult> {
    for (const apiHandler of apiHandlers) {
        if (!apiHandler.isAvailable()) continue;
        if (!apiHandler.isDomain(dta.domain)) continue;

        const shouldUse = await apiHandler.guildChk(dta.domain, dta.guild, dta.gConf);
        if (!shouldUse) continue;

        try {
            const apiResult = await apiHandler.process(dta.oURL, dta.msg);
            if (apiResult.ok === true) return apiResult;
        } catch (err) {
            debug(`Error crítico en API ${apiHandler.name}: ${(err as Error).message}`, "Events.MessageCreate");
        }
    }

    for (const [key, replaceFunc] of Object.entries(dta.remp)) {
        const manualDomainConfig = dta.gConf.get(key);
        if (manualDomainConfig && manualDomainConfig.enabled === false) continue;

        if (new RegExp(key).test(dta.oURL)) {
            const result = (replaceFunc as any)(dta.oURL.replace(/\|/g, ""));
            if (result) {
                debug(`Se usó el reemplazador local: ${key}`, "Events.MessageCreate");
                return { fix: result, ok: true };
            }
        }
    }
    return { ok: false };
}