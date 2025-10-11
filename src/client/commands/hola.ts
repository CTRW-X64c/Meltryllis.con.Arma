// src/client/modules/hola.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js";
import i18next from "i18next";
import { error, debug } from "../../logging";

export async function registerHolaCommand(): Promise<SlashCommandBuilder[]> {
  const holaCommand = new SlashCommandBuilder()
    .setName("hola")
    .setDescription(i18next.t("command_hola_description", { ns: "common" }) || "Muestra una descripción del bot.");

  return [holaCommand];
}

export async function handleHolaCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const embed = new EmbedBuilder()
      .setTitle("¡Hola")
      .setDescription("Estoy aquí para ayudarte con los Embeds en Discord, porque la verdad muchos apestan!")
      .addFields(
        {
        name: "Enlace de Invitación",
        value: "[Meltryllis con Arma!](https://discord.com/oauth2/authorize?client_id=847989699083632671&scope=bot&permissions=92160)",
        inline: true
        },
        {
        name: "Términos de Uso y Privacidad",
        value: "[Declaración](https://github.com/CTRW-X64c/Meltryllis.con.Arma/blob/main/Terminos%20de%20servicio%20de%20Meltryllis%20con%20Arma!.md)",
        inline: true
        },
        {
        name: "Algo anda mal?",
        value: "En canales @everyone no necesito más permisos que los que pido al ser invitada; en canales privados usa /test para ver qué permisos faltan y asignármelos. \n - Si no ves los comandos es porque requiren permisos de Administrador. \n - Discord solo procesa maximo 5 links por mensaje asi que se divide automativamente en batch de 5 link.",
        inline: false
        },
        {
        name: "Comando: /test  Canal Actual | Guild | Embed",
        value: "Canal Actual/Guld: Revisa permisos del bot.\n Embed: Muestra que sitios estan soportados", 
        inline: false
        },
        {
        name: "Comando:  **/replybots**",
        value: "- Habilita/Deshabilita el responder a bots por canales (Habilitado por default)",
        inline: false
        },
        {
        name: "Comando:  /work",
        value: "- Habilita/Deshabilita si se procesan link en el canal",
        inline: false
        },
        {
        name: "Comando:  /embed custom | disable| default",
        value: "- Custom: Cambia el url embed por uno personalizado.\n- Disable: Desactiva el embedding del sitio especifico \n- Default: Restaura el URL o Habilita el embedding del sitio especifico.",
        inline: false
        },
        {
        name: "Comando:  /welcome set",
        value: "- Permite asignar un canal para que se envie un banner con la bienvenida y un mnesaje personalizado. \n- Recuerda puedes usar <user> para mencionar a quiense une. Ej. Hola <user> Bienvenido al server. ",
        inline: false
        },
        {
        name: "Comando:  /rolemoji set | remove | list",
        value: "- Permite crear, eliminar y listar reacciones ligada a un mensaje para asignar un Rol",
        inline: false
        },
      )
      .setImage("https://i.imgur.com/hBy4KhT.jpeg")
      .setColor("#d20fae")
      .setFooter({
       text: "Las configuraciones se guardan por server.",
        })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    debug("Comando /hola ejecutado", "Commands.Hola");
  } catch (err) {
    error(`Error al ejecutar comando /hola: ${err}`, "Commands.Hola");
    await interaction.reply({
      content: i18next.t("command_error", { ns: "common" }) || "Ocurrió un error al ejecutar el comando.",
      flags: MessageFlags.Ephemeral,
    });
  }
}