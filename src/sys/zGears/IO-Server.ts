// src/sys/zGears/IO-Server.ts 
import { Client, Events, Guild, TextChannel, EmbedBuilder } from "discord.js";
import { info, error } from "../logging";
import { adminChannel } from "./auxiliares";
import { removeVoiceConfig } from "../DB-Engine/links/JointoVoice";
import { clearGuildPermissions } from "../DB-Engine/links/Permission";
import { removeWelcome } from "../DB-Engine/links/Welcome";
import { deleteAllEmbedConfig } from "../DB-Engine/links/Embed";
import { delleteAllMangadexConfig } from "../DB-Engine/links/Mangadex";
import { delleteAllRedditConfig } from "../DB-Engine/links/Reddit";
import { delleteAllReplyBotsConfig } from "../DB-Engine/links/ReplyBots";
import { delleteAllRolemojiConfig } from "../DB-Engine/links/Rolemoji";
import { deleteAllYoutubeConfig } from "../DB-Engine/links/Youtube";
import { removButton } from "../DB-Engine/links/roleButtons";
import { deleteAllCronPosts } from "../DB-Engine/links/Cronpost";
import { removeGuildLimits } from "../DB-Engine/links/noRules";
import { delKCBD } from "../DB-Engine/links/KancolleBD";
import { deleteFollowTweetByGuild } from "../DB-Engine/links/followTweet";
import { bdEraseBlueSky } from "../DB-Engine/links/blueSkya";
import { erasePixi } from "../DB-Engine/links/PixivData";


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
    const reportConfig = await adminChannel(guild.client);
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('📥 Nuevo Servidor')
      .addFields(
        { name: '📌 Nombre', value: guild.name, inline: true },
        { name: '🆔 ID', value: guild.id, inline: true },
        { name: '👑 Dueño', value: owner?.user.tag || 'Desconocido', inline: true },
        { name: '👥 Miembros', value: guild.memberCount.toString(), inline: true },
      )
      .setFooter({ text: `Total servidores: ${guild.client.guilds.cache.size}` })
      .setTimestamp()
      .setColor(0x00FF00);
    if (guild.iconURL()) embed.setThumbnail(guild.iconURL());
    else if (owner) embed.setThumbnail(owner.user.displayAvatarURL());

    if (reportConfig.upChannel) {
      const channel = await guild.client.channels.fetch(reportConfig.channelId).catch(() => null) as TextChannel | null;
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
    const reportConfig = await adminChannel(guild.client);

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setThumbnail(guild.iconURL() || guild.client.user.displayAvatarURL())
      .setTitle(`❌ Expulsada del servidor!! ${guild.name} (ID: ${guild.id})`)
      .addFields({ name: "Maid Cleaning:", value: maid.join("\n"), inline: true })
      .setFooter({ text: `Total servidores: ${guild.client.guilds.cache.size}` })
      .setTimestamp();

    if (reportConfig.upChannel) {
      const ch = guild.channels.cache.get(reportConfig.channelId) ?? await guild.client.channels.fetch(reportConfig.channelId).catch(() => null);
      if (ch && ch.isSendable()) await ch.send({ embeds: [embed] });
    } else {
      const userOwn = process.env.OWNER_ID!
      const ownerUser = guild.client.users.cache.get(userOwn) ?? await guild.client.users.fetch(userOwn).catch(() => null);
      if (ownerUser) await ownerUser.send({ embeds: [embed] });
    }

  } catch (err) {
    error(`Error general en GuildDelete para ${guild.name}: ${err}`, "GuildDelete");
  }
}

/* ================================================ Borrador de configuraciones ================================================ */
export async function deleteGuildConfig(guild: Guild): Promise<string[]> {
  try {
    info(`🧹 Iniciando limpieza de base de datos para el gremio: ${guild.name}`, "GuildCleanup");

    const resultados = await Promise.allSettled([
      removeVoiceConfig(guild.id),
      clearGuildPermissions(guild.id),
      removeWelcome(guild.id),
      deleteAllEmbedConfig(guild.id),
      delleteAllMangadexConfig(guild.id),
      delleteAllRedditConfig(guild.id),
      delleteAllReplyBotsConfig(guild.id),
      delleteAllRolemojiConfig(guild.id),
      deleteAllYoutubeConfig(guild.id),
      removButton(guild.id),
      deleteAllCronPosts(guild.id),
      removeGuildLimits(guild.id),
      delKCBD(guild.id),
      deleteFollowTweetByGuild(guild.id),
      bdEraseBlueSky(guild.id),
      erasePixi(guild.id)
    ]);

    const sistemas = ['/JoinToVoice', '/Permisos', '/Welcome', '/Embed', '/Mangadex', '/Reddit', '/ReplyBots', '/Rolemoji', '/Youtube', '/Buttons', '/Cronpost', '/Limits', '/Kancolle', '/Twitter', `/BlueSkya`, `/Pixiv`];
    const resulOut: string[] = [];
    resulOut.push(`Borrado de configuraciones del server: ${guild.id}`)
    resultados.forEach((resultado, index) => {
      if (resultado.status === 'rejected') {
        resulOut.push(`> ❌ ${sistemas[index]}`);
      } else {
        resulOut.push(`> ✅ ${sistemas[index]}`);
      }
      info(`Finalizo la limpieza de configuracion del server ${guild.id} de la BD`, "GuildCleanup")
    });
    return resulOut;
  } catch (e) {
    error(`Error al realizar limpieza!! Error: ${e}`, "GuildCleanup")
    return [];
  }
}