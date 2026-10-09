// src/sys/embedding/Apis/reddita.ts
import { Message } from "discord.js";
import { ApiHandler, pResult } from "../embedingSwitch";
import { RedditApiClient } from "../../zGears/RedditApi";

// ================================= APi: Reddit Meltrys ================================= //

export class redditMeltrys extends RedditApiClient implements ApiHandler {
    name = "redditMeltrys";

    isAvailable(): boolean { return true; }
    isDomain(domain: string): boolean { return /(^|:\/\/|\.)(reddit.com|redd.it)/.test(domain); }
    async guildChk(domain: string, guildConfigs: Map<string, any>): Promise<boolean> {
        if (!domain) return false;
        const aDom = "Meltrys.Reddit", albe = guildConfigs.get(aDom);
        if (!albe || (albe && albe.enabled === false)) return false;
        return true;
    }

    public async process(url: string, message?: Message, isSpoiler?: boolean): Promise<pResult> {
        console.log(url)
        console.log(message?.id)
        console.log(isSpoiler)

        return { ok: false }
    }
}