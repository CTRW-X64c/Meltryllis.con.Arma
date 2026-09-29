// src/Events-Commands/commandModales/reportHelp.ts
import { ButtonInteraction, ChatInputCommandInteraction, EmbedBuilder, MessageFlags, ModalBuilder, ModalSubmitInteraction, PermissionFlagsBits, TextChannel, TextInputBuilder, TextInputStyle, LabelBuilder } from "discord.js";
import i18next from "i18next";
import { adminChannel, checkCooldown, startCooldown } from "../../sys/zGears/auxiliares";

/* ============================================= Report ============================================= */

export async function Report(i: ChatInputCommandInteraction): Promise<void> {
  const isAdmin = i.memberPermissions?.has(PermissionFlagsBits.Administrator) || i.guild?.ownerId === i.user.id;
  const idGuild = i.guildId;
  const idCooldown = "repCommand"

  if (!idGuild) { await i.reply({ content: (i18next.t("botones:reportHelp.modal_no_guild")) }); return; }
  if (!isAdmin) { await i.reply({ content: i18next.t("botones:reportHelp.no_admin") }); return; }

  const cooldown = checkCooldown(idGuild, idCooldown);
  if (cooldown.onCooldown) { await i.reply({ content: i18next.t("botones:reportHelp.onCooldown", { a1: cooldown.timeLeft }) }); return; }

  startCooldown(idGuild, idCooldown);
  const modal = new ModalBuilder().setCustomId(`helpRepo_${i.user.id}`).setTitle(i18next.t("botones:reportHelp.modal_title"));
  const eMod = new LabelBuilder().setLabel(i18next.t("botones:reportHelp.modal_label")).setTextInputComponent(
    new TextInputBuilder().setCustomId('report_content').setPlaceholder(i18next.t("botones:reportHelp.modal_pholder"))
      .setStyle(TextInputStyle.Paragraph).setMinLength(10).setMaxLength(500).setRequired(true)
  );
  modal.addLabelComponents(eMod);
  await i.showModal(modal);
}

/* ============================================= /help report ============================================= */

export async function helpRepo(interaction: ModalSubmitInteraction) {
  const toSend = process.env.HOST_DISCORD_USER_ID!;
  const ownerUser = await interaction.client.users.fetch(toSend);
  const reporMsg = interaction.fields.getTextInputValue('report_content');
  const gName = interaction.guild!;
  const uData = interaction.user;
  const reportConfig = await adminChannel(interaction.client);
  try {
    const embMsg = {
      embeds: [
        new EmbedBuilder()
          .setAuthor({ name: (i18next.t("botones:reportHelp.modal_autor", { a1: uData.username, a2: uData.id })), iconURL: uData.displayAvatarURL() })
          .addFields(
            { name: (i18next.t("botones:reportHelp.modal_name_A1")), value: `Name: ${gName.name} \n Id: ${gName.id}`, inline: true },
            { name: (i18next.t("botones:reportHelp.modal_name_B1")), value: reporMsg }
          )
          .setTimestamp()
          .setFooter({ text: `Dev: ${ownerUser.username}`, iconURL: ownerUser.displayAvatarURL() })
          .setColor(0xAA0000)
      ]
    };

    if (reportConfig.upChannel) {
      const channel = await interaction.client.channels.fetch(reportConfig.channelId) as TextChannel;
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

/* ============================================= /owner response ============================================= */
export async function handleReportResponseButton(interaction: ButtonInteraction) {
  if (interaction.customId.startsWith("btn_openreport_")) {
    const idUsuario = interaction.customId.split('_')[2];

    const reportModal = new ModalBuilder()
      .setCustomId(`respondReport_${idUsuario}`)
      .setTitle(`Respuesta de reporte`);

    const repIn = new TextInputBuilder()
      .setCustomId(`reportcont`)

      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const rMod = new LabelBuilder()
      .setLabel("Escribe tu respuesta:")
      .setTextInputComponent(repIn)
    reportModal.addLabelComponents(rMod);

    await interaction.showModal(reportModal);
  }
}