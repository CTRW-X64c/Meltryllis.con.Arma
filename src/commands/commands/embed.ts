// src/Events-Commands/commands/embed.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, MessageFlags, AutocompleteInteraction } from "discord.js";
import i18next from "i18next";
import { setGuildReplacementConfig } from "../../sys/DB-Engine/links/Embed";
import { hasPermission } from "../../sys/zGears/mPermission";
import { masterList, isApiList } from "../../sys/embedding/domainChecker";
import { error } from "../../sys/logging";

// --- Cambio para autocompletar 
export async function embedAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const X = interaction.options.getFocused().toLowerCase();
    const list = masterList.filter(y => y.name.toLowerCase().includes(X));
    await interaction.respond(list.slice(0, 25).map(c => ({ name: c.name, value: c.value })));
}

export async function registerEmbedCommand(): Promise<SlashCommandBuilder[]> {
    const embedCommand = new SlashCommandBuilder()
        .setName("embed")
        .setDescription(i18next.t("commands:embed.slashBuilder.embed_description"))
        .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands)
        .addSubcommand((s) =>
            s.setName("configurar").setDescription(i18next.t("commands:embed.slashBuilder.embed_config"))
                .addStringOption((o) => o.setName("sitio").setDescription(i18next.t("commands:embed.slashBuilder.site_description")).setRequired(true).setAutocomplete(true))
                .addStringOption((o) => o.setName("modo").setDescription(i18next.t("commands:embed.slashBuilder.action_description")).setRequired(true)
                    .addChoices(
                        { name: i18next.t("commands:embed.slashBuilder.enable"), value: "enable" },
                        { name: i18next.t("commands:embed.slashBuilder.disable"), value: "disable" },
                        { name: i18next.t("commands:embed.slashBuilder.custom"), value: "custom" },
                        { name: i18next.t("commands:embed.slashBuilder.default"), value: "default" }
                    )
                )
                .addStringOption((o) => o.setName("personalizar").setDescription(i18next.t("commands:embed.slashBuilder.custom_url")).setRequired(false))
        );
    return [embedCommand] as SlashCommandBuilder[];
}

const isRunning = new Map<string, boolean>()
export async function handleEmbedCommand(i: ChatInputCommandInteraction): Promise<void> {
    await i.deferReply({ flags: MessageFlags.Ephemeral })
    const guildId = i.guild?.id;
    if (!guildId) { await i.editReply({ content: "Este comando solo se puede usar en un servidor." }); return; }

    const isAllowed = await hasPermission(i, i.commandName);
    if (!isAllowed) { await i.editReply({ content: i18next.t("common:Errores.isAllowed") }); return; }

    try {
        if (isRunning.get(guildId)) { await i.editReply({ content: i18next.t("common:Errores.isRunning", { a1: i.commandName }) }); return; };
        isRunning.set(guildId, true)

        const site = i.options.getString("sitio", true);
        const modo = i.options.getString("modo", true);
        const url = i.options.getString("personalizar", false);
        const isApi = isApiList.includes(site);

        let customUrl: string | null = null;
        let enabled = true;
        let userId: string | null = null;
        let respuesta = "";


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
        if (i.replied || i.deferred) { await i.editReply(i18next.t("common:Errores.switch_catch_err", { a1: i.commandName })); }
        else { await i.reply({ content: i18next.t("common:Errores.switch_catch_err", { a1: i.commandName }), flags: MessageFlags.Ephemeral }); }
    } finally { isRunning.delete(guildId) }
}