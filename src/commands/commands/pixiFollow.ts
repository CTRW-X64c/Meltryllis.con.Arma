import { debug, error } from "console";
import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, MessageFlags, ChannelSelectMenuBuilder, LabelBuilder, ModalBuilder, ModalSubmitInteraction, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, Guild } from "discord.js";
import i18next from "i18next";
import { hasPermission } from "../../sys/zGears/mPermission";
import { addPixiFollow, deletePixi, guildPixiFollow } from "../../sys/DB-Engine/links/PixivData";
import { masterPerm } from "../../sys/zGears/auxiliares";
import { countItems } from "../../sys/DB-Engine/database";
import { getGuildLimits } from "../../sys/DB-Engine/links/noRules";

export async function registerFollowPixiCommand(): Promise<SlashCommandBuilder[]> {
    const followPix = new SlashCommandBuilder()
        .setName("pixiv")
        .setDescription("Permite seguir usarios de Pixiv!")
        .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
        .addSubcommand(s => s.setName("seguir").setDescription("Seguir usuario"))
        .addSubcommand(s => s.setName("lista").setDescription("Ver lista de usuarios seguidos"))
        .addSubcommand(s => s.setName("dejar").setDescription("Dejar de seguir usuario"))
    return [followPix] as SlashCommandBuilder[];
}

export async function handlePixiFollowCommand(inter: ChatInputCommandInteraction) {
    const guild = inter.guild;
    if (!guild) { await inter.reply({ content: i18next.t("common:Errores.noGuild"), flags: MessageFlags.Ephemeral }); return };

    const isAllowed = await hasPermission(inter, inter.commandName);
    if (!isAllowed) { await inter.reply({ content: i18next.t("common:Errores.isAllowed"), flags: MessageFlags.Ephemeral }); return };

    try {
        const subcommand = inter.options.getSubcommand();
        switch (subcommand) {
            case "seguir":
                await followPixModal(inter); break;
            case "lista":
                await listPixFollow(inter, guild); break;
            case "dejar":
                removePixiModal(inter); break;
            default:
                inter.editReply({ content: i18next.t("common:Errores.switchGeneral") })
        }
    } catch (e: any) {
        error(`Comando: /followX SWITCH | Guild: ${inter.guild!.id} | Error: ${e.message}`);
    }
}

// ============================================================== AddUser ============================================================== //
async function followPixModal(int: ChatInputCommandInteraction) {
    // User Pixiv
    const userOp1 = new TextInputBuilder().setCustomId('usuario').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("ej: pixiv.net/en/users/128194022");
    const userIn = new LabelBuilder().setLabel('Usuario Pixiv').setTextInputComponent(userOp1);
    // Channel
    const chOp1 = new ChannelSelectMenuBuilder().setCustomId("canal").setPlaceholder("ej: #pixiv_posts").setRequired(true).setChannelTypes(0, 5, 10, 11, 12);
    const chIn = new LabelBuilder().setLabel('Canal o hilo a enviar!').setChannelSelectMenuComponent(chOp1);
    // Tipos
    const oMediaOp3 = new StringSelectMenuOptionBuilder().setLabel("Ilustraciones").setValue("pics").setEmoji("🎨");
    const oMediaOp2 = new StringSelectMenuOptionBuilder().setLabel("Mangas").setValue("mangas").setEmoji("📖");
    const oMediaOp1 = new StringSelectMenuOptionBuilder().setLabel("Novelas").setValue("novelas").setEmoji("📕");
    const oMediaMenu1 = new StringSelectMenuBuilder().setCustomId("tipopost").addOptions(oMediaOp1, oMediaOp2, oMediaOp3).setMinValues(1).setMaxValues(3).setRequired(true);
    const oMediaIn = new LabelBuilder().setLabel('¿Tipo de posts?').setStringSelectMenuComponent(oMediaMenu1);
    // Out
    const modal = new ModalBuilder().setCustomId(`Pixi_Add_${int.id}`).setTitle('Configurar Pixiv!').addLabelComponents(userIn, chIn, oMediaIn);
    await int.showModal(modal);
    // == // == // FINAL MODAL // == // == //
    const submitInt = await int.awaitModalSubmit({
        filter: (submitInt) => submitInt.customId === `Pixi_Add_${int.id}` && submitInt.user.id === int.user.id,
        time: 120_000, // 2 min
    }).catch((e: any) => {
        debug(`Modal PixiAdd error ${e.message}`);
        int.followUp({ content: '⏱️ ¡El formulario expiró después de 2 minutos; si fue intencional, ignora esta notificación!', flags: MessageFlags.Ephemeral });
    }) as ModalSubmitInteraction;
    if (!submitInt) return;

    try {
        await submitInt.deferReply({ flags: MessageFlags.Ephemeral });

        const guild = submitInt.guild!
        const rawUser = submitInt.fields.getTextInputValue("usuario");
        const rawCh = submitInt.fields.getSelectedChannels("canal")?.first() || null;
        const rawType = submitInt.fields.getStringSelectValues("tipopost");
        // booleanos
        const typeON = {
            pics: rawType.includes("pics") ? true : false,
            mangas: rawType.includes("mangas") ? true : false,
            novels: rawType.includes("novelas") ? true : false,
        };
        // limits
        const conty = await countItems(guild.id, 'pixivData');
        const limit = await getGuildLimits(guild.id);
        if ((conty >= limit.pixiMax)) {
            await submitInt.editReply({ content: i18next.t("common:Errores.servLimit", { a1: conty, a2: limit.pixiMax }) });
            return;
        }
        // user
        const vChek = await chkuser(rawUser);
        if (!vChek.ok) { await submitInt.editReply("¡Algo falló al añadir el usuario, puede ser privado o estar mal escrito!"); return; }
        // ch
        const inCh = rawCh ? (await submitInt.guild!.channels.fetch(rawCh.id).catch(() => null)) : null;
        if (!inCh) { await submitInt.editReply({ content: "El canal no es valido o no existe" }); return; }
        const testPerm = masterPerm(inCh, "viewCh|sendMsg|addlink")
        if (!testPerm.ok) { await submitInt.editReply({ content: i18next.t("common:Errores.missing_permissions", { a1: `<#${inCh.id}>`, a2: testPerm.msg.join('\n') }) }); return; }
        // addBD
        const addOk = await addPixiFollow({
            guild_id: guild.id,
            chGuild: inCh.id,
            pixiUser: vChek.userId!,
            pixiUserName: vChek.userName!,
            illustOn: typeON.pics,
            mangaOn: typeON.mangas,
            novelOn: typeON.novels,
            addby: submitInt.user.id,
        })
        // respuesta
        if (!addOk) { await submitInt.editReply({ content: "¡Algo falló al añadir el follow, si persiste repota en /help report" }); return; }
        else {
            const emb = new EmbedBuilder()
                .setColor(0x00FF00)
                .setAuthor({ name: "Usuario seguido correctamente!" })
                .setDescription(`Usuario agregado correctamente! \n Usuario: ${vChek.userName}\n ID: ${vChek.userId} \n Canal: ${inCh} \ Follows Restantes: ${(limit.pixiMax - 1) - conty}/${limit.pixiMax}`);
            await submitInt.editReply({ embeds: [emb] });
        }
    } catch (e: any) { error(`Modal Pixi Follow error: ${e.message}`) }
}

// ============================================================== lista ============================================================== //
async function listPixFollow(i: ChatInputCommandInteraction, guild: Guild) {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        let embes: EmbedBuilder[] = [];
        const follow = await guildPixiFollow(guild.id);

        if (!follow || follow.length === 0) {
            const em = new EmbedBuilder()
                .setAuthor({ name: "Lista de Usuarios de Pixiv siguiendo!" })
                .setDescription("# No se han agregado usuarios para seguir")
                .setColor(0xFF00BB);
            embes.push(em);
        } else {

            const lisEmb: string[] = [];
            for (const flw of follow) {
                const F3 = new Date(flw.created_at).toLocaleString('es-MX', { dateStyle: 'short' });
                lisEmb.push(`🆔: \`${flw.id}\` | 🖌️: [${flw.pixiUserName}](https://pixiv.net/en/users/${flw.pixiUser}) | 🗨️: <#${flw.chGuild}> | 👤: <@${flw.addby}> | 📅: \`${F3}\`` +
                    `\n🎨 Ilustraciones: ${flw.illustOn ? "✅" : "❌"} | 📖 Mangas: ${flw.mangaOn ? "✅" : "❌"} | 📕 Novelas: ${flw.novelOn ? "✅" : "❌"}`);
            }

            const totalParts = Math.ceil(lisEmb.length / 5);
            for (let index = 0; index < lisEmb.length; index += 5) {
                const partNumber = Math.floor(index / 5) + 1;
                const em = new EmbedBuilder()
                    .setColor(0x010101)
                    .addFields({
                        name: `**Parte ${partNumber} de ${totalParts}**`,
                        value: lisEmb.slice(index, index + 5).join('\n\n'),
                        inline: false
                    });

                if (partNumber === 1) {
                    em.setAuthor({ name: "Lista de Usuarios de Pixiv siguiendo!" })
                        .setDescription("## Lista de follows!!\n Pivix User | Canal | Añadio | Fecha adicion | Ilustraciones | Mangas | Novelas");
                }

                if (partNumber === totalParts) { em.setFooter({ text: `Total de follows: ${follow.length}` }); }
                embes.push(em);
            }
        }

        if (embes.length <= 5) { await i.editReply({ embeds: embes }); }
        else {
            await i.editReply({ embeds: embes.slice(0, 5) });
            await i.followUp({ embeds: embes.slice(5), flags: MessageFlags.Ephemeral });
        }
    } catch (e: any) {
        error(`Comando: /followPixi List | Guild: ${i.guild!.id} | Error: ${e.message}`);
        await i.editReply("Algo Fallo al listar los usuarios!!");
    }
}

// ============================================================== deleteUSer ============================================================== //
async function removePixiModal(i: ChatInputCommandInteraction) {
    // ID
    const idOp1 = new TextInputBuilder().setCustomId('id').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder("ID en /follow_pivix lista");
    const idIn = new LabelBuilder().setLabel('ID del follow a eliminar').setTextInputComponent(idOp1);
    // UserPivix
    const userOp1 = new TextInputBuilder().setCustomId('usuario').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder("ej: pixiv.net/en/users/128194022");
    const userIn = new LabelBuilder().setLabel('Usuario de Pivix').setTextInputComponent(userOp1);
    // Out
    const modal = new ModalBuilder().setCustomId(`Pixi_RMV_${i.id}`).setTitle('Remover follow de Pivix').addLabelComponents(idIn, userIn);
    await i.showModal(modal);
    // == // == // FINAL MODAL // == // == //
    const submitInt = await i.awaitModalSubmit({
        filter: (submitInt) => submitInt.customId === `Pixi_RMV_${i.id}` && submitInt.user.id === i.user.id,
        time: 120_000, // 2 min
    }).catch((e: any) => {
        debug(`Modal PixiRemov error ${e.message}`);
        i.followUp({ content: '⏱️ ¡El formulario expiró después de 2 minutos; si fue intencional, ignora esta notificación!', flags: MessageFlags.Ephemeral });
    }) as ModalSubmitInteraction;
    if (!submitInt) return;

    try {
        await submitInt.deferReply({ flags: MessageFlags.Ephemeral });
        const id = submitInt.fields.getTextInputValue("id").trim() || undefined;
        const user = submitInt.fields.getTextInputValue("usuario") || undefined;
        if (!id && !user) { submitInt.editReply("Debes proporcionar un ID o un Usuario para eliminar el follow!"); return; }
        let validUser: string | undefined = undefined, doNumber: number | undefined = undefined;
        if (id) {
            const strNum = parseInt(id, 10);
            doNumber = !isNaN(strNum) ? strNum : undefined;
            if (!doNumber) { submitInt.editReply("El ID debe ser un numero!"); return; }
        }
        else {
            if (user) {
                const usrChk = await chkuser(user, true);
                if (usrChk.ok) { validUser = usrChk.userId; }
                else { submitInt.editReply("El usuario parece incorrecto, el usuario es numerico!"); return; }
                if (!validUser) { submitInt.editReply(`El usuario ${user} no es valido!`); return; }
            }
        }

        const eraser = await deletePixi({ gldPi: submitInt.guild!.id, idPi: doNumber, usrPi: validUser });
        if (eraser) submitInt.editReply(`Se elimino el follow con el ${doNumber ? `ID: ${id}` : `Usuario: ${validUser}`}`)
        else submitInt.editReply(`No sepudo borrar el follow con el ${doNumber ? `ID: ${id}` : `Usuario: ${validUser}`}`)

    } catch (e: any) {
        error(`Comando: /followX Remover | Guild: ${i.guild!.id} | Error: ${e.message}`);
        submitInt.reply(`Algo salio mal al intentar borrar el follow!!`).catch(() => null);
    }
}

// ============================================================== AUX ============================================================== //
async function chkuser(user: string, rmv?: boolean): Promise<{ ok: boolean, userId?: string, userName?: string }> {
    let outId = user, outName = `Id: ${user}`;
    if (outId.startsWith("http")) {
        const extract = outId.match(/(?:pixiv\.net)\/(?:en\/)?users\/([0-9]{1,15})/)?.[1];
        if (extract) outId = extract.trim()
    }
    if (rmv === true) return { ok: true, userId: outId, userName: outName }
    try {
        const options = {
            headers: {
                'Referer': 'https://www.pixiv.net/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            }
        }
        const chkUser = await fetch(`https://www.pixiv.net/ajax/user/${outId}`, options)
        if (!chkUser.ok) return { ok: false }
        const dtaId = await chkUser.json() as { error: boolean, body: { userId: string, name: string } }
        if (!dtaId.error && dtaId.body) {
            outId = dtaId.body.userId;
            outName = dtaId.body.name;
        } else { return { ok: false } }

    } catch (e: any) { error(`Pixi Follow chkuser error: ${e.message}`); return { ok: false }; }
    return { ok: true, userId: outId, userName: outName };
}