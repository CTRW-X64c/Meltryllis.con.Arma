import { ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, LabelBuilder } from "discord.js";
import { getGuildLimits, setGuildLimits, resetGuildLimits } from "../../sys/DB-Engine/links/noRules";
import { sendLimitsDashboard } from "../../sys/zGears/owner";

export async function handleLimitsButton(interaction: ButtonInteraction) {
    const customId = interaction.customId;
    const targetGuildId = customId.split('_')[2]; // Saca el ID del servidor (ej. de 'lim_edit_12345')

    // 1. Si presionó el botón de abrir formulario
    if (customId.startsWith("lim_edit_")) {
        const limits = await getGuildLimits(targetGuildId);
        const modal = new ModalBuilder()
            .setCustomId(`modal_lim_${targetGuildId}`)
            .setTitle('Editar Límites Numéricos');
        //cronjobs
        const inCronjobs = new TextInputBuilder()
            .setCustomId('input_cronLimited')
            .setStyle(TextInputStyle.Short)
            .setValue(limits.cronLimited.toString());
        const row1 = new LabelBuilder()
            .setLabel('Límite de publicaciones de /cronjobs')
            .setTextInputComponent(inCronjobs)
        //mangadex
        const inMangadex = new TextInputBuilder()
            .setCustomId('input_dexMax')
            .setStyle(TextInputStyle.Short)
            .setValue(limits.dexMax.toString());
        const row2 = new LabelBuilder()
            .setLabel('Límite de mangas de /mangadex')
            .setTextInputComponent(inMangadex)
        //reddit
        const inReddit = new TextInputBuilder()
            .setCustomId('input_redMax')
            .setStyle(TextInputStyle.Short)
            .setValue(limits.redMax.toString());
        const row3 = new LabelBuilder()
            .setLabel('Límite de follows de /reddit')
            .setTextInputComponent(inReddit)
        //youtube
        const inYoutube = new TextInputBuilder()
            .setCustomId('input_ytMax')
            .setStyle(TextInputStyle.Short)
            .setValue(limits.ytMax.toString());
        const row4 = new LabelBuilder()
            .setLabel('Límite de Follow de /youTube')
            .setTextInputComponent(inYoutube)
        //twetter
        const inTweet = new TextInputBuilder()
            .setCustomId('input_tweetMax')
            .setStyle(TextInputStyle.Short)
            .setValue(limits.tweetMax.toString());
        const row5 = new LabelBuilder()
            .setLabel('Límite de Follow de /tweet')
            .setTextInputComponent(inTweet)

        modal.addLabelComponents(row1, row2, row3, row4, row5);
        await interaction.showModal(modal);
        return;
    }

    if (customId.startsWith("lim_togdom_")) {
        const current = await getGuildLimits(targetGuildId);
        await setGuildLimits(targetGuildId, { chkDomain: !current.chkDomain });
        await sendLimitsDashboard(interaction, targetGuildId);
        return;
    }

    if (customId.startsWith("lim_tognode_")) {
        const current = await getGuildLimits(targetGuildId);
        await setGuildLimits(targetGuildId, { noWaitNode: !current.noWaitNode });
        await sendLimitsDashboard(interaction, targetGuildId);
        return;
    }

    if (customId.startsWith("lim_reset_")) {
        await resetGuildLimits(targetGuildId);
        await sendLimitsDashboard(interaction, targetGuildId);
        return;
    }
}