// src/client/commands/work.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags, PermissionFlagsBits } from "discord.js";
import i18next from "i18next";
import { error, debug } from "../../sys/logging";
import { getConfigMap, setChannelConfig } from "../../sys/database";
import { ChannelConfig } from "../_resources";

export async function registerWorkCommand(): Promise<SlashCommandBuilder[]> {
  const workCommand = new SlashCommandBuilder()
    .setName("work")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDescription(i18next.t("work_command_description", { ns: "work" }))
    .addStringOption((option) =>
      option.setName("state").setDescription(i18next.t("work_command_state_description", { ns: "work" }))
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
        content: i18next.t("command_permission_error", { ns: "work" }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const state = interaction.options.getString("state", true);
    const guildId = interaction.guild?.id;
    const channelId = interaction.channel?.id;

    if (!guildId || !channelId) {
      throw new Error(i18next.t("error_identifying_channel", { ns: "work" }));
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
        response = i18next.t("work_command_already_on", { ns: "work" });
      } else {
        setChannelConfig(guildId, channelId, { enabled: true, replyBots: currentConfig?.replyBots ?? false });
        response = i18next.t("work_command_on_success", { ns: "work" }) || "Bueno, estoy de regreso 😎";
      }
    } else {
      if (currentConfig?.enabled === false) {
        response = i18next.t("work_command_already_off", { ns: "work" });
      } else {
        setChannelConfig(guildId, channelId, { enabled: false, replyBots: currentConfig?.replyBots ?? false });
        response = i18next.t("work_command_off_success", { ns: "work" });
      }
    }

    await interaction.reply({
      content: response,
      flags: MessageFlags.Ephemeral,
    });
    debug(`Comando /work ejecutado. Estado: ${isEnabled ? "On" : "Off"}, Canal: ${channelId}`, "Commands.Work"); //<=
  } catch (err) {
    error(`Error al ejecutar comando /work: ${err}`); //<=
    await interaction.reply({
      content: i18next.t("command_error", { ns: "work" }),
      flags: MessageFlags.Ephemeral,
    });
  }
}