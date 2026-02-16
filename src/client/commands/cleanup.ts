// src/client/commands/cleanup.ts
import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder, MessageFlags, TextChannel, Collection, Snowflake, Message } from "discord.js";
import i18next from "i18next";
import { debug, error } from "../../sys/logging";
import { hasPermission } from "../../sys/zGears/mPermission";

export async function registerCleanUpCommand(): Promise<SlashCommandBuilder[]> {
    const cleanupCommand = new SlashCommandBuilder()
        .setName("cleanup")
        .setDescription(i18next.t("command_cleanup_description", { ns: "cleanup" }))
        .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
        .addStringOption(option =>
            option.setName("start")
                .setDescription(i18next.t("command_cleanup_start_description", { ns: "cleanup" }))
                .setRequired(true)
                .addChoices(
                    { name: i18next.t("command_cleanup_before_option", { ns: "cleanup" }), value: "before" },
                    { name: i18next.t("command_cleanup_after_option", { ns: "cleanup" }), value: "after" }
                )
        )
        .addStringOption(option =>
            option.setName("message_id")
                .setDescription(i18next.t("command_cleanup_message_id_description", { ns: "cleanup" }))
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName("count")
                .setDescription(i18next.t("command_cleanup_count_description", { ns: "cleanup" }))
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        )
        .addStringOption(option =>
            option.setName("type")
                .setDescription(i18next.t("command_cleanup_type_description", { ns: "cleanup" }))
                .setRequired(false)
                .addChoices(
                    { name: i18next.t("command_cleanup_users_option", { ns: "cleanup" }), value: "users" },
                    { name: i18next.t("command_cleanup_bots_option", { ns: "cleanup" }), value: "bots" },
                    { name: i18next.t("command_cleanup_any_option", { ns: "cleanup" }), value: "any" }
                )
        );

    return [cleanupCommand] as SlashCommandBuilder[];
}

export async function handleCleanUpCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
        const isAllowed = await hasPermission(interaction, interaction.commandName);
        if (!isAllowed) {
            await interaction.reply({
                content: i18next.t("command_permission_error", { ns: "cleanup" }),
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const channel = interaction.channel;
        if (!channel || !channel.isTextBased() || channel.isDMBased()) {
            await interaction.reply({
                content: i18next.t("command_cleanup_text_channel_only", { ns: "cleanup" }),
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
                content: i18next.t("command_cleanup_invalid_message_id", { ns: "cleanup" }),
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            await (channel as TextChannel).messages.fetch(messageId);
        } catch {
            await interaction.editReply(
                i18next.t("command_cleanup_message_not_found", { ns: "cleanup" })
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
                i18next.t("command_cleanup_no_messages_found", { ns: "cleanup" })
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

        let responseMessage = i18next.t("command_cleanup_success", { 
            ns: "cleanup",
            a1: deletedCounts.total,
            a2: startOption === "before" ? 
                i18next.t("command_cleanup_before", { ns: "cleanup" }) : 
                i18next.t("command_cleanup_after", { ns: "cleanup" })
        });

        if (deletedCounts.total < messagesArray.length) {
            responseMessage += `\n⚠️ ${i18next.t("command_cleanup_old_messages_warning", { ns: "cleanup" })}`; 
        }

        if (typeOption !== "any") {
            responseMessage += `\n📊 ${i18next.t("command_cleanup_filtered_by", { 
                ns: "cleanup", 
                a1: i18next.t(`cleanup_type_${typeOption}`, { ns: "cleanup" })
            })}`;
        }

        responseMessage += `\n\n${i18next.t("command_cleanup_breakdown", { 
            ns: "cleanup",
            a1: deletedCounts.users,
            a2: deletedCounts.bots
        })}`;

        await interaction.editReply(responseMessage);

        debug(`Comando cleanup ejecutado: ${deletedCounts.total} mensajes eliminados exitosamente`);

    } catch (err) {
        error(`Error en comando cleanup: ${err}`);
        
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply(i18next.t("command_cleanup_error", { ns: "cleanup" }));
        } else {
            await interaction.reply({
                content: i18next.t("command_cleanup_error", { ns: "cleanup" }),
                flags: MessageFlags.Ephemeral
            });
        }
    }
}