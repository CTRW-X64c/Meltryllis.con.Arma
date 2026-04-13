// src/Events-Commands/commands/rolemoji.ts
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, MessageFlags, TextChannel } from "discord.js";
import i18next from "i18next";
import { debug, error } from "../../sys/logging";
import { hasPermission } from "../../sys/zGears/mPermission";
import { setRoleAssignment, getRoleAssignments, removeRoleAssignment } from "../../sys/DB-Engine/links/Rolemoji";

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
        .setDescription(i18next.t("commands:rolemoji.slashBuilder.description"))
        .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
        .addSubcommand(subcommand =>
            subcommand
                .setName("set")
                .setDescription(i18next.t("commands:rolemoji.slashBuilder.assign_description"))
                .addStringOption(option =>
                    option
                        .setName("message_id")
                        .setDescription(i18next.t("commands:rolemoji.slashBuilder.message_id_description"))
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("emoji")
                        .setDescription(i18next.t("commands:rolemoji.slashBuilder.emoji_description"))
                        .setRequired(true)
                )
                .addRoleOption(option =>
                    option
                        .setName("role")
                        .setDescription(i18next.t("commands:rolemoji.slashBuilder.role_description"))
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("remove")
                .setDescription(i18next.t("commands:rolemoji.slashBuilder.remove_description"))
                .addIntegerOption(option =>
                    option
                        .setName("id")
                        .setDescription(i18next.t("commands:rolemoji.slashBuilder.remove_id_description"))
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("list")
                .setDescription(i18next.t("commands:rolemoji.slashBuilder.list_description"))
        );

    return [rolemojiCommand] as SlashCommandBuilder[];
}

export async function handleRolemojiCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
        const isAllowed = await hasPermission(interaction, interaction.commandName);
        if (!isAllowed) {
            await interaction.reply({
                content: i18next.t("common:Errores.isAllowed"),
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const guildId = interaction.guildId;
        if (!guildId) {
            await interaction.reply({ content: i18next.t("commands:rolemoji.interacciones.guild_only_error"), flags: MessageFlags.Ephemeral });
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
            
            default:
                await interaction.reply({
                    content: i18next.t("commands:rolemoji.interacciones.subcommand_not_found"),
                    flags: MessageFlags.Ephemeral
                });
                break;
        }
        // Termino de seccion switch para subcomandos
        debug(`Comando /rolemoji ejecutado en Guild: ${guildId}`); //<=
    } catch (err) {
        error(`Error al ejecutar comando /rolemoji: ${err}`); //<=
        await interaction.reply({
            content: i18next.t("commands:rolemoji.interacciones.subcommand_not_found"),
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
            content: i18next.t("commands:rolemoji.interacciones.assign_success", { role: roleMention, emoji: emoji }),
            flags: MessageFlags.Ephemeral
        });
    } catch (fetchError) {
        error(`Error fetching or reacting to message: ${fetchError}`);
        await interaction.reply({
            content: i18next.t("commands:rolemoji.interacciones.fetch_error"),
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
            content: i18next.t("commands:rolemoji.interacciones.remove_success", { id: id }),
            flags: MessageFlags.Ephemeral
        });
    } else {
        await interaction.reply({
            content: i18next.t("commands:rolemoji.interacciones.remove_failed", { id: id }),
            flags: MessageFlags.Ephemeral
        });
    }
}

//Subcomando "List"
async function ComList(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
    const assignments = await getRoleAssignments(guildId);
    const embed = new EmbedBuilder()
        .setColor("#0099ff")
        .setTitle(i18next.t("commands:rolemoji.interacciones.list_title"));

    if (assignments.size === 0) {
        embed.setDescription(i18next.t("commands:rolemoji.interacciones.list_empty"));
    } else {
        let description = "";
        for (const assignment of assignments.values()) {
            const guild = interaction.guild!;
            const role = guild.roles.cache.get(assignment.roleId);
            const roleName = role ? role.name : i18next.t("commands:rolemoji.interacciones.role_not_found");
            const emojiObject = guild.emojis.cache.get(assignment.emoji);
            const emojiDisplay = emojiObject ? emojiObject.toString() : assignment.emoji;
            
            // Usar el channelId de la base de datos para el enlace
            const messageUrl = `https://discord.com/channels/${guildId}/${assignment.channelId}/${assignment.messageId}`;
            
            description += i18next.t("commands:rolemoji.interacciones.list_entry", {
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
