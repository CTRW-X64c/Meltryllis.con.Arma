// src/Events-Commands/commands/post.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, MessageFlags, TextChannel, Message, Attachment, ChannelType } from "discord.js";
import { error, debug } from "../../sys/logging";
import { hasPermission } from "../../sys/zGears/mPermission";
import i18next from "i18next";

export async function registerPostCommand(): Promise<SlashCommandBuilder[]> {
    const postCommand = new SlashCommandBuilder()
        .setName("post")
        .setDescription(i18next.t("post:slashBuilder.description"))
        .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
        .addSubcommand(subcommand =>
            subcommand
                .setName("msg")
                .setDescription(i18next.t("post:slashBuilder.msg_description"))
                .addChannelOption(option =>
                    option
                        .setName("canal")
                        .setDescription(i18next.t("post:slashBuilder.canal_description"))
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.PrivateThread, ChannelType.PublicThread, ChannelType.GuildAnnouncement)
                )
                .addBooleanOption(option =>
                    option
                        .setName("borrar")
                        .setDescription(i18next.t("post:slashBuilder.borrar_msg_description"))
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("copy")
                .setDescription(i18next.t("post:slashBuilder.copy_description"))
                .addStringOption(option =>
                    option
                        .setName("mensaje_id")
                        .setDescription(i18next.t("post:slashBuilder.mensaje_description"))
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option
                        .setName("canal_destino")
                        .setDescription(i18next.t("post:slashBuilder.canal_description"))
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.PrivateThread, ChannelType.PublicThread, ChannelType.GuildAnnouncement)
                )
                .addChannelOption(option =>
                    option
                        .setName("canal_origen")
                        .setDescription(i18next.t("post:slashBuilder.canal_origen_description"))
                        .setRequired(false)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.PrivateThread, ChannelType.PublicThread, ChannelType.GuildAnnouncement)
                )
                .addBooleanOption(option =>
                    option
                        .setName("borrar")
                        .setDescription(i18next.t("post:slashBuilder.borrar_copy_description"))
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("edit")
                .setDescription(i18next.t("post:slashBuilder.edit_description"))
                .addStringOption(option =>
                    option
                        .setName("mensaje_id")
                        .setDescription(i18next.t("post:slashBuilder.mensaje_edit_description"))
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option
                        .setName("canal_mensaje")
                        .setDescription(i18next.t("post:slashBuilder.nuevo_mensaje_description"))
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.PrivateThread, ChannelType.PublicThread, ChannelType.GuildAnnouncement)
                )
                .addBooleanOption(option =>
                    option
                        .setName("borrar")
                        .setDescription(i18next.t("post:slashBuilder.borrar_edit_description"))
                        .setRequired(false)
                )  
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("reply")
                .setDescription(i18next.t("post:slashBuilder.reply_description"))
                .addStringOption(option =>
                    option
                        .setName("mensaje_id")
                        .setDescription(i18next.t("post:slashBuilder.mensaje_reply_description"))
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option
                        .setName("canal_mensaje")
                        .setDescription(i18next.t("post:slashBuilder.canal_mensaje_reply_description"))
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.PrivateThread, ChannelType.PublicThread, ChannelType.GuildAnnouncement)
                )
                .addBooleanOption(option =>
                    option
                        .setName("notify")
                        .setDescription(i18next.t("post:slashBuilder.canal_notify_description"))
                        .setRequired(false)
                )
                .addBooleanOption(option =>
                    option
                        .setName("borrar")
                        .setDescription(i18next.t("post:slashBuilder.borrar_reply_description"))
                        .setRequired(false)
                )
        );
        
    return [postCommand] as SlashCommandBuilder[];
}

export async function handlePostCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const isAllowed = await hasPermission(interaction, interaction.commandName);
    if (!isAllowed) {
        await interaction.reply({
            content: i18next.t("common:Errores.isAllowed"),
            flags: MessageFlags.Ephemeral
        });
        return;
    }
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
        case "msg":
            await PostMsg(interaction);
            break;
        case "copy":
            await PostCopy(interaction);
            break;
        case "edit":
            await PostEdit(interaction);
            break;
        case "reply":
            await PostReply(interaction);
            break;
        default:
            await interaction.reply({
                content: i18next.t("post:interacciones.not_found"),
                flags: MessageFlags.Ephemeral
            });
            break;
    }
}

/////////////////// AUTODELETE ///////////////////

const AUTO_DELETE_CONFIG = {
    enabled: true, 
    delay: 0,
    userMessages: true, 
    botResponses: false 
};

async function autoDeleteMessage(message: Message, delay: number = AUTO_DELETE_CONFIG.delay): Promise<void> {
    if (!AUTO_DELETE_CONFIG.enabled || !message.deletable) return;
    
    try {
        setTimeout(async () => {
            try {
                await message.delete();
                debug(`Mensaje auto-borrado: ${message.id}`, "PostCommand");
            } catch (deleteErr) {
                debug(`No se pudo auto-borrar mensaje ${message.id}: ${deleteErr}`, "PostCommand");
            }
        }, delay);
    } catch (err) {
        debug(`Error en auto-delete: ${err}`, "PostCommand");
    }
}

function shouldDelete(interaction: ChatInputCommandInteraction, defaultBehavior: boolean = true): boolean {
    const deleteOption = interaction.options.getBoolean("borrar");
    return deleteOption !== null ? deleteOption : defaultBehavior;
}

/////////////////// MsgPOST ///////////////////

async function PostMsg(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetChannel = interaction.options.getChannel("canal") as TextChannel;
    const deleteMode = shouldDelete(interaction, true); // Default: true para msg
    
    if (!targetChannel || !targetChannel.isTextBased()) {
        await interaction.reply({
            content: i18next.t("common:Errores.noChannel"),
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    try {
        await interaction.reply({
            content: i18next.t("post:interacciones.mensaje", { a1: `${targetChannel}`}),
            flags: MessageFlags.Ephemeral
        });

        const currentChannel = interaction.channel as TextChannel;
        if (!currentChannel) {
            await interaction.followUp({ content: i18next.t("post:interacciones.canal_error_permission"), flags: MessageFlags.Ephemeral });
            return;
        }

        const filter = (m: Message) => m.author.id === interaction.user.id;
        
        const collector = currentChannel.createMessageCollector({ 
            filter, 
            time: 180_000, 
            max: 1 
        });

        if (!collector) {
            await interaction.followUp({ content: i18next.t("post:interacciones.error_capturador"), flags: MessageFlags.Ephemeral });
            return;
        }

        collector.on('collect', async (message: Message) => {
            const cleanContent = message.content ? message.content.trim().toLowerCase() : "";
            if (cleanContent === '-cancelar' || cleanContent === '-cancel') {
                await interaction.followUp({ content: i18next.t("post:interacciones.stop"), flags: MessageFlags.Ephemeral });
                collector.stop("user_cancelled"); // Detener colector
                return;
            }

            try {
                const files = message.attachments.map((attachment: Attachment) => ({
                    attachment: attachment.url,
                    name: attachment.name
                }));

                if (!message.content && files.length === 0) {
                    await interaction.followUp({ content: i18next.t("post:interacciones.error_mensaje_vacio"), flags: MessageFlags.Ephemeral });
                    return;
                }

                await targetChannel.send({
                    content: message.content || undefined,
                    files: files
                });

                await interaction.followUp({ 
                    content: i18next.t("post:interacciones.success", { a1: `${targetChannel}`}),
                    flags: MessageFlags.Ephemeral
                });
                
                debug(`Anuncio publicado por ${interaction.user.tag} en #${targetChannel.name}`, "PostCommand");
                
                if (deleteMode && AUTO_DELETE_CONFIG.userMessages) {
                    await autoDeleteMessage(message);
                }
                
                collector.stop("success");

            } catch (err) {
                error(`Error al enviar el anuncio: ${err}`, "PostCommand");
                await interaction.followUp({ 
                    content: i18next.t("post:interacciones.error_publicar"),
                    flags: MessageFlags.Ephemeral 
                });
            }
        });

        collector.on('end', (_: any, reason: string) => {
            if (reason === 'time') {
                interaction.followUp({ 
                    content: i18next.t("post:interacciones.timeout"),
                    flags: MessageFlags.Ephemeral 
                }).catch(() => {});
            }
        });

    } catch (err) {
        error(`Error en comando post: ${err}`, "PostCommand");
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
                content: i18next.t("post:interacciones.not_found"),
                flags: MessageFlags.Ephemeral 
            });
        }
    }
}

/////////////////// CopyPOST ///////////////////

async function PostCopy(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const deleteMode = shouldDelete(interaction, false); // Default: false para copy

    try {
        const messageId = interaction.options.getString("mensaje_id", true);
        const targetChannelOption = interaction.options.getChannel("canal_destino");
        const sourceChannelOption = interaction.options.getChannel("canal_origen");
        
        const sourceChannel = (sourceChannelOption as TextChannel) || (interaction.channel as TextChannel);
        const targetChannel = (targetChannelOption as TextChannel); 

        if (!sourceChannel?.isTextBased() || !targetChannel?.isTextBased()) {
            await interaction.editReply({
                content: i18next.t("common:Errores.noChannel")
            });
            return;
        }

        if (!sourceChannel.permissionsFor(interaction.client.user!)?.has(['ViewChannel', 'ReadMessageHistory'])) {
            await interaction.editReply({
                content: i18next.t("post:interacciones.error_permisos_origen")
            });
            return;
        }

        if (!targetChannel.permissionsFor(interaction.client.user!)?.has(['SendMessages', 'ViewChannel'])) {
            await interaction.editReply({
                content: i18next.t("post:interacciones.error_permisos_destino")
            });
            return;
        }

        let originalMessage: Message;
        try {
            originalMessage = await sourceChannel.messages.fetch(messageId);
        } catch (err) {
            await interaction.editReply({
                content: i18next.t("post:interacciones.error_mensaje_no_encontrado")
            });
            return;
        }

        const files = originalMessage.attachments.map(attachment => ({
            attachment: attachment.url,
            name: attachment.name
        }));

        await targetChannel.send({
            content: originalMessage.content || undefined,
            embeds: originalMessage.embeds, 
            files: files
        });

        if (deleteMode && AUTO_DELETE_CONFIG.userMessages && originalMessage.deletable) {
            await autoDeleteMessage(originalMessage);
            
            await interaction.editReply({
                content: i18next.t("post:interacciones.copy_success_with_delete", { a1: sourceChannel.toString(), a2: targetChannel.toString() })
            });
            
            debug(`Mensaje ${messageId} copiado y ORIGINAL BORRADO por ${interaction.user.tag}`, "PostCommand");
        } else {
            await interaction.editReply({
                content: i18next.t("post:interacciones.copy_success", { a1: sourceChannel.toString(), a2: targetChannel.toString() })
            });
            
            debug(`Mensaje ${messageId} copiado por ${interaction.user.tag} de ${sourceChannel.name} a ${targetChannel.name}`, "PostCommand");
        }

    } catch (err) {
        error(`Error en comando copy: ${err}`, "PostCommand");
        await interaction.editReply({
            content: i18next.t("post:interacciones.copy_error")
        });
    }
}

/////////////////// EditPOST ///////////////////

async function PostEdit(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const deleteMode = shouldDelete(interaction, true); // Default: true para edit

    try {
        const messageId = interaction.options.getString("mensaje_id", true);
        const channelOption = interaction.options.getChannel("canal_mensaje");
        const targetChannel = (channelOption as TextChannel) || (interaction.channel as TextChannel);

        if (!targetChannel?.isTextBased()) {
            await interaction.editReply({
                content: i18next.t("common:Errores.noChannel")
            });
            return;
        }

        if (!targetChannel.permissionsFor(interaction.client.user!)?.has(['ViewChannel', 'ReadMessageHistory', 'ManageMessages'])) {
            await interaction.editReply({
                content: i18next.t("post:interacciones.error_permisos_edicion")
            });
            return;
        }

        let messageToEdit: Message;
        try {
            messageToEdit = await targetChannel.messages.fetch(messageId);
        } catch (err) {
            await interaction.editReply({
                content: i18next.t("post:interacciones.error_mensaje_no_encontrado")
            });
            return;
        }

        if (messageToEdit.author.id !== interaction.client.user?.id) {
            await interaction.editReply({
                content: i18next.t("post:interacciones.error_no_bot_message")
            });
            return;
        }

        await interaction.editReply({
            content: i18next.t("post:interacciones.edit_modo_interactivo")
        });

        const filter = (m: Message) => m.author.id === interaction.user.id;
        const collector = (interaction.channel as TextChannel)?.createMessageCollector({ 
            filter, 
            time: 180_000, 
            max: 1 
        });

        if (!collector) {
            await interaction.followUp({ 
                content: i18next.t("post:interacciones.error_capturador"),
                flags: MessageFlags.Ephemeral 
            });
            return;
        }

        collector.on('collect', async (newMessage: Message) => {
            const cleanContent = newMessage.content ? newMessage.content.trim().toLowerCase() : "";
            if (cleanContent === '-cancelar' || cleanContent === '-cancel') {
                await interaction.followUp({ content: i18next.t("post:interacciones.stop"), flags: MessageFlags.Ephemeral });
                collector.stop("cancelled");
                return;
            }

            try {

                const newFiles = newMessage.attachments.map(a => ({ attachment: a.url, name: a.name }));
                const editPayload: any = {
                    content: newMessage.content || undefined
                };

                if (newFiles.length > 0) {
                    editPayload.files = newFiles;
                    editPayload.attachments = []; 
                }

                await messageToEdit.edit(editPayload);

                await interaction.followUp({
                    content: i18next.t("post:interacciones.edit_success"),
                    flags: MessageFlags.Ephemeral
                });

                debug(`Mensaje ${messageId} editado por ${interaction.user.tag} en ${targetChannel.name}`, "PostCommand");
                
                if (deleteMode && AUTO_DELETE_CONFIG.userMessages) {
                    await autoDeleteMessage(newMessage);
                }
                
                collector.stop("success");

            } catch (editErr) {
                error(`Error al editar mensaje: ${editErr}`, "PostCommand");
                await interaction.followUp({
                    content: i18next.t("post:interacciones.edit_error"),
                    flags: MessageFlags.Ephemeral
                });
            }
        });

        collector.on('end', (_: any, reason: string) => {
            if (reason === 'time') {
                interaction.followUp({
                    content: i18next.t("post:interacciones.edit_timeout"),
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }
        });

    } catch (err) {
        error(`Error en comando edit: ${err}`, "PostCommand");
        await interaction.editReply({
            content: i18next.t("post:interacciones.edit_error_general")
        });
    }
}

/////////////////// ReplyPOST ///////////////////

async function PostReply(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    const deleteMode = shouldDelete(interaction, false); 
    const notifyMode = interaction.options.getBoolean("notify") ?? true; 

    try {
        const messageId = interaction.options.getString("mensaje_id", true);
        const channelOption = interaction.options.getChannel("canal_mensaje");
        const messageChannel = (channelOption as TextChannel) || (interaction.channel as TextChannel);

        if (!messageChannel?.isTextBased()) {
            await interaction.editReply({
                content: i18next.t("common:Errores.noChannel")
            });
            return;
        }

        if (!messageChannel.permissionsFor(interaction.client.user!)?.has(['ViewChannel', 'ReadMessageHistory', 'SendMessages'])) {
            await interaction.editReply({
                content: i18next.t("post:interacciones.error_permisos_reply")
            });
            return;
        }

        let originalMessage: Message;
        try {
            originalMessage = await messageChannel.messages.fetch(messageId);
        } catch (err) {
            await interaction.editReply({
                content: i18next.t("post:interacciones.error_mensaje_no_encontrado")
            });
            return;
        }

        await interaction.editReply({
            content: i18next.t("post:interacciones.reply_modo_interactivo")
        });

        const filter = (m: Message) => m.author.id === interaction.user.id;
        const collector = (interaction.channel as TextChannel)?.createMessageCollector({ 
            filter, 
            time: 180_000, 
            max: 1 
        });

        if (!collector) {
            await interaction.followUp({ 
                content: i18next.t("post:interacciones.error_capturador"),
                flags: MessageFlags.Ephemeral 
            });
            return;
        }

        collector.on('collect', async (replyMessage: Message) => {
            const cleanContent = replyMessage.content ? replyMessage.content.trim().toLowerCase() : "";
            
            if (cleanContent === '-cancelar' || cleanContent === '-cancel') {
                await interaction.followUp({ content: i18next.t("post:interacciones.stop"), flags: MessageFlags.Ephemeral });
                collector.stop("cancelled");
                return;
            }

            try {
                const files = replyMessage.attachments.map(attachment => ({
                    attachment: attachment.url,
                    name: attachment.name
                }));

                if (!replyMessage.content && files.length === 0) {
                    await interaction.followUp({ content: i18next.t("post:interacciones.error_mensaje_vacio"), flags: MessageFlags.Ephemeral });
                    return;
                }

                await originalMessage.reply({
                    content: replyMessage.content || undefined,
                    files: files.length > 0 ? files : undefined,
                    allowedMentions: { 
                        repliedUser: notifyMode
                    }
                });

                await interaction.followUp({
                    content: i18next.t("post:interacciones.reply_success", { 
                    a1: messageChannel.toString(), a2: notifyMode ? "🔔 Con notificación" : "🔕 Sin notificación" }),
                    flags: MessageFlags.Ephemeral
                });

                debug(`${interaction.user.tag} respondió mensaje ${messageId} en ${messageChannel.name}`, "PostCommand");

                if (deleteMode && AUTO_DELETE_CONFIG.userMessages && replyMessage.deletable) {
                    await autoDeleteMessage(replyMessage);
                }

                collector.stop("success");

            } catch (err) {
                error(`Error al enviar la respuesta: ${err}`, "PostCommand");
                await interaction.followUp({
                    content: i18next.t("post:interacciones.reply_error"),
                    flags: MessageFlags.Ephemeral
                });
            }
        });

        collector.on('end', (_: any, reason: string) => {
            if (reason === 'time') {
                interaction.followUp({
                    content: i18next.t("post:interacciones.reply_timeout"),
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }
        });

    } catch (err) {
        error(`Error en comando reply: ${err}`, "PostCommand");
        await interaction.editReply({
            content: i18next.t("post:interacciones.reply_error_general")
        });
    }
}