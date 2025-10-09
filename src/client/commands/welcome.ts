// src/client/modules/welcome.ts
import { SlashCommandBuilder, MessageFlags, PermissionFlagsBits, ChatInputCommandInteraction, ChannelType } from "discord.js";
import i18next from "i18next";
import { error } from "../../logging";
import { setWelcomeConfig, getWelcomeConfig } from "../database";

export async function registerWelcomeCommand(): Promise<SlashCommandBuilder[]> {
    const welcomeCommand = new SlashCommandBuilder()
        .setName("welcome")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDescription(i18next.t("command_welcome_description", { ns: "common" }) || "Configura el canal y el estado de los banners de bienvenida y despedida.")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("set")
                .setDescription(i18next.t("command_welcome_config_description", { ns: "common" }) || "Configura el canal y el estado de la bienvenida.")
                .addChannelOption((option) =>
                    option
                        .setName("channel")
                        .setDescription(i18next.t("command_welcome_channel_description", { ns: "common" }) || "El canal donde se enviarán los banners.")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
                .addBooleanOption((option) =>
                    option
                        .setName("enabled")
                        .setDescription(i18next.t("command_welcome_enabled_description", { ns: "common" }) || "Habilitar o deshabilitar los banners de bienvenida.")
                        .setRequired(false)
                )
                .addStringOption((option) =>
                    option
                        .setName("message")
                        .setDescription(i18next.t("command_welcome_message_description", { ns: "common" }) || "Mensaje personalizado para la bienvenida. Usa {user} para mencionar y {channel} para el canal.")
                        .setRequired(false)
                )
        );
    return [welcomeCommand] as SlashCommandBuilder[];
}

export async function handleWelcomeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
        const memberPermissions = interaction.memberPermissions;
        const isAdmin = memberPermissions?.has(PermissionFlagsBits.ManageGuild) || interaction.guild?.ownerId === interaction.user.id;
        if (!isAdmin) {
            await interaction.reply({
                content: i18next.t("command_permission_error", { ns: "common" }) || "Solo los administradores o el propietario pueden usar este comando.",
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
                content: i18next.t("command_welcome_config_set", { ns: "common" }) || `La configuración de bienvenida ha sido actualizada.`,
                flags: MessageFlags.Ephemeral,
            });
        }
    } catch (err) {
        error(`Error al ejecutar comando /welcome: ${err}`, "WelcomeCommand");
        await interaction.reply({
            content: i18next.t("command_error", { ns: "common" }) || "Ocurrió un error al ejecutar el comando.",
            flags: MessageFlags.Ephemeral,
        });
    }
}