// src/Events-Commands/commands/work.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags, PermissionFlagsBits } from "discord.js";
import i18next from "i18next";
import { error, debug } from "../../sys/logging";
import { hasPermission } from "../../sys/zGears/mPermission";
import { getConfigMap, setChannelConfig } from "../../sys/DB-Engine/links/ReplyBots";

export async function registerWorkCommand(): Promise<SlashCommandBuilder[]> {
  const workCommand = new SlashCommandBuilder()
    .setName("work")
    .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
    .setDescription(i18next.t("commands:work.slashBuilder.description"))
    .addStringOption((o) => o.setName("mode").setDescription(i18next.t("commands:work.slashBuilder.state_description")).setRequired(true)
      .addChoices({ name: "workhere", value: "where" }, { name: "replybots", value: "rbots" })
    )
    .addStringOption((o) => o.setName("turn").setDescription(i18next.t("commands:work.slashBuilder.mode_description")).setRequired(true)
      .addChoices({ name: "on", value: "on" }, { name: "off", value: "off" })
    )
  return [workCommand] as SlashCommandBuilder[];
}

const isRunning = new Map<string, boolean>()
export async function handleWorkCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) { await interaction.reply(i18next.t("common:Errores.noGuild")); return; }

  const isAllowed = await hasPermission(interaction, interaction.commandName);
  if (!isAllowed) { await interaction.reply({ content: i18next.t("common:Errores.isAllowed"), flags: MessageFlags.Ephemeral, }); return; }

  try {
    if (isRunning.get(guild.id)) { await interaction.editReply({ content: i18next.t("common:Errores.isRunning", { a1: interaction.commandName }) }); return; };
    isRunning.set(guild.id, true)

    const state = interaction.options.getString("mode");
    switch (state) {
      case "where":
        await where(interaction);
        break;
      case "rbots":
        await replybots(interaction);
        break;
      default:
        await interaction.reply({ content: i18next.t("commands:work.interacciones.command_error"), flags: MessageFlags.Ephemeral, });
        break;
    }
  } catch (err) {
    error(`Error en handleWorkCommand: ${err}`);
    if (interaction.replied || interaction.deferred) { await interaction.editReply(i18next.t("common:Errores.switch_catch_err", { a1: interaction.commandName })); }
    else { await interaction.reply({ content: i18next.t("common:Errores.switch_catch_err", { a1: interaction.commandName }), flags: MessageFlags.Ephemeral }); }
  } finally { isRunning.delete(guild.id) }
}

/* =============== INTERFAZ =============== */

interface ChannelConfig {
  enabled: boolean;
  replyBots: boolean;
}

/* =============== WORKHERE =============== */

async function where(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const state = interaction.options.getString("turn", true);
    const guildId = interaction.guild?.id;
    const channelId = interaction.channel?.id;

    if (!guildId || !channelId) {
      throw new Error(i18next.t("commands:work.interacciones.error_identifying_channel"));
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
        response = i18next.t("commands:work.interacciones.already_on");
      } else {
        setChannelConfig(guildId, channelId, { enabled: true, replyBots: currentConfig?.replyBots ?? false });
        response = i18next.t("commands:work.interacciones.on_success") || "Bueno, estoy de regreso 😎";
      }
    } else {
      if (currentConfig?.enabled === false) {
        response = i18next.t("commands:work.interacciones.already_off");
      } else {
        setChannelConfig(guildId, channelId, { enabled: false, replyBots: currentConfig?.replyBots ?? false });
        response = i18next.t("commands:work.interacciones.off_success");
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
      content: i18next.t("commands:work.interacciones.command_error"),
      flags: MessageFlags.Ephemeral,
    });
  }
}

/* =============== REPLYBOTS =============== */

async function replybots(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const state = interaction.options.getString("turn", true);
    const guildId = interaction.guild?.id;
    const channelId = interaction.channel?.id;

    if (!guildId || !channelId) {
      throw new Error(i18next.t("commands:work.interaccionesRole.identifying_server"));
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
        response = i18next.t("commands:work.interaccionesRole.already_on");
      } else {
        setChannelConfig(guildId, channelId, { enabled: currentConfig?.enabled ?? true, replyBots: true });
        response = i18next.t("commands:work.interaccionesRole.on_success");
      }
    } else {
      if (currentConfig?.replyBots === false) {
        response = i18next.t("commands:work.interaccionesRole.already_off");
      } else {
        setChannelConfig(guildId, channelId, { enabled: currentConfig?.enabled ?? true, replyBots: false });
        response = i18next.t("commands:work.interaccionesRole.off_success");
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
      content: i18next.t("commands:work.interacciones.command_error"),
      flags: MessageFlags.Ephemeral,
    });
  }
}
