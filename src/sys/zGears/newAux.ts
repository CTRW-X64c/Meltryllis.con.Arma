// src/sys/zGears/newAux.ts
import axios from 'axios';
import { debug, info } from "../logging";
import { Agent } from 'https';

export let Proxy: Agent | undefined = undefined;
const proxCheck = new Map<string, NodeJS.Timeout>();

async function chkProxy(proxyUrl: string) {
    try {
        const { HttpsProxyAgent } = await import('https-proxy-agent');
        const agent = new HttpsProxyAgent(proxyUrl);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const response = await axios.get('https://cloudflare.com/cdn-cgi/trace', {
            httpAgent: agent,
            httpsAgent: agent,
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status !== 200) {
            throw new Error(`HTTP ${response.status}`);
        }

        Proxy = agent;
        debug(`✅ Sistema de Proxy: ${proxyUrl} Pass check!`, "AUXILIAR");
    } catch (e: any) {
        debug(`❌ Sistema de Proxy: Falló el check: ${e.message}`, "AUXILIAR");
        Proxy = undefined;
    }
}

export function startProxyChecker() {
    const proxyUrl = process.env.PROXY;
    if (!proxyUrl) {
        Proxy = undefined;
        info("❌ Sistema de Proxy: No asignado!");
        return;
    }

    try { new URL(proxyUrl); } catch {
        Proxy = undefined;
        info("❌ Sistema de Proxy: Bad URL!");
        return;
    }

    chkProxy(proxyUrl);

    const intervalId = setInterval(() => chkProxy(proxyUrl), 1_000 * 60 * 5);
    if (intervalId.unref) intervalId.unref();
    proxCheck.set('checkProxy', intervalId);
    info(`✅ Sistema de Proxy: ${proxyUrl} Iniciado!`);
}


export async function axiCall(url: string): Promise<Response | undefined> {
    let getData: Response
    try {
        getData = await axios.get(url, {
            httpAgent: Proxy,
            httpsAgent: Proxy,
        });
        if (getData.status !== 200 || !getData.ok) return undefined;
    } catch (e) {
        return undefined;
    }
    return getData;
}
