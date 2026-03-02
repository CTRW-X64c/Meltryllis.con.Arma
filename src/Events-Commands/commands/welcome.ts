// src/Events-Commands/commands/welcome.ts
import { SlashCommandBuilder, MessageFlags, PermissionFlagsBits, ChatInputCommandInteraction, ChannelType } from "discord.js";
import i18next from "i18next";
import { error } from "../../sys/logging";
import { hasPermission } from "../../sys/zGears/mPermission";
import { setWelcomeConfig, getWelcomeConfig, removeWelcomeConfig } from "../../sys/DB-Engine/links/Welcome";

export async function registerWelcomeCommand(): Promise<SlashCommandBuilder[]> {
    const welcomeCommand = new SlashCommandBuilder()
        .setName("welcome")
        .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
        .setDescription(i18next.t("welcome:slashBuilder.description"))
        .addSubcommand((subcommand) =>
            subcommand
                .setName("set")
                .setDescription(i18next.t("welcome:slashBuilder.config_description"))
                .addStringOption((option) =>
                    option
                        .setName("message")
                        .setDescription(i18next.t("welcome:slashBuilder.message_description"))
                        .setRequired(false)
                )
                .addChannelOption((option) =>
                    option
                        .setName("channel")
                        .setDescription(i18next.t("welcome:slashBuilder.channel_description"))
                        .addChannelTypes(ChannelType.GuildText, ChannelType.PrivateThread, ChannelType.PublicThread, ChannelType.GuildAnnouncement)
                        .setRequired(false)
                )
                .addBooleanOption((option) =>
                    option
                        .setName("borrar")
                        .setDescription(i18next.t("welcome:slashBuilder.enabled_description"))
                        .setRequired(false)
                )
        );
    return [welcomeCommand] as SlashCommandBuilder[];
}

export async function handleWelcomeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
        const isAllowed = await hasPermission(interaction, interaction.commandName);
        if (!isAllowed) {
            await interaction.reply({ content: i18next.t("common:Errores.isAllowed"), flags: MessageFlags.Ephemeral }); return;
        }
         
const channelOption = interaction.options.getChannel("channel"); 
        const shouldDelete = interaction.options.getBoolean("borrar") || false;
        const messageContent = interaction.options.getString("message");
        const guildId = interaction.guildId!;
        
        if (!shouldDelete && !channelOption && messageContent === null) {
            await interaction.reply({content: i18next.t("welcome:interacciones.no_choises_selected"), flags: MessageFlags.Ephemeral });
            return;
        }

        const oldConfig = await getWelcomeConfig(guildId);
        if (shouldDelete === true) {
            if (!oldConfig.channelId) { 
                await interaction.reply({content: i18next.t("welcome:interacciones.not_doing_nothing"), flags: MessageFlags.Ephemeral });
                return;
            }
            await removeWelcomeConfig(guildId);
            await interaction.reply({content: i18next.t("welcome:interacciones.config_removed"), flags: MessageFlags.Ephemeral });
            return;
        }

        const newConfig = {
            channelId: channelOption ? channelOption.id : oldConfig.channelId,
            enabled: true,
            customMessage: messageContent !== null ? messageContent : oldConfig.customMessage
        };

        await setWelcomeConfig(guildId, newConfig);
        await interaction.reply({content: i18next.t("welcome:interacciones.welcome_config_set"), flags: MessageFlags.Ephemeral });

    } catch (err) {
        error(`Error al ejecutar comando /welcome: ${err}`, "WelcomeCommand");
        await interaction.reply({ content: i18next.t("welcome:interacciones.error"), flags: MessageFlags.Ephemeral });
    }
}