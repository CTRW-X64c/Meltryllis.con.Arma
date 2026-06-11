// src/commands/chkperm.ts
import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder, MessageFlags, EmbedBuilder, GuildChannel, ChannelType, ThreadChannel } from "discord.js";
import i18next from "i18next";
import { hasPermission } from "../../sys/zGears/mPermission";
import { testPermisos, topRol } from "../../sys/zGears/auxiliares";
import { error } from "../../sys/logging";

export async function registerMypermissionsCommands() {
    const bitsChoise = [
        { name: i18next.t("commands:chkPerm.slashBuilder.modo_mngrBits"), value: "mngrBits" },
        { name: i18next.t("commands:chkPerm.slashBuilder.modo_meltrys"), value: "meltrys" },
        { name: i18next.t("commands:chkPerm.slashBuilder.modo_todos"), value: "todos" }
    ];
    const roles = [
        { name: i18next.t("commands:chkPerm.slashBuilder.permiso_admin"), value: "admin" },
        { name: i18next.t("commands:chkPerm.slashBuilder.permiso_ban"), value: "roles" },
        { name: i18next.t("commands:chkPerm.slashBuilder.permiso_moderate"), value: "moderateMembers" },
        { name: i18next.t("commands:chkPerm.slashBuilder.permiso_ban"), value: "banMember" },
        { name: i18next.t("commands:chkPerm.slashBuilder.permiso_kick"), value: "kickMember" },
    ];

    const mypermissionsCommand = new SlashCommandBuilder()
        .setName("server")
        .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
        .setDescription(i18next.t("commands:chkPerm.slashBuilder.description"))
        .addSubcommand(s => s.setName("bits").setDescription(i18next.t("commands:chkPerm.slashBuilder.bits"))
            .addUserOption(o => o.setName("user").setRequired(false).setDescription(i18next.t("commands:chkPerm.slashBuilder.user_description"))
            )
            .addRoleOption(o => o.setName("rol").setRequired(false).setDescription(i18next.t("commands:chkPerm.slashBuilder.rol_description"))
            )
            .addChannelOption(o => o.setName("canal").setRequired(false).setDescription(i18next.t("commands:chkPerm.slashBuilder.canal_description"))
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildCategory, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.GuildStageVoice, ChannelType.GuildForum, ChannelType.GuildMedia)
            )
            .addStringOption(o => o.setName("modo").setRequired(false).addChoices(bitsChoise).setDescription(i18next.t("commands:chkPerm.slashBuilder.modo_description"))
            )
        )
        .addSubcommand(s => s.setName("roles").setDescription(i18next.t("commands:chkPerm.slashBuilder.roles.description"))
            .addUserOption(o => o.setName("user").setRequired(true).setDescription(i18next.t("commands:chkPerm.slashBuilder.user_description"))
            )
            .addStringOption(o => o.setName("permiso").setRequired(true).addChoices(roles).setDescription(i18next.t("commands:chkPerm.slashBuilder.permiso_description"))
            )
        )
    return [mypermissionsCommand] as SlashCommandBuilder[];
}

// =============== switch master =============== //
export async function handleMypermissionsCommand(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guild = interaction.guild;
    if (!guild) { await interaction.editReply(i18next.t("common:Errores.noGuild")); return }

    const isAllowed = await hasPermission(interaction, interaction.commandName);
    if (!isAllowed) { await interaction.editReply({ content: i18next.t("common:Errores.isAllowed") }); return }

    const subcommand = interaction.options.getSubcommand();
    switch (subcommand) {
        case "bits": await bitPermissions(interaction); break;
        case "roles": await rolPermisions(interaction); break;
        default: await interaction.editReply(i18next.t("common:Errores.switchGeneral")); return
    }
}

// =============== bit Permisos =============== //
async function bitPermissions(interaction: ChatInputCommandInteraction) {
    try {
        const guild = interaction.guild!;
        const ch = interaction.options.getChannel("canal");
        const modo = interaction.options.getString("modo") || "todos";
        const user = interaction.options.getUser("user"); // User
        const member = user ? await guild.members.fetch(user.id).catch(() => null) : null;
        const inRol = interaction.options.getRole("rol"); // Roltsc

        const role = inRol ? await guild.roles.fetch(inRol.id).catch(() => null) : null;

        if (!member && !role) { await interaction.editReply({ content: i18next.t("commands:chkPerm.interacciones.nousernorole") }); return }

        const fields: { name: string, value: string, inline: boolean }[] = [];
        const toChki = (tp: any, lp: string, ch?: boolean) => {
            let txt = "";
            if (lp === "mngrBits") txt = i18next.t("commands:chkPerm.interacciones.f1_name_m1");
            else if (lp === "meltrys") txt = i18next.t("commands:chkPerm.interacciones.f1_name_m2");
            else txt = i18next.t("commands:chkPerm.interacciones.f1_name_m3");
            fields.push({ name: txt, value: role ? i18next.t("commands:chkPerm.interacciones.f1_value_rol", { a1: `<@&${role.id}>` }) : i18next.t("commands:chkPerm.interacciones.f1_value_user", { a1: `<@${member?.user.id}>` }), inline: false })
            if (lp === "todos") {
                const chk1 = testPermisos(tp, "mngrBits");
                const chk2 = testPermisos(tp, "meltrys");
                if (chk1.length > 0) fields.push({ name: i18next.t("commands:chkPerm.interacciones.f4_Admin"), value: chk1.join("\n"), inline: false });
                if (chk2.length > 0) fields.push({ name: i18next.t("commands:chkPerm.interacciones.f4_Non"), value: chk2.join("\n"), inline: false });
            }
            else {
                const chk = testPermisos(tp, lp);
                if (chk.length > 0) fields.push({ name: ch ? i18next.t("commands:chkPerm.interacciones.f3_name") : i18next.t("commands:chkPerm.interacciones.f2_name"), value: chk.join("\n"), inline: false });
            }
        }
        let title = ""; let desc = "";
        if (!ch) {
            const toChk = role ? role.permissions : member!.permissions;
            title = i18next.t("commands:chkPerm.interacciones.noch_title");
            desc = i18next.t("commands:chkPerm.interacciones.noch_desc");
            if (modo === "todos") toChki(toChk, "todos");
            else toChki(toChk, modo, false);
        }
        else if (ch instanceof GuildChannel || ch instanceof ThreadChannel) {
            let iCh = ch;
            const p = ch.parent && 'permissionsLocked' in ch;
            title = i18next.t("commands:chkPerm.interacciones.ch_title");
            switch (ch.type) {
                case ChannelType.PublicThread: case ChannelType.PrivateThread:
                    iCh = (ch as ThreadChannel).parent!;
                    desc = i18next.t("commands:chkPerm.interacciones.ch_desc_wire", { a1: `<#${ch.id}>` }) + "\n" + i18next.t("commands:chkPerm.interacciones.ch_desc_thr", { a1: `<#${iCh.id}>` }); break
                case ChannelType.GuildCategory:
                    desc = i18next.t("commands:chkPerm.interacciones.ch_desc_CatCat", { a1: `${ch.name}` }); break
                default:
                    desc = i18next.t("commands:chkPerm.interacciones.ch_desc", { a1: `<#${ch.id}>` });
                    if (p) desc += "\n" + (ch.permissionsLocked ? i18next.t("commands:chkPerm.interacciones.ch_desc_Catg", { a1: `${ch.parent.name}` }) : i18next.t("commands:chkPerm.interacciones.ch_desc_Catg2")); break
            }
            const toChk = role ? iCh.permissionsFor(role) : iCh.permissionsFor(member!);
            if (modo === "todos") toChki(toChk, "todos");
            else toChki(toChk, modo, true);
        }
        else {
            await interaction.editReply({ content: i18next.t("commands:chkPerm.interacciones.error_noguildch") });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(desc)
            .addFields(fields)
            .setColor(0x0099ff)
            .setFooter({ text: i18next.t("commands:chkPerm.interacciones.footer") });

        await interaction.editReply({ embeds: [embed] });

    } catch (e) {
        error(`No se pudo generar el listado de permisos! Error: ${e}`)
        await interaction.editReply({ content: i18next.t("commands:chkPerm.interacciones.error") });
    }
}

// =============== rol Permisos =============== //
async function rolPermisions(interaction: ChatInputCommandInteraction) {
    try {
        const user = interaction.options.getUser("user", true);
        const perm = interaction.options.getString("permiso", true);
        const guild = interaction.guild!;
        const member = await guild.members.fetch(user).catch(() => null);
        if (!member) { await interaction.editReply("No se encontro al usuario"); return; }

        const tl = (n: string): string => {
            switch (n) {
                case "admin": return i18next.t("help:embMaker.bitAdmin");
                case "roles": return i18next.t("help:embMaker.bitRoles");
                case "moderateMembers": return i18next.t("help:embMaker.bitModerateMembers");
                case "banMember": return i18next.t("help:embMaker.bitBanMember");
                case "kickMember": return i18next.t("help:embMaker.bitKickMember");
                default: return "";
            }
        }

        const fields: { name: string, value: string, inline: boolean }[] = [];
        const des = i18next.t("commands:chkPerm.interacciones.rol_desc_a") + `\n\n` +
            i18next.t("commands:chkPerm.interacciones.rol_desc_b") + `\n` +
            i18next.t("commands:chkPerm.interacciones.rol_desc_c") + `\n\n` +
            i18next.t("commands:chkPerm.interacciones.rol_desc_d", { a1: `<@${member.id}>`, a2: tl(perm) });

        const test = await topRol(guild, member, perm);
        const color = test.some(a => a.includes("❌")) ? 0xff0000 : 0x00ff00;
        if (test.length === 1) { fields.push({ name: `Mostrando que roles puede manipular:`, value: test[0], inline: false }) }
        else { for (let i = 0; i < test.length; i++) { fields.push({ name: `${i === 0 ? i18next.t("") : `(Parte ${i + 1})`}`, value: test[i], inline: false }) } }

        const emb = new EmbedBuilder()
            .setTitle("Sistema de jerarquia de roles segun el permiso")
            .setDescription(des)
            .setColor(color)
            .setFields(fields)

        await interaction.editReply({ embeds: [emb] });
    } catch (e) { error(`No se pudo generar el listado de permisos! Error: ${e}`) }
}
