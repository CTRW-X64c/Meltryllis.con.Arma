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
        .setDescription(i18next.t("command_welcome_description", { ns: "welcome" }))
        .addSubcommand((subcommand) =>
            subcommand
                .setName("set")
                .setDescription(i18next.t("command_welcome_config_description", { ns: "welcome" }))
                .addStringOption((option) =>
                    option
                        .setName("message")
                        .setDescription(i18next.t("command_welcome_message_description", { ns: "welcome" }))
                        .setRequired(false)
                )
                .addChannelOption((option) =>
                    option
                        .setName("channel")
                        .setDescription(i18next.t("command_welcome_channel_description", { ns: "welcome" }))
                        .addChannelTypes(ChannelType.GuildText, ChannelType.PrivateThread, ChannelType.PublicThread, ChannelType.GuildAnnouncement)
                        .setRequired(false)
                )
                .addBooleanOption((option) =>
                    option
                        .setName("borrar")
                        .setDescription(i18next.t("command_welcome_enabled_description", { ns: "welcome" }))
                        .setRequired(false)
                )
        );
    return [welcomeCommand] as SlashCommandBuilder[];
}

export async function handleWelcomeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
        const isAllowed = await hasPermission(interaction, interaction.commandName);
        if (!isAllowed) {
            await interaction.reply({ content: i18next.t("command_permission_error", { ns: "rolemoji" }), flags: MessageFlags.Ephemeral }); return;
        }
         
const channelOption = interaction.options.getChannel("channel"); 
        const shouldDelete = interaction.options.getBoolean("borrar") || false;
        const messageContent = interaction.options.getString("message");
        const guildId = interaction.guildId!;
        
        if (!shouldDelete && !channelOption && messageContent === null) {
            await interaction.reply({content: i18next.t("no_choises_selected", { ns: "welcome" }), flags: MessageFlags.Ephemeral });
            return;
        }

        const oldConfig = await getWelcomeConfig(guildId);
        if (shouldDelete === true) {
            if (!oldConfig.channelId) { 
                await interaction.reply({content: i18next.t("command_not_doing_nothing", { ns: "welcome" }), flags: MessageFlags.Ephemeral });
                return;
            }
            await removeWelcomeConfig(guildId);
            await interaction.reply({content: i18next.t("command_welcome_config_removed", { ns: "welcome" }), flags: MessageFlags.Ephemeral });
            return;
        }

        const newConfig = {
            channelId: channelOption ? channelOption.id : oldConfig.channelId,
            enabled: true,
            customMessage: messageContent !== null ? messageContent : oldConfig.customMessage
        };

        await setWelcomeConfig(guildId, newConfig);
        await interaction.reply({content: i18next.t("command_welcome_config_set", { ns: "welcome" }), flags: MessageFlags.Ephemeral });

    } catch (err) {
        error(`Error al ejecutar comando /welcome: ${err}`, "WelcomeCommand");
        await interaction.reply({ content: i18next.t("command_error", { ns: "welcome" }), flags: MessageFlags.Ephemeral });
    }
}