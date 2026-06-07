import { ChatInputCommandInteraction, Client, EmbedBuilder, Events, GuildMember, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { error } from "../sys/logging";
import getPool from "../sys/DB-Engine/database";
import i18next from "i18next";
import { hasPermission } from "../sys/zGears/mPermission";
import { testPermisos, topRol } from "../sys/zGears/auxiliares";

/* ======================================== registro ======================================== */
export async function registernoEveryoneCommand(): Promise<SlashCommandBuilder[]> {
    const noEveryoneCommand = new SlashCommandBuilder()
        .setName("noeveryone")
        .setDescription(i18next.t("commands:noeveryone.slashBuilder.description"))
        .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
        .addBooleanOption(o => o.setName("activado").setRequired(false).setDescription(i18next.t("commands:noeveryone.slashBuilder.estado_description")))
        .addRoleOption(o => o.setName("rol").setRequired(false).setDescription(i18next.t("commands:noeveryone.slashBuilder.rol_description")))
        .addBooleanOption(o => o.setName("penalizar").setRequired(false).setDescription(i18next.t("commands:noeveryone.slashBuilder.penalidad_description")));
    return [noEveryoneCommand] as SlashCommandBuilder[];
}

/* ======================================== Engine ======================================== */
let cBan: Map<string, number> = new Map();
let tBan: Map<string, NodeJS.Timeout> = new Map();
const banSpam = (m: GuildMember): string | null => {
    try {
        const id = `${m.guild.id}-${m.id}`;
        const bBan = 3_600_000; const bc = (cBan.get(id) || 0) + 1; cBan.set(id, bc);
        if (tBan.has(id)) clearTimeout(tBan.get(id));
        tBan.set(id, setTimeout(() => { cBan.delete(id); tBan.delete(id); }, bBan));
        switch (bc) {
            case 1: return null;
            case 2:
                if (tBan.has(id)) clearTimeout(tBan.get(id));
                m.timeout(bBan, i18next.t("commands:test.interacciones.ban_msg_1")).catch(() => { });
                tBan.set(id, setTimeout(() => { cBan.delete(id); tBan.delete(id); }, bBan * 2));
                return i18next.t("commands:test.interacciones.ban_msg_1_return", { a1: `<@${m.id}>` });
            case 3:
                if (tBan.has(id)) clearTimeout(tBan.get(id));
                m.timeout(bBan * 2, i18next.t("commands:test.interacciones.ban_msg_2")).catch(() => { });
                tBan.set(id, setTimeout(() => { cBan.delete(id); tBan.delete(id); }, bBan * 3));
                return i18next.t("commands:test.interacciones.ban_msg_2_return", { a1: `<@${m.id}>` });
            default:
                if (tBan.has(id)) clearTimeout(tBan.get(id));
                m.timeout(bBan * 12, i18next.t("commands:test.interacciones.ban_msg_3")).catch(() => { });
                cBan.delete(id); tBan.delete(id);
                return i18next.t("commands:test.interacciones.ban_msg_3_return", { a1: `<@${m.id}>` });
        }
    } catch { return null }
}

let kchG: { [key: string]: { state: boolean, penality: boolean, rol: string | null } } = {};
const mr = /@(here|everyone)\b/i;
function noEveryone(cli: Client): void {
    cli.on(Events.MessageCreate, async (msg) => {
        if (!mr.test(msg.content)) return;
        if (!cli.user || msg.author.bot) return;
        if (!msg.deletable) return;
        if (!msg.guild?.id || !msg.member) return;

        const gc = kchG[msg.guild.id];
        if (!gc || !gc.state) return;
        if (gc.rol && msg.member.roles.cache.has(gc.rol)) return;

        try {
            let rsp = i18next.t("commands:test.interacciones.del_msg", { a1: `<@${msg.author.id}>` });
            await msg.delete().catch(() => { });
            if (gc.penality && !msg.member.permissions.has(PermissionFlagsBits.Administrator)) { const x = banSpam(msg.member); if (x) rsp = x; }
            const y = await msg.channel.send(rsp); setTimeout(async () => { if (y.deletable) await y.delete().catch(() => { }); }, 10_000);
        } catch (e) {
            const err = (e as Error).message;
            if (!err.includes("Missing Permissions") && !err.includes("Missing Access")) { error(`Error en sistema anti-menciones, Guild: ${msg.guild.name}, Error: ${e}`) }
        }
    });
}

/* ======================================== commandos ======================================== */
export async function handleNoEveryoneCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        const guild = interaction.guild;
        if (!guild) { await interaction.editReply({ content: i18next.t(i18next.t("common:Errores.noGuild")) }); return }

        const isAllowed = await hasPermission(interaction, interaction.commandName);
        if (!isAllowed) { await interaction.editReply({ content: i18next.t("common:Errores.isAllowed"), }); return }

        const im = guild.members.me?.permissions;
        const serPrm = testPermisos(im, "viewCh|readMsg|msgManager");
        if (serPrm.some(p => p.includes("❌"))) { await interaction.editReply({ content: i18next.t("commands:noeveryone.interacciones.no_Perms", { a1: serPrm.join("\n") }) }); return }
        let desc = i18next.t("commands:noeveryone.interacciones.embMaker_desc")
        const state = interaction.options.getBoolean("activado");
        const role = interaction.options.getRole("rol");
        const punish = interaction.options.getBoolean("penalizar");
        const actual = kchG[guild.id];
        let tRole = role ? role.id : (actual?.rol ?? null);
        const tState = state !== null ? state : (actual?.state ?? false);
        let castigo = punish !== null ? punish : (actual?.penality ?? false);
        if (role?.id === actual?.rol) tRole = null;
        const x = testPermisos(im, "moderateMembers"); if (x.some(p => p.includes("❌"))) { castigo = false; desc += i18next.t("commands:noeveryone.interacciones.embMaker_desc_2", { a1: x.join("\n") }) };
        const fields: { name: string; value: string; inline?: boolean }[] = [
            { name: i18next.t("commands:noeveryone.interacciones.embMaker_estado"), value: tState ? i18next.t("commands:noeveryone.interacciones.embMaker_estado_on") : i18next.t("commands:noeveryone.interacciones.embMaker_estado_off") },
            { name: i18next.t("commands:noeveryone.interacciones.embMaker_rol"), value: tRole ? `<@&${tRole}>` : i18next.t("commands:noeveryone.interacciones.embMaker_rol_none") },
            { name: i18next.t("commands:noeveryone.interacciones.embMaker_penalidad"), value: castigo ? i18next.t("commands:noeveryone.interacciones.embMaker_estado_on") : i18next.t("commands:noeveryone.interacciones.embMaker_estado_off") }
        ];

        if (castigo) {
            const rChunk = await topRol(guild);
            if (rChunk.length === 1) fields.push({ name: i18next.t("commands:noeveryone.interacciones.embMaker_top"), value: castigo ? rChunk[0] : i18next.t("commands:noeveryone.interacciones.embMaker_top_none"), inline: false })
            else for (let i = 0; i < rChunk.length; i++) { fields.push({ name: `${i === 0 ? i18next.t("commands:noeveryone.interacciones.embMaker_top") : `(Parte ${i + 1})`}`, value: rChunk[i] }) }
        }

        await updateCache(guild.id, tState, castigo, tRole);

        const emb = new EmbedBuilder().setTitle(i18next.t("commands:noeveryone.interacciones.embMaker_title")).setDescription(desc).addFields(fields).setColor(0x00AE86).setTimestamp();
        await interaction.editReply({ embeds: [emb] });
    } catch (e) { error(`Error ejecutando comando noeveryone: ${e}`, "Commands.NoEveryone"); }
}

/* ======================================== BD system ======================================== */
async function genCache(): Promise<boolean> {
    try {
        const pool = await getPool();
        const [rows]: any = await pool.query("SELECT guild_id, state, penality, role FROM noeveryone");
        kchG = {};
        for (const config of rows) {
            kchG[config.guild_id] = { state: Boolean(config.state), penality: Boolean(config.penality), rol: config.role || null };
        } return true;
    } catch (e) { error(`Error cargando cache de anti-menciones: ${e}`); return false }
}

async function updateCache(guildId: string, state: boolean, penality: boolean, role: string | null): Promise<void> {
    try {
        const pool = await getPool();
        await pool.query("INSERT INTO noeveryone (guild_id, state, penality, role) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE state = ?, penality = ?, role = ? ", [guildId, state, penality, role, state, penality, role]);
        kchG[guildId] = { state, penality, rol: role };
    } catch (e) { error(`Error actualizando cache de anti-menciones: ${e}`) }
}

/* ======================================== Init ======================================== */
export async function initNoEveryone(client: Client) {
    const rdy = await genCache();
    if (!rdy) error("¡No se pudo cargar la cache de anti-menciones!");
    noEveryone(client);
}
