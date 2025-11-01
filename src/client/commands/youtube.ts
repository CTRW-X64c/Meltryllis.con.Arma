// src/client/commands/youtube.ts
import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, } from "discord.js";
import { addYouTubeFeed, getYouTubeFeeds, removeYouTubeFeed, YouTubeFeed } from "../database";
import { error, info, debug } from "../../logging";
import i18next from "i18next" 

export async function registerYouTubeCommand() {
  const youtube = new SlashCommandBuilder()
    .setName("youtube")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDescription(i18next.t("command_youtube", { ns: "youtube" }))
    .addSubcommand(subcommand =>
      subcommand
        .setName("seguir")
        .setDescription(i18next.t("command_youtube_descripcion", { ns: "youtube" }))
        .addStringOption(option =>
          option.setName("rss_url")
            .setDescription(i18next.t("command_youtube_seguir", { ns: "youtube" }))
            .setRequired(true)
        )
        .addChannelOption(option =>
          option.setName("canal")
            .setDescription(i18next.t("command_youtube_canal", { ns: "youtube" }))
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("lista")
        .setDescription(i18next.t("command_youtube_lista", { ns: "youtube" }))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("dejar")
        .setDescription(i18next.t("command_youtube_dejar", { ns: "youtube" }))
        .addStringOption(option =>
          option.setName("id_canal")
            .setDescription(i18next.t("command_youtube_id_canal", { ns: "youtube" }))
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("test")
        .setDescription(i18next.t("command_youtube_test", { ns: "youtube" }))
        .addStringOption(option =>
          option.setName("id_canal")
            .setDescription(i18next.t("command_youtube_id_canal", { ns: "youtube" }))
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("help")
        .setDescription(i18next.t("command_youtube_help", { ns: "youtube" }))
    );

  return [youtube] as SlashCommandBuilder[];
}

export async function handleYouTubeCommand(interaction: any) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const memberPermissions = interaction.memberPermissions;
  const isAdmin = memberPermissions?.has(PermissionFlagsBits.ManageGuild) || interaction.guild?.ownerId === interaction.user.id;
    if (!isAdmin) {
      await interaction.editReply({
        content: "❌ No tienes permiso para ejecutar el comando.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  try {
    switch (subcommand) {
      case "seguir":
        await seguirCanal(interaction, guildId);
        break;
      case "lista":
        await listaCanales(interaction, guildId);
        break;
      case "dejar":
        await dejarCanal(interaction, guildId);
        break;
      case "test":
        await testCanal(interaction, guildId);
        break;
      case "help":
        await YThelp(interaction);
        break;
    }
  } catch (err) {
    error(`Error ejecutando comando YouTube: ${err}`);
    await interaction.editReply({ content: i18next.t("command_error", { ns: "youtube" }), flags: MessageFlags.Ephemeral });
  }
}

async function seguirCanal(interaction: any, guildId: string) {
  const rssUrl = interaction.options.getString("rss_url");
  const discordChannel = interaction.options.getChannel("canal");

  if (!discordChannel.isTextBased()) {
    await interaction.editReply({ content: i18next.t("command_youtube_canal_error", { ns: "youtube" }), flags: MessageFlags.Ephemeral });
    return;
  }

  if (!rssUrl.includes("youtube.com/feeds/videos.xml") || !rssUrl.includes("channel_id=")) {
    await interaction.editReply({ content: i18next.t("command_youtube_rss_error", { ns: "youtube" }), flags: MessageFlags.Ephemeral });
    return;
  }

  try {
    const channelId = extractChannelIdFromRss(rssUrl);
    if (!channelId) {
      await interaction.editReply({ content: i18next.t("command_youtube_rssID_error", { ns: "youtube" }), flags: MessageFlags.Ephemeral });
      return;
    }

    const channelName = await getChannelNameFromRss(rssUrl);
    const existingFeeds = await getYouTubeFeeds(guildId);
    const alreadyFollowing = existingFeeds.find(feed => feed.youtube_channel_id === channelId);
    
    if (alreadyFollowing) {
      await interaction.editReply({ content: i18next.t("command_youtube_ya_sigueindo", { ns: "youtube", a1: alreadyFollowing.youtube_channel_name }), flags: MessageFlags.Ephemeral });
      return;
    }

    await addYouTubeFeed({
      guild_id: guildId,
      channel_id: discordChannel.id,
      youtube_channel_id: channelId,
      youtube_channel_name: channelName,
      rss_url: rssUrl,
      last_video_id: null
    });

    await interaction.editReply({ 
      content: i18next.t("command_youtube_seguir_success", { ns: "youtube", a1: channelName, a2: discordChannel.toString() }),  
      flags: MessageFlags.Ephemeral
    });
    
    info(`Nuevo canal de YouTube seguido: ${channelName} (${channelId}) en servidor ${guildId}`, "YouTubeCommand");
    
  } catch (err) {
    error(`Error siguiendo canal: ${err}`, "YouTubeCommand");
    await interaction.editReply({ content: "❌ Error al seguir el canal. Verifica que la URL RSS sea correcta y accesible.", flags: MessageFlags.Ephemeral });
  }
}

async function listaCanales(interaction: any, guildId: string) {
  const feeds = await getYouTubeFeeds(guildId);

  if (feeds.length === 0) {
    await interaction.editReply({ content: i18next.t("command_youtube_lista_vacia", { ns: "youtube" }), flags: MessageFlags.Ephemeral});
    return;
  }

  const feedsPorCanal = new Map<string, { canal: any, feeds: YouTubeFeed[] }>();
  
  for (const feed of feeds) {
    const canalDiscord = interaction.guild.channels.cache.get(feed.channel_id);
    const clave = feed.channel_id;
    
    if (!feedsPorCanal.has(clave)) {
      feedsPorCanal.set(clave, { 
        canal: canalDiscord, 
        feeds: [] 
      });
    }
    feedsPorCanal.get(clave)!.feeds.push(feed);
  }

  const { EmbedBuilder } = await import("discord.js");
  const embed = new EmbedBuilder()
    .setTitle(i18next.t("YT_embed_titulo", { ns: "youtube" }))
    .setDescription(i18next.t("YT_embed_descripcion", { ns: "youtube", a1: feeds.length, a2: feedsPorCanal.size, a3: feedsPorCanal.size > 1 ? 'es' : '' }))
    .setColor(0x5865F2);

  for (const [canalId, grupo] of feedsPorCanal) {
    const urlchannel = `https://discord.com/channels/${guildId}/${canalId}`;
        const listaCanales = grupo.feeds.map(feed => 
          i18next.t("YT_embed_list_entry", {ns: "youtube", a1: feed.youtube_channel_name, a2: feed.youtube_channel_id})
        ).join('\n');

    embed.addFields({
      name: i18next.t("YT_embed_list_title", { ns: "youtube", a1: urlchannel, a2: grupo.feeds.length }),
      value: i18next.t("YT_embed_list_value", { ns: "youtube", a1: listaCanales }),
      inline: false
    });
  }

  embed.setFooter({ 
    text: i18next.t("YT_embed_footer", { ns: "youtube" }) 
  });

  await interaction.editReply({ 
    embeds: [embed],
    ephemeral: true 
  });
}
async function dejarCanal(interaction: any, guildId: string) {
  const youtubeChannelId = interaction.options.getString("id_canal");
  
  try {
    const removed = await removeYouTubeFeed(guildId, youtubeChannelId);
    
    if (removed) {
      await interaction.editReply({ content: "✅ Canal eliminado correctamente. Ya no recibirás notificaciones de este canal.", flags: MessageFlags.Ephemeral });
      info(`Canal de YouTube eliminado: ${youtubeChannelId} del servidor ${guildId}`, "YouTubeCommand");
    } else {
      await interaction.editReply({ content: "❌ No se encontró el canal especificado. Usa `/youtube lista` para ver los canales que estás siguiendo.", flags: MessageFlags.Ephemeral });
    }
  } catch (err) {
    error(`Error eliminando canal: ${err}`, "YouTubeCommand");
    await interaction.editReply({ content: "❌ Error al eliminar el canal.", flags: MessageFlags.Ephemeral });
  }
}

async function testCanal(interaction: any, guildId: string) {
  const youtubeChannelId = interaction.options.getString("id_canal");
  
  try {
    const feeds = await getYouTubeFeeds(guildId);
    const feed = feeds.find(f => f.youtube_channel_id === youtubeChannelId);
    
    if (!feed) {
      await interaction.editReply({ content: i18next.t("command_youtube_canal_test_error", { ns: "youtube" }), flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.editReply({ content: i18next.t("command_youtube_canal_test_buscando", { ns: "youtube" }), flags: MessageFlags.Ephemeral });

    const Parser = (await import("rss-parser")).default;
    const parser = new Parser();
    const rssFeed = await parser.parseURL(feed.rss_url); 
    if (!rssFeed.items || rssFeed.items.length === 0) {
      await interaction.editReply({ content: i18next.t("command_youtube_canal_test_novideos", { ns: "youtube" }), flags: MessageFlags.Ephemeral });
      return;
    }

    const latestVideo = rssFeed.items[0];
    const videoId = extractVideoId(latestVideo);
    const videoUrl = latestVideo.link || `https://www.youtube.com/watch?v=${videoId}`;
    const guild = interaction.guild;
    const channel = guild.channels.cache.get(feed.channel_id);
    
    if (!channel || !channel.isTextBased()) {
      await interaction.editReply({ content: i18next.t("command_youtube_canal_test_noexiste", { ns: "youtube" }), flags: MessageFlags.Ephemeral });
      return;
    }

    await channel.send({
      content: i18next.t("command_youtube_canal_pruebaUltimoVideo", { ns: "youtube", a1: feed.youtube_channel_name, a2: latestVideo.title, a3: videoUrl}),
    });

    await interaction.editReply({ 
      content: i18next.t("command_youtube_canal_test_pass", { ns: "youtube", a1: feed.youtube_channel_name, a2: feed.channel_id}), 
      flags: MessageFlags.Ephemeral 
    });

    info(`Prueba ejecutada para canal: ${feed.youtube_channel_name} en servidor ${guildId}`, "YouTubeCommand");

  } catch (err) {
    error(`Error en prueba de canal: ${err}`, "YouTubeCommand");
    await interaction.editReply({ content: i18next.t("command_youtube_canal_test_error", { ns: "youtube" }), flags: MessageFlags.Ephemeral });
  }
}

function extractChannelIdFromRss(rssUrl: string): string | null {
  const match = rssUrl.match(/channel_id=([^&]+)/);
  return match ? match[1] : null;
}

function extractVideoId(video: any): string | null {
  if (video.id) {
    return video.id;
  }
  
  if (video.link) {
    const match = video.link.match(/[?&]v=([^&]+)/);
    if (match) return match[1];
  }
  
  if (video.guid) {
    const match = video.guid.match(/video:video\.([^:]+)/);
    if (match) return match[1];
  }
  
  return null;
}

async function getChannelNameFromRss(rssUrl: string): Promise<string> {
  try {
    const Parser = (await import("rss-parser")).default;
    const parser = new Parser();
    const feed = await parser.parseURL(rssUrl);
    return feed.title || "Canal de YouTube";
  } catch (err) {
    return "Canal de YouTube";
  }
}

async function YThelp(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const embed = new EmbedBuilder()
      .setTitle(i18next.t("YT_HelpEmb_titulo", { ns: "youtube" })) // Cambié el título para que sea más específico
      .setDescription(i18next.t("YT_HelpEmb_descripcion", { ns: "youtube" }))
      .addFields(
        {
          name: i18next.t("YT_HelpEmb_Field_Name_1", { ns: "youtube" }),
          value: i18next.t("YT_HelpEmb_Field_Value_1", { ns: "youtube" }),
          inline: false
        },
        {
          name: i18next.t("YT_HelpEmb_Field_Name_2", { ns: "youtube" }),
          value: i18next.t("YT_HelpEmb_Field_Value_2", { ns: "youtube" }),
          inline: false
        }
      )
      .setImage("https://i.imgur.com/hBy4KhT.jpeg")
      .setColor("#ff0000")
      .setFooter({
        text: i18next.t("YT_HelpEmb_footer", { ns: "youtube" }),
      })

    await interaction.editReply({ embeds: [embed] });
    debug(`Comando de ayuda de YouTube ejecutado`); //<=
  } catch (err) {
    error(`Error al ejecutar comando de ayuda de YouTube: ${err}`); //<=
    await interaction.editReply({
      content: (`Ocurrió un error al mostrar la ayuda.`),
    });
  }
}