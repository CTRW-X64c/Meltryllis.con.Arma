// src/services/voicEvent.ts 
import { Client, VoiceState, VoiceChannel, Guild} from "discord.js";
import { error, debug, info } from "../../sys/logging";
import { getVoiceConfig, addTempVoiceChannel, removeTempVoiceChannel, isTempVoiceChannel, getAllTempVoiceChannels } from "../../sys/DB-Engine/links/JointoVoice";

export class VoiceChannelService {
    private client: Client;
    private activeTempChannels: Map<string, string> = new Map(); 
    private readonly GRACE_PERIOD = 5000; // <= tiempo de gracia
    private deletionTimers: Map<string, NodeJS.Timeout> = new Map(); // Gestor de los tiempos de gracia
    private readonly MAX_CHANNELS_PER_USER = 2 // Limite de canales por usuario
    

    constructor(client: Client) {
        this.client = client;
        this.initializeFromDatabase();
    }

    private async initializeFromDatabase(): Promise<void> {
        try {
            const tempChannels = await getAllTempVoiceChannels();
            
            for (const tempChannel of tempChannels) {
                this.activeTempChannels.set(tempChannel.channelId, tempChannel.ownerId);
            }
            
            debug(`Cargados ${tempChannels.length} canales temporales desde BD`);
        } catch (err) {
            error(`Error inicializando canales desde BD: ${err}`);
        }
    }

    async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
        try {
            const guildId = newState.guild.id;
            const config = await getVoiceConfig(guildId);

            if (!config || !config.enabled) return;

            if (!oldState.channelId && newState.channelId) {
                await this.handleJoinVoice(newState, config.channelId);
            }
            
            else if (oldState.channelId && !newState.channelId) {
                await this.handleLeaveVoice(oldState);
            }
            
            else if (oldState.channelId !== newState.channelId) {
                await this.handleSwitchVoice(oldState, newState, config.channelId);
            }

        } catch (err) {
            error(`Error en handleVoiceStateUpdate: ${err}`);
        }
    }

    private async handleJoinVoice(state: VoiceState, masterChannelId: string): Promise<void> {
        const userId = state.member?.id;
        const channelId = state.channelId;

        if (!userId || !channelId) return;

        if (channelId === masterChannelId) {
            await this.createTempChannel(state);
            return;
        }

        const isTemp = await isTempVoiceChannel(channelId);
        if (isTemp) {
            this.cancelDeletionTimer(channelId);
            debug(`Usuario ${userId} se unió al canal temporal ${channelId}`);
        }
    }

    private async createTempChannel(state: VoiceState): Promise<void> {
        const user = state.member;
        const guild = state.guild;
        
        if (!user) return;

        const userTempChannels = await this.getUserTempChannelCount(user.id, guild.id);
        
        if (userTempChannels >= this.MAX_CHANNELS_PER_USER) {
            try {
                await user.voice.disconnect("Límite de canales alcanzado");
            } catch (err) {
                error(`Error manejando límite de canales para ${user.id}: ${err}`);
            }
            return;
        }

        try {
            const masterChannel = await guild.channels.fetch(state.channelId!) as VoiceChannel;
            if (!masterChannel) return;

            const userName = user.displayName || user.user.username;
            const channelName = `${userName}'s Room`;
            const tempChannel = await masterChannel.clone({
                name: channelName,
                reason: `Canal temporal creado por ${user.user.tag}`
            });

            // 🔧 Añadir permisos de administración solo para el propietario
            await tempChannel.permissionOverwrites.edit(user.id, {
                ManageChannels: true,
                MoveMembers: true,
                MuteMembers: true,
                DeafenMembers: true
            });

            await user.voice.setChannel(tempChannel);
            await addTempVoiceChannel(tempChannel.id, guild.id, user.id);
            
            this.activeTempChannels.set(tempChannel.id, user.id);
            debug(`Canal temporal creado: ${tempChannel.name} (${tempChannel.id}) para ${user.user.tag}`);
        } catch (err) {
            error(`Error creando canal temporal para ${user.user.tag}: ${err}`);
        }
    }

    private async getUserTempChannelCount(userId: string, guildId: string): Promise<number> {
        try {
            const allTempChannels = await getAllTempVoiceChannels();
            return allTempChannels.filter(ch => 
                ch.guildId === guildId && ch.ownerId === userId
            ).length;
        } catch (err) {
            error(`Error contando canales de usuario ${userId}: ${err}`);
            return 0;
        }
    }

    private async handleLeaveVoice(state: VoiceState): Promise<void> {
        const channelId = state.channelId;
        if (!channelId) return;

        const isTemp = await isTempVoiceChannel(channelId);
        if (!isTemp) return;

        const channel = await state.guild.channels.fetch(channelId) as VoiceChannel;
        if (!channel) return;

        if (channel.members.size === 0) {
            this.scheduleChannelDeletion(channel);
        }
    }

    private async handleSwitchVoice(oldState: VoiceState, newState: VoiceState, masterChannelId: string): Promise<void> {
        const oldChannelId = oldState.channelId;
        const newChannelId = newState.channelId;

        if (oldChannelId && oldChannelId !== masterChannelId) {
            const isOldTemp = await isTempVoiceChannel(oldChannelId);
            if (isOldTemp) {
                const oldChannel = await oldState.guild.channels.fetch(oldChannelId) as VoiceChannel;
                if (oldChannel && oldChannel.members.size === 0) {
                    this.scheduleChannelDeletion(oldChannel);
                } else {
                    this.cancelDeletionTimer(oldChannelId);
                }
            }
        }

        if (newChannelId === masterChannelId) {
            await this.createTempChannel(newState);
        }
    }

    private scheduleChannelDeletion(channel: VoiceChannel): void {
        const channelId = channel.id;
        
        this.cancelDeletionTimer(channelId);
        
        debug(`Programando eliminación de canal ${channel.name} en ${this.GRACE_PERIOD}ms`);
        
        const timer = setTimeout(async () => {
            try {
                // Verificar nuevamente si el canal está vacío
                const currentChannel = await channel.guild.channels.fetch(channelId) as VoiceChannel;
                if (currentChannel && currentChannel.members.size === 0) {
                    await this.deleteTempChannel(currentChannel);
                } else {
                    debug(`Canal ${channel.name} ya no está vacío, cancelando eliminación`);
                }
            } catch (err) {
                error(`Error en timer de eliminación para canal ${channelId}: ${err}`);
            } finally {
                this.deletionTimers.delete(channelId);
            }
        }, this.GRACE_PERIOD);
        
        this.deletionTimers.set(channelId, timer);
    }

    private cancelDeletionTimer(channelId: string): void {
        const timer = this.deletionTimers.get(channelId);
        if (timer) {
            clearTimeout(timer);
            this.deletionTimers.delete(channelId);
            debug(`Timer de eliminación cancelado para canal ${channelId}`);
        }
    }

    private async deleteTempChannel(channel: VoiceChannel): Promise<void> {
        try {
            this.cancelDeletionTimer(channel.id);
            
            const ownerId = this.activeTempChannels.get(channel.id);            
            await removeTempVoiceChannel(channel.id);   
            this.activeTempChannels.delete(channel.id);
            
            await channel.delete(`Canal temporal vacío (propietario: ${ownerId || 'desconocido'})`);
            debug(`Canal temporal eliminado: ${channel.name} (${channel.id})`);
        } catch (err) {
            error(`Error eliminando canal temporal ${channel.id}: ${err}`);
        }
    }

    async cleanupGuildTempChannels(guild: Guild): Promise<{ deleted: number; errors: number }> {
        const results = { deleted: 0, errors: 0 };
        
        try {
            const allTempChannels = await getAllTempVoiceChannels();
            const guildTempChannels = allTempChannels.filter(ch => ch.guildId === guild.id);
            
            for (const tempChannel of guildTempChannels) {
                this.cancelDeletionTimer(tempChannel.channelId);
            }

            for (const tempChannel of guildTempChannels) {
                try {
                    const channel = await guild.channels.fetch(tempChannel.channelId);
                    if (channel && channel.isVoiceBased()) {
                        await channel.delete("Limpieza manual de canales temporales");
                        
                        await removeTempVoiceChannel(tempChannel.channelId);
                        this.activeTempChannels.delete(tempChannel.channelId);
                        
                        results.deleted++;
                    }
                } catch (err) {
                    results.errors++;
                    debug(`Error eliminando canal ${tempChannel.channelId}: ${err}`);
                }
            }

            info(`Limpieza manual: ${results.deleted} canales eliminados, ${results.errors} errores en ${guild.name}`);
        } catch (err) {
            error(`Error en limpieza general: ${err}`);
        }

        return results;
    }

    async cleanupEmptyTempChannels(): Promise<void> {
        try {
            const allTempChannels = await getAllTempVoiceChannels();
            
            for (const tempChannel of allTempChannels) {
                try {
                    const guild = this.client.guilds.cache.get(tempChannel.guildId);
                    if (!guild) continue;

                    const channel = await guild.channels.fetch(tempChannel.channelId).catch(() => null);                    
                    if (!channel || (channel.isVoiceBased() && (channel as VoiceChannel).members.size === 0)) {
                        const voiceChannel = channel as VoiceChannel;
                        if (voiceChannel) {
                            this.cancelDeletionTimer(voiceChannel.id);
                            await this.deleteTempChannel(voiceChannel);
                        }
                    }
                } catch (err) {
                    debug(`Error verificando canal ${tempChannel.channelId}: ${err}`);
                }
            }
        } catch (err) {
            error(`Error en limpieza de canales vacíos: ${err}`);
        }
    }

    async getUserTempChannels(userId: string, guildId: string): Promise<string[]> {
        try {
            const allTempChannels = await getAllTempVoiceChannels();
            return allTempChannels
                .filter(ch => ch.guildId === guildId && ch.ownerId === userId)
                .map(ch => ch.channelId);
        } catch (err) {
            return [];
        }
    }

    cleanupTimers(): void {
        for (const timer of this.deletionTimers.values()) {
            clearTimeout(timer);
        }
        this.deletionTimers.clear();
        debug("Todos los timers de eliminación limpiados");
    }
}

// Inicializador y autoclean canales vacios.

export function startVoiceChannelService(client: Client): void {
    const voiceChannelService = new VoiceChannelService(client);
    const ClenTiemer = 8 * 60 * 60 * 1000;
    
    client.on('voiceStateUpdate', (oldState, newState) => {
        voiceChannelService.handleVoiceStateUpdate(oldState, newState).catch(err => {
            error(`Error en voiceStateUpdate: ${err}`);
        });
    });

    setInterval(() => {
        voiceChannelService.cleanupEmptyTempChannels().catch(err => {
            error(`Error en limpieza automática de canales: ${err}`);
        });
    }, ClenTiemer);

    client.on('shardDisconnect', () => {
        voiceChannelService.cleanupTimers();
    });
}