// src/client/modules/test.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionsBitField, TextChannel, PermissionFlagsBits} from "discord.js";
import i18next from "i18next";
import { error, debug } from "../../logging";
import { getConfigMap, getGuildReplacementConfig } from "../database";
import { replacementMetaList} from "../../remplazadores/EmbedingConfig";

const apiReplacementDomainsEnv = process.env.API_REPLACEMENT_DOMAINS ? process.env.API_REPLACEMENT_DOMAINS.split(',').map(s => s.trim()) : [];


export async function registerTestCommand(): Promise<SlashCommandBuilder[]> {
  const testCommand = new SlashCommandBuilder()
    .setName("test")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDescription(i18next.t("command_test_description", { ns: "common" }) || "Verifica si el bot tiene los permisos necesarios para funcionar.")
    .addStringOption((option) =>
      option
        .setName("mode")
        .setDescription(i18next.t("test_command_mode_description", { ns: "common" }) || "Modo: 'null' (canal), 'guild' (servidor), 'embed' (embeds).")
        .setRequired(false)
        .addChoices(
          { name: "Canal Actual", value: "null" },
          { name: "Guild", value: "guild" },
          { name: "Embed", value: "embed" }
        )
    ) as SlashCommandBuilder;

  return [testCommand];
}

export async function handleTestCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  try {

    const memberPermissions = interaction.memberPermissions;
    const isAdmin = memberPermissions?.has(PermissionFlagsBits.ManageGuild) || interaction.guild?.ownerId === interaction.user.id;
    if (!isAdmin) {
      await interaction.reply({
        content: i18next.t("command_permission_error", { ns: "common" }) || "Solo los administradores o el propietario pueden usar este comando.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const mode = interaction.options.getString("mode") ?? "null";
    const requiredPermissions = [
      { name: i18next.t("permission_send_messages", { ns: "common" }) || "Enviar Mensajes", bit: PermissionsBitField.Flags.SendMessages },
      { name: i18next.t("permission_embed_links", { ns: "common" }) || "Insertar Enlaces", bit: PermissionsBitField.Flags.EmbedLinks },
      { name: i18next.t("permission_manage_messages", { ns: "common" }) || "Gestionar Mensajes", bit: PermissionsBitField.Flags.ManageMessages },
      { name: i18next.t("permission_read_message_history", { ns: "common" }) || "Leer Historial de Mensajes", bit: PermissionsBitField.Flags.ReadMessageHistory },
    ];

    const configMap = await getConfigMap();
    let embed = new EmbedBuilder()
      .setTitle(i18next.t("test_command_title", { ns: "common" }) || "Verificación de Permisos");

    if (mode === "null") {
      const channel = interaction.channel as TextChannel;
      if (!channel || !("permissionsFor" in channel)) {
        throw new Error("No se pudo obtener el canal o sus permisos.");
      }

      const botMember = interaction.guild?.members.me;
      if (!botMember) {
        throw new Error("No se pudo obtener el miembro del bot en el servidor.");
      }

      const permissions = channel.permissionsFor(botMember);
      if (!permissions) {
        throw new Error("No se pudieron verificar los permisos del bot.");
      }

      const guildId = interaction.guild?.id;
      const channelId = interaction.channelId;
      const guildConfig = configMap.get(guildId!);
      const channelConfig = guildConfig?.get(channelId) ?? { enabled: true, replyBots: true };

      embed
        .setDescription(i18next.t("test_command_channel_description", { ns: "common" }) || `Verificación de permisos para el canal: #${channel.name}`)
        .addFields(
          requiredPermissions.map((perm) => ({
            name: perm.name,
            value: permissions.has(perm.bit) ? "✅ Permitido" : "❌ Faltante",
            inline: true,
          }))
        )
        .addFields(
          {
            name: i18next.t("test_command_working_here", { ns: "common" }) || "Trabajando aquí",
            value: channelConfig.enabled ? "✅" : "❌",
            inline: true,
          },
          {
            name: i18next.t("test_command_reply_bots", { ns: "common" }) || "Hablar con otros bots",
            value: channelConfig.replyBots ? "✅" : "❌",
            inline: true,
          }
        );
    } else if (mode === "guild") {
      const guild = interaction.guild;
      if (!guild) {
        throw new Error("No se pudo obtener el servidor.");
      }

      const channels = guild.channels.cache.filter(channel => channel.type === 0); // Excluye hilos
      let allPermissionsOk = true;

      embed.setDescription(i18next.t("test_command_guild_description", { ns: "common" }) || "Verificación de permisos en todos los canales del servidor:");

      channels.forEach(channel => {
        const botMember = guild.members.me;
        if (botMember && "permissionsFor" in channel) {
          const permissions = channel.permissionsFor(botMember);
          const permissionBits = requiredPermissions.map(p => p.bit);
          const hasAllPermissions = permissions?.has(permissionBits) ?? false;
          allPermissionsOk = allPermissionsOk && hasAllPermissions;

          const guildId = guild.id;
          const channelId = channel.id;
          const guildConfig = configMap.get(guildId);
          const channelConfig = guildConfig?.get(channelId) ?? { enabled: true, replyBots: true };

          embed.addFields({
            name: `Canal: #${channel.name}`,
            value: (hasAllPermissions ? "✅ Todos los permisos OK" : "❌ Faltan permisos") +
              `\n${i18next.t("test_command_working_here", { ns: "common" }) || "Trabajando aquí"}: ${channelConfig.enabled ? "✅" : "❌"}` +
              `\n${i18next.t("test_command_reply_bots", { ns: "common" }) || "Hablar con otros bots"}: ${channelConfig.replyBots ? "✅" : "❌"}`,
            inline: false,
          });
        }
      });

      embed.setColor(allPermissionsOk ? "#00ff00" : "#ff0000");
    } else if (mode === "embed") {
      const guildId = interaction.guild?.id;
      if (!guildId) {
        throw new Error("No se pudo obtener el servidor.");
      }

      const replacementConfig = await getGuildReplacementConfig(guildId);
      embed.setDescription("Configuraciones de reemplazo de este servidor:");

      // Sección para los reemplazos manuales
      replacementMetaList.forEach(meta => {
        const config = replacementConfig.get(meta.name);
        let status: string;
        
        if (config === undefined) {
          status = "Default";
        } else if (!config.enabled) {
          status = "Deshabilitado";
        } else if (config.custom_url) {
          const userMention = config.user_id ? `<@${config.user_id}>` : 'usuario desconocido';
          status = `Customizado con: **${config.custom_url}** (por ${userMention})`;
        } else {
          status = "Default";
        }

        embed.addFields({
          name: meta.name,
          value: status,
          inline: false,
        });
      });
      
      // Sección para los reemplazos por API
      embed.addFields({ name: "Gestionados por EmbedEZ ", value: "Solo se pueden deshabilitar o habilitar." });

      apiReplacementDomainsEnv.forEach(domain => {
          const config = replacementConfig.get(domain);
          const status = (config === undefined || config.enabled) ? "✅ Habilitado" : "❌ Deshabilitado";

          embed.addFields({
              name: domain,
              value: status,
              inline: false,
          });
      });

      embed.setColor("#0099ff");
    } else {
      embed.setDescription(i18next.t("test_command_invalid_mode", { ns: "common" }) || "Modo no reconocido. Usa 'null' (por defecto), 'guild', o 'embed'.");
      embed.setColor("#ff0000");
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    debug(`Comando /test ejecutado con modo ${mode}`, "Commands.Test");
  } catch (err) {
    error(`Error al ejecutar comando /test: ${err}`, "Commands.Test");
    await interaction.reply({
      content: i18next.t("command_error", { ns: "common" }) || "Ocurrió un error al ejecutar el comando.",
      flags: MessageFlags.Ephemeral,
    });
  }
}