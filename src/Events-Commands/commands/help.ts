// src/Events-Commands/commands/help.ts
import { ChatInputCommandInteraction,  SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionsBitField, PermissionFlagsBits, AutocompleteInteraction } from "discord.js";
import i18next from "i18next";
import { error } from "../../sys/logging";
import { Report } from "../commandModales/reportHelp";
import { hasPermission } from "../../sys/zGears/mPermission";

export async function helpAutocomplete(interaction: AutocompleteInteraction) {
  const helpList = [
  { name: "info", value: "00" },
  { name: "REPORTAR PROBLEMA!! (solo admin)", value: "0X" },
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
  ];

  const focusedValue = interaction.options.getFocused();
  const filtered = helpList.filter(list => list.name.toLowerCase().includes(focusedValue.toLowerCase()));
  await interaction.respond(
    filtered.slice(0, 25).map(list => ({ name: list.name, value: list.value }))
  );
}

export async function registerHelpCommand(): Promise<SlashCommandBuilder[]> {
  const holaCommand = new SlashCommandBuilder()
    .setName("help")
    .setDescription(i18next.t("help:comBuild.command_hola_description"))
    .addStringOption((op) =>
    op
      .setName("command")
      .setDescription(i18next.t("help:comBuild.command_hola_idioma_description"))
      .setRequired(false)
      .setAutocomplete(true)
    );

  return [holaCommand] as SlashCommandBuilder[];
}

function randomcolorembed(): string {
  const color = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase();
  return `0x${color.padStart(6, '0')}`;
}

export async function handleHelpCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const opHelp = interaction.options.getString("command") || "00";
    switch (opHelp) {   
      case "00":  await info(interaction);  break;
      case "0X":  await Report(interaction);  break;
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
        await interaction.reply({content: i18next.t("help:comBuild.default_switch_error"), flags: MessageFlags.Ephemeral,});
        break;
      }
    } catch (e) {
      error(`Error al ejecutar comando /help: ${e}`);
    }
}

// ============================================= info ============================================= //

async function info(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle(i18next.t("help:info.embed_title"))
    .setDescription(i18next.t("help:info.embed_description"))
    .addFields(
      {
        name: i18next.t("help:info.field_invite_name"),
        value: i18next.t("help:info.field_invite_value"),
        inline: true
      },
      {
        name: i18next.t("help:info.field_terms_name"),
        value: i18next.t("help:info.field_terms_value"),
        inline: true
      },
      {
        name: i18next.t("help:info.field_issue_name"),
        value: i18next.t("help:info.field_issue_value"),
        inline: false
      }
    )
    .setImage("https://raw.githubusercontent.com/CTRW-X64c/Meltryllis.con.Arma/refs/heads/RemodelCommands/Pict/embedd.gif")
    .setColor(parseInt(randomcolorembed(), 16))
    .setFooter({text: i18next.t("help:info.footer_text")})
    .setTimestamp();
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ============================================= CleanUp ============================================= //

async function helpClean(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
      .setColor("#0099ff")
      .setTitle(i18next.t("help:clean.title"))
      .setDescription(await hasPermission(interaction, "cleanup") ? i18next.t("help:can_run_yes") : i18next.t("help:can_run_no"))
      .addFields(
        {
          name: i18next.t("help:clean.name_1"),
          value: i18next.t("help:clean.value_1"),
        }, 
      )
      .setFooter({ text: i18next.t("help:clean.footer") })
      .setTimestamp();    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ============================================= mangadex ============================================= //

async function helpManga(interaction: ChatInputCommandInteraction): Promise<void> {
  
  const embed = new EmbedBuilder()
    .setTitle(i18next.t("help:mangadex.HelpEmb_titulo")) 
    .setDescription((await hasPermission(interaction, "mangadex") ? i18next.t("help:can_run_yes") : i18next.t("help:can_run_no")) + '\n\n' + i18next.t("help:mangadex.HelpEmb_descripcion"))
    .addFields(
      {
        name: i18next.t("help:mangadex.HelpEmb_Field_Name_1"),
        value: i18next.t("help:mangadex.HelpEmb_Field_Value_1"),
        inline: false
      },
      {
        name: i18next.t("help:mangadex.HelpEmb_Field_Name_2"),
        value: i18next.t("help:mangadex.HelpEmb_Field_Value_2"),
        inline: false
      }  
    )
    .setColor(0xFF6740)
    .setFooter({text: i18next.t("help:mangadex.HelpEmb_footer"),});
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral});
}

// ============================================= permisos ============================================= //

async function helpPermisos(interaction: ChatInputCommandInteraction): Promise<void> {
  try{
  const { guild, user, memberPermissions } = interaction;
  const isAdmin = user.id === guild?.ownerId || memberPermissions?.has(PermissionFlagsBits.Administrator)
  const embed = new EmbedBuilder()
    .setTitle(i18next.t("help:permisos.help_title"))
    .setColor(parseInt(randomcolorembed(), 16))
    .setDescription((isAdmin ? i18next.t("help:permisos.run_yes") : i18next.t("help:permisos.run_no")) + '\n\n' + i18next.t("help:permisos.help_desc"))
    .addFields(
      {
        name: i18next.t("help:permisos.help_add_title"),
        value: i18next.t("help:permisos.help_add_desc"),
        inline: false
      },
      {
        name: i18next.t("help:permisos.help_list_title"),
        value: i18next.t("help:permisos.help_list_desc"),
        inline: false
      },
      {
        name: i18next.t("help:permisos.help_remove_title"),
        value: i18next.t("help:permisos.help_remove_desc"),
        inline: false
      },
      {
        name: i18next.t("help:permisos.help_clear_title"),
        value: i18next.t("help:permisos.help_clear_desc"),
        inline: false
      },
    )
    .setFooter({ text: i18next.t("help:permisos.footer_text_help")})
    .setTimestamp();
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral});
  } catch (e) {error(`Error al ejecutar comando /help: ${e}`);  }
}

// ============================================= reddit ============================================= //

async function helpReddit(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle(i18next.t("help:reddit.HelpEmb_titulo"))
    .setColor(0xFF4500)
    .setDescription((await hasPermission(interaction, "reddit") ? i18next.t("help:can_run_yes") : i18next.t("help:can_run_no")) + '\n\n' + i18next.t("help:reddit.HelpEmb_descripcion"))
    .addFields(
      {
        name: i18next.t("help:reddit.HelpEmb_Field_Name_1"),
        value: i18next.t("help:reddit.HelpEmb_Field_Value_1"),
      },
      { 
        name: i18next.t("help:reddit.HelpEmb_Field_Name_2"),
        value: i18next.t("help:reddit.HelpEmb_Field_Value_2"),
      },
      { 
        name: i18next.t("help:reddit.HelpEmb_Field_Name_3"),
        value: i18next.t("help:reddit.HelpEmb_Field_Value_3"),
      },
      { 
        name: i18next.t("help:reddit.HelpEmb_Field_Name_4"),
        value: i18next.t("help:reddit.HelpEmb_Field_Value_4"),
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
            content: i18next.t("common:Errores.noChannel"),
            flags: MessageFlags.Ephemeral 
        });
        return;
    }
    
    const botMember = guild.members.me;
    if (!botMember) {
        await interaction.reply({
            content: i18next.t("help:rolemoji.error_user"), 
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
        .setTitle(i18next.t("help:rolemoji.help_title"))
        .setDescription((await hasPermission(interaction, "rolemoji") ? i18next.t("help:can_run_yes") : i18next.t("help:can_run_no")) + '\n\n' + i18next.t("help:rolemoji.help_description"))
        .addFields(
            {
                name: i18next.t("help:rolemoji.paso_1"),
                value: i18next.t("help:rolemoji.fix_1"),
            }, 
            {
                name: i18next.t("help:rolemoji.manage_roles_permission"),
                value: ManageRoles ? i18next.t("help:rolemoji.allowed_permission") : i18next.t("help:rolemoji.missing_permission"),
                inline: true,
            },
            {
                name: i18next.t("help:rolemoji.add_reactions_permission"),
                value: AddReactions ? i18next.t("help:rolemoji.allowed_permission") : i18next.t("help:rolemoji.missing_permission"),
                inline: true,
            },
            {
                name: i18next.t("help:rolemoji.use_external_emojis_permission"),
                value: ExternalEmojis ? i18next.t("help:rolemoji.allowed_permission") : i18next.t("help:rolemoji.missing_permission"),
                inline: true,
            },
            {
                name: i18next.t("help:rolemoji.paso_2"),
                value: i18next.t("help:rolemoji.fix_2"),
                inline: false,
            }, 
            {
                name: i18next.t("help:rolemoji.paso_3"),
                value: i18next.t("help:rolemoji.fix_3"),
                inline: false,
            }
        )
        .setFooter({ text: i18next.t("help:rolemoji.help_footer") })
        .setImage("https://raw.githubusercontent.com/CTRW-X64c/Meltryllis.con.Arma/refs/heads/main/Pict/RolemojiHelp.png")
        .setTimestamp();
        
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (e) {error(`Error al ejecutar comando /help: ${e}`);  }
}

// ============================================= youtube ============================================= //

async function helpYoutube(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle(i18next.t("help:youtube.titulo")) 
    .setDescription((await hasPermission(interaction, "youtube") ? i18next.t("help:can_run_yes") : i18next.t("help:can_run_no")) + '\n\n' + i18next.t("help:youtube.descripcion"))
    .addFields(
      {
        name: i18next.t("help:youtube.Field_Name_1"),
        value: i18next.t("help:youtube.Field_Value_1"),
        inline: false
      },
      {
        name: i18next.t("help:youtube.Field_Name_2"),
        value: i18next.t("help:youtube.Field_Value_2"),
        inline: false
      }
    )
    //.setImage("https://i.imgur.com/hBy4KhT.jpeg")
    .setColor("#ff0000")
    .setFooter({text: i18next.t("help:youtube.footer"),});
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral});
} 

// ============================================= embed ============================================= //

async function helpEmbed(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
      .setColor(parseInt(randomcolorembed(), 16))
      .setTitle(i18next.t("help:embed.title"))
      .setDescription((await hasPermission(interaction, "embed") ? i18next.t("help:can_run_yes") : i18next.t("help:can_run_no")) + '\n\n' + i18next.t("help:embed.description"))
      .addFields(
        {
          name: i18next.t("help:embed.name_1"),
          value: i18next.t("help:embed.value_1"),
          inline: false
        },
        {
          name: i18next.t("help:embed.name_2"),
          value: i18next.t("help:embed.value_2"),
          inline: false
        }
      )
      .setFooter({ text: i18next.t("help:embed.footer") })
      .setTimestamp();    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ============================================= jointovoice ============================================= //

async function helpJoin(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
      .setColor(parseInt(randomcolorembed(), 16))
      .setTitle(i18next.t("help:jointovoice.title"))
      .setDescription((await hasPermission(interaction, "jointovoice") ? i18next.t("help:can_run_yes") : i18next.t("help:can_run_no")) + '\n')
      .addFields(
        {
          name: i18next.t("help:jointovoice.name_1"),
          value: i18next.t("help:jointovoice.value_1"),
          inline: false
        },
        {
          name: i18next.t("help:jointovoice.name_2"),
          value: i18next.t("help:jointovoice.value_2"),
          inline: false
        }
      )
      .setFooter({ text: i18next.t("help:jointovoice.footer") })
      .setTimestamp();    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ============================================= musica ============================================= //

async function helpMusic(interaction: ChatInputCommandInteraction): Promise<void> {
  try{
    const lavalinkUp = process.env.LAVALINK_NAME && process.env.LAVALINK_HOST && process.env.LAVALINK_PASSWORD;
    if (!lavalinkUp) {
      await interaction.reply({
        content: i18next.t("help:musica.lavalink_off"),
        flags: MessageFlags.Ephemeral });
        return;
    }

    const embed = new EmbedBuilder()
        .setColor(parseInt(randomcolorembed(), 16))
        .setTitle(i18next.t("help:musica.title"))
        .setDescription(i18next.t("help:musica.description"))
        .addFields(
          {
            name: i18next.t("help:musica.name_1"),
            value: await hasPermission(interaction, "play /stop /skip /queue") ? i18next.t("help:musica.can_run_yes") : i18next.t("help:musica.can_run_no"),
            inline: true
          },
          {
            name: i18next.t("help:musica.name_5"),
            value: i18next.t("help:musica.value_5"),
            inline: false
          }
        )
        .setFooter({ text: i18next.t("help:musica.footer") })
        .setTimestamp();    
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (e) {error(`Error al ejecutar comando /help: ${e}`);  }
}

// ============================================= post ============================================= //

async function helpPost(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
      .setColor(parseInt(randomcolorembed(), 16))
      .setTitle(i18next.t("help:post.title"))
      .setDescription((await hasPermission(interaction, "post") ? i18next.t("help:can_run_yes") : i18next.t("help:can_run_no")) + '\n\n' + i18next.t("help:post.description"))
      .addFields(
        {
          name: i18next.t("help:post.name_1"),
          value: i18next.t("help:post.value_1"),
          inline: false
        },
        {
          name: i18next.t("help:post.name_2"),
          value: i18next.t("help:post.value_2"),
          inline: false
        },
        {
          name: i18next.t("help:post.name_3"),
          value: i18next.t("help:post.value_3"),
          inline: false
        }
      )
      .setFooter({ text: i18next.t("help:post.footer") })
      .setTimestamp();    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ============================================= test ============================================= //

async function helpTest(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
      .setColor(parseInt(randomcolorembed(), 16))
      .setTitle(i18next.t("help:test.title"))
      .setDescription((await hasPermission(interaction, "test") ? i18next.t("help:can_run_yes") : i18next.t("help:can_run_no")) + '\n\n' + i18next.t("help:test.description"))
      .addFields(
        {
          name: i18next.t("help:test.name_1"),
          value: i18next.t("help:test.value_1"),
          inline: false
        },
        {
          name: i18next.t("help:test.name_2"),
          value: i18next.t("help:test.value_2"),
          inline: false
        },
        {
          name: i18next.t("help:test.name_3"),
          value: i18next.t("help:test.value_3"),
          inline: false
        },
        {
          name: i18next.t("help:test.name_4"),
          value: i18next.t("help:test.value_4"),
          inline: false
        }
      )
      .setFooter({ text: i18next.t("help:test.footer") })
      .setTimestamp();    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ============================================= welcome ============================================= //

async function helpWelcome(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
      .setColor(parseInt(randomcolorembed(), 16))
      .setTitle(i18next.t("help:welcome.title"))
      .setDescription((await hasPermission(interaction, "welcome") ? i18next.t("help:can_run_yes") : i18next.t("help:can_run_no")) + '\n\n' + i18next.t("help:welcome.description"))
      .setFooter({ text: i18next.t("help:welcome.footer") })
      .setTimestamp();    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ============================================= work ============================================= //

async function helpWork(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
      .setColor(parseInt(randomcolorembed(), 16))
      .setTitle(i18next.t("help:work.title"))
      .setDescription((await hasPermission(interaction, "work") ? i18next.t("help:can_run_yes") : i18next.t("help:can_run_no")) + '\n\n' + i18next.t("help:work.description"))
      .setFooter({ text: i18next.t("help:work.footer") })
      .setTimestamp();    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ============================================= FIN ============================================= //