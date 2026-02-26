// src/client/models.ts
import { EmbedBuilder, MessageFlags, ModalSubmitInteraction, TextChannel } from "discord.js";
import i18next from "i18next";
import { ChannelReports } from "./auxiliares";

/* ================================= /help report ================================= */

export async function helpRepo(interaction: ModalSubmitInteraction) {
  const toSend = process.env.HOST_DISCORD_USER_ID!;
  const ownerUser = await interaction.client.users.fetch(toSend);
  const reporMsg = interaction.fields.getTextInputValue('report_content');
  const gName = interaction.guild!.name;
  const uData = interaction.user;
  const reportConfig = await ChannelReports(interaction.client);
  try {
    const embMsg = {
      embeds: [
        new EmbedBuilder()
        .setAuthor({name:(i18next.t("report.modal_autor", { ns: "hola" , a1: uData.username})), iconURL: uData.displayAvatarURL()})
        .addFields(
          { name: (i18next.t("report.modal_name_A1", { ns: "hola" })), value: gName, inline: true },
          { name: (i18next.t("report.modal_name_B1", { ns: "hola" })), value: reporMsg }
        )
        .setTimestamp()
        .setFooter({text:`Dev: ${ownerUser.username}`, iconURL: ownerUser.displayAvatarURL()})
        .setColor(0xAA0000)
      ]
    };
    
    if (reportConfig.chReport) {
      const channel = await interaction.client.channels.fetch(reportConfig.chReportId) as TextChannel;
      await channel.send(embMsg);
    } else {
      await ownerUser.send(embMsg);
    }
    await interaction.reply({ content: (i18next.t("report.modal_sent_success", { ns: "hola"})), embeds: embMsg.embeds, flags: MessageFlags.Ephemeral });
  } catch (e) {
    console.error(`Error al enviar reporte desde modal: ${e}`);
    await interaction.reply({ content: (i18next.t("report.modal_sent_error", { ns: "hola"})), flags: MessageFlags.Ephemeral });
  }
}
