// src/client/commands/test.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionsBitField, TextChannel, PermissionFlagsBits} from "discord.js";
import i18next from "i18next";
import { error, debug } from "../../sys/logging";
import { getConfigMap } from "../../sys/DB-Engine/links/ReplyBots";
import { getGuildReplacementConfig } from "../../sys/DB-Engine/links/Embed";
import { replacementMetaList} from "../../sys/embedding/EmbedingConfig";
import { hasPermission } from "../../sys/managerPermission";
import { checkAllDomains, buildDomainStatusEmbed, checkDomainTest, startDomainTestCooldown } from "../eventGear/neTools";

const apiReplacementDomainsEnv = process.env.API_REPLACEMENT_DOMAINS ? process.env.API_REPLACEMENT_DOMAINS.split(',').map(s => s.trim()) : [];

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
          { name: i18next.t("test_command_mode_channel", { ns: "test" }), value: "channel" },
          { name: i18next.t("test_command_mode_guild", { ns: "test" }), value: "guild" },
          { name: i18next.t("test_command_mode_embed", { ns: "test" }), value: "embed" },
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
    const requiredPermissions = [
      { name: i18next.t("permission_send_messages", { ns: "test" }), bit: PermissionsBitField.Flags.SendMessages },
      { name: i18next.t("permission_embed_links", { ns: "test" }), bit: PermissionsBitField.Flags.EmbedLinks },
      { name: i18next.t("permission_manage_messages", { ns: "test" }), bit: PermissionsBitField.Flags.ManageMessages },
      { name: i18next.t("permission_read_message_history", { ns: "test" }), bit: PermissionsBitField.Flags.ReadMessageHistory },
      { name: i18next.t("permission_add_reactions", { ns: "test" }), bit: PermissionsBitField.Flags.AddReactions },    
    ];

    const configMap = await getConfigMap();
    let embed = new EmbedBuilder()
      .setTitle(i18next.t("test_command_title", { ns: "test" }));

    // Inicio de seccion switch para subcomandos
    switch (mode) {
      case "channel":
        await ComNull(interaction, embed, configMap, requiredPermissions);
        break;
      
      case "guild":
        await ComGuild(interaction, embed, configMap, requiredPermissions);
        break;
      
      case "embed":
        await ComEmbed(interaction, embed);
        break;

      case "chekdimains":
        await ChekDomainsTest(interaction);
        return;

      default:
        embed.setDescription(i18next.t("test_command_invalid_mode", { ns: "test" }))
             .setColor("#ff0000");
        break;
    }
     // Termino de seccion switch para subcomandos
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
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

 // Subcomando "Canal Actual/null"
async function ComNull(
  interaction: ChatInputCommandInteraction,
  embed: EmbedBuilder,
  configMap: Map<string, Map<string, { enabled: boolean; replyBots: boolean }>>,
  requiredPermissions: Array<{ name: string; bit: bigint }>
): Promise<void> {
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

  const guildId = interaction.guild?.id;
  const channelId = interaction.channelId;
  const guildConfig = configMap.get(guildId!);
  const channelConfig = guildConfig?.get(channelId) ?? { enabled: true, replyBots: true };

  embed
    .setDescription(i18next.t("test_command_channel_description", { ns: "test" }))
    .addFields(
      requiredPermissions.map((perm) => ({
        name: i18next.t("permission_name", { ns: "test", name: perm.name }),
        value: permissions.has(perm.bit) ? i18next.t("status_allowed", { ns: "test" }) : i18next.t("status_missing", { ns: "test" }),
        inline: true,
      }))
    )
    .addFields(
      {
        name: i18next.t("test_command_working_here", { ns: "test" }),
        value: channelConfig.enabled ? "✅" : "❌",
        inline: true,
      },
      {
        name: i18next.t("test_command_reply_bots", { ns: "test" }),
        value: channelConfig.replyBots ? "✅" : "❌",
        inline: true,
      }
    );
}

// Subcomando "Guild"
async function ComGuild(
  interaction: ChatInputCommandInteraction,
  embed: EmbedBuilder,
  configMap: Map<string, Map<string, { enabled: boolean; replyBots: boolean }>>,
  requiredPermissions: Array<{ name: string; bit: bigint }>
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    throw new Error(i18next.t("dont_gg", { ns: "test" }));
  }

  const channels = guild.channels.cache.filter(channel => channel.type === 0); // Excluye hilos
  let allPermissionsOk = true;

  embed.setDescription(i18next.t("test_command_guild_description", { ns: "test" }));
  const channelsToShow = channels.first(24);

  channelsToShow.forEach(channel => {
    const botMember = guild.members.me;
    if (botMember && "permissionsFor" in channel) {
      const permissions = channel.permissionsFor(botMember);
      const permissionBits = requiredPermissions.map(p => p.bit);
      const hasAllPermissions = permissions?.has(permissionBits) ?? false;
      allPermissionsOk = allPermissionsOk && hasAllPermissions;

      const guildId = guild.id;
      const channelId = channel.id;
      const guildConfig = configMap.get(guildId);
      const channelConfig = guildConfig?.get(channelId) ?? { enabled: true, replyBots: true };

      embed.addFields({
        name: `Canal: #${channel.name}`,
        value: (hasAllPermissions ? i18next.t("all_status_allowed", { ns: "test" }) : i18next.t("missing_any_status", { ns: "test" })) +
          `\n${i18next.t("test_command_working_here", { ns: "test" })}: ${channelConfig.enabled ? "✅" : "❌"}` +
          `\n${i18next.t("test_command_reply_bots", { ns: "test" })}: ${channelConfig.replyBots ? "✅" : "❌"}`,
        inline: false,
      });
    }
  });
  if (channels.size > 24) {
    embed.addFields({
      name: "⚠️ Límite alcanzado",
      value: `Mostrando 24 de ${channels.size} canales. El embed no puede mostrar más.`,
      inline: false
    });
  }

  embed.setColor(allPermissionsOk ? "#00ff00" : "#ff0000");
}

// Subcomando "Embed"
async function ComEmbed(
  interaction: ChatInputCommandInteraction,
  embed: EmbedBuilder,
): Promise<void> {
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
        
        const showDetailed = interaction.options.getBoolean("detallado") ?? false;
        
        await interaction.editReply({
            content: i18next.t("test_domaind_verificando", { ns: "test" })
        });

        startDomainTestCooldown();
        
        const domainStatuses = await checkAllDomains();
        
        const embed = buildDomainStatusEmbed(domainStatuses, showDetailed);
        
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