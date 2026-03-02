// src/Events-Commands/commands/cleanup.ts 
import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder, MessageFlags, TextChannel, Collection, Snowflake, Message } from "discord.js";
import i18next from "i18next";
import { debug, error } from "../../sys/logging";
import { hasPermission } from "../../sys/zGears/mPermission";

export async function registerCleanUpCommand(): Promise<SlashCommandBuilder[]> {
    const cleanupCommand = new SlashCommandBuilder()
        .setName("cleanup")
        .setDescription(i18next.t("cleanup:slashBuilder.description"))
        .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
        .addStringOption(option =>
            option.setName("start")
                .setDescription(i18next.t("cleanup:slashBuilder.start_description"))
                .setRequired(true)
                .addChoices(
                    { name: i18next.t("cleanup:slashBuilder.before_option"), value: "before" },
                    { name: i18next.t("cleanup:slashBuilder.after_option"), value: "after" }
                )
        )
        .addStringOption(option =>
            option.setName("message_id")
                .setDescription(i18next.t("cleanup:slashBuilder.message_id_description"))
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName("count")
                .setDescription(i18next.t("cleanup:slashBuilder.count_description"))
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        )
        .addStringOption(option =>
            option.setName("type")
                .setDescription(i18next.t("cleanup:slashBuilder.type_description"))
                .setRequired(false)
                .addChoices(
                    { name: i18next.t("cleanup:slashBuilder.users_option"), value: "users" },
                    { name: i18next.t("cleanup:slashBuilder.bots_option"), value: "bots" },
                    { name: i18next.t("cleanup:slashBuilder.any_option"), value: "any" }
                )
        );

    return [cleanupCommand] as SlashCommandBuilder[];
}

export async function handleCleanUpCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
        const isAllowed = await hasPermission(interaction, interaction.commandName);
        if (!isAllowed) {
            await interaction.reply({
                content: i18next.t("common:Errores.isAllowed"),
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const channel = interaction.channel;
        if (!channel || !channel.isTextBased() || channel.isDMBased()) {
            await interaction.reply({
                content: i18next.t("cleanup:interacciones.text_channel_only"),
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const startOption = interaction.options.getString("start", true);
        const messageId = interaction.options.getString("message_id", true);
        const count = interaction.options.getInteger("count", true);
        const typeOption = interaction.options.getString("type") || "any";

        if (!/^\d+$/.test(messageId)) {
            await interaction.reply({
                content: i18next.t("cleanup:interacciones.invalid_message_id"),
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            await (channel as TextChannel).messages.fetch(messageId);
        } catch {
            await interaction.editReply(
                i18next.t("cleanup:interacciones.message_not_found")
            );
            return;
        }

        let messagesToDelete: Collection<string, Message>;
        
        // Modo antes/despues de 
        if (startOption === "before") {
            messagesToDelete = await (channel as TextChannel).messages.fetch({
                limit: count,
                before: messageId as Snowflake
            });
        } else {
            messagesToDelete = await (channel as TextChannel).messages.fetch({
                limit: count,
                after: messageId as Snowflake
            });
        }

        // Filtro users/bots
        if (typeOption !== "any") {
            messagesToDelete = messagesToDelete.filter(message => {
                if (typeOption === "users") return !message.author.bot;
                if (typeOption === "bots") return message.author.bot;
                return true;
            });
        }

        if (messagesToDelete.size === 0) {
            await interaction.editReply(
                i18next.t("cleanup:interacciones.no_messages_found")
            );
            return;
        }

        const messagesArray = Array.from(messagesToDelete.values());
        const deletedCounts = { total: 0, users: 0, bots: 0 };

        for (let i = 0; i < messagesArray.length; i += 100) {
            const batch = messagesArray.slice(i, i + 100);
            
            try {
                const deletedMessages = await (channel as TextChannel).bulkDelete(batch, true);
                
                deletedMessages.forEach(msg => {
                    if (!msg) return;
                    deletedCounts.total++;
                    if (msg.author?.bot) {
                        deletedCounts.bots++;
                    } else {
                        deletedCounts.users++;
                    }
                });
                debug(`Lote eliminado: ${deletedMessages.size} mensajes reales`);
                
            } catch (batchError) {
                error(`Error eliminando lote ${i/100 + 1}: ${batchError}`);
            }
        }

        let responseMessage = i18next.t("cleanup:interacciones.success", { 
            a1: deletedCounts.total,
            a2: startOption === "before" ? 
                i18next.t("cleanup:interacciones.before") : 
                i18next.t("cleanup:interacciones.after")
        });

        if (deletedCounts.total < messagesArray.length) {
            responseMessage += `\n⚠️ ${i18next.t("cleanup:interacciones.old_messages_warning")}`; 
        }

        if (typeOption !== "any") {
            responseMessage += `\n📊 ${i18next.t("cleanup:interacciones.filtered_by", { 
                a1: i18next.t(`cleanup:cleanup_type_${typeOption}`)
            })}`;
        }

        responseMessage += `\n\n${i18next.t("cleanup:interacciones.breakdown", { 
            a1: deletedCounts.users,
            a2: deletedCounts.bots
        })}`;

        await interaction.editReply(responseMessage);

        debug(`Comando cleanup ejecutado: ${deletedCounts.total} mensajes eliminados exitosamente`);

    } catch (err) {
        error(`Error en comando cleanup: ${err}`);
        
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply(i18next.t("cleanup:interacciones.error"));
        } else {
            await interaction.reply({
                content: i18next.t("cleanup:interacciones.error"),
                flags: MessageFlags.Ephemeral
            });
        }
    }
}