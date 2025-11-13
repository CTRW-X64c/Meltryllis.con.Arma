// src/client/commands/rolemoji.ts
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, MessageFlags, TextChannel, PermissionsBitField } from "discord.js";
import i18next from "i18next";
import { debug, error } from "../../sys/logging";
import { setRoleAssignment, getRoleAssignments, removeRoleAssignment } from "../../sys/database";

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
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("help")
                .setDescription(i18next.t("command_rolemoji_help_description", { ns: "rolemoji" }))
        );
        
    return [rolemojiCommand] as SlashCommandBuilder[];
}

export async function handleRolemojiCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
        const memberPermissions = interaction.memberPermissions;
        const isAdmin = memberPermissions?.has(PermissionFlagsBits.ManageGuild) || interaction.guild?.ownerId === interaction.user.id;
        if (!isAdmin) {
            await interaction.reply({
                content: i18next.t("command_permission_error", { ns: "rolemoji" }),
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const guildId = interaction.guildId;
        if (!guildId) {
            await interaction.reply({ content: i18next.t("command_guild_only_error", { ns: "rolemoji" }), flags: MessageFlags.Ephemeral });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        // Inicio de seccion switch para subcomandos
        switch (subcommand) {
            case "set":
                await ComSet(interaction, guildId);
                break;
            
            case "remove":
                await ComRemove(interaction, guildId);
                break;
            
            case "list":
                await ComList(interaction, guildId);
                break;
            
            case "help":
                await ComHelp(interaction);
                break;
            
            default:
                await interaction.reply({
                    content: i18next.t("command_subcommand_not_found", { ns: "rolemoji" }),
                    flags: MessageFlags.Ephemeral
                });
                break;
        }
        // Termino de seccion switch para subcomandos
        debug(`Comando /rolemoji ejecutado en Guild: ${guildId}`); //<=
    } catch (err) {
        error(`Error al ejecutar comando /rolemoji: ${err}`); //<=
        await interaction.reply({
            content: i18next.t("command_error", { ns: "rolemoji" }),
            flags: MessageFlags.Ephemeral
        });
    }
}

//Subcomando "Set"
async function ComSet(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
    const role = interaction.options.getRole("role", true);
    const messageId = interaction.options.getString("message_id", true);
    const emoji = interaction.options.getString("emoji", true);
    const channelId = interaction.channelId;

    const emojiKey = getEmojiKey(emoji);

    await setRoleAssignment(guildId, messageId, channelId, emojiKey, role.id);
    
    try {
        const channel = interaction.channel as TextChannel;
        const message = await channel.messages.fetch(messageId);
        const roleMention = `<@&${role.id}>`;
        await message.react(emoji);
        
        await interaction.reply({
            content: i18next.t("command_rolemoji_assign_success", { ns: "rolemoji", role: roleMention, emoji: emoji }),
            flags: MessageFlags.Ephemeral
        });
    } catch (fetchError) {
        error(`Error fetching or reacting to message: ${fetchError}`);
        await interaction.reply({
            content: i18next.t("command_rolemoji_fetch_error", { ns: "rolemoji" }),
            flags: MessageFlags.Ephemeral
        });
    }
}

//Subcomando "Remove"
async function ComRemove(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
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
}

//Subcomando "List"
async function ComList(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
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
            const emojiObject = guild.emojis.cache.get(assignment.emoji);
            const emojiDisplay = emojiObject ? emojiObject.toString() : assignment.emoji;
            
            // Usar el channelId de la base de datos para el enlace
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

//Subcomando "Help"
async function ComHelp(interaction: ChatInputCommandInteraction): Promise<void> {
    const channel = interaction.channel;
    const guild = interaction.guild;
    
    if (!guild || !channel || !('permissionsFor' in channel)) {
        await interaction.reply({ 
            content: i18next.t("command_guild_only_error", { ns: "rolemoji" }), 
            flags: MessageFlags.Ephemeral 
        });
        return;
    }
    
    const botMember = guild.members.me;
    if (!botMember) {
        await interaction.reply({
            content: i18next.t("test_error_permission_user", { ns: "rolemoji" }), 
            flags: MessageFlags.Ephemeral
        });
        return;
    }
    
    const channelPermissions = channel.permissionsFor(botMember);
    const ManageRoles = botMember.permissions.has(PermissionsBitField.Flags.ManageRoles);
    const AddReactions = channelPermissions.has(PermissionsBitField.Flags.AddReactions);
    const ExternalEmojis = channelPermissions.has(PermissionsBitField.Flags.UseExternalEmojis);
    
    const embed = new EmbedBuilder()
        .setColor("#0099ff")
        .setTitle(i18next.t("command_rolemoji_help_title", { ns: "rolemoji" }))
        .setDescription(i18next.t("command_rolemoji_help_description", { ns: "rolemoji" }))
        .addFields(
            {
                name: i18next.t("embed_rolemoji_paso_1", { ns: "rolemoji" }),
                value: i18next.t("embed_rolemoji_fix_1", { ns: "rolemoji" }),
            }, 
            {
                name: i18next.t("manage_roles_permission", { ns: "rolemoji" }),
                value: ManageRoles ? i18next.t("allowed_permission", { ns: "rolemoji" }) : i18next.t("missing_permission", { ns: "rolemoji" }),
                inline: true,
            },
            {
                name: i18next.t("add_reactions_permission", { ns: "rolemoji" }),
                value: AddReactions ? i18next.t("allowed_permission", { ns: "rolemoji" }) : i18next.t("missing_permission", { ns: "rolemoji" }),
                inline: true,
            },
            {
                name: i18next.t("use_external_emojis_permission", { ns: "rolemoji" }),
                value: ExternalEmojis ? i18next.t("allowed_permission", { ns: "rolemoji" }) : i18next.t("missing_permission", { ns: "rolemoji" }),
                inline: true,
            },
            {
                name: i18next.t("embed_rolemoji_paso_2", { ns: "rolemoji" }),
                value: i18next.t("embed_rolemoji_fix_2", { ns: "rolemoji" }),
                inline: false,
            }, 
            {
                name: i18next.t("embed_rolemoji_paso_3", { ns: "rolemoji" }),
                value: i18next.t("embed_rolemoji_fix_3", { ns: "rolemoji" }),
                inline: false,
            }
        )
        .setFooter({ text: i18next.t("command_rolemoji_help_footer", { ns: "rolemoji" }) })
        .setImage("https://raw.githubusercontent.com/CTRW-X64c/Meltryllis.con.Arma/refs/heads/main/Pict/RolemojiHelp.png")
        .setTimestamp();
        
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}