import { ChannelType, ChatInputCommandInteraction, EmbedBuilder, Guild, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, TextChannel } from "discord.js";
import i18next from "i18next";
import { hasPermission } from "../../sys/zGears/mPermission";
import { error } from "../../sys/logging";
import { addFollowTweet, deleteFollowTweet, followTweetonGuild } from "../../sys/DB-Engine/links/followTweet";
import { countItems } from "../../sys/DB-Engine/database";
import { getGuildLimits } from "../../sys/DB-Engine/links/noRules";
import { testPermisos } from "../../sys/zGears/auxiliares";

export async function registerFollowXCommand(): Promise<SlashCommandBuilder[]> {
    const followX = new SlashCommandBuilder()
        .setName("follow_twitter")
        .setDescription("Permite seguir usarios de X | Twitter!")
        .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
        .addSubcommand(s => s.setName("seguir").setDescription("Seguir usuario")
            .addStringOption(o => o.setName("usuario").setDescription("Usuario de X | Twitter a seguir").setRequired(true))
            .addChannelOption(o => o.setName("canal").setDescription("Canal donde se enviaran los tweets").setRequired(true)
                .addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread))
            .addStringOption(o => o.setName("dominio").setDescription("Dominio para embed, como fixip.com").setRequired(false))
            .addStringOption(o => o.setName("traducir").setDescription("Traducir tweets, tu dominio debe soportar eso").setRequired(false))
            .addBooleanOption(o => o.setName("onlymedia").setDescription("Solo enviar tweets con media").setRequired(false))
        )
        .addSubcommand(s => s.setName("lista").setDescription("Ver lista de usuarios seguidos"))
        .addSubcommand(s => s.setName("dejar").setDescription("Dejar de seguir usuario")
            .addIntegerOption(o => o.setName("id").setDescription("ID del usuario a dejar de seguir").setRequired(false))
            .addStringOption(o => o.setName("usuario").setDescription("Usuario de X | Twitter a dejar de seguir").setRequired(false))
        )
    return [followX] as SlashCommandBuilder[];
}

export async function handleFollowXCommand(inter: ChatInputCommandInteraction) {
    await inter.deferReply({ flags: MessageFlags.Ephemeral });
    const isAllowed = await hasPermission(inter, inter.commandName);
    if (!isAllowed) {
        await inter.editReply({
            content: i18next.t("common:Errores.isAllowed"),
        });
        return;
    }

    const guild = inter.guild;
    if (!guild) {
        await inter.editReply(i18next.t("common:Errores.noGuild"));
        return;
    }

    try {
        const subcommand = inter.options.getSubcommand();
        switch (subcommand) {
            case "seguir":
                await followX(inter, guild); break;
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

async function followX(i: ChatInputCommandInteraction, guild: Guild) {
    try {
        // == chChk == //
        const oMedia = i.options.getBoolean("onlymedia") || false;
        const ch = i.options.getChannel("canal", true) as TextChannel;
        const me = ch.permissionsFor(guild.members.me!);
        const perChTo = testPermisos(me, "viewCh|sendMsg|addlink");
        if (perChTo.some(p => p.includes("❌"))) {
            await i.editReply({ content: i18next.t("common:Errores.missing_permissions", { a1: `<#${ch.id}>`, a2: perChTo[0] }) });
            return;
        }
        // == limitChk == //
        const conty = await countItems(guild.id, 'followTweetX');
        const limit = await getGuildLimits(guild.id);
        if ((conty >= limit.tweetMax)) {
            await i.editReply({ content: i18next.t("common:Errores.servLimit", { a1: conty, a2: limit.tweetMax }) });
            return;
        }
        // == domChk == //
        const domain = i.options.getString("dominio");
        const nDominos = () => {
            if (domain) {
                const AAYY = domain?.match(/(?:https?:\/\/)?(?:www\.)?([^\/\?#]+)/)?.[1]
                if (AAYY) return AAYY
                else return null
            } else return null;
        }
        // == translateChk == //
        let tlChk: string | null = null;
        const translate = i.options.getString("traducir");
        if (translate && ['es', 'en', 'pt', 'ja', 'ko'].includes(translate)) tlChk = translate;
        // == userChk == //
        const userX = i.options.getString("usuario", true);
        const isValiUser = await userCheck(userX)
        // == passingBD == //
        if (isValiUser) {
            const doMin = nDominos()
            const verify = await addFollowTweet({
                id: 0,
                guild_id: guild.id,
                canal: ch.id,
                xUser: isValiUser,
                lang: tlChk,
                Domain: doMin,
                lastPost: null,
                addBy: i.user.id,
                onlyMedia: oMedia,
                created_at: new Date()
            });
            if (verify) {
                await i.editReply(`Se añadio/actualizo correctamente el usuario: **@${userX}**\n Follows restantes:` + `${(limit.tweetMax - 1) - conty}/${limit.tweetMax}`);
            } else { await i.editReply(`Ocurrio un erro al seguir **${userX}**`); }
        }
        else await i.editReply("Algo Fallo al añadir el usuario, puede ser privado o este mal escrito!!");
    } catch { await i.editReply("Ocurrio un error al procesar la solicitud!!") }
}


async function listFollow(i: ChatInputCommandInteraction, guild: Guild) {
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
                lisEmb.push(`🆔: \`${flw.id}\` | 🗣️​​: \`@${flw.xUser}\` | 🗨️: <#${flw.canal}> | ​👤​​​: <@${flw.addBy}>` + "\n"
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
    chekUserX = chekUserX.trim();
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