// src/client/commands/hola.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionsBitField, PermissionFlagsBits} from "discord.js";
import i18next from "i18next";
import { error } from "../../sys/logging";
import { randomcolorembed } from "../_resources";
import { hasPermission } from "../../sys/zGears/mPermission";


export async function registerHolaCommand(): Promise<SlashCommandBuilder[]> {
  const holaCommand = new SlashCommandBuilder()
    .setName("help")
    .setDescription(i18next.t("comBuild.command_hola_description", { ns: "hola" }))
    .addStringOption((op) =>
    op
      .setName("command")
      .setDescription(i18next.t("comBuild.command_hola_idioma_description", { ns: "hola" }))
      .setRequired(false)
      .addChoices(
        { name: "info", value: "00" },
        { name: "/cleanup", value: "01" },
        { name: "/embed", value: "02" },
        { name: "/jointovoice", value: "03" },
        { name: "/mangadex", value: "04" },
        { name: "Musica: /play /stop /skip /queue", value: "05" },
        { name: "/permisos", value: "06" },
        { name: "/post", value: "07" },
        { name: "/reddit", value: "08" },
        { name: "/rolemoji", value: "09" },
        { name: "/test", value: "10" },
        { name: "/welcome", value: "11" },
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
      case "02":  await helpEmbed(interaction);  break;
      case "03":  await helpJoin(interaction);  break;
      case "04":  await helpManga(interaction); break;
      case "05":  await helpMusic(interaction); break;
      case "06":  await helpPermisos(interaction);  break;
      case "07":  await helpPost(interaction);  break;
      case "08":  await helpReddit(interaction);  break;
      case "09":  await helpRolemoji(interaction);  break;
      case "10":  await helpTest(interaction);  break;
      case "11":  await helpWelcome(interaction);  break;
      case "12":  await helpWork(interaction);  break;
      case "13":  await helpYoutube(interaction); break;

      default:
        await interaction.reply({content: i18next.t("comBuild.default_switch_error", { ns: "hola" }), flags: MessageFlags.Ephemeral,});
        break;
      }
    } catch (e) {
      error(`Error al ejecutar comando /help: ${e}`);
    }
}

// ============================================= info ============================================= //

async function info(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle(i18next.t("info.embed_title", { ns: "hola" }))
    .setDescription(i18next.t("info.embed_description"))
    .addFields(
      {
        name: i18next.t("info.field_invite_name", { ns: "hola" }),
        value: i18next.t("info.field_invite_value", { ns: "hola" }),
        inline: true
      },
      {
        name: i18next.t("info.field_terms_name", { ns: "hola" }),
        value: i18next.t("info.field_terms_value", { ns: "hola" }),
        inline: true
      },
      {
        name: i18next.t("info.field_issue_name", { ns: "hola" }),
        value: i18next.t("info.field_issue_value", { ns: "hola" }),
        inline: false
      },
      {
        name: i18next.t("info.field_permisos_name", { ns: "hola" }),
        value: i18next.t("info.field_permisos_value", { ns: "hola" }),
        inline: false
      },
      {
        name: i18next.t("info.field_helpy_name", { ns: "hola" }),
        value: i18next.t("info.field_helpy_value", { ns: "hola" }),
        inline: false
      }
    )
    .setImage("https://raw.githubusercontent.com/CTRW-X64c/Meltryllis.con.Arma/refs/heads/RemodelCommands/Pict/embedd.gif")
    .setColor(parseInt(randomcolorembed(), 16))
    .setFooter({text: i18next.t("info.footer_text", { ns: "hola" })})
    .setTimestamp();
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ============================================= CleanUp ============================================= //

async function helpClean(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
      .setColor("#0099ff")
      .setTitle(i18next.t("clean.title", { ns: "hola" }))
      .setDescription(await hasPermission(interaction, "cleanup") ? i18next.t("can_run_yes", { ns: "hola" }) : i18next.t("can_run_no", { ns: "hola" }))
      .addFields(
        {
          name: i18next.t("clean.name_1", { ns: "hola" }),
          value: i18next.t("clean.value_1", { ns: "hola" }),
        }, 
      )
      .setFooter({ text: i18next.t("clean.footer", { ns: "hola" }) })
      .setTimestamp();    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ============================================= mangadex ============================================= //

async function helpManga(interaction: ChatInputCommandInteraction): Promise<void> {
  
  const embed = new EmbedBuilder()
    .setTitle(i18next.t("mangadex.HelpEmb_titulo", { ns: "hola" })) 
    .setDescription((await hasPermission(interaction, "mangadex") ? i18next.t("can_run_yes", { ns: "hola" }) : i18next.t("can_run_no", { ns: "hola" })) + '\n\n' + i18next.t("mangadex.HelpEmb_descripcion", { ns: "hola" }))
    .addFields(
      {
        name: i18next.t("mangadex.HelpEmb_Field_Name_1", { ns: "hola" }),
        value: i18next.t("mangadex.HelpEmb_Field_Value_1", { ns: "hola" }),
        inline: false
      },
      {
        name: i18next.t("mangadex.HelpEmb_Field_Name_2", { ns: "hola" }),
        value: i18next.t("mangadex.HelpEmb_Field_Value_2", { ns: "hola" }),
        inline: false
      }  
    )
    .setColor(0xFF6740)
    .setFooter({text: i18next.t("mangadex.HelpEmb_footer", { ns: "hola" }),});
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral});
}

// ============================================= permisos ============================================= //

async function helpPermisos(interaction: ChatInputCommandInteraction): Promise<void> {
  try{
  const { guild, user, memberPermissions } = interaction;
  const isAdmin = user.id === guild?.ownerId || memberPermissions?.has(PermissionFlagsBits.Administrator)
  const embed = new EmbedBuilder()
    .setTitle(i18next.t("permisos.help_title", { ns: "hola" }))
    .setColor(parseInt(randomcolorembed(), 16))
    .setDescription((isAdmin ? i18next.t("permisos.run_yes", { ns: "hola" }) : i18next.t("permisos.run_no", { ns: "hola" })) + '\n\n' + i18next.t("permisos.help_desc", { ns: "hola" }))
    .addFields(
      {
        name: i18next.t("permisos.help_add_title", { ns: "hola" }),
        value: i18next.t("permisos.help_add_desc", { ns: "hola" }),
        inline: false
      },
      {
        name: i18next.t("permisos.help_list_title", { ns: "hola" }),
        value: i18next.t("permisos.help_list_desc", { ns: "hola" }),
        inline: false
      },
      {
        name: i18next.t("permisos.help_remove_title", { ns: "hola" }),
        value: i18next.t("permisos.help_remove_desc", { ns: "hola" }),
        inline: false
      },
      {
        name: i18next.t("permisos.help_clear_title", { ns: "hola" }),
        value: i18next.t("permisos.help_clear_desc", { ns: "hola" }),
        inline: false
      },
    )
    .setFooter({ text: i18next.t("permisos.footer_text_help", { ns: "hola" })})
    .setTimestamp();
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral});
  } catch (e) {error(`Error al ejecutar comando /help: ${e}`);  }
}

// ============================================= reddit ============================================= //

async function helpReddit(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle(i18next.t("reddit.HelpEmb_titulo", { ns: "hola" }))
    .setColor(0xFF4500)
    .setDescription((await hasPermission(interaction, "reddit") ? i18next.t("can_run_yes", { ns: "hola" }) : i18next.t("can_run_no", { ns: "hola" })) + '\n\n' + i18next.t("reddit.HelpEmb_descripcion", { ns: "hola" }))
    .addFields(
      {
        name: i18next.t("reddit.HelpEmb_Field_Name_1", { ns: "hola" }),
        value: i18next.t("reddit.HelpEmb_Field_Value_1", { ns: "hola" }),
      },
      { 
        name: i18next.t("reddit.HelpEmb_Field_Name_2", { ns: "hola" }),
        value: i18next.t("reddit.HelpEmb_Field_Value_2", { ns: "hola" }),
      },
      { 
        name: i18next.t("reddit.HelpEmb_Field_Name_3", { ns: "hola" }),
        value: i18next.t("reddit.HelpEmb_Field_Value_3", { ns: "hola" }),
      },
      { 
        name: i18next.t("reddit.HelpEmb_Field_Name_4", { ns: "hola" }),
        value: i18next.t("reddit.HelpEmb_Field_Value_4", { ns: "hola" }),
      }
    );
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral});
}

// ============================================= rolemoji ============================================= //

async function helpRolemoji(interaction: ChatInputCommandInteraction): Promise<void> {
  try {  
    const channel = interaction.channel;
    const guild = interaction.guild;
    
    if (!guild || !channel || !('permissionsFor' in channel)) {
        await interaction.reply({ 
            content: i18next.t("rolemoji.only_error", { ns: "hola" }), 
            flags: MessageFlags.Ephemeral 
        });
        return;
    }
    
    const botMember = guild.members.me;
    if (!botMember) {
        await interaction.reply({
            content: i18next.t("rolemoji.error_user", { ns: "hola" }), 
            flags: MessageFlags.Ephemeral
        });
        return;
    }
    
    const channelPermissions = channel.permissionsFor(botMember);
    const ManageRoles = botMember.permissions.has(PermissionsBitField.Flags.ManageRoles);
    const AddReactions = channelPermissions.has(PermissionsBitField.Flags.AddReactions);
    const ExternalEmojis = channelPermissions.has(PermissionsBitField.Flags.UseExternalEmojis);
    
    const embed = new EmbedBuilder()
        .setColor(parseInt(randomcolorembed(), 16))
        .setTitle(i18next.t("rolemoji.help_title", { ns: "hola" }))
        .setDescription((await hasPermission(interaction, "rolemoji") ? i18next.t("can_run_yes", { ns: "hola" }) : i18next.t("can_run_no", { ns: "hola" })) + '\n\n' + i18next.t("rolemoji.help_description", { ns: "hola" }))
        .addFields(
            {
                name: i18next.t("rolemoji.paso_1", { ns: "hola" }),
                value: i18next.t("rolemoji.fix_1", { ns: "hola" }),
            }, 
            {
                name: i18next.t("rolemoji.manage_roles_permission", { ns: "hola" }),
                value: ManageRoles ? i18next.t("rolemoji.allowed_permission", { ns: "hola" }) : i18next.t("rolemoji.missing_permission", { ns: "hola" }),
                inline: true,
            },
            {
                name: i18next.t("rolemoji.add_reactions_permission", { ns: "hola" }),
                value: AddReactions ? i18next.t("rolemoji.allowed_permission", { ns: "hola" }) : i18next.t("rolemoji.missing_permission", { ns: "hola" }),
                inline: true,
            },
            {
                name: i18next.t("rolemoji.use_external_emojis_permission", { ns: "hola" }),
                value: ExternalEmojis ? i18next.t("rolemoji.allowed_permission", { ns: "hola" }) : i18next.t("rolemoji.missing_permission", { ns: "hola" }),
                inline: true,
            },
            {
                name: i18next.t("rolemoji.paso_2", { ns: "hola" }),
                value: i18next.t("rolemoji.fix_2", { ns: "hola" }),
                inline: false,
            }, 
            {
                name: i18next.t("rolemoji.paso_3", { ns: "hola" }),
                value: i18next.t("rolemoji.fix_3", { ns: "hola" }),
                inline: false,
            }
        )
        .setFooter({ text: i18next.t("rolemoji.help_footer", { ns: "hola" }) })
        .setImage("https://raw.githubusercontent.com/CTRW-X64c/Meltryllis.con.Arma/refs/heads/main/Pict/RolemojiHelp.png")
        .setTimestamp();
        
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (e) {error(`Error al ejecutar comando /help: ${e}`);  }
}

// ============================================= youtube ============================================= //

async function helpYoutube(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle(i18next.t("youtube.titulo", { ns: "hola" })) 
    .setDescription((await hasPermission(interaction, "youtube") ? i18next.t("can_run_yes", { ns: "hola" }) : i18next.t("can_run_no", { ns: "hola" })) + '\n\n' + i18next.t("youtube.descripcion", { ns: "hola" }))
    .addFields(
      {
        name: i18next.t("youtube.Field_Name_1", { ns: "hola" }),
        value: i18next.t("youtube.Field_Value_1", { ns: "hola" }),
        inline: false
      },
      {
        name: i18next.t("youtube.Field_Name_2", { ns: "hola" }),
        value: i18next.t("youtube.Field_Value_2", { ns: "hola" }),
        inline: false
      }
    )
    //.setImage("https://i.imgur.com/hBy4KhT.jpeg")
    .setColor("#ff0000")
    .setFooter({text: i18next.t("youtube.footer", { ns: "hola" }),});
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral});
} 

// ============================================= embed ============================================= //

async function helpEmbed(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
      .setColor(parseInt(randomcolorembed(), 16))
      .setTitle(i18next.t("embed.title", { ns: "hola" }))
      .setDescription((await hasPermission(interaction, "embed") ? i18next.t("can_run_yes", { ns: "hola" }) : i18next.t("can_run_no", { ns: "hola" })) + '\n\n' + i18next.t("embed.description", { ns: "hola" }))
      .addFields(
        {
          name: i18next.t("embed.name_1", { ns: "hola" }),
          value: i18next.t("embed.value_1", { ns: "hola" }),
          inline: false
        },
        {
          name: i18next.t("embed.name_2", { ns: "hola" }),
          value: i18next.t("embed.value_2", { ns: "hola" }),
          inline: false
        }
      )
      .setFooter({ text: i18next.t("embed.footer", { ns: "hola" }) })
      .setTimestamp();    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ============================================= jointovoice ============================================= //

async function helpJoin(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
      .setColor(parseInt(randomcolorembed(), 16))
      .setTitle(i18next.t("jointovoice.title", { ns: "hola" }))
      .setDescription((await hasPermission(interaction, "jointovoice") ? i18next.t("can_run_yes", { ns: "hola" }) : i18next.t("can_run_no", { ns: "hola" })) + '\n')
      .addFields(
        {
          name: i18next.t("jointovoice.name_1", { ns: "hola" }),
          value: i18next.t("jointovoice.value_1", { ns: "hola" }),
          inline: false
        },
        {
          name: i18next.t("jointovoice.name_2", { ns: "hola" }),
          value: i18next.t("jointovoice.value_2", { ns: "hola" }),
          inline: false
        }
      )
      .setFooter({ text: i18next.t("jointovoice.footer", { ns: "hola" }) })
      .setTimestamp();    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ============================================= musica ============================================= //

async function helpMusic(interaction: ChatInputCommandInteraction): Promise<void> {
  try{
    if (process.env.LAVALINK_ACTIVE === 'OFF'){
      await interaction.reply({
        content: i18next.t("musica.lavalink_off", { ns: "hola" }),
        flags: MessageFlags.Ephemeral });
        return;
    }

    const embed = new EmbedBuilder()
        .setColor(parseInt(randomcolorembed(), 16))
        .setTitle(i18next.t("musica.title", { ns: "hola" }))
        .setDescription(i18next.t("musica.description", { ns: "hola" }))
        .addFields(
          {
            name: i18next.t("musica.name_1", { ns: "hola" }),
            value: await hasPermission(interaction, "play") ? i18next.t("musica.can_run_yes", { ns: "hola" }) : i18next.t("musica.can_run_no", { ns: "hola" }),
            inline: true
          },
          {
            name: i18next.t("musica.name_2", { ns: "hola" }),
            value: await hasPermission(interaction, "skip") ? i18next.t("musica.can_run_yes", { ns: "hola" }) : i18next.t("musica.can_run_no", { ns: "hola" }),
            inline: true
          },
          {
            name: i18next.t("musica.name_3", { ns: "hola" }),
            value: await hasPermission(interaction, "stop") ? i18next.t("musica.can_run_yes", { ns: "hola" }) : i18next.t("musica.can_run_no", { ns: "hola" }),
            inline: true
          },
          {
            name: i18next.t("musica.name_4", { ns: "hola" }),
            value: await hasPermission(interaction, "queue") ? i18next.t("musica.can_run_yes", { ns: "hola" }) : i18next.t("musica.can_run_no", { ns: "hola" }),
            inline: true
          },
          {
            name: i18next.t("musica.name_5", { ns: "hola" }),
            value: i18next.t("musica.value_5", { ns: "hola" }),
            inline: false
          }
        )
        .setFooter({ text: i18next.t("musica.footer", { ns: "hola" }) })
        .setTimestamp();    
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (e) {error(`Error al ejecutar comando /help: ${e}`);  }
}


// ============================================= post ============================================= //

async function helpPost(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
      .setColor(parseInt(randomcolorembed(), 16))
      .setTitle(i18next.t("post.title", { ns: "hola" }))
      .setDescription(await hasPermission(interaction, "post") ? i18next.t("can_run_yes", { ns: "hola" }) : i18next.t("can_run_no", { ns: "hola" }) + '\n\n' + i18next.t("post.description", { ns: "hola" }))
      .addFields(
        {
          name: i18next.t("post.name_1", { ns: "hola" }),
          value: i18next.t("post.value_1", { ns: "hola" }),
          inline: false
        },
        {
          name: i18next.t("post.name_2", { ns: "hola" }),
          value: i18next.t("post.value_2", { ns: "hola" }),
          inline: false
        },
        {
          name: i18next.t("post.name_3", { ns: "hola" }),
          value: i18next.t("post.value_3", { ns: "hola" }),
          inline: false
        }
      )
      .setFooter({ text: i18next.t("post.footer", { ns: "hola" }) })
      .setTimestamp();    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ============================================= test ============================================= //

async function helpTest(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
      .setColor(parseInt(randomcolorembed(), 16))
      .setTitle(i18next.t("test.title", { ns: "hola" }))
      .setDescription(await hasPermission(interaction, "test") ? i18next.t("can_run_yes", { ns: "hola" }) : i18next.t("can_run_no", { ns: "hola" }) + '\n\n' + i18next.t("test.description", { ns: "hola" }))
      .addFields(
        {
          name: i18next.t("test.name_1", { ns: "hola" }),
          value: i18next.t("test.value_1", { ns: "hola" }),
          inline: false
        },
        {
          name: i18next.t("test.name_2", { ns: "hola" }),
          value: i18next.t("test.value_2", { ns: "hola" }),
          inline: false
        },
        {
          name: i18next.t("test.name_3", { ns: "hola" }),
          value: i18next.t("test.value_3", { ns: "hola" }),
          inline: false
        },
        {
          name: i18next.t("test.name_4", { ns: "hola" }),
          value: i18next.t("test.value_4", { ns: "hola" }),
          inline: false
        }
      )
      .setFooter({ text: i18next.t("test.footer", { ns: "hola" }) })
      .setTimestamp();    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ============================================= welcome ============================================= //

async function helpWelcome(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
      .setColor(parseInt(randomcolorembed(), 16))
      .setTitle(i18next.t("welcome.title", { ns: "hola" }))
      .setDescription(await hasPermission(interaction, "welcome") ? i18next.t("can_run_yes", { ns: "hola" }) : i18next.t("can_run_no", { ns: "hola" }) + '\n\n' + i18next.t("welcome.description", { ns: "hola" }))
      .setFooter({ text: i18next.t("welcome.footer", { ns: "hola" }) })
      .setTimestamp();    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ============================================= work ============================================= //

async function helpWork(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
      .setColor(parseInt(randomcolorembed(), 16))
      .setTitle(i18next.t("work.title", { ns: "hola" }))
      .setDescription(await hasPermission(interaction, "work") ? i18next.t("can_run_yes", { ns: "hola" }) : i18next.t("can_run_no", { ns: "hola" }) + '\n\n' + i18next.t("work.description", { ns: "hola" }))
      .setFooter({ text: i18next.t("work.footer", { ns: "hola" }) })
      .setTimestamp();    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
