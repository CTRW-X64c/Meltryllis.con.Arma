import { ApiHandler, pResult } from "../embedingSwitch";
import urlStatusManager from "../domainChecker";
import { error, debug } from "../../logging";

export class fakeApiFB implements ApiHandler {
    name = "FacebookFakeApi";

    cDom: string | null = null;
    isAvailable(): boolean { return true; }
    isDomain(domain: string): boolean { return /(^|:\/\/|\.)(facebook|fb)\.com/.test(domain); }
    async guildChk(domain: string, guildId: string | null, guildConfigs: Map<string, any>): Promise<boolean> {
        if (!domain) return false;
        const dta = guildConfigs.get("Facebook");
        if (dta) {
            if (dta.enabled === false) {
                debug(`El uso de Facebook fix está deshabilitado en este gremio: ${guildId}`, "ApiReplacement");
                return false;
            }
            this.cDom = dta?.custom_url ?? null;
        }
        return true;
    }

    async process(url: string): Promise<pResult> {
        try {
            if (!url.includes("/share/")) { return { ok: false }; }
            let fbDom = this.cDom || urlStatusManager.getActiveUrl("facebook");
            if (!fbDom) return { ok: false };
            fbDom = fbDom.replace(/^https?:\/\//, '');
            const response = await fetch(url, {
                method: 'GET',
                redirect: 'follow',
                headers: {
                    'User-Agent': 'facebookexternalhit/1.1'
                }
            });
            let nURL = response.url;
            if (nURL.includes('/share/')) {
                const html = await response.text();
                const metaMatch = html.match(/<meta property="og:url" content="([^"]+)"/i);
                if (metaMatch && metaMatch[1]) {
                    nURL = metaMatch[1].replace(/&amp;/g, '&');
                }
            }

            const parsedUrl = new URL(nURL);
            if (parsedUrl.pathname.includes('/share/')) return { ok: false };

            let fURL = `${parsedUrl.pathname}`;
            const usefulParams = new URLSearchParams();
            if (parsedUrl.searchParams.has('story_fbid')) usefulParams.append('story_fbid', parsedUrl.searchParams.get('story_fbid') as string);
            if (parsedUrl.searchParams.has('id')) usefulParams.append('id', parsedUrl.searchParams.get('id') as string);
            if (parsedUrl.searchParams.has('v')) usefulParams.append('v', parsedUrl.searchParams.get('v') as string);

            const queryString = usefulParams.toString();
            if (queryString) fURL += `?${queryString}`;

            const outURL = `https://${fbDom}${fURL}`;
            return { ok: true, fix: outURL };
        } catch (err) {
            error(`[${this.name}] Error procesando link: ${err}`);
            return { ok: false };
        }
    }
}