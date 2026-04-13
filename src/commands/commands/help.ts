// src/Events-Commands/commands/help.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, MessageFlags, AutocompleteInteraction } from "discord.js";
import i18next from "i18next";
import { error } from "../../sys/logging";
import { Report } from "../commandModales/reportHelp";
import { hasPermission } from "../../sys/zGears/mPermission";
import lavalinkManager from "../../bgProcess/lavalinkConnect";
import { testPermisos } from "../../sys/zGears/auxiliares";

// ============================================= Autocomplete ============================================= //

export async function helpAutocomplete(interaction: AutocompleteInteraction) {
  const helpList = [
    { name: "info", value: "00" },
    { name: "REPORTAR PROBLEMA!! (solo admin)", value: "0X" },
    ...(lavalinkManager ? [{ name: "Musica: /play /stop /skip /queue", value: "05" }] : []),
    { name: "/buttonLink", value: "14" },
    { name: "/buttonRole", value: "15" },
    { name: "/cleanup", value: "01" },
    { name: "/embed", value: "02" },
    { name: "/jointovoice", value: "03" },
    { name: "/mangadex", value: "04" },
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

// ============================================= Register ============================================= //

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

// ============================================= embedMaker ============================================= //

function rngColor(): string { const color = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase(); return `0x${color.padStart(6, '0')}` }
interface hData { command: string; title: string; description?: string; color?: number; imageUrl?: string; fields?: hField[]; footer?: string; srvPerm?: string; chPerm?: string }
interface hField { name: string; value: string; inline?: boolean }
async function embedMaker(interaction: ChatInputCommandInteraction, data: hData): Promise<void> {
  const { command, title, description, color, imageUrl, fields = [], footer, srvPerm, chPerm } = data;
  const Meltryllis = interaction.guild?.members.me;
  const embColor = color ? color : parseInt(rngColor(), 16);
  let finText = i18next.t("help:embMaker.no_need_permission");
  if (command !== "info") {
    const canRun = await hasPermission(interaction, command);
    finText = canRun ? i18next.t("help:embMaker.can_run_yes") : i18next.t("help:embMaker.can_run_no");
  };
  if (description) { finText += '\n\n' + description };
  if (Meltryllis) {
    if (srvPerm) {
      const gPerm = Meltryllis.permissions;
      const tPerm = testPermisos(gPerm, srvPerm);
      if (tPerm.length > 0) {
        fields.push({ name: i18next.t("help:embMaker.hasGlobalPermission"), value: tPerm.join("\n") + "\n" + i18next.t("help:embMaker.hasGlobalNota"), inline: false });
      }
    }

    if (chPerm) {
      const channel = interaction.channel;
      if (channel && 'permissionsFor' in channel) {
        const cPerm = channel.permissionsFor(Meltryllis);
        const tPerm = testPermisos(cPerm, chPerm);
        if (tPerm.length > 0) {
          fields.push({ name: i18next.t("help:embMaker.hasPermission", { a1: `<#${channel.id}>` }), value: tPerm.join("\n"), inline: false });
        }
      }
    }
  }

  const embed = new EmbedBuilder()
    .setColor(embColor)
    .setTitle(title)
    .setTimestamp()
    .setDescription(finText)
  if (fields.length > 0) { embed.addFields(fields); }
  if (footer) { embed.setFooter({ text: footer }); }
  if (imageUrl) { embed.setImage(imageUrl); }
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ============================================= Handler principal ============================================= //

export async function handleHelpCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const opHelp = interaction.options.getString("command") || "00";
    switch (opHelp) {
      case "0X": await Report(interaction); break;
      /* ======================== info ======================== */
      case "00": await embedMaker(interaction, {
        command: "info",
        title: i18next.t("help:info.embed_title"),
        description: i18next.t("help:info.embed_description"),
        fields: [
          { name: i18next.t("help:info.field_invite_name"), value: i18next.t("help:info.field_invite_value"), inline: true },
          { name: i18next.t("help:info.field_terms_name"), value: i18next.t("help:info.field_terms_value"), inline: true },
          { name: i18next.t("help:info.field_issue_name"), value: i18next.t("help:info.field_issue_value"), inline: false }
        ],
        imageUrl: "https://raw.githubusercontent.com/CTRW-X64c/Meltryllis.con.Arma/refs/heads/RemodelCommands/Pict/embedd.gif",
        footer: i18next.t("help:info.footer_text"),
        srvPerm: "meltrys"
      }); break;
      /* ======================== CleanUp ======================== */
      case "01": await embedMaker(interaction, {
        command: "cleanup",
        title: i18next.t("help:clean.title"),
        description: i18next.t("help:clean.description"),
        color: 0x0099ff,
        fields: [
          { name: i18next.t("help:clean.name_1"), value: i18next.t("help:clean.value_1") },
        ],
        footer: i18next.t("help:clean.footer"),
        chPerm: "chsee|msgManager|sundmsg|addlink",
        //imageUrl: "https://raw.githubusercontent.com/CTRW-X64c/Meltryllis.con.Arma/refs/heads/main/Pict/clean.png",
      }); break;
      /* ======================== embed ======================== */
      case "02": await embedMaker(interaction, {
        command: "embed",
        title: i18next.t("help:embed.title"),
        description: i18next.t("help:embed.description"),
        fields: [
          { name: i18next.t("help:embed.name_1"), value: i18next.t("help:embed.value_1") },
          { name: i18next.t("help:embed.name_2"), value: i18next.t("help:embed.value_2") },
        ],
        footer: i18next.t("help:embed.footer"),
      }); break;
      /* ======================== jointovoice ======================== */
      case "03": await embedMaker(interaction, {
        command: "jointovoice",
        title: i18next.t("help:jointovoice.title"),
        fields: [
          { name: i18next.t("help:jointovoice.name_1"), value: i18next.t("help:jointovoice.value_1") },
          { name: i18next.t("help:jointovoice.name_2"), value: i18next.t("help:jointovoice.value_2") },
        ],
        chPerm: "chmanager",
        footer: i18next.t("help:jointovoice.footer"),
        srvPerm: "voiceConnect|voiceMove",
      }); break;
      /* ======================== mangadex ======================== */
      case "04": await embedMaker(interaction, {
        command: "mangadex",
        title: i18next.t("help:mangadex.HelpEmb_titulo"),
        description: i18next.t("help:mangadex.HelpEmb_descripcion"),
        color: 0xFF6740,
        fields: [
          { name: i18next.t("help:mangadex.HelpEmb_Field_Name_1"), value: i18next.t("help:mangadex.HelpEmb_Field_Value_1") },
          { name: i18next.t("help:mangadex.HelpEmb_Field_Name_2"), value: i18next.t("help:mangadex.HelpEmb_Field_Value_2") },
        ],
        footer: i18next.t("help:mangadex.HelpEmb_footer"),
      }); break;
      /* ======================== Musica ======================== */
      case "05":
        if (!lavalinkManager) {
          await interaction.reply({ content: i18next.t("help:musica.lavalink_off"), flags: MessageFlags.Ephemeral });
          break;
        }
        await embedMaker(interaction, {
          command: "play /stop /skip /queue",
          title: i18next.t("help:musica.title"),
          description: i18next.t("help:musica.description"),
          fields: [
            { name: i18next.t("help:musica.name_5"), value: i18next.t("help:musica.value_5"), inline: false }
          ],
          footer: i18next.t("help:musica.footer"),
          srvPerm: "voiceMove|voiceConnect",
          chPerm: "chsee"
        }); break;
      /* ======================== Permisos ======================== */
      case "06": await embedMaker(interaction, {
        command: "permisos",
        title: i18next.t("help:permisos.help_title"),
        description: i18next.t("help:permisos.help_desc"),
        fields: [
          { name: i18next.t("help:permisos.help_add_title"), value: i18next.t("help:permisos.help_add_desc"), inline: false },
          { name: i18next.t("help:permisos.help_list_title"), value: i18next.t("help:permisos.help_list_desc"), inline: false },
          { name: i18next.t("help:permisos.help_remove_title"), value: i18next.t("help:permisos.help_remove_desc"), inline: false },
          { name: i18next.t("help:permisos.help_clear_title"), value: i18next.t("help:permisos.help_clear_desc"), inline: false }
        ],
        footer: i18next.t("help:permisos.footer_text_help")
      }); break;
      /* ======================== post ======================== */
      case "07": await embedMaker(interaction, {
        command: "post",
        title: i18next.t("help:post.title"),
        description: i18next.t("help:post.description"),
        fields: [
          { name: i18next.t("help:post.name_1"), value: i18next.t("help:post.value_1") },
          { name: i18next.t("help:post.name_2"), value: i18next.t("help:post.value_2") },
          { name: i18next.t("help:post.name_3"), value: i18next.t("help:post.value_3") },
        ],
        footer: i18next.t("help:post.footer"),
      }); break;
      /* ======================== reddit ======================== */
      case "08": await embedMaker(interaction, {
        command: "reddit",
        title: i18next.t("help:reddit.HelpEmb_titulo"),
        description: i18next.t("help:reddit.HelpEmb_descripcion"),
        color: 0xFF4500,
        fields: [
          { name: i18next.t("help:reddit.HelpEmb_Field_Name_1"), value: i18next.t("help:reddit.HelpEmb_Field_Value_1") },
          { name: i18next.t("help:reddit.HelpEmb_Field_Name_2"), value: i18next.t("help:reddit.HelpEmb_Field_Value_2") },
          { name: i18next.t("help:reddit.HelpEmb_Field_Name_3"), value: i18next.t("help:reddit.HelpEmb_Field_Value_3") },
          { name: i18next.t("help:reddit.HelpEmb_Field_Name_4"), value: i18next.t("help:reddit.HelpEmb_Field_Value_4") },
        ],
        footer: i18next.t("help:reddit.footer"),
      }); break;
      /* ======================== Rolemoji ======================== */
      case "09": await embedMaker(interaction, {
        command: "rolemoji",
        title: i18next.t("help:rolemoji.help_title"),
        description: i18next.t("help:rolemoji.help_description"),
        fields: [
          { name: i18next.t("help:rolemoji.paso_1"), value: i18next.t("help:rolemoji.fix_1") },
          { name: i18next.t("help:rolemoji.paso_2"), value: i18next.t("help:rolemoji.fix_2"), inline: false },
          { name: i18next.t("help:rolemoji.paso_3"), value: i18next.t("help:rolemoji.fix_3"), inline: false }
        ],
        imageUrl: "https://raw.githubusercontent.com/CTRW-X64c/Meltryllis.con.Arma/refs/heads/main/Pict/RolemojiHelp.png",
        footer: i18next.t("help:rolemoji.help_footer"),
        srvPerm: "roles",
        chPerm: "chsee|reactions|emojis"
      }); break;
      /* ======================== test ======================== */
      case "10": await embedMaker(interaction, {
        command: "test",
        title: i18next.t("help:test.title"),
        description: i18next.t("help:test.description"),
        fields: [
          { name: i18next.t("help:test.name_1"), value: i18next.t("help:test.value_1") },
          { name: i18next.t("help:test.name_2"), value: i18next.t("help:test.value_2") },
          { name: i18next.t("help:test.name_3"), value: i18next.t("help:test.value_3") },
          { name: i18next.t("help:test.name_4"), value: i18next.t("help:test.value_4") },
        ],
        footer: i18next.t("help:test.footer"),
      }); break;
      /* ======================== welcome ======================== */
      case "11": await embedMaker(interaction, {
        command: "welcome",
        title: i18next.t("help:welcome.title"),
        description: i18next.t("help:welcome.description"),
        footer: i18next.t("help:welcome.footer"),
        chPerm: "chsee|msgManager"
      }); break;
      /* ======================== work ======================== */
      case "12": await embedMaker(interaction, {
        command: "work",
        title: i18next.t("help:work.title"),
        description: i18next.t("help:work.description"),
        footer: i18next.t("help:work.footer"),
      }); break;
      /* ======================== youtube ======================== */
      case "13": await embedMaker(interaction, {
        command: "youtube",
        title: i18next.t("help:youtube.titulo"),
        description: i18next.t("help:youtube.descripcion"),
        color: 0xff0000,
        fields: [
          { name: i18next.t("help:youtube.Field_Name_1"), value: i18next.t("help:youtube.Field_Value_1") },
          { name: i18next.t("help:youtube.Field_Name_2"), value: i18next.t("help:youtube.Field_Value_2") },
        ],
        footer: i18next.t("help:youtube.footer"),
        //imageUrl: "https://raw.githubusercontent.com/CTRW-X64c/Meltryllis.con.Arma/refs/heads/main/Pict/YouTubeHelp.png",
      }); break;
      /* ======================== buttonLink ======================== */
      case "14": await embedMaker(interaction, {
        command: "buttonlink",
        title: i18next.t("help:buttonLink.title"),
        description: i18next.t("help:buttonLink.description"),
        footer: i18next.t("help:buttonLink.footer"),
      }); break;
      /* ======================== buttonRole ======================== */
      case "15": await embedMaker(interaction, {
        command: "buttonrole",
        title: i18next.t("help:buttonRole.title"),
        description: i18next.t("help:buttonRole.description"),
        footer: i18next.t("help:buttonRole.footer"),
      }); break;
      /* ======================== default ======================== */
      default:
        await interaction.reply({ content: i18next.t("help:comBuild.default_switch_error"), flags: MessageFlags.Ephemeral, });
        break;
    }
  } catch (e) {
    error(`Error al ejecutar comando /help "switch": ${e}`);
  }
}
