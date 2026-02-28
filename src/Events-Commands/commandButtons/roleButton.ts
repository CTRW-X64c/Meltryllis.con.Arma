// src/Events-Commands/commandButtons/roleButton.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, MessageFlags, TextChannel, Message, GuildMember, ButtonInteraction, } from "discord.js";
import { hasPermission } from "../../sys/zGears/mPermission";
import i18next from "i18next";

/* ============================================================== Comando roleButton ============================================================== */
const colorsButton = [
    { name: "Verde", value: "Success" },
    { name: "Rojo", value: "Danger" },
    { name: "Azul", value: "Primary" },
    { name: "Gris", value: "Secondary" }
];

export async function registerRoleButtonCommand(): Promise<SlashCommandBuilder[]> {
    const buttonrole = new SlashCommandBuilder()
    .setName("rolebutton")
    .setDescription("Crea botones para asignar roles en un mensaje. mx 4 botones")
    /* 1er boton */
    .addRoleOption(option => 
        option.setName("first_rol")
        .setDescription("El rol que se dará al aceptar")
        .setRequired(true))
    .addStringOption(option =>
        option.setName("first_text_on_button")
        .setDescription("Texto en el boton")
        .setMaxLength(30)
        .setRequired(true))
    .addStringOption(option =>
        option.setName("first_color")
        .setDescription("Color del botón")
        .setRequired(true)
        .addChoices(colorsButton)
    ) /* 2do boton  */
    .addRoleOption(option =>
        option.setName("second_rol")
        .setDescription("Rol del 2do boton")
        .setRequired(false))
    .addStringOption(option =>
        option.setName("second_text_on_button")
        .setDescription("Texto del 2do boton")
        .setMaxLength(30)
        .setRequired(false))
    .addStringOption(option =>
        option.setName("second_color")
        .setDescription("Color del 2do botón")
        .setRequired(false)
        .addChoices(colorsButton)
    ) /* 3ro boton */
    .addRoleOption(option =>
        option.setName("third_rol")
        .setDescription("Rol del 3er boton")
        .setRequired(false))
    .addStringOption(option =>
        option.setName("third_text_on_button")
        .setDescription("Texto del 3er boton")
        .setMaxLength(30)
        .setRequired(false))
    .addStringOption(option =>
        option.setName("third_color")
        .setDescription("Color del 3er botón")
        .setRequired(false)
        .addChoices(colorsButton)
    ) /* 4to boton */
    .addRoleOption(option =>
        option.setName("fourth_rol")
        .setDescription("Rol del 4to boton")
        .setRequired(false))
    .addStringOption(option =>
        option.setName("fourth_text_on_button")
        .setDescription("Texto del 4to boton")
        .setMaxLength(30)
        .setRequired(false))
    .addStringOption(option =>
        option.setName("fourth_color")
        .setDescription("Color del 4to botón")
        .setRequired(false)
        .addChoices(colorsButton)
    ) /* 5to boton */
    .addStringOption(option =>
        option.setName("fifth_text_on_button")
        .setDescription("Texto del 5to boton")
        .setMaxLength(30)
        .setRequired(false))
    .addStringOption(option =>
        option.setName("fifth_color")
        .setDescription("Color del 5to botón")
        .setRequired(false)
        .addChoices(colorsButton)
    )

    return [buttonrole] as SlashCommandBuilder[];
}

export async function handleRoleButtonCommand(interaction: ChatInputCommandInteraction) {
    
    const isAllowed = await hasPermission(interaction, interaction.commandName);
    if (!isAllowed) {
        await interaction.editReply({
            content: i18next.t("command_permission_error", { ns: "rolemoji" }),
        });
        return;
    }

    if (!interaction.channel || !interaction.channel.isTextBased() || interaction.channel.isDMBased()) {
        await interaction.reply({ content: "❌ Este comando solo se puede usar en canales de texto.", flags: MessageFlags.Ephemeral });
        return;
    }

    /* 1er boton */
    const firstrol = interaction.options.getRole("first_rol", true);
    const firstcolor = interaction.options.getString("first_color", true) as keyof typeof ButtonStyle;
    const firstbuttonText = interaction.options.getString("first_text_on_button", true);
    /* 2do boton */
    const secondRol = interaction.options.getRole("second_rol");
    const secondColor = interaction.options.getString("second_color") as keyof typeof ButtonStyle;
    const secondButtonText = interaction.options.getString("second_text_on_button");
    /* 3er boton */
    const thirdRol = interaction.options.getRole("third_rol");
    const thirdColor = interaction.options.getString("third_color") as keyof typeof ButtonStyle;
    const thirdButtonText = interaction.options.getString("third_text_on_button");
    /* 4to boton */
    const fourthRol = interaction.options.getRole("fourth_rol");
    const fourthColor = interaction.options.getString("fourth_color") as keyof typeof ButtonStyle;
    const fourthButtonText = interaction.options.getString("fourth_text_on_button");
    /* 5to boton */
    const fifthRol = interaction.options.getRole("fifth_rol");
    const fifthColor = interaction.options.getString("fifth_color") as keyof typeof ButtonStyle;
    const fifthButtonText = interaction.options.getString("fifth_text_on_button");

    const channel = interaction.channel as TextChannel;
    await interaction.reply({ 
        content: "⏳ **¡Configuración iniciada!**\nPor favor, envía en este canal el mensaje que quieres que aparezca junto al botón. Puedes incluir saltos de línea, emojis e **imágenes adjuntas**.\n*Tienes 5 minutos para enviarlo.*", 
        flags: MessageFlags.Ephemeral 
    });

    const filter = (m: Message) => m.author.id === interaction.user.id;
    const collector = channel.createMessageCollector({ 
        filter, 
        time: 5 * 60 * 1000, 
        max: 1 
    });
            /* 1er boton */
    collector.on('collect', async (m: Message) => {
        const botonAceptar = new ButtonBuilder()
        .setCustomId(`roleButton_${firstrol.id}`)
        .setLabel(firstbuttonText)
        .setStyle(ButtonStyle[firstcolor]);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(botonAceptar);
            /* 2do boton */
        if (secondRol && secondButtonText && secondColor) {
            const secondbutton = new ButtonBuilder()
                .setCustomId(`roleButton_${secondRol.id}`)
                .setLabel(secondButtonText)
                .setStyle(ButtonStyle[secondColor]);
            row.addComponents(secondbutton);
        }   /* 3er boton */
        if (thirdRol && thirdButtonText && thirdColor) {
            const thirdbutton = new ButtonBuilder()
                .setCustomId(`roleButton_${thirdRol.id}`)
                .setLabel(thirdButtonText)
                .setStyle(ButtonStyle[thirdColor]);
            row.addComponents(thirdbutton);
        }   /* 4to boton */
        if (fourthRol && fourthButtonText && fourthColor) {
            const fourthbutton = new ButtonBuilder()
                .setCustomId(`roleButton_${fourthRol.id}`)
                .setLabel(fourthButtonText)
                .setStyle(ButtonStyle[fourthColor]);
            row.addComponents(fourthbutton);
        }   /* 5to boton */
        if (fifthRol && fifthButtonText && fifthColor) {
            const fifthbutton = new ButtonBuilder()
                .setCustomId(`roleButton_${fifthRol.id}`)
                .setLabel(fifthButtonText)
                .setStyle(ButtonStyle[fifthColor]);
            row.addComponents(fifthbutton);
        }
        
        const attachments = m.attachments.map(a => a.url);

        await channel.send({ content: m.content || " ", files: attachments, components: [row] });

        try {
            await m.delete();
            await interaction.followUp({ content: "✅ Panel creado exitosamente.", flags: MessageFlags.Ephemeral });
        } catch (error) {
            console.error("No pude borrar el mensaje del admin:", error);
        }
    });

    collector.on('end', (_, reason) => {
        if (reason === 'time') {
            interaction.followUp({ 
                content: "❌ Se acabó el tiempo de espera. Vuelve a ejecutar el comando `/rolebutton` si quieres intentarlo de nuevo.", 
                flags: MessageFlags.Ephemeral 
            }).catch(() => null);;
        }
    });
}

/* ============================================================== gearButton ============================================================== */

export async function roleButton(interaction: ButtonInteraction) {
    
    if (interaction.customId.startsWith('roleButton_')) {
        const roleId = interaction.customId.replace('roleButton_', '');
        try {
            const member = interaction.member as GuildMember;
            if (member.roles.cache.has(roleId)) {
                await interaction.reply({ content: `❌ Ya tienes <@&${roleId}>`, flags: MessageFlags.Ephemeral });
                return;
            }

            await member.roles.add(roleId);
            await interaction.reply({ content: `🎉Recibiste el rol: <@&${roleId}>.`, flags: MessageFlags.Ephemeral });

        } catch (error) {
            console.error(`Error al dar el rol desde el botón: ${error}`);
            await interaction.reply({ content: "⚠️ Hubo un error al darte el rol. Verifica que el bot tenga permisos suficientes (Mi rol debe estar por encima del rol que intento dar).", flags: MessageFlags.Ephemeral });
        }
    }
}