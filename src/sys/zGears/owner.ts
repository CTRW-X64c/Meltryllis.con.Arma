// src/Events-Commands/commands/owner.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ModalSubmitInteraction, EmbedBuilder } from "discord.js";
import { debug, error, warn, } from "../logging";
import { Buffer } from 'node:buffer';
import { checkAllDomains, buildDomainStatusEmbed } from "./neTools";
import { deleteGuildConfig } from "./IO-Server";
import { closeBD } from "../DB-Engine/database";
import { getGuildLimits, /*setGuildLimits*/ } from "../DB-Engine/links/noRules";

/*const listcommands = [
    { name: "/cronJobs", value: "1" },
    { name: "/mangaDex", value: "2" },
    { name: "/reddit", value: "3" },
    { name: "/youtube", value: "4" },
    { name: "/chkDomainds", value: "5" },
    { name: "lavaLink", value: "6" },
]*/

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
                    { name: "Limites de servidores", value: "rules" },
                    { name: "Reiniciar", value: "restart" },
                    { name: "Generar token", value: "tkn" },
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
        .addStringOption(op =>
            op.setName("token")
                .setDescription("Token de reinicio")
                .setRequired(false)
        )/*
        .addBooleanOption(op =>
            op.setName("boleanos")
                .setDescription("Comandos de limite on/off")
                .setRequired(false)
        )
        .addIntegerOption(op =>
            op.setName("valor")
                .setDescription("limite numerico")
                .setRequired(false)
        )
        .addStringOption(op =>
            op.setName("comando")
                .setDescription("Lista de comandos con limite")
                .setRequired(false)
                .addChoices(listcommands)
        )*/
    return [leaveServerCommand] as SlashCommandBuilder[];
}

export async function handleOwnerCommands(interaction: ChatInputCommandInteraction): Promise<void> {
    if (interaction.user.id !== process.env.HOST_DISCORD_USER_ID) {
        await interaction.reply({
            content: "Este comando es de uso exclusivo del desarrollador.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }
    const subcommand = interaction.options.getString("funcion", true);
    const serverId = interaction.options.getString("server_id") || "";
    const token = interaction.options.getString("token") || "";
    try {
        switch (subcommand) {
            case "list":
                await ListServers(interaction);
                break;

            case "leave":
                await LeaveServer(interaction);
                break;

            case "checkdomains":
                await ChekDominios(interaction);
                break;

            case "restart":
                await Restart(interaction)
                break;

            case "respond":
                await respondReport(interaction)
                break;

            case "tkn":
                await generateToken(interaction)
                break;

            case "purge":
                await purgueConfig(interaction)
                break;
            case "rules":
                await sendLimitsDashboard(interaction, serverId, token)
                break;
            default:
                await interaction.reply({
                    content: "Subcomando no reconocido.",
                    flags: MessageFlags.Ephemeral
                });
        }
    } catch (err) {
        error(`Error en comando leaveserver (${subcommand}): ${err}`, "LeaveServerCommand");
        await interaction.reply({
            content: "Ocurrió un error inesperado al procesar el comando.",
            flags: MessageFlags.Ephemeral
        });
    }
}

/* ================================================================== Tkn Chek ================================================================== */

let cacheToken: { token: string } | null = null;
const tknChek = (rToken: string | null): { valid: boolean; error?: string } => {
    if (!rToken) return { valid: false, error: "❌ No se proporciono un token." };
    if (!cacheToken?.token) return { valid: false, error: "❌ No hay un token activo, genera uno con `/owner: Generar token`" };
    if (rToken !== cacheToken.token) return { valid: false, error: "❌ Token equivocado!!" };
    return { valid: true };
};

/* ================================================================== Listado ================================================================== */

async function ListServers(interaction: ChatInputCommandInteraction): Promise<void> {
    const guilds = interaction.client.guilds.cache;
    const guildCount = guilds.size;

    if (guildCount === 0) {
        await interaction.reply({
            content: "No estoy en ningún servidor actualmente.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    let serverList = `Lista de Servidores - Total: ${guildCount}\n\n`;
    guilds.forEach(guild => {
        serverList += `Nombre: ${guild.name} | ID: ${guild.id} | Miembros: ${guild.memberCount}\n`;
    });

    const buffer = Buffer.from(serverList, 'utf-8');

    await interaction.reply({
        content: `**Estoy en ${guildCount} servidores:**\n\n📁 Aquí tienes la lista completa.`,
        files: [{
            attachment: buffer,
            name: `servers.txt`
        }],
        flags: MessageFlags.Ephemeral
    });

    debug(`Lista de servidores generada para el dueño. Total: ${guildCount}`, "LeaveServerCommand");
}

/* ================================================================== Leave Servers ================================================================== */

async function LeaveServer(interaction: ChatInputCommandInteraction): Promise<void> {
    const serverId = interaction.options.getString("server_id");

    if (!serverId) {
        await interaction.reply({
            content: "❌ Debes proporcionar el ID del servidor a abandonar en la opción 'server_id'.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const rToken = interaction.options.getString("token") ?? null;
    const chkTkn = tknChek(rToken);
    if (!chkTkn.valid) {
        await interaction.reply({ content: chkTkn.error, flags: MessageFlags.Ephemeral });
        return;
    }

    if (!/^\d+$/.test(serverId)) {
        await interaction.reply({
            content: "❌ El ID del servidor debe contener solo números.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    try {
        const guild = await interaction.client.guilds.fetch(serverId).catch(() => null);

        if (!guild) {
            await interaction.reply({
                content: `❌ No se encontró ningún servidor con el ID: \`${serverId}\``,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

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
            const confirmationMessage = await interaction.reply({
                content: `⚠️ **¿Estás seguro?**\nVas a hacer que el bot abandone un servidor grande:\n**${guild.name}** (${guild.id})\n👥 ${guild.memberCount} miembros`,
                components: [row],
                flags: MessageFlags.Ephemeral,
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
        await interaction.reply({ content: `✅ He abandonado **${guildName}** exitosamente.`, flags: MessageFlags.Ephemeral });
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
            await interaction.reply({
                content: errorMessage,
                flags: MessageFlags.Ephemeral
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
    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        await interaction.editReply({
            content: "🔄 Verificando estado de dominios (Comando Owner)..."
        });

        // 2. Llama a la lógica centralizada
        const domainStatuses = await checkAllDomains();

        // 3. Llama al constructor de embeds
        const embed = buildDomainStatusEmbed(domainStatuses);

        await interaction.editReply({
            content: null,
            embeds: [embed]
        });

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
    const confirmButton = new ButtonBuilder()
        .setCustomId('confirm_restart')
        .setLabel('Confirmar Reinicio')
        .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
        .setCustomId('cancel_restart')
        .setLabel('Cancelar Reinicio')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);
    const confMsg = await interaction.reply({
        content: `⚠️ **¿Estás seguro?**\nVas a reiniciar el bot.`,
        components: [row],
        flags: MessageFlags.Ephemeral
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

/* ================================================================== Systema de Reportes ================================================================== */

async function respondReport(interaction: ChatInputCommandInteraction): Promise<void> {
    const idUser = interaction.options.getString("id_usr");
    if (!idUser) {
        await interaction.reply({ content: "❌ Faltó el ID del usuario a responder en la opción 'id_usr'.", flags: MessageFlags.Ephemeral });
        return;
    }

    const idUserChek = await interaction.client.users.fetch(idUser).catch(() => null);
    if (!idUserChek) {
        await interaction.reply({ content: "❌ No se pudo encontrar al usuario.", flags: MessageFlags.Ephemeral });
        return;
    }

    const reportModal = new ModalBuilder()
        .setCustomId(`respondReport_${idUser}`)
        .setTitle(`Respuesta de reporte`);

    const repIn = new TextInputBuilder()
        .setCustomId(`reportcont`)
        .setLabel("Escribe tu respuesta:")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    const rMod = new ActionRowBuilder<TextInputBuilder>().addComponents(repIn);
    reportModal.addComponents(rMod);

    await interaction.showModal(reportModal);
}

export async function respondReportModal(interaction: ModalSubmitInteraction): Promise<void> {
    const respondMsg = interaction.fields.getTextInputValue('reportcont');
    const idUser = interaction.customId.split('_')[1];

    try {
        const targetUser = await interaction.client.users.fetch(idUser).catch(() => null);

        if (!targetUser) {
            await interaction.reply({ content: "❌ No se pudo encontrar al usuario para enviar la respuesta.", flags: MessageFlags.Ephemeral });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle("Respuesta de Soporte")
            .setDescription(respondMsg)
            .setColor(0x00FF00)
            .setTimestamp();

        await targetUser.send({ embeds: [embed] });
        await interaction.reply({ content: `✅ Respuesta enviada a **${targetUser.tag}**.`, flags: MessageFlags.Ephemeral });

    } catch (err) {
        error(`Error en respondReportModal: ${err}`, "OwnerCommands");
        await interaction.reply({ content: "❌ Error al enviar la respuesta. ¿Tiene el usuario los DMs cerrados?", flags: MessageFlags.Ephemeral });
    }
}

/* ================================================================== System ================================================================== */

async function generateToken(interaction: ChatInputCommandInteraction): Promise<void> {
    if (cacheToken === null) {
        const newToken = Math.floor(Math.random() * 0xFFFFFFFFFFFF).toString(16).toUpperCase();
        cacheToken = { token: newToken };
        warn(`solicitud de token ${newToken}`, "tokenSys")
        await interaction.reply({ content: "Token generado, revisa la consola. Expira en 5 minutos.", flags: MessageFlags.Ephemeral });
        setTimeout(() => { cacheToken = null; warn(`token expirado`, "tokenSys"); }, 5 * 60 * 1000);
    } else {
        await interaction.reply({ content: "Ya hay un token activo en el sistema.", flags: MessageFlags.Ephemeral });
    }
};

/* ================================================================== BD purge COnfig ================================================================== */

async function purgueConfig(interaction: ChatInputCommandInteraction) {
    const idServer = interaction.options.getString("server_id");
    if (!idServer) {
        await interaction.reply({ content: "❌ No se proporcionó el ID del servidor a purgar.", flags: MessageFlags.Ephemeral });
        return;
    }

    const rToken = interaction.options.getString("token") ?? null;
    const chkTkn = tknChek(rToken);
    if (!chkTkn.valid) {
        await interaction.reply({ content: chkTkn.error, flags: MessageFlags.Ephemeral });
        return;
    }

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
    const confMsg = await interaction.reply({
        content: msgPurg,
        components: [row],
        flags: MessageFlags.Ephemeral
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

/* ================================================================== demasidos opciones ================================================================== */
/*
async function setLimits(interaction: ChatInputCommandInteraction) {
    const guildLimit = interaction.options.getString("server_id");
    const comando = interaction.options.getString("comando");
    const commBoleano = interaction.options.getBoolean("boleanos");
    const commNumer = interaction.options.getInteger("valor");

    if (!guildLimit) {
        await interaction.reply({ content: "❌ Debes proporcionar el ID del servidor.", flags: MessageFlags.Ephemeral });
        return;
    }

    const verifiGuild = await interaction.client.guilds.fetch(guildLimit).catch(() => null);
    if (!verifiGuild) { await interaction.reply({ content: "❌ No existe el servidor o no tengo acceso.", flags: MessageFlags.Ephemeral }); return; }

    const limits = await getGuildLimits(verifiGuild.id);

    if (!comando && commBoleano === null && commNumer === null) {
        const embed = new EmbedBuilder()
            .setTitle(`🛠️ Panel de Límites | Servidor: ${verifiGuild.name}`)
            .setColor('Blue')
            .addFields(
                { name: '📊 Límites Numéricos', value: `> **Cronjobs:** ${limits.cronLimited}\n> **MangaDex:** ${limits.dexMax}\n> **Reddit:** ${limits.redMax}\n> **YouTube:** ${limits.ytMax}` },
                { name: '⚙️ Permisos Especiales', value: `> **Check Domain:** ${limits.chkDomain ? '✅' : '❌'}\n> **No Wait Node:** ${limits.noWaitNode ? '✅' : '❌'}` }
            );
        await interaction.reply({ embeds: [embed] });
        return;
    }

    const updates: any = {};
    switch (comando) {
        case "1": updates.cronLimited = commNumer; break;
        case "2": updates.dexMax = commNumer; break;
        case "3": updates.redMax = commNumer; break;
        case "4": updates.ytMax = commNumer; break;
        case "5": updates.chkDomain = commBoleano; break;
        case "6": updates.noWaitNode = commBoleano; break;
        default: await interaction.reply({ content: "❌ Comando no reconocido.", flags: MessageFlags.Ephemeral }); return;
    }

    const newLimits = await setGuildLimits(verifiGuild.id, updates);

    const updatedEmbed = new EmbedBuilder()
        .setTitle(`✅ Límites Actualizados | Servidor: ${verifiGuild.name}`)
        .setColor('Green')
        .addFields(
            { name: '📊 Límites Numéricos', value: `> **Cronjobs:** ${newLimits.cronLimited}\n> **MangaDex:** ${newLimits.dexMax}\n> **Reddit:** ${newLimits.redMax}\n> **YouTube:** ${newLimits.ytMax}` },
            { name: '⚙️ Permisos Especiales', value: `> **Check Domain:** ${newLimits.chkDomain ? '✅' : '❌'}\n> **No Wait Node:** ${newLimits.noWaitNode ? '✅' : '❌'}` }
        );

    await interaction.reply({ embeds: [updatedEmbed] });
}
*/
/* ================================================================== setLimitsModal ================================================================== */

export async function sendLimitsDashboard(interaction: any, idGuild: string, tkng: string) {
    if (interaction.isButton && interaction.isButton()) {
        await interaction.deferUpdate();
    } else if (interaction.isCommand && interaction.isCommand()) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    if (idGuild === "") { await interaction.editReply({ content: "No se especificó el ID del servidor!!" }); return; }
    if (tknChek(tkng).valid === false) { await interaction.editReply({ content: tknChek(tkng).error }); return; }

    const verifiGuild = await interaction.client.guilds.fetch(idGuild).catch(() => null);
    const limits = await getGuildLimits(idGuild);
    const embed = new EmbedBuilder()
        .setTitle(`🛠️ Panel de Límites | Servidor: ${verifiGuild.name}`)
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

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(btnEdit, btnDomain, btnNode);
    await interaction.editReply({ embeds: [embed], components: [row] });
}