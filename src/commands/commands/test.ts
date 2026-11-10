// src/Events-Commands/commands/test.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionsBitField, PermissionFlagsBits, Guild, TextBasedChannel } from "discord.js";
import i18next from "i18next";
import { error } from "../../sys/logging";
import { getConfigMap } from "../../sys/DB-Engine/links/ReplyBots";
import { getGuildReplacementConfig } from "../../sys/DB-Engine/links/Embed";
import { rMetaList } from "../../sys/embedding/embedingConfig";
import { hasPermission } from "../../sys/zGears/mPermission";
import { checkAllDomains, buildDomainStatusEmbed } from "../../sys/zGears/neTools";
import { checkCooldown, masterPerm, startCooldown } from "../../sys/zGears/auxiliares";
import { getGuildLimits } from "../../sys/DB-Engine/links/noRules";

export async function registerTestCommand(): Promise<SlashCommandBuilder[]> {
  const testCommand = new SlashCommandBuilder()
    .setName("test")
    .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
    .setDescription(i18next.t("commands:test.slashBuilder.test_description"))
    .addStringOption((o) => o.setName("mode").setDescription(i18next.t("commands:test.slashBuilder.mode_description")).setRequired(false)
      .addChoices(
        { name: i18next.t("commands:test.slashBuilder.guild"), value: "masterperm" },
        { name: i18next.t("commands:test.slashBuilder.channel"), value: "tstCh" },
        { name: i18next.t("commands:test.slashBuilder.embed_config"), value: "embed" },
        { name: "Configuracion de comportamiento!", value: "workhere" },
        { name: i18next.t("commands:test.slashBuilder.mode_domainds"), value: "chekdimains" }
      )
    );
  return [testCommand] as SlashCommandBuilder[];
}

const isRunning = new Map<string, boolean>()
export async function handleTestCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const { guild, channel } = interaction;
  if (!guild) { await interaction.reply(i18next.t("common:Errores.noGuild")); return; }
  if (!channel) { await interaction.reply(i18next.t("common:Errores.noChannel")); return; }

  try {
    const isAllowed = await hasPermission(interaction, interaction.commandName);
    if (!isAllowed) { await interaction.reply({ content: i18next.t("common:Errores.isAllowed"), flags: MessageFlags.Ephemeral, }); return; }

    if (isRunning.get(guild.id)) { await interaction.reply({ content: i18next.t("common:Errores.isRunning", { a1: interaction.commandName }), flags: MessageFlags.Ephemeral }); return; };
    isRunning.set(guild.id, true)

    const mode = interaction.options.getString("mode") ?? "masterperm";
    switch (mode) {
      case "masterperm": // fix?
        await guildPermision(interaction, channel, guild);
        break;
      case "tstCh": //fix
        await allChannels(interaction, guild);
        break;
      case "embed": // fix
        await ComEmbed(interaction, guild);
        break;
      case "workhere": // add
        await workeHere(interaction, guild);
        break;
      case "chekdimains":
        await ChekDomainsTest(interaction);
        break;
    }

  } catch (err) {
    error(`Error al ejecutar comando /test: ${err}`);
    if (interaction.replied || interaction.deferred) { await interaction.editReply(i18next.t("common:Errores.switch_catch_err", { a1: interaction.commandName })); }
    else { await interaction.reply({ content: i18next.t("common:Errores.switch_catch_err", { a1: interaction.commandName }), flags: MessageFlags.Ephemeral }); }
  } finally { isRunning.delete(guild.id) }
}

/* ========================= Permisos Generales ========================= */
async function guildPermision(interaction: ChatInputCommandInteraction, channel: TextBasedChannel, guild: Guild): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const embed = new EmbedBuilder().setTitle("TEST DE PERMISOS GENERALES!");
  const genPrm = masterPerm(guild, "viewCh|sendMsg|addlink|msgManager|readMsg|reactions|roles|chManager");

  const admin = [
    { name: i18next.t("commands:test.permisos.manage_guild"), bit: PermissionsBitField.Flags.ManageGuild },
    { name: i18next.t("commands:test.permisos.administrator"), bit: PermissionsBitField.Flags.Administrator }
  ];

  if (!channel || !("permissionsFor" in channel)) {
    await interaction.editReply({ content: i18next.t("commands:test.interacciones.test_error_permission") });
    return;
  }

  const permissions = channel.permissionsFor(interaction.guild!.members.me!);
  embed.setDescription(`Revisando los permisos generales. \n\`No aplican en canales privados\` \n\n ${genPrm.msg.join("\n")}`)
  embed
    .addFields(
      admin.map((perm) => ({
        name: i18next.t("commands:test.interacciones.permission_name", { name: perm.name }),
        value: permissions.has(perm.bit) ? i18next.t("commands:test.interacciones.status_allowed_admin") : i18next.t("commands:test.interacciones.status_missing"),
        inline: false,
      }))
    );

  embed.setFooter({ text: i18next.t("commands:test.interacciones.footer") });
  embed.setColor("#0300c8");

  await interaction.editReply({ embeds: [embed] })
}

/* ========================= Todos los coanels ========================= */
async function allChannels(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const emb = new EmbedBuilder().setTitle("TEST DE PERMISOS POR CANAL!").setDescription("\`Solo se muestran los canales que no tengan los permisos necesarios!\`");

  const listTxtCh: string[] = [];
  const TxtCh = guild.channels.cache.filter(channel => channel.type === 0); // Canales de Texto, Excluye hilos
  TxtCh.forEach(async (tch) => {
    const tCh = masterPerm(tch, "viewCh|sendMsg|addlink|msgManager|readMsg|reactions")
    if (!tCh.ok) listTxtCh.push(`Canal: <@${tch.id}> le faltan los permisos: \n${tCh.msg.filter((msg => msg.includes(`❌`))).join("\n")}`);
  });

  const listVoiCh: string[] = [];
  const VoiCh = guild.channels.cache.filter(channel => channel.type === 2); // Canales de Voz
  VoiCh.forEach(async (vch) => {
    const vCh = masterPerm(vch, "viewCh|voiceConnect")
    if (!vCh.ok) listVoiCh.push(`Canal: <@${vch.id}> le faltan los permisos: \n${vCh.msg.filter((msg => msg.includes(`❌`))).join("\n")}`);
  })

  emb.addFields(
    { name: `Canales de texto:`, value: `${listTxtCh.length > 0 ? listTxtCh.join("\n") : "✅ Todos los canles sin problemas!"}` },
    { name: `Canales de voz:`, value: `${listVoiCh.length > 0 ? listVoiCh.join("\n") : "✅ Todos los canles sin problemas!"}` }
  );

  emb.setFooter({ text: "Test de permisos de canales" }).setTimestamp().setColor(((listTxtCh.length + listVoiCh.length) > 1) ? 0x00ff00 : 0xff0000);

  await interaction.editReply({ embeds: [emb] })
}

/* ========================= Embedes Set ========================= */
async function ComEmbed(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const items: string[] = [];
  const rcc = await getGuildReplacementConfig(guild.id);
  const keyList = rMetaList.map((lcl) => lcl.dbKey);
  if (rcc && rcc.size > 0) {
    rcc.forEach((dta, key) => {
      let isApi = true;
      if (keyList.includes(key)) isApi = false;
      items.push(`> **${isApi ? `Api Embed: ${key}` : `Local Embed: ${key}`}**`
        + "\n"
        + `**Enable:** ${dta.enabled ? "✅" : "❌"}  ${isApi ? "" : ` | **Custom URL:** ${dta.custom_url ? dta.custom_url : "❌"}`} | Add: <@${dta.user_id}>`)
    })
  };

  const embed = new EmbedBuilder().setTitle("CONFIGURACIONES DE REMPLAZO!").setColor(0xAA22AA)
    .setDescription(`${items.length > 0 ? items.join("\n") : "No existen configuraciones en /embed"}`)
    .setTimestamp().setFooter({ text: "Mostrando solo sitios configurados" });

  interaction.editReply({ embeds: [embed] });
}

/* ========================= workHere ========================= */
async function workeHere(interaction: ChatInputCommandInteraction, guild: Guild) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const configMap = await getConfigMap();
  const gilConf = configMap.get(guild.id)

  const items: string[] = [];
  if (gilConf && gilConf.size > 0) {
    gilConf.forEach((dta, ch) => {
      items.push(`**Canal:** <#${ch}>` + "\n" + `***ReplyBots: ${dta.replyBots ? "✅" : "❌"} | Enable: ${dta.enabled ? "✅" : "❌"}***`)
    })
  }

  const emb = new EmbedBuilder().setTitle("CONFIGURACION DE CANALES!").setColor(0xAA0044)
    .setDescription(`${items.length > 0 ? items.join("\n") : "No existe configuraciones para /work"}`)
    .setTimestamp().setFooter({ text: "Mostrando solo canales configurados" });

  await interaction.editReply({ embeds: [emb] })
}

/* ========================= NeTest ========================= */
export async function ChekDomainsTest(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const chkBd = await getGuildLimits(interaction.guildId!)
    const noLimit = chkBd.chkDomain === true;
    const typeCooldown = noLimit ? "netCommandNoWait" : "netCommand"
    const cooldown = checkCooldown(interaction.guildId!, typeCooldown);

    if (cooldown.onCooldown) {
      await interaction.editReply({
        content: i18next.t("commands:test.interacciones.test_domaind_error", { a1: cooldown.timeLeft })
      });
      return;
    }

    await interaction.editReply({
      content: i18next.t("commands:test.interacciones.test_domaind_verificando")
    });

    startCooldown(interaction.guildId!, typeCooldown);

    const domainStatuses = await checkAllDomains();
    const embed = buildDomainStatusEmbed(domainStatuses);

    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    await interaction.editReply({
      content: i18next.t("commands:test.interacciones.command_error_verificando", { a1: err.message }),
    });
  }
}