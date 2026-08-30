// src/Events-Commands/commands/reddit.ts
import { ChannelSelectMenuBuilder, ChatInputCommandInteraction, EmbedBuilder, Guild, LabelBuilder, MessageFlags, ModalBuilder, ModalSubmitInteraction, PermissionFlagsBits, SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { addRedditFeed, getRedditFeeds, removeRedditFeed, RedditFeed } from "../../sys/DB-Engine/links/Reddit";
import { error, debug } from "../../sys/logging";
import { redditApi } from "../../sys/zGears/RedditApi";
import { hasPermission } from "../../sys/zGears/mPermission";
import i18next from "i18next";
import { masterPerm } from "../../sys/zGears/auxiliares";
import { getGuildLimits } from "../../sys/DB-Engine/links/noRules";
import { countItems } from "../../sys/DB-Engine/database";

export async function registerRedditCommand() {
    const reddit = new SlashCommandBuilder()
        .setName("reddit")
        .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
        .setDescription(i18next.t("commands:reddit.slashBuilder.command_reddit"))
        .addSubcommand(s => s.setName("seguir").setDescription(i18next.t("commands:reddit.slashBuilder.descripcion")))
        .addSubcommand(s => s.setName("lista").setDescription(i18next.t("commands:reddit.slashBuilder.lista")))
        .addSubcommand(s => s.setName("dejar").setDescription(i18next.t("commands:reddit.slashBuilder.dejar"))
            .addStringOption(o => o.setName("url_reddit").setRequired(true).setDescription(i18next.t("commands:reddit.slashBuilder.id_canal"))))
        .addSubcommand(s => s.setName("test").setDescription(i18next.t("commands:reddit.slashBuilder.test"))
            .addStringOption(o => o.setName("url_reddit").setRequired(true).setDescription(i18next.t("commands:reddit.slashBuilder.id_canal"))));
    return [reddit] as SlashCommandBuilder[];
}

export async function handleRedditCommand(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;
    if (!guild) { await interaction.reply(i18next.t("common:Errores.noGuild")); return };

    const isAllowed = await hasPermission(interaction, interaction.commandName);
    if (!isAllowed) { await interaction.reply(i18next.t("common:Errores.isAllowed")); return };

    try {
        const subcommand = interaction.options.getSubcommand();
        switch (subcommand) {
            case "seguir":
                await SeguiRedditModal(interaction);
                break;
            case "lista":
                await ListaReddit(interaction, guild);
                break;
            case "dejar":
                await DejarReddit(interaction, guild);
                break;
            case "test":
                await TestReddit(interaction, guild);
                break;
        }
    } catch (e) {
        error(`Error ejecutando comando Reddit: ${e}`);
        await interaction.reply({ content: i18next.t("common.Errores.switchGeneral") });
    }
}

// =============== SubSeguir =============== //

async function SeguiRedditModal(i: ChatInputCommandInteraction) {
    const chOp = new ChannelSelectMenuBuilder().setCustomId("canal").setPlaceholder("ej:#reddit-post").setRequired(true).setChannelTypes(0, 5, 10, 11, 12);
    const chMod = new LabelBuilder().setLabel('Canal o Hilo para enviar posts!').setChannelSelectMenuComponent(chOp);

    const userOp1 = new TextInputBuilder().setCustomId('url_reddit').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("ej: /r/all | /user/funalito");
    const userIn = new LabelBuilder().setLabel('subReddit | usuario').setTextInputComponent(userOp1);

    const typeCont = [
        { default: true, emoji: "🗃️", value: 'all', label: "Sin filtro" },
        { default: false, emoji: "📽️", value: 'media_only', label: "Solo contenido multimedia" },
        { default: false, emoji: "📄", value: 'text_only', label: "Solo texto" }
    ]

    const typePost = new StringSelectMenuBuilder().setCustomId("filtro")
        .setMinValues(1).setMaxValues(1).setPlaceholder("Filtro de tipo de contenido").setRequired(true)
        .addOptions(typeCont.map(l => new StringSelectMenuOptionBuilder().setLabel(l.label).setValue(l.value).setEmoji(l.emoji).setDefault(l.default)));
    const msgSend = new LabelBuilder().setLabel('Tipo de contenido a seguir').setStringSelectMenuComponent(typePost);

    const modal = new ModalBuilder().setCustomId(`reddiChk_${i.id}`).setTitle('Reddit - r/reddit | u/reddit').addLabelComponents(chMod, userIn, msgSend);
    await i.showModal(modal);
    // == // == // FINAL MODAL // == // == //
    const submitInt = await i.awaitModalSubmit({
        filter: (submitInt) => submitInt.customId === `reddiChk_${i.id}` && submitInt.user.id === i.user.id,
        time: 120_000, // 2 min
    }).catch((e: any) => {
        debug(`Modal Reddit error ${e.message}`)
        i.followUp({ content: '⏱️ ¡El formulario expiró después de 2 minutos; si fue intencional, ignora esta notificación!', flags: MessageFlags.Ephemeral });
    }) as ModalSubmitInteraction;
    if (!submitInt) return;

    try {
        await submitInt.deferReply({ flags: MessageFlags.Ephemeral });
        const guild = submitInt.guild!
        const rawfilter = submitInt.fields.getStringSelectValues("filtro")
        const urlReddit = submitInt.fields.getTextInputValue("url_reddit");
        const rawChannle = submitInt.fields.getSelectedChannels("canal", true).first();

        const channelOut = rawChannle ? (await guild.channels.fetch(rawChannle.id).catch(() => null)) : null;
        if (!channelOut) { await submitInt.editReply({ content: i18next.t("common:Errores.noChannel") }); return; }

        const discordChannel = guild.channels.cache.get(channelOut.id);
        if (!discordChannel || !discordChannel.isTextBased()) {
            await submitInt.editReply({ content: i18next.t("common:Errores.noChannel") });
            return;
        }

        const conty = await countItems(guild.id, "reddit_feeds");
        const limit = await getGuildLimits(guild.id);
        if ((conty >= limit.dexMax)) {
            await submitInt.editReply({ content: i18next.t("common:Errores.servLimit", { a1: conty, a2: limit.dexMax }) });
            return;
        }

        const testPerm = masterPerm(discordChannel, "viewCh|sendMsg|addlink")
        if (!testPerm.ok) { await submitInt.editReply({ content: i18next.t("common:Errores.missing_permissions", { a1: `<#${discordChannel.id}>`, a2: testPerm.msg.join('\n') }) }); return; }

        const checkIfNSFW = (channel: any): boolean => {
            if (!channel) return false;
            return 'nsfw' in channel ? Boolean(channel.nsfw) : false;
        }

        const resourceInfo = getRedditResourceInfo(urlReddit);
        if (!resourceInfo) {
            await submitInt.editReply({ content: i18next.t("commands:reddit.interacciones.subreddit_error") });
            return;
        }

        const nsfwStatus = checkIfNSFW(discordChannel);
        const { name: resourceName, displayName, endpoint, resourceType } = resourceInfo;
        const filterMode = (rawfilter[0] ?? 'all') as 'all' | 'media_only' | 'text_only';

        const response = await redditApi.fetchAuthenticated(endpoint);
        if (response.status === 404) {
            await submitInt.editReply({ content: i18next.t("commands:reddit.interacciones.add_not_found", { a1: resourceName }) });
            return;
        }

        const existingFeeds = await getRedditFeeds(guild.id);
        if (existingFeeds.some(feed => feed.subreddit_name.toLowerCase() === resourceName.toLowerCase())) {
            await submitInt.editReply({ content: i18next.t("commands:reddit.interacciones.duplicado", { a1: displayName }) });
            return;
        }

        let jsonUrl: string;
        if (resourceType === 'subreddit') {
            jsonUrl = `https://www.reddit.com/r/${resourceName}/new.json`;
        } else {
            jsonUrl = `https://www.reddit.com/user/${resourceName}/submitted.json`;
        }

        await addRedditFeed({
            guild_id: guild.id,
            channel_id: discordChannel.id,
            subreddit_name: resourceName, // Input de url si es tipo User o Subreddit
            subreddit_url: jsonUrl,
            last_post_id: null,
            filter_mode: filterMode, // Parche filtrado
            nsfw_protect: nsfwStatus
        });

        const filterToText = {
            all: i18next.t("commands:reddit.slashBuilder.sin_filtro"),
            media_only: i18next.t("commands:reddit.slashBuilder.filtro_multimedia"),
            text_only: i18next.t("commands:reddit.slashBuilder.filtro_texto")
        };
        const filterText = filterToText[filterMode] || i18next.t("commands:reddit.slashBuilder.sin_filtro");

        await submitInt.editReply({
            content: nsfwStatus
                ? i18next.t("commands:reddit.interacciones.seguir_success_nsfw", { a1: displayName, a2: discordChannel.toString(), a3: filterText })
                : i18next.t("commands:reddit.interacciones.seguir_success", { a1: displayName, a2: discordChannel.toString(), a3: filterText })
        });
        debug(`Se registro nuevo follow: ${displayName}`);

    } catch (e) {
        error(`Error al agreagar nuevo follow Reddit en gremio ${submitInt.guild!.name}: ${e}`);
        await submitInt.reply({ content: i18next.t("commands:reddit.interacciones.seguir_error") }).catch(() => null);
    }
}

// =============== SubList =============== //
async function ListaReddit(interaction: ChatInputCommandInteraction, guild: Guild) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const feeds = await getRedditFeeds(guild.id);

    if (feeds.length === 0) {
        await interaction.editReply({ content: i18next.t("commands:reddit.interacciones.lista_vacia") });
        return;
    }

    const feedsPorCanal = new Map<string, RedditFeed[]>();
    const guildName = guild.name;

    for (const feed of feeds) {
        if (!feedsPorCanal.has(feed.channel_id)) {
            feedsPorCanal.set(feed.channel_id, []);
        }
        feedsPorCanal.get(feed.channel_id)!.push(feed);
    }

    const embed = new EmbedBuilder()
        .setTitle(i18next.t("commands:reddit.interacciones.lista_titulo", { a1: feeds.length, a2: guildName }))
        .setColor(0xFF4500);

    for (const [canalId, grupo] of feedsPorCanal) {
        const canalClickeable = `<#${canalId}>`;
        const listaSubreddits = grupo.map(feed => {
            const displayName = feed.subreddit_url.includes('/user/') ? `u/${feed.subreddit_name}` : `r/${feed.subreddit_name}`;
            return `**${displayName}**`;
        })

        /* Mangadex nos enseño que a esto le podria pasar lo mismo */
        const TAMANO_BLOQUE = 40;
        for (let i = 0; i < listaSubreddits.length; i += TAMANO_BLOQUE) {
            const bloque = listaSubreddits.slice(i, i + TAMANO_BLOQUE).join('\n');
            const sufijo = listaSubreddits.length > TAMANO_BLOQUE ? ` (Parte ${Math.floor(i / TAMANO_BLOQUE) + 1})` : '';
            const nombreCampo = `#${canalClickeable} - ${sufijo}`;

            embed.addFields({
                name: i18next.t("commands:reddit.interacciones.lista_name", { a1: nombreCampo, a2: grupo.length }),
                value: bloque || i18next.t("commands:reddit.interacciones.lista_value"),
                inline: false,
            });
        }
    }

    embed.setFooter({ text: i18next.t("commands:reddit.interacciones.lista_footer") });
    await interaction.editReply({ embeds: [embed] });
}

// =============== SubDejar =============== //
async function DejarReddit(interaction: ChatInputCommandInteraction, guild: Guild) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const userInput = interaction.options.getString("url_reddit", true);
    const resourceInfo = getRedditResourceInfo(userInput);

    if (!resourceInfo) {
        await interaction.editReply({ content: i18next.t("commands:reddit.interacciones.url_invalida") });
        return;
    }

    const { name: resourceName, displayName } = resourceInfo;

    try {
        const removed = await removeRedditFeed(guild.id, resourceName);
        if (removed) {
            await interaction.editReply({ content: i18next.t("commands:reddit.interacciones.dejar_success", { a1: displayName }) });
            debug(`Follow eliminado: ${displayName}`);
        } else {
            await interaction.editReply({ content: i18next.t("commands:reddit.interacciones.dejar_error", { a1: displayName }) });
        }
    } catch (err) {
        error(`Error al eliminar: ${displayName}: ${err}`);
        await interaction.editReply({ content: i18next.t("commands:reddit.interacciones.borrarSubs_error") });
    }
}

// =============== SubTest =============== //
async function TestReddit(interaction: ChatInputCommandInteraction, guild: Guild) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const userInput = interaction.options.getString("url_reddit", true);
    const resourceInfo = getRedditResourceInfo(userInput);

    if (!resourceInfo) {
        await interaction.editReply({ content: i18next.t("commands:reddit.interacciones.test_url_invalida") });
        return;
    }

    const { name: resName, displayName: dspName, resourceType: resType } = resourceInfo;
    const feeds = await getRedditFeeds(guild.id);
    const feed = feeds.find(f => f.subreddit_name.toLowerCase() === resName.toLowerCase());

    if (!feed) {
        await interaction.editReply({ content: i18next.t("commands:reddit.interacciones.test_subreddit_error") });
        return;
    }

    await interaction.editReply({ content: i18next.t("commands:reddit.interacciones.test_buscando", { a1: dspName }) });

    try {
        const jsonData = await redditApi.getPosts(resName, resType, 3);
        const latestPostData = jsonData.data.children[0]?.data;

        if (!latestPostData) {
            await interaction.editReply({ content: i18next.t("commands:reddit.interacciones.test_noposts") });
            return;
        }
        const canalClickeable = `<#${feed.channel_id}>`;
        const channel = guild.channels.cache.get(feed.channel_id);
        if (!channel || !channel.isTextBased()) {
            await interaction.editReply({ content: i18next.t("common:Errores.noChannel", { a1: canalClickeable }) });
            return;
        }

        const permalink = latestPostData.permalink;

        const formattedUrl = `https://www.reddit.com${permalink}`;

        await channel.send(i18next.t("commands:reddit.interacciones.test_ultimoPost", { a1: dspName, a2: latestPostData.title, a3: formattedUrl }));

        await interaction.editReply({
            content: i18next.t("commands:reddit.interacciones.test_pass", { a1: canalClickeable })
        });

    } catch (err) {
        error(`Error en prueba de ${dspName}: ${err}`);
        await interaction.editReply({ content: i18next.t("commands:reddit.interacciones.test_error") });
    }
}

// =============== Helpers =============== //
function getRedditResourceInfo(input: string): { name: string; displayName: string; endpoint: string; resourceType: 'subreddit' | 'user'; } | null {
    const getNameReddit = (url: string) => {
        try {
            const urlObject = new URL(url);
            const subredditMatch = urlObject.pathname.match(/\/r\/([a-zA-Z0-9_-]+)/);
            const userMatch = urlObject.pathname.match(/\/user\/([a-zA-Z0-9_-]+)/);

            if (subredditMatch) return subredditMatch[1];
            if (userMatch) return userMatch[1];
        } catch (e) { /*regresado, aun que parece inutil esto sirve para algo*/ }

        const urlMatch = url.match(/(?:reddit\.com\/(?:r|user)\/|^(?:r|u)\/)([a-zA-Z0-9_-]+)/);
        if (urlMatch) return urlMatch[1];

        const rSlashMatch = url.match(/^(?:r|u)\/([a-zA-Z0-9_-]+)$/);
        if (rSlashMatch) return rSlashMatch[1];

        const simpleMatch = url.match(/^[a-zA-Z0-9_-]+$/);
        if (simpleMatch) return simpleMatch[0];

        return null;
    }

    const name = getNameReddit(input);
    if (!name) return null;

    let displayName: string;
    let endpoint: string;
    let resourceType: 'subreddit' | 'user';  //pusimos sauceType en vez de resourceType

    if (input.includes('/user/') || input.startsWith('u/')) {
        displayName = `u/${name}`;
        endpoint = `/user/${name}`; // Para la API autenticada
        resourceType = `user`;
    } else {
        displayName = `r/${name}`;
        endpoint = `/r/${name}`; // Para la API autenticada
        resourceType = `subreddit`;
    }

    return { name, displayName, endpoint, resourceType };
}
