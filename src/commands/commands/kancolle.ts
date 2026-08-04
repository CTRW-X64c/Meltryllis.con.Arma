import { ChannelType, ChatInputCommandInteraction, EmbedBuilder, Guild, MessageFlags, SlashCommandBuilder, TextChannel } from 'discord.js';
import { addBD, delBD, getKCConfig, Kancolle } from '../../sys/DB-Engine/links/KancolleBD';
import i18next from 'i18next';
import { hasPermission } from '../../sys/zGears/mPermission';
import { error } from '../../sys/logging';
import { testPermisos } from '../../sys/zGears/auxiliares';
import { leftTime, turnDate, JSTtoUTC, getNowJST } from '../../bgProcess/KanCron'
import { maint } from '../../sys/DB-Engine/links/KancolleBD'

export async function registerKantaiCollectionCommand() {
    const kancolle = new SlashCommandBuilder()
        .setName('kancolle')
        .setDescription('Kantai Collection')
        .addSubcommand(s => s.setName('resets').setDescription(i18next.t("commands:kancolle.slashBuilder.resets"))
            .addBooleanOption(o => o.setName('all').setDescription(i18next.t("commands:kancolle.slashBuilder.post_4_all")).setRequired(false)))
        .addSubcommand(s => s.setName('activar').setDescription(i18next.t("commands:kancolle.slashBuilder.activar"))
            .addChannelOption(o => o.setName('channel').setDescription(i18next.t("commands:kancolle.slashBuilder.activar_canal")).setRequired(false).addChannelTypes(ChannelType.GuildText, ChannelType.PrivateThread, ChannelType.PublicThread, ChannelType.GuildAnnouncement))
            .addRoleOption(o => o.setName('role').setDescription(i18next.t("commands:kancolle.slashBuilder.activar_role")).setRequired(false))
            .addBooleanOption(o => o.setName('aviso_pvp').setDescription(i18next.t("commands:kancolle.slashBuilder.activar_pvp_av")).setRequired(false))
            .addBooleanOption(o => o.setName('ntf_pvp').setDescription(i18next.t("commands:kancolle.slashBuilder.activar_pvp")).setRequired(false))
            .addBooleanOption(o => o.setName('aviso_quest').setDescription(i18next.t("commands:kancolle.slashBuilder.activar_quest_av")).setRequired(false))
            .addBooleanOption(o => o.setName('ntf_quest').setDescription(i18next.t("commands:kancolle.slashBuilder.activar_quest")).setRequired(false))
            .addBooleanOption(o => o.setName('aviso_oem').setDescription(i18next.t("commands:kancolle.slashBuilder.activar_oem_av")).setRequired(false))
            .addBooleanOption(o => o.setName('ntf_oem').setDescription(i18next.t("commands:kancolle.slashBuilder.activar_oem")).setRequired(false))
            .addBooleanOption(o => o.setName('aviso_expediciones').setDescription(i18next.t("commands:kancolle.slashBuilder.activar_expedition_av")).setRequired(false))
            .addBooleanOption(o => o.setName('ntf_expediciones').setDescription(i18next.t("commands:kancolle.slashBuilder.activar_expedition")).setRequired(false))
            .addBooleanOption(o => o.setName('aviso_mante').setDescription(i18next.t("commands:kancolle.slashBuilder.activar_mantenimiento_av")).setRequired(false))
            .addBooleanOption(o => o.setName('ntf_mante').setDescription(i18next.t("commands:kancolle.slashBuilder.activar_mantenimiento")).setRequired(false)))
        .addSubcommand(s => s.setName('desactivar').setDescription(i18next.t("commands:kancolle.slashBuilder.desactivar")))
        .addSubcommand(s => s.setName('status').setDescription(i18next.t("commands:kancolle.slashBuilder.status")))
    return [kancolle] as SlashCommandBuilder[];
}

export async function handleKantaiCollectionCommand(interaction: ChatInputCommandInteraction) {
    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const guild = interaction.guild;
        if (!guild) {
            await interaction.editReply(i18next.t("common:Errores.noGuild"));
            return;
        }

        const command = interaction.options.getSubcommand();
        if (command === "resets") {
            await resrts(interaction);
            return;
        }

        const isAllowed = await hasPermission(interaction, interaction.commandName);
        if (!isAllowed) {
            await interaction.editReply({ content: i18next.t("common:Errores.isAllowed"), });
            return;
        }

        switch (command) {
            case 'activar':
                await enable(interaction, guild);
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

async function enable(interaction: ChatInputCommandInteraction, guild: Guild) {
    try {
        const role = interaction.options.getRole("role");
        const channel = interaction.options.getChannel("channel");
        const avpvp = interaction.options.getBoolean("aviso_pvp"), ntfpvp = interaction.options.getBoolean("ntf_pvp");
        const avqst = interaction.options.getBoolean("aviso_quest"), ntfqst = interaction.options.getBoolean("ntf_quest");
        const avoem = interaction.options.getBoolean("aviso_oem"), ntfpem = interaction.options.getBoolean("ntf_oem");
        const avmante = interaction.options.getBoolean("aviso_mante"), ntfmante = interaction.options.getBoolean("ntf_mante");
        const avmExped = interaction.options.getBoolean("aviso_expediciones"), ntfmExped = interaction.options.getBoolean("ntf_expediciones");

        const cnf = (await getKCConfig(guild.id))[0];
        const cnfKC = {
            guild: guild.id,
            role: role?.id ?? cnf?.role ?? null,
            channel: channel?.id ?? cnf?.channel,
            pvp: { av: avpvp ?? cnf?.pvp?.av ?? true, ntf: ntfpvp ?? cnf?.pvp?.ntf ?? false },
            quest: { av: avqst ?? cnf?.quest?.av ?? true, ntf: ntfqst ?? cnf?.quest?.ntf ?? false },
            oem: { av: avoem ?? cnf?.oem?.av ?? true, ntf: ntfpem ?? cnf?.oem?.ntf ?? false },
            mnt: { av: avmante ?? cnf?.mnt?.av ?? true, ntf: ntfmante ?? cnf?.mnt?.ntf ?? true },
            mExp: { av: avmExped ?? cnf?.mExp?.av ?? true, ntf: ntfmExped ?? cnf?.mExp?.ntf ?? false },
        };

        const chTest = guild.channels.cache.get(cnfKC.channel);
        if (!chTest || !chTest.isTextBased()) {
            await interaction.editReply(i18next.t("commands:kancolle.interacciones.error_ch_noValido"));
            return;
        }

        const me = chTest.permissionsFor(guild.members.me!)
        const perChTo = testPermisos(me, "viewCh|sendMsg|msgManager|mentions");
        if (perChTo.some(p => p.includes("❌"))) {
            await interaction.editReply({ content: i18next.t("common:Errores.missing_permissions", { a1: `<#${cnfKC.channel}>`, a2: perChTo[0] }) });
            return;
        }

        await addBD(guild.id, cnfKC);
        await interaction.editReply(i18next.t("commands:kancolle.interacciones.activar_success"));
    } catch (err) {
        error(`Error ejecutando comando Kancolle: ${err}`);
        await interaction.editReply({ content: i18next.t("commands:mangadex.interacciones.command_error") });
    }
}

async function disable(interacciones: ChatInputCommandInteraction, guild: Guild) {
    try {
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

async function status(interacciones: ChatInputCommandInteraction, guild: Guild) {
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

async function resrts(interacciones: ChatInputCommandInteraction) {
    const everyone = interacciones.options.getBoolean("all") ?? false;
    const ltim = leftTime(), TZjp = 'Asia/Tokyo', TZutc = 'UTC', TZmx = 'America/Mexico_City';
    const nowTime = getNowJST();

    const now = new Date();
    const jstDate = now.toLocaleString("es-MX", { timeZone: TZjp, hour12: false, timeStyle: 'short', dateStyle: 'short' });
    const mxDate = now.toLocaleString("es-MX", { timeZone: TZmx, hour12: false, timeStyle: 'short', dateStyle: 'short' });
    const utcDate = now.toLocaleString("es-MX", { timeZone: TZutc, hour12: false, timeStyle: 'short', dateStyle: 'short' });

    const dateInit = JSTtoUTC(maint.lastMaintStart ?? null);
    const dateEnd = JSTtoUTC(maint.MaintEnd ?? null);

    let lasMante = "TBA", Finalizado = "TBA";
    let statusStart = i18next.t("commands:kancolle.interacciones.resrts_let_statusStart");
    let statusEnd = "TBA";

    if (dateInit) {
        const datStartTime = dateInit.getTime();
        lasMante = dateInit.toLocaleString("es-MX", { hour12: false, timeStyle: 'short', dateStyle: 'medium' });
        const diffStart = datStartTime - nowTime;

        if (dateEnd) {
            const datEndTime = dateEnd.getTime();
            Finalizado = dateEnd.toLocaleString("es-MX", { hour12: false, timeStyle: 'short', dateStyle: 'medium' });
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

    const emb = new EmbedBuilder()
        .setDescription(i18next.t("commands:kancolle.interacciones.resrts_let_description", { a1: jstDate, a2: mxDate, a3: utcDate }))
        .addFields(
            { name: i18next.t("commands:kancolle.interacciones.emb_name_pvp"), value: i18next.t("commands:kancolle.interacciones.emb_value_pvp", { a1: ltim.pvp, a2: ltim.pvp3h, a3: ltim.pvp15h }) },
            { name: i18next.t("commands:kancolle.interacciones.emb_name_quest"), value: i18next.t("commands:kancolle.interacciones.emb_value_quest", { a1: ltim.dQuest, a2: ltim.wQuest, a3: ltim.mQuest, a4: ltim.qQuest }) },
            { name: i18next.t("commands:kancolle.interacciones.emb_name_rank"), value: i18next.t("commands:kancolle.interacciones.emb_value_rank", { a1: ltim.dPtCutof, a2: ltim.mPtCutof }) },
            { name: i18next.t("commands:kancolle.interacciones.emb_name_oem"), value: i18next.t("commands:kancolle.interacciones.emb_value_oem", { a1: ltim.oem, a2: ltim.mExp }) },
            { name: i18next.t("commands:kancolle.interacciones.emb_name_mante"), value: i18next.t("commands:kancolle.interacciones.emb_value_mante", { a1: lasMante, a2: statusStart, a3: Finalizado, a4: statusEnd }) }
        )
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
