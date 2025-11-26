// src/client/commands/post.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, MessageFlags, TextChannel, Message, Attachment } from "discord.js";
import { error, debug } from "../../sys/logging";
import i18next from "i18next";

export async function registerPostCommand(): Promise<SlashCommandBuilder[]> {
    const postCommand = new SlashCommandBuilder()
        .setName("post")
        .setDescription(i18next.t("command_post_description", { ns: "post" }))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(subcommand =>
            subcommand
                .setName("msg")
                .setDescription(i18next.t("command_post_post_msg_description", { ns: "post" }))
                .addChannelOption(option =>
                    option
                        .setName("canal")
                        .setDescription(i18next.t("command_post_canal_description", { ns: "post" }))
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("copy")
                .setDescription(i18next.t("command_post_copy_description", { ns: "post" }))
                .addStringOption(option =>
                    option
                        .setName("mensaje_id")
                        .setDescription(i18next.t("command_post_mensaje_description", { ns: "post" }))
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option
                        .setName("canal_destino")
                        .setDescription(i18next.t("command_post_canal_description", { ns: "post" }))
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option
                        .setName("canal_origen")
                        .setDescription(i18next.t("command_post_canal_origen_description", { ns: "post" }))
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("edit")
                .setDescription(i18next.t("command_post_edit_description", { ns: "post" }))
                .addStringOption(option =>
                    option
                        .setName("mensaje_id")
                        .setDescription(i18next.t("command_post_mensaje_edit_description", { ns: "post" }))
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option
                        .setName("canal_mensaje")
                        .setDescription(i18next.t("command_post_nuevo_mensaje_description", { ns: "post" }))
                        .setRequired(false)
                )
        );
        
    return [postCommand] as SlashCommandBuilder[];
}

export async function handlePostCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const memberPermissions = interaction.memberPermissions;
    const isAdmin = memberPermissions?.has(PermissionFlagsBits.ManageMessages) || interaction.guild?.ownerId === interaction.user.id;
    if (!isAdmin) {
        await interaction.reply({
            content: i18next.t("command_permission_error", { ns: "post" }),
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
        default:
            await interaction.reply({
                content: i18next.t("command_subcommand_not_found", { ns: "post" }),
                flags: MessageFlags.Ephemeral
            });
            break;
    }
}

/////////////////// MsgPOST ///////////////////

async function PostMsg(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetChannel = interaction.options.getChannel("canal") as TextChannel;
    
    if (!targetChannel || !targetChannel.isTextBased()) {
        await interaction.reply({
            content: i18next.t("command_post_canal_error", { ns: "post" }),
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    try {
        await interaction.reply({
            content: i18next.t("command_post_mensaje", { ns: "post", a1: `${targetChannel}`}),
            flags: MessageFlags.Ephemeral
        });

        const currentChannel = interaction.channel as TextChannel;
        if (!currentChannel) {
            await interaction.followUp({ content: i18next.t("command_post_canal_error_permission", { ns: "post" }), flags: MessageFlags.Ephemeral });
            return;
        }

        const filter = (m: Message) => m.author.id === interaction.user.id;
        
        const collector = currentChannel.createMessageCollector({ 
            filter, 
            time: 180_000, 
            max: 1 
        });

        if (!collector) {
            await interaction.followUp({ content: i18next.t("command_post_error_capturador", { ns: "post" }), flags: MessageFlags.Ephemeral });
            return;
        }

        collector.on('collect', async (message: Message) => {
            const cleanContent = message.content ? message.content.trim().toLowerCase() : "";
            if (cleanContent === '-cancelar' || cleanContent === '-cancel') {
                await interaction.followUp({ content: i18next.t("command_post_stop", { ns: "post" }), flags: MessageFlags.Ephemeral });
                collector.stop("user_cancelled"); // Detener colector
                return;
            }

            try {
                const files = message.attachments.map((attachment: Attachment) => ({
                    attachment: attachment.url,
                    name: attachment.name
                }));

                if (!message.content && files.length === 0) {
                    await interaction.followUp({ content: i18next.t("command_post_error_mensaje_vacio", { ns: "post" }), flags: MessageFlags.Ephemeral });
                    return;
                }

                await targetChannel.send({
                    content: message.content || undefined,
                    files: files
                });

                await interaction.followUp({ 
                    content: i18next.t("command_post_success", { ns: "post", a1: `${targetChannel}`}),
                    flags: MessageFlags.Ephemeral
                });
                
                debug(`Anuncio publicado por ${interaction.user.tag} en #${targetChannel.name}`, "PostCommand");
                collector.stop("success");

            } catch (err) {
                error(`Error al enviar el anuncio: ${err}`, "PostCommand");
                await interaction.followUp({ 
                    content: i18next.t("command_post_error_publicar", { ns: "post" }),
                    flags: MessageFlags.Ephemeral 
                });
            }
        });

        collector.on('end', (_: any, reason: string) => {
            if (reason === 'time') {
                interaction.followUp({ 
                    content: i18next.t("command_post_timeout", { ns: "post" }),
                    flags: MessageFlags.Ephemeral 
                }).catch(() => {});
            }
        });

    } catch (err) {
        error(`Error en comando post: ${err}`, "PostCommand");
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
                content: i18next.t("command_error_desconocido", { ns: "post" }),
                flags: MessageFlags.Ephemeral 
            });
        }
    }
}

/////////////////// CopyPOST ///////////////////

async function PostCopy(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const messageId = interaction.options.getString("mensaje_id", true);
        const targetChannelOption = interaction.options.getChannel("canal_destino");
        const sourceChannelOption = interaction.options.getChannel("canal_origen");
        
        const sourceChannel = (sourceChannelOption as TextChannel) || (interaction.channel as TextChannel);
        const targetChannel = (targetChannelOption as TextChannel); 

        if (!sourceChannel?.isTextBased() || !targetChannel?.isTextBased()) {
            await interaction.editReply({
                content: i18next.t("command_post_canal_error", { ns: "post" })
            });
            return;
        }

        if (!sourceChannel.permissionsFor(interaction.client.user!)?.has(['ViewChannel', 'ReadMessageHistory'])) {
            await interaction.editReply({
                content: i18next.t("command_post_error_permisos_origen", { ns: "post" })
            });
            return;
        }

        if (!targetChannel.permissionsFor(interaction.client.user!)?.has(['SendMessages', 'ViewChannel'])) {
            await interaction.editReply({
                content: i18next.t("command_post_error_permisos_destino", { ns: "post" })
            });
            return;
        }

        let originalMessage: Message;
        try {
            originalMessage = await sourceChannel.messages.fetch(messageId);
        } catch (err) {
            await interaction.editReply({
                content: i18next.t("command_post_error_mensaje_no_encontrado", { ns: "post" })
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

        await interaction.editReply({
            content: i18next.t("command_post_copy_success", { 
                ns: "post", 
                a1: sourceChannel.toString(),
                a2: targetChannel.toString()
            })
        });

        debug(`Mensaje ${messageId} copiado por ${interaction.user.tag} de ${sourceChannel.name} a ${targetChannel.name}`, "PostCommand");

    } catch (err) {
        error(`Error en comando copy: ${err}`, "PostCommand");
        await interaction.editReply({
            content: i18next.t("command_post_copy_error", { ns: "post" })
        });
    }
}

/////////////////// EditPOST ///////////////////

async function PostEdit(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const messageId = interaction.options.getString("mensaje_id", true);
        const channelOption = interaction.options.getChannel("canal_mensaje");
        const targetChannel = (channelOption as TextChannel) || (interaction.channel as TextChannel);

        if (!targetChannel?.isTextBased()) {
            await interaction.editReply({
                content: i18next.t("command_post_canal_error", { ns: "post" })
            });
            return;
        }

        if (!targetChannel.permissionsFor(interaction.client.user!)?.has(['ViewChannel', 'ReadMessageHistory', 'ManageMessages'])) {
            await interaction.editReply({
                content: i18next.t("command_post_error_permisos_edicion", { ns: "post" })
            });
            return;
        }

        let messageToEdit: Message;
        try {
            messageToEdit = await targetChannel.messages.fetch(messageId);
        } catch (err) {
            await interaction.editReply({
                content: i18next.t("command_post_error_mensaje_no_encontrado", { ns: "post" })
            });
            return;
        }

        if (messageToEdit.author.id !== interaction.client.user?.id) {
            await interaction.editReply({
                content: i18next.t("command_post_error_no_bot_message", { ns: "post" })
            });
            return;
        }

        await interaction.editReply({
            content: i18next.t("command_post_edit_modo_interactivo", { ns: "post" })
        });

        const filter = (m: Message) => m.author.id === interaction.user.id;
        const collector = (interaction.channel as TextChannel)?.createMessageCollector({ 
            filter, 
            time: 180_000, 
            max: 1 
        });

        if (!collector) {
            await interaction.followUp({ 
                content: i18next.t("command_post_error_capturador", { ns: "post" }),
                flags: MessageFlags.Ephemeral 
            });
            return;
        }

        collector.on('collect', async (newMessage: Message) => {
            const cleanContent = newMessage.content ? newMessage.content.trim().toLowerCase() : "";
            if (cleanContent === '-cancelar' || cleanContent === '-cancel') {
                await interaction.followUp({ content: i18next.t("command_post_stop", { ns: "post" }), flags: MessageFlags.Ephemeral });
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
                    content: i18next.t("command_post_edit_success", { ns: "post" }),
                    flags: MessageFlags.Ephemeral
                });

                debug(`Mensaje ${messageId} editado por ${interaction.user.tag} en ${targetChannel.name}`, "PostCommand");
                collector.stop("success");

            } catch (editErr) {
                error(`Error al editar mensaje: ${editErr}`, "PostCommand");
                await interaction.followUp({
                    content: i18next.t("command_post_edit_error", { ns: "post" }),
                    flags: MessageFlags.Ephemeral
                });
            }
        });

        collector.on('end', (_: any, reason: string) => {
            if (reason === 'time') {
                interaction.followUp({
                    content: i18next.t("command_post_edit_timeout", { ns: "post" }),
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }
        });

    } catch (err) {
        error(`Error en comando edit: ${err}`, "PostCommand");
        await interaction.editReply({
            content: i18next.t("command_post_edit_error_general", { ns: "post" })
        });
    }
}