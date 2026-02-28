// src/sys/zGears/IO-Server.ts 
import { Client, Events, Guild, TextChannel, EmbedBuilder } from "discord.js";
import { info, error } from "../logging";
import { ChannelReports } from "./auxiliares"; 
import { removeVoiceConfig } from "../DB-Engine/links/JointoVoice";
import { clearGuildPermissions } from "../DB-Engine/links/Permission";
import { removeWelcomeConfig } from "../DB-Engine/links/Welcome"; 
import { deleteAllEmbedConfig } from "../DB-Engine/links/Embed";
import { delleteAllMangadexConfig } from "../DB-Engine/links/Mangadex";
import { delleteAllRedditConfig } from "../DB-Engine/links/Reddit";
import { delleteAllReplyBotsConfig } from "../DB-Engine/links/ReplyBots";
import { delleteAllRolemojiConfig } from "../DB-Engine/links/Rolemoji";
import { deleteAllYoutubeConfig } from "../DB-Engine/links/Youtube";


/* ================================================ Inicializacion de cliente ================================================ */

export default async function registerIOevent(client: Client): Promise<void> {
  try {
    client.on(Events.GuildCreate, async (guild: Guild) => {
      await handleGuildCreate(guild);
    });
    info(`✅ Iniciado evento "GuildCreate" (Entrada de servidores)`, "IOServer");

    client.on(Events.GuildDelete, async (guild: Guild) => {
      await handleGuildDelete(guild);
    });
    info(`✅ Iniciado evento "GuildDelete" (Salida de servidores)`, "IOServer");
  } catch (e) {
    error(`Error al registrar los eventos de E/S de servidores: ${e}`, "IOServer");
  }
}

/* ================================================ Registrador de entradas ================================================ */

async function handleGuildCreate(guild: Guild): Promise<void> {
  try {
    info(`📥 Me uni al servidor: ${guild.name} (ID: ${guild.id})`, "GuildCreate");        
    const owner = await guild.fetchOwner().catch(() => null); 
    const reportConfig = await ChannelReports(guild.client);
    
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('📥 Nuevo Servidor')
      .setThumbnail(guild.iconURL() || guild.client.user.displayAvatarURL())
      .addFields(
        { name: '📌 Nombre', value: guild.name, inline: true },
        { name: '🆔 ID', value: guild.id, inline: true },
        { name: '👑 Dueño', value: owner?.user.tag || 'Desconocido', inline: true },
        { name: '👥 Miembros', value: guild.memberCount.toString(), inline: true },
      )
      .setFooter({ text: `Total servidores: ${guild.client.guilds.cache.size}` })
      .setTimestamp()
      .setColor(0x00FF00);

    if (reportConfig.chReport) {
      const channel = await guild.client.channels.fetch(reportConfig.chReportId).catch(() => null) as TextChannel | null;
      if (channel) {
        await channel.send({ embeds: [embed] });
        info(`📝 Notificación enviada al canal: ${channel.name}`, "GuildCreate");
      }
    } else {
      const ownerUser = await guild.client.users.fetch(process.env.OWNER_ID!).catch(() => null);
      if (ownerUser) {
        await ownerUser.send({ embeds: [embed] });
        info(`📝 Notificación enviada al DM`, "GuildCreate");
      }
    }
  } catch (err) {
    error(`Error procesando GuildCreate para ${guild.name}: ${err}`, "GuildCreate");
  }
}

/* ================================================ Registrador de salidas ================================================ */

async function handleGuildDelete(guild: Guild): Promise<void> {
  try {
    info(`❌ Fui expulsado/salí del servidor: ${guild.name} (ID: ${guild.id})`, "GuildDelete");
    info(`📊 Servidores restantes: ${guild.client.guilds.cache.size}`, "GuildDelete");
    
    const maid = await deleteGuildConfig(guild);
    const reportConfig = await ChannelReports(guild.client);

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setThumbnail(guild.iconURL() || guild.client.user.displayAvatarURL())
      .setTitle(`❌ Expulsada del servidor!! ${guild.name} (ID: ${guild.id})`)
      .addFields({ name: "Maid Cleaning:", value: maid ? "✅ No quedo rastro de configuraciones" : "❌ Error al limpiar", inline: true })
      .setFooter({ text: `Total servidores: ${guild.client.guilds.cache.size}` })
      .setTimestamp();

    if (reportConfig.chReport) {
      const channel = await guild.client.channels.fetch(reportConfig.chReportId).catch(() => null) as TextChannel | null;
      if (channel) await channel.send({embeds: [embed]});
    } else {
      const ownerUser = await guild.client.users.fetch(process.env.OWNER_ID!).catch(() => null);
      if (ownerUser) await ownerUser.send({embeds: [embed]});
    }
    
  } catch (err) {
    error(`Error general en GuildDelete para ${guild.name}: ${err}`, "GuildDelete");
  }
}

/* ================================================ Borrador de configuraciones ================================================ */

async function deleteGuildConfig(guild: Guild): Promise<boolean> {
  try {
  info(`🧹 Iniciando limpieza de base de datos para el gremio: ${guild.name}`, "GuildCleanup");
  const resultados = await Promise.allSettled([
    removeVoiceConfig(guild.id),
    clearGuildPermissions(guild.id),
    removeWelcomeConfig(guild.id),
    deleteAllEmbedConfig(guild.id),
    delleteAllMangadexConfig(guild.id),
    delleteAllRedditConfig(guild.id),
    delleteAllReplyBotsConfig(guild.id),
    delleteAllRolemojiConfig(guild.id),
    deleteAllYoutubeConfig(guild.id)
  ]);

  resultados.forEach((resultado, index) => {
    const sistemas = ['JoinToVoice', 'Permisos', 'Welcome', 'Embed', 'Mangadex', 'Reddit', 'ReplyBots', 'Rolemoji', 'Youtube'];
    if (resultado.status === 'rejected') {
      error(`Fallo al borrar configuración de ${sistemas[index]} para el guild ${guild.id}: ${resultado.reason}`, "GuildCleanup");
    } else {
      info(`✅ Configuración de ${sistemas[index]} borrada para el guild ${guild.id}`, "GuildCleanup");
    }
  });
  info(`✅ Proceso de limpieza finalizado para: ${guild.name} (ID: ${guild.id})`, "GuildCleanup");
  return resultados.every(r => r.status === 'fulfilled');
} catch (err) {
  error("Error al realizar limpieza!!")
  return false;
  }
}