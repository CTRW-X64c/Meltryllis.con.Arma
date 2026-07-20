import { ChannelType, ChatInputCommandInteraction, EmbedBuilder, Guild, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { addBD, delBD, getKCConfig, Kancolle } from '../../bgProcess/KanCron';
import i18next from 'i18next';
import { hasPermission } from '../../sys/zGears/mPermission';
import { error } from '../../sys/logging';

export async function registerKantaiCollectionCommand() {
    const kancolle = new SlashCommandBuilder()
        .setName('kancolle')
        .setDescription('Kantai Collection')
        .addSubcommand(s => s.setName('activar').setDescription('Add notification')
            .addChannelOption(o => o.setName('channel').setDescription('Channel to notify in').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.PrivateThread, ChannelType.PublicThread, ChannelType.GuildAnnouncement))
            .addRoleOption(o => o.setName('role').setDescription('Role to notify').setRequired(false))
            .addBooleanOption(o => o.setName('pvp').setDescription('Notify about PVP resets').setRequired(false))
            .addBooleanOption(o => o.setName('quest').setDescription('Notify about daily resets').setRequired(false))
            .addBooleanOption(o => o.setName('oem').setDescription('Notify about OEM resets').setRequired(false))
            /*.addBooleanOption(o => o.setName('mante').setDescription('Notify about mante resets').setRequired(false))*/)
        .addSubcommand(s => s.setName('desactivar').setDescription('Desactiva las Notificaciones'))
        .addSubcommand(s => s.setName(`status`).setDescription('Muestra configuracion'))
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

        const isAllowed = await hasPermission(interaction, interaction.commandName);
        if (!isAllowed) {
            await interaction.editReply({ content: i18next.t("common:Errores.isAllowed"), });
            return;
        }

        switch (interaction.options.getSubcommand()) {
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
        const pvp = interaction.options.getBoolean("pvp");
        const q = interaction.options.getBoolean("quest");
        const oem = interaction.options.getBoolean("oem");
        //const mante = interaction.options.getBoolean("mante");

        const oldcnf = await getKCConfig(guild.id) as any as Kancolle;
        const cnfKC = {
            guild: guild.id,
            role: role?.id ?? oldcnf?.role ?? null,
            channel: channel ? channel.id : oldcnf?.channel,
            pvp: pvp ?? oldcnf?.pvp ?? true,
            quest: q ?? oldcnf?.quest ?? true,
            oem: oem ?? oldcnf?.oem ?? true,
            //mante: mante ?? oldcnf?.mante ?? true
        };

        if (!cnfKC.channel) {
            await interaction.editReply("❌ Debes especificar un canal");
            return;
        }

        await addBD(guild.id, cnfKC);
        await interaction.editReply("✅ Configuracion aplicada");
    } catch (err) {
        error(`Error ejecutando comando Kancolle: ${err}`);
        await interaction.editReply({ content: i18next.t("commands:mangadex.interacciones.command_error") });
    }
}

async function disable(interacciones: ChatInputCommandInteraction, guild: Guild) {
    try {
        const cnf = await getKCConfig(guild.id);
        if (!cnf) {
            await interacciones.editReply("❌ No hay configuracion");
            return;
        }
        await delBD(guild.id);
        interacciones.editReply("✅ Configuracion eliminada");
    } catch (err) {
        error(`Error ejecutando comando Kancolle: ${err}`);
        await interacciones.editReply({ content: i18next.t("commands:mangadex.interacciones.command_error") });
    }
}

async function status(interacciones: ChatInputCommandInteraction, guild: Guild) {
    try {
        const cnfList = await getKCConfig(guild.id) as Kancolle[];
        if (!cnfList || cnfList.length === 0) {
            await interacciones.editReply("❌ No hay configuracion");
            return;
        }
        const cnf = cnfList[0];
        const emb = new EmbedBuilder()
            .setTitle("Kancolle - Configuracion")
            .setDescription(`Canal: <#${cnf.channel}>\nRole: ${cnf.role ? `<@&${cnf.role}>` : "Ninguno!"} \n\n PVP: ${cnf.pvp ? "✅" : "❌"} \n Quests: ${cnf.quest ? "✅" : "❌"} \n OEM: ${cnf.oem ? "✅" : "❌"}`)
            .setColor(0x00FF00);

        await interacciones.editReply({ embeds: [emb] });
    } catch (err) {
        error(`Error ejecutando comando Kancolle: ${err}`);
        await interacciones.editReply({ content: i18next.t("commands:mangadex.interacciones.command_error") });
    }
}