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
        .setDescription(i18next.t("command_rolemoji_description", { ns: "rolemoji" }))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName("set")
                .setDescription(i18next.t("command_rolemoji_assign_description", { ns: "rolemoji" }))
                .addStringOption(option =>
                    option
                        .setName("message_id")
                        .setDescription(i18next.t("command_rolemoji_message_id_description", { ns: "rolemoji" }))
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("emoji")
                        .setDescription(i18next.t("command_rolemoji_emoji_description", { ns: "rolemoji" }))
                        .setRequired(true)
                )
                .addRoleOption(option =>
                    option
                        .setName("role")
                        .setDescription(i18next.t("command_rolemoji_role_description", { ns: "rolemoji" }))
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("remove")
                .setDescription(i18next.t("command_rolemoji_remove_description", { ns: "rolemoji" }))
                .addIntegerOption(option =>
                    option
                        .setName("id")
                        .setDescription(i18next.t("command_rolemoji_remove_id_description", { ns: "rolemoji" }))
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("list")
                .setDescription(i18next.t("command_rolemoji_list_description", { ns: "rolemoji" }))
        );

    return [rolemojiCommand] as SlashCommandBuilder[];
}

export async function handleRolemojiCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
        const memberPermissions = interaction.memberPermissions;
        const isAdmin = memberPermissions?.has(PermissionFlagsBits.ManageGuild) || interaction.guild?.ownerId === interaction.user.id;
        if (!isAdmin) {
            await interaction.reply({
                content: i18next.t("command_permission_error", { ns: "common" }),
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const guildId = interaction.guildId;
        if (!guildId) {
            await interaction.reply({ content: i18next.t("command_guild_only", { ns: "common" }), flags: MessageFlags.Ephemeral });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "set") {
            const role = interaction.options.getRole("role", true);
            const messageId = interaction.options.getString("message_id", true);
            const emoji = interaction.options.getString("emoji", true);
            const channelId = interaction.channelId; // <-- Obtener el ID del canal

            const emojiKey = getEmojiKey(emoji);

            await setRoleAssignment(guildId, messageId, channelId, emojiKey, role.id);
            
            try {
                const channel = interaction.channel as TextChannel;
                const message = await channel.messages.fetch(messageId);
                await message.react(emoji);
                
                await interaction.reply({
                    content: i18next.t("command_rolemoji_assign_success", { ns: "rolemoji", role: role.name, emoji: emoji }),
                    flags: MessageFlags.Ephemeral
                });
            } catch (fetchError) {
                error(`Error fetching or reacting to message: ${fetchError}`, "RolemojiCommand");
                await interaction.reply({
                    content: i18next.t("command_rolemoji_fetch_error", { ns: "rolemoji" }),
                    flags: MessageFlags.Ephemeral
                });
            }
        } else if (subcommand === "remove") {
            const id = interaction.options.getInteger("id", true);
            const success = await removeRoleAssignment(guildId, id);
            
            if (success) {
                await interaction.reply({
                    content: i18next.t("command_rolemoji_remove_success", { ns: "rolemoji", id: id }),
                    flags: MessageFlags.Ephemeral
                });
            } else {
                await interaction.reply({
                    content: i18next.t("command_rolemoji_remove_failed", { ns: "rolemoji", id: id }),
                    flags: MessageFlags.Ephemeral
                });
            }
        } else if (subcommand === "list") {
            const assignments = await getRoleAssignments(guildId);
            const embed = new EmbedBuilder()
                .setColor("#0099ff")
                .setTitle(i18next.t("command_rolemoji_list_title", { ns: "rolemoji" }));

            if (assignments.size === 0) {
                embed.setDescription(i18next.t("command_rolemoji_list_empty", { ns: "rolemoji" }));
            } else {
                let description = "";
                for (const assignment of assignments.values()) {
                    const guild = interaction.guild!;
                    const role = guild.roles.cache.get(assignment.roleId);
                    const roleName = role ? role.name : i18next.t("role_not_found", { ns: "rolemoji" });
                    const emojiDisplay = guild.emojis.cache.get(assignment.emoji) || assignment.emoji;
                    
                    // Aquí se usa el channelId de la base de datos
                    const messageUrl = `https://discord.com/channels/${guildId}/${assignment.channelId}/${assignment.messageId}`;
                    
                    description += i18next.t("command_rolemoji_list_entry", {
                        ns: "rolemoji",
                        id: assignment.id,
                        emoji: emojiDisplay,
                        roleId: assignment.roleId,
                        roleName: roleName,
                        messageId: assignment.messageId,
                        messageUrl: messageUrl
                    });
                }
                embed.setDescription(description);
            }
            
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
        
        debug(i18next.t("rolemoji_execute", { ns: "rolemoji", error: guildId }), "RolemojiCommand");
    } catch (err) {
        debug(i18next.t("rolemoji_execute_error", { ns: "rolemoji", error: err }), "RolemojiCommand");        
        await interaction.reply({ content: i18next.t("command_error", { ns: "common" }) || "Ocurrió un error al ejecutar el comando.", flags: MessageFlags.Ephemeral });
    }
}