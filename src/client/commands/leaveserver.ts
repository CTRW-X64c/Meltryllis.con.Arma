// src/client/commands/leaveserver.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags } from "discord.js";
import { debug, error } from "../../logging";
import { Buffer } from 'node:buffer';

export async function registerLeaveServerCommand(): Promise<SlashCommandBuilder[]> {
    const leaveServerCommand = new SlashCommandBuilder()
        .setName("leaveserver")
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

export async function handleLeaveServerCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (interaction.user.id !== process.env.OWNER_BOT_ID) {
        await interaction.reply({
            content: "Este comando es de uso exclusivo del desarrollador del bot.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }
//Testeando switch para subcomandos
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
        const guild = await interaction.client.guilds.fetch(serverId);

        if (!guild) {
            await interaction.reply({
                content: `❌ No se encontró ningún servidor con el ID: \`${serverId}\``,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const guildInfo = {
            name: guild.name,
            id: guild.id,
            memberCount: guild.memberCount,
            ownerId: guild.ownerId,
        };

        if (guildInfo.memberCount > 100) {
            await interaction.reply({
                content: `⚠️ **¿Estás seguro?**\nVas a hacer que el bot abandone:\n**${guildInfo.name}**\n👥 ${guildInfo.memberCount} miembros\n🆔 ${guildInfo.id}\n\n**Responde con** \`/leaveserver leave ${serverId}\` **de nuevo para confirmar.**`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        await guild.leave();

        await interaction.reply({
            content: `✅ **He abandonado el servidor exitosamente**\n📛 **Nombre:** ${guildInfo.name}\n🆔 **ID:** ${guildInfo.id}\n👥 **Miembros:** ${guildInfo.memberCount}\n`,
            flags: MessageFlags.Ephemeral
        });

        debug(`Bot forzado a abandonar el servidor ${guildInfo.name} (${guildInfo.id}) por el dueño. Miembros: ${guildInfo.memberCount}`, "LeaveServerCommand");

    } catch (err: any) {
        error(`Error al intentar abandonar el servidor ${serverId}: ${err}`, "LeaveServerCommand");
        
        let errorMessage = `❌ Error al intentar abandonar el servidor con ID \`${serverId}\`.`;
        
        if (err.code === 10004) { // Unknown Guild
            errorMessage += "\n⚠️ El bot no está en este servidor o el ID es incorrecto.";
        } else if (err.code === 50001) { // Missing Access
            errorMessage += "\n⚠️ No tengo permisos para abandonar este servidor.";
        } else if (err.message?.includes("Missing Access")) {
            errorMessage += "\n⚠️ No tengo permisos para acceder a este servidor.";
        }

        await interaction.reply({
            content: errorMessage,
            flags: MessageFlags.Ephemeral
        });
    }
}