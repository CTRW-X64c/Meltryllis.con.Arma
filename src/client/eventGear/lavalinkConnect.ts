// src/client/eventGear/lavalinkConnect.ts
import { Client } from "discord.js";
import { Shoukaku, Connectors } from "shoukaku";

export class LavalinkManager {
  public shoukaku: Shoukaku | null = null;

  async init(client: Client) {
    const Nodes = [{
        name: process.env.LAVALINK_NAME + '-Node'|| 'Main-Node',
        url: `${process.env.LAVALINK_HOST || 'lavalink'}:${process.env.LAVALINK_PORT || '2333'}`,
        auth: process.env.LAVALINK_PASSWORD || 'youshallnotpass'
    }];

    const Options = {
        moveOnDisconnect: false,
        resume: false,
        resumeKey: process.env.LAVALINK_NAME || 'Shoukaku', 
        reconnectTries: 5,
        restTimeout: 10000
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

    return this.shoukaku;
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

function createLavalinkInstance(): LavalinkManager | null {
    if (process.env.LAVALINK_ACTIVE === 'OFF') {
        console.log('❌ [Lavalink] Desactivado por configuración (.env).');
        return null;
    }
    console.log('✅ [Lavalink] Módulo Activado.');
    return new LavalinkManager();
}

const lavalinkManager = createLavalinkInstance();
export default lavalinkManager;

