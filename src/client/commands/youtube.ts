// src/client/commands/youtube.ts
import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder, } from "discord.js";
import { addYouTubeFeed, getYouTubeFeeds, removeYouTubeFeed, YouTubeFeed } from "../../sys/DB-Engine/links/Youtube";
import { extractChannelIdFromRss, extractVideoId, verifyYouTubeRss } from "../eventGear/youtubeTools";
import { error, debug } from "../../sys/logging";
import { hasPermission } from "../../sys/zGears/mPermission";
import i18next from "i18next" 

export async function registerYouTubeCommand() {
  const youtube = new SlashCommandBuilder()
    .setName("youtube")
    .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
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
    );

  return [youtube] as SlashCommandBuilder[];
}

export async function handleYouTubeCommand(interaction: any) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const isAllowed = await hasPermission(interaction, interaction.commandName);
  if (!isAllowed) {
    await interaction.editReply({
      content: i18next.t("command_permission_error", { ns: "rolemoji" }),
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
    }
  } catch (err) {
    error(`Error ejecutando comando YouTube: ${err}`);
    await interaction.editReply({ content: i18next.t("command_error", { ns: "youtube" }), flags: MessageFlags.Ephemeral });
  }
}

// =============== SubSeguir =============== //
async function seguirCanal(interaction: any, guildId: string) {
  const rssUrl = interaction.options.getString("rss_url");
  const discordChannelInput = interaction.options.getChannel("canal");
  const discordChannel = interaction.guild.channels.cache.get(discordChannelInput.id);

  if (!discordChannel || !discordChannel.isTextBased()) {
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


    const existingFeeds = await getYouTubeFeeds(guildId);
    const alreadyFollowing = existingFeeds.find(feed => feed.youtube_channel_id === channelId);
    
    if (alreadyFollowing) {
      await interaction.editReply({ content: i18next.t("command_youtube_ya_sigueindo", { ns: "youtube", a1: alreadyFollowing.youtube_channel_name }), flags: MessageFlags.Ephemeral });
      return;
    }
  
    await interaction.editReply({ 
      content: "🔍 **Verificando el canal de YouTube...**", 
      ephemeral: true 
    });

    const verification = await verifyYouTubeRss(rssUrl);
    
    if (!verification.isValid) {
      await interaction.editReply({ 
        content: i18next.t("erro_verificar_canal", { ns: "youtube", a1: verification.error}),
        ephemeral: true 
      });
      return;
    }

    const vChName = verification.channelName;

    await addYouTubeFeed({
      guild_id: guildId,
      channel_id: discordChannel.id,
      youtube_channel_id: channelId,
      youtube_channel_name: vChName,
      rss_url: rssUrl,
      last_video_id: null
    });

    await interaction.editReply({ 
      content: i18next.t("command_youtube_seguir_success", { ns: "youtube", a1: vChName, a2: discordChannel.toString() }),  
      flags: MessageFlags.Ephemeral
    });
    
    debug(`Nuevo canal de YouTube seguido: ${vChName} (${channelId}) en servidor ${guildId}`, "YouTubeCommand");
    
  } catch (err) {
    error(`Error siguiendo canal: ${err}`, "YouTubeCommand");
    await interaction.editReply({ content: i18next.t("command_youtube_seguir_error", { ns: "youtube" }), flags: MessageFlags.Ephemeral });
  }
}

// =============== SubLista =============== //
async function listaCanales(interaction: any, guildId: string) {
  const feeds = await getYouTubeFeeds(guildId);

  if (feeds.length === 0) {
    await interaction.editReply({ content: i18next.t("command_youtube_lista_vacia", { ns: "youtube" }), flags: MessageFlags.Ephemeral});
    return;
  }
  
  const feedsPorCanal = new Map<string, { canal: any, feeds: YouTubeFeed[] }>();
  
  for (const feed of feeds) {
    const clave = feed.channel_id;
    
     if (!feedsPorCanal.has(clave)) {
        const channel = interaction.guild?.channels.cache.get(clave);
        feedsPorCanal.set(clave, { 
          canal: channel, 
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
        const listaCanales = grupo.feeds.map(feed => {
         return i18next.t("YT_embed_list_entry", {ns: "youtube", a1: feed.youtube_channel_name, a2: feed.youtube_channel_id})
  });

    /* Mangadex nos enseño que a esto le podria pasar lo mismo */
      const TAMANO_BLOQUE = 30;
        for (let i = 0; i < listaCanales.length; i += TAMANO_BLOQUE) {
        const bloque = listaCanales.slice(i, i + TAMANO_BLOQUE).join('\n');
        const sufijo = listaCanales.length > TAMANO_BLOQUE ? ` (Parte ${Math.floor(i/TAMANO_BLOQUE) + 1})` : '';
        const nombreCampo = `#${urlchannel} - ${sufijo}`;

    embed.addFields({
      name: nombreCampo,
      value: bloque || i18next.t("YT_embed_list_value", { ns: "youtube"}),
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
}}

// =============== SubDejar =============== //
async function dejarCanal(interaction: any, guildId: string) {
  const youtubeChannelId = interaction.options.getString("id_canal");
  
  try {
    const removed = await removeYouTubeFeed(guildId, youtubeChannelId);
    
    if (removed) {
      await interaction.editReply({ content: "✅ Canal eliminado correctamente. Ya no recibirás notificaciones de este canal.", flags: MessageFlags.Ephemeral });
      debug(`Canal de YouTube eliminado: ${youtubeChannelId} del servidor ${guildId}`, "YouTubeCommand");
    } else {
      await interaction.editReply({ content: "❌ No se encontró el canal especificado. Usa `/youtube lista` para ver los canales que estás siguiendo.", flags: MessageFlags.Ephemeral });
    }
  } catch (err) {
    error(`Error eliminando canal: ${err}`, "YouTubeCommand");
    await interaction.editReply({ content: "❌ Error al eliminar el canal.", flags: MessageFlags.Ephemeral });
  }
}

// =============== SubTest =============== //
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
    const canalClickeable = `<#${feed.channel_id}>`;
    await interaction.editReply({ 
      content: i18next.t("command_youtube_canal_test_pass", { ns: "youtube", a1: feed.youtube_channel_name, a2: canalClickeable}), 
      flags: MessageFlags.Ephemeral 
    });

    debug(`Prueba ejecutada para canal: ${feed.youtube_channel_name} en servidor ${guildId}`, "YouTubeCommand");

  } catch (err) {
    error(`Error en prueba de canal: ${err}`, "YouTubeCommand");
    await interaction.editReply({ content: i18next.t("command_youtube_canal_test_error", { ns: "youtube" }), flags: MessageFlags.Ephemeral });
  }
}

// Aqui solo debe tener comandos