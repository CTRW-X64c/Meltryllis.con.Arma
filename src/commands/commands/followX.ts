import { ChannelSelectMenuBuilder, ChatInputCommandInteraction, EmbedBuilder, Guild, GuildBasedChannel, LabelBuilder, MessageFlags, ModalBuilder, ModalSubmitInteraction, PermissionFlagsBits, SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import i18next from "i18next";
import { hasPermission } from "../../sys/zGears/mPermission";
import { error } from "../../sys/logging";
import { addFollowTweet, checFollowUser, deleteFollowTweet, followTweetonGuild } from "../../sys/DB-Engine/links/followTweet";
import { countItems } from "../../sys/DB-Engine/database";
import { getGuildLimits } from "../../sys/DB-Engine/links/noRules";
import { testPermisos } from "../../sys/zGears/auxiliares";

export async function registerFollowXCommand(): Promise<SlashCommandBuilder[]> {
    const followX = new SlashCommandBuilder()
        .setName("follow_twitter")
        .setDescription("Permite seguir usarios de X | Twitter!")
        .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
        .addSubcommand(s => s.setName("seguir").setDescription("Seguir usuario"))
        .addSubcommand(s => s.setName("lista").setDescription("Ver lista de usuarios seguidos"))
        .addSubcommand(s => s.setName("dejar").setDescription("Dejar de seguir usuario")
            .addIntegerOption(o => o.setName("id").setDescription("ID del usuario a dejar de seguir").setRequired(false))
            .addStringOption(o => o.setName("usuario").setDescription("Usuario de X | Twitter a dejar de seguir").setRequired(false))
        )
    return [followX] as SlashCommandBuilder[];
}

export async function handleFollowXCommand(inter: ChatInputCommandInteraction) {
    const isAllowed = await hasPermission(inter, inter.commandName);
    if (!isAllowed) {
        await inter.reply({
            content: i18next.t("common:Errores.isAllowed"),
        });
        return;
    }

    const guild = inter.guild;
    if (!guild) {
        await inter.reply(i18next.t("common:Errores.noGuild"));
        return;
    }

    try {
        const subcommand = inter.options.getSubcommand();
        switch (subcommand) {
            case "seguir":
                await followXModal(inter); break;
            case "lista":
                await listFollow(inter, guild); break;
            case "dejar":
                removeFollow(inter, guild); break;
            default:
                inter.editReply({ content: i18next.t("common:Errores.switchGeneral") })
        }
    } catch (e) {
        error(`Error en el comando followX: ${e}`);
    }
}

// =================================================== addFollowX ===================================================
export async function followXModal(i: ChatInputCommandInteraction) {
    const modal = new ModalBuilder().setCustomId('modal_follow_x').setTitle('Configurar Follow de X/Twitter');
    // User X|Twitter
    const userOp1 = new TextInputBuilder().setCustomId('usuario').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("ej: @x | x.com/x | x");
    const userIn = new LabelBuilder().setLabel('Usuario de X/Twitter').setTextInputComponent(userOp1);
    // Channel
    const chOp1 = new ChannelSelectMenuBuilder().setCustomId("canal").setPlaceholder("ej: #twitter_cringe").setRequired(false).setChannelTypes(0, 5, 10, 11, 12);
    const chIn = new LabelBuilder().setLabel('Canal o hilo a enviar!').setChannelSelectMenuComponent(chOp1);
    // Menu Solomedia
    const oMediaOp2 = new StringSelectMenuOptionBuilder().setLabel("Solo Multimedia").setValue("true").setDescription("Solo tweets con imagen/video/links");
    const oMediaOp1 = new StringSelectMenuOptionBuilder().setLabel("Todo tipo").setValue("false").setDescription("Se mostrarán todos los tweets").setDefault(true);
    const oMediaMenu1 = new StringSelectMenuBuilder().setCustomId("onlymedia").addOptions(oMediaOp1, oMediaOp2);
    const oMediaIn = new LabelBuilder().setLabel('¿Tipo de posts?').setStringSelectMenuComponent(oMediaMenu1);
    // Lang
    const langOp1 = new TextInputBuilder().setCustomId('traducir').setPlaceholder(`ej: "es", "en" ...`).setStyle(TextInputStyle.Short).setRequired(false);
    const langIn = new LabelBuilder().setLabel('Escribe clave ISO de idioma').setTextInputComponent(langOp1);
    // Domain
    const domainOp1 = new TextInputBuilder().setCustomId('dominio').setPlaceholder(`ej: d.fxtwitter.com`).setStyle(TextInputStyle.Short).setRequired(false);
    const domainIn = new LabelBuilder().setLabel('Dominio alterno al server').setTextInputComponent(domainOp1);
    // Out
    modal.addLabelComponents(userIn, chIn, oMediaIn, langIn, domainIn)
    await i.showModal(modal);
}

export async function followXModalMake(i: ModalSubmitInteraction) {
    try {
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        const guild = i.guild!;
        const userX = i.fields.getTextInputValue("usuario");
        const rawinCh = i.fields.getSelectedChannels("canal")?.first() || null;
        const rawOnlyMedia = i.fields.getStringSelectValues("onlymedia") || null;
        const inTranslate = i.fields.getTextInputValue("traducir") || null;
        const inDomain = i.fields.getTextInputValue("dominio") || null;
        // converts
        const inCh = rawinCh ? (await guild.channels.fetch(rawinCh.id).catch(() => null)) : null;
        const inoMedia = rawOnlyMedia[0] === "true" ? true : false;
        // validUser
        const isValiUser = await userCheck(userX);
        if (!isValiUser) { await i.editReply("¡Algo falló al añadir el usuario, puede ser privado o estar mal escrito!"); return; }
        const langChk = chekLang(inTranslate);
        const dominChk = chekDomain(inDomain);
        // emb build
        const embed = new EmbedBuilder()
            .setTitle("Follow Twitter")
            .setColor(0xff0000)
            .setTimestamp();

        const oldyData = await checFollowUser(guild.id, isValiUser);
        if (!oldyData || oldyData.length === 0) {
            if (!inCh) { await i.editReply({ content: "Necesitas asignar un canal para primera configuracion de este usuario X | Twitter" }); return; }
            const validCh = channlChk(inCh, guild)
            if (!validCh.ok) { await i.editReply({ content: i18next.t("common:Errores.missing_permissions", { a1: `<#${inCh.id}>`, a2: validCh.erro[0] }) }); return; }
            // valid cupos
            const conty = await countItems(guild.id, 'followTweetX');
            const limit = await getGuildLimits(guild.id);
            if ((conty >= limit.tweetMax)) {
                await i.editReply({ content: i18next.t("common:Errores.servLimit", { a1: conty, a2: limit.tweetMax }) });
                return;
            }

            const verify = await addFollowTweet({ guild_id: guild.id, canal: inCh.id, xUser: isValiUser, lang: langChk, Domain: dominChk, lastPost: null, addBy: i.user.id, onlyMedia: inoMedia });
            if (verify) {
                embed.setDescription(`Se añadio correctamente el usuario: **@${isValiUser}**` + `\n` + `Follows restantes: ${(limit.tweetMax - 1) - conty}/${limit.tweetMax}`)
                    .addFields(
                        { name: "Usuario", value: `@${isValiUser}`, inline: false },
                        { name: "Tipo de contenido:", value: inoMedia ? "Solo post con multimedia." : "Cualquier post.", inline: false },
                        { name: "Canal donde postear:", value: `<#${inCh.id}>`, inline: false },
                        { name: "Dominio", value: dominChk || "No definido", inline: false },
                        { name: "Idioma", value: langChk || "No definido", inline: false }
                    )
                    .setFooter({ text: `Total de follows: ${conty + 1}` });
                await i.editReply({ embeds: [embed] });
            } else { await i.editReply(`Ocurrio un erro al seguir **${isValiUser}**`); }
        }
        else {
            const { canal, lang, Domain, onlyMedia, addBy, xUser, created_at } = oldyData[0];
            let channelo = canal, domando = Domain, lango = lang, onlyMediaO = onlyMedia;

            if (!inCh && !inDomain && !inoMedia && !inTranslate) {
                await i.editReply({ content: "No proporcionaste ninguna actualizacion para este usuario X | Twitter" });
                return;
            }

            if (inCh) {
                const validCh = channlChk(inCh, guild)
                if (!validCh.ok) { await i.editReply({ content: i18next.t("common:Errores.missing_permissions", { a1: `<#${inCh.id}>`, a2: validCh.erro[0] }) }); return; }
                channelo = inCh.id;
            }

            if (inDomain) domando = dominChk;
            if (inoMedia) onlyMediaO = inoMedia;
            if (inTranslate) lango = langChk;

            const verify = await addFollowTweet({ guild_id: guild.id, canal: channelo, xUser: xUser, lang: lango, Domain: domando, lastPost: null, addBy: addBy, onlyMedia: onlyMediaO });
            if (verify) {
                embed.setDescription(`Se actualizo correctamente el usuario: **@${xUser}**`)
                    .addFields(
                        { name: "Tipo de contenido:", value: onlyMediaO ? "Solo post con multimedia." : "Cualquier post.", inline: false },
                        { name: "Canal donde postear:", value: `<#${channelo}>`, inline: false },
                        { name: "Dominio:", value: domando || "Default", inline: false },
                        { name: "Idioma:", value: lango || "No traducir", inline: false },
                        { name: "Informacion del usuario:", value: `Fue añadido por <@${addBy}> el ${created_at.toLocaleString('es-MX', { dateStyle: 'short', })}` }
                    )
                await i.editReply({ embeds: [embed] });
            }
            else { await i.editReply(`Ocurrio un erro al actualizar **${xUser}**`); }
        }
    } catch (e: any) { error(`Ocurrio un error al procesar la solicitud!! ${e}`); await i.editReply("Ocurrio un error al procesar la solicitud!!") }
}


async function listFollow(i: ChatInputCommandInteraction, guild: Guild) {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        let embes: EmbedBuilder[] = [], txtOut: string | undefined = undefined;
        const follow = await followTweetonGuild(guild.id);
        const flagsMap: Record<string, string> = { 'es': '🇲🇽', 'en': '🇺🇸', 'pt': '🇧🇷', 'ja': '🇯🇵', 'ko': '🇰🇷' };
        const em = new EmbedBuilder().setAuthor({ name: "Lista de Usuarios de  X | Twitter siguiendo!" })
        if (!follow) {
            em.setDescription("# No se han agregado usuarios para seguir").setColor(0xFF00BB)
            embes.push(em);
        } else {
            let adFields: { name: string, value: string, inline?: boolean }[] = [], tooLong = false;
            const lisEmb: string[] = [];
            for (const flw of follow) {
                const F1 = flw.Domain ?? "Default";
                const F2 = flw.lang ? flagsMap[flw.lang] : '\`No traducir!\`';
                const F3 = new Date(flw.created_at).toLocaleString('es-MX', { dateStyle: 'short', });
                lisEmb.push(`🆔: \`${flw.id}\` | 🗣️: [@${flw.xUser}](https://x.com/${flw.xUser}) | 🗨️: <#${flw.canal}> | 👤: <@${flw.addBy}>` + "\n"
                    + `📅: \`${F3}\` | 🔗: \`${F1}\` | 🌐: ${F2} | 🎥: ${flw.onlyMedia ? "\`Multimedia\`" : "\`Todo\`"}`);
            }

            const totalParts = Math.ceil(lisEmb.length / 5);
            for (let i = 0; i < lisEmb.length; i += 5) {
                const partNumber = Math.floor(i / 5) + 1;
                adFields.push({
                    name: `**Parte ${partNumber} de ${totalParts}**`,
                    value: lisEmb.slice(i, i + 5).join('\n\n'),
                    inline: false
                });
                if (adFields.length >= 23) { tooLong = true; break };
            }

            em.setDescription("## Lista de follows!!" + "\n\n" + "X user | Canal | Añadido | Añadido el | Dominio | Traducir | Solo multimedia"
                + (tooLong ? (`\n\n` + `La lista de follows es muy larga, mostrando ${lisEmb.length} follows!`) : ""))
                .setColor(0x010101)
                .setFields(adFields)
                .setFooter({ text: `Total de follows: ${follow.length}` })
            embes.push(em);
        }
        await i.editReply({ content: txtOut, embeds: embes });
    } catch { await i.editReply("Algo Fallo al listar los usuarios!!") }
}

async function removeFollow(i: ChatInputCommandInteraction, guild: Guild) {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        const id = i.options.getInteger("id") || undefined;
        const user = i.options.getString("usuario") || undefined;
        if (!id && !user) { i.editReply("Debes proporcionar un ID o un Usuario para eliminar el follow!"); return; }

        let validUser: string | undefined = undefined, doNumber: number | undefined = undefined;
        if (id) {
            doNumber = !isNaN(id) ? id : undefined;
            if (!doNumber) { i.editReply("El ID debe ser un numero!"); return; }
        }
        else {
            if (user) validUser = await userCheck(user)
            else { i.editReply("Debes proporcionar el ID en lista o un Usuario para eliminar el follow!"); return; }
            if (!validUser) { i.editReply(`El usuario ${user} no es valido!`); return; }
        }

        const eraser = await deleteFollowTweet({ gremio: guild.id, id: doNumber, xUser: validUser })
        if (eraser) i.editReply(`Se elimino el follow con el ${doNumber ? `ID: ${id}` : `Usuario: @${validUser}`}`)
        else i.editReply(`No sepudo borrar el follow con el ${doNumber ? `ID: ${id}` : `Usuario: @${validUser}`}`)
    } catch { i.editReply(`Algo salio mal al intentar borrar el follow!!`) }
}

// =============================== Aux =============================== // 

async function userCheck(userX: string): Promise<string | undefined> {
    let chekUserX = userX;
    if (chekUserX.startsWith("http") || chekUserX.startsWith("@")) {
        const chkXusrTw = chekUserX.match(/(?:twitter\.com|x\.com|@)\/?([a-zA-Z0-9_]{1,15})/)?.[1];
        if (chkXusrTw) chekUserX = chkXusrTw;
    }
    chekUserX = chekUserX.toLowerCase().trim();
    try {
        const userFetch = await fetch(`https://api.fxtwitter.com/2/profile/${chekUserX}/statuses?count=1`)
        if (userFetch.ok) {
            const codFe = await userFetch.json() as { code?: number }
            if (codFe.code === 200) return chekUserX;
            else return undefined;
        }
        else return undefined
    } catch { return undefined }
}

function chekLang(lang: string | null) {
    let tlChk: string | null;
    lang ? tlChk = lang.toLowerCase().trim() : tlChk = null;
    if (tlChk && !['es', 'en', 'pt', 'ja', 'ko'].includes(tlChk)) return null;
    return tlChk
}

function channlChk(ch: GuildBasedChannel, guild: Guild) {
    const me = ch.permissionsFor(guild.members.me!);
    const perChTo = testPermisos(me, "viewCh|sendMsg|addlink");
    if (perChTo.some(p => p.includes("❌"))) { return { ok: false, erro: perChTo } }
    return { ok: true, erro: [] }
}

function chekDomain(domain: string | null) {
    if (domain) {
        const AAYY = domain?.match(/(?:https?:\/\/)?(?:www\.)?([^\/\?#]+)/)?.[1]
        if (AAYY) return AAYY
        else return null
    } else return null;
}


