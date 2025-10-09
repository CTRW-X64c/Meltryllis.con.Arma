// src/client/modules/work.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags, PermissionFlagsBits } from "discord.js";
import i18next from "i18next";
import { error, debug } from "../../logging";
import { getConfigMap, setChannelConfig } from "../database"; // Eliminamos saveDatabase
import { ChannelConfig } from "../upCommands";

export async function registerWorkCommand(): Promise<SlashCommandBuilder[]> {
  const workCommand = new SlashCommandBuilder()
    .setName("work")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDescription(i18next.t("work_command_description", { ns: "common" }) || "Activa o desactiva el bot en este canal.")
    .addStringOption((option) =>
      option.setName("state").setDescription(i18next.t("work_command_state_description", { ns: "common" }) || "Estado del bot: on o off")
        .setRequired(true).addChoices({ name: "On", value: "on" }, { name: "Off", value: "off" })
    );
  return [workCommand] as SlashCommandBuilder[];
}

export async function handleWorkCommand(interaction: ChatInputCommandInteraction): Promise<void> {
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

    const state = interaction.options.getString("state", true);
    const guildId = interaction.guild?.id;
    const channelId = interaction.channel?.id;

    if (!guildId || !channelId) {
      throw new Error("No se pudo identificar el servidor o el canal.");
    }

    const configMap = await getConfigMap(); // Usar await
    let guildConfig = configMap.get(guildId);
    if (!guildConfig) {
      guildConfig = new Map<string, ChannelConfig>();
      configMap.set(guildId, guildConfig); // Esto no será persistente hasta que lo guardes en la DB
    }

    const isEnabled = state === "on";
    const currentConfig = guildConfig.get(channelId);
    let response = "";

    if (isEnabled) {
      if (currentConfig?.enabled === true) {
        response = i18next.t("work_command_already_on", { ns: "common" }) || "¡Ya estoy trabajando en este canal! 😎";
      } else {
        setChannelConfig(guildId, channelId, { enabled: true, replyBots: currentConfig?.replyBots ?? false });
        response = i18next.t("work_command_on_success", { ns: "common" }) || "Bueno, estoy de regreso 😎";
      }
    } else {
      if (currentConfig?.enabled === false) {
        response = i18next.t("work_command_already_off", { ns: "common" }) || "¡Ya estoy desactivado en este canal! 🫶";
      } else {
        setChannelConfig(guildId, channelId, { enabled: false, replyBots: currentConfig?.replyBots ?? false });
        response = i18next.t("work_command_off_success", { ns: "common" }) || "Bye bye, te veo en otros canales 🫶";
      }
    }

    await interaction.reply({
      content: response,
      flags: MessageFlags.Ephemeral,
    });
    debug(`Comando /work ejecutado: ${isEnabled ? "On" : "Off"} en canal ${channelId}`, "Commands.Work");
  } catch (err) {
    error(`Error al ejecutar comando /work: ${err}`, "Commands.Work");
    await interaction.reply({
      content: i18next.t("command_error", { ns: "common" }) || "Ocurrió un error al ejecutar el comando.",
      flags: MessageFlags.Ephemeral,
    });
  }
}