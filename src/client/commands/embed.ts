// src/client/modules/embed.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from "discord.js";
import i18next from "i18next";
import { setGuildReplacementConfig } from "../database";
import { replacementMetaList } from "../../remplazadores/EmbedingConfig";
import { error } from "../../logging";

const apiReplacementDomainsEnv = process.env.API_REPLACEMENT_DOMAINS ? process.env.API_REPLACEMENT_DOMAINS.split(',').map(s => s.trim()) : [];

export async function registerEmbedCommand(): Promise<SlashCommandBuilder[]> {
    const manualSites = replacementMetaList.map((meta) => ({ name: meta.name, value: meta.name }));
    const apiSites = apiReplacementDomainsEnv.map((domain) => ({ name: domain, value: domain }));
    const allSites = [...manualSites, ...apiSites];

    const embedCommand = new SlashCommandBuilder()
        .setName("embed")
        .setDescription(i18next.t("command_embed_description", { ns: "common" }) || "Configure replacement domains for embeds")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand((subcommand) =>
            subcommand
                .setName("configurar")
                .setDescription("Configura el comportamiento de un embed para un sitio.")
                .addStringOption((option) =>
                    option
                        .setName("sitio")
                        .setDescription("El sitio que deseas configurar.")
                        .setRequired(true)
                        .addChoices(...allSites)
                )
                .addStringOption((option) =>
                    option
                        .setName("accion")
                        .setDescription("La acción que deseas realizar.")
                        .setRequired(true)
                        .addChoices(
                            { name: "Habilitar", value: "enable" }, // Valor cambiado a "enable"
                            { name: "Deshabilitar", value: "disable" },
                            { name: "Personalizar URL", value: "custom" },
                            { name: "Por defecto", value: "default" } // Nueva opción para el estado por defecto
                        )
                )
                .addStringOption((option) =>
                    option
                        .setName("url_personalizada")
                        .setDescription("La URL para personalizar (solo para sitios manuales).")
                        .setRequired(false)
                )
        );

    return [embedCommand] as SlashCommandBuilder[];
}

export async function handleEmbedCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
        const guildId = interaction.guild?.id;
        if (!guildId) {
            await interaction.reply({ content: "Este comando solo se puede usar en un servidor.", flags: MessageFlags.Ephemeral });
            return;
        }

        const memberPermissions = interaction.memberPermissions;
        const isAdmin = memberPermissions?.has(PermissionFlagsBits.ManageGuild) || interaction.guild?.ownerId === interaction.user.id;
        if (!isAdmin) {
            await interaction.reply({
                content: i18next.t("no_permission", { ns: "common" }) || "You need Manage Server permission or be the server owner to use this command.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const site = interaction.options.getString("sitio", true);
        const action = interaction.options.getString("accion", true);
        const customUrlInput = interaction.options.getString("url_personalizada", false);

        const isApiDomain = apiReplacementDomainsEnv .includes(site);

        let customUrl: string | null = null;
        let enabled = true;
        let userId: string | null = null;

        if (action === "default") {
            if (isApiDomain) {
                await interaction.reply({
                    content: "❌ Los servicios de API no pueden tener un estado por defecto. Usa 'Habilitar' o 'Deshabilitar'.",
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
            customUrl = null;
            enabled = true;
            userId = null;
        } else if (action === "enable") { // Lógica para habilitar
            customUrl = null;
            enabled = true;
            userId = interaction.user.id;
        } else if (action === "custom") {
            if (isApiDomain) {
                await interaction.reply({
                    content: "❌ Los servicios de API no pueden tener una URL personalizada.",
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
            if (!customUrlInput) {
                await interaction.reply({
                    content: "❌ Para la acción 'Personalizar URL', debes proporcionar una URL.",
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
            try {
                const parsedUrl = new URL(customUrlInput.startsWith("http") ? customUrlInput : `https://${customUrlInput}`);
                let hostname = parsedUrl.hostname.startsWith("www.") ? parsedUrl.hostname.substring(4) : parsedUrl.hostname;
                customUrl = hostname;
                enabled = true;
                userId = interaction.user.id;
            } catch (e) {
                await interaction.reply({
                    content: "❌ La URL proporcionada no es válida. Por favor, asegúrate de que sea un formato correcto.",
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
        } else if (action === "disable") {
            customUrl = null;
            enabled = false;
            userId = interaction.user.id;
        }

        await setGuildReplacementConfig(interaction.guildId!, site, { custom_url: customUrl, enabled, user_id: userId });

        const userMention = `<@${interaction.user.id}>`;
        let successMessage: string;

        if (action === "disable") {
            successMessage = `${userMention} deshabilitó el embed de: **${site}**!`;
        } else if (action === "enable") {
            successMessage = `${userMention} habilitó el embed de: **${site}**!`;
        } else if (action === "custom") {
            successMessage = `${userMention} actualizó el sitio: **${site}** a modo **personalizado** con la siguiente URL: **${customUrlInput}**!`;
        } else { // default
            successMessage = `${userMention} actualizó el sitio: **${site}** a modo: **por defecto**!`;
        }

        await interaction.reply({
            content: successMessage,
        });
    } catch (err) {
        error(`handleEmbedCommand()\tFailed for Guild: ${interaction.guildId}\tUser: ${interaction.user.id}\tError: ${err}`, "EmbedCommand");
        await interaction.reply({
            content: i18next.t("embed_command_failed", { ns: "common" }) || "Failed to update configuration.",
            flags: MessageFlags.Ephemeral,
        });
    }
}