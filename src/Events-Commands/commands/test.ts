// src/Events-Commands/commands/test.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionsBitField, TextChannel, PermissionFlagsBits} from "discord.js";
import i18next from "i18next";
import { error, debug } from "../../sys/logging";
import { getConfigMap } from "../../sys/DB-Engine/links/ReplyBots";
import { getGuildReplacementConfig } from "../../sys/DB-Engine/links/Embed";
import { replacementMetaList } from "../../sys/embedding/EmbedingConfig";
import { hasPermission } from "../../sys/zGears/mPermission";
import { checkAllDomains, buildDomainStatusEmbed } from "../../sys/zGears/neTools";
import { checkCooldown, startCooldown } from "../../sys/zGears/auxiliares";

const sfwDomains = process.env.EMBEDEZ_SFW ? process.env.EMBEDEZ_SFW.split('|').map(s => s.trim()) : [];
const nsfwDomains = process.env.EMBEDEZ_NSFW ? process.env.EMBEDEZ_NSFW.split('|').map(s => s.trim()) : [];

export async function registerTestCommand(): Promise<SlashCommandBuilder[]> {
  const testCommand = new SlashCommandBuilder()
    .setName("test")
    .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
    .setDescription(i18next.t("embSys:test.slashBuilder.test_description"))
    .addStringOption((option) =>
      option
        .setName("mode")
        .setDescription(i18next.t("embSys:test.slashBuilder.mode_description"))
        .setRequired(false)
        .addChoices(
          { name: i18next.t("embSys:test.slashBuilder.guild"), value: "channel" },
          { name: i18next.t("embSys:test.slashBuilder.channel"), value: "guild" },
          { name: i18next.t("embSys:test.slashBuilder.embed_config"), value: "embed" },
          { name: i18next.t("embSys:test.slashBuilder.mode_domainds"), value: "chekdimains" }
        )
    ) as SlashCommandBuilder;

  return [testCommand];
}

export async function handleTestCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const isAllowed = await hasPermission(interaction, interaction.commandName);
    if (!isAllowed) {
      await interaction.reply({
        content: i18next.t("common:Errores.isAllowed"),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const mode = interaction.options.getString("mode") ?? "channel";
    const configMap = await getConfigMap();
    const baseEmbed = new EmbedBuilder()
      .setTitle(i18next.t("embSys:test.interacciones.title"));
    const embeds: EmbedBuilder[] = [baseEmbed];

    // Inicio de seccion switch para subcomandos
    switch (mode) {
      case "channel":
        await guildPermision(interaction, baseEmbed );
        break;
      
      case "guild":
        await allChannels(interaction, embeds, configMap );
        break;
      
      case "embed":
        await ComEmbed(interaction, baseEmbed);
        break;

      case "chekdimains":
        await ChekDomainsTest(interaction);
        return;

      default:
        baseEmbed.setDescription(i18next.t("embSys:test.interacciones.test_command_invalid_mode"))
             .setColor("#ff0000");
        break;
    }
     // Termino de seccion switch para subcomandos
    await interaction.reply({ embeds: embeds, flags: MessageFlags.Ephemeral });
    debug(`Comando /test ejecutado en modo: ${mode}`); //<=
  } catch (err) {
    error(`Error al ejecutar comando /test: ${err}`); //<=
      if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: i18next.t("embSys:test.interacciones.test_command_invalid_mode"),
        flags: MessageFlags.Ephemeral,
    });
  }else if (!interaction.replied) {
    await interaction.editReply({
      content: i18next.t("embSys:test.interacciones.test_command_invalid_mode"),
    });
}}}

/* ========================= Permisos Generales ========================= */

async function guildPermision(interaction: ChatInputCommandInteraction, embed: EmbedBuilder): Promise<void> {
  const requiredPermissions = [
    { name: i18next.t("embSys:test.permisos.view_channel"), bit: PermissionsBitField.Flags.ViewChannel },
    { name: i18next.t("embSys:test.permisos.send_messages"), bit: PermissionsBitField.Flags.SendMessages },
    { name: i18next.t("embSys:test.permisos.embed_links"), bit: PermissionsBitField.Flags.EmbedLinks },
    { name: i18next.t("embSys:test.permisos.manage_messages"), bit: PermissionsBitField.Flags.ManageMessages },
    { name: i18next.t("embSys:test.permisos.read_message_history"), bit: PermissionsBitField.Flags.ReadMessageHistory },
    { name: i18next.t("embSys:test.permisos.add_reactions"), bit: PermissionsBitField.Flags.AddReactions },
    { name: i18next.t("embSys:test.permisos.role_manager"), bit: PermissionsBitField.Flags.ManageRoles },
    { name: i18next.t("embSys:test.permisos.channel_manager"), bit: PermissionsBitField.Flags.ManageChannels }
  ];

  const admin = [
    { name: i18next.t("embSys:test.permisos.manage_guild"), bit: PermissionsBitField.Flags.ManageGuild },
    { name: i18next.t("embSys:test.permisos.administrator"), bit: PermissionsBitField.Flags.Administrator }
  ];

  const channel = interaction.channel as TextChannel;
  if (!channel || !("permissionsFor" in channel)) {        
    throw new Error(i18next.t("embSys:test.interacciones.test_error_permission"));
  }

  const botMember = interaction.guild?.members.me;
  if (!botMember) {
    throw new Error(i18next.t("embSys:test.interacciones.test_error_permission_user"));
  }

  const permissions = channel.permissionsFor(botMember);
  if (!permissions) {
    throw new Error(i18next.t("embSys:test.interacciones.test_error_verify_permission"));
  }

  embed
    .setDescription(i18next.t("embSys:test.interacciones.test_command_channel_description"))
    .addFields(
      requiredPermissions.map((perm) => ({
        name: i18next.t("embSys:test.interacciones.permission_name", { name: perm.name }),
        value: permissions.has(perm.bit) ? i18next.t("embSys:test.interacciones.status_allowed") : i18next.t("embSys:test.interacciones.status_missing"),
        inline: false,
      }))
    )
    .addFields(
      admin.map((perm) => ({
        name: i18next.t("embSys:test.interacciones.permission_name", { name: perm.name }),
        value: permissions.has(perm.bit) ? i18next.t("embSys:test.interacciones.status_allowed_admin") : i18next.t("embSys:test.interacciones.status_missing"),
        inline: false,
      }))
    );
  embed.setFooter({ text: i18next.t("embSys:test.interacciones.footer")});
  embed.setColor("#0300c8"); 
}

/* ========================= Todos los coanels ========================= */

async function allChannels(interaction: ChatInputCommandInteraction, embeds: EmbedBuilder[], configMap: Map<string, Map<string, { enabled: boolean; replyBots: boolean }>>,): Promise<void> {
  const guild = interaction.guild;
  const textPermisison = [
    { name: i18next.t("embSys:test.permisos.view_channel"), bit: PermissionsBitField.Flags.ViewChannel },
    { name: i18next.t("embSys:test.permisos.send_messages"), bit: PermissionsBitField.Flags.SendMessages },
    { name: i18next.t("embSys:test.permisos.embed_links"), bit: PermissionsBitField.Flags.EmbedLinks },
    { name: i18next.t("embSys:test.permisos.manage_messages"), bit: PermissionsBitField.Flags.ManageMessages },
    { name: i18next.t("embSys:test.permisos.read_message_history"), bit: PermissionsBitField.Flags.ReadMessageHistory },
    { name: i18next.t("embSys:test.permisos.add_reactions"), bit: PermissionsBitField.Flags.AddReactions },
  ];

  const voicePermision = [
    { name: i18next.t("embSys:test.permisos.view_channel"), bit: PermissionsBitField.Flags.ViewChannel },
    { name: i18next.t("embSys:test.permisos.connect_voice"), bit: PermissionsBitField.Flags.Connect }
  ];

  if (!guild) {
    throw new Error(i18next.t("embSys:test.interacciones.dont_gg"));
  }

  const textChannels = guild.channels.cache.filter(channel => channel.type === 0); // Canales de Texto, Excluye hilos
  const voiceChannels = guild.channels.cache.filter(channel => channel.type === 2); // Canales de Voz
  let globalPermissionsOk = true;

  const channelsArray = [...textChannels.values(), ...voiceChannels.values()];
  const chunkSize = 25;
  const maxChannels = chunkSize * 10;
  const channelsProcess = channelsArray.slice(0, maxChannels);

  embeds[0].setDescription(i18next.t("embSys:test.interacciones.test_command_guild_description"));

  for (let i = 0; i < channelsProcess.length; i += chunkSize) {
    const chunk = channelsProcess.slice(i, i + chunkSize);
    let currentEmbed: EmbedBuilder;

    if (i === 0) {
      currentEmbed = embeds[0];
    } else {
      currentEmbed = new EmbedBuilder().setTitle(i18next.t("embSys:test.interacciones.title") + ` (${Math.floor(i / chunkSize) + 1})`);
      embeds.push(currentEmbed);
    }

    chunk.forEach(channel => {
    const botMember = guild.members.me;
    if (botMember && "permissionsFor" in channel) {
      const permissions = channel.permissionsFor(botMember);

      if (channel.type === 0) {
        const permissionBits = textPermisison.map(p => p.bit);
        const hasPerms = permissions?.has(permissionBits, false) ?? false;
        if (!hasPerms) globalPermissionsOk = false;

        const guildId = guild.id;
        const channelId = channel.id;
        const guildConfig = configMap.get(guildId);
        const channelConfig = guildConfig?.get(channelId) ?? { enabled: true, replyBots: false };

        currentEmbed.addFields({
          name: `Canal: #${channel.name}`,
          value: (hasPerms ? i18next.t("embSys:test.interacciones.all_status_allowed") : i18next.t("embSys:test.interacciones.missing_any_status")) +
            `\n${i18next.t("embSys:test.interacciones.working_here")}: ${channelConfig.enabled ? "✅" : "❌"}` +
            `\n${i18next.t("embSys:test.interacciones.reply_bots")}: ${channelConfig.replyBots ? "✅" : "❌"}`,
          inline: false,
        });

      } else if (channel.type === 2) {
        const permissionBits = voicePermision.map(p => p.bit);
        const hasPerms = permissions?.has(permissionBits, false) ?? false;
        if (!hasPerms) globalPermissionsOk = false;

        currentEmbed.addFields({
          name: `🔊 Voz: ${channel.name}`,
          value: hasPerms ? i18next.t("embSys:test.interacciones.all_status_allowed") : i18next.t("embSys:test.interacciones.missing_any_status"),
          inline: false,
        });
      }
    }
  });
  }

   if (channelsProcess.length > maxChannels) {
    embeds[embeds.length - 1].setFooter({ text: `⚠️ Mostrando primeros ${maxChannels} canales de ${channelsArray.length}.` });
  }

  const color = globalPermissionsOk ? "#00ff00" : "#ff0000";
  embeds.forEach(e => e.setColor(color));
  embeds.forEach(e => e.setFooter({ text: i18next.t("embSys:test.interacciones.footer")}));
}

/* ========================= Embedes Set ========================= */

async function ComEmbed(interaction: ChatInputCommandInteraction, embed: EmbedBuilder): Promise<void> {
  const guildId = interaction.guild?.id;
  if (!guildId) {
    throw new Error(i18next.t("embSys:test.interacciones.dont_gg"));
  }
  
  const replacementConfig = await getGuildReplacementConfig(guildId);
  embed.setDescription(i18next.t("embSys:test.interacciones.not_replacement"));

  const addCategoryFields = (title: string, lines: string[]) => {
    if (lines.length === 0) return;
    
    let currentText = "";
    let partNumber = 1;

    for (const line of lines) {
      if (currentText.length + line.length + '\n'.length > 1000) {
        embed.addFields({ name: `${title} (Pt. ${partNumber})`, value: currentText, inline: false });
        currentText = line + "\n";
        partNumber++;
      } else {
        currentText += line + "\n";
      }
    }
    if (currentText.length > 0) {
      embed.addFields({ name: partNumber > 1 ? `${title} (Pt. ${partNumber})` : title, value: currentText, inline: false });
    }
  };
/* Lista Locales */
  const localLines: string[] = [];
  replacementMetaList.forEach(meta => {
    const config = replacementConfig.get(meta.name);
    let status: string;
    if (config === undefined) {
      status = i18next.t("embSys:test.interacciones.rem_list_1");
    } else if (!config.enabled) {
      status = i18next.t("embSys:test.interacciones.rem_list_2");
    } else if (config.custom_url) {
      const userMention = config.user_id ? `<@${config.user_id}>` : i18next.t("embSys:test.interacciones.unknown_user"); 
      status = i18next.t("embSys:test.interacciones.rem_list_3", { custom_url: config.custom_url, userMention }); 
    } else {
      status = i18next.t("embSys:test.interacciones.rem_list_1");
    }
    localLines.push(`**${meta.name}:** \u200b \u200b \u200b${status}`);
  });
  addCategoryFields("🛠️ Reemplazos Locales", localLines);
/* Lista SFW */
  const sfwLines: string[] = [];
  sfwDomains.forEach(domain => {
    const config = replacementConfig.get(domain);
    const status = (config === undefined || config.enabled) ? 
      i18next.t("embSys:test.interacciones.field_api_enabled") : 
      i18next.t("embSys:test.interacciones.field_api_disabled");
    sfwLines.push(`**${domain}:** \u200b \u200b \u200b${status}`);
  });
  addCategoryFields("🌐 API SFW", sfwLines);
/* Lista SFW */
  const nsfwLines: string[] = [];
  nsfwDomains.forEach(domain => {
    const config = replacementConfig.get(domain);
    const status = (config === undefined || config.enabled) ? 
      i18next.t("embSys:test.interacciones.field_api_enabled") : 
      i18next.t("embSys:test.interacciones.field_api_disabled");
    nsfwLines.push(`**${domain}:** \u200b \u200b \u200b ${status}`);
  });
  addCategoryFields("🔞 API NSFW", nsfwLines);
  embed.setColor(0x0099FF);
}

/* ========================= NeTest ========================= */

export async function ChekDomainsTest(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
        const idCooldown = "netCommand"
        const cooldown = checkCooldown(interaction.guildId!, idCooldown);
        if (cooldown.onCooldown) {
            await interaction.reply({
                content: i18next.t("embSys:test.interacciones.test_domaind_error", { a1: cooldown.timeLeft }),
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        await interaction.editReply({
            content: i18next.t("embSys:test.interacciones.test_domaind_verificando")
        });

        startCooldown(interaction.guildId!, idCooldown);
        
        const domainStatuses = await checkAllDomains();
        
        const embed = buildDomainStatusEmbed(domainStatuses);
        
        await interaction.editReply({ 
            content: null, 
            embeds: [embed] 
        });

    } catch (err: any) {
        await interaction.editReply({
            content: i18next.t("embSys:test.interacciones.command_error_verificando", { a1: err.message}),
        });
    }
}