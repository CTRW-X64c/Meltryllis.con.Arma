// src/client/upCommands.ts
import { Client, ChatInputCommandInteraction } from "discord.js";
import { error, info } from "../logging";
import { initializeDatabase } from "./database";
import { registerTestCommand, handleTestCommand } from "./commands/test";
import { registerHolaCommand, handleHolaCommand } from "./commands/hola";
import { registerWorkCommand, handleWorkCommand } from "./commands/work";
import { registerEmbedCommand, handleEmbedCommand } from "./commands/embed";
import { registerWelcomeCommand, handleWelcomeCommand } from "./commands/welcome";
import { registerReplybotsCommand, handleReplybotsCommand } from "./commands/replybots";
import { registerRolemojiCommand, handleRolemojiCommand } from "./commands/rolemoji"

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
  ];

  client.application?.commands.set(commands)
    .then(() => info("Comandos /hola, /test, /embeds, /work, /welcome, /replybots y /rolemoji registrados con éxito", "Commands.Register"))
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
  }   
}