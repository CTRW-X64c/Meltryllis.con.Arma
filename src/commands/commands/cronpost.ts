// src/commands/crontab.ts
import { ChannelType, ChatInputCommandInteraction, EmbedBuilder, Guild, MessageFlags, SlashCommandBuilder, TextChannel } from "discord.js";
import i18next from "i18next";
import { hasPermission } from "../../sys/zGears/mPermission";
import { addCronpost, getCronpost, getMSGPreview, removeCronpost } from "../../sys/DB-Engine/links/Cronpost";
import { programarTarea, detenerTarea } from "../../bgProcess/exeCron";
import { error } from "node:console";
import { testPermisos } from "../../sys/zGears/auxiliares";

const diaList = [
    { name: "Todos los dias", value: "*" },
    { name: "Los domingos", value: "0" },
    { name: "Los lunes", value: "1" },
    { name: "Los martes", value: "2" },
    { name: "Los miercoles", value: "3" },
    { name: "Los jueves", value: "4" },
    { name: "Los viernes", value: "5" },
    { name: "Los sabado", value: "6" }
];

const mont = [
    { name: "Enero", value: "1" },
    { name: "Febrero", value: "2" },
    { name: "Marzo", value: "3" },
    { name: "Abril", value: "4" },
    { name: "Mayo", value: "5" },
    { name: "Junio", value: "6" },
    { name: "Julio", value: "7" },
    { name: "Agosto", value: "8" },
    { name: "Septiembre", value: "9" },
    { name: "Octubre", value: "10" },
    { name: "Noviembre", value: "11" },
    { name: "Diciembre", value: "12" }
];

export async function registerCronpostCommand(): Promise<SlashCommandBuilder[]> {
    const cronpost = new SlashCommandBuilder()
        .setName("cronpost")
        .setDescription(i18next.t("commands:cronpost.slashBuilder.command_descripcion"))
        .addSubcommand(sub => sub
            .setName("crear")
            .setDescription(i18next.t("commands:cronpost.slashBuilder.command_cronpost_crear"))
            .addChannelOption(op =>
                op.setName("canal")
                    .setDescription(i18next.t("commands:cronpost.slashBuilder.command_canal"))
                    .setRequired(true)
                    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
            .addStringOption(op =>
                op.setName("mansaje_id")
                    .setDescription(i18next.t("commands:cronpost.slashBuilder.command_id_mensaje"))
                    .setRequired(true))
            .addIntegerOption(op =>
                op.setName("hora")
                    .setDescription(i18next.t("commands:cronpost.slashBuilder.command_hora"))
                    .setRequired(true)
                    .setMinValue(0)
                    .setMaxValue(23))
            .addIntegerOption(op =>
                op.setName("minuto")
                    .setDescription(i18next.t("commands:cronpost.slashBuilder.command_minuto"))
                    .setRequired(true)
                    .setMinValue(0)
                    .setMaxValue(59))
            .addStringOption(op =>
                op.setName("dia_semana")
                    .setDescription(i18next.t("commands:cronpost.slashBuilder.command_dia_semana"))
                    .setRequired(false)
                    .setChoices(diaList))
            .addStringOption(op =>
                op.setName("mes")
                    .setDescription(i18next.t("commands:cronpost.slashBuilder.command_mes"))
                    .setRequired(false)
                    .addChoices(mont))
            .addIntegerOption(op =>
                op.setName("dia_mes")
                    .setDescription(i18next.t("commands:cronpost.slashBuilder.command_dia_mes"))
                    .setRequired(false)
                    .setMinValue(1)
                    .setMaxValue(31))
        )
        .addSubcommand(sub => sub
            .setName("lista")
            .setDescription(i18next.t("commands:cronpost.slashBuilder.command_lista"))
        )
        .addSubcommand(sub => sub
            .setName("borrar")
            .setDescription(i18next.t("commands:cronpost.slashBuilder.command_borrar"))
            .addIntegerOption(op => op
                .setName("id")
                .setDescription(i18next.t("commands:cronpost.slashBuilder.command_id"))
                .setRequired(true)
            )
        )
        .addSubcommand(sub => sub
            .setName("showpost")
            .setDescription(i18next.t("commands:cronpost.slashBuilder.command_showpost"))
            .addIntegerOption(op => op
                .setName("id")
                .setDescription(i18next.t("commands:cronpost.slashBuilder.command_id_showpost"))
                .setRequired(true)
            )
        );

    return [cronpost] as SlashCommandBuilder[];
}

export async function handleCronPost(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guild = interaction.guild;
    if (!guild) {
        await interaction.editReply(i18next.t("common:Errores.noGuild"));
        return;
    }

    const isAllowed = await hasPermission(interaction, interaction.commandName);
    if (!isAllowed) {
        await interaction.editReply({ content: i18next.t("common:Errores.isAllowed") });
        return;
    }

    const subcomando = interaction.options.getSubcommand();
    switch (subcomando) {
        case "crear":
            await cronPost(interaction, guild); break;
        case "lista":
            await lista(interaction, guild); break;
        case "borrar":
            await borrar(interaction, guild); break;
        case "showpost":
            await showPost(interaction, guild); break;
    }
}

// =============== Add =============== //

async function cronPost(interaction: ChatInputCommandInteraction, guild: Guild) {
    const canalDestino = interaction.options.getChannel("canal", true) as TextChannel;
    const idMsg = interaction.options.getString("mansaje_id", true);
    const hora = interaction.options.getInteger("hora", true);
    const minuto = interaction.options.getInteger("minuto", true);
    const daySem = interaction.options.getString("dia_semana") || "*";
    const mont = interaction.options.getString("mes") || "*";
    const diaMes = interaction.options.getInteger("dia_mes") || null;

    if (!/^\d+$/.test(idMsg)) {
        await interaction.editReply({ content: i18next.t("commands:cronpost.interacciones.formato_id_mensaje_invalido") });
        return;
    }

    const canalOrigen = interaction.channel;
    if (!canalOrigen) {
        await interaction.editReply({ content: i18next.t("commands:cronpost.interacciones.formato_canal_invalido") });
        return;
    }

    const me = canalDestino.permissionsFor(guild.members.me!);
    const myPerm = "viewCh|sendMsg|addlink|addfiles";
    const perChTo = testPermisos(me, myPerm);
    if (perChTo.some(p => p.includes("❌"))) {
        await interaction.editReply({ content: i18next.t("common:Errores.missing_permissions", { a1: `<#${canalDestino.id}>`, a2: perChTo.join("\n") }) });
        return;
    }

    const ownerId = process.env.HOST_DISCORD_USER_ID;
    if (interaction.user.id !== ownerId) {
        const cronReg = await getCronpost(guild.id);
        if (cronReg.length >= 5) {
            await interaction.editReply({
                content: i18next.t("commands:cronpost.interacciones.cron_limit_reached",)
            });
            return;
        }
    }

    const targetMessage = await canalOrigen.messages.fetch(idMsg).catch(() => null);
    if (!targetMessage) {
        await interaction.editReply({
            content: i18next.t("commands:cronpost.interacciones.no_message_found")
        });
        return;
    }

    const adjuntos = Array.from(targetMessage.attachments.values()).map(att => att.url);
    const data_Msg = {
        content: targetMessage.content,
        embeds: targetMessage.embeds.map(emb => emb.toJSON()),
        attachments: adjuntos
    };

    if (!data_Msg.content && data_Msg.embeds.length === 0 && data_Msg.attachments.length === 0) {
        await interaction.editReply({ content: i18next.t("commands:cronpost.interacciones.no_message_content") });
        return;
    }

    try {
        const dayConst = (d: string, m: string) => {
            const dayWeek: Record<string, string> = { "0": "domingo", "1": "lunes", "2": "martes", "3": "miercoles", "4": "jueves", "5": "viernes", "6": "sabado", "*": "días" };
            const months: Record<string, string> = { "1": "enero", "2": "febrero", "3": "marzo", "4": "abril", "5": "mayo", "6": "junio", "7": "julio", "8": "agosto", "9": "septiembre", "10": "octubre", "11": "noviembre", "12": "diciembre", "*": "cada mes" };
            return { day: dayWeek[d], month: months[m] };
        };

        let horaTexto = "";
        let cronExpr = "";
        const { day, month } = dayConst(daySem, mont);
        if (diaMes !== null) {
            horaTexto = i18next.t("commands:cronpost.interacciones.modo_diario", { a1: diaMes, a2: month, a3: hora, a4: minuto.toString().padStart(2, '0') });
            cronExpr = `${minuto} ${hora} ${diaMes} ${mont} *`;
        } else {
            horaTexto = i18next.t("commands:cronpost.interacciones.modo_periodico", { a1: day, a2: hora, a3: minuto.toString().padStart(2, '0') });
            cronExpr = `${minuto} ${hora} * * ${daySem}`;
        }

        const nuevoId = await addCronpost(
            guild.id,
            canalDestino.id,
            cronExpr,
            JSON.stringify(data_Msg),
            horaTexto
        );

        if (!nuevoId) throw new Error("Fallo al guardar en BD");

        programarTarea(interaction.client, {
            id: nuevoId,
            guild_id: guild.id,
            channel_id: canalDestino.id,
            cron: cronExpr,
            mensaje_data: JSON.stringify(data_Msg),
            exec_date: horaTexto
        });

        await interaction.editReply({
            content: i18next.t("commands:cronpost.interacciones.mensaje_guardado", { a1: `<#${canalDestino.id}>`, a2: horaTexto })
        });
    } catch (err) {
        await interaction.editReply({ content: i18next.t("commands:cronpost.interacciones.error_al_guardar") });
    }
}

// =============== List =============== //

async function lista(interaction: ChatInputCommandInteraction, guild: Guild) {
    const dataBD = await getCronpost(guild.id);
    if (!dataBD || dataBD.length === 0) {
        await interaction.editReply({ content: i18next.t("commands:cronpost.interacciones.no_tasks_found") });
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle(i18next.t("commands:cronpost.interacciones.lista_tareas", { a1: guild.name }))
        .setDescription(i18next.t("commands:cronpost.interacciones.setDescripcion", { a1: dataBD.length }))
        .setColor(0x00FF00);

    for (const tarea of dataBD) {
        let preview = i18next.t("commands:cronpost.interacciones.no_preview");

        try {
            const mensajeData = JSON.parse(tarea.mensaje_data);
            if (mensajeData.content) {
                preview = mensajeData.content.length > 60
                    ? mensajeData.content.substring(0, 60) + "..."
                    : mensajeData.content;
            }
        } catch (e) {
            preview = "Error leyendo vista previa";
        }

        embed.addFields({
            name: `🆔 ID: ${tarea.id}`,
            value: i18next.t("commands:cronpost.interacciones.setPreview", { a1: `<#${tarea.channel_id}>`, a2: tarea.exec_date, a3: preview }),
            inline: false
        });
    }

    await interaction.editReply({ embeds: [embed] });
}

// =============== borrar =============== //

async function borrar(interaction: ChatInputCommandInteraction, guild: Guild) {
    const id = interaction.options.getInteger("id", true);

    try {
        const removed = await removeCronpost(guild.id, id);
        if (removed) {
            detenerTarea(id);
            await interaction.editReply({ content: i18next.t("commands:cronpost.interacciones.tarea_borrada", { a1: id }) });
        } else {
            await interaction.editReply({ content: i18next.t("commands:cronpost.interacciones.no_task_found") });
        }
    } catch (e) {
        error(`Error eliminando cronpost: ${e}`);
        await interaction.editReply({ content: i18next.t("commands:cronpost.interacciones.error_al_borrar") });
    }
}

// =============== showpost =============== //

async function showPost(interaction: ChatInputCommandInteraction, guild: Guild) {
    const id = interaction.options.getInteger("id", true);
    const previa = await getMSGPreview(guild.id, id);

    if (!previa) {
        await interaction.editReply({ content: i18next.t("commands:cronpost.interacciones.no_task_found") });
        return;
    }

    try {
        const msgData = JSON.parse(previa.mensaje_data);
        const msgContent: any = {
            content: `**${"=".repeat(15)} VISTA PREVIA ${"=".repeat(15)}**`,
            flags: MessageFlags.Ephemeral
        };

        if (msgData.content) msgContent.content += `\n${msgData.content}`;
        if (msgData.embeds) msgContent.embeds = msgData.embeds;
        if (msgData.attachments) msgContent.files = msgData.attachments;

        await interaction.editReply(msgContent);
    } catch (e) {
        await interaction.editReply({ content: i18next.t("commands:cronpost.interacciones.error_al_procesar_datos") });
    }
}

