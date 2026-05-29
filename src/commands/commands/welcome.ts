// src/Events-Commands/commands/welcome.ts
import { SlashCommandBuilder, MessageFlags, PermissionFlagsBits, ChatInputCommandInteraction, GuildMember, ButtonBuilder, ActionRowBuilder, ButtonStyle, ComponentType, TextInputStyle, TextInputBuilder, ModalBuilder, Guild, ChannelType, AutocompleteInteraction, } from "discord.js";
import i18next from "i18next";
import { error } from "../../sys/logging";
import { hasPermission } from "../../sys/zGears/mPermission";
import { getNewConfiWelcome, setNewConfiWelcome, removeWelcome } from "../../sys/DB-Engine/links/Welcome";
import { buildBanner, fonts, chaBg } from "../../bgProcess/welcomeEvents";

export async function registerWelcomeCommand(): Promise<SlashCommandBuilder[]> {
    const welcomeCommand = new SlashCommandBuilder()
        .setName("welcome")
        .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
        .setDescription(i18next.t("commands:welcome.slashBuilder.description"))
        .addSubcommand((s) => s.setName("preview")
            .setDescription(i18next.t("commands:welcome.slashBuilder.preview_description"))
        )
        .addSubcommand((s) => s.setName("remove")
            .setDescription(i18next.t("commands:welcome.slashBuilder.remove_"))
        )
        .addSubcommand((s) => s.setName("slash_builder")
            .setDescription(i18next.t("commands:welcome.slashBuilder.command_builder"))
            // 1ra linea
            .addStringOption((o) => o.setName("ftext_text").setRequired(true).setDescription(i18next.t("commands:welcome.slashBuilder.ftext_text")))
            .addStringOption((o) => o.setName("ftext_color").setRequired(true).setDescription(i18next.t("commands:welcome.slashBuilder.ftext_color")))
            .addStringOption((o) => o.setName("ftext_font").setAutocomplete(true).setRequired(true).setDescription(i18next.t("commands:welcome.slashBuilder.ftext_font")))
            .addIntegerOption((o) => o.setName("ftext_size").setRequired(true).setMinValue(10).setMaxValue(110).setDescription(i18next.t("commands:welcome.slashBuilder.ftext_size")))
            // Base
            .addChannelOption((o) => o.setName("channel").setRequired(true).setDescription(i18next.t("commands:welcome.slashBuilder.channel"))
                .addChannelTypes(ChannelType.GuildText, ChannelType.PrivateThread, ChannelType.PublicThread, ChannelType.GuildAnnouncement))
            .addStringOption((o) => o.setName("ringcolor").setRequired(true).setDescription(i18next.t("commands:welcome.slashBuilder.ringcolor")))
            //data
            .addStringOption((o) => o.setName("message").setRequired(false).setDescription(i18next.t("commands:welcome.slashBuilder.message")))
            .addStringOption((o) => o.setName("background").setRequired(false).setDescription(i18next.t("commands:welcome.slashBuilder.background")))
            .addBooleanOption((o) => o.setName("exitmesseng").setRequired(false).setDescription(i18next.t("commands:welcome.slashBuilder.exitmesseng")))
            // 2da linea
            .addStringOption((o) => o.setName("stext_text").setRequired(false).setDescription(i18next.t("commands:welcome.slashBuilder.stext_text")))
            .addStringOption((o) => o.setName("stext_color").setRequired(false).setDescription(i18next.t("commands:welcome.slashBuilder.stext_color")))
            .addStringOption((o) => o.setName("stext_font").setAutocomplete(true).setRequired(false).setDescription(i18next.t("commands:welcome.slashBuilder.stext_font")))
            .addIntegerOption((o) => o.setName("stext_size").setRequired(false).setMinValue(10).setMaxValue(110).setDescription(i18next.t("commands:welcome.slashBuilder.stext_size")))
            // 3ra linea
            .addStringOption((o) => o.setName("ttext_text").setRequired(false).setDescription(i18next.t("commands:welcome.slashBuilder.ttext_text")))
            .addStringOption((o) => o.setName("ttext_color").setRequired(false).setDescription(i18next.t("commands:welcome.slashBuilder.ttext_color")))
            .addStringOption((o) => o.setName("ttext_font").setAutocomplete(true).setRequired(false).setDescription(i18next.t("commands:welcome.slashBuilder.ttext_font")))
            .addIntegerOption((o) => o.setName("ttext_size").setRequired(false).setMinValue(10).setMaxValue(110).setDescription(i18next.t("commands:welcome.slashBuilder.ttext_size")))
        )
        .addSubcommand((s) => s.setName("modal_builder")
            .setDescription(i18next.t("commands:welcome.slashBuilder.modal_builder"))
        );
    return [welcomeCommand] as SlashCommandBuilder[];
}

/* ============================================== Autocomplete ============================================== */
export async function fontsAutocomplete(interaction: AutocompleteInteraction) {
    const Az = interaction.options.getFocused();
    const F = fonts.filter(list => list.name.toLowerCase().includes(Az.toLowerCase()));
    await interaction.respond(F.slice(0, 25).map(x => ({ name: x.name, value: x.value })));
}

/* ============================================== Switch  ============================================== */
export async function handleWelcomeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        const isAllowed = await hasPermission(interaction, interaction.commandName);
        if (!isAllowed) { await interaction.editReply({ content: i18next.t("common:Errores.isAllowed") }); return }
        if (!interaction.guild) { await interaction.editReply({ content: i18next.t("common:Errores.noGuild") }); return };

        const guildId = interaction.guild;
        switch (interaction.options.getSubcommand()) {
            case "preview":
                await preview(interaction);
                break;
            case "slash_builder":
                await newSetWwelcome(interaction, guildId);
                break;
            case "modal_builder":
                await welcomeBuilder(interaction, guildId);
                break;
            case "remove":
                await deletWelcome(interaction, guildId);
                break;
            default:
                await interaction.editReply({ content: i18next.t("common.Errores.switchGeneral") });
                break;
        }
    } catch { }
}

/* ============================================== Welcome preview ============================================== */
async function preview(interaction: ChatInputCommandInteraction) {
    try {
        const member = interaction.member as GuildMember;
        const banner = await buildBanner(member);
        if (!banner) { await interaction.editReply({ content: i18next.t("commands:welcome.interacciones.error_banner") }); return; }

        await interaction.editReply({
            content: i18next.t("commands:welcome.interacciones.preview_success"),
            embeds: banner.embeds,
            files: banner.files
        });

    } catch (err) {
        error(`Error en preview de welcome: ${err}`, "WelcomeCommand");
        if (interaction.deferred) {
            await interaction.editReply({ content: i18next.t("commands:welcome.interacciones.error_banner") }).catch(() => { });
        }
    }
}

/* ============================================== Welcome remove ============================================== */
async function deletWelcome(interaction: ChatInputCommandInteraction, guildId: Guild) {
    try {
        await removeWelcome(guildId.id);
        await interaction.editReply(i18next.t("commands:welcome.interacciones.remove_success"));
    } catch (err) {
        error(`Error en removeWelcome: ${err}`, "WelcomeCommand");
        await interaction.editReply({ content: i18next.t("commands:welcome.interacciones.error_remove") });
    }
}

/* ============================================== Welcome slash ============================================== */
async function newSetWwelcome(interaction: ChatInputCommandInteraction, guildId: Guild) {
    try {
        // 1er
        const ftext_text = interaction.options.getString("ftext_text", true);
        const ftext_color = interaction.options.getString("ftext_color", true);
        const ftext_font = interaction.options.getString("ftext_font", true);
        const ftext_size = interaction.options.getInteger("ftext_size", true);
        // data
        const channel = interaction.options.getChannel("channel", true);
        const rcolor = interaction.options.getString("ringcolor", true);
        const message = interaction.options.getString("message", false);
        // 2do
        const stext_text = interaction.options.getString("stext_text", false);
        const stext_color = interaction.options.getString("stext_color", false);
        const stext_font = interaction.options.getString("stext_font", false);
        const stext_size = interaction.options.getInteger("stext_size", false);
        // 3er
        const ttext_text = interaction.options.getString("ttext_text", false);
        const ttext_color = interaction.options.getString("ttext_color", false);
        const ttext_font = interaction.options.getString("ttext_font", false);
        const ttext_size = interaction.options.getInteger("ttext_size", false);
        // background
        const background = interaction.options.getString("background", false);
        const exitmsg = interaction.options.getBoolean("exitmesseng", false);

        const isValidUrl = (url: string): boolean => {
            try { new URL(url); return true; } catch { return false; }
        }
        const isValidHex = (hex: string): boolean => /^#?([0-9A-F]{3}){1,2}$/i.test(hex);

        // 🔥 CORRECCIÓN: Agregamos "return" para detener el código si hay error
        if (!isValidHex(ftext_color)) {
            return void await interaction.editReply({ content: i18next.t("commands:welcome.interacciones.slash_build_error_color") });
        }
        if (stext_color && !isValidHex(stext_color)) {
            return void await interaction.editReply({ content: i18next.t("commands:welcome.interacciones.slash_build_error_color_2do") });
        }
        if (ttext_color && !isValidHex(ttext_color)) {
            return void await interaction.editReply({ content: i18next.t("commands:welcome.interacciones.slash_build_error_color_3er") });
        }
        if (background && background !== 'default' && !isValidUrl(background)) {
            return void await interaction.editReply({ content: i18next.t("commands:welcome.interacciones.slash_build_error_background") });
        }
        if (background && background !== 'default') {
            const x = await isValidBg(background)
            if (!x) { return void await interaction.editReply({ content: i18next.t("commands:welcome.interacciones.slash_build_error_background_format_slash") }) }
        }
        if (!isValidHex(rcolor)) {
            return void await interaction.editReply({ content: i18next.t("commands:welcome.interacciones.slash_build_error_ringcolor") });
        }



        const cleanHex = (hex: string) => hex.startsWith('#') ? hex.slice(1) : hex;

        const newConfig = {
            channelId: channel.id,
            customMessage: message ?? "",
            fText: { text: ftext_text, color: cleanHex(ftext_color), font: ftext_font, size: ftext_size },
            sText: stext_text ? { text: stext_text, color: cleanHex(stext_color ?? "FFFFFF"), font: stext_font ?? "NerkoOne", size: stext_size ?? 40 } : null,
            tText: ttext_text ? { text: ttext_text, color: cleanHex(ttext_color ?? "FFFFFF"), font: ttext_font ?? "NerkoOne", size: ttext_size ?? 30 } : null,
            background: background ?? "default",
            ringcolor: cleanHex(rcolor), // Aseguramos limpiarlo también
            exitmesseng: exitmsg ?? false
        };

        await setNewConfiWelcome(guildId.id, newConfig);
        await interaction.editReply({ content: i18next.t("commands:welcome.interacciones.slash_build_success") });

    } catch (err) {
        error(`Error en newSetWwelcome: ${err}`, "WelcomeCommand");
        await interaction.editReply({ content: i18next.t("commands:welcome.interacciones.slash_build_error") }).catch(() => { });
    }
}

/* ============================================== Welcome dinamico ============================================== */
async function welcomeBuilder(interaction: ChatInputCommandInteraction, guild: Guild) {
    try {
        const ch = interaction.channel;
        const textBasedTypes = [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread];
        if (!ch || !textBasedTypes.includes(ch.type)) { await interaction.editReply({ content: i18next.t("commands:welcome.interacciones.slash_build_error_channel") }); return; }

        let config = await getNewConfiWelcome(guild.id) || {
            channelId: "", customMessage: "",
            fText: { text: "Bienvenido <user>", color: "FFFFFF", font: "NerkoOne", size: 80 },
            sText: null, tText: null, background: "default", ringcolor: "FFFFFF", exitmesseng: false
        };

        if (!config.channelId) { config.channelId = ch.id; }

        let isUrlOk = true; let isColorOk = true
        const updatePanel = async (targetInteraction: any) => {
            const member = interaction.member as GuildMember;
            const exitBtnStyle = config.exitmesseng ? ButtonStyle.Success : ButtonStyle.Danger;
            const exitBtnLabel = config.exitmesseng ? '🟢 Msg Salida' : '🔴 Msg Salida';

            const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('btn_general').setLabel('⚙️ General').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('btn_ftext').setLabel('1️⃣ Texto Principal').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('btn_stext').setLabel('2️⃣ Texto Secundario').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('btn_ttext').setLabel('3️⃣ Texto Terciario').setStyle(ButtonStyle.Primary)
            );

            const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('btn_setch').setLabel('🚩 Anunciar aquí').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('btn_exitmsg').setLabel(exitBtnLabel).setStyle(exitBtnStyle)
            );

            const content = i18next.t("commands:welcome.interacciones.modal_builder_success") + `\n\n` +
                i18next.t("commands:welcome.interacciones.modal_builder_channel", { a1: `<#${config.channelId}>` }) + `\n` +
                i18next.t("commands:welcome.interacciones.modal_builder_exitmsg", { a1: config.exitmesseng ? i18next.t("commands:welcome.interacciones.modal_builder_exitmsg_on") : i18next.t("commands:welcome.interacciones.modal_builder_exitmsg_off") });

            if (!isColorOk) {
                await targetInteraction.editReply({ content: content + `\n` + i18next.t("commands:welcome.interacciones.modal_builder_error_color"), components: [row1, row2] }); isColorOk = true
            } else if (!isUrlOk) {
                await targetInteraction.editReply({ content: content + `\n` + i18next.t("commands:welcome.interacciones.modal_builder_error_banner_format"), components: [row1, row2] }); isUrlOk = true
            } else {
                const banner = await buildBanner(member)
                if (banner) {
                    await targetInteraction.editReply({ content, embeds: banner.embeds, files: banner.files, components: [row1, row2], attachments: [] });
                } else {
                    await targetInteraction.editReply({ content: content + i18next.t("commands:welcome.interacciones.modal_builder_error_no_banner"), components: [row1, row2] });
                }
            }
        };

        await updatePanel(interaction);
        const message = await interaction.fetchReply();
        const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120_000 });
        const isValidHex = (hex: string): boolean => /^#?([0-9A-F]{3}){1,2}$/i.test(hex);

        collector.on('collect', async (i) => {
            if (i.user.id !== interaction.user.id) {
                await i.reply({ content: i18next.t("commands:welcome.interacciones.modal_builder_collector"), flags: MessageFlags.Ephemeral });
                return;
            }

            if (i.customId === 'btn_exitmsg') {
                await i.deferUpdate();
                config.exitmesseng = !config.exitmesseng;
                await setNewConfiWelcome(guild.id, config as any);
                await updatePanel(i);
            }

            if (i.customId === 'btn_setch') {
                await i.deferUpdate();
                config.channelId = ch.id
                await setNewConfiWelcome(guild.id, config as any);
                await updatePanel(i);
            }
            // general
            if (i.customId === 'btn_general') {
                const uniqueId = `modal_general_${Date.now()}`;
                const modal = new ModalBuilder().setCustomId(uniqueId).setTitle(i18next.t("commands:welcome.interacciones.modal_builder_title"));
                const msgInput = new TextInputBuilder().setCustomId('message').setLabel(i18next.t("commands:welcome.interacciones.modal_builder_message")).setStyle(TextInputStyle.Paragraph).setValue(config.customMessage || "").setRequired(false);
                const ring = new TextInputBuilder().setCustomId('ringcolor').setLabel(i18next.t("commands:welcome.interacciones.modal_builder_ringcolor")).setStyle(TextInputStyle.Short).setValue(config.ringcolor || "FFFFFF").setRequired(true);
                const bgInput = new TextInputBuilder().setCustomId('background').setLabel(i18next.t("commands:welcome.interacciones.modal_builder_background")).setStyle(TextInputStyle.Short).setValue(config.background || "default").setRequired(false);

                modal.addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(msgInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(ring),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(bgInput)
                );

                await i.showModal(modal);
                const submitted = await i.awaitModalSubmit({ time: 60_000, filter: x => x.user.id === interaction.user.id && x.customId === uniqueId }).catch(() => null);
                if (submitted) {
                    await submitted.deferUpdate();
                    let bgValue = submitted.fields.getTextInputValue('background');
                    if (bgValue === "") bgValue = "default";
                    if (bgValue !== "default") { const x = await isValidBg(bgValue); if (!x) { isUrlOk = false; await updatePanel(submitted); return } }
                    config.background = bgValue;
                    isUrlOk = true;
                    const ringColor = submitted.fields.getTextInputValue('ringcolor');
                    if (!isValidHex(ringColor)) { isColorOk = false; await updatePanel(submitted); return; } else { isColorOk = true; config.ringcolor = ringColor.startsWith('#') ? ringColor.slice(1) : ringColor; }
                    config.customMessage = submitted.fields.getTextInputValue('message');
                    delete chaBg[guild.id];
                    await setNewConfiWelcome(guild.id, config as any);
                    await updatePanel(submitted);
                }
            }
            // 1er boton
            if (i.customId === 'btn_ftext') {
                const uniqueId = `modal_ftext_${Date.now()}`;
                const modal = new ModalBuilder().setCustomId(uniqueId).setTitle('Editar Texto Principal');
                const textInput = new TextInputBuilder().setCustomId('text').setLabel(i18next.t("commands:welcome.interacciones.modal_builder_text_1b")).setStyle(TextInputStyle.Short).setValue(config.fText?.text || "BIENVENIDO <user>").setRequired(true);
                const colorInput = new TextInputBuilder().setCustomId('color').setLabel(i18next.t("commands:welcome.interacciones.modal_builder_color_1b")).setStyle(TextInputStyle.Short).setValue(config.fText?.color || "FFFFFF").setRequired(true).setMaxLength(7);
                const fontInput = new TextInputBuilder().setCustomId('font').setLabel(i18next.t("commands:welcome.interacciones.modal_builder_font_1b")).setStyle(TextInputStyle.Short).setValue(config.fText?.font || "NerkoOne").setRequired(true);
                const sizeInput = new TextInputBuilder().setCustomId('size').setLabel(i18next.t("commands:welcome.interacciones.modal_builder_size_1b")).setStyle(TextInputStyle.Short).setValue(String(config.fText?.size || 80)).setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(textInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(colorInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(fontInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(sizeInput)
                );

                await i.showModal(modal);
                const submitted = await i.awaitModalSubmit({ time: 60_000, filter: x => x.user.id === interaction.user.id && x.customId === uniqueId }).catch(() => null);
                if (submitted) {
                    await submitted.deferUpdate();
                    const rawColor = submitted.fields.getTextInputValue('color');
                    if (!isValidHex(rawColor)) { isColorOk = false; await updatePanel(submitted); return } else { isColorOk = true; }
                    config.fText = {
                        text: submitted.fields.getTextInputValue('text'),
                        color: rawColor.startsWith('#') ? rawColor.slice(1) : rawColor,
                        font: submitted.fields.getTextInputValue('font'),
                        size: Number(submitted.fields.getTextInputValue('size')) || 80
                    };
                    await setNewConfiWelcome(guild.id, config as any);
                    await updatePanel(submitted);
                }
            }
            // 2do boton
            if (i.customId === 'btn_stext') {
                const uniqueId = `modal_stext_${Date.now()}`;
                const modal = new ModalBuilder().setCustomId(uniqueId).setTitle(i18next.t("commands:welcome.interacciones.modal_builder_title_3b"));
                const textInput = new TextInputBuilder().setCustomId('text').setLabel(i18next.t("commands:welcome.interacciones.modal_builder_text_2b")).setStyle(TextInputStyle.Short).setValue(config.sText?.text || "").setRequired(false);
                const colorInput = new TextInputBuilder().setCustomId('color').setLabel(i18next.t("commands:welcome.interacciones.modal_builder_color_1b")).setStyle(TextInputStyle.Short).setValue(config.sText?.color || "FFFFFF").setRequired(false).setMaxLength(7);
                const fontInput = new TextInputBuilder().setCustomId('font').setLabel(i18next.t("commands:welcome.interacciones.modal_builder_font_1b")).setStyle(TextInputStyle.Short).setValue(config.sText?.font || "NerkoOne").setRequired(false);
                const sizeInput = new TextInputBuilder().setCustomId('size').setLabel(i18next.t("commands:welcome.interacciones.modal_builder_size_2b")).setStyle(TextInputStyle.Short).setValue(String(config.sText?.size || 40)).setRequired(false);

                modal.addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(textInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(colorInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(fontInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(sizeInput)
                );

                await i.showModal(modal);
                const submitted = await i.awaitModalSubmit({ time: 60_000, filter: x => x.user.id === interaction.user.id && x.customId === uniqueId }).catch(() => null);
                if (submitted) {
                    await submitted.deferUpdate();
                    const sTextValue = submitted.fields.getTextInputValue('text');
                    if (!sTextValue || sTextValue.trim() === "") {
                        config.sText = null;
                    } else {
                        const rawColor = submitted.fields.getTextInputValue('color') || "FFFFFF";
                        if (!isValidHex(rawColor)) { isColorOk = false; await updatePanel(submitted); return } else { isColorOk = true; }
                        config.sText = {
                            text: sTextValue,
                            color: rawColor.startsWith('#') ? rawColor.slice(1) : rawColor,
                            font: submitted.fields.getTextInputValue('font') || "NerkoOne",
                            size: Number(submitted.fields.getTextInputValue('size')) || 40
                        };
                    }
                    await setNewConfiWelcome(guild.id, config as any);
                    await updatePanel(submitted);
                }
            }
            // 3er boton
            if (i.customId === 'btn_ttext') {
                const uniqueId = `modal_ttext_${Date.now()}`;
                const modal = new ModalBuilder().setCustomId(uniqueId).setTitle(i18next.t("commands:welcome.interacciones.modal_builder_title_3b"));
                const textInput = new TextInputBuilder().setCustomId('text').setLabel(i18next.t("commands:welcome.interacciones.modal_builder_text_3b")).setStyle(TextInputStyle.Short).setValue(config.tText?.text || "").setRequired(false);
                const colorInput = new TextInputBuilder().setCustomId('color').setLabel(i18next.t("commands:welcome.interacciones.modal_builder_color_1b")).setStyle(TextInputStyle.Short).setValue(config.tText?.color || "FFFFFF").setRequired(false).setMaxLength(7);
                const fontInput = new TextInputBuilder().setCustomId('font').setLabel(i18next.t("commands:welcome.interacciones.modal_builder_font_1b")).setStyle(TextInputStyle.Short).setValue(config.tText?.font || "NerkoOne").setRequired(false);
                const sizeInput = new TextInputBuilder().setCustomId('size').setLabel(i18next.t("commands:welcome.interacciones.modal_builder_size_3b")).setStyle(TextInputStyle.Short).setValue(String(config.tText?.size || 40)).setRequired(false);

                modal.addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(textInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(colorInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(fontInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(sizeInput)
                );

                await i.showModal(modal);
                const submitted = await i.awaitModalSubmit({ time: 60_000, filter: x => x.user.id === interaction.user.id && x.customId === uniqueId }).catch(() => null);
                if (submitted) {
                    await submitted.deferUpdate();
                    const sTextValue = submitted.fields.getTextInputValue('text');
                    if (!sTextValue || sTextValue.trim() === "") {
                        config.tText = null;
                    } else {
                        const rawColor = submitted.fields.getTextInputValue('color') || "FFFFFF";
                        if (!isValidHex(rawColor)) { isColorOk = false; await updatePanel(submitted); return } else { isColorOk = true; }
                        config.tText = {
                            text: sTextValue,
                            color: rawColor.startsWith('#') ? rawColor.slice(1) : rawColor,
                            font: submitted.fields.getTextInputValue('font') || "NerkoOne",
                            size: Number(submitted.fields.getTextInputValue('size')) || 40
                        };
                    }
                    await setNewConfiWelcome(guild.id, config as any);
                    await updatePanel(submitted);
                }
            }
        });
        collector.on('end', () => { interaction.editReply({ components: [] }).catch(() => { }); });
    } catch (err) {
        error(`Error en welcomeBuilder: ${err}`, "WelcomeCommand");
    }
}

/* ============================================== ValidPic ============================================== */
async function isValidBg(imageUrl: string): Promise<boolean> {
    const url = imageUrl.startsWith("http") ? imageUrl : `https://${imageUrl}`;
    const baseUrl = url.split('?')[0].toLowerCase();
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    if (!validExtensions.some(ext => baseUrl.endsWith(ext))) return false;
    const maxBytes = 250 * 1024;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) return false;

        const contentType = response.headers.get('content-type');
        if (!contentType?.startsWith('image/')) {
            controller.abort();
            return false;
        }
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > maxBytes) {
            controller.abort();
            return false;
        }
        if (response.body) {
            const reader = response.body.getReader();
            let downloadedBytes = 0;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value) {
                    downloadedBytes += value.length;
                    if (downloadedBytes > maxBytes) {
                        controller.abort();
                        return false;
                    }
                }
            }
        } else { return false; }
        return true;
    } catch (error) { return false; }
    finally { clearTimeout(timeoutId); }
}