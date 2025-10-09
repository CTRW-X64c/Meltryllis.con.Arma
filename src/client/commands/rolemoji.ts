// src/client/commands/rolemoji.ts
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, MessageFlags, TextChannel } from "discord.js";
import i18next from "i18next";
import { debug, error } from "../../logging";
import { setRoleAssignment, getRoleAssignments, removeRoleAssignment } from "../database";

function getEmojiKey(emojiString: string): string {
    const customEmojiRegex = /<a?:[a-zA-Z0-9_]+:(\d+)>$/;
    const match = emojiString.match(customEmojiRegex);
    if (match) {
        return match[1];
    }
    return emojiString;
}

export async function registerRolemojiCommand(): Promise<SlashCommandBuilder[]> {
    const rolemojiCommand = new SlashCommandBuilder()
        .setName("rolemoji")
        .setDescription(i18next.t("command_rolemoji_description", { ns: "common" }) || "Configura la asignación de roles por reacción.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName("set")
                .setDescription(i18next.t("command_rolemoji_assign_description", { ns: "common" }) || "Asigna un rol a un emoji en un mensaje.")
                .addStringOption(option =>
                    option
                        .setName("message_id")
                        .setDescription(i18next.t("command_rolemoji_message_id_description", { ns: "common" }) || "El ID del mensaje para la asignación de roles.")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("emoji")
                        .setDescription(i18next.t("command_rolemoji_emoji_description", { ns: "common" }) || "El emoji que activará la asignación.")
                        .setRequired(true)
                )
                .addRoleOption(option =>
                    option
                        .setName("role")
                        .setDescription(i18next.t("command_rolemoji_role_description", { ns: "common" }) || "El rol que se asignará.")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("remove")
                .setDescription(i18next.t("command_rolemoji_remove_description", { ns: "common" }) || "Elimina una asignación de rol.")
                .addIntegerOption(option =>
                    option
                        .setName("id")
                        .setDescription(i18next.t("command_rolemoji_remove_id_description", { ns: "common" }) || "El ID de la asignación a eliminar.")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("list")
                .setDescription(i18next.t("command_rolemoji_list_description", { ns: "common" }) || "Muestra una lista de todas las asignaciones de roles.")
        );

    return [rolemojiCommand] as SlashCommandBuilder[];;
}

export async function handleRolemojiCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
        const memberPermissions = interaction.memberPermissions;
        const isAdmin = memberPermissions?.has(PermissionFlagsBits.ManageGuild) || interaction.guild?.ownerId === interaction.user.id;
        if (!isAdmin) {
            await interaction.reply({
                content: i18next.t("command_permission_error", { ns: "common" }) || "Solo los administradores o el propietario pueden usar este comando.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const guildId = interaction.guildId;
        if (!guildId) {
            await interaction.reply({ content: i18next.t("command_guild_only", { ns: "common" }) || "Este comando solo se puede usar en un servidor.", ephemeral: true });
            return;
        }

        const subcommand = interaction.options.getSubcommand();
        const emoji = interaction.options.getString("emoji", false);
        const messageId = interaction.options.getString("message_id", false);

        if (subcommand === "assign") {
            const role = interaction.options.getRole("role", true);
            if (!messageId || !emoji) {
                await interaction.reply({ content: "Faltan opciones requeridas para el subcomando 'assign'.", flags: MessageFlags.Ephemeral });
                return;
            }

            const emojiKey = getEmojiKey(emoji);

            await setRoleAssignment(guildId, messageId, emojiKey, role.id);
            
            try {
                const channel = interaction.channel as TextChannel;
                const message = await channel.messages.fetch(messageId);
                await message.react(emoji);
                
                await interaction.reply({
                    content: i18next.t("command_rolemoji_assign_success", { ns: "common", role: role.name, emoji }),
                    flags: MessageFlags.Ephemeral
                });
            } catch (fetchError) {
                error(`Error fetching or reacting to message: ${fetchError}`, "RolemojiCommand");
                await interaction.reply({
                    content: `❌ Error: No se pudo encontrar el mensaje o reaccionar con el emoji. Asegúrate de que el ID sea correcto y que el bot tenga permisos para reaccionar.`,
                    flags: MessageFlags.Ephemeral
                });
            }
        } else if (subcommand === "remove") {
            const id = interaction.options.getInteger("id", true);
            const success = await removeRoleAssignment(guildId, id);
            
            if (success) {
                await interaction.reply({
                    content: i18next.t("command_rolemoji_remove_success", { ns: "common", id }),
                    flags: MessageFlags.Ephemeral
                });
            } else {
                await interaction.reply({
                    content: i18next.t("command_rolemoji_remove_failed", { ns: "common", id }) || `No se encontró una asignación de rol con ID ${id} en este servidor.`,
                    flags: MessageFlags.Ephemeral
                });
            }
        } else if (subcommand === "list") {
            const assignments = await getRoleAssignments(guildId);
            const embed = new EmbedBuilder()
                .setColor("#0099ff")
                .setTitle(i18next.t("command_rolemoji_list_title", { ns: "common" }) || "Asignaciones de Roles por Reacción");

            if (assignments.size === 0) {
                embed.setDescription(i18next.t("command_rolemoji_list_empty", { ns: "common" }) || "No hay asignaciones de roles configuradas.");
            } else {
                let description = "";
                for (const assignment of assignments.values()) {
                    const guild = interaction.guild!;
                    const role = guild.roles.cache.get(assignment.roleId);
                    const roleName = role ? role.name : "Rol no encontrado";
                    const emojiDisplay = guild.emojis.cache.get(assignment.emoji) || assignment.emoji;
                    const messageUrl = `https://discord.com/channels/${guildId}/${interaction.channelId}/${assignment.messageId}`;
                    description += `\n**ID:** ${assignment.id}\n**Emoji:** ${emojiDisplay}\n**Rol:** <@&${assignment.roleId}> (${roleName})\n**Mensaje ID:** [${assignment.messageId}](${messageUrl})\n\n`;
                }
                embed.setDescription(description);
            }
            
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
        
        debug(`Command /rolemoji executed in guild ${guildId}`, "RolemojiCommand");
    } catch (err) {
        error(`Error al ejecutar comando /rolemoji: ${err}`, "RolemojiCommand");
        await interaction.reply({ content: i18next.t("command_error", { ns: "common" }) || "Ocurrió un error al ejecutar el comando.", flags: MessageFlags.Ephemeral });
    }
}