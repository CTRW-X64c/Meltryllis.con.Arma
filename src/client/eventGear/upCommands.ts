// src/client/coreCommands/upCommands.ts
import { Client, ChatInputCommandInteraction } from "discord.js";
import { error, info } from "../../sys/logging";
import { registerTestCommand, handleTestCommand } from "../commands/test";
import { registerHolaCommand, handleHolaCommand } from "../commands/hola";
import { registerWorkCommand, handleWorkCommand } from "../commands/work";
import { registerEmbedCommand, handleEmbedCommand } from "../commands/embed";
import { registerWelcomeCommand, handleWelcomeCommand } from "../commands/welcome";
/*import { registerReplybotsCommand, handleReplybotsCommand } from "../../../beta/replybots";*/
import { registerRolemojiCommand, handleRolemojiCommand } from "../commands/rolemoji"
import { registerOwnerCommands, handleOwnerCommands } from "../../sys/zGears/owner";
import { registerYouTubeCommand, handleYouTubeCommand } from "../commands/youtube";
import { registerRedditCommand, handleRedditCommand } from "../commands/reddit";
import { registerPostCommand, handlePostCommand } from "../commands/post";
import { registerCleanUpCommand, handleCleanUpCommand } from "../commands/cleanup";
import { registerJoinToCreateCommand, handleJoinToCreateCommand } from "../commands/jointovoice";
import { registerMangadexCommand, handleMangadexCommand } from "../commands/mangadex";
import { registerPermissionsCommand, handlePermissionsCommand } from "../commands/permission";
import { registerMusicCommands, handleMusicInteraction } from "../commands/music";


export async function registerCommands(client: Client) { 
  const commands = [
    ...(await registerHolaCommand()),
    ...(await registerTestCommand()),
    ...(await registerWorkCommand()),
    /*...(await registerReplybotsCommand()),*/
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
    .then(() => info("Comandos /hola, /test, /embed, /work, /welcome, /replybots, /rolemoji, /youtube, /reddit, /post, cleanup, /jointovoice, /mangadex, /permisos y /owner registrados con éxito", "Commands.Register"))
    .catch((err) => error(`Error al registrar comandos: ${err}`, "Commands.Register"));
}

export async function handleCommandInteraction(interaction: ChatInputCommandInteraction) {
  const { commandName } = interaction;
  switch (commandName) {
    case 'play':
    case 'stop':
    case 'skip':
    case 'queue':
      await handleMusicInteraction(interaction);
      break;
  }
  if (interaction.commandName === "hola") {
    await handleHolaCommand(interaction);
  } else if (interaction.commandName === "test") {
    await handleTestCommand(interaction);
  } else if (interaction.commandName === "work") {
    await handleWorkCommand(interaction); /*
  } else if (interaction.commandName === "replybots") {
    await handleReplybotsCommand(interaction); */
  } else if (interaction.commandName === "embed") {
    await handleEmbedCommand(interaction);
  } else if (interaction.commandName === "welcome") {
    await handleWelcomeCommand(interaction);
  } else if (interaction.commandName === "rolemoji") {
    await handleRolemojiCommand(interaction);
  } else if (interaction.commandName === "owner") {
    await handleOwnerCommands(interaction);
  } else if (interaction.commandName === "youtube") {
    await handleYouTubeCommand(interaction);
  } else if (interaction.commandName === "reddit") {
    await handleRedditCommand(interaction);
  } else if (interaction.commandName === "post") {
    await handlePostCommand(interaction);
  } else if (interaction.commandName === "cleanup") {
    await handleCleanUpCommand(interaction);
  }else if (interaction.commandName === "jointovoice") {
    await handleJoinToCreateCommand(interaction);
  }else if (interaction.commandName === "mangadex") {
    await handleMangadexCommand(interaction);
  }else if (interaction.commandName === "permisos") {
    await handlePermissionsCommand(interaction);
  }
}

/* =============== NOTAS =============== */
/*  Replybots y Work fusionados en work */
