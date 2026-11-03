import { ChannelSelectMenuBuilder, ChatInputCommandInteraction, EmbedBuilder, Guild, GuildTextBasedChannel, LabelBuilder, MessageFlags, ModalBuilder, ModalSubmitInteraction, RoleSelectMenuBuilder, SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextChannel } from 'discord.js';
import { addBD, delKCBD, getKCConfig, Kancolle } from '../../sys/DB-Engine/links/KancolleBD';
import i18next from 'i18next';
import { hasPermission } from '../../sys/zGears/mPermission';
import { debug, error } from '../../sys/logging';
import { checkCooldown, masterPerm, msgDeleter, startCooldown } from '../../sys/zGears/auxiliares';
import { allLefts, mantDates, turnDate, JSTtoUTC, getNowJST, rankServers, RankLevel, RecordEntry } from '../../sys/zGears/kc_aux'
import { maint } from '../../sys/DB-Engine/links/KancolleBD'
import emojis from '../../../adds/otros/emojis.json'

const listServers = [
    { name: "横須賀鎮守府 (Yokosuka Naval District)", value: "1" },
    { name: "呉鎮守府 (Kure Naval District)", value: "2" },
    { name: "佐世保鎮守府 (Sasebo Naval District)", value: "3" },
    { name: "舞鶴鎮守府 (Maizuru Naval District)", value: "4" },
    { name: "大湊警備府 (Ominato Guard District)", value: "5" },
    { name: "トラック泊地 (Truk Anchorage)", value: "6" },
    { name: "リンガ泊地 (Lingga Anchorage)", value: "7" },
    { name: "ラバウル基地 (Rabaul Naval Base)", value: "8" },
    { name: "ショートランド泊地 (Shortland Anchorage)", value: "9" },
    { name: "ブイン基地 (Buin Naval Base)", value: "10" },
    { name: "タウイタウイ泊地 (Tawi-Tawi Anchorage)", value: "11" },
    { name: "パラオ泊地 (Palau Anchorage)", value: "12" },
    { name: "ブルネイ泊地 (Brunei Anchorage)", value: "13" },
    { name: "単冠湾泊地 (Hitokappu Bay Anchorage)", value: "14" },
    { name: "幌筵泊地 (Paramushir Anchorage)", value: "15" },
    { name: "宿毛湾泊地 (Sukumo Bay Anchorage)", value: "16" },
    { name: "鹿屋基地 (Kanoya Naval Base)", value: "17" },
    { name: "岩川基地 (Iwagawa Naval Base)", value: "18" },
    { name: "佐伯湾泊地 (Saiki Bay Anchorage)", value: "19" },
    { name: "柱島泊地 (Hashirajima Anchorage)", value: "20" }
]

export async function registerKantaiCollectionCommand() {
    const kancolle = new SlashCommandBuilder()
        .setName('kancolle')
        .setDescription('Kantai Collection')
        .addSubcommand(s => s.setName('resets').setDescription(i18next.t("commands:kancolle.slashBuilder.resets"))
            .addBooleanOption(o => o.setName('post').setDescription(i18next.t("commands:kancolle.slashBuilder.post_4_all")).setRequired(false)))
        .addSubcommand(s => s.setName('rank').setDescription(i18next.t("commands:kancolle.slashBuilder.rank"))
            .addStringOption(o => o.addChoices(listServers).setName('servidor').setRequired(false).setDescription('Selecciona servidor'))
            .addBooleanOption(o => o.setName('post').setDescription(i18next.t("commands:kancolle.slashBuilder.post_4_all")).setRequired(false)))
        .addSubcommand(s => s.setName('activar').setDescription(i18next.t("commands:kancolle.slashBuilder.activar")))
        .addSubcommand(s => s.setName('desactivar').setDescription(i18next.t("commands:kancolle.slashBuilder.desactivar")))
        .addSubcommand(s => s.setName('status').setDescription(i18next.t("commands:kancolle.slashBuilder.status")))
    return [kancolle] as SlashCommandBuilder[];
}

const isRunning = new Map<string, boolean>();
export async function handleKantaiCollectionCommand(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;
    if (!guild) { await interaction.reply({ content: i18next.t("common:Errores.noGuild"), flags: MessageFlags.Ephemeral }); return };

    const channel = interaction.channel
    const ch: GuildTextBasedChannel | null = (channel && !channel.isDMBased() && channel.isSendable()) ? channel : null;

    try {
        if (isRunning.get(guild.id)) { await interaction.reply({ content: i18next.t("common:Errores.isRunning", { a1: interaction.commandName }), flags: MessageFlags.Ephemeral }); return; };
        isRunning.set(guild.id, true)

        const isAllowed = await hasPermission(interaction, interaction.commandName);
        const command = interaction.options.getSubcommand();

        if (command === "resets") { await resrts(interaction, isAllowed, guild, ch); return }
        if (command === "rank") { await rankServ(interaction, isAllowed, guild, ch); return }

        if (!isAllowed) { await interaction.reply({ content: i18next.t("common:Errores.isAllowed"), flags: MessageFlags.Ephemeral }); return };

        switch (command) {
            case 'activar':
                await enableModal(interaction);
                break;
            case 'desactivar':
                await disable(interaction, guild);
                break;
            case `status`:
                await status(interaction, guild);
                break;
        }
    } catch (err) {
        error(`Error ejecutando comando Kancolle: ${err}`);
        if (interaction.replied || interaction.deferred) { await interaction.editReply(i18next.t("common:Errores.switch_catch_err", { a1: interaction.commandName })); }
        else { await interaction.reply({ content: i18next.t("common:Errores.switch_catch_err", { a1: interaction.commandName }), flags: MessageFlags.Ephemeral }); }
    } finally { isRunning.delete(guild.id) }
}

// ==================================================== activar ==================================================== //
async function enableModal(i: ChatInputCommandInteraction) {
    const chOp = new ChannelSelectMenuBuilder().setCustomId("canal").setPlaceholder("ej:#kantai-collection").setRequired(true).setChannelTypes(0, 5, 10, 11, 12);
    const chMod = new LabelBuilder().setLabel('Canal o Hilo para enviar aviso!').setChannelSelectMenuComponent(chOp);

    const roleOp = new RoleSelectMenuBuilder().setCustomId("role").setPlaceholder("ej:@kancolle-ntfy").setRequired(false);
    const roleMod = new LabelBuilder().setLabel('Rol a mencionar al notificar!').setRoleSelectMenuComponent(roleOp)

    const KancolleToDo = [
        { label: "Mantenimientos", value: "mnt", default: false, emoji: emojis.KC.mante },
        { label: "PvPs, Ejercicios!", value: "pvp", default: false, emoji: emojis.KC.pvp },
        { label: "Misiones", value: "quest", default: false, emoji: emojis.KC.quest },
        { label: "Extra Operaciones", value: "oem", default: false, emoji: emojis.KC.oem },
        { label: "Expediciones Mensuales", value: "mExp", default: false, emoji: emojis.KC.mexp },
        { label: "Senka.su Rank cut-off", value: "rank", default: false, emoji: emojis.KC.rank },
    ];

    const msgSendTypes = new StringSelectMenuBuilder().setCustomId("msgSendTypes")
        .setMinValues(1).setMaxValues(6).setPlaceholder("Mantenimiento, PvP, Misiones...").setRequired(false)
        .addOptions(KancolleToDo.map(l => new StringSelectMenuOptionBuilder().setLabel(l.label).setValue(l.value).setEmoji(l.emoji).setDefault(l.default)));
    const msgSend = new LabelBuilder().setLabel('Aviso silencioso!').setStringSelectMenuComponent(msgSendTypes);

    const ntfyTypes = new StringSelectMenuBuilder().setCustomId("ntfyTypes")
        .setMinValues(1).setMaxValues(6).setPlaceholder("RECUERDA ASIGNAR UN ROL!!").setRequired(false)
        .addOptions(KancolleToDo.map(l => new StringSelectMenuOptionBuilder().setLabel(l.label).setValue(l.value).setEmoji(l.emoji).setDefault(l.default)));
    const ntfy = new LabelBuilder().setLabel('Aviso con mención: Requiere un Rol!').setStringSelectMenuComponent(ntfyTypes);

    const modal = new ModalBuilder().setCustomId(`KanColle_${i.id}`).setTitle('Notificaciones de Kancolle').addLabelComponents(chMod, roleMod, msgSend, ntfy);
    await i.showModal(modal);
    // == // == // FINAL MODAL // == // == //
    const submitInt = await i.awaitModalSubmit({
        filter: (submitInt) => submitInt.customId === `KanColle_${i.id}` && submitInt.user.id === i.user.id,
        time: 120_000, // 2 min
    }).catch((e: any) => {
        debug(`Modal kancolle error ${e.message}`);
        i.followUp({ content: '⏱️ ¡El formulario expiró después de 2 minutos; si fue intencional, ignora esta notificación!', flags: MessageFlags.Ephemeral });
    }) as ModalSubmitInteraction;
    if (!submitInt) return;

    try {
        await submitInt.deferReply({ flags: MessageFlags.Ephemeral });
        const guild = submitInt.guild!
        const rawCh = submitInt.fields.getSelectedChannels("canal", true).first();
        const vrfyCh = rawCh ? await guild.channels.fetch(rawCh.id) as TextChannel : null;
        if (!vrfyCh) { await submitInt.editReply(i18next.t("commands:kancolle.interacciones.error_ch_noValido")); return; }

        const testPerm = masterPerm(vrfyCh, "viewCh|sendMsg|msgManager|mentions")
        if (!testPerm.ok) { await submitInt.editReply({ content: i18next.t("common:Errores.missing_permissions", { a1: `${rawCh}`, a2: testPerm.msg.join('\n') }) }); return; }

        const rawRole = submitInt.fields.getSelectedRoles("role")?.first() ?? null;
        const vrfyRol = rawRole ? await guild.roles.fetch(rawRole.id) : null;

        const rawSndAviso = submitInt.fields.getStringSelectValues("msgSendTypes") || [];
        const rawSndNtfy = submitInt.fields.getStringSelectValues("ntfyTypes") || [];
        if (rawSndAviso.length === 0 && rawSndNtfy.length === 0) {
            await submitInt.editReply({ content: i18next.t("commands:kancolle.interacciones.error_both_noValido") });
            return;
        }

        const { snd, ntfy } = turnIntoBoo(rawSndAviso, rawSndNtfy, !!vrfyRol)
        const ntfANDsnd = (ntfy: boolean, snd: boolean) => ({ av: ntfy || snd, ntf: ntfy });

        const cnfKC = {
            guild: guild.id,
            role: vrfyRol ? vrfyRol.id : null,
            channel: vrfyCh.id,
            pvp: ntfANDsnd(ntfy.pvp, snd.pvp),
            quest: ntfANDsnd(ntfy.quest, snd.quest),
            oem: ntfANDsnd(ntfy.oem, snd.oem),
            mnt: ntfANDsnd(ntfy.mnt, snd.mnt),
            mExp: ntfANDsnd(ntfy.mExp, snd.mExp),
            rank: ntfANDsnd(ntfy.rank, snd.rank)
        };

        await addBD(guild.id, cnfKC);

        const emb = new EmbedBuilder()
            .setTitle("Kancolle - Activado")
            .setColor(0xdf0000)
            .setFooter({ text: "⚓ |  Kancolle notify  | ⚓" })
            .setDescription("Si activaste aviso con mencion sin elegir Rol estas se desactivaran automaticamente")
            .addFields(
                { name: "Canal:", value: `<#${cnfKC.channel}>` },
                { name: "Rol a notificar:", value: `${cnfKC.role ? `<@&${cnfKC.role}>` : "No asignado!!"}` },
                { name: `${emojis.KC.mante} Mantenimientos:`, value: `Aviso: ${cnfKC.mnt.av ? "✅" : "❌"} | Notificacion: ${cnfKC.mnt.ntf ? "✅" : "❌"}` },
                { name: `${emojis.KC.pvp} PvP, Ejercicios:`, value: `Aviso: ${cnfKC.pvp.av ? "✅" : "❌"} | Notificacion: ${cnfKC.pvp.ntf ? "✅" : "❌"}` },
                { name: `${emojis.KC.quest} Misiones:`, value: `Aviso: ${cnfKC.quest.av ? "✅" : "❌"} | Notificacion: ${cnfKC.quest.ntf ? "✅" : "❌"}` },
                { name: `${emojis.KC.oem} Extra Operaciones:`, value: `Aviso: ${cnfKC.oem.av ? "✅" : "❌"} | Notificacion: ${cnfKC.oem.ntf ? "✅" : "❌"}` },
                { name: `${emojis.KC.mexp} Expediciones Mensuales:`, value: `Aviso: ${cnfKC.mExp.av ? "✅" : "❌"} | Notificacion: ${cnfKC.mExp.ntf ? "✅" : "❌"}` },
                { name: `${emojis.KC.rank} Senka.su Rank cut-off:`, value: `Aviso: ${cnfKC.rank.av ? "✅" : "❌"} | Notificacion: ${cnfKC.rank.ntf ? "✅" : "❌"}` }
            );

        await submitInt.editReply({ embeds: [emb] });
    } catch (err) {
        error(`Error ejecutando comando Kancolle: ${err}`);
        await submitInt.reply({ content: i18next.t("commands:mangadex.interacciones.command_error") }).catch(() => null);
    }
}

// ==================================================== disable ==================================================== //
async function disable(interacciones: ChatInputCommandInteraction, guild: Guild) {
    await interacciones.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        const cnf = await getKCConfig(guild.id);
        if (!cnf) {
            await interacciones.editReply(i18next.t("commands:kancolle.interacciones.error_no_config"));
            return;
        }
        await delKCBD(guild.id);
        interacciones.editReply(i18next.t("commands:kancolle.interacciones.activar_success"));
    } catch (err) {
        error(`Error ejecutando comando Kancolle: ${err}`);
        await interacciones.editReply({ content: i18next.t("commands:mangadex.interacciones.command_error") });
    }
}

// ==================================================== status ==================================================== //
async function status(interacciones: ChatInputCommandInteraction, guild: Guild) {
    await interacciones.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        const cnfList = await getKCConfig(guild.id) as Kancolle[];
        if (!cnfList || cnfList.length === 0) {
            await interacciones.editReply(i18next.t("commands:kancolle.interacciones.error_no_config"));
            return;
        }
        const cnf = cnfList[0];
        const emb = new EmbedBuilder()
            .setTitle(i18next.t("commands:kancolle.interacciones.status_embed_title"))
            .addFields(
                { name: i18next.t("commands:kancolle.interacciones.status_embed_field_basic"), value: i18next.t("commands:kancolle.interacciones.status_embed_field_basic_value", { a1: `< #${cnf.channel} > `, a2: cnf.role ? ` < @& ${cnf.role} > ` : "Ninguno!" }) },
                { name: i18next.t("commands:kancolle.interacciones.status_embed_field_active"), value: i18next.t("commands:kancolle.interacciones.status_embed_field_active_value", { a1: cnf.pvp.av ? "✅" : "❌", a2: cnf.quest.av ? "✅" : "❌", a3: cnf.oem.av ? "✅" : "❌", a4: cnf.mnt.av ? "✅" : "❌", a5: cnf.mExp.av ? "✅" : "❌", a6: cnf.rank.av ? "✅" : "❌" }) },
                { name: i18next.t("commands:kancolle.interacciones.status_embed_field_active_ntf"), value: i18next.t("commands:kancolle.interacciones.status_embed_field_active_value", { a1: cnf.pvp.ntf ? "✅" : "❌", a2: cnf.quest.ntf ? "✅" : "❌", a3: cnf.oem.ntf ? "✅" : "❌", a4: cnf.mnt.ntf ? "✅" : "❌", a5: cnf.mExp.ntf ? "✅" : "❌", a6: cnf.rank.ntf ? "✅" : "❌" }) }
            )
            .setColor(0x00FF00);

        await interacciones.editReply({ embeds: [emb] });
    } catch (err) {
        error(`Error ejecutando comando Kancolle: ${err}`);
        await interacciones.editReply({ content: i18next.t("commands:mangadex.interacciones.command_error") });
    }
}

// ==================================================== resets ==================================================== //
async function resrts(interacciones: ChatInputCommandInteraction, isAllowed: boolean, guild: Guild, ch: GuildTextBasedChannel | null) {
    await interacciones.deferReply({ flags: MessageFlags.Ephemeral });

    const ltim = allLefts(), TZjp = 'Asia/Tokyo', TZutc = 'UTC', TZmx = 'America/Mexico_City';
    const nowTime = getNowJST();

    const now = new Date();
    const jstDate = now.toLocaleString("es-MX", { timeZone: TZjp, hour12: false, timeStyle: 'short', dateStyle: 'short' });
    const mxDate = now.toLocaleString("es-MX", { timeZone: TZmx, hour12: false, timeStyle: 'short', dateStyle: 'short' });
    const utcDate = now.toLocaleString("es-MX", { timeZone: TZutc, hour12: false, timeStyle: 'short', dateStyle: 'short' });

    const dateInit = JSTtoUTC(maint.lastMaintStart ?? null);
    const dateEnd = JSTtoUTC(maint.MaintEnd ?? null);

    let statusStart = i18next.t("commands:kancolle.interacciones.resrts_let_statusStart"), statusEnd = "TBA";
    const tm = mantDates(dateInit, dateEnd)
    if (dateInit) {
        const datStartTime = dateInit.getTime();
        const diffStart = datStartTime - nowTime;

        if (dateEnd) {
            const datEndTime = dateEnd.getTime();
            const diffEnd = datEndTime - nowTime;

            if (diffStart > 0) {
                statusStart = i18next.t("commands:kancolle.interacciones.resrts_let_statusStart_C", { a1: turnDate(diffStart) });
                statusEnd = i18next.t("commands:kancolle.interacciones.resrts_let_statusEnd", { a1: turnDate(diffEnd) });
            } else if (diffEnd > 0) {
                statusStart = i18next.t("commands:kancolle.interacciones.resrts_let_statusStart_A");
                statusEnd = i18next.t("commands:kancolle.interacciones.resrts_let_statusEnd", { a1: turnDate(diffEnd) });
            } else {
                statusStart = i18next.t("commands:kancolle.interacciones.resrts_let_statusStart");
                statusEnd = i18next.t("commands:kancolle.interacciones.resrts_let_statusStart");
            }
        } else {
            if (diffStart > 0) {
                statusStart = i18next.t("commands:kancolle.interacciones.resrts_let_statusStart_C", { a1: turnDate(diffStart) });
            } else {
                statusStart = i18next.t("commands:kancolle.interacciones.resrts_let_statusStart_A");
            }
        }
    }

    const fields: { name: string, value: string }[] = [
        { name: i18next.t("commands:kancolle.interacciones.emb_name_pvp"), value: i18next.t("commands:kancolle.interacciones.emb_value_pvp", { a1: ltim.pvp, a2: ltim.pvp3h, a3: ltim.pvp15h }) },
        { name: i18next.t("commands:kancolle.interacciones.emb_name_quest"), value: i18next.t("commands:kancolle.interacciones.emb_value_quest", { a1: ltim.dQuest, a2: ltim.wQuest, a3: ltim.mQuest, a4: ltim.qQuest }) },
        { name: i18next.t("commands:kancolle.interacciones.emb_name_rank"), value: i18next.t("commands:kancolle.interacciones.emb_value_rank", { a1: ltim.dPtCutof, a2: ltim.mPtCutof }) },
        { name: i18next.t("commands:kancolle.interacciones.emb_name_oem"), value: i18next.t("commands:kancolle.interacciones.emb_value_oem", { a1: ltim.oem, a2: ltim.mExp }) },
        { name: i18next.t("commands:kancolle.interacciones.emb_name_mante"), value: i18next.t("commands:kancolle.interacciones.emb_value_mante", { a1: statusStart, a2: statusEnd }) }
    ]

    if (statusStart !== i18next.t("commands:kancolle.interacciones.resrts_let_statusStart")) {
        fields.push({
            name: "Fechas:", value:
                "> ***🇯🇵 JST*** | ***GMT+9***" + "\n" + `📅 INICIO: \`${tm.sJP}\` \n📅 TERMINO: \`${tm.eJP}\`` + "\n" +
                "> ***🌐 UTC***" + "\n" + `📅 INICIO: \`${tm.sUTC}\` \n📅 TERMINO: \`${tm.eUTC}\`` + "\n" +
                "> ***🇲🇽 MX_City*** | ***🇸🇻 SV*** | ***🇨🇷 CR*** | ***GMT-6***" + "\n" + `📅 INICIO: \`${tm.sMX}\` \n📅 TERMINO: \`${tm.eMX}\``
        })
    }

    const emb = new EmbedBuilder()
        .setDescription(i18next.t("commands:kancolle.interacciones.resrts_let_description", { a1: jstDate, a2: mxDate, a3: utcDate }))
        .addFields(fields)
        .setColor(0x00FF00)
        .setFooter({ text: `Kancolle Resets`, iconURL: "https://upload.wikimedia.org/wikipedia/ru/0/02/Kantai_Collection_logo.png" });

    const postCh = interacciones.options.getBoolean("post") ?? true;
    if (postCh) {
        if (!ch) { await interacciones.editReply({ content: `¡El canal no es válido para enviar el post!`, embeds: [emb] }); return; }

        const tommer = checkCooldown(guild.id, "Kancolle");
        const canSend = isAllowed || !tommer.onCooldown;
        if (canSend) {
            try {
                const msgSent = await ch.send({ embeds: [emb] });
                if (!isAllowed) startCooldown(guild.id, "Kancolle");
                msgDeleter({ msg: msgSent, userId: interacciones.user.id });
                await interacciones.editReply({ content: "Se envio la lista de Resets al canal." });
                return;
            } catch {
                await interacciones.editReply({ content: `Algo falló al publicar la lista de Resets en el canal. Mostrando respuesta privada:`, embeds: [emb] }); return;
            }
        } else {
            await interacciones.editReply({ content: `El comando está en Cooldown (${tommer.timeLeft}). Pide a un Admin que ejecute el comando para omitir el tiempo de espera.`, embeds: [emb] });
            return;
        }
    }
    await interacciones.editReply({ embeds: [emb] });
}

// ==================================================== Ranks ==================================================== //
async function rankServ(int: ChatInputCommandInteraction, isAllowed: boolean, guild: Guild, ch: GuildTextBasedChannel | null) {
    await int.deferReply({ flags: MessageFlags.Ephemeral });

    const waitData = await rankServers();
    const jstDate = new Date().toLocaleString("es-MX", { timeZone: 'Asia/Tokyo', hour12: false, timeStyle: 'short', dateStyle: 'short' });
    let isActual = `## Hora JP actual: ${jstDate}`;
    if (!waitData.ok || !waitData.data) {
        if (waitData.data) {
            isActual = `No pude obtener el mas reciente, JP hora ${waitData.date}`;
        } else {
            await int.editReply("No pude obtener la información del Rank|Server.");
            return;
        }
    }

    const emb = new EmbedBuilder();
    const server = int.options.getString("servidor") ?? null;
    if (!server) {
        const desc = `# Ranking servers! \n> ${isActual}\n\n Los cutoff son a las 15:00hrs y 03:00hrs! \n Mostrando información de los ${waitData.data.length} servers! \n \`Algunos servers toman su tiempo en actualizar!\``;
        emb.setDescription(desc)
            .setColor(0x00FF00)
            .setFooter({ text: `Kancolle Rank`, iconURL: "https://upload.wikimedia.org/wikipedia/ru/0/02/Kantai_Collection_logo.png" });

        const fields: { name: string, value: string, inline?: boolean }[] = [];
        let countField = 0;
        for (const srv of waitData.data) {
            if (countField === 25) break;
            countField++;
            const updatedDate = new Date(srv.lastModified).toLocaleString("es-MX", { timeZone: 'Asia/Tokyo', hour12: false, timeStyle: 'short', dateStyle: 'short' });
            fields.push({
                name: `> Actualizado: ${waitData.ok ? (srv.updated ? `✅` : `❌`) : `❌`} | ${updatedDate} JP Time \nID: ${srv.number} | Name: ${srv.jpName} (${srv.enName})`,
                value: `** Top 1:** ${srv.cutoff[1]} pts | ** Top 5:** ${srv.cutoff[5]} pts \n ** Top 20:** ${srv.cutoff[20]} pts | ** Top 100:** ${srv.cutoff[100]} pts \n ** Top 500:** ${srv.cutoff[500]} pts`
            });
        }
        emb.addFields(fields)
    }
    else {
        const idNum = Number(server);
        const dta = waitData.data.find((serv) => serv.number === idNum);
        if (!dta) {
            await int.editReply("¡No encontré información del servidor especificado!");
            return;
        }

        const updatedDate = new Date(dta.lastModified).toLocaleString("es-MX", { timeZone: 'Asia/Tokyo', hour12: false, timeStyle: 'short', dateStyle: 'short' });
        const descSingle = `# Ranking de ${dta.jpName} (${dta.enName})! \n> ${isActual}\n\n Los cutoff son a las 15:00hrs y 03:00hrs!\n \`Algunos servers toman su tiempo en actualizar!\``;

        emb.setDescription(descSingle)
            .setColor(0x00FF00)
            .setFooter({ text: `Kancolle Rank`, iconURL: "https://upload.wikimedia.org/wikipedia/ru/0/02/Kantai_Collection_logo.png" });

        const highestText = formatRecords(dta.records.higest);
        const lowestText = formatRecords(dta.records.lowest);

        emb.addFields(
            {
                name: `Actualizado: ${waitData.ok ? (dta.updated ? `✅` : `❌`) : `❌`} | ${updatedDate} JP Time`,
                value: `**TOP 1:** ${dta.cutoff[1]} pts\n**TOP 5:** ${dta.cutoff[5]} pts\n**TOP 20:** ${dta.cutoff[20]} pts\n**TOP 100:** ${dta.cutoff[100]} pts\n**TOP 500:** ${dta.cutoff[500]} pts`
            },
            { name: `📈 Histórico más Alto:`, value: highestText, inline: true },
            { name: `📉 Histórico más Bajo:`, value: lowestText, inline: true }
        );
    }

    const postCh = int.options.getBoolean("post") ?? true;
    if (postCh) {
        if (!ch) { await int.editReply({ content: `¡El canal no es válido para enviar el post!`, embeds: [emb] }); return; }

        const tommer = checkCooldown(guild.id, "Kancolle");
        const canSend = isAllowed || !tommer.onCooldown;
        if (canSend) {
            try {
                const msgSent = await ch.send({ embeds: [emb] });
                if (!isAllowed) startCooldown(guild.id, "Kancolle");
                msgDeleter({ msg: msgSent, userId: int.user.id });
                await int.editReply({ content: "Ranking del servidor enviado al canal." });
                return;
            } catch {
                await int.editReply({ content: `Algo falló al publicar el ranking en el canal. Mostrando respuesta privada:`, embeds: [emb] }); return;
            }
        } else {
            await int.editReply({ content: `El comando está en Cooldown (${tommer.timeLeft}). Pide a un Admin que ejecute el comando para omitir el tiempo de espera.`, embeds: [emb] });
            return;
        }
    }
    await int.editReply({ embeds: [emb] });
}

// ===== aux ===== //
export interface tunBoo { mnt: boolean; pvp: boolean; quest: boolean; oem: boolean; mExp: boolean; rank: boolean; }
export interface exitValue { snd: tunBoo; ntfy: tunBoo; }
export function turnIntoBoo(listSend: readonly string[] = [], listNtfy: readonly string[] = [], hasRole: boolean): exitValue {
    const mapBools = (lista: readonly string[]): tunBoo => ({
        mnt: lista.includes("mnt"),
        pvp: lista.includes("pvp"),
        quest: lista.includes("quest"),
        oem: lista.includes("oem"),
        mExp: lista.includes("mExp"),
        rank: lista.includes("rank")
    });

    const ntfyFalse: tunBoo = { mnt: false, pvp: false, quest: false, oem: false, mExp: false, rank: false };
    return { snd: mapBools(listSend || []), ntfy: hasRole ? mapBools(listNtfy || []) : ntfyFalse };
}

// ===== up/down ranks ===== //
function formatRecords(recordsObj: Record<RankLevel, RecordEntry>): string {
    const mesesRecord: Record<number, string> = {
        0: "Enero", 1: "Febrero", 2: "Marzo", 3: "Abril", 4: "Mayo", 5: "Junio",
        6: "Julio", 7: "Agosto", 8: "Septiembre", 9: "Octubre", 10: "Noviembre", 11: "Diciembre"
    };
    const levels: RankLevel[] = ['1', '5', '20', '100', '500'];
    return levels.map(level => {
        const item = recordsObj[level];
        if (!item) return `**Top ${level}:** N/A`;
        const nombreMes = mesesRecord[item.month] ?? `Mes ${item.month}`;
        return `**Top ${level}:** ${item.value.toLocaleString()} pts *(${nombreMes} ${item.year})*`;
    }).join('\n');
}
