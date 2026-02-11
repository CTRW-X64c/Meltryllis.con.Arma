// src/client/commands/hola.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionsBitField} from "discord.js";
import i18next from "i18next";
import { error } from "../../sys/logging";
import { randomcolorembed } from "../_resources";

export async function registerHolaCommand(): Promise<SlashCommandBuilder[]> {
  const holaCommand = new SlashCommandBuilder()
    .setName("help")
    .setDescription(i18next.t("command_hola_description", { ns: "hola" }))
    .addStringOption((op) =>
    op
      .setName("command")
      .setDescription(i18next.t("command_hola_idioma_description", { ns: "hola" }))
      .setRequired(false)
      .addChoices(
        { name: "info", value: "00" },
        { name: "/cleanup", value: "01" },
        //{ name: "/embed", value: "02" },
        //{ name: "/jointovoice", value: "03" },
        { name: "/mangadex", value: "04" },
        //{ name: "/play /stop /skip /queue", value: "05" },
        { name: "/permisos", value: "06" },
        //{ name: "/post", value: "07" },
        { name: "/reddit", value: "08" },
        { name: "/rolemoji", value: "09" },
        //{ name: "/test", value: "10" },
        //{ name: "/welcome", value: "11" },
        { name: "/work", value: "12" },
        { name: "/youtube", value: "13" },
      )
    );

  return [holaCommand] as SlashCommandBuilder[];
}

export async function handleHolaCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const opHelp = interaction.options.getString("command") || "00";
    switch (opHelp) {   
      case "00":  await info(interaction);  break;
      case "01":  await helpClean(interaction);  break;
      case "04":  await helpManga(interaction); break;
      case "06":  await helpPermisos(interaction);  break;
      case "08":  await helpReddit(interaction);  break;
      case "09":  await helpRolemoji(interaction);  break;
      case "13":  await helpYoutube(interaction); break;

      default:
        await interaction.reply({content: i18next.t("default_switch_error", { ns: "hola" }), flags: MessageFlags.Ephemeral,});
        break;
      }
    } catch (e) {
      error(`Error al ejecutar comando /help: ${e}`);
    }
}

// ============================================= info ============================================= //

async function info(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle(i18next.t("embed_title", { ns: "hola" }))
    .setDescription(i18next.t("embed_description", { ns: "hola" }))
    .addFields(
      {
        name: i18next.t("field_invite_name", { ns: "hola" }),
        value: i18next.t("field_invite_value", { ns: "hola" }),
        inline: true
      },
      {
        name: i18next.t("field_terms_name", { ns: "hola" }),
        value: i18next.t("field_terms_value", { ns: "hola" }),
        inline: true
      },
      {
        name: i18next.t("field_issue_name", { ns: "hola" }),
        value: i18next.t("field_issue_value", { ns: "hola" }),
        inline: false
      },
      {
        name: i18next.t("field_permisos_name", { ns: "hola" }),
        value: i18next.t("field_permisos_value", { ns: "hola" }),
        inline: false
      },
      {
        name: i18next.t("field_test_name", { ns: "hola" }),
        value: i18next.t("field_test_value", { ns: "hola" }),
        inline: false
      },
      {
        name: i18next.t("field_work_name", { ns: "hola" }),
        value: i18next.t("field_work_value", { ns: "hola" }),
        inline: false
      },
      {
        name: i18next.t("field_embed_name", { ns: "hola" }),
        value: i18next.t("field_embed_value", { ns: "hola" }),
        inline: false
      },
      {
        name: i18next.t("field_welcome_name", { ns: "hola" }),
        value: i18next.t("field_welcome_value", { ns: "hola" }),
        inline: false
      },
      {
        name: i18next.t("field_rolemoji_name", { ns: "hola" }),
        value: i18next.t("field_rolemoji_value", { ns: "hola" }),
        inline: false
      },
      {
        name: i18next.t("field_post_name", { ns: "hola" }),
        value: i18next.t("field_post_value", { ns: "hola" }),
        inline: false
      },
      {
        name: i18next.t("field_cleanup_name", { ns: "hola" }),
        value: i18next.t("field_cleanup_value", { ns: "hola" }),
        inline: false
      },
      {
        name: i18next.t("field_follow_name", { ns: "hola" }),
        value: i18next.t("field_follow_value", { ns: "hola" }),
        inline: false 
      },
      {
        name: i18next.t("field_voice_name", { ns: "hola" }),
        value: i18next.t("field_voice_value", { ns: "hola" }),
        inline: false
      },
      {
        name: i18next.t("field_music_name", { ns: "hola" }),
        value: i18next.t("field_music_value", { ns: "hola" }),
        inline: false
      }
    )
    .setImage("https://raw.githubusercontent.com/CTRW-X64c/Meltryllis.con.Arma/refs/heads/main/Pict/banner-v2.jpg")
    .setColor(parseInt(randomcolorembed(), 16))
    .setFooter({text: i18next.t("footer_text", { ns: "hola" })})
    .setTimestamp();
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ============================================= CleanUp ============================================= //

async function helpClean(interaction: ChatInputCommandInteraction): Promise<void> {
  const channel = interaction.channel;
  const guild = interaction.guild;
    
  if (!guild || !channel || !('permissionsFor' in channel)) {
    await interaction.reply({ 
      content: i18next.t("command_guild_only_error", { ns: "rolemoji" }), 
      flags: MessageFlags.Ephemeral 
      });
      return;
  }
    
  const botMember = guild.members.me;
    if (!botMember) {
      await interaction.reply({
        content: i18next.t("test_error_permission_user", { ns: "rolemoji" }), 
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
  const channelPermissions = channel.permissionsFor(botMember);
  const ManageRoles = botMember.permissions.has(PermissionsBitField.Flags.ManageRoles);
  const AddReactions = channelPermissions.has(PermissionsBitField.Flags.AddReactions);
  const ExternalEmojis = channelPermissions.has(PermissionsBitField.Flags.UseExternalEmojis);
    
  const embed = new EmbedBuilder()
      .setColor("#0099ff")
      .setTitle(i18next.t("command_rolemoji_help_title", { ns: "rolemoji" }))
      .setDescription(i18next.t("command_rolemoji_help_description", { ns: "rolemoji" }))
      .addFields(
        {
          name: i18next.t("embed_rolemoji_paso_1", { ns: "rolemoji" }),
          value: i18next.t("embed_rolemoji_fix_1", { ns: "rolemoji" }),
        }, 
        {
          name: i18next.t("manage_roles_permission", { ns: "rolemoji" }),
          value: ManageRoles ? i18next.t("allowed_permission", { ns: "rolemoji" }) : i18next.t("missing_permission", { ns: "rolemoji" }),
          inline: true,
        },
        {
          name: i18next.t("add_reactions_permission", { ns: "rolemoji" }),
          value: AddReactions ? i18next.t("allowed_permission", { ns: "rolemoji" }) : i18next.t("missing_permission", { ns: "rolemoji" }),
          inline: true,
        },
        {
          name: i18next.t("use_external_emojis_permission", { ns: "rolemoji" }),
          value: ExternalEmojis ? i18next.t("allowed_permission", { ns: "rolemoji" }) : i18next.t("missing_permission", { ns: "rolemoji" }),
          inline: true,
        },
        {
          name: i18next.t("embed_rolemoji_paso_2", { ns: "rolemoji" }),
          value: i18next.t("embed_rolemoji_fix_2", { ns: "rolemoji" }),
          inline: false,
        }, 
        {
          name: i18next.t("embed_rolemoji_paso_3", { ns: "rolemoji" }),
          value: i18next.t("embed_rolemoji_fix_3", { ns: "rolemoji" }),
          inline: false,
        }
      )
      .setFooter({ text: i18next.t("command_rolemoji_help_footer", { ns: "rolemoji" }) })
      .setImage("https://raw.githubusercontent.com/CTRW-X64c/Meltryllis.con.Arma/refs/heads/main/Pict/RolemojiHelp.png")
      .setTimestamp();    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ============================================= mangadex ============================================= //

async function helpManga(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
  .setTitle(i18next.t("mangadex_HelpEmb_titulo", { ns: "mangadex" })) 
  .setDescription(i18next.t("mangadex_HelpEmb_descripcion", { ns: "mangadex" }))
  .addFields(
    {
      name: i18next.t("mangadex_HelpEmb_Field_Name_1", { ns: "mangadex" }),
      value: i18next.t("mangadex_HelpEmb_Field_Value_1", { ns: "mangadex" }),
      inline: false
    },
    {
      name: i18next.t("mangadex_HelpEmb_Field_Name_2", { ns: "mangadex" }),
      value: i18next.t("mangadex_HelpEmb_Field_Value_2", { ns: "mangadex" }),
      inline: false
    },
    {
      name: i18next.t("mangadex_HelpEmb_Field_Name_3", { ns: "mangadex" }),
      value: i18next.t("mangadex_HelpEmb_Field_Value_3", { ns: "mangadex" }),
      inline: false
    }    
  )
  .setColor(0xFF6740)
  .setFooter({text: i18next.t("mangadex_HelpEmb_footer", { ns: "mangadex" }),});
await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral});
}

// ============================================= permisos ============================================= //

async function helpPermisos(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle(i18next.t("command_permissions_help_title", { ns: "permissions" }))
    .setColor(0x5865F2)
    .setDescription(i18next.t("command_permissions_help_desc", { ns: "permissions" }))
    .addFields(
      {
        name: i18next.t("command_permissions_help_add_title", { ns: "permissions" }),
        value: i18next.t("command_permissions_help_add_desc", { ns: "permissions" }),
        inline: false
      },
      {
        name: i18next.t("command_permissions_help_list_title", { ns: "permissions" }),
        value: i18next.t("command_permissions_help_list_desc", { ns: "permissions" }),
        inline: false
      },
      {
        name: i18next.t("command_permissions_help_remove_title", { ns: "permissions" }),
        value: i18next.t("command_permissions_help_remove_desc", { ns: "permissions" }),
        inline: false
      },
      {
        name: i18next.t("command_permissions_help_clear_title", { ns: "permissions" }),
        value: i18next.t("command_permissions_help_clear_desc", { ns: "permissions" }),
        inline: false
      },
    )
    .setFooter({ text: i18next.t("footer_text_help", { ns: "permissions" })})
    .setTimestamp();
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral});
}

// ============================================= reddit ============================================= //

async function helpReddit(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle(i18next.t("command_reddit_HelpEmb_titulo", { ns: "reddit" }))
    .setColor(0xFF4500)
    .setDescription(i18next.t("command_reddit_HelpEmb_descripcion", { ns: "reddit" }))
    .addFields(
      {
        name: i18next.t("command_reddit_HelpEmb_Field_Name_1", { ns: "reddit" }),
        value: i18next.t("command_reddit_HelpEmb_Field_Value_1", { ns: "reddit" }),
      },
      { 
        name: i18next.t("command_reddit_HelpEmb_Field_Name_2", { ns: "reddit" }),
        value: i18next.t("command_reddit_HelpEmb_Field_Value_2", { ns: "reddit" }),
      },
      { 
        name: i18next.t("command_reddit_HelpEmb_Field_Name_3", { ns: "reddit" }),
        value: i18next.t("command_reddit_HelpEmb_Field_Value_3", { ns: "reddit" }),
      },
      { 
        name: i18next.t("command_reddit_HelpEmb_Field_Name_4", { ns: "reddit" }),
        value: i18next.t("command_reddit_HelpEmb_Field_Value_4", { ns: "reddit" }),
      }
    );
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral});
}

// ============================================= rolemoji ============================================= //

async function helpRolemoji(interaction: ChatInputCommandInteraction): Promise<void> {
    const channel = interaction.channel;
    const guild = interaction.guild;
    
    if (!guild || !channel || !('permissionsFor' in channel)) {
        await interaction.reply({ 
            content: i18next.t("command_guild_only_error", { ns: "rolemoji" }), 
            flags: MessageFlags.Ephemeral 
        });
        return;
    }
    
    const botMember = guild.members.me;
    if (!botMember) {
        await interaction.reply({
            content: i18next.t("test_error_permission_user", { ns: "rolemoji" }), 
            flags: MessageFlags.Ephemeral
        });
        return;
    }
    
    const channelPermissions = channel.permissionsFor(botMember);
    const ManageRoles = botMember.permissions.has(PermissionsBitField.Flags.ManageRoles);
    const AddReactions = channelPermissions.has(PermissionsBitField.Flags.AddReactions);
    const ExternalEmojis = channelPermissions.has(PermissionsBitField.Flags.UseExternalEmojis);
    
    const embed = new EmbedBuilder()
        .setColor("#0099ff")
        .setTitle(i18next.t("command_rolemoji_help_title", { ns: "rolemoji" }))
        .setDescription(i18next.t("command_rolemoji_help_description", { ns: "rolemoji" }))
        .addFields(
            {
                name: i18next.t("embed_rolemoji_paso_1", { ns: "rolemoji" }),
                value: i18next.t("embed_rolemoji_fix_1", { ns: "rolemoji" }),
            }, 
            {
                name: i18next.t("manage_roles_permission", { ns: "rolemoji" }),
                value: ManageRoles ? i18next.t("allowed_permission", { ns: "rolemoji" }) : i18next.t("missing_permission", { ns: "rolemoji" }),
                inline: true,
            },
            {
                name: i18next.t("add_reactions_permission", { ns: "rolemoji" }),
                value: AddReactions ? i18next.t("allowed_permission", { ns: "rolemoji" }) : i18next.t("missing_permission", { ns: "rolemoji" }),
                inline: true,
            },
            {
                name: i18next.t("use_external_emojis_permission", { ns: "rolemoji" }),
                value: ExternalEmojis ? i18next.t("allowed_permission", { ns: "rolemoji" }) : i18next.t("missing_permission", { ns: "rolemoji" }),
                inline: true,
            },
            {
                name: i18next.t("embed_rolemoji_paso_2", { ns: "rolemoji" }),
                value: i18next.t("embed_rolemoji_fix_2", { ns: "rolemoji" }),
                inline: false,
            }, 
            {
                name: i18next.t("embed_rolemoji_paso_3", { ns: "rolemoji" }),
                value: i18next.t("embed_rolemoji_fix_3", { ns: "rolemoji" }),
                inline: false,
            }
        )
        .setFooter({ text: i18next.t("command_rolemoji_help_footer", { ns: "rolemoji" }) })
        .setImage("https://raw.githubusercontent.com/CTRW-X64c/Meltryllis.con.Arma/refs/heads/main/Pict/RolemojiHelp.png")
        .setTimestamp();
        
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ============================================= youtube ============================================= //

async function helpYoutube(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle(i18next.t("YT_HelpEmb_titulo", { ns: "youtube" })) 
    .setDescription(i18next.t("YT_HelpEmb_descripcion", { ns: "youtube" }))
    .addFields(
      {
        name: i18next.t("YT_HelpEmb_Field_Name_1", { ns: "youtube" }),
        value: i18next.t("YT_HelpEmb_Field_Value_1", { ns: "youtube" }),
        inline: false
      },
      {
        name: i18next.t("YT_HelpEmb_Field_Name_2", { ns: "youtube" }),
        value: i18next.t("YT_HelpEmb_Field_Value_2", { ns: "youtube" }),
        inline: false
      }
    )
    //.setImage("https://i.imgur.com/hBy4KhT.jpeg")
    .setColor("#ff0000")
    .setFooter({text: i18next.t("YT_HelpEmb_footer", { ns: "youtube" }),});
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral});
} 