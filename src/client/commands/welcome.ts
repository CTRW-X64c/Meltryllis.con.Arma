// src/client/commands/welcome.ts
import { SlashCommandBuilder, MessageFlags, PermissionFlagsBits, ChatInputCommandInteraction, ChannelType } from "discord.js";
import i18next from "i18next";
import { error } from "../../sys/logging";
import { hasPermission } from "../../sys/zGears/mPermission";
import { setWelcomeConfig, getWelcomeConfig } from "../../sys/DB-Engine/links/Welcome";

export async function registerWelcomeCommand(): Promise<SlashCommandBuilder[]> {
    const welcomeCommand = new SlashCommandBuilder()
        .setName("welcome")
        .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
        .setDescription(i18next.t("command_welcome_description", { ns: "welcome" }))
        .addSubcommand((subcommand) =>
            subcommand
                .setName("set")
                .setDescription(i18next.t("command_welcome_config_description", { ns: "welcome" }))
                .addChannelOption((option) =>
                    option
                        .setName("channel")
                        .setDescription(i18next.t("command_welcome_channel_description", { ns: "welcome" }))
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
                .addBooleanOption((option) =>
                    option
                        .setName("enabled")
                        .setDescription(i18next.t("command_welcome_enabled_description", { ns: "welcome" }))
                        .setRequired(false)
                )
                .addStringOption((option) =>
                    option
                        .setName("message")
                        .setDescription(i18next.t("command_welcome_message_description", { ns: "welcome" }))
                        .setRequired(false)
                )
        );
    return [welcomeCommand] as SlashCommandBuilder[];
}

export async function handleWelcomeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
        const isAllowed = hasPermission(interaction, interaction.commandName);
        if (!isAllowed) {
            await interaction.reply({
                content: i18next.t("command_permission_error", { ns: "rolemoji" }),
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const channel = interaction.options.getChannel("channel");
        const enabled = interaction.options.getBoolean("enabled");
        const messageContent = interaction.options.getString("message");
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId!;

        if (subcommand === "configurar") {
            const currentConfig = await getWelcomeConfig(guildId);
            
            const newConfig = {
                channelId: channel ? channel.id : currentConfig.channelId,
                enabled: enabled !== null ? enabled : currentConfig.enabled,
                customMessage: messageContent !== null ? messageContent : currentConfig.customMessage
            };

            await setWelcomeConfig(guildId, newConfig);

            await interaction.reply({
                content: i18next.t("command_welcome_config_set", { ns: "welcome" }),
                flags: MessageFlags.Ephemeral,
            });
        }
    } catch (err) {
        error(`Error al ejecutar comando /welcome: ${err}`, "WelcomeCommand");
        await interaction.reply({
            content: i18next.t("command_error", { ns: "welcome" }),
            flags: MessageFlags.Ephemeral,
        });
    }
}