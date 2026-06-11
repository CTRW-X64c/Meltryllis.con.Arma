// src/Events-Commands/commands/youtube.ts
import { ChannelType, Guild, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, } from "discord.js";
import { addYouTubeFeed, getYouTubeFeeds, removeYouTubeFeed, YouTubeFeed } from "../../sys/DB-Engine/links/Youtube";
import { extractVideoId } from "../../bgProcess/youtubeCheck";
import { error, debug } from "../../sys/logging";
import { hasPermission } from "../../sys/zGears/mPermission";
import i18next from "i18next"
import Parser from "rss-parser";
import { testPermisos } from "../../sys/zGears/auxiliares";
import { getGuildLimits } from "../../sys/DB-Engine/links/noRules";
import { countItems } from "../../sys/DB-Engine/database";

export async function registerYouTubeCommand() {
  const youtube = new SlashCommandBuilder()
    .setName("youtube")
    .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
    .setDescription(i18next.t("commands:youtube.slashBuilder.youtube"))
    .addSubcommand(subcommand =>
      subcommand
        .setName("seguir")
        .setDescription(i18next.t("commands:youtube.slashBuilder.descripcion"))
        .addStringOption(option =>
          option.setName("rss_url")
            .setDescription(i18next.t("commands:youtube.slashBuilder.seguir"))
            .setRequired(true)
        )
        .addChannelOption(option =>
          option.setName("canal")
            .addChannelTypes(ChannelType.GuildText, ChannelType.PrivateThread, ChannelType.PublicThread, ChannelType.GuildAnnouncement)
            .setDescription(i18next.t("commands:youtube.slashBuilder.canal"))
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("lista")
        .setDescription(i18next.t("commands:youtube.slashBuilder.lista"))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("dejar")
        .setDescription(i18next.t("commands:youtube.slashBuilder.dejar"))
        .addStringOption(option =>
          option.setName("id_canal")
            .setDescription(i18next.t("commands:youtube.slashBuilder.id_canal"))
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("test")
        .setDescription(i18next.t("commands:youtube.slashBuilder.test"))
        .addStringOption(option =>
          option.setName("id_canal")
            .setDescription(i18next.t("commands:youtube.slashBuilder.id_canal"))
            .setRequired(true)
        )
    );

  return [youtube] as SlashCommandBuilder[];
}

export async function handleYouTubeCommand(interaction: any) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply(i18next.t("common:Errores.noGuild"));
    return;
  }

  const isAllowed = await hasPermission(interaction, interaction.commandName);
  if (!isAllowed) {
    await interaction.editReply({
      content: i18next.t("common:Errores.isAllowed"),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const subcommand = interaction.options.getSubcommand();
    switch (subcommand) {
      case "seguir":
        await seguirCanal(interaction, guild);
        break;
      case "lista":
        await listaCanales(interaction, guild);
        break;
      case "dejar":
        await dejarCanal(interaction, guild);
        break;
      case "test":
        await testCanal(interaction, guild);
        break;
    }
  } catch (err) {
    error(`Error ejecutando comando YouTube: ${err}`);
    await interaction.editReply({ content: i18next.t("commands:youtube.interacciones.error"), flags: MessageFlags.Ephemeral });
  }
}

// =============== SubSeguir =============== //
async function seguirCanal(interaction: any, guild: Guild) {
  const rssUrl = interaction.options.getString("rss_url");
  const discordChannelInput = interaction.options.getChannel("canal");
  const discordChannel = interaction.guild.channels.cache.get(discordChannelInput.id);

  if (!discordChannel || !discordChannel.isTextBased()) {
    await interaction.editReply({ content: i18next.t("common:Errores.noChannel"), flags: MessageFlags.Ephemeral });
    return;
  }

  const conty = await countItems(guild.id, "youtube_feeds");
  const limit = await getGuildLimits(guild.id);
  if ((conty >= limit.dexMax)) {
    await interaction.editReply({ content: i18next.t("common:Errores.servLimit", { a1: conty, a2: limit.dexMax }) });
    return;
  }

  const me = discordChannel.permissionsFor(guild.members.me!);
  const perChTo = testPermisos(me, "viewCh|sendMsg|addlink");
  if (perChTo.some(p => p.includes("❌"))) {
    await interaction.editReply({ content: i18next.t("common:Errores.missing_permissions", { a1: `<#${discordChannel.id}>`, a2: perChTo[0] }) });
    return;
  }

  if (!rssUrl.includes("youtube.com/feeds/videos.xml") || !rssUrl.includes("channel_id=")) {
    await interaction.editReply({ content: i18next.t("commands:youtube.interacciones.rss_error"), flags: MessageFlags.Ephemeral });
    return;
  }

  try {

    const extractRRS = (rssUrl: string): string | null => {
      const match = rssUrl.match(/channel_id=([^&]+)/);
      return match ? match[1] : null;
    }

    const channelId = extractRRS(rssUrl);
    if (!channelId) {
      await interaction.editReply({ content: i18next.t("commands:youtube.interacciones.rssID_error"), flags: MessageFlags.Ephemeral });
      return;
    }


    const existingFeeds = await getYouTubeFeeds(guild.id);
    const alreadyFollowing = existingFeeds.find(feed => feed.youtube_channel_id === channelId);

    if (alreadyFollowing) {
      await interaction.editReply({ content: i18next.t("commands:youtube.interacciones.ya_sigueindo", { a1: alreadyFollowing.youtube_channel_name }), flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.editReply({
      content: "🔍 **Verificando el canal de YouTube...**",
      ephemeral: true
    });

    const verification = await verifyYouTubeRss(rssUrl);

    if (!verification.isValid) {
      await interaction.editReply({
        content: i18next.t("commands:youtube.interacciones.erro_verificar_canal", { a1: verification.error }),
        ephemeral: true
      });
      return;
    }

    const vChName = verification.channelName;

    await addYouTubeFeed({
      guild_id: guild.id,
      channel_id: discordChannel.id,
      youtube_channel_id: channelId,
      youtube_channel_name: vChName,
      rss_url: rssUrl,
      last_video_id: null
    });

    await interaction.editReply({
      content: i18next.t("commands:youtube.interacciones.seguir_success", { a1: vChName, a2: discordChannel.toString() }),
      flags: MessageFlags.Ephemeral
    });

    debug(`Nuevo canal de YouTube seguido: ${vChName} (${channelId}) en servidor ${guild.id}`, "YouTubeCommand");

  } catch (err) {
    error(`Error siguiendo canal: ${err}`, "YouTubeCommand");
    await interaction.editReply({ content: i18next.t("commands:youtube.interacciones.error"), flags: MessageFlags.Ephemeral });
  }
}

// =============== SubLista =============== //
async function listaCanales(interaction: any, guild: Guild) {
  const feeds = await getYouTubeFeeds(guild.id);

  if (feeds.length === 0) {
    await interaction.editReply({ content: i18next.t("commands:youtube.interacciones.lista_vacia"), flags: MessageFlags.Ephemeral });
    return;
  }

  const feedsPorCanal = new Map<string, { canal: any, feeds: YouTubeFeed[] }>();

  for (const feed of feeds) {
    const clave = feed.channel_id;

    if (!feedsPorCanal.has(clave)) {
      const channel = guild.channels.cache.get(clave);
      feedsPorCanal.set(clave, {
        canal: channel,
        feeds: []
      });
    }
    feedsPorCanal.get(clave)!.feeds.push(feed);
  }

  const { EmbedBuilder } = await import("discord.js");
  const embed = new EmbedBuilder()
    .setTitle(i18next.t("commands:youtube.interacciones.YT_embed_titulo"))
    .setDescription(i18next.t("commands:youtube.interacciones.YT_embed_descripcion", { a1: feeds.length, a2: feedsPorCanal.size, a3: feedsPorCanal.size > 1 ? 'es' : '' }))
    .setColor(0x5865F2);

  for (const [canalId, grupo] of feedsPorCanal) {
    const urlchannel = `https://discord.com/channels/${guild.id}/${canalId}`;
    const listaCanales = grupo.feeds.map(feed => {
      return i18next.t("commands:youtube.interacciones.YT_embed_list_entry", { a1: feed.youtube_channel_name, a2: feed.channel_id })
    });

    /* Mangadex nos enseño que a esto le podria pasar lo mismo */
    const TAMANO_BLOQUE = 30;
    for (let i = 0; i < listaCanales.length; i += TAMANO_BLOQUE) {
      const bloque = listaCanales.slice(i, i + TAMANO_BLOQUE).join('\n');
      const sufijo = listaCanales.length > TAMANO_BLOQUE ? ` (Parte ${Math.floor(i / TAMANO_BLOQUE) + 1})` : '';
      const nombreCampo = `#${urlchannel} - ${sufijo}`;

      embed.addFields({
        name: nombreCampo,
        value: bloque || i18next.t("commands:youtube.interacciones.YT_embed_list_value"),
        inline: false
      });
    }

    embed.setFooter({
      text: i18next.t("commands:youtube.interacciones.YT_embed_footer")
    });

    await interaction.editReply({
      embeds: [embed],
      ephemeral: true
    });
  }
}

// =============== SubDejar =============== //
async function dejarCanal(interaction: any, guild: Guild) {
  const youtubeChannelId = interaction.options.getString("id_canal");

  try {
    const removed = await removeYouTubeFeed(guild.id, youtubeChannelId);

    if (removed) {
      await interaction.editReply({ content: "✅ Canal eliminado correctamente. Ya no recibirás notificaciones de este canal.", flags: MessageFlags.Ephemeral });
      debug(`Canal de YouTube eliminado: ${youtubeChannelId} del servidor ${guild.id}`, "YouTubeCommand");
    } else {
      await interaction.editReply({ content: "❌ No se encontró el canal especificado. Usa `/youtube lista` para ver los canales que estás siguiendo.", flags: MessageFlags.Ephemeral });
    }
  } catch (err) {
    error(`Error eliminando canal: ${err}`, "YouTubeCommand");
    await interaction.editReply({ content: "❌ Error al eliminar el canal.", flags: MessageFlags.Ephemeral });
  }
}

// =============== SubTest =============== //
async function testCanal(interaction: any, guild: Guild) {
  const youtubeChannelId = interaction.options.getString("id_canal");

  try {
    const feeds = await getYouTubeFeeds(guild.id);
    const feed = feeds.find(f => f.channel_id === youtubeChannelId);

    if (!feed) {
      await interaction.editReply({ content: i18next.t("commands:youtube.interacciones.canal_test_error"), flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.editReply({ content: i18next.t("commands:youtube.interacciones.canal_test_buscando"), flags: MessageFlags.Ephemeral });

    const Parser = (await import("rss-parser")).default;
    const parser = new Parser();
    const rssFeed = await parser.parseURL(feed.rss_url);
    if (!rssFeed.items || rssFeed.items.length === 0) {
      await interaction.editReply({ content: i18next.t("commands:youtube.interacciones.canal_test_novideos"), flags: MessageFlags.Ephemeral });
      return;
    }

    const latestVideo = rssFeed.items[0];
    const videoId = extractVideoId(latestVideo);
    const videoUrl = latestVideo.link || `https://www.youtube.com/watch?v=${videoId}`;
    const channel = guild.channels.cache.get(feed.channel_id);

    if (!channel || !channel.isTextBased()) {
      await interaction.editReply({ content: i18next.t("common:Errores.noChannel"), flags: MessageFlags.Ephemeral });
      return;
    }

    await channel.send({
      content: i18next.t("commands:youtube.interacciones.canal_pruebaUltimoVideo", { a1: feed.youtube_channel_name, a2: latestVideo.title, a3: videoUrl }),
    });
    const canalClickeable = `<#${feed.channel_id}>`;
    await interaction.editReply({
      content: i18next.t("commands:youtube.interacciones.canal_test_pass", { a1: feed.youtube_channel_name, a2: canalClickeable }),
      flags: MessageFlags.Ephemeral
    });

    debug(`Prueba ejecutada para canal: ${feed.youtube_channel_name} en servidor ${guild.id}`, "YouTubeCommand");

  } catch (err) {
    error(`Error en prueba de canal: ${err}`, "YouTubeCommand");
    await interaction.editReply({ content: i18next.t("commands:youtube.interacciones.error"), flags: MessageFlags.Ephemeral });
  }
}

// =============== Helper =============== //

async function verifyYouTubeRss(rssUrl: string): Promise<{ isValid: boolean; channelName: string; error?: string }> {
  const parser = new Parser({
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    }
  });

  try {
    const feed = await parser.parseURL(rssUrl);
    if (!feed.title) {
      return {
        isValid: false,
        channelName: "Canal de YouTube",
        error: "El feed RSS no contiene un título de canal."
      };
    }

    return {
      isValid: true,
      channelName: feed.title
    };

  } catch (error) {
    let rawErrorMessage = error instanceof Error ? error.message : String(error);
    const lowerCaseMessage = rawErrorMessage.toLowerCase();
    let specificError: string;

    if (lowerCaseMessage.includes('404') || lowerCaseMessage.includes('not found')) {
      specificError = "error_404";
    } else if (lowerCaseMessage.includes('403') || lowerCaseMessage.includes('forbidden')) {
      specificError = "error_403";
    } else if (lowerCaseMessage.includes('timeout') || lowerCaseMessage.includes('timed out')) {
      specificError = "error_timeout";
    } else {
      specificError = `Error desconocido: ${rawErrorMessage}`; // Fallback por si es otro error
    }

    return {
      isValid: false,
      channelName: "Canal de YouTube",
      error: specificError
    };
  }
}

