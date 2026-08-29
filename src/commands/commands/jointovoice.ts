// src/Events-Commands/commands/jointovoice.ts
import {
    SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, ChannelType, EmbedBuilder, ComponentType,
    /*botnes*/  ButtonBuilder, ButtonStyle, ActionRowBuilder, ButtonInteraction,
    /* modal*/ ChannelSelectMenuBuilder, LabelBuilder, ModalBuilder, ModalSubmitInteraction
} from "discord.js";

import { error, info, debug } from "../../sys/logging";
import i18next from "i18next";
import { getAllTempVoiceChannels, getGuildTempChannelCount, getVoiceConfig, removeVoiceConfig, setVoiceConfig, } from "../../sys/DB-Engine/links/JointoVoice";
import { hasPermission } from "../../sys/zGears/mPermission";
import { masterPerm } from "../../sys/zGears/auxiliares";


export async function registerJoinToCreateCommand(): Promise<SlashCommandBuilder[]> {
    const jointovoice = new SlashCommandBuilder()
        .setName("jointovoice")
        .setDescription(i18next.t("commands:joinCreate.slashBuilder.jointocreate_description"))
        .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
    return [jointovoice] as SlashCommandBuilder[];
}

export async function handleJoinToCreateCommand(int: ChatInputCommandInteraction): Promise<void> {
    const guild = int.guild;
    if (!guild) {
        await int.reply({ content: i18next.t("common:Errores.noGuild"), flags: MessageFlags.Ephemeral });
        return;
    }

    const isAllowed = await hasPermission(int, int.commandName);
    if (!isAllowed) {
        await int.reply({ content: i18next.t("common:Errores.isAllowed"), flags: MessageFlags.Ephemeral });
        return;
    }

    const yaConfig = await getVoiceConfig(guild.id)
    if (!yaConfig) {
        const chOp1 = new ChannelSelectMenuBuilder().setCustomId("voiceCh").setPlaceholder("ej:🔊 General").setRequired(true).setChannelTypes(ChannelType.GuildVoice);
        const chIn = new LabelBuilder().setLabel('Canal maestro!').setChannelSelectMenuComponent(chOp1);
        const modal = new ModalBuilder().setCustomId(`joinVoice_${int.user.id}`).setTitle('Primera configuracion!').addLabelComponents(chIn)
        await int.showModal(modal);
        // == // == // FINAL MODAL // == // == //
        try {
            const modalInt = await int.awaitModalSubmit({
                filter: (i) => i.customId === `joinVoice_${int.user.id}` && i.user.id === int.user.id,
                time: 120_000, // 2 min
            });

            const submitInt = modalInt as ModalSubmitInteraction;
            await submitInt.deferReply({ flags: MessageFlags.Ephemeral });
            try {
                const chViceRaw = submitInt.fields.getSelectedChannels("voiceCh", true).first();
                const channel = chViceRaw ? (await guild.channels.fetch(chViceRaw.id).catch(() => null)) : null
                if (!channel) { await submitInt.editReply(" ❌ No se encontro el canal de primera configuracion!!"); return; }

                const testPerm = masterPerm(channel, "viewCh|chManager|voiceMove|voiceConnect");
                if (!testPerm.ok) { await submitInt.editReply({ content: i18next.t("common:Errores.missing_permissions", { a1: `<#${channel.id}>`, a2: testPerm.msg.join('\n') }) }); return; }

                await setVoiceConfig(guild.id, channel.id, true);

                await submitInt.editReply({
                    content: i18next.t("commands:joinCreate.interacciones.set_success", { ns: "jointocreate", a1: channel.toString() })
                });

                info(`Canal maestro de Join to Create establecido en ${channel.name} (${channel.id}) en servidor ${guild.id}`, "JoinToCreate");

            } catch (err) {
                error(`Error estableciendo canal maestro: ${err}`, "JoinToCreate");
                await submitInt.editReply({ content: i18next.t("commands:joinCreate.interacciones.set_error") });
            }

        } catch (e) { debug("El usuario no respondió al modal a tiempo.", "JoinToCreate"); }
    }
    else {
        try {
            await int.deferReply({ flags: MessageFlags.Ephemeral })
            const Label = yaConfig.enabled ? '🔴 Desactivar' : '🟢 Activar';
            const Style = yaConfig.enabled ? ButtonStyle.Success : ButtonStyle.Danger;

            const redRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('joinToV_Buton_toogle').setLabel(Label).setStyle(Style),
                new ButtonBuilder().setCustomId('joinToV_Buton_delete_conf').setLabel('Borrar Configuración').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(`joinToV_delTemp_${int.user.id}`).setLabel('Borrar Temporales').setStyle(ButtonStyle.Danger)
            )

            const grenRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('joinToV_Buton_exit').setLabel('Salir').setStyle(ButtonStyle.Success)
            );

            const counTempCh = await getGuildTempChannelCount(guild.id)
            const embed = new EmbedBuilder()
                .setAuthor({ name: guild.name, iconURL: guild.iconURL() as string })
                .setColor(0x00ff00)
                .setDescription(
                    `🔧 **Panel de Configuración de /jointovoice**\n\n` +
                    `**Canal maestro: <#${yaConfig.channelId}>**\n` +
                    `**Estado actual: ${yaConfig.enabled ? "Activado" : "Desactivado"}**\n` +
                    `**Canales Temporales Activos: ${counTempCh}**`
                )
                .setFooter({ text: `Solicitado por: ${int.user.tag}`, iconURL: int.user.displayAvatarURL() });

            const msgMenu = await int.editReply({ embeds: [embed], components: [grenRow, redRow] });
            const choice = await (msgMenu).awaitMessageComponent({
                filter: (i: ButtonInteraction) => i.user.id === int.user.id,
                componentType: ComponentType.Button,
                time: 120_000, // 2 min
            }) as ButtonInteraction;

            if (choice.customId === 'joinToV_Buton_exit') {
                await choice.update({ content: i18next.t("commands:joinCreate.interacciones.existButon"), embeds: [], components: [] });
            }

            if (choice.customId === 'joinToV_Buton_toogle') {
                try {
                    await setVoiceConfig(guild.id, yaConfig.channelId, !yaConfig.enabled);
                    await choice.update({ content: i18next.t("commands:joinCreate.interacciones.disableButon", { a1: yaConfig.enabled ? "❌ Desactivado" : "✅ Activado" }), embeds: [], components: [] });
                } catch (e) {
                    await choice.update({ content: i18next.t("commands:joinCreate.interacciones.deleteTemp_success"), embeds: [], components: [] });
                    error(`Error al desactivar /jointovoice: ${e} | Guild: ${guild.id} `, "JoinToCreate");
                }
            }

            if (choice.customId === "joinToV_Buton_delete_conf") {
                try {
                    const config = await getVoiceConfig(guild.id);
                    if (!config) { await choice.update({ content: i18next.t("commands:joinCreate.interacciones.error_not_configured"), embeds: [], components: [] }); }
                    await removeVoiceConfig(guild.id);
                    await choice.update({ content: i18next.t("commands:joinCreate.interacciones.disable_success"), embeds: [], components: [] });
                    info(`Sistema Join to Create desactivado en servidor ${guild.id}`, "JoinToCreate");

                } catch (err) {
                    error(`Error desactivando sistema: ${err} | Guild: ${guild.id}`, "JoinToCreate");
                    await choice.update({ content: i18next.t("commands:joinCreate.interacciones.disable_error"), embeds: [], components: [] });
                }
            }

        } catch (e: any) {
            if (!int.deferred) await int.deferReply({ flags: MessageFlags.Ephemeral });
            await int.editReply({ content: "⏳ Tiempo de panel agotado.", embeds: [], components: [] }).catch(() => null);
            error(`Algo fallo en la seccion de botones de /jointovoice | ${e.message}`)
        }
    }
}

export async function cleanupChannels(interaction: ButtonInteraction): Promise<void> { // yei!! rescatemos la funcion con sus confirmaciones
    const guild = interaction.guild!;
    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('cancel_delete').setLabel('Cancelar').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('confirm_delete').setLabel('ELIMINAR!!').setStyle(ButtonStyle.Danger)
    );

    await interaction.update({ embeds: [], components: [actionRow], content: i18next.t("commands:joinCreate.interacciones.cleanup_confirm"), });
    try { // Timeout, 20 segundos
        const buttonInteraction = await interaction.channel?.awaitMessageComponent({
            filter: (i) => (i.customId === 'confirm_delete' || i.customId === 'cancel_delete') && i.user.id === interaction.user.id,
            time: 20_000
        }) as ButtonInteraction;

        if (buttonInteraction.customId === 'cancel_delete') {
            await buttonInteraction.update({ components: [], content: i18next.t("commands:joinCreate.interacciones.cleanup_cancelled") }); return;
        };

        if (buttonInteraction.customId === 'confirm_delete') {
            const allTempChannels = await getAllTempVoiceChannels();
            const guildTempChannels = allTempChannels.filter(ch => ch.guildId === guild.id);
            let deletedCount = 0, errorCount = 0;
            for (const tempChannel of guildTempChannels) {
                try {
                    const channel = await interaction.guild?.channels.fetch(tempChannel.channelId);
                    if (channel && channel.isVoiceBased()) {
                        await channel.delete("Limpieza manual de canales temporales");
                        deletedCount++;
                    }
                } catch (err) {
                    errorCount++;
                    debug(`Error eliminando canal ${tempChannel.channelId}: ${err}`, "JoinToCreate");
                }
            }
            // Actualizar mensaje con resultados
            await buttonInteraction.update({
                content: i18next.t("commands:joinCreate.interacciones.cleanup_result", { ns: "jointocreate", a1: deletedCount, a2: errorCount }),
                components: [],
                embeds: []
            });
            info(`Limpieza manual: ${deletedCount} canales eliminados, ${errorCount} errores en servidor ${guild.id}`, "JoinToCreate");
        }
    } catch (err) { // Timeout o error
        if (!interaction.deferred) await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (err instanceof Error && err.message.includes('time')) { await interaction.editReply({ content: i18next.t("commands:joinCreate.interacciones.cleanup_timeout"), components: [] }); }
        else { error(`Error en limpieza: ${err}`, "JoinToCreate"); await interaction.editReply({ content: i18next.t("commands:joinCreate.interacciones.cleanup_error"), components: [] }); }
    }
}