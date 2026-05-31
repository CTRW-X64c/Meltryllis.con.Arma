import { Client } from "discord.js";
import { Shoukaku, Connectors } from "shoukaku";
import getPool from "../sys/DB-Engine/database";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export class LavalinkManager {
    public shoukaku: Shoukaku | null = null;
    public isReconnecting: Set<string> = new Set();
    private nodeConfigs = new Map<string, { name: string, url: string, auth: string }>();

    async init(client: Client) {
        const MeltrysNode = {
            name: (process.env.LAVALINK_NAME!) + '-Node',
            url: `${process.env.LAVALINK_HOST!}:${process.env.LAVALINK_PORT!}`,
            auth: process.env.LAVALINK_PASSWORD!
        };

        this.nodeConfigs.set(MeltrysNode.name, MeltrysNode);

        const Options = {
            resume: false,
            resumeTimeout: 30,
            reconnectTries: Infinity,
            reconnectInterval: 5000,
            restTimeout: 10000,
            moveOnDisconnect: true,
            resumeKey: process.env.LAVALINK_NAME || 'Shoukaku',
        };

        this.shoukaku = new Shoukaku(new Connectors.DiscordJS(client), [MeltrysNode], Options);
        this.shoukaku.on('error', (name: string, error: Error) => {
            console.error(`❌ [Lavalink] Error en ${name}: ${error.message}`);
            if (error.message.includes('resume') || error.message.includes('session')) {
                console.warn(`⚠️ [Lavalink] Posible error de reanudación en ${name}. Forzando purga...`);
                this.fullReconnectNode(name);
            }
        });

        this.shoukaku.on('close', (name: string, code: number, reason: string) => {
            console.info(`⚠️ [Lavalink] Nodo ${name} cerrado (Code ${code}). Razón: ${reason || 'Sin razón'}`);
            if (code === 1000 || code === 1006 || code === 4000) {
                this.fullReconnectNode(name);
            }
        });

        this.shoukaku.on('disconnect', (name: string, players: number) => {
            console.info(`🔌 [Lavalink] Nodo ${name} desconectado. Players afectados: ${players}`);
            this.fullReconnectNode(name);
        });

        this.shoukaku.on('ready', (name: string) => {
            console.info(`✅ [Lavalink] Nodo ${name} conectado y listo.`);
            this.isReconnecting.delete(name);
        });

        this.linkWatcher();
        return this.shoukaku;
    }

    private linkWatcher() {
        setInterval(() => {
            if (!this.shoukaku) return;
            this.shoukaku.nodes.forEach(async (node) => {
                if (node.state === 1) {
                    try {
                        await Promise.race([
                            node.rest.getLavalinkInfo(),
                            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000))
                        ]);
                    } catch (err) {
                        console.error(`[Lavalink] 💀 Detectada conexión fantasma en ${node.name}. Purgando nodo...`);
                        this.fullReconnectNode(node.name);
                    }
                } else if (node.state !== 0 && node.state !== 2) {
                    console.error(`[Lavalink] Nodo ${node.name} en estado ${node.state}. Forzando purga...`);
                    this.fullReconnectNode(node.name);
                }
            });
        }, 5 * 60 * 1000);
    }

    private async fullReconnectNode(nodeName: string) {
        if (this.isReconnecting.has(nodeName)) return;
        this.isReconnecting.add(nodeName);

        const config = this.nodeConfigs.get(nodeName);
        if (!config) {
            console.error(`[Lavalink] 💀 Sin credenciales para reconstruir el nodo ${nodeName}.`);
            this.isReconnecting.delete(nodeName);
            return;
        }

        try {
            console.log(`[Lavalink] 🔄 Purgando nodo ${nodeName} de la memoria (Borrando sesión fantasma)...`);

            if (this.shoukaku?.nodes.has(nodeName)) {
                this.shoukaku.removeNode(nodeName);
            }

            // Damos tiempo a Docker/Red para liberar puertos
            await delay(3000);

            console.log(`[Lavalink] 🔌 Reanexando el nodo ${nodeName}...`);
            this.shoukaku?.addNode(config);

        } catch (error) {
            console.error(`[Lavalink] ❌ Error en hard-reset de ${nodeName}:`, error);
        } finally {
            // Mantenemos el candado 10 segundos extra para evitar rebotes
            setTimeout(() => this.isReconnecting.delete(nodeName), 10000);
        }
    }

    public addNode(name: string, url: string, auth: string) {
        if (!this.shoukaku) return;
        if (this.shoukaku.nodes.has(name)) {
            console.log(`[Lavalink] El nodo ${name} ya existe. Omitiendo...`);
            return;
        }
        try {
            const config = { name, url, auth };
            this.nodeConfigs.set(name, config);

            this.shoukaku.addNode(config);
            console.log(`[Lavalink] 📥 Nodo anexado: ${name}`);
        } catch (error) {
            console.error(`[Lavalink] ❌ Error añadiendo el nodo  ${name}:`, error);
        }
    }

    public removeNode(name: string) {
        if (!this.shoukaku) return;
        if (this.shoukaku.nodes.has(name)) {
            this.shoukaku.removeNode(name);
            this.nodeConfigs.delete(name);
            console.log(`[Lavalink] 📤 Nodo eliminado: ${name}`);
        } else {
            console.log(`[Lavalink] El nodo ${name} no existe...`);
        }
    }

    public getNodes() {
        if (!this.shoukaku) return [];
        return Array.from(this.shoukaku.nodes.values());
    }

    public reconnectAllNodes() {
        if (!this.shoukaku) {
            console.error('[Lavalink] Shoukaku no inicializado, no se puede reconectar.');
            return;
        }
        console.log('[Lavalink] Intentando reconectar TODOS los nodos de forma profunda...');
        for (const node of this.shoukaku.nodes.values()) {
            this.fullReconnectNode(node.name);
        }
    }

    public async hardReset() {
        if (!this.shoukaku) return;
        console.log('[Lavalink] 🚨 Realizando hard reset...');
        const nodes = Array.from(this.shoukaku.nodes.values());
        for (const node of nodes) {
            this.fullReconnectNode(node.name);
        }
    }

    public async connect(nodeName: string) {
        if (!this.shoukaku) return;
        const node = this.shoukaku.nodes.get(nodeName);
        if (node && node.state !== 1) {
            await node.connect();
        }
    }

    getPlayer(guildId: string) {
        return this.shoukaku?.players.get(guildId);
    }

    joinVoiceChannel(guildId: string, channelId: string, shardId: number = 0) {
        if (!this.shoukaku) throw new Error("Shoukaku no inicializado");
        return this.shoukaku.joinVoiceChannel({
            guildId, channelId, shardId, deaf: true
        });
    }

    getNode() {
        if (!this.shoukaku) throw new Error("Shoukaku no inicializado");
        return this.shoukaku.options.nodeResolver(this.shoukaku.nodes);
    }
}


/* ========================= FUNCIONES DE BASE DE DATOS ========================= */

export async function loadNodes() {
    if (!lavalinkManager || !lavalinkManager.shoukaku) {
        console.warn("[Lavalink-DB] Intento de cargar nodos, pero Shoukaku no está listo.");
        return;
    }
    try {
        const pool = await getPool();
        const [nods] = await pool.query<any[]>("SELECT * FROM lavalinks");
        if (!nods || nods.length === 0) {
            console.log("[Lavalink-DB] No se detectaron nodos adicionales en la BD.");
            return;
        }
        for (const node of nods) {
            lavalinkManager.addNode(node.name, node.host, node.password);
        }
    } catch (err) {
        console.error("[Lavalink-DB] Error crítico al consultar nodos adicionales:", err);
    }
}

export async function addNodeBD(name: string, url: string, auth: string): Promise<boolean> {
    if (!lavalinkManager || !lavalinkManager.shoukaku) return false;
    try {
        const pool = await getPool();
        await pool.query("INSERT INTO lavalinks (name, host, password) VALUES (?, ?, ?)", [name, url, auth]);

        console.log(`[Lavalink-DB] Nodo agregado a la BD: ${name}`);
        lavalinkManager.addNode(name, url, auth);
        return true;
    } catch (err) {
        console.error("[Lavalink-DB] Error al añadir nodo a la BD:", err);
        return false;
    }
}

export async function removeNodeBD(name: string): Promise<boolean> {
    if (!lavalinkManager || !lavalinkManager.shoukaku) return false;
    try {
        const pool = await getPool();
        await pool.query("DELETE FROM lavalinks WHERE name = ?", [name]);

        console.log(`[Lavalink-DB] Nodo eliminado de la BD: ${name}`);
        lavalinkManager.removeNode(name);
        return true;
    } catch (err) {
        console.error("[Lavalink-DB] Error al eliminar nodo de la BD:", err);
        return false;
    }
}

export async function listNode(): Promise<any[] | null> {
    if (!lavalinkManager || !lavalinkManager.shoukaku) return null;
    try {
        const nodes = lavalinkManager.getNodes();
        if (!nodes || nodes.length === 0) return null;
        return nodes;
    } catch (err) {
        console.error("[Lavalink-DB] Error al listar nodos:", err);
        return null;
    }
}

/* ========================= INSTANCIA INICIAL ========================= */

function createLavalinkInstance(): LavalinkManager | null {
    const lavalinkUp = process.env.LAVALINK_NAME && process.env.LAVALINK_HOST && process.env.LAVALINK_PORT && process.env.LAVALINK_PASSWORD;
    if (!lavalinkUp) {
        console.log('❌ [Lavalink] Desactivado, faltan credenciales en el .env');
        return null;
    }
    console.log('✅ [Lavalink] Módulo Activado.');
    return new LavalinkManager();
}

const lavalinkManager = createLavalinkInstance();
export default lavalinkManager;