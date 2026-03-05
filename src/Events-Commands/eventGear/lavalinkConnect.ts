// src/client/eventGear/lavalinkConnect.ts
import { Client } from "discord.js";
import { Shoukaku, Connectors, Node } from "shoukaku";

export class LavalinkManager {
  public shoukaku: Shoukaku | null = null;

  async init(client: Client) {
    const Nodes: { name: string; url: string; auth: string }[] = [];

    Nodes.push({
        name: (process.env.LAVALINK_NAME || 'Main') + '-Node',
        url: `${process.env.LAVALINK_HOST || 'lavalink'}:${process.env.LAVALINK_PORT || '2333'}`,
        auth: process.env.LAVALINK_PASSWORD || 'youshallnotpass'
    });

    Object.keys(process.env).forEach((key) => {
        if (key.startsWith('LAVALINK_NAME_')) {
            const suffix = key.replace('LAVALINK_NAME_', ''); 
            const host = process.env[`LAVALINK_HOST_${suffix}`];
            
            if (host) {
                Nodes.push({
                    name: (process.env[key] || `${suffix}`) + '-Node',
                    url: `${host}:${process.env[`LAVALINK_PORT_${suffix}`] || '2333'}`,
                    auth: process.env[`LAVALINK_PASSWORD_${suffix}`] || 'youshallnotpass'
                });
            }
        }
    });
    
    const Options = {
        resume: true,
        resumeTimeout: 30,
        reconnectTries: Infinity,
        reconnectInterval: 5000,
        restTimeout: 10000,
        moveOnDisconnect: false,
        resumeKey: process.env.LAVALINK_NAME || 'Shoukaku',
    };
    
    this.shoukaku = new Shoukaku(new Connectors.DiscordJS(client), Nodes, Options);

    this.shoukaku.on('error', (_, error) => 
        console.error(`❌ [Lavalink] Error: ${error.message}`));

    this.shoukaku.on('close', (name, code, reason) => 
        console.info(`⚠️ [Lavalink] Nodo ${name} cerrado (Code ${code}). Razón: ${reason || 'Sin razón'}`));

    this.shoukaku.on('disconnect', (name) => 
        console.info(`🔌 [Lavalink] Nodo ${name} desconectado. Intentando reconectar...`));

    this.shoukaku.on('ready', (name) => 
        console.info(`✅ [Lavalink] Nodo ${name} conectado y listo.`));
    
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
                        console.error(`[Lavalink] 💀 Detectada conexión fanstasma en ${node.name}. Reiniciando nodo...`);
                        this.reconnectNode(node);
                    }
                } else if (node.state !== 0) {
                    console.error(`[Lavalink] Nodo ${node.name} desconectado. Forzando conexión...`);
                    this.reconnectNode(node);
                }
            });
        }, 3 * 60 * 60 * 1000); 
    }
  
    private reconnectNode(node: Node) {
      try {
        node.disconnect(0, "Forced Reconnect");
        setTimeout(() => {
        console.log(`[Lavalink] Intentando reconectar el nodo ${node.name}...`);
        node.connect();
            }, 1000);
        } catch (e) {
            console.error(`[Lavalink] Falló el reinicio forzado para el nodo ${node.name}: ${e}`);
        }
    }

    public reconnectAllNodes() {
    if (!this.shoukaku) {
      console.error('[Lavalink] Shoukaku no inicializado, no se puede reconectar.');
      return;
    }

    console.log('[Lavalink] Intentando reconectar todos los nodos...');
    for (const node of this.shoukaku.nodes.values()) {
      this.reconnectNode(node);
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
    const lavalinkUp = process.env.LAVALINK_NAME && process.env.LAVALINK_HOST && process.env.LAVALINK_PASSWORD;
    if (!lavalinkUp) {
        console.log('❌ [Lavalink] Desactivado, quiza falta NAME, HOST o PASSWORD; si es intencional ignora esto');
        return null;
    }
    console.log('✅ [Lavalink] Módulo Activado.');
    return new LavalinkManager();
}

const lavalinkManager = createLavalinkInstance();
export default lavalinkManager;