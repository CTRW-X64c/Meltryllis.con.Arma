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
        )
        .addSubcommand(s => s.setName("lista").setDescription("Ver lista de usuarios seguidos"))
        .addSubcommand(s => s.setName("dejar").setDescription("Dejar de seguir usuario")
            .addIntegerOption(o => o.setName("id").setDescription("ID del usuario a dejar de seguir").setRequired(true)))
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
        if (translate && ['es', 'en', 'pt', 'ja', 'ko'].includes(translate)) { tlChk = translate; }
        // == userChk == //
        let userX = i.options.getString("usuario", true);
        if (userX.startsWith("http") || userX.startsWith("@")) {
            const chkXusrTw = userX.match(/(?:twitter\.com|x\.com|@)\/?([a-zA-Z0-9_]{1,15})/)?.[1];
            if (chkXusrTw) userX = chkXusrTw;
            else { await i.editReply("El formato de usuario parece incorrecto! \n\`Formato: @user o https://x.com/user\`"); return }
        }
        const testUser = async () => {
            try {
                const chekUserX = await fetch(`https://api.fxtwitter.com/2/profile/${userX}/statuses?count=1`)
                if (chekUserX.ok) {
                    const codFe = await chekUserX.json() as { code?: number }
                    if (codFe.code === 200) return true;
                    else return false
                }
                else return false
            } catch { return false }
        }
        // == passingBD == //
        const isValiUser = await testUser();
        if (isValiUser) {
            const doMin = nDominos()
            const verify = await addFollowTweet({
                id: 0,
                guild_id: guild.id,
                canal: ch.id,
                xUser: userX,
                lang: tlChk,
                Domain: doMin,
                lastPost: null,
                addBy: i.user.id,
                created_at: new Date()
            });
            if (verify.success) {
                await i.editReply(`Se añadio correctamente el usuario: **@${userX}**\n follow restantes:` + `${(limit.tweetMax - 1) - conty}/${limit.tweetMax}`);
            } else { await i.editReply(`Ocurrio un erro al seguir **${userX}**: ${verify.message}`); }
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
            em.setDescription("No se han agregado usuarios para seguir").setColor(0xFF00BB)
            embes.push(em);
        } else {
            let adFields: { name: string, value: string, inline?: boolean }[] = [], tooLong = false;
            const lisEmb: string[] = [];
            for (const flw of follow) {
                const F1 = flw.Domain ?? "Default";
                const F2 = flw.lang ? flagsMap[flw.lang] : '\`No traducir!\`';
                const F3 = new Date(flw.created_at).toLocaleString('es-MX', { dateStyle: 'short', });
                lisEmb.push(`🆔: \`${flw.id}\` | 🗣️​​: \`@${flw.xUser}\` | 🗨️: <#${flw.canal}> | ​👤​​​: <@${flw.addBy}>` + "\n"
                    + `📅: \`${F3}\` | 🔗: \`${F1}\` | 🌐: ${F2}`);
            }

            const totalParts = Math.ceil(lisEmb.length / 5);
            for (let i = 0; i < lisEmb.length; i += 5) {
                const partNumber = Math.floor(i / 5) + 1;
                adFields.push({
                    name: `Parte ${partNumber} de ${totalParts}`,
                    value: lisEmb.slice(i, i + 5).join('\n\n'),
                    inline: false
                });
                if (adFields.length >= 23) { tooLong = true; break };
            }

            em.setDescription("## Lista de follows!!" + "\n\n" + "ID | X/Twitter | Canal | Añadido por | Se añadio el | Dominio Custom | Traducir"
                + (tooLong ? (`\n\n` + `La lista de follows es muy larga, mostrando ${lisEmb.length} follows!`) : ""))
                .setColor(0x00FF00)
                .setFields(adFields);
            embes.push(em);
        }
        await i.editReply({ content: txtOut, embeds: embes });
    } catch { await i.editReply("Algo Fallo al listar los usuarios!!") }
}

async function removeFollow(i: ChatInputCommandInteraction, guild: Guild) {
    try {
        const id = i.options.getInteger("id")
        const eraser = await deleteFollowTweet(guild.id, Number(id))

        if (eraser) i.editReply(`Se elimino el follow con el ID:${id}`)
        else i.editReply(`No sepudo borrar el follow con ID:${id}`)
    } catch { i.editReply(`Algo salio mal al intentar borrar el follo!!`) }
}