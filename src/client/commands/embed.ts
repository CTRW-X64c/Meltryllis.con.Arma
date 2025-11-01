// src/client/commands/embed.ts
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
        .setDescription(i18next.t("command_embed_description", { ns: "embed" }))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand((subcommand) =>
            subcommand
                .setName("configurar")
                .setDescription(i18next.t("command_embed_config", { ns: "embed" }))
                .addStringOption((option) =>
                    option
                        .setName("sitio")
                        .setDescription(i18next.t("embed_command_site_description", { ns: "embed" }))
                        .setRequired(true)
                        .addChoices(...allSites)
                )
                .addStringOption((option) =>
                    option
                        .setName("accion")
                        .setDescription(i18next.t("embed_command_action_description", { ns: "embed" })) 
                        .setRequired(true)
                        .addChoices(
                            { name: i18next.t("subcommand_enable", { ns: "embed" }), value: "enable" }, // Valor cambiado a "enable"
                            { name: i18next.t("subcommand_disable", { ns: "embed" }), value: "disable" },
                            { name: i18next.t("subcommand_custom", { ns: "embed" }), value: "custom" },
                            { name: i18next.t("subcommand_default", { ns: "embed" }), value: "default" } // Nueva opción para el estado por defecto
                        )
                )
                .addStringOption((option) =>
                    option
                        .setName("url_personalizada")
                        .setDescription(i18next.t("embed_command_custom_url", { ns: "embed" }))
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
                content: i18next.t("no_permission", { ns: "embed" }),
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
                    content: i18next.t("Api_default", { ns: "embed" }), 
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
                    content: i18next.t("Api_custom", { ns: "embed" }),
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
            if (!customUrlInput) {
                await interaction.reply({
                    content: i18next.t("Api_url_custom", { ns: "embed" }),
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
                    content: i18next.t("Api_url_custom", { ns: "embed" }),
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
            successMessage = i18next.t("embed_subcommand_disable_description", { ns: "embed", user: userMention, site: site });
        } else if (action === "enable") {
            successMessage = i18next.t("embed_subcommand_enable_description", { ns: "embed", user: userMention, site: site });
        } else if (action === "custom") {
            successMessage = i18next.t("embed_subcommand_custom_description", { ns: "embed", user: userMention, site: site, url: customUrlInput });
        } else { // default
            successMessage = i18next.t("embed_subcommand_default_description", { ns: "embed", user: userMention, site: site });
        }

        await interaction.reply({
            content: successMessage,
        });
    } catch (err) {
        error(`handleEmbedCommand()\tFallo para Guild: ${interaction.guildId}\tUsuario: ${interaction.user.id}\tError: ${err}`);
        await interaction.reply({
            content: i18next.t("embed_command_failed", { ns: "embed" }),
            flags: MessageFlags.Ephemeral,
        });
    }
}