import { ChannelSelectMenuBuilder, ChatInputCommandInteraction, EmbedBuilder, Guild, LabelBuilder, MessageFlags, ModalBuilder, ModalSubmitInteraction, RoleSelectMenuBuilder, SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextChannel } from 'discord.js';
import { addBD, delBD, getKCConfig, Kancolle } from '../../sys/DB-Engine/links/KancolleBD';
import i18next from 'i18next';
import { hasPermission } from '../../sys/zGears/mPermission';
import { error } from '../../sys/logging';
import { testPermisos } from '../../sys/zGears/auxiliares';
import { allLefts, mantDates, turnDate, JSTtoUTC, getNowJST } from '../../sys/zGears/kc_aux'
import { maint } from '../../sys/DB-Engine/links/KancolleBD'
import emojis from '../../../adds/otros/emojis.json'

export async function registerKantaiCollectionCommand() {
    const kancolle = new SlashCommandBuilder()
        .setName('kancolle')
        .setDescription('Kantai Collection')
        .addSubcommand(s => s.setName('resets').setDescription(i18next.t("commands:kancolle.slashBuilder.resets"))
            .addBooleanOption(o => o.setName('all').setDescription(i18next.t("commands:kancolle.slashBuilder.post_4_all")).setRequired(false)))
        .addSubcommand(s => s.setName('activar').setDescription(i18next.t("commands:kancolle.slashBuilder.activar")))
        .addSubcommand(s => s.setName('desactivar').setDescription(i18next.t("commands:kancolle.slashBuilder.desactivar")))
        .addSubcommand(s => s.setName('status').setDescription(i18next.t("commands:kancolle.slashBuilder.status")))
    return [kancolle] as SlashCommandBuilder[];
}

export async function handleKantaiCollectionCommand(interaction: ChatInputCommandInteraction) {
    try {

        const guild = interaction.guild;
        if (!guild) {
            await interaction.reply(i18next.t("common:Errores.noGuild"));
            return;
        }

        const command = interaction.options.getSubcommand();
        if (command === "resets") {
            await resrts(interaction);
            return;
        }

        const isAllowed = await hasPermission(interaction, interaction.commandName);
        if (!isAllowed) {
            await interaction.reply({ content: i18next.t("common:Errores.isAllowed"), });
            return;
        }

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
        await interaction.editReply({ content: i18next.t("commands:mangadex.interacciones.command_error") });
    }
}

// ==================================================== activar ==================================================== //
async function enableModal(interacciones: ChatInputCommandInteraction) {
    const modal = new ModalBuilder().setCustomId('modal_kancolle_activar').setTitle('Notificaciones de Kancolle');

    const chOp = new ChannelSelectMenuBuilder().setCustomId("canal").setPlaceholder("ej:#kantai-collection").setRequired(true).setChannelTypes(0, 5, 10, 11, 12);
    const chMod = new LabelBuilder().setLabel('Canal o Hilo a enviar!').setChannelSelectMenuComponent(chOp);

    const roleOp = new RoleSelectMenuBuilder().setCustomId("role").setPlaceholder("ej:@kancolle-ntfy").setRequired(false);
    const roleMod = new LabelBuilder().setLabel('Rol a mencionar al notificar!').setRoleSelectMenuComponent(roleOp)

    const KancolleToDo = [
        { label: "Mantenimientos", value: "mnt", default: true, emoji: emojis.mante },
        { label: "PvPs, Ejercicios!", value: "pvp", default: false, emoji: emojis.pvp },
        { label: "Misiones", value: "quest", default: false, emoji: emojis.quest },
        { label: "Extra Operaciones", value: "oem", default: false, emoji: emojis.oem },
        { label: "Expediciones Mensuales", value: "mExp", default: false, emoji: emojis.mexp },
    ];

    const msgSendTypes = new StringSelectMenuBuilder().setCustomId("msgSendTypes")
        .setMinValues(1).setMaxValues(5).setPlaceholder("Default: sin filtro. Max: 3").setRequired(true)
        .addOptions(KancolleToDo.map(l => new StringSelectMenuOptionBuilder().setLabel(l.label).setValue(l.value).setEmoji(l.emoji).setDefault(l.default)));
    const msgSend = new LabelBuilder().setLabel('Avisos a enviar').setStringSelectMenuComponent(msgSendTypes);

    const ntfyTypes = new StringSelectMenuBuilder().setCustomId("ntfyTypes")
        .setMinValues(1).setMaxValues(5).setPlaceholder("Default: sin filtro. Max: 3").setRequired(false)
        .addOptions(KancolleToDo.map(l => new StringSelectMenuOptionBuilder().setLabel(l.label).setValue(l.value).setEmoji(l.emoji).setDefault(l.default)));
    const ntfy = new LabelBuilder().setLabel('Avisar con mencion al Rol').setStringSelectMenuComponent(ntfyTypes);

    modal.addLabelComponents(chMod, roleMod, msgSend, ntfy)
    await interacciones.showModal(modal);
}

export async function enableModPost(interacciones: ModalSubmitInteraction) {
    try {
        await interacciones.deferReply({ flags: MessageFlags.Ephemeral });
        const guild = interacciones.guild!

        const rawCh = interacciones.fields.getSelectedChannels("canal", true).first();
        const vrfyCh = rawCh ? await guild.channels.fetch(rawCh.id) as TextChannel : null;
        if (!vrfyCh) { await interacciones.editReply(i18next.t("commands:kancolle.interacciones.error_ch_noValido")); return; }

        const me = vrfyCh.permissionsFor(guild.members.me!)
        const perChTo = testPermisos(me, "viewCh|sendMsg|msgManager|mentions");
        if (perChTo.some(p => p.includes("❌"))) {
            await interacciones.editReply({ content: i18next.t("common:Errores.missing_permissions", { a1: `<#${rawCh}>`, a2: perChTo[0] }) });
            return;
        }

        const rawRole = interacciones.fields.getSelectedRoles("role")?.first() ?? null;
        const vrfyRol = rawRole ? await guild.roles.fetch(rawRole.id) : null;

        const rawSndAviso = interacciones.fields.getStringSelectValues("msgSendTypes") || [];
        const rawSndNtfy = interacciones.fields.getStringSelectValues("ntfyTypes") || [];
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
        };

        await addBD(guild.id, cnfKC);

        const emb = new EmbedBuilder()
            .setTitle("Kancolle - Activado")
            .setColor(0xdf0000)
            .setFooter({ text: "⚓ |  Kancolle notify  | ⚓" })
            .addFields(
                { name: "Canal:", value: `<#${cnfKC.channel}>` },
                { name: "Rol a notificar:", value: `${cnfKC.role ? `<@&${cnfKC.role}>` : "No asignado!!"}` },
                { name: `${emojis.mante} Mantenimientos:`, value: `Aviso: ${cnfKC.mnt.av ? "✅" : "❌"} | Notificacion: ${cnfKC.mnt.ntf ? "✅" : "❌"}` },
                { name: `${emojis.pvp} PvP, Ejercicios:`, value: `Aviso: ${cnfKC.pvp.av ? "✅" : "❌"} | Notificacion: ${cnfKC.pvp.ntf ? "✅" : "❌"}` },
                { name: `${emojis.quest} Misiones:`, value: `Aviso: ${cnfKC.quest.av ? "✅" : "❌"} | Notificacion: ${cnfKC.quest.ntf ? "✅" : "❌"}` },
                { name: `${emojis.oem} Extra Operaciones:`, value: `Aviso: ${cnfKC.oem.av ? "✅" : "❌"} | Notificacion: ${cnfKC.oem.ntf ? "✅" : "❌"}` },
                { name: `${emojis.mexp} Expediciones Mensuales:`, value: `Aviso: ${cnfKC.mExp.av ? "✅" : "❌"} | Notificacion: ${cnfKC.mExp.ntf ? "✅" : "❌"}` },
            );

        await interacciones.editReply({ embeds: [emb] });
    } catch (err) {
        error(`Error ejecutando comando Kancolle: ${err}`);
        await interacciones.editReply({ content: i18next.t("commands:mangadex.interacciones.command_error") });
    }
}

// ==================================================== disable ==================================================== //
async function disable(interacciones: ChatInputCommandInteraction, guild: Guild) {
    try {
        await interacciones.deferReply({ flags: MessageFlags.Ephemeral });
        const cnf = await getKCConfig(guild.id);
        if (!cnf) {
            await interacciones.editReply(i18next.t("commands:kancolle.interacciones.error_no_config"));
            return;
        }
        await delBD(guild.id);
        interacciones.editReply(i18next.t("commands:kancolle.interacciones.activar_success"));
    } catch (err) {
        error(`Error ejecutando comando Kancolle: ${err}`);
        await interacciones.editReply({ content: i18next.t("commands:mangadex.interacciones.command_error") });
    }
}

// ==================================================== status ==================================================== //
async function status(interacciones: ChatInputCommandInteraction, guild: Guild) {
    try {
        await interacciones.deferReply({ flags: MessageFlags.Ephemeral });
        const cnfList = await getKCConfig(guild.id) as Kancolle[];
        if (!cnfList || cnfList.length === 0) {
            await interacciones.editReply(i18next.t("commands:kancolle.interacciones.error_no_config"));
            return;
        }
        const cnf = cnfList[0];
        const emb = new EmbedBuilder()
            .setTitle(i18next.t("commands:kancolle.interacciones.status_embed_title"))
            .addFields(
                { name: i18next.t("commands:kancolle.interacciones.status_embed_field_basic"), value: i18next.t("commands:kancolle.interacciones.status_embed_field_basic_value", { a1: `<#${cnf.channel}>`, a2: cnf.role ? `<@&${cnf.role}>` : "Ninguno!" }) },
                { name: i18next.t("commands:kancolle.interacciones.status_embed_field_active"), value: i18next.t("commands:kancolle.interacciones.status_embed_field_active_value", { a1: cnf.pvp.av ? "✅" : "❌", a2: cnf.quest.av ? "✅" : "❌", a3: cnf.oem.av ? "✅" : "❌", a4: cnf.mnt.av ? "✅" : "❌", a5: cnf.mExp.av ? "✅" : "❌" }) },
                { name: i18next.t("commands:kancolle.interacciones.status_embed_field_active_ntf"), value: i18next.t("commands:kancolle.interacciones.status_embed_field_active_value", { a1: cnf.pvp.ntf ? "✅" : "❌", a2: cnf.quest.ntf ? "✅" : "❌", a3: cnf.oem.ntf ? "✅" : "❌", a4: cnf.mnt.ntf ? "✅" : "❌", a5: cnf.mExp.ntf ? "✅" : "❌" }) }
            )
            .setColor(0x00FF00);

        await interacciones.editReply({ embeds: [emb] });
    } catch (err) {
        error(`Error ejecutando comando Kancolle: ${err}`);
        await interacciones.editReply({ content: i18next.t("commands:mangadex.interacciones.command_error") });
    }
}

// ==================================================== resets ==================================================== //
async function resrts(interacciones: ChatInputCommandInteraction) {
    await interacciones.deferReply({ flags: MessageFlags.Ephemeral });
    const everyone = interacciones.options.getBoolean("all") ?? false;
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
    if (!everyone) {
        await interacciones.editReply({ embeds: [emb] });
    } else {
        try {
            const ch = interacciones.channel
            if (ch && ch.isTextBased()) {
                const txtch = ch as TextChannel
                await interacciones.editReply({ content: "✅ " })
                const tempMsg = await txtch.send({ embeds: [emb] });
                setTimeout(() => { if (tempMsg.deletable) tempMsg.delete().catch(() => { }) }, 30_000);
            } else await interacciones.editReply({ content: i18next.t("commands:kancolle.interacciones.resrts_let_send_fail"), embeds: [emb] });
        } catch (e) { await interacciones.editReply({ content: i18next.t("commands:kancolle.interacciones.resrts_let_send_fail"), embeds: [emb] }) }
    }
}

// ===== aux ===== //
export interface tunBoo { mnt: boolean; pvp: boolean; quest: boolean; oem: boolean; mExp: boolean; }
export interface exitValue { snd: tunBoo; ntfy: tunBoo; }
export function turnIntoBoo(listSend: readonly string[] = [], listNtfy: readonly string[] = [], hasRole: boolean): exitValue {
    const mapBools = (lista: readonly string[]): tunBoo => ({
        mnt: lista.includes("mnt"),
        pvp: lista.includes("pvp"),
        quest: lista.includes("quest"),
        oem: lista.includes("oem"),
        mExp: lista.includes("mExp")
    });

    const ntfyFalse: tunBoo = { mnt: false, pvp: false, quest: false, oem: false, mExp: false };
    return { snd: mapBools(listSend || []), ntfy: hasRole ? mapBools(listNtfy || []) : ntfyFalse };
}
