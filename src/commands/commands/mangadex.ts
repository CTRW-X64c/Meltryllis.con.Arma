// src/Events-Commands/commands/mangadex.ts
import { ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, TextChannel, EmbedBuilder, Guild, LabelBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputStyle, TextInputBuilder, ChannelSelectMenuBuilder, ModalBuilder, ModalSubmitInteraction } from "discord.js";
import { AddMangadexFeed, getMangadexFeeds, MangadexFeed, removeMangadexFeed } from "../../sys/DB-Engine/links/Mangadex"; // Asumo que esto ya existe
import { error, debug } from "../../sys/logging";
import { hasPermission } from "../../sys/zGears/mPermission";
import i18next from "i18next";
import { masterPerm } from "../../sys/zGears/auxiliares";
import { getGuildLimits } from "../../sys/DB-Engine/links/noRules";
import { countItems } from "../../sys/DB-Engine/database";

export async function registerMangadexCommand() {
  const mangadex = new SlashCommandBuilder()
    .setName("mangadex")
    .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
    .setDescription(i18next.t("commands:mangadex.slashBuilder.mangadex"))
    .addSubcommand(s => s.setName("seguir").setDescription(i18next.t("commands:mangadex.slashBuilder.mangadex_descripcion")))
    .addSubcommand(s => s.setName("lista").setDescription(i18next.t("commands:mangadex.slashBuilder.mangadex_lista_desc", { defaultValue: "Ver mangas seguidos" })))
    .addSubcommand(s => s.setName("dejar").setDescription(i18next.t("commands:mangadex.slashBuilder.mangadex_dejar_desc", { defaultValue: "Dejar de seguir un manga" })).addStringOption(option =>
      option.setName("id_manga").setDescription(i18next.t("commands:mangadex.slashBuilder.mangadex_dejar_url", { defaultValue: "URL del manga a eliminar" })).setRequired(true)
    ));
  return [mangadex] as SlashCommandBuilder[];
}

export async function handleMangadexCommand(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply(i18next.t("common:Errores.noGuild"));
    return;
  }

  const isAllowed = await hasPermission(interaction, interaction.commandName);
  if (!isAllowed) {
    await interaction.reply({
      content: i18next.t("common:Errores.isAllowed"),
    });
    return;
  }

  try {
    const subcommand = interaction.options.getSubcommand();
    switch (subcommand) {
      case "seguir":
        await seguirManga(interaction);
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

// ============================== SubSeguir ============================== //
async function seguirManga(i: ChatInputCommandInteraction) {
  // Manga ID
  const userOp1 = new TextInputBuilder().setCustomId('manga_url').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("Pega la URL completa del manga");
  const userIn = new LabelBuilder().setLabel('ID del Manga').setTextInputComponent(userOp1);
  // Channel
  const chOp1 = new ChannelSelectMenuBuilder().setCustomId("canal").setPlaceholder("ej:#mangadex_follows ").setRequired(true).setChannelTypes(0, 5, 10, 11, 12);
  const chIn = new LabelBuilder().setLabel('Canal o Hilo a enviar!').setChannelSelectMenuComponent(chOp1);
  // Menu Solomedia
  const langsLsi = [
    { label: "Español Latino", value: "es-la", emoji: "🇲🇽" }, { label: "Español", value: "es", emoji: "🇪🇸" },
    { label: "Ingles", value: "en", emoji: "🇺🇸" },
    { label: "Portugués Brasileño", value: "pt-br", emoji: "🇧🇷" }, { label: "Portugués", value: "pt", emoji: "🇵🇹" },
    { label: "Italiano", value: "it", emoji: "🇮🇹" },
    { label: "Ruso", value: "ru", emoji: "🇷🇺" },
    { label: "Coreano", value: "ko", emoji: "🇰🇷" },
    { label: "Chino", value: "zh", emoji: "🇨🇳" },
    { label: "Japones", value: "ja", emoji: "🇯🇵" },
  ];

  const langMenu = new StringSelectMenuBuilder().setCustomId("idiomas")
    .setMinValues(1).setMaxValues(6).setPlaceholder("Default: sin filtro. Max: 6").setRequired(false)
    .addOptions(langsLsi.map(l => new StringSelectMenuOptionBuilder().setLabel(l.label).setValue(l.value).setEmoji(l.emoji)));
  const langs = new LabelBuilder().setLabel('Idioma del Manga').setStringSelectMenuComponent(langMenu);
  // Out
  const modal = new ModalBuilder().setCustomId(`mangaDex_${i.id}`).setTitle('Configurar Follow de Mangadex').addLabelComponents(userIn, chIn, langs);
  await i.showModal(modal);
  // == // == // FINAL MODAL // == // == //
  const submitInt = await i.awaitModalSubmit({
    filter: (submitInt) => submitInt.customId === `mangaDex_${i.id}` && submitInt.user.id === i.user.id,
    time: 120_000, // 2 min
  }).catch((e: any) => {
    debug(`Modal Mangadex error ${e.message}`)
    i.followUp({ content: '⏱️ ¡El formulario expiró después de 2 minutos; si fue intencional, ignora esta notificación!', flags: MessageFlags.Ephemeral });
  }) as ModalSubmitInteraction;
  if (!submitInt) return;

  try {
    await submitInt.deferReply({ flags: MessageFlags.Ephemeral });
    const guild = submitInt.guild!;
    const manga_url = submitInt.fields.getTextInputValue("manga_url");
    const langModal = submitInt.fields.getStringSelectValues("idiomas");
    // chek CH
    const discModalInput = submitInt.fields.getSelectedChannels("canal", true).first();
    const discordChannel = discModalInput ? await guild.channels.fetch(discModalInput.id) as TextChannel : null;
    if (!discordChannel) { await submitInt.editReply({ content: i18next.t("common:Errores.nochannelFind") }); return; }
    // chek Limit
    const conty = await countItems(guild.id, "mangadex_feeds");
    const limit = await getGuildLimits(guild.id);
    if ((conty >= limit.dexMax)) { await submitInt.editReply({ content: i18next.t("common:Errores.servLimit", { a1: conty, a2: limit.dexMax }) }); return; }
    // chek Perm
    const testPerm = masterPerm(discordChannel, "viewCh|sendMsg|addlink")
    if (!testPerm.ok) { await submitInt.editReply({ content: i18next.t("common:Errores.missing_permissions", { a1: `<#${discordChannel.id}>`, a2: testPerm.msg.join('\n') }) }); return; }
    // chek Ids
    const mangDex = getMangaId(manga_url);
    if (!mangDex.id || !mangDex.shortUrl) { await submitInt.editReply({ content: i18next.t("commands:mangadex.interacciones.manga_error") }); return; }
    // chek Rss
    const { rssUrl, bdLangs } = buildRssUrl(mangDex.id, langModal);
    const mangaName = await chkManga(rssUrl);
    if (!mangaName) { await submitInt.editReply({ content: i18next.t("commands:mangadex.interacciones.manga_error_no_dex") }); return; }

    await AddMangadexFeed({
      guild_id: guild.id,
      channel_id: discordChannel.id,
      RSS_manga: rssUrl,
      mangaUrl: mangDex.shortUrl,
      language: bdLangs,
      manga_title: mangaName
    });

    const emb = new EmbedBuilder()
      .setTitle("Mangadex - Nuevo manga añadido!!")
      .addFields(
        { name: "Manga: ", value: mangaName },
        { name: "Canal: ", value: `<#${discordChannel.id}>` },
        { name: "Idiomas", value: bdLangs === "any" ? "🌐 Sin filtro!" : `${getFlags(bdLangs)}` },
        { name: "URL: ", value: mangDex.shortUrl }
      )
      .setColor(0xFF6740)
      .setTimestamp();

    await submitInt.editReply({ embeds: [emb] });
    debug(`Nuevo manga seguido: ${mangaName} en ${guild.name}`);

  } catch (err: any) {
    error(`Error BD Mangadex: ${err}`);
    const isDuplicateError = err.code === 'ER_DUP_ENTRY' || err.sqlMessage?.includes('Duplicate entry') || err.message?.includes('Duplicate entry') || err.message?.includes('idx_unique_rss_guild_channel');
    if (isDuplicateError) { await submitInt.reply({ content: i18next.t("commands:mangadex.interacciones.seguir_existente_error") }); return; }
    await submitInt.reply({ content: i18next.t("commands:mangadex.interacciones.seguir_error") }).catch(() => null);
  }
}

// ============================== Lista ============================== //
async function listaManga(interaction: ChatInputCommandInteraction, guild: Guild) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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

// ============================== Dejar ============================== //

async function dejarManga(interaction: ChatInputCommandInteraction, guild: Guild) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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

// ============================== Aux ============================== //
function getFlags(f: string): string {
  const lngA = f.split(',');
  const flagsMap: Record<string, string> = { 'es': '🇪🇸', 'es-la': '🇲🇽', 'en': '🇺🇸', 'pt': '🇧🇷', 'pt-br': '🇧🇷', 'ja': '🇯🇵', 'ko': '🇰🇷', 'zh': '🇨🇳', 'fr': '🇫🇷', 'it': '🇮🇹', 'ru': '🇷🇺' };
  const flags = lngA.map(lang => flagsMap[lang.trim()] || '').filter(Boolean).join(' ');
  return flags;
}
// === mangaId === //
function getMangaId(url: string) {
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
// === rssUrl === //
function buildRssUrl(mangaId: string, langList: readonly string[]): { rssUrl: string; bdLangs: string } {
  let rssUrl = `https://mdrss.tijlvdb.me/feed?q=manga:${mangaId}`;
  let bdLangs = "any";
  if (langList.length > 0) {
    rssUrl += `,tl:${langList.join(',tl:')}`;
    bdLangs = langList.join(',');
  }
  return { rssUrl, bdLangs };
}
// === verifiManga === //
async function chkManga(url: string) {
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