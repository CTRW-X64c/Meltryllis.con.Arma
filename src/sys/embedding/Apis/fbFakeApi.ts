import { ApiHandler } from "../embedingSwitch";
import urlStatusManager from "../domainChecker";
import { error, debug } from "../../logging";

export class fakeApiFB implements ApiHandler {
    name = "FacebookFakeApi";

    customDomain: string | null = null;
    isAvailable(): boolean { return true; }
    isDomain(domain: string): boolean { return domain.includes("facebook.com"); }
    async guildChk(domain: string, guildId: string | null, guildConfigs: Map<string, any>): Promise<boolean> {
        if (!domain) return false;
        const fbChk = guildConfigs.get("Facebook");
        if (fbChk) {
            if (fbChk.enabled === false) {
                debug(`El uso de Facebook fix está deshabilitado en este gremio: ${guildId}`, "ApiReplacement");
                return false;
            }
            if (fbChk.customDomain) this.customDomain = fbChk.customDomain;
            return true;
        }
        return true;
    }
    async process(url: string): Promise<{ fix: string | null, ok: boolean }> {
        try {
            if (!url.includes("/share/")) { return { fix: null, ok: false }; }
            let fbDomand = this.customDomain ? this.customDomain : urlStatusManager.getActiveUrl("Facebook");
            if (!fbDomand) return { fix: null, ok: false };
            fbDomand = fbDomand.replace(/^https?:\/\//, '');
            const response = await fetch(url, {
                method: 'GET',
                redirect: 'follow',
                headers: {
                    'User-Agent': 'facebookexternalhit/1.1'
                }
            });

            let finalUrl = response.url;
            if (finalUrl.includes('/share/')) {
                const html = await response.text();
                const metaMatch = html.match(/<meta property="og:url" content="([^"]+)"/i);
                if (metaMatch && metaMatch[1]) {
                    finalUrl = metaMatch[1].replace(/&amp;/g, '&');
                }
            }

            const parsedUrl = new URL(finalUrl);
            if (parsedUrl.pathname.includes('/share/')) return { fix: null, ok: false };

            const solveLink = `${parsedUrl.pathname}`;
            const outURL = `https://${fbDomand}${solveLink}`;
            return { fix: outURL, ok: true };
        } catch (err) {
            error(`[${this.name}] Error procesando link: ${err}`);
            return { fix: null, ok: false };
        }
    }
}