// src/Events-Commands/commands/jointovoice.ts
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, ChannelType, VoiceChannel,
    /*botnes*/  ButtonBuilder, ButtonStyle, ActionRowBuilder, ButtonInteraction} from "discord.js";
import { error, info, debug } from "../../sys/logging";
import i18next from "i18next";
import { getVoiceConfig, setVoiceConfig, getAllTempVoiceChannels, getGuildTempChannelCount, removeVoiceConfig } from "../../sys/DB-Engine/links/JointoVoice";
import { hasPermission } from "../../sys/zGears/mPermission";


export async function registerJoinToCreateCommand(): Promise<SlashCommandBuilder[]> {
    const jointovoice = new SlashCommandBuilder()
        .setName("jointovoice")
        .setDescription(i18next.t("command_jointocreate_description", { ns: "jointocreate" }))
        .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
        .addStringOption(op =>
            op.setName("modo")
            .setDescription(i18next.t("command_jointocreate_usage", { ns: "jointocreate" }))
            .setRequired(true)
            .addChoices(
                { name: i18next.t("command_join_set", { ns: "jointocreate" }), value: "set" },
                { name: i18next.t("command_join_disable", { ns: "jointocreate" }), value: "disable" },
                { name: i18next.t("command_join_status", { ns: "jointocreate" }), value: "status" },
                { name: i18next.t("command_join_cleanup", { ns: "jointocreate" }), value: "cleanup" })
            )
        .addChannelOption(op =>
            op.setName("channel")
            .setDescription(i18next.t("command_join_chanel_set", { ns: "jointocreate" }))
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildVoice)
        )

    return [jointovoice] as SlashCommandBuilder[];
}

export async function handleJoinToCreateCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const isAllowed = await hasPermission(interaction, interaction.commandName);
    if (!isAllowed) {
        await interaction.reply({
            content: i18next.t("command_permission_error", { ns: "jointocreate" }),
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const modoConfig = interaction.options.getString("modo");
    const guildId = interaction.guildId;
    if (!guildId) {
            await interaction.reply({ content: i18next.t("jointocreate_guild_error", { ns: "jointocreate" }), flags: MessageFlags.Ephemeral });
            return;
        }

    switch (modoConfig) {
        case "set":
            await setMasterChannel(interaction, guildId);
            break;
        case "disable":
            await disableSystem(interaction, guildId);
            break;
        case "status":
            await showStatus(interaction, guildId);
            break;
        case "cleanup":
            await cleanupChannels(interaction, guildId);
            break;
    }
}

// =============== Establece Canal Maestro =============== //

async function setMasterChannel(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const channel = interaction.options.getChannel("channel") as VoiceChannel;
        if (!channel) {
            await interaction.editReply(" ❌ En modo SET se necesita espesificar un canal de voz");
            return;
        }

        const botPermissions = channel.permissionsFor(interaction.client.user!);
        if (!botPermissions?.has(['ViewChannel', 'Connect', 'ManageChannels'])) {
            await interaction.editReply({
                content: i18next.t("command_jointocreate_error_bot_permissions", { ns: "jointocreate" })
            });
            return;
        }
        await setVoiceConfig(guildId, channel.id, true);

        await interaction.editReply({
            content: i18next.t("command_jointocreate_set_success", {ns: "jointocreate", a1: channel.toString()})
        });

        info(`Canal maestro de Join to Create establecido en ${channel.name} (${channel.id}) en servidor ${guildId}`, "JoinToCreate");
    } catch (err) {
        error(`Error estableciendo canal maestro: ${err}`, "JoinToCreate");
        await interaction.editReply({
            content: i18next.t("command_jointocreate_set_error", { ns: "jointocreate" })
        });
    }
}

// =============== Desactivar =============== //

async function disableSystem(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const config = await getVoiceConfig(guildId);
        
        if (!config) {
            await interaction.editReply({
                content: i18next.t("command_jointocreate_error_not_configured", { ns: "jointocreate" })
            });
            return;
        }

        await removeVoiceConfig(guildId);

        await interaction.editReply({
            content: i18next.t("command_jointocreate_disable_success", { ns: "jointocreate" })
        });

        info(`Sistema Join to Create desactivado en servidor ${guildId}`, "JoinToCreate");

    } catch (err) {
        error(`Error desactivando sistema: ${err}`, "JoinToCreate");
        await interaction.editReply({
            content: i18next.t("command_jointocreate_disable_error", { ns: "jointocreate" })
        });
    }
}

// =============== Status =============== //

async function showStatus(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const config = await getVoiceConfig(guildId);
        const tempChannelsCount = await getGuildTempChannelCount(guildId);

        if (!config) {
            await interaction.editReply({
                content: i18next.t("command_jointocreate_error_not_configured", { ns: "jointocreate" })
            });
            return;
        }

        const statusMessage = [
            `**🎤 Estado del Sistema Join to Create**`,
            `**Canal Maestro:** <#${config.channelId}>`,
            `**Estado:** ${config.enabled ? '✅ **ACTIVADO**' : '❌ **DESACTIVADO**'}`,
            `**Canales Temporales Activos:** ${tempChannelsCount}`,
        ].join('\n');

        await interaction.editReply({
            content: statusMessage
        });

    } catch (err) {
        error(`Error mostrando estado: ${err}`, "JoinToCreate");
        await interaction.editReply({
            content: i18next.t("command_jointocreate_status_error", { ns: "jointocreate" })
        });
    }
}

// =============== Limpia canales Manual =============== //

async function cleanupChannels(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
    const confirmButton = new ButtonBuilder()
        .setCustomId('confirm_delete')
        .setLabel('ELIMINAR!!')
        .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
        .setCustomId('cancel_delete')
        .setLabel('Cancelar')
        .setStyle(ButtonStyle.Secondary);

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(cancelButton, confirmButton);

    const confirmMessage = i18next.t("command_jointocreate_cleanup_confirm", { ns: "jointocreate" });
    
    await interaction.reply({
        content: confirmMessage,
        components: [actionRow],
        flags: MessageFlags.Ephemeral
    });

    // Timeout, 20 segundos
    try {
        const buttonInteraction = await interaction.channel?.awaitMessageComponent({
            filter: (i) => i.customId === 'confirm_delete' || i.customId === 'cancel_delete',
            time: 20000
        }) as ButtonInteraction;

        if (buttonInteraction.customId === 'cancel_delete') {
            await buttonInteraction.update({
                content: i18next.t("command_jointocreate_cleanup_cancelled", { ns: "jointocreate" }),
                components: []
            });
            return;
        }

        if (buttonInteraction.customId === 'confirm_delete') {
            await buttonInteraction.deferUpdate();
            
            const allTempChannels = await getAllTempVoiceChannels();
            const guildTempChannels = allTempChannels.filter(ch => ch.guildId === guildId);
            let deletedCount = 0;
            let errorCount = 0;

            for (const tempChannel of guildTempChannels) {
                try {
                    const channel = await interaction.guild?.channels.fetch(tempChannel.channelId);
                    if (channel && channel.isVoiceBased()) {
                        await channel.delete("Limpieza manual de canales temporales");
                        deletedCount++;
                    }
                } catch (err) {
                    errorCount++;
                    debug(`Error eliminando canal ${tempChannel.channelId}: ${err}`, "JoinToCreate");
                }
            }

            // Actualizar mensaje con resultados
            await buttonInteraction.editReply({
                content: i18next.t("command_jointocreate_cleanup_result", { 
                    ns: "jointocreate", 
                    a1: deletedCount, 
                    a2: errorCount
                }),
                components: []
            });

            info(`Limpieza manual: ${deletedCount} canales eliminados, ${errorCount} errores en servidor ${guildId}`, "JoinToCreate");
        }

    } catch (err) {
        // Timeout o error
        if (err instanceof Error && err.message.includes('time')) {
            await interaction.editReply({
                content: i18next.t("command_jointocreate_cleanup_timeout", { ns: "jointocreate" }),
                components: []
            });
        } else {
            error(`Error en limpieza: ${err}`, "JoinToCreate");
            await interaction.editReply({
                content: i18next.t("command_jointocreate_cleanup_error", { ns: "jointocreate" }),
                components: []
            });
        }
    }
}