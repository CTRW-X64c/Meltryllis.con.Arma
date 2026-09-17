// src/sys/zGears/newAux.ts
import axios from 'axios';
import { debug, info, warn } from "../logging";
import { Agent } from 'https';

export let Proxy: Agent | undefined = undefined;
let proxyStatus = false;
const proxCheck = new Map<string, NodeJS.Timeout>();

async function chkProxy(proxyUrl: string) {
    let ctrlStatus: boolean;
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

        if (response.status !== 200) { throw new Error(`HTTP ${response.status}`); }

        Proxy = agent;
        ctrlStatus = true;

    } catch (e: any) {
        Proxy = undefined;
        ctrlStatus = false;
        debug(`❌ Proxy: Falló el check: ${e.message}`, "AUXILIAR");
    }

    if (proxyStatus !== ctrlStatus) {
        warn(`⚠️ CAMBIO EL ESTADO DEL PROXY A: ${ctrlStatus ? "✅ ACTIVO" : "❌ INACTIVO"}`, "AUXILIAR");
        proxyStatus = ctrlStatus;
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
