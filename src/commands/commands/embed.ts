// src/Events-Commands/commands/embed.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, MessageFlags, AutocompleteInteraction } from "discord.js";
import i18next from "i18next";
import { setGuildReplacementConfig } from "../../sys/DB-Engine/links/Embed";
import { rMetaList } from "../../sys/embedding/embedingConfig";
import { hasPermission } from "../../sys/zGears/mPermission";
import { error } from "../../sys/logging";
import { embedezSFW, embedezNSFW, meltrillisApi } from "../../sys/embedding/domainChecker";

// --- Cambio para autocompletar 
export async function embedAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const L = rMetaList.map((meta) => ({ name: "Remplacer: " + meta.name, value: meta.name }));
    const eS = embedezSFW.map((domain) => ({ name: "Api.SFW: " + domain, value: domain }));
    const eN = embedezNSFW.map((domain) => ({ name: "Api.NSFW: " + domain, value: domain }));
    const mel = meltrillisApi.map((domain) => ({ name: "Meltryllis.Api: " + domain, value: domain }));
    const X = interaction.options.getFocused().toLowerCase();
    const list = [...L, ...eS, ...eN, ...mel].filter(y => y.name.toLowerCase().includes(X));
    await interaction.respond(list.slice(0, 25).map(c => ({ name: c.name, value: c.value })));
}

export async function registerEmbedCommand(): Promise<SlashCommandBuilder[]> {
    const embedCommand = new SlashCommandBuilder()
        .setName("embed")
        .setDescription(i18next.t("commands:embed.slashBuilder.embed_description"))
        .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
        .addSubcommand((subcommand) =>
            subcommand
                .setName("configurar")
                .setDescription(i18next.t("commands:embed.slashBuilder.embed_config"))
                .addStringOption((option) =>
                    option
                        .setName("sitio")
                        .setDescription(i18next.t("commands:embed.slashBuilder.site_description"))
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("modo")
                        .setDescription(i18next.t("commands:embed.slashBuilder.action_description"))
                        .setRequired(true)
                        .addChoices(
                            { name: i18next.t("commands:embed.slashBuilder.enable"), value: "enable" },
                            { name: i18next.t("commands:embed.slashBuilder.disable"), value: "disable" },
                            { name: i18next.t("commands:embed.slashBuilder.custom"), value: "custom" },
                            { name: i18next.t("commands:embed.slashBuilder.default"), value: "default" }
                        )
                )
                .addStringOption((option) =>
                    option
                        .setName("personalizar")
                        .setDescription(i18next.t("commands:embed.slashBuilder.custom_url"))
                        .setRequired(false)
                )
        );
    return [embedCommand] as SlashCommandBuilder[];
}

export async function handleEmbedCommand(i: ChatInputCommandInteraction): Promise<void> {
    await i.deferReply({ flags: MessageFlags.Ephemeral })
    const guildId = i.guild?.id;
    if (!guildId) {
        await i.editReply({ content: "Este comando solo se puede usar en un servidor." });
        return;
    }

    const isAllowed = await hasPermission(i, i.commandName);
    if (!isAllowed) {
        await i.editReply({ content: i18next.t("common:Errores.isAllowed") });
        return;
    }

    const site = i.options.getString("sitio", true);
    const modo = i.options.getString("modo", true);
    const url = i.options.getString("personalizar", false);
    const isApi = embedezNSFW.includes(site) || embedezSFW.includes(site) || meltrillisApi.includes(site);

    let customUrl: string | null = null;
    let enabled = true;
    let userId: string | null = null;
    let respuesta = "";

    try {
        switch (modo) {
            case "default":
                if (isApi) { await i.editReply({ content: i18next.t("commands:embed.interacciones.Api_default") }); return; }
                customUrl = null; enabled = true; userId = null;
                respuesta = i18next.t("commands:embed.interacciones.default_description", { a1: `<@${i.user.id}>`, a2: site });
                break;

            case "enable":
                customUrl = null; enabled = true; userId = i.user.id;
                respuesta = i18next.t("commands:embed.interacciones.enable_description", { a1: `<@${i.user.id}>`, a2: site });
                break;

            case "disable":
                customUrl = null; enabled = false; userId = i.user.id;
                respuesta = i18next.t("commands:embed.interacciones.disable_description", { a1: `<@${i.user.id}>`, a2: site });
                break;

            case "custom":
                if (isApi) { await i.editReply({ content: i18next.t("commands:embed.interacciones.Api_custom") }); return; }
                if (!url) { await i.editReply({ content: i18next.t("commands:embed.interacciones.Api_url_custom") }); return; }
                try {
                    const parsedUrl = new URL(url.startsWith("http") ? url : `https://${url}`);
                    let hostname = parsedUrl.hostname.startsWith("www.") ? parsedUrl.hostname.substring(4) : parsedUrl.hostname;
                    customUrl = hostname; enabled = true; userId = i.user.id;
                } catch (e) { await i.editReply({ content: i18next.t("commands:embed.interacciones.Api_url_custom") }); return; }
                respuesta = i18next.t("commands:embed.interacciones.custom_description", { a1: `<@${i.user.id}>`, a2: site, a3: customUrl })
                break;

            default:
                await i.editReply({ content: i18next.t("commands:embed.interacciones.invalid_action") }); return;
        }
        await setGuildReplacementConfig(i.guildId!, site, { custom_url: customUrl, enabled, user_id: userId });
        await i.editReply({ content: respuesta });
    } catch (err) {
        error(`handleEmbedCommand()\tFallo para Guild: ${i.guildId}\tUsuario: ${i.user.id}\tError: ${err}`);
        await i.editReply({ content: i18next.t("commands:embed.interacciones.failed"), });
    }
}