// src/client/coreCommands/neetTools.ts
import { EmbedBuilder } from 'discord.js';
import { debug, error, info } from '../logging'; // Asegúrate de tener los imports
import i18next from 'i18next';
import { sites } from '../../sys/embedding/domainChecker';

interface DomainStatus {
    name: string;
    url: string;
    status: number;
    responseTime: number;
    isWorking: boolean;
    error?: string;
}

function getDomainsFromEnv(): Array<{ name: string; url: string; expectedStatus: number }> {
    const domains: Array<{ name: string; url: string; expectedStatus: number }> = [];
    if (Object.keys(sites).length === 0) { error("embeding service no esta funcionando!"); return []; }
    for (const [key, value] of Object.entries(sites)) {
        if (key === "API_SFW" || key === "API_NSFW" || key === "Api") continue;
        const splitURL = value.split('|');
        for (const url of splitURL) {
            const fullUrl = ensureProtocol(url.trim());
            domains.push({
                name: formatServiceName(key),
                url: fullUrl,
                expectedStatus: 200
            });
        }
    }
    return domains;
}

function ensureProtocol(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `https://${url}`;
}

function formatServiceName(serviceName: string): string {
    return serviceName.toLowerCase().split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

async function checkDomain(domain: { name: string; url: string; expectedStatus: number }): Promise<DomainStatus> {
    const startTime = Date.now();
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const header = { 'User-Agent': 'MeltryllistHealthCheck/1.0' }

        const response = await fetch(domain.url, {
            method: 'HEAD',
            signal: controller.signal,
            headers: header,
        }).catch(() => {
            return fetch(domain.url, { method: 'GET', signal: controller.signal, headers: header });
        });

        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;
        const isSuccess = response.status >= 200 && response.status < 499;

        return {
            name: domain.name, url: domain.url, status: response.status,
            responseTime: responseTime, isWorking: isSuccess
        };
    } catch (err: any) {
        const responseTime = Date.now() - startTime;
        let errorMessage = 'Error desconocido';
        if (err.name === 'AbortError') errorMessage = 'Timeout (15s)';
        else errorMessage = err.message || 'Error desconocido';

        return {
            name: domain.name, url: domain.url, status: 0,
            responseTime: responseTime, isWorking: false, error: errorMessage
        };
    }
}

export async function checkAllDomains(): Promise<DomainStatus[]> {
    const domains = getDomainsFromEnv();
    if (domains.length === 0) { throw new Error("No se encontraron dominios revise domainCheker.ts") }
    info(`Verificando ${domains.length} dominios...`, "CheckDomains");
    const results: DomainStatus[] = [];
    const batchPromises = domains.map(domain => checkDomain(domain));
    results.push(...await Promise.all(batchPromises));

    debug(`Verificación completada. ${results.filter(r => r.isWorking).length}/${results.length} dominios OK`, "CheckDomains");
    return results;
}

export function buildDomainStatusEmbed(domainStatuses: DomainStatus[]): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setTitle(i18next.t("common:neTools.embed_title", { ns: "neTools" }))
        .setTimestamp();

    const workingCount = domainStatuses.filter(d => d.isWorking).length;
    const totalCount = domainStatuses.length;

    embed.setDescription(i18next.t("common:neTools.embed_description", { ns: "neTools", a1: workingCount, a2: totalCount }));

    if (workingCount === totalCount) {
        embed.setColor("#00ff00");
    } else if (workingCount === 0) {
        embed.setColor("#ff0000");
    } else {
        embed.setColor("#ffaa00");
    }

    const groupedDomains: { [key: string]: DomainStatus[] } = {};

    domainStatuses.forEach(domain => {
        if (!groupedDomains[domain.name]) {
            groupedDomains[domain.name] = [];
        }
        groupedDomains[domain.name].push(domain);
    });

    for (const [serviceName, domains] of Object.entries(groupedDomains)) {
        const fieldContent = domains.map(d => {
            const statusIcon = d.isWorking ? "✅" : "🔻";
            const cleanUrl = d.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
            return `  ${statusIcon} | ${cleanUrl}`;
        }).join('\n');

        embed.addFields({
            name: serviceName,
            value: fieldContent,
            inline: true
        });
    }

    const workingDomains = domainStatuses.filter(d => d.isWorking);
    const avgResponseTime = workingDomains.length > 0
        ? workingDomains.reduce((sum, d) => sum + d.responseTime, 0) / workingDomains.length
        : 0;

    embed.addFields({
        name: i18next.t("common:neTools.embed_resumen", { ns: "neTools" }),
        value: i18next.t("common:neTools.embed_resumen_value_1", { ns: "neTools", a1: Math.round(avgResponseTime) }) +
            i18next.t("common:neTools.embed_resumen_value_2", { ns: "neTools", a1: ((workingCount / totalCount) * 100).toFixed(1) }),
        inline: false
    });

    return embed;
}
