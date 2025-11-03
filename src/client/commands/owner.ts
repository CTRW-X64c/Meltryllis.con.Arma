// src/client/commands/owner.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ButtonInteraction } from "discord.js";
import { debug, error } from "../../sys/logging";
import { Buffer } from 'node:buffer';

export async function registerOwnerCommands(): Promise<SlashCommandBuilder[]> {
    const leaveServerCommand = new SlashCommandBuilder()
        .setName("owner")
        .setDescription("Comando exclusivo del dueño para gestionar servidores del bot.")
        .addSubcommand(subcommand =>
            subcommand
                .setName("list")
                .setDescription("Enumera todos los servidores en los que está el bot.")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("leave")
                .setDescription("Hace que el bot abandone un servidor específico.")
                .addStringOption(option =>
                    option
                        .setName("server_id")
                        .setDescription("ID del servidor que el bot debe abandonar.")
                        .setRequired(true)
                )
        );
    return [leaveServerCommand] as SlashCommandBuilder[];
}

export async function handleOwnerCommands(interaction: ChatInputCommandInteraction): Promise<void> {
    if (interaction.user.id !== process.env.OWNER_BOT_ID) {
        await interaction.reply({
            content: "Este comando es de uso exclusivo del desarrollador.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const subcommand = interaction.options.getSubcommand();
    try {
        switch (subcommand) {
            case "list":
                await ListServers(interaction);
                break;
            
            case "leave":
                await LeaveServer(interaction);
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
    const serverId = interaction.options.getString("server_id", true);
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