// src/client/models.ts
import { EmbedBuilder, MessageFlags, ModalSubmitInteraction } from "discord.js";

/* ================================= /help report ================================= */

export async function helpRepo(interaction: ModalSubmitInteraction) {
  const toSend = process.env.HOST_DISCORD_USER_ID!;
  if (!interaction.guild) { 
    await interaction.reply({ content: "Se requiere que se mande desde el gremio que presenta el problema!!", flags: MessageFlags.Ephemeral }); return;
  } 
  const ownerUser = await interaction.client.users.fetch(toSend);
  const reporMsg = interaction.fields.getTextInputValue('report_content');
  const gName = interaction.guild.name || "Desconocido";
  const uData = interaction.user;
  try {
    const embSend = await ownerUser.send({
      embeds: [
        new EmbedBuilder()
        .setAuthor({name:`Reporte de: ${uData.username}`, iconURL: uData.displayAvatarURL()})
        .addFields(
          { name: "Server:", value: gName, inline: true },
          { name: "Mensaje:", value: reporMsg }
        )
        .setTimestamp()
        .setFooter({text:`Dev: ${ownerUser.username}`, iconURL: ownerUser.displayAvatarURL()})
        .setColor(0xAA0000)
      ]
    });

  await interaction.reply({ content: "✅ ¡Reporte enviado con éxito al desarrollador!\nCopia del mensaje de reporte:", embeds: embSend.embeds, flags: MessageFlags.Ephemeral });
  } catch (e) {
    console.error(`Error al enviar reporte desde modal: ${e}`);
    await interaction.reply({ content: "❌ Error al enviar el reporte. Intenta de nuevo más tarde.", flags: MessageFlags.Ephemeral });
  }
}

/* ================================= Nuevo ================================= */
