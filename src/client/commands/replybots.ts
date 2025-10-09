// src/client/modules/replybots.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags, PermissionFlagsBits } from "discord.js";
import i18next from "i18next";
import { error, debug } from "../../logging";
import { getConfigMap, setChannelConfig } from "../database"; // Eliminamos saveDatabase
import { ChannelConfig } from "../upCommands";

export async function registerReplybotsCommand(): Promise<SlashCommandBuilder[]> {
  const replyBotsCommand = new SlashCommandBuilder()
    .setName("replybots")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDescription(i18next.t("replybots_command_description", { ns: "common" }) || "Activa o desactiva la respuesta a otros bots en este canal.")
    .addStringOption((option) =>
      option.setName("state").setDescription(i18next.t("replybots_command_state_description", { ns: "common" }) || "Estado de respuesta a bots: on o off")
        .setRequired(true).addChoices({ name: "On", value: "on" }, { name: "Off", value: "off" })
    );
  return [replyBotsCommand] as SlashCommandBuilder[];
}

export async function handleReplybotsCommand(interaction: ChatInputCommandInteraction): Promise<void> {
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

    const isReplyBots = state === "on";
    const currentConfig = guildConfig.get(channelId);
    let response = "";

    if (isReplyBots) {
      if (currentConfig?.replyBots === true) {
        response = i18next.t("replybots_command_already_on", { ns: "common" }) || "¡Ya estoy respondiendo a bots en este canal! 😊🤖";
      } else {
        setChannelConfig(guildId, channelId, { enabled: currentConfig?.enabled ?? true, replyBots: true });
        response = i18next.t("replybots_command_on_success", { ns: "common" }) || "Ahora contesto a bots 😊🤖";
      }
    } else {
      if (currentConfig?.replyBots === false) {
        response = i18next.t("replybots_command_already_off", { ns: "common" }) || "¡Ya no estoy respondiendo a bots en este canal! 😊";
      } else {
        setChannelConfig(guildId, channelId, { enabled: currentConfig?.enabled ?? true, replyBots: false });
        response = i18next.t("replybots_command_off_success", { ns: "common" }) || "Ya no contestaré a bots 😊";
      }
    }

    await interaction.reply({
      content: response,
      flags: MessageFlags.Ephemeral,
    });
    debug(`Comando /replybots ejecutado: ${isReplyBots ? "On" : "Off"} en canal ${channelId}`, "Commands.ReplyBots");
  } catch (err) {
    error(`Error al ejecutar comando /replybots: ${err}`, "Commands.ReplyBots");
    await interaction.reply({
      content: i18next.t("command_error", { ns: "common" }) || "Ocurrió un error al ejecutar el comando.",
      flags: MessageFlags.Ephemeral,
    });
  }
}