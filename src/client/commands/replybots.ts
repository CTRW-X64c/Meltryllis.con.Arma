// src/client/commands/replybots.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags, PermissionFlagsBits } from "discord.js";
import i18next from "i18next";
import { error, debug } from "../../sys/logging";
import { getConfigMap, setChannelConfig } from "../../sys/DB-Engine/links/ReplyBots"; 
import { hasPermission } from "../../sys/managerPermission";
import { ChannelConfig } from "../_resources";

export async function registerReplybotsCommand(): Promise<SlashCommandBuilder[]> {
  const replyBotsCommand = new SlashCommandBuilder()
    .setName("replybots")
    .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
    .setDescription(i18next.t("replybots_command_description", { ns: "replybots" }))
    .addStringOption((option) =>
      option.setName("state").setDescription(i18next.t("replybots_command_state_description", { ns: "replybots" }))
        .setRequired(true).addChoices({ name: "On", value: "on" }, { name: "Off", value: "off" })
    );
  return [replyBotsCommand] as SlashCommandBuilder[];
}

export async function handleReplybotsCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const isAllowed = hasPermission(interaction, interaction.commandName);
    if (!isAllowed) {
      await interaction.reply({
        content: i18next.t("command_permission_error", { ns: "replybots" }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const state = interaction.options.getString("state", true);
    const guildId = interaction.guild?.id;
    const channelId = interaction.channel?.id;

    if (!guildId || !channelId) {
      throw new Error(i18next.t("error_identifying_server", { ns: "replybots" }));
    }

    const configMap = await getConfigMap(); 
    let guildConfig = configMap.get(guildId);
    if (!guildConfig) {
      guildConfig = new Map<string, ChannelConfig>();
      configMap.set(guildId, guildConfig); 
    }

    const isReplyBots = state === "on";
    const currentConfig = guildConfig.get(channelId);
    let response = "";

    if (isReplyBots) {
      if (currentConfig?.replyBots === true) {
        response = i18next.t("replybots_command_already_on", { ns: "replybots" });
      } else {
        setChannelConfig(guildId, channelId, { enabled: currentConfig?.enabled ?? true, replyBots: true });
        response = i18next.t("replybots_command_on_success", { ns: "replybots" });
      }
    } else {
      if (currentConfig?.replyBots === false) {
        response = i18next.t("replybots_command_already_off", { ns: "replybots" });
      } else {
        setChannelConfig(guildId, channelId, { enabled: currentConfig?.enabled ?? true, replyBots: false });
        response = i18next.t("replybots_command_off_success", { ns: "replybots" });
      }
    }

    await interaction.reply({
      content: response,
      flags: MessageFlags.Ephemeral,
    });
    debug(`Comando /replybots ejecutado. Estado: ${isReplyBots ? "On" : "Off"}, Canal: ${channelId}`); 
  } catch (err) {
    error(`Error al ejecutar comando /replybots: ${err}`); 
    await interaction.reply({
      content: i18next.t("command_error", { ns: "replybots" }),
      flags: MessageFlags.Ephemeral,
    });
  }
}
