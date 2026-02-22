import { info, error, debug } from "../logging";
import { replacementMetaList } from "./EmbedingConfig"; 

class UrlStatusManager {
    private activeUrls: Map<string, string> = new Map();
    private readonly CHECK_INTERVAL = 5 * 60 * 1000; // 10 minutos entre checks (originalmente) -> reducido a 5 

    constructor() {
        this.loadDefaults();
    }

    private loadDefaults() {
        for (const meta of replacementMetaList) {
            const envValue = process.env[meta.envVar];
            if (envValue) {
                const firstOption = envValue.split('|')[0].trim();
                this.activeUrls.set(meta.envVar, firstOption);
            }
        }
    }

    public start() {
        info("🌐 Iniciando servicio de verificación de dominios...");
        this.runChecks();
        setInterval(() => this.runChecks(), this.CHECK_INTERVAL);
    }

    private async runChecks() {
        const targets = [
            ...replacementMetaList.map(map => ({ name: map.name, envVar: map.envVar })),
                {name: "APIs", envVar: "APIs_FIX_URL"}
        ];

        for (const meta of targets) {
            const envVarName = meta.envVar;
            const rawEnv = process.env[envVarName];
            
            if (!rawEnv) continue;

            const candidates = rawEnv.split('|').map(url => url.trim()).filter(url => url.length > 0);
            
            if (candidates.length <= 1) {
                this.activeUrls.set(envVarName, candidates[0]);
                continue;
            }

            let foundWorking = false;

            for (const domain of candidates) {
                const isUp = await this.checkDomain(domain);
                if (isUp) {
                    if (this.activeUrls.get(envVarName) !== domain) {
                        info(`✅ [${meta.name}] Cambiado a: ${domain}`);
                    }
                    this.activeUrls.set(envVarName, domain);
                    foundWorking = true;
                    break; // Dejamos de buscar, nos quedamos con la primera que sirva (prioridad izq -> der)
                }
            }

            if (!foundWorking && candidates.length > 0) {
                error(`⚠️ [${meta.name}] Todos los dominios están caídos. Usando default: ${candidates[0]}`);
                this.activeUrls.set(envVarName, candidates[0]);
            }
        }
    }

    private async checkDomain(domain: string): Promise<boolean> {
        try {
            const url = domain.startsWith("http") ? domain : `https://${domain}`;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
            const header = { 'User-Agent': 'MeltryllistHealthCheck/1.0' }

            const response = await fetch(url, { 
                method: 'HEAD', 
                signal: controller.signal,
                headers: header
            }).catch(() => {
                return fetch(url, { method: 'GET', signal: controller.signal, headers: header});
            });

            clearTimeout(timeoutId);
            return response.status < 500; 

        } catch (e) {
            debug(`[DomainCheck] Error crítico verificando ${domain}: ${e}`);
            return false;
        }
    }

    public getActiveUrl(envVarName: string): string | null {
        return this.activeUrls.get(envVarName) || null;
    }
}

const urlStatusManager = new UrlStatusManager();
export default urlStatusManager;