// src/Events-Commands/commandModales/reportHelp.ts
import { ActionRowBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags, ModalBuilder, ModalSubmitInteraction, PermissionFlagsBits, TextChannel, TextInputBuilder, TextInputStyle } from "discord.js";
import i18next from "i18next";
import { ChannelReports, checkCooldown, startCooldown } from "../../sys/zGears/auxiliares";

/* ============================================= Report ============================================= */

export async function Report(interaction: ChatInputCommandInteraction): Promise<void> {
  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) || interaction.guild?.ownerId === interaction.user.id;
  const idGuild = interaction.guildId;
  const idCooldown = "repCommand"
  if (!idGuild) { 
    await interaction.reply({ content: (i18next.t("botones:reportHelp.modal_no_guild")), flags: MessageFlags.Ephemeral }); return;
  } else if (!isAdmin) {
    await interaction.reply({ content: i18next.t("botones:reportHelp.no_admin"), flags: MessageFlags.Ephemeral });  return;
  }

  const cooldown = checkCooldown(idGuild, idCooldown);
  if (cooldown.onCooldown) {
    await interaction.reply({ content: i18next.t("botones:reportHelp.onCooldown", { a1: cooldown.timeLeft }), flags: MessageFlags.Ephemeral}); return; }
  startCooldown(idGuild, idCooldown);

  const modal = new ModalBuilder()
    .setCustomId('helpRepo')
    .setTitle(i18next.t("botones:reportHelp.modal_title"));
  const reportIn = new TextInputBuilder()
    .setCustomId('report_content')
    .setLabel(i18next.t("botones:reportHelp.modal_label"))
    .setPlaceholder(i18next.t("botones:reportHelp.modal_pholder"))
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(10)
    .setMaxLength(500) 
    .setRequired(true);
  const eMod = new ActionRowBuilder<TextInputBuilder>().addComponents(reportIn);
  modal.addComponents(eMod);
  await interaction.showModal(modal);
}

/* ============================================= /help report ============================================= */

export async function helpRepo(interaction: ModalSubmitInteraction) {
  const toSend = process.env.HOST_DISCORD_USER_ID!;
  const ownerUser = await interaction.client.users.fetch(toSend);
  const reporMsg = interaction.fields.getTextInputValue('report_content');
  const gName = interaction.guild!;
  const uData = interaction.user;
  const reportConfig = await ChannelReports(interaction.client);
  try {
    const embMsg = {
      embeds: [
        new EmbedBuilder()
        .setAuthor({name:(i18next.t("botones:reportHelp.modal_autor", { a1: uData.username})), iconURL: uData.displayAvatarURL()})
        .addFields(
          { name: (i18next.t("botones:reportHelp.modal_name_A1")), value: `Name: ${gName.name} \n Id: ${gName.id}`, inline: true },
          { name: (`\u200B`), value: (`\u200B`)},
          { name: (i18next.t("botones:reportHelp.modal_name_B1")), value: reporMsg }
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
    await interaction.reply({ content: (i18next.t("botones:reportHelp.modal_sent_success")), embeds: embMsg.embeds, flags: MessageFlags.Ephemeral });
  } catch (e) {
    console.error(`Error al enviar reporte desde modal: ${e}`);
    await interaction.reply({ content: (i18next.t("botones:reportHelp.modal_sent_error")), flags: MessageFlags.Ephemeral });
  }
}
