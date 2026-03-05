// src/Events-Commands/upCommands.ts
import { error, info } from "../sys/logging";
import { Client, ChatInputCommandInteraction, AutocompleteInteraction, ModalSubmitInteraction, MessageFlags, ButtonInteraction } from "discord.js";
import { helpRepo } from "./commandModales/reportHelp";
import { registerTestCommand, handleTestCommand } from "./commands/test";
import { registerHelpCommand, handleHelpCommand, helpAutocomplete } from "./commands/help";
import { registerWorkCommand, handleWorkCommand } from "./commands/work";
import { registerEmbedCommand, handleEmbedCommand, embedAutocomplete } from "./commands/embed";
import { registerWelcomeCommand, handleWelcomeCommand } from "./commands/welcome";
import { registerRolemojiCommand, handleRolemojiCommand } from "./commands/rolemoji"
import { registerOwnerCommands, handleOwnerCommands } from "../sys/zGears/owner";
import { registerYouTubeCommand, handleYouTubeCommand } from "./commands/youtube";
import { registerRedditCommand, handleRedditCommand } from "./commands/reddit";
import { registerPostCommand, handlePostCommand } from "./commands/post";
import { registerCleanUpCommand, handleCleanUpCommand } from "./commands/cleanup";
import { registerJoinToCreateCommand, handleJoinToCreateCommand } from "./commands/jointovoice";
import { registerMangadexCommand, handleMangadexCommand } from "./commands/mangadex";
import { registerPermissionsCommand, handlePermissionsCommand, permisosAutocomplete } from "./commands/permission";
import { registerMusicCommands, handleMusicInteraction } from "./commands/music";
import { registerRoleButtonCommand, handleRoleButtonCommand, roleButton } from "./commandButtons/roleButton";
import { registerButtonLinkCommand, handleButtonLinkCommand } from "./commandButtons/buttonLink";


/* ================================= Registro de comandos ================================= */

export async function sysUpRegister(client: Client) { 
  const commands = [
    ...(await registerHelpCommand()),
    ...(await registerTestCommand()),
    ...(await registerWorkCommand()),
    ...(await registerEmbedCommand()),
    ...(await registerWelcomeCommand()),
    ...(await registerRolemojiCommand()),
    ...(await registerOwnerCommands()),
    ...(await registerYouTubeCommand()),
    ...(await registerRedditCommand()),
    ...(await registerPostCommand()),
    ...(await registerCleanUpCommand()),
    ...(await registerJoinToCreateCommand()),
    ...(await registerMangadexCommand()),
    ...(await registerMusicCommands()),
    ...(await registerRoleButtonCommand()),
    ...(await registerButtonLinkCommand()),
  ];

  const permissionsCommand = await registerPermissionsCommand(commands as any);
  commands.push(...permissionsCommand);
  const comandList = commands.map((command) => command.name).join(", /");

  client.application?.commands.set(commands)
    .then(() => info(`Comandos /${comandList} registrados con éxito`, "Commands.Register"))
    .catch((err) => error(`Error al registrar comandos: ${err}`, "Commands.Register"));
}

/* ================================= Registro de interacciones ================================= */

export async function sysUpCommands(interaction: ChatInputCommandInteraction) {
  switch (interaction.commandName) {
    case 'play':  case 'stop':  case 'skip':  case 'queue':
      await handleMusicInteraction(interaction);  break;
    case 'help':
      await handleHelpCommand(interaction); break;
    case 'test':
      await handleTestCommand(interaction); break;
    case 'work':
      await handleWorkCommand(interaction); break;
    case 'embed':
      await handleEmbedCommand(interaction);  break;
    case 'welcome':
      await handleWelcomeCommand(interaction);  break;
    case 'rolemoji':
      await handleRolemojiCommand(interaction); break;
    case 'owner':
      await handleOwnerCommands(interaction); break;
    case 'youtube':
      await handleYouTubeCommand(interaction);  break;
    case 'reddit':
      await handleRedditCommand(interaction); break;
    case 'post':
      await handlePostCommand(interaction); break;
    case 'cleanup':
      await handleCleanUpCommand(interaction);  break;
    case 'jointovoice':
      await handleJoinToCreateCommand(interaction); break;
    case 'mangadex':
      await handleMangadexCommand(interaction); break;
    case 'permisos':
      await handlePermissionsCommand(interaction);  break;
    case 'buttonrole':
      await handleRoleButtonCommand(interaction); break;
    case 'buttonlink':
      await handleButtonLinkCommand(interaction); break;
    default:
      defSwitch(interaction); break;
  }
} /* Ya todo en un switch, no? */

async function defSwitch(interaction: ChatInputCommandInteraction) {
  error(`Algo anda mal en upCommands.ts, Comando: ${interaction.commandName}`)
  if ((interaction.isRepliable())) {
    await interaction.reply({ content: 'Como llegamos aqui? Error: B4784x122Read', flags: MessageFlags.Ephemeral });
  }
}

/* ================================= Autocompletado ================================= */

export async function sysUpAutoComplete(interaction: AutocompleteInteraction) {
  switch (interaction.commandName) {
    case "embed":
      await embedAutocomplete(interaction); break;
    case "permisos":
      await permisosAutocomplete(interaction); break;
    case "help":
      await helpAutocomplete(interaction); break;
  }
}

/* ================================= Formularios ================================= */

export async function sysUpModals(interaction: ModalSubmitInteraction) {
  switch (interaction.customId) {
    case 'helpRepo':
      await helpRepo(interaction); break;
  }
}

/* ================================= Botones ================================= */

export async function sysUpButtons(interaction: ButtonInteraction) {
  if (interaction.customId.startsWith("roleButton_")) {
    await roleButton(interaction);
    return;
  }
}
