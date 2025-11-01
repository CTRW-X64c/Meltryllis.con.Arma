// src/client/commands/hola.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js";
import i18next from "i18next";
import { error, debug } from "../../logging";

export async function registerHolaCommand(): Promise<SlashCommandBuilder[]> {
  const holaCommand = new SlashCommandBuilder()
    .setName("hola")
    .setDescription(i18next.t("command_hola_description", { ns: "hola" }));

  return [holaCommand];
}

export async function handleHolaCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
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
          name: i18next.t("field_test_name", { ns: "hola" }),
          value: i18next.t("field_test_value", { ns: "hola" }),
          inline: false
        },
        {
          name: i18next.t("field_replybots_name", { ns: "hola" }),
          value: i18next.t("field_replybots_value", { ns: "hola" }),
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
      )
      .setImage("https://i.imgur.com/hBy4KhT.jpeg")
      .setColor("#d20fae")
      .setFooter({
        text: i18next.t("footer_text", { ns: "hola" }),
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    debug("Comando /hola ejecutado");
  } catch (err) {
    error(`Error al ejecutar comando /hola: ${err}`);
    await interaction.reply({
      content: i18next.t("command_error", { ns: "hola" }),
      flags: MessageFlags.Ephemeral,
    });
  }
}