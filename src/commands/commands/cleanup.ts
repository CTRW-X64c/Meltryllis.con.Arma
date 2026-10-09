// src/Events-Commands/commands/cleanup.ts 
import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder, MessageFlags, Message, GuildTextBasedChannel, FetchMessagesOptions } from "discord.js";
import i18next from "i18next";
import { debug, error } from "../../sys/logging";
import { hasPermission } from "../../sys/zGears/mPermission";
import { checkCooldown, masterPerm, startCooldown } from "../../sys/zGears/auxiliares";

export async function registerCleanUpCommand(): Promise<SlashCommandBuilder[]> {
    const cleanupCommand = new SlashCommandBuilder()
        .setName("cleanup")
        .setDescription(i18next.t("commands:cleanup.slashBuilder.description"))
        .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
        .addStringOption(o => o.setName("message_id").setRequired(true).setDescription(i18next.t("commands:cleanup.slashBuilder.message_id_description")))
        .addIntegerOption(o => o.setName("count").setRequired(false).setMinValue(1).setMaxValue(1000).setDescription(i18next.t("commands:cleanup.slashBuilder.count_description")))
        .addStringOption(o => o.setName("start").setRequired(false).setDescription(i18next.t("commands:cleanup.slashBuilder.start_description"))
            .addChoices(
                { name: i18next.t("commands:cleanup.slashBuilder.after_option"), value: "after" },
                { name: i18next.t("commands:cleanup.slashBuilder.before_option"), value: "before" }
            )
        )
        .addStringOption(o => o.setName("type").setRequired(false).setDescription(i18next.t("commands:cleanup.slashBuilder.type_description"))
            .addChoices(
                { name: i18next.t("commands:cleanup.slashBuilder.users_option"), value: "users" },
                { name: i18next.t("commands:cleanup.slashBuilder.bots_option"), value: "bots" },
                { name: i18next.t("commands:cleanup.slashBuilder.any_option"), value: "any" }
            )
        );

    return [cleanupCommand] as SlashCommandBuilder[];
}

export async function handleCleanUpCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const guild = interaction.guild;
        if (!guild) {
            await interaction.editReply(i18next.t("common:Errores.noGuild"));
            return;
        }

        const CD = checkCooldown(guild.id, "cleanUp");
        if (CD.onCooldown) { await interaction.editReply({ content: i18next.t("botones:reportHelp.onCooldown", { a1: CD.timeLeft }) }); return; }
        startCooldown(guild.id, "cleanUp");

        const isAllowed = await hasPermission(interaction, interaction.commandName);
        if (!isAllowed) { await interaction.editReply({ content: i18next.t("common:Errores.isAllowed") }); return; }

        const channel = interaction.channel;
        if (!channel || !channel.isTextBased() || channel.isDMBased()) {
            await interaction.editReply({ content: i18next.t("common:Errores.noChannel") });
            return;
        }

        const chTxtB = channel as GuildTextBasedChannel;
        const testPerm = masterPerm(chTxtB, "viewCh|chManager");
        if (!testPerm.ok) {
            await interaction.editReply({ content: i18next.t("common:Errores.missing_permissions", { a1: `<#${channel.id}>`, a2: testPerm.msg.join('\n') }) });
            return;
        }

        const messageId = interaction.options.getString("message_id", true);
        const startOption = interaction.options.getString("start") ?? "after";
        const count = interaction.options.getInteger("count") ?? 100;
        const typeOption = interaction.options.getString("type") ?? "any";

        if (!/^\d+$/.test(messageId)) { await interaction.editReply({ content: i18next.t("commands:cleanup.interacciones.invalid_message_id") }); return; }

        const tstMsg = chTxtB.messages.cache.get(messageId) ?? await chTxtB.messages.fetch(messageId).catch(() => null);
        if (!tstMsg) { await interaction.editReply(i18next.t("commands:cleanup.interacciones.message_not_found")); return; }

        const deletedCounts = { total: 0, users: 0, bots: 0 };
        let totalFetchedCount = 0;
        let currentMsg: Message = tstMsg;

        while (totalFetchedCount < count) {
            const batchSize = Math.min(100, count - totalFetchedCount);
            const fetchedBatch = await deletMSG({ ch: chTxtB, msg: currentMsg, mode: startOption, tipe: typeOption, size: batchSize });
            if (!fetchedBatch || fetchedBatch.length === 0) break;
            totalFetchedCount += fetchedBatch.length;
            currentMsg = fetchedBatch[fetchedBatch.length - 1];

            try {
                const deletedMessages = await chTxtB.bulkDelete(fetchedBatch, true);

                deletedMessages.forEach(msg => {
                    if (!msg) return;
                    deletedCounts.total++;
                    if (msg.author?.bot) { deletedCounts.bots++ }
                    else { deletedCounts.users++ }
                });

                debug(`Lote eliminado: ${deletedMessages.size} mensajes reales`);
            } catch (batchError) {
                error(`Error eliminando lote: ${batchError}`);
            }

            if (totalFetchedCount < count && fetchedBatch.length === batchSize) {
                await new Promise(resolve => setTimeout(resolve, 20_000));
            }
        }

        if (deletedCounts.total === 0 && totalFetchedCount === 0) {
            await interaction.editReply(i18next.t("commands:cleanup.interacciones.no_messages_found"));
            return;
        }

        let responseMessage = i18next.t("commands:cleanup.interacciones.success", {
            a1: deletedCounts.total,
            a2: startOption === "before" ? i18next.t("commands:cleanup.interacciones.before") : i18next.t("commands:cleanup.interacciones.after")
        });

        if (deletedCounts.total < totalFetchedCount) {
            responseMessage += `\n⚠️ ${i18next.t("commands:cleanup.interacciones.old_messages_warning")}`;
        }

        if (typeOption !== "any") {
            responseMessage += `\n📊 ${i18next.t("commands:cleanup.interacciones.filtered_by", { a1: i18next.t(`cleanup:cleanup_type_${typeOption}`) })}`;
        }

        responseMessage += `\n\n${i18next.t("commands:cleanup.interacciones.breakdown", { a1: deletedCounts.users, a2: deletedCounts.bots })}`;

        await interaction.editReply(responseMessage);
        debug(`Comando cleanup ejecutado: ${deletedCounts.total} mensajes eliminados exitosamente`);

    } catch (err) {
        error(`Error en comando cleanup: ${err}`);

        if (interaction.replied || interaction.deferred) {
            await interaction.editReply(i18next.t("commands:cleanup.interacciones.error"));
        } else {
            await interaction.reply({ content: i18next.t("commands:cleanup.interacciones.error"), flags: MessageFlags.Ephemeral });
        }
    }
}

interface deletMSGint { ch: GuildTextBasedChannel; msg: Message; mode: string; tipe: string; size: number }
async function deletMSG(dta: deletMSGint): Promise<Message[]> {
    const matchedMessages: Message[] = [];
    let lastId = dta.msg.id;

    while (matchedMessages.length < dta.size) {
        const fetchLimit = Math.min(100, (dta.size - matchedMessages.length) * 2);
        const options: FetchMessagesOptions = { limit: Math.min(100, Math.max(fetchLimit, 20)) };

        if (dta.mode === "before") { options.before = lastId; }
        else { options.after = lastId; }

        const fetched = await dta.ch.messages.fetch(options);
        if (fetched.size === 0) break;

        const fetchedArray = Array.from(fetched.values());

        if (dta.mode === "before") { lastId = fetchedArray[fetchedArray.length - 1].id; }
        else {
            fetchedArray.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
            lastId = fetchedArray[fetchedArray.length - 1].id;
        }

        for (const message of fetchedArray) {
            if (matchedMessages.length >= dta.size) break;
            if (dta.tipe === "users" && message.author.bot) continue;
            if (dta.tipe === "bots" && !message.author.bot) continue;
            matchedMessages.push(message);
        }
    }

    return matchedMessages;
}