import { ChannelSelectMenuBuilder, ChatInputCommandInteraction, EmbedBuilder, Guild, LabelBuilder, MessageFlags, ModalBuilder, ModalSubmitInteraction, PermissionFlagsBits, SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import i18next from "i18next";
import { hasPermission } from "../../sys/zGears/mPermission";
import { error, debug } from "../../sys/logging";
import { countItems } from "../../sys/DB-Engine/database";
import { getGuildLimits } from "../../sys/DB-Engine/links/noRules";
import { masterPerm } from "../../sys/zGears/auxiliares";
import { addFollowBSky, deleteBskyFollow, getGuildBSky } from "../../sys/DB-Engine/links/blueSkya";

export async function registerBSkyCommand(): Promise<SlashCommandBuilder[]> {
    const BSky = new SlashCommandBuilder()
        .setName("bsky")
        .setDescription("Permite seguir usarios de BlueSky!")
        .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
        .addSubcommand(s => s.setName("seguir").setDescription("Seguir usuario"))
        .addSubcommand(s => s.setName("lista").setDescription("Ver lista de usuarios seguidos"))
        .addSubcommand(s => s.setName("dejar").setDescription("Dejar de seguir usuario"))
    return [BSky] as SlashCommandBuilder[];
}

export async function handleBSkyCommand(inter: ChatInputCommandInteraction) {
    const guild = inter.guild;
    if (!guild) { await inter.reply({ content: i18next.t("common:Errores.noGuild"), flags: MessageFlags.Ephemeral }); return };

    const isAllowed = await hasPermission(inter, inter.commandName);
    if (!isAllowed) { await inter.reply({ content: i18next.t("common:Errores.isAllowed"), flags: MessageFlags.Ephemeral }); return };

    try {
        const subcommand = inter.options.getSubcommand();
        switch (subcommand) {
            case "seguir":
                await baskyModal(inter); break;
            case "lista":
                await bskyList(inter, guild); break;
            case "dejar":
                baskyDelete(inter); break;
            default:
                inter.editReply({ content: i18next.t("common:Errores.switchGeneral") })
        }
    } catch (e: any) {
        error(`Comando: /bsky SWITCH | Guild: ${inter.guild!.id} | Error: ${e.message}`);
    }
}

// =================================================== addFollowX ===================================================
async function baskyModal(i: ChatInputCommandInteraction) {
    // User basky
    const userOp1 = new TextInputBuilder().setCustomId('usuario').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("ej: @x | x.com/x | x");
    const userIn = new LabelBuilder().setLabel('Usuario de BSky').setTextInputComponent(userOp1);
    // Channel
    const chOp1 = new ChannelSelectMenuBuilder().setCustomId("canal").setPlaceholder("ej: #BSky_posts").setRequired(true).setChannelTypes(0, 5, 10, 11, 12);
    const chIn = new LabelBuilder().setLabel('Canal o hilo a enviar!').setChannelSelectMenuComponent(chOp1);
    // Menu Solomedia
    const oMediaOp2 = new StringSelectMenuOptionBuilder().setLabel("Solo Multimedia").setValue("true").setDescription("Solo posts con imagen/video/links");
    const oMediaOp1 = new StringSelectMenuOptionBuilder().setLabel("Todo tipo").setValue("false").setDescription("Se mostrarán todos los posts");
    const oMediaMenu1 = new StringSelectMenuBuilder().setCustomId("modo").addOptions(oMediaOp1, oMediaOp2).setMinValues(1).setMaxValues(1).setRequired(false);
    const oMediaIn = new LabelBuilder().setLabel('¿Tipo de posts?').setStringSelectMenuComponent(oMediaMenu1);
    // Lang
    const langOp1 = new TextInputBuilder().setCustomId('traducir').setPlaceholder(`ej: "es", "en" ...`).setStyle(TextInputStyle.Short).setRequired(false);
    const langIn = new LabelBuilder().setLabel('Escribe clave ISO de idioma').setTextInputComponent(langOp1);
    // Out
    const modal = new ModalBuilder().setCustomId(`BSky_add${i.id}`).setTitle('Configurar BSky').addLabelComponents(userIn, chIn, oMediaIn, langIn);
    await i.showModal(modal);
    // == // == // FINAL MODAL // == // == //
    const submitInt = await i.awaitModalSubmit({
        filter: (submitInt) => submitInt.customId === `BSky_add${i.id}` && submitInt.user.id === i.user.id,
        time: 120_000, // 2 min
    }).catch((e: any) => {
        debug(`Modal BskyModal error ${e.message}`);
        i.followUp({ content: '⏱️ ¡El formulario expiró después de 2 minutos; si fue intencional, ignora esta notificación!', flags: MessageFlags.Ephemeral });
    }) as ModalSubmitInteraction;
    if (!submitInt) return;

    try {
        await submitInt.deferReply({ flags: MessageFlags.Ephemeral });
        const guild = submitInt.guild!;
        const userX = submitInt.fields.getTextInputValue("usuario");
        const rawinCh = submitInt.fields.getSelectedChannels("canal")?.first() || null;
        const rawOnlyMedia = submitInt.fields.getStringSelectValues("modo");
        const inTranslate = submitInt.fields.getTextInputValue("traducir") || null;
        // valid cupos
        const conty = await countItems(guild.id, 'blueskya');
        const limit = await getGuildLimits(guild.id);
        const inoMedia = rawOnlyMedia[0] === "true";
        if ((conty >= limit.tweetMax)) {
            await submitInt.editReply({ content: i18next.t("common:Errores.servLimit", { a1: conty, a2: limit.tweetMax }) });
            return;
        }
        // validUser
        const isValiUser = await userCheck(userX);
        if (!isValiUser.ok) { await submitInt.editReply("¡Algo falló al añadir el usuario, puede ser privado o estar mal escrito!"); return; }
        const langChk = chekLang(inTranslate);
        // chVerify
        const inCh = rawinCh ? (await guild.channels.fetch(rawinCh.id).catch(() => null)) : null;
        if (!inCh) { await submitInt.editReply({ content: "El canal no parece valido, intenta nuevamente!" }); return; }
        const testPerm = masterPerm(inCh, "viewCh|sendMsg|addlink")
        if (!testPerm.ok) { await submitInt.editReply({ content: i18next.t("common:Errores.missing_permissions", { a1: `<#${inCh.id}>`, a2: testPerm.msg.join('\n') }) }); return; }

        const verify = await addFollowBSky({
            guild_id: guild.id,
            bskyUserId: isValiUser.id!,
            bskyUserName: isValiUser.name || "NO USER NAME!!",
            chanel: inCh.id,
            lang: langChk,
            modo: inoMedia,
            addby: submitInt.user.id,
        });
        if (verify) {
            const embed = new EmbedBuilder()
                .setTitle("Se añadio nuevo follow de BSky")
                .setDescription(`Se añadio correctamente el usuario: **${isValiUser.name ?? isValiUser.id}**` + `\n` + `Follows restantes: ${(limit.tweetMax - 1) - conty}/${limit.tweetMax}`)
                .addFields(
                    { name: "Usuario", value: `@${isValiUser.name ?? isValiUser.id}`, inline: false },
                    { name: "Tipo de contenido:", value: inoMedia ? "Solo post con multimedia." : "Cualquier post.", inline: false },
                    { name: "Canal donde postear:", value: `<#${inCh.id}>`, inline: false },
                    { name: "Idioma", value: langChk || "No definido", inline: false }
                )
                .setFooter({ text: `Total de follows: ${conty + 1}` });
            await submitInt.editReply({ embeds: [embed] });
        } else { await submitInt.editReply(`Ocurrio un erro al seguir **${isValiUser}**`); }
    } catch (e: any) {
        error(`Algo salio mal en añadir follow en el gremio: ${submitInt.guild!.id}`);
        await submitInt.reply("Ocurrio un error al procesar la solicitud!!").catch(() => null);
    }
}

// ======================= listFollow ======================= //
async function bskyList(i: ChatInputCommandInteraction, guild: Guild) {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        const follow = await getGuildBSky(guild.id);
        const flagsMap: Record<string, string> = { 'es': '🇲🇽', 'en': '🇺🇸', 'pt': '🇧🇷', 'ja': '🇯🇵', 'ko': '🇰🇷' };

        if (!follow || follow.length === 0) {
            const embFall = new EmbedBuilder()
                .setAuthor({ name: "Lista de Usuarios de BlueSky siguiendo!" })
                .setDescription("# No se han agregado usuarios para seguir")
                .setColor(0xFF00BB);

            i.editReply({ embeds: [embFall] }); return
        }

        const byCh: Record<string, string[]> = {};
        for (const bsky of follow) {
            if (!byCh[bsky.chanel]) byCh[bsky.chanel] = [];

            const F2 = bsky.lang ? flagsMap[bsky.lang] : '`No traducir!`';
            const F3 = new Date(bsky.created_at).toLocaleString('es-MX', { dateStyle: 'short' });
            byCh[bsky.chanel].push(`🆔: \`${bsky.id}\` | 🗣️: [@${bsky.bskyUserName}](https://bsky.app/profile/${bsky.bskyUserId}) | 👤: <@${bsky.addby}>\n📅: \`${F3}\` | 🌐: ${F2} | 🎥: ${bsky.modo ? "`Multimedia`" : "`Todo`"}`);
        }

        const chunks: string[] = [];
        let itChunk = "";
        let InChunk = 0;

        for (const [canalId, lines] of Object.entries(byCh)) {
            let Head4Chunk = false;
            for (const line of lines) {
                if (InChunk >= 8) {
                    chunks.push(itChunk);
                    itChunk = "";
                    InChunk = 0;
                    Head4Chunk = false;
                }

                if (!Head4Chunk) {
                    itChunk += `### 🗨️ Canal: <#${canalId}>\n`;
                    Head4Chunk = true;
                }

                itChunk += line + "\n\n";
                InChunk++;
            }
        }

        if (itChunk.trim().length > 0) chunks.push(itChunk);
        for (let index = 0; index < chunks.length; index++) {
            const embOk = new EmbedBuilder()
                .setColor(0x010101)
                .setDescription(chunks[index]);

            if (index === 0) { embOk.setAuthor({ name: "Lista de Usuarios de BlueSky siguiendo!" }); }
            if (index === chunks.length - 1) { embOk.setFooter({ text: `Total de follows: ${follow.length}` }); }
            if (index === 0) { await i.editReply({ embeds: [embOk] }); }
            else { await i.followUp({ embeds: [embOk], flags: MessageFlags.Ephemeral }); }
        }
    } catch (e: any) {
        console.error(`Comando: /bsky lista | Guild: ${i.guild!.id} | Error: ${e.message}`);
        await i.editReply("¡Algo falló al listar los usuarios!");
    }
}

// ======================= removeFollow ======================= //
async function baskyDelete(i: ChatInputCommandInteraction) {
    // ID
    const idOp1 = new TextInputBuilder().setCustomId('id').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder("ID en /follow_twitter lista");
    const idIn = new LabelBuilder().setLabel('ID del follow a eliminar').setTextInputComponent(idOp1);
    // User X|Twitter
    const userOp1 = new TextInputBuilder().setCustomId('usuario').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder("ej: @x | x.com/x | x");
    const userIn = new LabelBuilder().setLabel('Usuario de BSky').setTextInputComponent(userOp1);
    // Out
    const modal = new ModalBuilder().setCustomId(`BSky_RM${i.id}`).setTitle('Remover BSky follow').addLabelComponents(idIn, userIn);
    await i.showModal(modal);
    // == // == // FINAL MODAL // == // == //
    const submitInt = await i.awaitModalSubmit({
        filter: (submitInt) => submitInt.customId === `BSky_RM${i.id}` && submitInt.user.id === i.user.id,
        time: 120_000, // 2 min
    }).catch((e: any) => {
        debug(`Modal BSky_RM error ${e.message}`);
        i.followUp({ content: '⏱️ ¡El formulario expiró después de 2 minutos; si fue intencional, ignora esta notificación!', flags: MessageFlags.Ephemeral });
    }) as ModalSubmitInteraction;
    if (!submitInt) return;

    try {
        await submitInt.deferReply({ flags: MessageFlags.Ephemeral });
        const id = submitInt.fields.getTextInputValue("id").trim() || undefined;
        const user = submitInt.fields.getTextInputValue("usuario") || undefined;
        if (!id && !user) { submitInt.editReply("Debes proporcionar un ID o el ID de usuario de BSky!"); return; }
        let validUser: string | undefined = undefined, doNumber: number | undefined = undefined;
        if (id) {
            const strNum = parseInt(id, 10);
            doNumber = !isNaN(strNum) ? strNum : undefined;
            if (!doNumber) { submitInt.editReply("El ID debe ser un numero!"); return; }
        }
        else {
            if (user) validUser = (await userCheck(user)).id
            else { submitInt.editReply("Debes proporcionar el ID en lista o un Usuario para eliminar el follow!"); return; }
            if (!validUser) { submitInt.editReply(`El usuario ${user} no es valido!`); return; }
        }

        const eraser = await deleteBskyFollow({ gremio: submitInt.guild!.id, id: doNumber, userId: validUser })
        if (eraser) submitInt.editReply(`Se elimino el follow con el ${doNumber ? `ID: ${id}` : `Usuario: @${validUser}`}`)
        else submitInt.editReply(`No sepudo borrar el follow con el ${doNumber ? `ID: ${id}` : `Usuario: @${validUser}`}`)

    } catch (e: any) {
        error(`Comando: /followX Remover | Guild: ${i.guild!.id} | Error: ${e.message}`);
        submitInt.reply(`Algo salio mal al intentar borrar el follow!!`).catch(() => null);
    }
}

// =============================== Aux =============================== // 
async function userCheck(userX: string): Promise<{ ok: boolean, name?: string, id?: string }> {
    let chekUserX = userX.trim();
    if (chekUserX.startsWith("http")) {
        const chkXusrTw = chekUserX.match(/(?:bsky\.app)\/(?:profile|user)\/(.+?)(?=\/|\?|#|$)/i)?.[1];
        if (chkXusrTw) chekUserX = chkXusrTw;
    }
    chekUserX = chekUserX.toLowerCase().trim();
    try {
        const userFetch = await fetch(`https://api.fxbsky.app/2/profile/${chekUserX}`)
        if (userFetch.ok) {
            const gData = await userFetch.json() as { code?: number, user?: { id: string, name: string } }
            if (gData.code === 200 && gData.user) return { ok: true, name: gData.user.name, id: gData.user.id };
            else return { ok: false };
        }
        else return { ok: false }
    } catch { return { ok: false } }
}

function chekLang(lang: string | null) {
    let tlChk: string | null;
    lang ? tlChk = lang.toLowerCase().trim() : tlChk = null;
    if (tlChk && !['es', 'en', 'pt', 'ja', 'ko'].includes(tlChk)) return null;
    return tlChk
}


