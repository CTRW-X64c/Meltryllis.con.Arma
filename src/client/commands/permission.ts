// src/client/commands/permissions.ts
import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder, EmbedBuilder, MessageFlags, AutocompleteInteraction, 
  /*Botones*/ ButtonBuilder, ButtonStyle, ActionRowBuilder, ButtonInteraction } from "discord.js";
import { addCommandPermission, removeCommandPermission, listCommandPermissions, clearGuildPermissions, PermissionEntry } from "../../sys/DB-Engine/links/Permission"; 
import { error, info } from "../../sys/logging";
import i18next from "i18next";

let configurableCommands: { name: string, description: string }[] = [];
let commandChoices: { name: string, value: string }[] = [];

export async function handlePermissionsAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const permlist = interaction.options.getFocused().toLowerCase();
    const filtered = commandChoices.filter(choice => 
        choice.name.toLowerCase().includes(permlist)
    );
    await interaction.respond(
        filtered.slice(0, 25)
    );
}

export async function registerPermissionsCommand(commandsList: { name: string, description: string }[] = []) {
    configurableCommands = commandsList.filter(cmd => cmd.name !== 'hola' && cmd.name !== 'owner' && cmd.name !== 'permisos');
    commandChoices = configurableCommands.map(cmd => ({
        name: `/${cmd.name} - ${cmd.description}`,
        value: cmd.name
    }));

    const permissions = new SlashCommandBuilder()
        .setName("permisos")
        .setDescription(i18next.t("command_permissions_description", { ns: "permissions" }))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName("añadir")
                .setDescription(i18next.t("command_permissions_add_description", { ns: "permissions" }))
                .addStringOption(option =>
                    option.setName("comando")
                        .setDescription(i18next.t("command_permissions_add_option_description", { ns: "permissions" }))
                        .setRequired(true)
                        .setAutocomplete(true))
                .addRoleOption(option =>
                    option.setName("rol")
                        .setDescription(i18next.t("command_permissions_option_rol", { ns: "permissions" }))
                        .setRequired(false))
                .addUserOption(option =>
                    option.setName("usuario")
                        .setDescription(i18next.t("command_permissions_option_usuario", { ns: "permissions" }))
                        .setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("remover")
                .setDescription(i18next.t("command_permissions_remove_description", { ns: "permissions" }))
                .addStringOption(option =>
                    option.setName("comando")
                        .setDescription(i18next.t('command_permissions_remove_option_description', { ns: 'permissions' }))
                        .setRequired(true)
                        .setAutocomplete(true))
                .addRoleOption(option =>
                    option.setName("rol")
                        .setDescription(i18next.t("command_permissions_option_rol", { ns: "permissions" }))
                        .setRequired(false))
                .addUserOption(option =>
                    option.setName("usuario")
                        .setDescription(i18next.t("command_permissions_option_usuario", { ns: "permissions" }))
                        .setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("lista")
                .setDescription(i18next.t("command_permissions_list_description", { ns: "permissions" }))
                .addStringOption(option =>
                    option.setName("comando")
                        .setDescription(i18next.t("command_permissions_list_option_description", { ns: "permissions" }))
                        .setRequired(false)
                        .setAutocomplete(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("limpiar")
                .setDescription(i18next.t("command_permissions_clear_description", { ns: "permissions" }))
        );

    return [permissions] as SlashCommandBuilder[];
}

export async function handlePermissionsCommand(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const memberPermissions = interaction.memberPermissions;
    const isAdmin = memberPermissions?.has(PermissionFlagsBits.ManageGuild) || interaction.guild?.ownerId === interaction.user.id; 
    if (!isAdmin) {
        await interaction.editReply({
            content: i18next.t("command_permission_error", { ns: "permissions" })
        });
        return;
    }

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild!.id;

    try {
        switch (subcommand) {
            case "añadir":
                await addPerm(interaction, guildId);
                break;
            case "remover":
                await removePerm(interaction, guildId);
                break;
            case "lista":
                await listPerm(interaction, guildId);
                break;
            case "limpiar":
                await clearPerms(interaction, guildId);
                break;     
        }
    } catch (err) {
        error(`Error ejecutando comando Permisos: ${err}`);
        await interaction.editReply({ content: i18next.t("command_error") });
    }
}

// =============== addPermisos =============== //


async function addPerm(interaction: ChatInputCommandInteraction, guildId: string) {
    const targetRole = interaction.options.getRole("rol");
    const targetUser = interaction.options.getUser("usuario");
    const commandName = interaction.options.getString("comando", true);

    if (!targetRole && !targetUser) {
        await interaction.editReply({ content: i18next.t("command_permissions_add_error", { ns: "permissions" })});
        return;
    }

    const targetId = targetRole ? targetRole.id : targetUser!.id;
    const type = targetRole ? 'ROLE' : 'USER';
    const name = targetRole ? targetRole.name : targetUser!.username;
    const commandInfo = configurableCommands.find(cmd => cmd.name === commandName);
    const commandDisplay = commandInfo ? `\`/${commandInfo.name}\` (${commandInfo.description})` : `\`/${commandName}\``;
    const i18Type = type === 'ROLE' ? 'rol' : 'usuario';

    try {
        const success = await addCommandPermission(guildId, targetId, type, commandName);
            
        if (success) {
            await interaction.editReply({
                content: i18next.t("command_permissions_add_success", { ns: "permissions", a1: name, a2: i18Type, a3: commandDisplay })});

        } else {
            await interaction.editReply({
                content: i18next.t("command_permissions_add_error", { ns: "permissions", a1: name, a2: commandDisplay })
            });
        }
    } catch (err) {
        error(`Error DB addPerm: ${err}`);
        await interaction.editReply({ content: i18next.t("command_error_add") });
    }
}

// =============== removerPermisos =============== //

async function removePerm(interaction: ChatInputCommandInteraction, guildId: string) {
    const targetRole = interaction.options.getRole("rol");
    const targetUser = interaction.options.getUser("usuario");
    const commandName = interaction.options.getString("comando", true);

    if (!targetRole && !targetUser) {
        await interaction.editReply({ content: i18next.t("command_permissions_remove_error_target", { ns: "permissions" })});
        return;
    }

    const targetId = targetRole ? targetRole.id : targetUser!.id;
    const name = targetRole ? targetRole.name : targetUser!.username;
    const commandInfo = configurableCommands.find(cmd => cmd.name === commandName);
    const commandDisplay = commandInfo ? `\`/${commandInfo.name}\` (${commandInfo.description})` : `\`/${commandName}\``;

    try {
        const removed = await removeCommandPermission(guildId, targetId, commandName);
        
        if (removed) {
            await interaction.editReply({
                content: i18next.t("command_permissions_remove_success", { ns: "permissions", a1: name, a2: commandDisplay }),
            });
        } else {
            await interaction.editReply({
                content: i18next.t("command_permissions_remove_error", { ns: "permissions", a1: name, a2: commandDisplay }),
            });
        }
    } catch (err) {
        error(`Error al revocar permiso: ${err}`);
        await interaction.editReply({ content: i18next.t("command_error_remove") });
    }
}

// =============== listaPermisos =============== //

async function listPerm(interaction: ChatInputCommandInteraction, guildId: string) {
    const commandFilter = interaction.options.getString("comando", false);
    
    try {
        const permissions = await listCommandPermissions(guildId, commandFilter || undefined);
        
        if (permissions.length === 0) {
            const message = commandFilter 
                ? i18next.t("command_permissions_list_by_command", { ns: "permissions", a1: commandFilter })
                : i18next.t("command_permissions_list_error", { ns: "permissions" });           
            await interaction.editReply({ content: message });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTimestamp();

        if (commandFilter) {
            const commandPermissions = permissions.filter(p => p.command_name === commandFilter);
            const commandInfo = configurableCommands.find(cmd => cmd.name === commandFilter);
            
            embed.setTitle(i18next.t("command_permissions_list_by_command_emb", { ns: "permissions", a1: commandFilter }));
            
            if (commandInfo) {
                embed.setDescription(`**${commandInfo.description}**`);
            }
            
            const roles = commandPermissions.filter(p => p.target_type === 'ROLE');
            const users = commandPermissions.filter(p => p.target_type === 'USER');
            
            let content = "";
            
            if (roles.length > 0) {
                const roleMentions = roles.map(r => `<@&${r.target_id}>`).join(" ");
                let limitedRoleMentions = roleMentions;
                if (roleMentions.length > 800) {
                    limitedRoleMentions = roleMentions.substring(0, 797) + '...';
                }
                content += `• 👥 **${roles.length} rol(es):**\n  ${limitedRoleMentions}\n\n`;
            }
            
            if (users.length > 0) {
                const userMentions = users.map(u => `<@${u.target_id}>`).join(" ");
                let limitedUserMentions = userMentions;
                if (userMentions.length > 800) {
                    limitedUserMentions = userMentions.substring(0, 797) + '...';
                }
                content += `• 👤 **${users.length} usuario(s):**\n  ${limitedUserMentions}`;
            }
            
            if (content) {
                if (content.length > 1024) {
                    content = content.substring(0, 1021) + '...';
                }
                embed.addFields({
                    name: "Permisos asignados:",
                    value: content,
                    inline: false
                });
            } else {
                embed.setDescription(i18next.t("command_permissions_no_permissions", { ns: "permissions" }));
            }
            
            embed.setFooter({ 
                text: i18next.t("command_permissions_total_footer", { ns: "permissions", a1: commandPermissions.length })
            });
            
        } else {
            embed.setTitle(i18next.t("command_permissions_list_all_command_emb", { ns: "permissions" }));
            
            const groupedByCommand: Record<string, PermissionEntry[]> = {};
            
            permissions.forEach(perm => {
                if (!groupedByCommand[perm.command_name]) {
                    groupedByCommand[perm.command_name] = [];
                }
                groupedByCommand[perm.command_name].push(perm);
            });
            
            const sortedCommandNames = Object.keys(groupedByCommand).sort();
            
            let description = "";
            let totalCommands = 0;
            let totalPermissions = 0;
            
            for (const commandName of sortedCommandNames) {
                const commandPerms = groupedByCommand[commandName];
                const commandInfo = configurableCommands.find(cmd => cmd.name === commandName);             
                const roles = commandPerms.filter(p => p.target_type === 'ROLE');
                const users = commandPerms.filter(p => p.target_type === 'USER');
                const commandDisplay = commandInfo 
                    ? `**/${commandInfo.name}** - ${commandInfo.description}`
                    : `**/${commandName}**`;
                
                description += `${commandDisplay}\n`;
                
                if (roles.length > 0) {
                    const roleMentions = roles.slice(0, 3).map(r => `<@&${r.target_id}>`).join(" ");
                    const extraRoles = roles.length > 3 ? ` +${roles.length - 3} más` : '';
                    description += `• 👥 **${roles.length} rol(es):** ${roleMentions}${extraRoles}\n`;
                }
                
                if (users.length > 0) {
                    const userMentions = users.slice(0, 3).map(u => `<@${u.target_id}>`).join(" ");
                    const extraUsers = users.length > 3 ? ` +${users.length - 3} más` : '';
                    description += `• 👤 **${users.length} usuario(s):** ${userMentions}${extraUsers}\n`;
                }
                
                description += "\n";
                
                totalCommands++;
                totalPermissions += commandPerms.length;
                
                if (description.length > 3500) {
                    description += `\n... y ${sortedCommandNames.length - totalCommands} comandos más (límite de caracteres)`;
                    break;
                }
            }
            
            embed.setDescription(description);
            
            embed.setFooter({ 
                text: i18next.t("command_permissions_total_footer_complete", { ns: "permissions", a1: totalPermissions,a2: totalCommands })
            });
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        error(`Error al listar permisos: ${err}`);
        await interaction.editReply({ content: i18next.t("command_error_list_res_emb", { ns: "permissions" }) });
    }
}

// =============== borrarTodo =============== //

async function clearPerms(interaction: ChatInputCommandInteraction, guildId: string) {
    const confirmButton = new ButtonBuilder()
        .setCustomId('confirm_delete')
        .setLabel('Confirmar!')
        .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
        .setCustomId('cancel_delete')
        .setLabel('Cancelar')
        .setStyle(ButtonStyle.Primary);

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(cancelButton, confirmButton);

    const confirmMessage = i18next.t("command_permissions_cleanup_confirm", { ns: "permissions" });
    
    await interaction.editReply({
        content: confirmMessage,
        components: [actionRow],
    });

    try {
        const buttonInteraction = await interaction.channel?.awaitMessageComponent({
            filter: (i) => i.customId === 'confirm_delete' || i.customId === 'cancel_delete',
            time: 20000
        }) as ButtonInteraction;

        if (buttonInteraction.customId === 'cancel_delete') {
            await buttonInteraction.update({
                content: i18next.t("command_permissions_cleanup_cancelled", { ns: "permissions" }),
                components: []
            });
            return;
        }
        
        if (buttonInteraction.customId === 'confirm_delete') {
            await buttonInteraction.deferUpdate();
            await clearGuildPermissions(guildId);
            await buttonInteraction.editReply({
                content: i18next.t("command_permissions_cleanup_result", { ns: "permissions" }),
                components: []
            });     
            info(`Permisos limpiados en servidor ${guildId}`, "Permisos");
        }
    } catch (err) {
        if (err instanceof Error && err.message.includes('time')) {
            await interaction.editReply({
                content: i18next.t("command_permissions_cleanup_timeout", { ns: "permissions" }),
            components: []
        });
        } else {
            error(`Error en limpieza: ${err}`, "Permisos");
            await interaction.editReply({
                content: i18next.t("command_permissions_cleanup_error", { ns: "permissions" }),
                components: []
            });
        }
    }
}

