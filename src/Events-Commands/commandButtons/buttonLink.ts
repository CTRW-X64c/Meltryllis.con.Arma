// src/Event-Commands/buttonLink.ts
import { SlashCommandBuilder, ChatInputCommandInteraction, ButtonBuilder, ActionRowBuilder, ButtonStyle, MessageFlags, EmbedBuilder } from "discord.js";
import i18next from "i18next";
import { hasPermission } from "../../sys/zGears/mPermission";

export async function registerButtonLinkCommand(): Promise<SlashCommandBuilder[]> {
    const buttonlink = new SlashCommandBuilder()
        .setName("buttonlink")
        .setDescription("Genera un botón que abre un enlace")
        /* 1er boton */
        .addStringOption((op) =>
            op.setName("link")
            .setDescription("URL completa (ej: https://discord.com)")
            .setRequired(true)
        )
        .addStringOption((op) =>
            op.setName("texto_del_boton")
            .setDescription("Texto que aparecerá en el botón")
            .setRequired(true)
            .setMaxLength(80)
        )  /* 2do boton  */
        .addStringOption((op) =>
            op.setName("2do_link")
            .setDescription("Segunda URL")
            .setRequired(false)
        )
        .addStringOption((op) =>
            op.setName("texto_2do_boton")
            .setDescription("Texto del 2do boton")
            .setRequired(false)
            .setMaxLength(80)
        )   /* 3er boton */
        .addStringOption((op) =>
            op.setName("3er_link")
            .setRequired(false)
            .setDescription("Tercera URL")
        )   
        .addStringOption((op) =>
            op.setName("texto_3er_boton")
            .setDescription("Texto del 3er boton")
            .setRequired(false)
            .setMaxLength(80)
        )  /* 4to boton */
        .addStringOption((op) =>
            op.setName("4to_link")
            .setDescription("Cuarta URL")
            .setRequired(false)
        )
        .addStringOption((op) =>
            op.setName("texto_4to_boton")
            .setDescription("Texto del 4to boton")
            .setRequired(false)
            .setMaxLength(80)
        )  /* 5to boton */
        .addStringOption((op) =>
            op.setName("5to_link")
            .setDescription("Quinta URL")
            .setRequired(false)
        )
        .addStringOption((op) =>
            op.setName("texto_5to_boton")
            .setDescription("Texto del 5to boton")
            .setRequired(false)
            .setMaxLength(80)
        )

    return [buttonlink] as SlashCommandBuilder[];
}

export async function handleButtonLinkCommand(interaction: ChatInputCommandInteraction) {
    const channel = interaction.channel;
    const isAllowed = await hasPermission(interaction, interaction.commandName);
    
    if (!isAllowed) {
        await interaction.reply({
        content: i18next.t("common:Errores.noChannel"),
        flags: MessageFlags.Ephemeral, 
        });
        return;
    }
    
    if (!channel || !channel.isTextBased() || channel.isDMBased()) {
        await interaction.reply({
            content: i18next.t("common:Errores.noChannel"),
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    
    const url = interaction.options.getString("link", true);
    const buttonText = interaction.options.getString("texto_del_boton", true);
    const secondUrl = interaction.options.getString("2do_link");
    const secondButtonText = interaction.options.getString("texto_2do_boton");
    const thirdUrl = interaction.options.getString("3er_link");
    const thirdButtonText = interaction.options.getString("texto_3er_boton");
    const fourthUrl = interaction.options.getString("4to_link");
    const fourthButtonText = interaction.options.getString("texto_4to_boton");
    const fifthUrl = interaction.options.getString("5to_link");
    const fifthButtonText = interaction.options.getString("texto_5to_boton"); 
    try {
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            await interaction.reply({
                content: i18next.t("bottonsCom:buttonLink.errorFortmat"),
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const row = new ActionRowBuilder<ButtonBuilder>();

        row.addComponents(
            new ButtonBuilder()
                .setLabel(buttonText)
                .setStyle(ButtonStyle.Link)
                .setURL(url)
        );

        if (secondUrl && secondButtonText && (secondUrl.startsWith("http://") || secondUrl.startsWith("https://"))) {
            row.addComponents(
                new ButtonBuilder().setLabel(secondButtonText).setStyle(ButtonStyle.Link).setURL(secondUrl)
            );
        }

        if (thirdUrl && thirdButtonText && (thirdUrl.startsWith("http://") || thirdUrl.startsWith("https://"))) {
            row.addComponents(
                new ButtonBuilder().setLabel(thirdButtonText).setStyle(ButtonStyle.Link).setURL(thirdUrl)
            );
        }

        if (fourthUrl && fourthButtonText && (fourthUrl.startsWith("http://") || fourthUrl.startsWith("https://"))) {
            row.addComponents(
                new ButtonBuilder().setLabel(fourthButtonText).setStyle(ButtonStyle.Link).setURL(fourthUrl)
            );
        }

        if (fifthUrl && fifthButtonText && (fifthUrl.startsWith("http://") || fifthUrl.startsWith("https://"))) {
            row.addComponents(
                new ButtonBuilder().setLabel(fifthButtonText).setStyle(ButtonStyle.Link).setURL(fifthUrl)
            );
        };

        await channel.send({ content: "\u200B", components: [row]});

        const buttonUp = (text: string | null, url: string | null) => {    
            if (!text && !url) return i18next.t("bottonsCom:buttonLink.no_use");
            if (!text) return i18next.t("bottonsCom:buttonLink.no_text");
            if (!url) return i18next.t("bottonsCom:buttonLink.no_url");
                const urlOk = url.startsWith("http://") || url.startsWith("https://");
            if (!urlOk)
                return i18next.t("bottonsCom:buttonLink.no_url_valid");
            return i18next.t("bottonsCom:buttonLink.use");
        };

        const results = [ buttonUp(secondButtonText, secondUrl), buttonUp(thirdButtonText, thirdUrl), buttonUp(fourthButtonText, fourthUrl), buttonUp(fifthButtonText, fifthUrl) ];
        const cantidad = results.filter(res => res === i18next.t("bottonsCom:buttonLink.use")).length + 1;
        const footerText = cantidad === 1 ? i18next.t("bottonsCom:buttonLink.foote_01") : i18next.t("bottonsCom:buttonLink.foote_02", {a1: cantidad});
        
        const embed = new EmbedBuilder()
            .setTitle(i18next.t("bottonsCom:buttonLink.greatLiank")) 
            .setDescription(i18next.t("bottonsCom:buttonLink.post_report"))
            .setFields(
                { name: i18next.t("bottonsCom:buttonLink.b2"), value: buttonUp(secondButtonText, secondUrl), inline: true },
                { name: i18next.t("bottonsCom:buttonLink.b3"), value: buttonUp(thirdButtonText, thirdUrl), inline: true },
                { name: i18next.t("bottonsCom:buttonLink.b4"), value: buttonUp(fourthButtonText, fourthUrl), inline: true },
                { name: i18next.t("bottonsCom:buttonLink.b5"), value: buttonUp(fifthButtonText, fifthUrl), inline: true }
            )
            .setColor(0x00FF00)
            .setFooter({text: footerText});

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

    } catch (error) {
        console.error("Error al crear botón de link:", error);
        await interaction.reply({ content: i18next.t("bottonsCom:errores.errorButton"), flags: MessageFlags.Ephemeral });
    }
}