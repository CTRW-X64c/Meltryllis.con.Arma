// src/Events-Commands/commands/mangadex.ts
import { ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, TextChannel, EmbedBuilder, ChannelType, Guild } from "discord.js";
import { AddMangadexFeed, getMangadexFeeds, MangadexFeed, removeMangadexFeed } from "../../sys/DB-Engine/links/Mangadex"; // Asumo que esto ya existe
import { error, debug } from "../../sys/logging";
import { hasPermission } from "../../sys/zGears/mPermission";
import i18next from "i18next";
import { testPermisos } from "../../sys/zGears/auxiliares";
import { getGuildLimits } from "../../sys/DB-Engine/links/noRules";
import { countItems } from "../../sys/DB-Engine/database";

const langsList = [
  { name: "Inglés", value: "en" },
  { name: "Español", value: "es" },
  { name: "Español Latino", value: "es-la" },
  { name: "Portugués", value: "pt" },
  { name: "Portugués Brasileño", value: "pt-br" },
  { name: "Japones", value: "ja" },
  { name: "Coreano", value: "ko" },
  { name: "Chino", value: "zh" },
  { name: "Francés", value: "fr" },
  { name: "Italiano", value: "it" },
  { name: "Ruso", value: "ru" }
];

export async function registerMangadexCommand() {
  const mangadex = new SlashCommandBuilder()
    .setName("mangadex")
    .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
    .setDescription(i18next.t("commands:mangadex.slashBuilder.mangadex"))
    .addSubcommand(subcommand =>
      subcommand
        .setName("seguir")
        .setDescription(i18next.t("commands:mangadex.slashBuilder.mangadex_descripcion"))
        .addStringOption(option =>
          option.setName("manga_url")
            .setDescription(i18next.t("commands:mangadex.slashBuilder.mangadex_seguir"))
            .setRequired(true)
        )
        .addChannelOption(option =>
          option.setName("canal")
            .setDescription(i18next.t("commands:mangadex.slashBuilder.mangadex_canal"))
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.PrivateThread, ChannelType.PublicThread, ChannelType.GuildAnnouncement)
        )
        .addStringOption(option =>
          option.setName("idioma")
            .setDescription(i18next.t("commands:mangadex.slashBuilder.mangadex_idioma"))
            .setRequired(true)
            .addChoices({ name: "Sin filtro", value: "any" }, ...langsList)
        )
        .addStringOption(option =>
          option.setName("add_idioma_1")
            .setDescription(i18next.t("commands:mangadex.slashBuilder.mangadex_idioma_add"))
            .setRequired(false)
            .addChoices(langsList)
        )
        .addStringOption(option =>
          option.setName("add_idioma_2")
            .setDescription(i18next.t("commands:mangadex.slashBuilder.mangadex_idioma_add"))
            .setRequired(false)
            .addChoices(langsList)
        )
        .addStringOption(option =>
          option.setName("add_idioma_3")
            .setDescription(i18next.t("commands:mangadex.slashBuilder.mangadex_idioma_add"))
            .setRequired(false)
            .addChoices(langsList)
        )
        .addStringOption(option =>
          option.setName("add_idioma_4")
            .setDescription(i18next.t("commands:mangadex.slashBuilder.mangadex_idioma_add"))
            .setRequired(false)
            .addChoices(langsList)
        )
        .addStringOption(option =>
          option.setName("add_idioma_5")
            .setDescription(i18next.t("commands:mangadex.slashBuilder.mangadex_idioma_add"))
            .setRequired(false)
            .addChoices(langsList)
        )
        .addStringOption(option =>
          option.setName("add_idioma_6")
            .setDescription(i18next.t("commands:mangadex.slashBuilder.mangadex_idioma_add"))
            .setRequired(false)
            .addChoices(langsList)
        )
        .addStringOption(option =>
          option.setName("add_idioma_7")
            .setDescription(i18next.t("commands:mangadex.slashBuilder.mangadex_idioma_add"))
            .setRequired(false)
            .addChoices(langsList)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("lista")
        .setDescription(i18next.t("commands:mangadex.slashBuilder.mangadex_lista_desc", { defaultValue: "Ver mangas seguidos" }))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("dejar")
        .setDescription(i18next.t("commands:mangadex.slashBuilder.mangadex_dejar_desc", { defaultValue: "Dejar de seguir un manga" }))
        .addStringOption(option =>
          option.setName("id_manga")
            .setDescription(i18next.t("commands:mangadex.slashBuilder.mangadex_dejar_url", { defaultValue: "URL del manga a eliminar" }))
            .setRequired(true)
        )
    );

  return [mangadex] as SlashCommandBuilder[];
}

export async function handleMangadexCommand(interaction: ChatInputCommandInteraction) {
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
    });
    return;
  }

  try {
    const subcommand = interaction.options.getSubcommand();
    switch (subcommand) {
      case "seguir":
        await seguirManga(interaction, guild);
        break;
      case "lista":
        await listaManga(interaction, guild);
        break;
      case "dejar":
        await dejarManga(interaction, guild);
        break;
    }
  } catch (err) {
    error(`Error ejecutando comando Mangadex: ${err}`);
    await interaction.editReply({ content: i18next.t("commands:mangadex.interacciones.command_error") });
  }
}

// =============== SubSeguir =============== //

async function seguirManga(interaction: ChatInputCommandInteraction, guild: Guild) {
  const manga_url = interaction.options.getString("manga_url", true);
  const discordChannelInput = interaction.options.getChannel("canal", true);
  const langChoice = interaction.options.getString("idioma", true);
  const additionalLangs = [
    interaction.options.getString("add_idioma_1"),
    interaction.options.getString("add_idioma_2"),
    interaction.options.getString("add_idioma_3"),
    interaction.options.getString("add_idioma_4"),
    interaction.options.getString("add_idioma_5"),
    interaction.options.getString("add_idioma_6"),
    interaction.options.getString("add_idioma_7"),
  ];

  const discordChannel = guild.channels.cache.get(discordChannelInput.id) as TextChannel;
  if (!discordChannel || !discordChannel.isTextBased()) {
    await interaction.editReply({ content: i18next.t("commands:mangadex.interacciones.reddit_canal_error") });
    return;
  }

  const conty = await countItems(guild.id, "mangadex_feeds");
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

  const getMangaId = (url: string) => {
    if (!url)
      try {
        const urlObject = new URL(url);
        const match = urlObject.pathname.match(/\/title\/([a-zA-Z0-9-]+)/);
        if (match && match[1]) {
          const urlMnaga = `https://mangadex.org/title/${match[1]}`;
          return { id: match[1], shortUrl: urlMnaga };
        }
      } catch (e) { /* por si falla este metodo como en /reddit */ }
    const regex = /mangadex\.org\/title\/([a-zA-Z0-9-]+)/;
    const match = url.match(regex);
    if (match && match[1]) return { id: match[1], shortUrl: `https://mangadex.org/title/${match[1]}` };
    return { id: null, shortUrl: null };
  }

  const mangDex = getMangaId(manga_url);
  if (!mangDex.id || !mangDex.shortUrl) {
    await interaction.editReply({ content: i18next.t("commands:mangadex.interacciones.manga_error") });
    return;
  }

  const buildRssUrl = (mangaId: string, langChoice: string, additionalLangs: (string | null)[]): { rssUrl: string; bdLangs: string } => {
    let rssUrl = `https://mdrss.tijlvdb.me/feed?q=manga:${mangaId}`;
    let bdLangs = "any";
    const langSelect = [langChoice, ...additionalLangs]
      .filter((fLang): fLang is string => fLang !== null && fLang !== undefined)
      .filter((v, i, s) => s.indexOf(v) === i);

    if (langChoice !== "any") {
      rssUrl += `,tl:${langSelect.join(',tl:')}`;
      bdLangs = langSelect.join(',');
    }
    return { rssUrl, bdLangs };
  }
  const { rssUrl, bdLangs } = buildRssUrl(mangDex.id, langChoice, additionalLangs);

  const chkManga = async (url: string) => {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'MeltryllisBot/1.2.7' }
      });

      if (!response.ok) {
        debug(`[Mangadex] Error HTTP ${response.status} al verificar RSS`);
        return null;
      }

      const xmlText = await response.text();
      const channelTitleMatch = xmlText.match(/<title>(.*?)<\/title>/);
      if (channelTitleMatch && channelTitleMatch[1]) {
        let cleanTitle = channelTitleMatch[1];
        cleanTitle = cleanTitle.replace(/^MDRSS\s?-\s?/, '');
        cleanTitle = cleanTitle.replace('<![CDATA[', '').replace(']]>', '');
        return cleanTitle.trim();
      }

      return "Manga Desconocido";
    } catch (err) {
      debug(`Error verificando RSS de Mangadex: ${err}`);
      return null;
    }
  }

  const mangaName = await chkManga(rssUrl);
  if (!mangaName) {
    await interaction.editReply({ content: i18next.t("commands:mangadex.interacciones.manga_error_no_dex") });
    return;
  }

  try {
    await AddMangadexFeed({
      guild_id: guild.id,
      channel_id: discordChannel.id,
      RSS_manga: rssUrl,
      mangaUrl: mangDex.shortUrl,
      language: bdLangs,
      manga_title: mangaName,
      last_chapter: null
    });

    await interaction.editReply({
      content: i18next.t("commands:mangadex.interacciones.seguir_success", { a1: mangaName, a2: discordChannel.toString() }),
    });

    debug(`Nuevo manga seguido: ${mangaName} (${langChoice}) en ${guild.name}`);

  } catch (err: any) {
    error(`Error BD Mangadex: ${err}`);

    const isDuplicateError =
      err.code === 'ER_DUP_ENTRY' ||
      err.sqlMessage?.includes('Duplicate entry') ||
      err.message?.includes('Duplicate entry') ||
      err.message?.includes('idx_unique_rss_guild_channel');

    if (isDuplicateError) {
      await interaction.editReply({ content: i18next.t("commands:mangadex.interacciones.seguir_existente_error") });
      return;
    }
    await interaction.editReply({ content: i18next.t("commands:mangadex.interacciones.seguir_error") });
  }
}

// =============== Lista =============== //

async function listaManga(interaction: ChatInputCommandInteraction, guild: Guild) {
  const feeds = await getMangadexFeeds(guild.id);

  if (!feeds || feeds.length === 0) {
    await interaction.editReply({ content: i18next.t("commands:mangadex.interacciones.lista_vacia") });
    return;
  }
  const feedsPorCanal = new Map<string, { canalName: string, feeds: MangadexFeed[] }>();
  const guildName = guild.name;

  for (const feed of feeds) {
    const channelId = feed.channel_id;

    if (!feedsPorCanal.has(channelId)) {
      const channel = interaction.guild?.channels.cache.get(channelId);
      feedsPorCanal.set(channelId, {
        canalName: channel ? channel.name : channelId,
        feeds: []
      });
    }
    feedsPorCanal.get(channelId)!.feeds.push(feed);
  }

  const embed = new EmbedBuilder()
    .setTitle(i18next.t("commands:mangadex.interacciones.manga_embed_titulo", { a1: guildName }))
    .setDescription(i18next.t("commands:mangadex.interacciones.manga_embed_descripcion", { a1: feeds.length }))
    .setColor(0xFF6740);

  for (const [channelId, grupo] of feedsPorCanal) {
    const urlchannel = `https://discord.com/channels/${guild.id}/${channelId}`;
    const lineas = grupo.feeds.map(feed => {
      const originalName = feed.manga_title ?? "Sin Título";
      const shortTitle = originalName.length > 50 ? originalName.substring(0, 50) + "..." : originalName;
      const getFlags = (f: string) => {
        const lngA = f.split(',');
        const flagsMap: Record<string, string> = { 'es': '🇪🇸', 'es-la': '🇲🇽', 'en': '🇺🇸', 'pt': '🇧🇷', 'pt-br': '🇧🇷', 'ja': '🇯🇵', 'ko': '🇰🇷', 'zh': '🇨🇳', 'fr': '🇫🇷', 'it': '🇮🇹', 'ru': '🇷🇺' };
        const flags = lngA.map(lang => flagsMap[lang.trim()] || '').filter(Boolean).join(' ');
        return flags;
      }
      const flag = getFlags(feed.language);
      return i18next.t("commands:mangadex.interacciones.manga_embed_list_entry", { a1: feed.id, a2: shortTitle, a3: flag });
    });

    /* Seccionador de embeds */
    const TAMANO_BLOQUE = 12;
    for (let i = 0; i < lineas.length; i += TAMANO_BLOQUE) {
      const bloque = lineas.slice(i, i + TAMANO_BLOQUE).join('\n');
      const sufijo = lineas.length > TAMANO_BLOQUE ? ` (Parte ${Math.floor(i / TAMANO_BLOQUE) + 1})` : '';
      const nombreCampo = `${urlchannel} - ${sufijo}`;

      embed.addFields({
        name: nombreCampo,
        value: bloque || i18next.t("commands:mangadex.interacciones.manga_embed_list_value"),
        inline: false
      });
    }
  }

  embed.setFooter({ text: i18next.t("commands:mangadex.interacciones.manga_embed_footer") });

  await interaction.editReply({ embeds: [embed] });
}

// =============== Dejar =============== //

async function dejarManga(interaction: ChatInputCommandInteraction, guild: Guild) {
  const mangaIdToDelete = interaction.options.getString("id_manga", true);

  try {
    const removed = await removeMangadexFeed(guild.id, mangaIdToDelete);

    if (removed) {
      await interaction.editReply({ content: i18next.t("commands:mangadex.interacciones.dejar_exito") });
      debug(`Manga eliminado: ${mangaIdToDelete} del servidor ${guild.id}`);
    } else {
      await interaction.editReply({ content: i18next.t("commands:mangadex.interacciones.dejar_fallo") });
    }
  } catch (err) {
    error(`Error eliminando manga: ${err}`);
    await interaction.editReply({ content: i18next.t("commands:mangadex.interacciones.error") });
  }
}
