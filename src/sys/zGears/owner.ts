// src/Events-Commands/commands/owner.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ModalSubmitInteraction, EmbedBuilder } from "discord.js";
import { debug, error, } from "../logging";
import { Buffer } from 'node:buffer';
import { checkAllDomains, buildDomainStatusEmbed } from "./neTools";

export async function registerOwnerCommands(): Promise<SlashCommandBuilder[]> {
    const leaveServerCommand = new SlashCommandBuilder()
        .setName("owner")
        .setDefaultMemberPermissions(0)
        .setDescription("Comandos de uso exclusivo del Hoster")
        .addStringOption(op =>
            op .setName("funcion")
            .setDescription("Herramienta de administración")
            .setRequired(true)
            .addChoices(
                { name: "Responder reporte", value: "respond" },
                { name: "Lista de servidores", value: "list" },
                { name: "Abandonar servidor", value: "leave" },
                { name: "Revisar dominios (embedServices)", value: "checkdomains" },
                { name: "Reiniciar", value: "restart" }
            )
        )
        .addStringOption(op =>
            op .setName("server_id")
            .setDescription("ID del servidor a abandonar")
            .setRequired(false)
        )
        .addStringOption(op =>
            op .setName("id_usr")
            .setDescription("ID del mensaje a responder")
            .setRequired(false)
        );
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
        serverList += `${guild.name} - ${guild.id}\n`;
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

async function LeaveServer(interaction: ChatInputCommandInteraction): Promise<void> {
    const serverId = interaction.options.getString("server_id");

    if (!serverId) {
        await interaction.reply({
            content: "❌ Debes proporcionar el ID del servidor a abandonar en la opción 'server_id'.",
            flags: MessageFlags.Ephemeral
        });
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
                fetchReply: true
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
        await interaction.reply({
            content: `✅ He abandonado **${guildName}** exitosamente.`,
            flags: MessageFlags.Ephemeral
        });
        debug(`Bot forzado a abandonar el servidor ${guild.name} (${guild.id}) por el dueño.`, "LeaveServerCommand");
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
            } catch {  }
        }
    }
}

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

async function Restart(interaction: ChatInputCommandInteraction): Promise<void> {
    try {         
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await interaction.editReply({
            content: "🔄 Reiniciando el bot..."
        });
        
        process.exit(0);
    } catch (err) { 
        await interaction.editReply({content: "❌ Ocurrió un error inesperado al intentar reiniciar!!."})
        error(`Error en comando restart: ${err}`, "Restart");
    }    
}

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

