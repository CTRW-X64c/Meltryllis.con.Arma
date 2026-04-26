import { ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from "discord.js";
import { getGuildLimits, setGuildLimits } from "../../sys/DB-Engine/links/noRules";
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

        const inCronjobs = new TextInputBuilder()
            .setCustomId('input_cronLimited')
            .setLabel('Límite de publicaciones de /cronjobs')
            .setStyle(TextInputStyle.Short)
            .setValue(limits.cronLimited.toString());
        const inMangadex = new TextInputBuilder()
            .setCustomId('input_dexMax')
            .setLabel('Límite de mangas de /mangadex')
            .setStyle(TextInputStyle.Short)
            .setValue(limits.dexMax.toString());
        const inReddit = new TextInputBuilder()
            .setCustomId('input_redMax')
            .setLabel('Límite de follows de /reddit')
            .setStyle(TextInputStyle.Short)
            .setValue(limits.redMax.toString());
        const inYoutube = new TextInputBuilder()
            .setCustomId('input_ytMax')
            .setLabel('Límite de Follow de /youTube')
            .setStyle(TextInputStyle.Short)
            .setValue(limits.ytMax.toString());


        const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(inCronjobs);
        const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(inMangadex);
        const row3 = new ActionRowBuilder<TextInputBuilder>().addComponents(inReddit);
        const row4 = new ActionRowBuilder<TextInputBuilder>().addComponents(inYoutube);


        modal.addComponents(row1, row2, row3, row4);
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

}