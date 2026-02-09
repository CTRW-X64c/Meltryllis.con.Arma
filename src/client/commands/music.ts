import { ChatInputCommandInteraction, SlashCommandBuilder, GuildMember, TextChannel, EmbedBuilder, VoiceState, MessageFlags } from "discord.js";
import lavalinkManager, { LavalinkManager } from "../eventGear/lavalinkConnect"; 
import { error, debug } from "../../sys/logging";
import { hasPermission } from "../../sys/zGears/mPermission";
import i18next from "i18next";

/* === SISTEMA DE COLA  === */
interface QueueEntry {
    track: any;
    requester: string;
    title: string;
    uri: string;
    duration: number;
}

const musicQueue = new Map<string, QueueEntry[]>();
const currentPlaying = new Map<string, QueueEntry>();
const mapTimmers = new Map<string, NodeJS.Timeout>();

export async function registerMusicCommands() {
    if (!lavalinkManager) return [];

    return [
        new SlashCommandBuilder().setName("play").setDescription(i18next.t("command_mussic_play_01", { ns: "music" }))
            .addStringOption(o => o.setName("cancion")
            .setDescription(i18next.t("command_mussic_play_02", { ns: "music" })).setRequired(true))
            .addStringOption(o => o.setName("queue")
            .setDescription(i18next.t("command_mussic_play_03", { ns: "music" })).setRequired(false)
            .addChoices({ name: "yes", value: "yes" })),
        new SlashCommandBuilder().setName("stop").setDescription(i18next.t("command_mussic_stop_01", { ns: "music" })),
        new SlashCommandBuilder().setName("skip").setDescription(i18next.t("command_mussic_skip_01", { ns: "music" })),
        new SlashCommandBuilder().setName("queue").setDescription(i18next.t("command_mussic_queue_01", { ns: "music" }))
            .addStringOption(o => o.setName("clean")
            .setDescription(i18next.t("command_mussic_queue_02", { ns: "music" })).setRequired(false)
            .addChoices({ name: "yes", value: "yes" })),
    ];
}

export async function handleMusicInteraction(interaction: ChatInputCommandInteraction) {
    if (!lavalinkManager) {
        await interaction.reply({ content: i18next.t("command_mussic_error_01", { ns: "music" }), flags: MessageFlags.Ephemeral });
        await deletReplyMsg(interaction);
        return;
    }

    const isAllowed = hasPermission(interaction, interaction.commandName);
    if (!isAllowed) {
        await interaction.reply({
            content: i18next.t("command_permission_error_permission", { ns: "music" }),
            flags: MessageFlags.Ephemeral
        });
        return;
    }
    
    const { commandName } = interaction;
    
    switch (commandName) {
        case "play": 
            await handlePlay(interaction, lavalinkManager); 
            break;
        case "stop": 
            await handleStop(interaction, lavalinkManager); 
            break;
        case "skip": 
            await handleSkip(interaction, lavalinkManager); 
            break;
        case "queue": 
            await handleQueue(interaction); 
            break;
    }
}

/* ========================= PLAY ========================= */

async function handlePlay(interaction: ChatInputCommandInteraction, lavalink: LavalinkManager) {
    await interaction.deferReply();
    const guildId = interaction.guildId!;
    const member = interaction.member as GuildMember;
    const inChannelPlaying = currentPlaying.get(guildId);
    const queue = musicQueue.get(guildId) || [];
    let query = interaction.options.getString("cancion", true);
    const playlist = interaction.options.getString("queue");

    if (!member.voice.channelId) {
        await interaction.editReply(i18next.t("command_mussic_error_empit", { ns: "music" }));
        await deletReplyMsg(interaction);
        return;
    }
    // si no hay cola ni esta reproduciendo pero esta conectada "reinicia" la conexion
    if (!inChannelPlaying && queue.length === 0) {
        await lavalink.shoukaku?.leaveVoiceChannel(guildId);        
    }

    try {
        let player = lavalink.getPlayer(interaction.guildId!)
        const botVoiceChannel = interaction.guild?.members.me?.voice.channelId;

        if (player && botVoiceChannel) {
            if (botVoiceChannel !== member.voice.channelId) {
                await interaction.editReply(i18next.t("command_mussic_occupied", { ns: "music" }));
                await deletReplyMsg(interaction);
                return;
            }
        } else {
            player = await lavalink.joinVoiceChannel(guildId, member.voice.channelId);
        }
        const node = lavalink.getNode();
        if (!node) { 
            await interaction.editReply(i18next.t("command_mussic_lavalink_down", { ns: "music" }));
            if (inChannelPlaying) return;
            lavalink.shoukaku?.leaveVoiceChannel(guildId);
            await deletReplyMsg(interaction);
            return; 
        }

    // Previene que se añadan listas de reproduccion, se añada opcion para que si acepte listas
        if (playlist !== "yes"){
            query.includes("youtube.com/watch") && query.includes("&")
            const ampersandIndex = query.indexOf('&');
            if (ampersandIndex !== -1) query = query.substring(0, ampersandIndex);
        }

        const searchEngine = /^https?:\/\//.test(query) ? query : `ytsearch:${query}`;               
        const result = await node.rest.resolve(searchEngine);

        if (!result || result.loadType === 'empty' || result.loadType === 'error') {
            await interaction.editReply(i18next.t("command_mussic_no_found", { ns: "music" }));
            if (inChannelPlaying) return;
            lavalink.shoukaku?.leaveVoiceChannel(guildId);
            await deletReplyMsg(interaction);
            return;
        }

        let tracksToAdd: QueueEntry[] = [];
        let message = "";

        const mapTrack = (track: any, requester: string) => ({
            track: track.encoded,
            requester,
            title: track.info.title,
            uri: track.info.uri || "",
            duration: track.info.length
        });

        if (result.loadType === 'playlist') {
            for (const track of result.data.tracks) {
                tracksToAdd.push(mapTrack(track, interaction.user.tag));
            }
            message = i18next.t("command_mussic_playlist", { ns: "music", a1: result.data.tracks.length, a2: tracksToAdd.length });
        } else {
            const trackData = result.loadType === 'search' ? result.data[0] : result.data;
            tracksToAdd.push(mapTrack(trackData, interaction.user.tag));
            message = i18next.t("command_mussic_playlist_queue", { ns: "music", a1: trackData.info.title });
            await deletReplyMsg(interaction);
        }

        let queue = musicQueue.get(guildId);

        if (!queue) { queue = []; musicQueue.set(guildId, queue); }
        queue.push(...tracksToAdd);

        if (!currentPlaying.has(guildId)) { 
            await playNext(guildId, player, interaction);
            await deletReplyMsg(interaction);
                if (result.loadType === 'playlist') {const msg = await (interaction.channel as TextChannel).send(message);
                setTimeout(() => { msg.delete().catch(() => {}); }, 30000);
            }
        } else {
            await interaction.editReply(message);
            await deletReplyMsg(interaction);
        }
        
    } catch (err) {
        error(`Play Error: ${err}`);
        await interaction.editReply("❌ Error interno.");
        await deletReplyMsg(interaction);
        if (!inChannelPlaying){
        lavalink.shoukaku?.leaveVoiceChannel(guildId);
        }
    }
}

/* ========================= STOP ========================= */

async function handleStop(interaction: ChatInputCommandInteraction, lavalink: LavalinkManager) {
    const player = lavalink.getPlayer(interaction.guildId!);
    const guildId = interaction.guildId!;
    
    if (!player) {
        await interaction.reply({ content: i18next.t("command_mussic_Stop_01", { ns: "music" }), flags: MessageFlags.Ephemeral });
        await deletReplyMsg(interaction);
        return;
    }

    musicQueue.delete(guildId!);
    currentPlaying.delete(guildId!);
    
    await player.stopTrack();
    try {
        await lavalink.shoukaku?.leaveVoiceChannel(guildId);
    } catch (e) {error(`Error al desconectarse del canal de voz: ${e}`);}
    
    await interaction.reply(i18next.t("command_mussic_Stop_02", { ns: "music" }));
    await deletReplyMsg(interaction);
}

/* ========================= SKIP ========================= */

async function handleSkip(interaction: ChatInputCommandInteraction, lavalink: LavalinkManager) {
    const player = lavalink.getPlayer(interaction.guildId!);
    const queue = musicQueue.get(interaction.guildId!) || [];
    const inChannelPlaying = currentPlaying.get(interaction.guildId!);

    if (inChannelPlaying && queue.length > 0){
        await interaction.reply({ content: i18next.t("command_mussic_Skip_01", { ns: "music"}),  flags: MessageFlags.Ephemeral });
        await player?.stopTrack();
        await deletReplyMsg(interaction);
        return;
    }

    if (inChannelPlaying && queue.length === 0){
        await interaction.reply({ content: i18next.t("command_mussic_Skip_02", { ns: "music" }), flags: MessageFlags.Ephemeral });
        await deletReplyMsg(interaction);
        return;
    }

    await interaction.reply({ content: i18next.t("command_mussic_Skip_03", { ns: "music" }), flags: MessageFlags.Ephemeral });
    await deletReplyMsg(interaction);
}

/* ========================= QUEUE ========================= */

async function handleQueue(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const queue = musicQueue.get(guildId) || [];
    const current = currentPlaying.get(guildId);
    const cleanqueue = interaction.options.getString("clean");

    if (cleanqueue === "yes") { /*Ahora permite borrar la lista*/
        if (queue.length === 0 || !current) {
            await interaction.reply(i18next.t("command_mussic_Queue_06", { ns: "music" }));
            await deletReplyMsg(interaction);
            return;
        }

        if (queue.length > 0 && current) {
            musicQueue.delete(guildId);
            await interaction.reply(i18next.t("command_mussic_Queue_07", { ns: "music" }));
            await deletReplyMsg(interaction);
            return;
        }
    }

    if (!current && queue.length === 0) {
        await interaction.reply(i18next.t("command_mussic_Queue_01", { ns: "music" }));
        await deletReplyMsg(interaction);
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle(i18next.t("command_mussic_Queue_02", { ns: "music" }))
        .setColor(0x00AE86);

    if (current) {
        embed.addFields({ name: i18next.t("command_mussic_Queue_03_name", { ns: "music" }), value: i18next.t("command_mussic_Queue_03_value", { ns: "music", a1: current.title, a2: current.uri, a3: current.requester}),  inline: false});
    }

    if (queue.length > 0) {
        const list = queue.slice(0, 10).map((song, i) => 
            `**${i + 1}.** [${song.title}](${song.uri})`
        ).join("\n");

        const shortlist = queue.length > 10 ? `\n\n*...y ${queue.length - 10} más.*` : '';
        embed.setDescription(i18next.t("command_mussic_Queue_04", { ns: "music", a1: list, a2: shortlist}));
    } else {
        embed.setDescription(i18next.t("command_mussic_Queue_05", { ns: "music" }));
    }

    await interaction.reply({ embeds: [embed] });
    await deletReplyMsg(interaction);
}

/* ========================= HELPER - reproduccion - ========================= */

async function playNext(guildId: string, player: any, interaction?: ChatInputCommandInteraction) {
    const queue = musicQueue.get(guildId);
    
    if (!queue || queue.length === 0) {
        musicQueue.delete(guildId);
        currentPlaying.delete(guildId);

    lavalinkManager?.shoukaku?.leaveVoiceChannel(guildId);

    if (interaction?.channel) (interaction.channel as TextChannel).send(i18next.t("command_mussic_pNext_01", { ns: "music" }));
        return;
    }

    const song = queue.shift()!;
    currentPlaying.set(guildId, song); 

    await player.playTrack({ track: { encoded: song.track }});

    const msg = i18next.t("command_mussic_pNext_02", { ns: "music", a1: song.title, a2: song.requester });
    
    try {
        if (interaction && interaction.deferred && !interaction.replied) await interaction.editReply(msg);
        else if (interaction?.channel) (interaction.channel as TextChannel).send(msg);
    } catch (e) {}

    if (player.listenerCount('end') === 0) {
        player.on('end', async (data: any) => {
            if (data.reason === 'replaced') return;
            await playNext(guildId, player, undefined); 
        });
    }
}

/* ========================= HELPER - nadie escuchando - ========================= */

export async function checkVoiceEmptyShoukaku(oldState: VoiceState): Promise<void> {
    const guildId = oldState.guild.id;
    const Meltrys = oldState.guild.members.me;

    if (!Meltrys?.voice.channelId) {
        if (mapTimmers.has(guildId)) {
            clearTimeout(mapTimmers.get(guildId)!);
            mapTimmers.delete(guildId);
        }
        return;
    }

    const botChannel = Meltrys.voice.channel;
    if (botChannel && botChannel.members.size === 1) {
        if (mapTimmers.has(guildId)) return;
        const timer = setTimeout(async () => {
            try {
                const currentChannel = oldState.guild.members.me?.voice.channel;
                if (currentChannel && currentChannel.members.size === 1) {
                    musicQueue.delete(guildId);
                    currentPlaying.delete(guildId);
                    await lavalinkManager?.shoukaku?.leaveVoiceChannel(guildId);
                    debug(`Me desconecte en ${guildId}, nadie escuchando`);
                }
            } catch (e) {
                error(`Error en checkVoiceEmptyShoukaku: ${e}`);
            } finally {
                mapTimmers.delete(guildId);
            }
        }, 10 * 1000); // 10 segundos
        mapTimmers.set(guildId, timer);
    } else {
        if (mapTimmers.has(guildId)) {
            clearTimeout(mapTimmers.get(guildId));
            mapTimmers.delete(guildId);
        }
    }
} 

/* ========================= HELPER - borrador de mensajes - ========================= */

async function deletReplyMsg(interaction: ChatInputCommandInteraction) {
    setTimeout(() => {
        interaction.deleteReply().catch((e) => {
            debug(`Error al borrar respuesta ${e}`);
        });
    }, 30000); // Borra a los 30s
}