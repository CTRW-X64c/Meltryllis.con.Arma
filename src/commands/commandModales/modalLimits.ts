import { EmbedBuilder, MessageFlags, ModalSubmitInteraction } from "discord.js";
import { getGuildLimits, setGuildLimits } from "../../sys/DB-Engine/links/noRules";

export async function handleLimitsModal(interaction: ModalSubmitInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const customId = interaction.customId;
    const targetGuildId = customId.split('_')[2];

    const newDex = parseInt(interaction.fields.getTextInputValue('input_dexMax'));
    const newRed = parseInt(interaction.fields.getTextInputValue('input_redMax'));
    const newCron = parseInt(interaction.fields.getTextInputValue('input_cronLimited'));
    const newYt = parseInt(interaction.fields.getTextInputValue('input_ytMax'));
    const newTweet = parseInt(interaction.fields.getTextInputValue('input_tweetMax'));

    if (isNaN(newDex) || isNaN(newRed) || isNaN(newCron) || isNaN(newYt) || isNaN(newTweet)) {
        await interaction.editReply({ content: '❌ Solo ingresa números válidos.' });
        return;
    }

    await setGuildLimits(targetGuildId, { dexMax: newDex, redMax: newRed, cronLimited: newCron, ytMax: newYt, tweetMax: newTweet });

    const chkServer = await interaction.client.guilds.fetch(targetGuildId).catch(() => null);
    const serverName = chkServer ? chkServer.name : targetGuildId;
    const limits = await getGuildLimits(targetGuildId);
    const embed = new EmbedBuilder()
        .setTitle(`🛠️ Panel de Límites | Servidor: ${targetGuildId}`)
        .setColor('Blue')
        .addFields(
            { name: '📊 Límites Numéricos', value: `> **Cronjobs:** ${limits.cronLimited}\n> **MangaDex:** ${limits.dexMax}\n> **Reddit:** ${limits.redMax}\n> **YouTube:** ${limits.ytMax}\n> **Twitter:** ${limits.tweetMax}` },
            { name: '⚙️ Permisos Especiales', value: `> **Check Domain:** ${limits.chkDomain ? '✅' : '❌'}\n> **No Wait Node:** ${limits.noWaitNode ? '✅' : '❌'}` }
        );
    await interaction.editReply({ content: `✅ Limites actualizados para el servidor ${serverName}.`, embeds: [embed] });
}