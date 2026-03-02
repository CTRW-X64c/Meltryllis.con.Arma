// src/Events-Commands/commands/embed.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, MessageFlags, AutocompleteInteraction } from "discord.js";
import i18next from "i18next";
import { setGuildReplacementConfig } from "../../sys/DB-Engine/links/Embed";
import { replacementMetaList } from "../../sys/embedding/EmbedingConfig";
import { hasPermission } from "../../sys/zGears/mPermission";
import { error } from "../../sys/logging";

const localSites = replacementMetaList.map((meta) => ({ name: "Local: " + meta.name, value: meta.name }));  //cambio estetico para separa los sitios NSFW & SFW del APi y locales 
const dominiosAPIsfw = process.env.EMBEDEZ_SFW ? process.env.EMBEDEZ_SFW.split('|').map(s => s.trim()) : [];
const apiSitesSFW = dominiosAPIsfw.map((domain) => ({ name: "Api.SFW: " + domain, value: domain }));
const dominiosAPInsfw = process.env.EMBEDEZ_NSFW ? process.env.EMBEDEZ_NSFW.split('|').map(s => s.trim()) : [];
const apiSitesNSFW = dominiosAPInsfw.map((domain) => ({ name: "Api.NSFW: " + domain, value: domain }));
const allSites = [...localSites, ...apiSitesSFW, ...apiSitesNSFW];

// --- Cambio para autocompletar 
export async function embedAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedValue = interaction.options.getFocused().toLowerCase();  
    const filtered = allSites.filter(choice => 
        choice.name.toLowerCase().includes(focusedValue)
    );

    await interaction.respond(
        filtered.slice(0, 25).map(choice => ({ name: choice.name, value: choice.value }))
    );
}

export async function registerEmbedCommand(): Promise<SlashCommandBuilder[]> {
    const embedCommand = new SlashCommandBuilder()
        .setName("embed") 
        .setDescription(i18next.t("embed:slashBuilder.embed_description"))
        .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
        .addSubcommand((subcommand) =>
            subcommand
                .setName("configurar")
                .setDescription(i18next.t("embed:slashBuilder.embed_config"))
                .addStringOption((option) =>
                    option
                        .setName("sitio")
                        .setDescription(i18next.t("embed:slashBuilder.site_description"))
                        .setRequired(true)
                        .setAutocomplete(true) 
                )
                .addStringOption((option) =>
                    option
                        .setName("modo")
                        .setDescription(i18next.t("embed:slashBuilder.action_description")) 
                        .setRequired(true)
                        .addChoices(
                            { name: i18next.t("embed:slashBuilder.enable"), value: "enable" }, 
                            { name: i18next.t("embed:slashBuilder.disable"), value: "disable" },
                            { name: i18next.t("embed:slashBuilder.custom"), value: "custom" },
                            { name: i18next.t("embed:slashBuilder.default"), value: "default" } 
                        )
                )
                .addStringOption((option) =>
                    option
                        .setName("personalizar")
                        .setDescription(i18next.t("embed:slashBuilder.custom_url"))
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

        const isAllowed = await hasPermission(interaction, interaction.commandName);
        if (!isAllowed) {
            await interaction.reply({
                content: i18next.t("common:Errores.isAllowed"),
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const site = interaction.options.getString("sitio", true);
        const action = interaction.options.getString("modo", true);
        const customUrlInput = interaction.options.getString("personalizar", false);
        const isApiDomain = dominiosAPIsfw.includes(site) || dominiosAPInsfw.includes(site);

        let customUrl: string | null = null;
        let enabled = true;
        let userId: string | null = null;

        if (action === "default") {
            if (isApiDomain) {
                await interaction.reply({
                    content: i18next.t("embed:interacciones.Api_default"), 
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
            customUrl = null;
            enabled = true;
            userId = null;
        } else if (action === "enable") { 
            customUrl = null;
            enabled = true;
            userId = interaction.user.id;
        } else if (action === "custom") {
            if (isApiDomain) {
                await interaction.reply({
                    content: i18next.t("embed:interacciones.Api_custom"),
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
            if (!customUrlInput) {
                await interaction.reply({
                    content: i18next.t("embed:interacciones.Api_url_custom"),
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
                    content: i18next.t("embed:interacciones.Api_url_custom"),
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
            successMessage = i18next.t("embed:interacciones.disable_description", { a1: userMention, a2: site });
        } else if (action === "enable") {
            successMessage = i18next.t("embed:interacciones.enable_description", { a1: userMention, a2: site });
        } else if (action === "custom") {
            successMessage = i18next.t("embed:interacciones.custom_description", { a1: userMention, a2: site, a3: customUrlInput });
        } else { 
            successMessage = i18next.t("embed:interacciones.default_description", { a1: userMention, a2: site });
        }

        await interaction.reply({
            content: successMessage,
        });
    } catch (err) {
        error(`handleEmbedCommand()\tFallo para Guild: ${interaction.guildId}\tUsuario: ${interaction.user.id}\tError: ${err}`);
        await interaction.reply({
            content: i18next.t("embed:interacciones.failed"),
            flags: MessageFlags.Ephemeral,
        });
    }
}