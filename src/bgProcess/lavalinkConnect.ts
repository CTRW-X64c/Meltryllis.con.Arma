import { Client } from "discord.js";
import { Shoukaku, Connectors } from "shoukaku";

export class LavalinkManager {
  public shoukaku: Shoukaku | null = null;
  private isReconnecting: Set<string> = new Set();

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
        resume: false,
        resumeTimeout: 30,
        reconnectTries: Infinity,
        reconnectInterval: 5000,
        restTimeout: 10000,
        moveOnDisconnect: true,
        resumeKey: process.env.LAVALINK_NAME || 'Shoukaku',
    };
    
    this.shoukaku = new Shoukaku(new Connectors.DiscordJS(client), Nodes, Options);

    // Event listeners con tipado correcto
    this.shoukaku.on('error', (name: string, error: Error) => 
        console.error(`❌ [Lavalink] Error en ${name}: ${error.message}`));

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

    // El evento resumeError no existe en Shoukaku, usamos 'error' para detectar problemas de reanudación
    this.shoukaku.on('error', (name: string, error: Error) => {
        if (error.message.includes('resume') || error.message.includes('session')) {
            console.warn(`⚠️ [Lavalink] Posible error de reanudación en ${name}: ${error.message}. Forzando reconexión completa...`);
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
    }, 3 * 60 * 60 * 1000);
  }
  
  private fullReconnectNode(nodeName: string) {
    if (this.isReconnecting.has(nodeName)) {
        console.log(`[Lavalink] Nodo ${nodeName} ya está reconectando, omitiendo...`);
        return;
    }

    this.isReconnecting.add(nodeName);
    
    const node = this.shoukaku?.nodes.get(nodeName);
    if (!node) {
        console.error(`[Lavalink] Nodo ${nodeName} no encontrado`);
        this.isReconnecting.delete(nodeName);
        return;
    }

    try {
        console.log(`[Lavalink] 🔄 Iniciando reconexión completa del nodo ${nodeName}...`);
        
        node.disconnect(1000, "Full reconnection requested");
        
        setTimeout(async () => {
            try {
                console.log(`[Lavalink] Conectando nodo ${nodeName}...`);
                await node.connect();
                
                setTimeout(() => {
                    if (node.state !== 1) {
                        console.error(`[Lavalink] ⚠️ Nodo ${nodeName} no se conectó correctamente, reintentando...`);
                        this.fullReconnectNode(nodeName);
                    } else {
                        console.log(`[Lavalink] ✅ Nodo ${nodeName} reconectado exitosamente`);
                        this.isReconnecting.delete(nodeName);
                    }
                }, 3000);
                
            } catch (error) {
                console.error(`[Lavalink] ❌ Error al reconectar ${nodeName}: ${error}`);
                this.isReconnecting.delete(nodeName);
                setTimeout(() => this.fullReconnectNode(nodeName), 10000);
            }
        }, 2000);
        
    } catch (e) {
        console.error(`[Lavalink] Falló el reinicio forzado para el nodo ${nodeName}: ${e}`);
        this.isReconnecting.delete(nodeName);
    }
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
      } catch (e) {}
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    for (const node of nodes) {
      try {
        await node.connect();
      } catch (e) {}
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