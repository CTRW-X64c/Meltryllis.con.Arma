// src/Events-Commands/commands/post.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, MessageFlags, TextChannel, Message, Attachment, ChannelType } from "discord.js";
import { error, debug } from "../../sys/logging";
import { hasPermission } from "../../sys/zGears/mPermission";
import i18next from "i18next";
import { masterPerm } from "../../sys/zGears/auxiliares";

export async function registerPostCommand(): Promise<SlashCommandBuilder[]> {
    const postCommand = new SlashCommandBuilder()
        .setName("post")
        .setDescription(i18next.t("commands:post.slashBuilder.description"))
        .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
        .addSubcommand(s => s
            .setName("msg")
            .setDescription(i18next.t("commands:post.slashBuilder.msg_description"))
            .addChannelOption(o =>
                o.setName("canal").setRequired(true).setDescription(i18next.t("commands:post.slashBuilder.canal_description"))
                    .addChannelTypes(ChannelType.GuildText, ChannelType.PrivateThread, ChannelType.PublicThread, ChannelType.GuildAnnouncement)
            )
            .addBooleanOption(o =>
                o.setName("borrar").setRequired(false).setDescription(i18next.t("commands:post.slashBuilder.borrar_msg_description"))
            )
        )
        .addSubcommand(s => s
            .setName("copy")
            .setDescription(i18next.t("commands:post.slashBuilder.copy_description"))
            .addStringOption(o =>
                o.setName("mensaje_id").setRequired(true).setDescription(i18next.t("commands:post.slashBuilder.mensaje_description"))
            )
            .addChannelOption(o =>
                o.setName("canal_destino").setRequired(true).setDescription(i18next.t("commands:post.slashBuilder.canal_description"))
                    .addChannelTypes(ChannelType.GuildText, ChannelType.PrivateThread, ChannelType.PublicThread, ChannelType.GuildAnnouncement)
            )
            .addChannelOption(o =>
                o.setName("canal_origen").setRequired(false).setDescription(i18next.t("commands:post.slashBuilder.canal_origen_description"))
                    .addChannelTypes(ChannelType.GuildText, ChannelType.PrivateThread, ChannelType.PublicThread, ChannelType.GuildAnnouncement)
            )
            .addBooleanOption(o =>
                o.setName("borrar").setRequired(false).setDescription(i18next.t("commands:post.slashBuilder.borrar_copy_description"))
            )
        )
        .addSubcommand(s => s
            .setName("edit")
            .setDescription(i18next.t("commands:post.slashBuilder.edit_description"))
            .addStringOption(o =>
                o.setName("mensaje_id").setRequired(true).setDescription(i18next.t("commands:post.slashBuilder.mensaje_edit_description"))
            )
            .addChannelOption(o =>
                o.setName("canal_mensaje").setRequired(true).setDescription(i18next.t("commands:post.slashBuilder.nuevo_mensaje_description"))
                    .addChannelTypes(ChannelType.GuildText, ChannelType.PrivateThread, ChannelType.PublicThread, ChannelType.GuildAnnouncement)
            )
            .addBooleanOption(o =>
                o.setName("edit_from_msg").setRequired(false).setDescription(i18next.t("commands:post.slashBuilder.edit_from_msg_description"))
            )
            .addChannelOption(o =>
                o.setName("canal_origen").setRequired(false).setDescription(i18next.t("commands:post.slashBuilder.edit_from_msg_channel_description"))
                    .addChannelTypes(ChannelType.GuildText, ChannelType.PrivateThread, ChannelType.PublicThread, ChannelType.GuildAnnouncement)
            )
            .addStringOption(o =>
                o.setName("msg_origen").setRequired(false).setDescription(i18next.t("commands:post.slashBuilder.edit_from_msg_message_description"))
            )
            .addBooleanOption(o =>
                o.setName("borrar").setRequired(false).setDescription(i18next.t("commands:post.slashBuilder.borrar_edit_description"))
            )
        )
        .addSubcommand(s => s
            .setName("reply")
            .setDescription(i18next.t("commands:post.slashBuilder.reply_description"))
            .addStringOption(o =>
                o.setName("mensaje_id").setRequired(true).setDescription(i18next.t("commands:post.slashBuilder.mensaje_reply_description"))
            )
            .addChannelOption(o =>
                o.setRequired(true).setName("canal_mensaje").setDescription(i18next.t("commands:post.slashBuilder.canal_mensaje_reply_description"))
                    .addChannelTypes(ChannelType.GuildText, ChannelType.PrivateThread, ChannelType.PublicThread, ChannelType.GuildAnnouncement)
            )
            .addBooleanOption(o =>
                o.setName("notify").setRequired(false).setDescription(i18next.t("commands:post.slashBuilder.canal_notify_description"))
            )
            .addBooleanOption(o =>
                o.setName("borrar").setRequired(false).setDescription(i18next.t("commands:post.slashBuilder.borrar_reply_description"))
            )
        )
        .addSubcommand(s => s
            .setName("embed")
            .setDescription(i18next.t("commands:post.slashBuilder.embed_description"))
            .addChannelOption(o => o.setName("canal").setDescription(i18next.t("commands:post.slashBuilder.embed_channel_description")).setRequired(true)
                .addChannelTypes(ChannelType.GuildText, ChannelType.PrivateThread, ChannelType.PublicThread, ChannelType.GuildAnnouncement)
            )
            .addBooleanOption(o =>
                o.setName("borrar").setDescription("Borrar el mensaje con el JSON después de publicar").setRequired(false)
            )
        );
    return [postCommand] as SlashCommandBuilder[];
}

export async function handlePostCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const guild = interaction.guild;
    if (!guild) {
        await interaction.reply(i18next.t("common:Errores.noGuild"));
        return;
    }

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
        case "embed":
            await PostEmbed(interaction);
            break;
        default:
            await interaction.reply({
                content: i18next.t("commands:post.interacciones.not_found"),
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
            } catch (e) {
                debug(`No se pudo auto-borrar mensaje ${message.id}: ${e}`, "PostCommand");
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

    const currentChannel = interaction.channel as TextChannel;
    if (!currentChannel) {
        await interaction.reply({ content: i18next.t("commands:post.interacciones.canal_error_permission"), flags: MessageFlags.Ephemeral });
        return;
    }

    const testPerm = masterPerm(currentChannel, "viewCh|sendMsg|addlink|addfiles")
    if (!testPerm.ok) { await interaction.reply({ content: i18next.t("common:Errores.missing_permissions", { a1: `<#${currentChannel.id}>`, a2: testPerm.msg.join('\n') }) }); return; }

    await interaction.reply({
        content: i18next.t("commands:post.interacciones.mensaje", { a1: `${targetChannel}` }),
        flags: MessageFlags.Ephemeral
    });

    try {
        const filter = (m: Message) => m.author.id === interaction.user.id;

        const collector = currentChannel.createMessageCollector({
            filter,
            time: 180_000,
            max: 1
        });

        if (!collector) {
            await interaction.followUp({ content: i18next.t("commands:post.interacciones.error_capturador"), flags: MessageFlags.Ephemeral });
            return;
        }

        collector.on('collect', async (message: Message) => {
            const cleanContent = message.content ? message.content.trim().toLowerCase() : "";
            if (cleanContent === '-cancelar' || cleanContent === '-cancel') {
                await interaction.followUp({ content: i18next.t("commands:post.interacciones.stop"), flags: MessageFlags.Ephemeral });
                collector.stop("user_cancelled"); // Detener colector
                return;
            }

            try {
                const files = message.attachments.map((attachment: Attachment) => ({
                    attachment: attachment.url,
                    name: attachment.name
                }));

                if (!message.content && files.length === 0) {
                    await interaction.followUp({ content: i18next.t("commands:post.interacciones.error_mensaje_vacio"), flags: MessageFlags.Ephemeral });
                    return;
                }

                await targetChannel.send({
                    content: message.content || undefined,
                    files: files
                });

                await interaction.followUp({
                    content: i18next.t("commands:post.interacciones.success", { a1: `${targetChannel}` }),
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
                    content: i18next.t("commands:post.interacciones.error_publicar"),
                    flags: MessageFlags.Ephemeral
                });
            }
        });

        collector.on('end', (_: any, reason: string) => {
            if (reason === 'time') {
                interaction.followUp({
                    content: i18next.t("commands:post.interacciones.timeout"),
                    flags: MessageFlags.Ephemeral
                }).catch(() => { });
            }
        });

    } catch (err) {
        error(`Error en comando post: ${err}`, "PostCommand");
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: i18next.t("commands:post.interacciones.not_found"),
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

        const meFrom = masterPerm(sourceChannel, "viewCh|readMsg")
        if (!meFrom.ok) { await interaction.editReply({ content: i18next.t("common:Errores.missing_permissions", { a1: `<#${sourceChannel.id}>`, a2: meFrom.msg.join('\n') }) }); return; }

        const meTo = masterPerm(targetChannel, "viewCh|sendMsg|addlink|addfiles")
        if (!meTo.ok) { await interaction.editReply({ content: i18next.t("common:Errores.missing_permissions", { a1: `***objetivo*** <#${targetChannel.id}>`, a2: meTo.msg.join('\n') }) }); return; }

        let originalMessage: Message;
        try {
            originalMessage = await sourceChannel.messages.fetch(messageId);
        } catch (err) {
            await interaction.editReply({
                content: i18next.t("commands:post.interacciones.error_mensaje_no_encontrado")
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
                content: i18next.t("commands:post.interacciones.copy_success_with_delete", { a1: sourceChannel.toString(), a2: targetChannel.toString() })
            });

            debug(`Mensaje ${messageId} copiado y ORIGINAL BORRADO por ${interaction.user.tag}`, "PostCommand");
        } else {
            await interaction.editReply({
                content: i18next.t("commands:post.interacciones.copy_success", { a1: sourceChannel.toString(), a2: targetChannel.toString() })
            });

            debug(`Mensaje ${messageId} copiado por ${interaction.user.tag} de ${sourceChannel.name} a ${targetChannel.name}`, "PostCommand");
        }

    } catch (err) {
        error(`Error en comando copy: ${err}`, "PostCommand");
        await interaction.editReply({
            content: i18next.t("commands:post.interacciones.copy_error")
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
        const copyMode = interaction.options.getBoolean("edit_from_msg")
        const sourceCh = interaction.options.getChannel("canal_origen");
        const msg2Copy = interaction.options.getString("msg_origen")

        const targetChannel = (channelOption as TextChannel) || (interaction.channel as TextChannel);
        if (!targetChannel?.isTextBased()) {
            await interaction.editReply({
                content: i18next.t("common:Errores.noChannel")
            });
            return;
        }

        const testPerm = masterPerm(targetChannel, "viewCh|msgManager|readMsg|addlink|addfiles")
        if (!testPerm.ok) { await interaction.editReply({ content: i18next.t("common:Errores.missing_permissions", { a1: `<#${targetChannel.id}>`, a2: testPerm.msg.join('\n') }) }); return; }

        let messageToEdit: Message;
        try {
            messageToEdit = await targetChannel.messages.fetch(messageId);
        } catch (err) {
            await interaction.editReply({
                content: i18next.t("commands:post.interacciones.error_mensaje_no_encontrado")
            });
            return;
        }

        if (messageToEdit.author.id !== interaction.client.user?.id) {
            await interaction.editReply({
                content: i18next.t("commands:post.interacciones.error_no_bot_message")
            });
            return;
        }

        if (copyMode === true) {
            const chorigen = (sourceCh as TextChannel) || (interaction.channel as TextChannel);
            if (!chorigen || !chorigen.isTextBased()) {
                await interaction.editReply({ content: i18next.t("commands:post.interacciones.error_canal_msg_origen_no_encontrado") });
                return;
            }

            if (!msg2Copy) {
                await interaction.editReply({ content: i18next.t("commands:post.interacciones.error_mensaje_origen_no_encontrado") });
                return;
            }

            let msgToCopy: Message;
            try {
                msgToCopy = await chorigen.messages.fetch(msg2Copy);
            } catch (e) {
                await interaction.editReply({ content: i18next.t("commands:post.interacciones.error_mensaje_no_encontrado") });
                return;
            }

            const { embeds, content, components } = msgToCopy;
            const attachments = msgToCopy.attachments.map(a => ({ attachment: a.url, name: a.name }));

            const editPayload: any = {
                content: content || null,
                embeds: embeds,
                components: components
            };

            if (attachments.length > 0) {
                editPayload.files = attachments;
                editPayload.attachments = [];
            } else {
                editPayload.attachments = [];
            }

            await messageToEdit.edit(editPayload);

            await interaction.editReply({ content: i18next.t("commands:post.interacciones.edit_success") });

        } else {

            await interaction.editReply({
                content: i18next.t("commands:post.interacciones.edit_modo_interactivo")
            });

            const filter = (m: Message) => m.author.id === interaction.user.id;
            const collector = (interaction.channel as TextChannel)?.createMessageCollector({
                filter,
                time: 180_000,
                max: 1
            });

            if (!collector) {
                await interaction.followUp({
                    content: i18next.t("commands:post.interacciones.error_capturador"),
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            collector.on('collect', async (newMessage: Message) => {
                const cleanContent = newMessage.content ? newMessage.content.trim().toLowerCase() : "";
                if (cleanContent === '-cancelar' || cleanContent === '-cancel') {
                    await interaction.followUp({ content: i18next.t("commands:post.interacciones.stop"), flags: MessageFlags.Ephemeral });
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
                        content: i18next.t("commands:post.interacciones.edit_success"),
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
                        content: i18next.t("commands:post.interacciones.edit_error"),
                        flags: MessageFlags.Ephemeral
                    });
                }
            });

            collector.on('end', (_: any, reason: string) => {
                if (reason === 'time') {
                    interaction.followUp({
                        content: i18next.t("commands:post.interacciones.edit_timeout"),
                        flags: MessageFlags.Ephemeral
                    }).catch(() => { });
                }
            });
        }

    } catch (err) {
        error(`Error en comando edit: ${err}`, "PostCommand");
        await interaction.editReply({
            content: i18next.t("commands:post.interacciones.edit_error_general")
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

        const meTo = masterPerm(messageChannel, "viewCh|readMsg|sendMsg|addlink|addfiles")
        if (!meTo.ok) { await interaction.editReply({ content: i18next.t("common:Errores.missing_permissions", { a1: `<#${messageChannel.id}>`, a2: meTo.msg.join('\n') }) }); return; }

        let originalMessage: Message;
        try {
            originalMessage = await messageChannel.messages.fetch(messageId);
        } catch (err) {
            await interaction.editReply({
                content: i18next.t("commands:post.interacciones.error_mensaje_no_encontrado")
            });
            return;
        }

        await interaction.editReply({
            content: i18next.t("commands:post.interacciones.reply_modo_interactivo")
        });

        const filter = (m: Message) => m.author.id === interaction.user.id;
        const collector = (interaction.channel as TextChannel)?.createMessageCollector({
            filter,
            time: 180_000,
            max: 1
        });

        if (!collector) {
            await interaction.followUp({
                content: i18next.t("commands:post.interacciones.error_capturador"),
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        collector.on('collect', async (replyMessage: Message) => {
            const cleanContent = replyMessage.content ? replyMessage.content.trim().toLowerCase() : "";

            if (cleanContent === '-cancelar' || cleanContent === '-cancel') {
                await interaction.followUp({ content: i18next.t("commands:post.interacciones.stop"), flags: MessageFlags.Ephemeral });
                collector.stop("cancelled");
                return;
            }

            try {
                const files = replyMessage.attachments.map(attachment => ({
                    attachment: attachment.url,
                    name: attachment.name
                }));

                if (!replyMessage.content && files.length === 0) {
                    await interaction.followUp({ content: i18next.t("commands:post.interacciones.error_mensaje_vacio"), flags: MessageFlags.Ephemeral });
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
                    content: i18next.t("commands:post.interacciones.reply_success", {
                        a1: messageChannel.toString(), a2: notifyMode ? "🔔 Con notificación" : "🔕 Sin notificación"
                    }),
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
                    content: i18next.t("commands:post.interacciones.reply_error"),
                    flags: MessageFlags.Ephemeral
                });
            }
        });

        collector.on('end', (_: any, reason: string) => {
            if (reason === 'time') {
                interaction.followUp({
                    content: i18next.t("commands:post.interacciones.reply_timeout"),
                    flags: MessageFlags.Ephemeral
                }).catch(() => { });
            }
        });

    } catch (err) {
        error(`Error en comando reply: ${err}`, "PostCommand");
        await interaction.editReply({
            content: i18next.t("commands:post.interacciones.reply_error_general")
        });
    }
}

/////////////////// EmbedPOST ///////////////////

async function PostEmbed(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetChannel = interaction.options.getChannel("canal") as TextChannel;
    const deleteMode = shouldDelete(interaction, true);

    if (!targetChannel || !targetChannel?.isTextBased()) {
        await interaction.reply({ content: i18next.t("common:Errores.noChannel"), flags: MessageFlags.Ephemeral });
        return;
    }

    const testPerm = masterPerm(targetChannel, "viewCh|sendMsg|addlink|addfiles")
    if (!testPerm.ok) { await interaction.reply({ content: i18next.t("common:Errores.missing_permissions", { a1: `<#${targetChannel.id}>`, a2: testPerm.msg.join('\n') }) }); return; }

    await interaction.reply({
        content:
            i18next.t("commands:post.interacciones.help_emb_1") +
            i18next.t("commands:post.interacciones.help_emb_2") +
            i18next.t("commands:post.interacciones.help_emb_3") +
            i18next.t("commands:post.interacciones.help_emb_4", { a1: targetChannel.toString() }) +
            i18next.t("commands:post.interacciones.help_emb_5") +
            i18next.t("commands:post.interacciones.help_emb_6"),
        flags: MessageFlags.Ephemeral
    });

    try {
        const chget = interaction.channel;
        if (!chget || !chget.isTextBased()) {
            await interaction.reply({ content: i18next.t("common:Errores.noChannel"), flags: MessageFlags.Ephemeral });
            return;
        }

        const bseTxtCH = chget as TextChannel
        const filter = (m: Message) =>
            m.author.id === interaction.user.id &&
            (m.attachments.size > 0 || m.content?.trim().toLowerCase() === '-cancelar');

        const collector = bseTxtCH.createMessageCollector({
            filter,
            time: 180_000,
            max: 1
        });

        collector.on('collect', async (message: Message) => {
            if (message.content?.trim().toLowerCase() === '-cancelar') {
                await interaction.followUp({ content: i18next.t("commands:post.interacciones.stop"), flags: MessageFlags.Ephemeral });
                collector.stop("cancelled");
                return;
            }

            try {
                const attachment = message.attachments.first();
                if (!attachment) {
                    await interaction.followUp({ content: i18next.t("commands:post.interacciones.no_file_found"), flags: MessageFlags.Ephemeral });
                    return;
                }

                if (!attachment.name?.endsWith('.json')) {
                    await interaction.followUp({
                        content: i18next.t("commands:post.interacciones.not_a_valid_json"), flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                const response = await fetch(attachment.url);
                const jsonText = await response.text();
                const data = JSON.parse(jsonText);
                if (!data.embeds || !Array.isArray(data.embeds) || data.embeds.length === 0) {
                    await interaction.followUp({
                        content: i18next.t("commands:post.interacciones.no_valid_embed_in_json"), flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                const embeds = data.embeds.map((embedData: any) => ({
                    title: embedData.title || undefined,
                    description: embedData.description || undefined,
                    color: embedData.color || undefined,
                    author: embedData.author ? {
                        name: embedData.author.name,
                        icon_url: embedData.author.icon_url,
                        url: embedData.author.url
                    } : undefined,
                    fields: embedData.fields?.map((field: any) => ({
                        name: field.name,
                        value: field.value,
                        inline: field.inline || false
                    })) || [],
                    thumbnail: embedData.thumbnail ? { url: embedData.thumbnail.url } : undefined,
                    image: embedData.image ? { url: embedData.image.url } : undefined,
                    footer: embedData.footer ? {
                        text: embedData.footer.text,
                        icon_url: embedData.footer.icon_url
                    } : undefined,
                    timestamp: embedData.timestamp || undefined,
                    url: embedData.url || undefined
                }));

                await targetChannel.send({ content: data.content || undefined, embeds: embeds });

                await interaction.followUp({ content: i18next.t("commands:post.interacciones.reply_embed_success", { a1: embeds.length, a2: targetChannel.toString() }), flags: MessageFlags.Ephemeral });
                debug(`Embed desde archivo JSON por ${interaction.user.tag} en #${targetChannel.name}`, "PostCommand");

                if (deleteMode && AUTO_DELETE_CONFIG.userMessages) { await autoDeleteMessage(message); }
                collector.stop("success");

            } catch (error) {
                console.error("Error procesando archivo JSON:", error);
                await interaction.followUp({
                    content: `❌ **Error al procesar el archivo:**\n\`${error instanceof Error ? error.message : 'Formato inválido'}\``,
                    flags: MessageFlags.Ephemeral
                });
            }
        });

        collector.on('end', (_: any, reason: string) => {
            if (reason === 'time') {
                interaction.followUp({
                    content: i18next.t("commands:post.interacciones.reply_timeout_emb"),
                    flags: MessageFlags.Ephemeral
                }).catch(() => { });
            }
        });

    } catch (err) {
        error(`Error en comando embed: ${err}`, "PostCommand");
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: "Ocurrió un error al procesar el comando.", flags: MessageFlags.Ephemeral
            });
        }
    }
}