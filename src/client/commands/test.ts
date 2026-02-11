// src/client/commands/test.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionsBitField, TextChannel, PermissionFlagsBits} from "discord.js";
import i18next from "i18next";
import { error, debug } from "../../sys/logging";
import { getConfigMap } from "../../sys/DB-Engine/links/ReplyBots";
import { getGuildReplacementConfig } from "../../sys/DB-Engine/links/Embed";
import { replacementMetaList} from "../../sys/embedding/EmbedingConfig";
import { hasPermission } from "../../sys/zGears/mPermission";
import { checkAllDomains, buildDomainStatusEmbed, checkDomainTest, startDomainTestCooldown } from "../../sys/zGears/neTools";

const apiReplacementDomainsEnv = process.env.API_REPLACEMENT_DOMAINS ? process.env.API_REPLACEMENT_DOMAINS.split('|').map(s => s.trim()) : [];

export async function registerTestCommand(): Promise<SlashCommandBuilder[]> {
  const testCommand = new SlashCommandBuilder()
    .setName("test")
    .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
    .setDescription(i18next.t("command_test_description", { ns: "test" }))
    .addStringOption((option) =>
      option
        .setName("mode")
        .setDescription(i18next.t("test_command_mode_description", { ns: "test" }))
        .setRequired(false)
        .addChoices(
          { name: i18next.t("test_permission_guild", { ns: "test" }), value: "channel" },
          { name: i18next.t("test_work_by_channel", { ns: "test" }), value: "guild" },
          { name: i18next.t("test_show_embed_config", { ns: "test" }), value: "embed" },
          { name: i18next.t("test_commands_mode_domainds", { ns: "test" }), value: "chekdimains" }
        )
    ) as SlashCommandBuilder;

  return [testCommand];
}

export async function handleTestCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const isAllowed = hasPermission(interaction, interaction.commandName);
    if (!isAllowed) {
      await interaction.reply({
        content: i18next.t("command_permission_error", { ns: "test" }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const mode = interaction.options.getString("mode") ?? "channel";
    const configMap = await getConfigMap();
    const baseEmbed = new EmbedBuilder()
      .setTitle(i18next.t("test_command_title", { ns: "test" }));
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
        baseEmbed.setDescription(i18next.t("test_command_invalid_mode", { ns: "test" }))
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
        content: i18next.t("command_error", { ns: "test" }),
        flags: MessageFlags.Ephemeral,
    });
  }else if (!interaction.replied) {
    await interaction.editReply({
      content: i18next.t("command_error", { ns: "test" }),
    });
}}}

/* ========================= Permisos Generales ========================= */

async function guildPermision(interaction: ChatInputCommandInteraction, embed: EmbedBuilder): Promise<void> {
  const requiredPermissions = [
    { name: i18next.t("permission_view_channel", { ns: "test" }), bit: PermissionsBitField.Flags.ViewChannel },
    { name: i18next.t("permission_send_messages", { ns: "test" }), bit: PermissionsBitField.Flags.SendMessages },
    { name: i18next.t("permission_embed_links", { ns: "test" }), bit: PermissionsBitField.Flags.EmbedLinks },
    { name: i18next.t("permission_manage_messages", { ns: "test" }), bit: PermissionsBitField.Flags.ManageMessages },
    { name: i18next.t("permission_read_message_history", { ns: "test" }), bit: PermissionsBitField.Flags.ReadMessageHistory },
    { name: i18next.t("permission_add_reactions", { ns: "test" }), bit: PermissionsBitField.Flags.AddReactions },
    { name: i18next.t("permission_role_manager", { ns: "test" }), bit: PermissionsBitField.Flags.ManageRoles },
    { name: i18next.t("permission_channel_manager", { ns: "test" }), bit: PermissionsBitField.Flags.ManageChannels }
  ];

  const admin = [
    { name: i18next.t("permission_manage_guild", { ns: "test" }), bit: PermissionsBitField.Flags.ManageGuild },
    { name: i18next.t("permission_administrator", { ns: "test" }), bit: PermissionsBitField.Flags.Administrator }
  ];

  const channel = interaction.channel as TextChannel;
  if (!channel || !("permissionsFor" in channel)) {        
    throw new Error(i18next.t("test_error_permission", { ns: "test" }));
  }

  const botMember = interaction.guild?.members.me;
  if (!botMember) {
    throw new Error(i18next.t("test_error_permission_user", { ns: "test" }));
  }

  const permissions = channel.permissionsFor(botMember);
  if (!permissions) {
    throw new Error(i18next.t("test_error_verify_permission", { ns: "test" }));
  }

  embed
    .setDescription(i18next.t("test_command_channel_description", { ns: "test" }))
    .addFields(
      requiredPermissions.map((perm) => ({
        name: i18next.t("permission_name", { ns: "test", name: perm.name }),
        value: permissions.has(perm.bit) ? i18next.t("status_allowed", { ns: "test" }) : i18next.t("status_missing", { ns: "test" }),
        inline: false,
      }))
    )
    .addFields(
      admin.map((perm) => ({
        name: i18next.t("permission_name", { ns: "test", name: perm.name }),
        value: permissions.has(perm.bit) ? i18next.t("status_allowed_admin", { ns: "test" }) : i18next.t("status_missing", { ns: "test" }),
        inline: false,
      }))
    );
  embed.setFooter({ text: i18next.t("test_command_footer", { ns: "test" })});
  embed.setColor("#0300c8"); 
}

/* ========================= Todos los coanels ========================= */

async function allChannels(interaction: ChatInputCommandInteraction, embeds: EmbedBuilder[], configMap: Map<string, Map<string, { enabled: boolean; replyBots: boolean }>>,): Promise<void> {
  const guild = interaction.guild;
  const textPermisison = [
    { name: i18next.t("permission_view_channel", { ns: "test" }), bit: PermissionsBitField.Flags.ViewChannel },
    { name: i18next.t("permission_send_messages", { ns: "test" }), bit: PermissionsBitField.Flags.SendMessages },
    { name: i18next.t("permission_embed_links", { ns: "test" }), bit: PermissionsBitField.Flags.EmbedLinks },
    { name: i18next.t("permission_manage_messages", { ns: "test" }), bit: PermissionsBitField.Flags.ManageMessages },
    { name: i18next.t("permission_read_message_history", { ns: "test" }), bit: PermissionsBitField.Flags.ReadMessageHistory },
    { name: i18next.t("permission_add_reactions", { ns: "test" }), bit: PermissionsBitField.Flags.AddReactions },
  ];

  const voicePermision = [
    { name: i18next.t("permission_view_channel", { ns: "test" }), bit: PermissionsBitField.Flags.ViewChannel },
    { name: i18next.t("permission_connect_voice", { ns: "test" }), bit: PermissionsBitField.Flags.Connect }
  ];

  if (!guild) {
    throw new Error(i18next.t("dont_gg", { ns: "test" }));
  }

  const textChannels = guild.channels.cache.filter(channel => channel.type === 0); // Canales de Texto, Excluye hilos
  const voiceChannels = guild.channels.cache.filter(channel => channel.type === 2); // Canales de Voz
  let globalPermissionsOk = true;

  const channelsArray = [...textChannels.values(), ...voiceChannels.values()];
  const chunkSize = 25;
  const maxChannels = chunkSize * 10;
  const channelsProcess = channelsArray.slice(0, maxChannels);

  embeds[0].setDescription(i18next.t("test_command_guild_description", { ns: "test" }));

  for (let i = 0; i < channelsProcess.length; i += chunkSize) {
    const chunk = channelsProcess.slice(i, i + chunkSize);
    let currentEmbed: EmbedBuilder;

    if (i === 0) {
      currentEmbed = embeds[0];
    } else {
      currentEmbed = new EmbedBuilder().setTitle(i18next.t("test_command_title", { ns: "test" }) + ` (${Math.floor(i / chunkSize) + 1})`);
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
          value: (hasPerms ? i18next.t("all_status_allowed", { ns: "test" }) : i18next.t("missing_any_status", { ns: "test" })) +
            `\n${i18next.t("test_command_working_here", { ns: "test" })}: ${channelConfig.enabled ? "✅" : "❌"}` +
            `\n${i18next.t("test_command_reply_bots", { ns: "test" })}: ${channelConfig.replyBots ? "✅" : "❌"}`,
          inline: false,
        });

      } else if (channel.type === 2) {
        const permissionBits = voicePermision.map(p => p.bit);
        const hasPerms = permissions?.has(permissionBits, false) ?? false;
        if (!hasPerms) globalPermissionsOk = false;

        currentEmbed.addFields({
          name: `🔊 Voz: ${channel.name}`,
          value: hasPerms ? i18next.t("all_status_allowed", { ns: "test" }) : i18next.t("missing_any_status", { ns: "test" }),
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
  embeds.forEach(e => e.setFooter({ text: i18next.t("test_command_footer", { ns: "test" })}));
}

/* ========================= Embedes Set ========================= */

async function ComEmbed(interaction: ChatInputCommandInteraction, embed: EmbedBuilder): Promise<void> {
  const guildId = interaction.guild?.id;
  if (!guildId) {
    throw new Error(i18next.t("dont_gg", { ns: "test" }));
  }

  const replacementConfig = await getGuildReplacementConfig(guildId);
  embed.setDescription(i18next.t("not_replacement", { ns: "test" }));

  // Sección para los reemplazos manuales
  replacementMetaList.forEach(meta => {
    const config = replacementConfig.get(meta.name);
    let status: string;
    
    if (config === undefined) {
      status = i18next.t("rem_list_1", { ns: "test" });
    } else if (!config.enabled) {
      status = i18next.t("rem_list_2", { ns: "test" });
    } else if (config.custom_url) {
      const userMention = config.user_id ? `<@${config.user_id}>` : i18next.t("unknown_user", { ns: "test" }); 
      status = i18next.t("rem_list_3", { ns: "test", custom_url: config.custom_url, userMention }); 
    } else {
      status = i18next.t("rem_list_1", { ns: "test" });
    }
    
    embed.addFields({
      name: meta.name,
      value: status,
      inline: false,
    });
  });
  
  // Sección para los reemplazos por API
  embed.addFields({ 
    name: i18next.t("field_add_api", { ns: "test" }), 
    value: i18next.t("field_add_api_value", { ns: "test" })
  });

  apiReplacementDomainsEnv.forEach(domain => {
    const config = replacementConfig.get(domain);
    const status = (config === undefined || config.enabled) ? 
      i18next.t("field_api_enabled", { ns: "test" }) : 
      i18next.t("field_api_disabled", { ns: "test" });

    embed.addFields({
      name: domain,
      value: status,
      inline: false,
    });
  });

  embed.setColor("#0099ff");
}

/* ========================= NeTest ========================= */

export async function ChekDomainsTest(interaction: ChatInputCommandInteraction): Promise<void> {
    try {

        const cooldown = checkDomainTest();
        if (cooldown.onCooldown) {
            await interaction.reply({
                content: i18next.t("test_domaind_error", { ns: "test" , a1: cooldown.timeLeft }),
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        await interaction.editReply({
            content: i18next.t("test_domaind_verificando", { ns: "test" })
        });

        startDomainTestCooldown();
        
        const domainStatuses = await checkAllDomains();
        
        const embed = buildDomainStatusEmbed(domainStatuses);
        
        await interaction.editReply({ 
            content: null, 
            embeds: [embed] 
        });

    } catch (err: any) {
        await interaction.editReply({
            content: i18next.t("command_error_verificando", { ns: "test", a1: err.message}),
        });
    }
}