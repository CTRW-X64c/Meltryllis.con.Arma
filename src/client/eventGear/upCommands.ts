// src/client/coreCommands/upCommands.ts
import { error, info } from "../../sys/logging";
import { Client, ChatInputCommandInteraction, AutocompleteInteraction, ModalSubmitInteraction, MessageFlags } from "discord.js";
import { helpRepo } from "../../sys/zGears/formularios";
import { registerTestCommand, handleTestCommand } from "../commands/test";
import { registerHolaCommand, handleHolaCommand, helpAutocomplete } from "../commands/hola";
import { registerWorkCommand, handleWorkCommand } from "../commands/work";
import { registerEmbedCommand, handleEmbedCommand, embedAutocomplete } from "../commands/embed";
import { registerWelcomeCommand, handleWelcomeCommand } from "../commands/welcome";
import { registerRolemojiCommand, handleRolemojiCommand } from "../commands/rolemoji"
import { registerOwnerCommands, handleOwnerCommands } from "../../sys/zGears/owner";
import { registerYouTubeCommand, handleYouTubeCommand } from "../commands/youtube";
import { registerRedditCommand, handleRedditCommand } from "../commands/reddit";
import { registerPostCommand, handlePostCommand } from "../commands/post";
import { registerCleanUpCommand, handleCleanUpCommand } from "../commands/cleanup";
import { registerJoinToCreateCommand, handleJoinToCreateCommand } from "../commands/jointovoice";
import { registerMangadexCommand, handleMangadexCommand } from "../commands/mangadex";
import { registerPermissionsCommand, handlePermissionsCommand, permisosAutocomplete } from "../commands/permission";
import { registerMusicCommands, handleMusicInteraction } from "../commands/music";

/* ================================= Registro de comandos ================================= */

export async function registerCommands(client: Client) { 
  const commands = [
    ...(await registerHolaCommand()),
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
  ];

  const permissionsCommand = await registerPermissionsCommand(commands as any);
  commands.push(...permissionsCommand);

  client.application?.commands.set(commands)
    .then(() => info("Comandos /help, /test, /embed, /work, /welcome, /replybots, /rolemoji, /youtube, /reddit, /post, cleanup, /jointovoice, /mangadex, /permisos y /owner registrados con éxito", "Commands.Register"))
    .catch((err) => error(`Error al registrar comandos: ${err}`, "Commands.Register"));
}

/* ================================= Registro de interacciones ================================= */

export async function handleCommandInteraction(interaction: ChatInputCommandInteraction) {
  switch (interaction.commandName) {
    case 'play':  case 'stop':  case 'skip':  case 'queue':
      await handleMusicInteraction(interaction);  break;
    case 'help':
      await handleHolaCommand(interaction); break;
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

export async function autoComplete(interaction: AutocompleteInteraction) {
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

export async function modalesSystem(interaction: ModalSubmitInteraction) {
  switch (interaction.customId) {
    case 'helpRepo':
      await helpRepo(interaction); break;
  }
}