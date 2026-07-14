import { ApiHandler } from "../embedingSwitch";
import urlStatusManager from "../domainChecker";
import { error } from "../../logging";

export class fakeApiFB implements ApiHandler {
    name = "FacebookFakeApi";

    isAvailable(): boolean { return true; }
    isDomain(domain: string): boolean { return domain.includes("facebook.com"); }
    async guildChk(): Promise<boolean> { return true; }
    async process(url: string): Promise<{ fix: string | null, ok: boolean }> {
        try {
            if (!url.includes("/share/")) { return { fix: null, ok: false }; }
            let fbDomand = urlStatusManager.getActiveUrl("Facebook") || "facebed.com";
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