// src/client/commands/work.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags, PermissionFlagsBits } from "discord.js";
import i18next from "i18next";
import { error, debug } from "../../sys/logging";
import { hasPermission } from "../../sys/zGears/mPermission";
import { getConfigMap, setChannelConfig } from "../../sys/DB-Engine/links/ReplyBots";
import { ChannelConfig } from "../_resources";

export async function registerWorkCommand(): Promise<SlashCommandBuilder[]> {
  const workCommand = new SlashCommandBuilder()
    .setName("work")
    .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
    .setDescription(i18next.t("work_command_description", { ns: "work" }))
    .addStringOption((option) => option
        .setName("mode").setDescription(i18next.t("work_command_state_description", { ns: "work" }))
        .setRequired(true)
        .addChoices({ name: "workhere", value: "where" }, { name: "replybots", value: "rbots" })
      )
    .addStringOption((option) => option
        .setName("turn").setDescription(i18next.t("work_command_mode_description", { ns: "work" }))
        .setRequired(true)
        .addChoices({ name: "on", value: "on" }, { name: "off", value: "off" }));

  return [workCommand] as SlashCommandBuilder[];
}

export async function handleWorkCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const isAllowed = hasPermission(interaction, interaction.commandName);
    if (!isAllowed) {
      await interaction.reply({
        content: i18next.t("command_permission_error", { ns: "work" }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const state = interaction.options.getString("mode");
    switch (state) {
      case "where":
        await where(interaction);
        break;
      case "rbots":
        await replybots(interaction);
        break;
      default:
        await interaction.reply({
          content: i18next.t("work_command_invalid_state", { ns: "work" }),
          flags: MessageFlags.Ephemeral,
        });
        break;
    }
  } catch (err) {
    error(`Error en handleWorkCommand: ${err}`);
  }
}

/* =============== WORKHERE  =============== */

async function where(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const state = interaction.options.getString("turn", true);
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

/* =============== REPLYBOTS  =============== */

async function replybots(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const state = interaction.options.getString("turn", true);
    const guildId = interaction.guild?.id;
    const channelId = interaction.channel?.id;

    if (!guildId || !channelId) {
      throw new Error(i18next.t("error_identifying_server", { ns: "work" }));
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
        response = i18next.t("replybots_command_already_on", { ns: "work" });
      } else {
        setChannelConfig(guildId, channelId, { enabled: currentConfig?.enabled ?? true, replyBots: true });
        response = i18next.t("replybots_command_on_success", { ns: "work" });
      }
    } else {
      if (currentConfig?.replyBots === false) {
        response = i18next.t("replybots_command_already_off", { ns: "work" });
      } else {
        setChannelConfig(guildId, channelId, { enabled: currentConfig?.enabled ?? true, replyBots: false });
        response = i18next.t("replybots_command_off_success", { ns: "work" });
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
      content: i18next.t("command_error", { ns: "work" }),
      flags: MessageFlags.Ephemeral,
    });
  }
}
