// src/Events-Commands/commands/mangadex.ts
import { ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, TextChannel, EmbedBuilder, ChannelType } from "discord.js";
import { AddMangadexFeed, getMangadexFeeds, MangadexFeed, removeMangadexFeed} from "../../sys/DB-Engine/links/Mangadex"; // Asumo que esto ya existe
import { error, debug } from "../../sys/logging";
import { hasPermission } from "../../sys/zGears/mPermission";
import i18next from "i18next";

function getMangadexId(input: string): string | null {
    try {
        const urlObject = new URL(input);
        const match = urlObject.pathname.match(/\/title\/([a-zA-Z0-9-]+)/);
        if (match) return match[1];
    } catch (e) { /* por si falla este metodo como en /reddit */}

    const regex = /mangadex\.org\/title\/([a-zA-Z0-9-]+)/;
    const match = input.match(regex);
    if (match) return match[1];
    
    return null;
}

async function verifyMangadexFeed(rssUrl: string): Promise<string | null> {
    try {
        const response = await fetch(rssUrl, {
            headers: { 'User-Agent': 'MeltryllisBot/1.2.7' }
        });

        if (!response.ok) {
            debug(`[Mangadex] Error HTTP ${response.status} al verificar RSS` );
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
        debug(`Error verificando RSS de Mangadex: ${err}` );
        return null;
    }
}

export async function registerMangadexCommand() {
  const mangadex = new SlashCommandBuilder()
    .setName("mangadex")
    .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
    .setDescription(i18next.t("mangadex:slashBuilder.mangadex"))
    .addSubcommand(subcommand =>
      subcommand
        .setName("seguir")
        .setDescription(i18next.t("mangadex:slashBuilder.mangadex_descripcion"))
        .addStringOption(option =>
          option.setName("manga_url")
            .setDescription(i18next.t("mangadex:slashBuilder.mangadex_seguir"))
            .setRequired(true)
        )
        .addChannelOption(option =>
          option.setName("canal")
            .setDescription(i18next.t("mangadex:slashBuilder.mangadex_canal"))
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.PrivateThread, ChannelType.PublicThread, ChannelType.GuildAnnouncement)
        )
        .addStringOption(option =>
          option.setName("idioma")
            .setDescription(i18next.t("mangadex:slashBuilder.mangadex_idioma"))
            .setRequired(true)
            .addChoices(
              { name: "Inglés", value: "en" },
              { name: "Español (España)", value: "es" },
              { name: "Español (Latino)", value: "es-la"},
              { name: "Todos / Original", value: "any" }
            )
        )
    )
    .addSubcommand(subcommand =>
        subcommand
          .setName("lista")
          .setDescription(i18next.t("mangadex:slashBuilder.mangadex_lista_desc", { defaultValue: "Ver mangas seguidos" }))
    )
    .addSubcommand(subcommand =>
        subcommand
          .setName("dejar")
          .setDescription(i18next.t("mangadex:slashBuilder.mangadex_dejar_desc", { defaultValue: "Dejar de seguir un manga" }))
          .addStringOption(option =>
            option.setName("id_manga")
              .setDescription(i18next.t("mangadex:slashBuilder.mangadex_dejar_url", { defaultValue: "URL del manga a eliminar" }))
              .setRequired(true)
          )
    );

    return [mangadex] as SlashCommandBuilder[];
}

export async function handleMangadexCommand(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const isAllowed = await hasPermission(interaction, interaction.commandName);
    if (!isAllowed) {
        await interaction.editReply({
            content: i18next.t("common:Errores.isAllowed"),
        });
        return;
    }
    
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild!.id;

    try {
        switch (subcommand) {
            case "seguir":
            await seguirManga(interaction, guildId);
        break;
            case "lista":
            await listaManga(interaction, guildId);
        break;
            case "dejar":
            await dejarManga(interaction, guildId);
        break;
    }
  } catch (err) {
    error(`Error ejecutando comando Mangadex: ${err}`);
    await interaction.editReply({ content: i18next.t("mangadex:interacciones.command_error")});
  }
}

// =============== SubSeguir =============== //

async function seguirManga(interaction: ChatInputCommandInteraction, guildId: string) {
    const manga_url = interaction.options.getString("manga_url", true);
    const discordChannelInput = interaction.options.getChannel("canal", true);
    const langChoice = interaction.options.getString("idioma", true);

    const discordChannel = interaction.guild!.channels.cache.get(discordChannelInput.id) as TextChannel;
    if (!discordChannel || !discordChannel.isTextBased()) {
        await interaction.editReply({ content: i18next.t("mangadex:interacciones.reddit_canal_error")});
        return;
    }

    const mangaId = getMangadexId(manga_url);
    if (!mangaId) {
        await interaction.editReply({ content: "❌ URL de Mangadex inválida. Asegúrate de copiar el link del manga, no de un capítulo." });
        return;
    }

    let rssUrl = `https://mdrss.tijlvdb.me/feed?q=manga:${mangaId}`
    
    if (langChoice !== "any") {
        rssUrl += `,tl:${langChoice}`;
    }

    const mangaName = await verifyMangadexFeed(rssUrl);

    if (!mangaName) {
        await interaction.editReply({ content: "❌ No se pudo conectar con Mangadex o el manga no existe/no tiene capítulos en ese idioma." });
        return;
    }

    try {
        await AddMangadexFeed({
            guild_id: guildId,
            channel_id: discordChannel.id,
            RSS_manga: rssUrl,
            mangaUrl: manga_url,
            language: langChoice,
            manga_title: mangaName,
            last_chapter: null
        });

        await interaction.editReply({ 
            content: i18next.t("mangadex:interacciones.seguir_success", { a1: mangaName, a2: discordChannel.toString() }),
        });
        
        debug(`Nuevo manga seguido: ${mangaName} (${langChoice}) en ${guildId}`);

    } catch (err: any) {
    error(`Error BD Mangadex: ${err}` );

    const isDuplicateError = 
        err.code === 'ER_DUP_ENTRY' || 
        err.sqlMessage?.includes('Duplicate entry') ||
        err.message?.includes('Duplicate entry') ||
        err.message?.includes('idx_unique_rss_guild_channel');
    
    if (isDuplicateError) {
        await interaction.editReply({ content: i18next.t("mangadex:interacciones.seguir_existente_error") });
        return;
    }
    await interaction.editReply({ content: i18next.t("mangadex:interacciones.seguir_error")});
}}

// =============== Lista =============== //

async function listaManga(interaction: ChatInputCommandInteraction, guildId: string) {
    const feeds = await getMangadexFeeds(guildId);

    if (!feeds || feeds.length === 0) {
        await interaction.editReply({ content: i18next.t("mangadex:interacciones.lista_vacia") });
        return;
    }
    const feedsPorCanal = new Map<string, { canalName: string, feeds: MangadexFeed[] }>();
    const guildName = interaction.guild!.name;
    
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
        .setTitle(i18next.t("mangadex:interacciones.manga_embed_titulo", { a1: guildName }))
        .setDescription(i18next.t("mangadex:interacciones.manga_embed_descripcion", { a1: feeds.length}))
        .setColor(0xFF6740);

    for (const [channelId, grupo] of feedsPorCanal) {
        const urlchannel = `https://discord.com/channels/${guildId}/${channelId}`;
        const lineas = grupo.feeds.map(feed => {
            const originalName = feed.manga_title ?? "Sin Título";
            const shortTitle = originalName.length > 50 ? originalName.substring(0, 50) + "..." : originalName;
            const flag = feed.language === 'es' ? '🇪🇸' : feed.language === 'es-la' ? '🇲🇽' : feed.language === 'en' ? '🇺🇸' : '🌐';
            return i18next.t("mangadex:interacciones.manga_embed_list_entry",{a1: feed.id, a2: shortTitle, a3: flag});
        });

        /* Seccionador de embeds */
        const TAMANO_BLOQUE = 12;         
        for (let i = 0; i < lineas.length; i += TAMANO_BLOQUE) {
            const bloque = lineas.slice(i, i + TAMANO_BLOQUE).join('\n');
            const sufijo = lineas.length > TAMANO_BLOQUE ? ` (Parte ${Math.floor(i/TAMANO_BLOQUE) + 1})` : '';
            const nombreCampo = `${urlchannel} - ${sufijo}`;

            embed.addFields({
                name: nombreCampo, 
                value: bloque || i18next.t("mangadex:interacciones.manga_embed_list_value"),
                inline: false
            });
        }
    }

    embed.setFooter({text: i18next.t("mangadex:interacciones.manga_embed_footer")});

    await interaction.editReply({ embeds: [embed] });
}

// =============== Dejar =============== //

async function dejarManga(interaction: ChatInputCommandInteraction, guildId: string) {
  const mangaIdToDelete = interaction.options.getString("id_manga", true);
  
  try {
    const removed = await removeMangadexFeed(guildId, mangaIdToDelete);
    
    if (removed) {
      await interaction.editReply({ content: i18next.t("mangadex:interacciones.dejar_exito")});
      debug(`Manga eliminado: ${mangaIdToDelete} del servidor ${guildId}` );
    } else {
      await interaction.editReply({ content: i18next.t("mangadex:interacciones.dejar_fallo")});
    }
  } catch (err) {
    error(`Error eliminando manga: ${err}` );
    await interaction.editReply({ content: i18next.t("mangadex:interacciones.error") });
  }
}
