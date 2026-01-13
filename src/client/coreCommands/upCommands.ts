// src/client/coreCommands/upCommands.ts
import { Client, ChatInputCommandInteraction } from "discord.js";
import { error, info } from "../../sys/logging";
import { initializeDatabase } from "../../sys/database";
import { registerTestCommand, handleTestCommand } from "../commands/test";
import { registerHolaCommand, handleHolaCommand } from "../commands/hola";
import { registerWorkCommand, handleWorkCommand } from "../commands/work";
import { registerEmbedCommand, handleEmbedCommand } from "../commands/embed";
import { registerWelcomeCommand, handleWelcomeCommand } from "../commands/welcome";
import { registerReplybotsCommand, handleReplybotsCommand } from "../commands/replybots";
import { registerRolemojiCommand, handleRolemojiCommand } from "../commands/rolemoji"
import { registerOwnerCommands, handleOwnerCommands } from "../commands/owner";
import { registerYouTubeCommand, handleYouTubeCommand } from "../commands/youtube";
import { registerRedditCommand, handleRedditCommand } from "../commands/reddit";
import { registerPostCommand, handlePostCommand } from "../commands/post";
import { registerCleanUpCommand, handleCleanUpCommand } from "../commands/cleanup";
import { registerJoinToCreateCommand, handleJoinToCreateCommand } from "../commands/jointovoice";

export interface ChannelConfig {
  enabled: boolean;
  replyBots: boolean;
}

export async function registerCommands(client: Client) {
  await initializeDatabase(); 

  const commands = [
    ...(await registerHolaCommand()),
    ...(await registerTestCommand()),
    ...(await registerWorkCommand()),
    ...(await registerReplybotsCommand()),
    ...(await registerEmbedCommand()),
    ...(await registerWelcomeCommand()),
    ...(await registerRolemojiCommand()),
    ...(await registerOwnerCommands()),
    ...(await registerYouTubeCommand()),
    ...(await registerRedditCommand()),
    ...(await registerPostCommand()),
    ...(await registerCleanUpCommand()),
    ...(await registerJoinToCreateCommand()),
  ];

  client.application?.commands.set(commands)
    .then(() => info("Comandos /hola, /test, /embeds, /work, /welcome, /replybots, /rolemoji, /youtube, /reddit, /post, cleanup, /jointovoice y /owner registrados con éxito", "Commands.Register"))
    .catch((err) => error(`Error al registrar comandos: ${err}`, "Commands.Register"));
}

export async function handleCommandInteraction(interaction: ChatInputCommandInteraction) {
  if (interaction.commandName === "hola") {
    await handleHolaCommand(interaction);
  } else if (interaction.commandName === "test") {
    await handleTestCommand(interaction);
  } else if (interaction.commandName === "work") {
    await handleWorkCommand(interaction);
  } else if (interaction.commandName === "replybots") {
    await handleReplybotsCommand(interaction);
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
  }
}