import { Client } from "discord.js";
import { Shoukaku, Connectors } from "shoukaku";
import getPool from "../sys/DB-Engine/database";

export async function loadNodes() {
    if (!lavalinkManager || !lavalinkManager.shoukaku) { console.warn("[Lavalink-DB] Intento de cargar nodos, pero Shoukaku no está listo."); return }
    try {
        const pool = await getPool();
        const [nods] = await pool.query<any[]>("SELECT * FROM lavalinks");
        if (!nods || nods.length === 0) { console.log("[Lavalink-DB] No se detectaron nodos adicionales en la BD."); return }
        for (const node of nods) { lavalinkManager.addNode(node.name, node.host, node.password); }
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
    if (!lavalinkManager || !lavalinkManager.shoukaku) { console.log("[Lavalink-DB] Intento de eliminar nodo, pero Lavalink no está listo."); return false }
    try {
        const pool = await getPool();
        await pool.query("DELETE FROM lavalinks WHERE name = ?", [name]);
        console.log(`[Lavalink-DB] Nodo eliminado correctamente de la BD: ${name}`);
        lavalinkManager.removeNode(name);
        return true;
    } catch (err) {
        console.error("[Lavalink-DB] Error al eliminar nodo de la BD:", err);
        return false;
    }
}

export async function listNode(): Promise<any[] | null> {
    if (!lavalinkManager || !lavalinkManager.shoukaku) { console.log("[Lavalink-DB] Intento de listar nodos, pero Lavalink no está listo."); return null }
    try {
        const nodes = lavalinkManager.getNodes();
        if (!nodes || nodes.length === 0) { return null; }
        return nodes;
    } catch (err) {
        console.error("[Lavalink-DB] Error al listar nodos:", err);
        return null;
    }
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export class LavalinkManager {
    public shoukaku: Shoukaku | null = null;
    private isReconnecting: Set<string> = new Set();
    async init(client: Client) {
        const Nodes: { name: string; url: string; auth: string }[] = [];
        Nodes.push({
            name: (process.env.LAVALINK_NAME!) + '-Node',
            url: `${process.env.LAVALINK_HOST!}: ${process.env.LAVALINK_PORT!}`,
            auth: process.env.LAVALINK_PASSWORD!
        });

        Object.keys(process.env).forEach((key) => {
            if (key.startsWith('LAVALINK_NAME_')) {
                const suffix = key.replace('LAVALINK_NAME_', '');
                const host = process.env[`LAVALINK_HOST_${suffix}`];

                if (host) {
                    Nodes.push({
                        name: (process.env[key] || `${suffix}`) + '-Node',
                        url: `${host}: ${process.env[`LAVALINK_PORT_${suffix}`] || '2333'}`,
                        auth: process.env[`LAVALINK_PASSWORD_${suffix}`] || 'youshallnotpass'
                    });
                }
            }
        });

        const Options = {
            resume: false,
            resumeTimeout: 30,
            reconnectTries: Infinity,
            reconnectInterval: 5000,
            restTimeout: 10000,
            moveOnDisconnect: true,
            resumeKey: process.env.LAVALINK_NAME || 'Shoukaku',
        };

        this.shoukaku = new Shoukaku(new Connectors.DiscordJS(client), Nodes, Options);
        this.shoukaku.on('error', (name: string, error: Error) =>
            console.error(`❌[Lavalink] Error en ${name}: ${error.message}`));

        this.shoukaku.on('close', (name: string, code: number, reason: string) => {
            console.info(`⚠️[Lavalink] Nodo ${name} cerrado(Code ${code}).Razón: ${reason || 'Sin razón'} `);
            if (code === 1000 || code === 1006 || code === 4000) {
                this.fullReconnectNode(name);
            }
        });

        this.shoukaku.on('disconnect', (name: string, players: number) => {
            console.info(`🔌[Lavalink] Nodo ${name} desconectado.Players afectados: ${players} `);
            this.fullReconnectNode(name);
        });

        this.shoukaku.on('ready', (name: string) => {
            console.info(`✅[Lavalink] Nodo ${name} conectado y listo.`);
            this.isReconnecting.delete(name);
        });

        this.shoukaku.on('error', (name: string, error: Error) => {
            if (error.message.includes('resume') || error.message.includes('session')) {
                console.warn(`⚠️[Lavalink] Posible error de reanudación en ${name}: ${error.message}. Forzando reconexión completa...`);
                this.fullReconnectNode(name);
            }
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
                        console.error(`[Lavalink] 💀 Detectada conexión fantasma en ${node.name}. Reiniciando nodo...`);
                        this.fullReconnectNode(node.name);
                    }
                } else if (node.state !== 0 && node.state !== 2) {
                    console.error(`[Lavalink] Nodo ${node.name} en estado ${node.state}. Forzando conexión...`);
                    this.fullReconnectNode(node.name);
                }
            });
        }, 3 * 60 * 1000);
    }

    private async fullReconnectNode(nodeName: string, retries = 0) {
        if (this.isReconnecting.has(nodeName)) return;
        if (retries > 3) {
            console.error(`[Lavalink] 💀 El nodo ${nodeName} no responde tras varios intentos.`);
            return;
        }

        this.isReconnecting.add(nodeName);
        const node = this.shoukaku?.nodes.get(nodeName);

        if (!node) {
            this.isReconnecting.delete(nodeName);
            return;
        }

        try {
            console.log(`[Lavalink] 🔄 Reconexión completa del nodo ${nodeName} (Intento ${retries + 1})...`);
            node.disconnect(1000, "Full reconnection requested");

            await delay(2000); // Esperamos a que cierre bien

            console.log(`[Lavalink] Conectando nodo ${nodeName}...`);
            await node.connect();

            await delay(3000); // Le damos tiempo para estabilizar el websocket

            if (node.state !== 1) { // 1 = CONNECTED
                console.error(`[Lavalink] ⚠️ Nodo ${nodeName} falló al conectar.`);
                this.isReconnecting.delete(nodeName);

                // Esperamos 10 segundos antes de intentar de nuevo de forma recursiva
                await delay(10000);
                this.fullReconnectNode(nodeName, retries + 1);
            } else {
                console.log(`[Lavalink] ✅ Nodo ${nodeName} reconectado exitosamente.`);
                this.isReconnecting.delete(nodeName);
            }
        } catch (error) {
            console.error(`[Lavalink] ❌ Error crítico al reconectar ${nodeName}: ${error} `);
            this.isReconnecting.delete(nodeName);

            await delay(10000);
            this.fullReconnectNode(nodeName, retries + 1);
        }
    }

    // Nuevas gestiones
    public addNode(name: string, url: string, auth: string) {
        if (!this.shoukaku) return;
        // Verificamos que el nodo no exista ya para evitar duplicados
        if (this.shoukaku.nodes.has(name)) {
            console.log(`[Lavalink] El nodo dinámico ${name} ya existe.Omitiendo...`);
            return;
        }

        try {
            this.shoukaku.addNode({ name, url, auth });
            console.log(`[Lavalink] 📥 Nodo dinámico inyectado desde BD: ${name} `);
        } catch (error) {
            console.error(`[Lavalink] ❌ Error añadiendo el nodo dinámico ${name}: `, error);
        }
    }

    public removeNode(name: string) {
        if (!this.shoukaku) return;
        const node = this.shoukaku.nodes.get(name);
        if (node) {
            this.shoukaku.removeNode(name);
            console.log(`[Lavalink] 📤 Nodo dinámico eliminado: ${name}`);
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
        console.log('[Lavalink] Intentando reconectar TODOS los nodos con autenticación completa...');
        for (const node of this.shoukaku.nodes.values()) {
            this.fullReconnectNode(node.name);
        }
    }

    public async hardReset() {
        if (!this.shoukaku) return;
        console.log('[Lavalink] 🚨 Realizando hard reset de todos los nodos...');
        const nodes = Array.from(this.shoukaku.nodes.values());
        for (const node of nodes) {
            try {
                node.disconnect(1000, "Hard reset");
            } catch (e) { }
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
        for (const node of nodes) {
            try {
                await node.connect();
            } catch (e) { }
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

/* ========================= Init ========================= */

function createLavalinkInstance(): LavalinkManager | null {
    const lavalinkUp = process.env.LAVALINK_NAME && process.env.LAVALINK_HOST && process.env.LAVALINK_PORT && process.env.LAVALINK_PASSWORD;
    if (!lavalinkUp) {
        console.log('❌ [Lavalink] Desactivado, quizás falta NAME, HOST, PORT o PASSWORD; si es intencional ignora esto');
        return null;
    }
    console.log('✅ [Lavalink] Módulo Activado.');
    return new LavalinkManager();
}

const lavalinkManager = createLavalinkInstance();
export default lavalinkManager;