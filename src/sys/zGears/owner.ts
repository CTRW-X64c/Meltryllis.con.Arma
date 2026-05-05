// src/Events-Commands/commands/owner.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ModalSubmitInteraction, EmbedBuilder } from "discord.js";
import { debug, error, warn, } from "../logging";
import { Buffer } from 'node:buffer';
import { checkAllDomains, buildDomainStatusEmbed } from "./neTools";
import { deleteGuildConfig } from "./IO-Server";
import { closeBD } from "../DB-Engine/database";
import { getGuildLimits } from "../DB-Engine/links/noRules";
import { adminChannel } from "./auxiliares";

export async function registerOwnerCommands(): Promise<SlashCommandBuilder[]> {
    const leaveServerCommand = new SlashCommandBuilder()
        .setName("owner")
        .setDefaultMemberPermissions(0)
        .setDescription("Comandos de uso exclusivo del Hoster")
        .addStringOption(op =>
            op.setName("funcion")
                .setDescription("Herramienta de administración")
                .setRequired(true)
                .addChoices(
                    { name: "Responder reporte", value: "respond" },
                    { name: "Revisar dominios (embedServices)", value: "checkdomains" },
                    { name: "Lista de servidores", value: "list" },
                    { name: "Parametros de Servers", value: "rules" },
                    { name: "Reiniciar", value: "restart" },
                    { name: "Abandonar servidor", value: "leave" },
                    { name: "Purgar configuracion de server de la BD", value: "purge" }
                )
        )
        .addStringOption(op =>
            op.setName("server_id")
                .setDescription("ID del servidor a abandonar")
                .setRequired(false)
        )
        .addStringOption(op =>
            op.setName("id_usr")
                .setDescription("ID del mensaje a responder")
                .setRequired(false)
        )
    return [leaveServerCommand] as SlashCommandBuilder[];
}

interface runCommands { interaccion: ChatInputCommandInteraction; subcomando: string; serverId: string; idUsr: string }
const waitCommand = new Map<string, runCommands>();
let cacheToken: { token: string } | null = null;

/* ================================================================== Owner ================================================================== */
export async function handleOwnerCommands(interaction: ChatInputCommandInteraction): Promise<void> {
    if (interaction.user.id !== process.env.HOST_DISCORD_USER_ID) {
        await interaction.reply({ content: "Este comando es de uso exclusivo del desarrollador.", flags: MessageFlags.Ephemeral });
        return;
    }

    const subcommand = interaction.options.getString("funcion", true);
    const serverId = interaction.options.getString("server_id") || "nosrv";
    const idUsr = interaction.options.getString("id_usr") || "noid";
    const idUser = interaction.user.id;

    const admCh = await adminChannel(interaction.client);
    if (admCh.upChannel === false || admCh.channelId !== interaction.channelId) {
        await interaction.reply({
            content: "❌ Por seguridad, los comandos de Owner solo se pueden ejecutar en el canal de administración.",
            flags: MessageFlags.Ephemeral
        }); return
    }

    const noTkn = ["restart", "checkdomains", "list"];
    if (noTkn.includes(subcommand)) {
        await runCommand(interaction, subcommand, serverId, idUsr);
        return;
    }

    if (cacheToken !== null) {
        await interaction.reply({ content: "❌ Ya hay un token activo en el sistema. Espera a que expire.", flags: MessageFlags.Ephemeral });
        return;
    }

    const idCommands = `${idUser}_${subcommand}_${serverId}_${idUsr}`;
    const newToken = Math.floor(Math.random() * 0xFFFFFFFFFFFF).toString(16).toUpperCase();

    cacheToken = { token: newToken };
    warn(`🔐 SOLICITUD DE TOKEN GENERADA: ${newToken}`, "SecuritySys");
    waitCommand.set(idCommands, { interaccion: interaction, subcomando: subcommand, serverId: serverId, idUsr: idUsr });

    setTimeout(() => {
        if (waitCommand.has(idCommands)) {
            waitCommand.delete(idCommands);
            cacheToken = null;
            warn(`⚠️ Token expirado y comando purgado de la memoria.`, "SecuritySys");
        }
    }, 5 * 60 * 1000);

    const authModal = new ModalBuilder()
        .setCustomId(`token_verify_${idCommands}`)
        .setTitle("🔐 Verificación de Seguridad")
        .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId("token_input")
                    .setLabel("Revisa la consola e ingresa el token:")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Ej: 1A2B3C4D5E6F")
                    .setRequired(true)
                    .setMinLength(1)
                    .setMaxLength(16)
            )
        );
    await interaction.showModal(authModal);
}

/* ================================================================== Modal ================================================================== */
export async function modalTkn(interaction: ModalSubmitInteraction): Promise<void> {
    const customId = interaction.customId;
    if (!customId.startsWith("token_verify_")) return;
    const commandId = customId.replace("token_verify_", "");
    const pendingCommand = waitCommand.get(commandId);
    if (!pendingCommand) {
        await interaction.reply({
            content: "❌ La sesión de verificación ha expirado. Por favor, ejecute el comando nuevamente.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const providedToken = interaction.fields.getTextInputValue("token_input");
    if (!cacheToken) {
        await interaction.reply({ content: "❌ No hay un token activo o ha expirado. Ejecute el comando nuevamente para generar uno nuevo.", flags: MessageFlags.Ephemeral });
        waitCommand.delete(commandId);
        return;
    }

    if (providedToken !== cacheToken.token) {
        await interaction.reply({ content: "❌ Token incorrecto. Acceso denegado.", flags: MessageFlags.Ephemeral });
        warn(`⚠️ TOKEN INCORRECTO proporcionado por ${interaction.user.tag}`, "SecurityToken");
        waitCommand.delete(commandId);
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    warn(`✅ TOKEN VERIFICADO por ${interaction.user.tag}`, "SecurityToken");
    const { subcomando: subComand, serverId, idUsr } = pendingCommand;
    try {
        await runCommand(interaction, subComand, serverId, idUsr);
        waitCommand.delete(commandId);

        await interaction.editReply({
            content: "✅ Token verificado correctamente. Comando ejecutado con éxito."
        });

    } catch (error) {
        console.error("Error ejecutando comando verificado:", error);
        await interaction.editReply({ content: "❌ Error al ejecutar el comando después de la verificación." });
    }
    waitCommand.delete(commandId);
    cacheToken = null;
    warn("Token eliminado!!!", "SecurityToken")
}
/* ================================================================== runCommands ================================================================== */

async function runCommand(integrations: any, subcommand: string, serverId: string, idUser: string): Promise<void> {
    switch (subcommand) {
        case "respond":
            await respondReport(integrations, idUser); break
        case "checkdomains":
            await ChekDominios(integrations); break
        case "list":
            await ListServers(integrations); break
        case "rules":
            await sendLimitsDashboard(integrations, serverId); break
        case "restart":
            await Restart(integrations); break
        case "leave":
            await LeaveServer(integrations, serverId); break
        case "purge":
            await purgueConfig(integrations, serverId); break
        default:
            await integrations.reply({ content: "Subcomando no reconocido.", flags: MessageFlags.Ephemeral });
    }
}

/* ================================================================== Listado ================================================================== */
async function ListServers(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.deferred) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }
    const guilds = interaction.client.guilds.cache;
    const guildCount = guilds.size;

    if (guildCount === 0) { await interaction.editReply({ content: "No estoy en ningún servidor actualmente." }); return; }

    let serverList = `Lista de Servidores - Total: ${guildCount}\n\n`;
    guilds.forEach(guild => {
        serverList += `Nombre: ${guild.name} | ID: ${guild.id} | Miembros: ${guild.memberCount}\n`;
    });

    const buffer = Buffer.from(serverList, 'utf-8');

    await interaction.editReply({
        content: `**Estoy en ${guildCount} servidores:**\n\n📁 Aquí tienes la lista completa.`,
        files: [{
            attachment: buffer,
            name: `servers.txt`
        }],
    });

    debug(`Lista de servidores generada para el dueño. Total: ${guildCount}`, "LeaveServerCommand");
}

/* ================================================================== Leave Servers ================================================================== */
async function LeaveServer(interaction: ChatInputCommandInteraction, serverId: string): Promise<void> {
    if (!interaction.deferred) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }
    if (serverId === "nosrv") { await interaction.editReply({ content: "❌ Debes proporcionar el ID del servidor a abandonar en la opción 'server_id'." }); return; }
    if (!/^\d+$/.test(serverId)) { await interaction.editReply({ content: "❌ El ID del servidor debe contener solo números." }); return; }

    try {
        const guild = await interaction.client.guilds.fetch(serverId).catch(() => null);
        if (!guild) { await interaction.editReply({ content: `❌ No se encontró ningún servidor con el ID: \`${serverId}\`` }); return; }

        const guildName = guild.name;
        const guildInfo = {
            name: guild.name,
            id: guild.id,
            memberCount: guild.memberCount,
            ownerId: (guild as any).ownerId,
        };

        if (guildInfo.memberCount > 100) {
            const confirmButton = new ButtonBuilder()
                .setCustomId('confirm_leave')
                .setLabel('Confirmar Salida')
                .setStyle(ButtonStyle.Danger);

            const cancelButton = new ButtonBuilder()
                .setCustomId('cancel_leave')
                .setLabel('Cancelar Salida')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);
            const confirmationMessage = await interaction.editReply({
                content: `⚠️ **¿Estás seguro?**\nVas a hacer que el bot abandone un servidor grande:\n**${guild.name}** (${guild.id})\n👥 ${guild.memberCount} miembros`,
                components: [row],
            });

            try {
                const confirmation = await (confirmationMessage as any).awaitMessageComponent({
                    filter: (i: ButtonInteraction) => i.user.id === interaction.user.id,
                    componentType: ComponentType.Button,
                    time: 60_000
                });

                if (confirmation.customId === 'confirm_leave') {
                    await guild.leave();
                    await confirmation.update({ content: `✅ He abandonado **${guildName}** exitosamente.`, components: [] });
                } else {
                    await confirmation.update({ content: '❌ Salida cancelada.', components: [] });
                }
            } catch (err: any) {
                if (err?.message?.includes("time") || err?.message?.includes("collector")) {
                    try {
                        await interaction.followUp({ content: '⌛ Tiempo de confirmación agotado. Operación cancelada.', flags: MessageFlags.Ephemeral });
                    } catch { /* ignore follow-up errors */ }
                } else {
                    throw err;
                }
            }
            return;
        }

        await guild.leave();
        await interaction.editReply({ content: `✅ He abandonado **${guildName}** exitosamente.` });
        cacheToken = null;
        warn(`Token utilizado y borrado; se abandono el servidor: ${guild.name} (${guild.id})`, "LeaveServerCommand")
    } catch (err: any) {
        error(`Error al intentar abandonar el servidor ${serverId}: ${err}`, "LeaveServerCommand");

        let errorMessage = `❌ Error al intentar abandonar el servidor con ID \`${serverId}\`.`;

        if (err?.code === 10004) {
            errorMessage += "\n⚠️ El bot no está en este servidor o el ID es incorrecto.";
        } else if (err?.code === 50001) {
            errorMessage += "\n⚠️ No tengo permisos para abandonar este servidor.";
        } else if (err?.message?.includes("Missing Access")) {
            errorMessage += "\n⚠️ No tengo permisos para acceder a este servidor.";
        }

        try {
            await interaction.editReply({
                content: errorMessage,
            });
        } catch {
            try {
                await interaction.followUp({
                    content: errorMessage,
                    flags: MessageFlags.Ephemeral
                });
            } catch { }
        }
    }
}

/* ================================================================== Dominios ================================================================== */
export async function ChekDominios(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.deferred) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }
    try {
        await interaction.editReply({
            content: "🔄 Verificando estado de dominios (Comando Owner)..."
        });
        const domainStatuses = await checkAllDomains();
        const embed = buildDomainStatusEmbed(domainStatuses);
        await interaction.editReply({ content: null, embeds: [embed] });

    } catch (err: any) {
        error(`Error en comando checkdomains: ${err}`, "CheckDomains");

        if (err.message.includes("No se encontraron variables")) {
            await interaction.editReply({
                content: "❌ No se encontraron variables *_FIX_URL en .env",
            });
        } else {
            await interaction.editReply({
                content: "❌ Ocurrió un error inesperado al procesar el comando.",
            });
        }
    }
}

/* ================================================================== Reinico ================================================================== */
async function Restart(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.deferred) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }
    const confirmButton = new ButtonBuilder()
        .setCustomId('confirm_restart')
        .setLabel('Confirmar Reinicio')
        .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
        .setCustomId('cancel_restart')
        .setLabel('Cancelar Reinicio')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);
    const confMsg = await interaction.editReply({
        content: `⚠️ **¿Estás seguro?**\nVas a reiniciar el bot.`,
        components: [row],
    });

    try {
        const passMsg = confMsg.awaitMessageComponent({
            filter: (i: ButtonInteraction) => i.user.id === interaction.user.id,
            componentType: ComponentType.Button,
            time: 60_000
        });

        const confirmation = await passMsg;

        if (confirmation.customId === 'confirm_restart') {
            await confirmation.update({ content: '🔄 Reiniciando...', components: [] });
            warn(`SERVIDOR REINICADO!! ${confirmation.user.tag}`, "Restart");
            const offBd = closeBD
            if (!offBd) {
                await interaction.followUp({ content: "No se pudo cerrar las conexiones con la BD!! \n Abortando Reinicio!!", flags: MessageFlags.Ephemeral });
                return;
            } else {
                process.exit(0);
            }
        } else {
            await confirmation.update({ content: '❌ Reinicio cancelado.', components: [] });
            warn(`SE CANCELO EL REINICIO DEL SERVIDOR!!`, "Restart");
        }
    } catch (err) {
        await interaction.editReply({ content: "❌ Ocurrió un error inesperado al intentar reiniciar!!." })
        error(`Error en comando restart: ${err}`, "Restart");
    }
}

async function respondReport(interaction: ChatInputCommandInteraction, idUser: string): Promise<void> {
    if (idUser === "noid") {
        await interaction.editReply({ content: "❌ Faltó el ID del usuario a responder en la opción 'id_usr'." });
        return;
    }
    const idUserChek = await interaction.client.users.fetch(idUser).catch(() => null);
    if (!idUserChek) {
        await interaction.editReply({ content: "❌ No se pudo encontrar al usuario." });
        return;
    }

    const btnOpenReport = new ButtonBuilder()
        .setCustomId(`btn_openreport_${idUser}`)
        .setLabel('Escribir Respuesta')
        .setEmoji('📝')
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(btnOpenReport);
    await interaction.editReply({
        content: `✅ Usuario encontrado: **${idUserChek.tag}**.\nHaz clic en el botón para redactar tu mensaje.`,
        components: [row]
    });
}

export async function respondReportModal(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const respondMsg = interaction.fields.getTextInputValue('reportcont');
    const idUser = interaction.customId.split('_')[1];

    try {
        const targetUser = await interaction.client.users.fetch(idUser).catch(() => null);
        if (!targetUser) {
            await interaction.editReply({ content: "❌ No se pudo encontrar al usuario para enviar la respuesta." });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle("Respuesta de Soporte")
            .setDescription(respondMsg)
            .setColor(0x00FF00)
            .setTimestamp();

        await targetUser.send({ embeds: [embed] });
        await interaction.editReply({ content: `✅ Respuesta enviada a **${targetUser.tag}**.` });
    } catch (err) {
        error(`Error en respondReportModal: ${err}`, "OwnerCommands");
        await interaction.editReply({ content: "❌ Error al enviar la respuesta. ¿Tiene el usuario los DMs cerrados?" });
    }
}

/* ================================================================== BD purge COnfig ================================================================== */
async function purgueConfig(interaction: ChatInputCommandInteraction, idServer: string) {
    if (!interaction.deferred) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }
    if (idServer === "nosrv") { await interaction.editReply({ content: "❌ No se proporcionó el ID del servidor a purgar." }); return }
    const guild = await interaction.client.guilds.fetch(idServer).catch(() => null);
    const chkIdServer = guild ? guild.id : { id: idServer } as any;
    let msgPurg = guild ? `⚠️ SE INICIARA LA PURGA DE BASE DE DATOS DEL SERVIDOR: **${guild.name}** | (${guild.id})` : `⚠️ SE PURGARA UN SERVIDOR QUE YA NO EXISTE, ID: ${idServer}!!`;

    const confirmButton = new ButtonBuilder()
        .setCustomId('confirm_purga')
        .setLabel('PURGAR BD')
        .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
        .setCustomId('abort_purga')
        .setLabel('Cancelar')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);
    const confMsg = await interaction.editReply({
        content: msgPurg,
        components: [row]
    });

    try {
        const passMsg = confMsg.awaitMessageComponent({
            filter: (i: ButtonInteraction) => i.user.id === interaction.user.id,
            componentType: ComponentType.Button,
            time: 60_000
        });

        const confirmation = await passMsg;

        if (confirmation.customId === 'confirm_purga') {
            await deleteGuildConfig(chkIdServer);

            await confirmation.update({ content: `✅ Limpieza de base de datos completada para el ID: \`${idServer}\``, components: [] });
            cacheToken = null;
            warn(`Token usado y borrado; se purgó la configuración del servidor: ${idServer}`, "PurgeConfig");
        } else {
            await confirmation.update({ content: '❌ Purga cancelada.', components: [] });
            warn(`SE CANCELÓ LA PURGA DEL SERVIDOR: ${idServer}`, "PurgeConfig");
        }
    } catch (err: any) {
        if (err.message.includes("time") || err.message.includes("collector")) {
            await interaction.editReply({ content: "⌛ Tiempo agotado. Purga cancelada.", components: [] });
        } else {
            await interaction.editReply({ content: "❌ Ocurrió un error inesperado al intentar purgar la base de datos.", components: [] });
            error(`Error en comando purge: ${err}`, "PurgeConfig");
        }
    }
}

/* ================================================================== setLimitsModal ================================================================== */
export async function sendLimitsDashboard(interaction: ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction, idGuild: string) {
    if (interaction.isButton && interaction.isButton()) {
        await interaction.deferUpdate();
    } else {
        if (!interaction.deferred) await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    const guild = await interaction.client.guilds.fetch(idGuild).catch(() => null);
    const limits = await getGuildLimits(idGuild);
    const embed = new EmbedBuilder()
        .setTitle(`🛠️ Panel de Límites | Servidor: ${guild?.name || idGuild}`)
        .setColor('Blue')
        .addFields(
            { name: '📊 Límites Numéricos', value: `> **Cronjobs:** ${limits.cronLimited}\n> **MangaDex:** ${limits.dexMax}\n> **Reddit:** ${limits.redMax}\n> **YouTube:** ${limits.ytMax}` },
            { name: '⚙️ Permisos Especiales', value: `> **Check Domain:** ${limits.chkDomain ? '✅' : '❌'}\n> **No Wait Node:** ${limits.noWaitNode ? '✅' : '❌'}` }
        );

    const btnEdit = new ButtonBuilder()
        .setCustomId(`lim_edit_${idGuild}`)
        .setLabel('Editar Números')
        .setEmoji('📝')
        .setStyle(ButtonStyle.Primary);
    const btnDomain = new ButtonBuilder()
        .setCustomId(`lim_togdom_${idGuild}`)
        .setLabel('Toggle Domain')
        .setStyle(ButtonStyle.Secondary);
    const btnNode = new ButtonBuilder()
        .setCustomId(`lim_tognode_${idGuild}`)
        .setLabel('Toggle Node')
        .setStyle(ButtonStyle.Secondary);
    const btnReset = new ButtonBuilder()
        .setCustomId(`lim_reset_${idGuild}`)
        .setLabel('Reiniciar Límites')
        .setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(btnEdit, btnDomain, btnNode, btnReset);
    await interaction.editReply({ embeds: [embed], components: [row] });
}