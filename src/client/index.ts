// src/client/core.ts
import { Client, Events, GatewayIntentBits, Interaction } from "discord.js";
import { getEnvironmentMode } from "../sys/environment";
import { error, info, initLogger, loggerAvailable } from "../sys/logging";
import { initializeDatabase } from "../sys/DB-Engine/database";
import startEmbedService from "../sys/embedding/embedService";
import { startStatusRotation } from "../sys/zGears/setStatus";
import urlStatusManager from "../sys/embedding/domainChecker";
import { initI18n } from "../sys/i18n";
import { validateAllTranslations } from "../sys/i18n/nsKeyCheck";
import { registerCommands, handleCommandInteraction, autoComplete, modalesSystem } from "./eventGear/upCommands";
import { startWelcomeEvents } from "./eventGear/welcomeEvents";
import { registerRolemojiEvents, preloadRolemojiMessages } from "./eventGear/rolemojiEvents";
import { startYoutubeService } from "./eventGear/youtubeCheck";
import { startRedditChecker } from "./eventGear/redditCheck";
import { startMangadexChecker } from "./eventGear/mangadexChek";
import { startVoiceChannelService } from "./eventGear/voicEvent";
import lavalinkManager from "./eventGear/lavalinkConnect";

/*========= Inicializadores =========*/

async function main(): Promise<void> {
const locale = (process.env.LOCALE ?? "es");
const client = createClient();
    try {
        initLogger(getEnvironmentMode());
        await initI18n(locale);
        await initializeDatabase();     
        await validateAllTranslations();
        if (lavalinkManager) {lavalinkManager.init(client);}
        urlStatusManager.start();
        await client.login(process.env.DISCORD_BOT_TOKEN); /* Algunos ocupan ir antes del login, como lavalink */
        await startWelcomeEvents(client);     
        registerCommands(client);
        registerRolemojiEvents(client);
        startYoutubeService(client); // by nep  
        startRedditChecker(client);  // by nowa
        startVoiceChannelService(client);
        startStatusRotation(client);
        startEmbedService(client);
        startMangadexChecker(client);
        logInfo(`✅ Inicializacion completada!! | 🌐 Idioma de los comandos: ${locale}`);
    } catch (error) {
        logFatalError(error);
        process.exit(1);
    }
}

/*========= Interfaz de Comandos =========*/

function createClient(): Client {
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildVoiceStates,
        ],
    });

    client.once(Events.ClientReady, async (eventClient) => {
        info(`🔌 Conectada como: ${eventClient.user.tag}`, "Events.ClientReady");
        const guildCount = eventClient.guilds.cache.size;
        info(`Actualmente en ${guildCount} ${guildCount === 1 ? "server!" : "servidores!"}`, "Events.ClientReady");
        preloadRolemojiMessages(client);
    });
    
    client.on(Events.InteractionCreate, async (interaction: Interaction) => {
        if (interaction.isChatInputCommand()) {
            await handleCommandInteraction(interaction);
            return;
        }
        if (interaction.isAutocomplete()) {
            await autoComplete(interaction);
            return;
        }
        if (interaction.isModalSubmit()) {
            await modalesSystem(interaction);
            return;
        }
    });
    return client;
}

/*========= Manejador de Errores y Logs =========*/

function logInfo(message: string): void {
    if (loggerAvailable()) {
        info(message, "Main");
    } else {
        console.log(`[INFO] ${message}`);
    }
}

function logFatalError(error: unknown): void {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    const message = `Error fatal: ${errorObj.name}: ${errorObj.message}`;
    
    if (loggerAvailable()) {
        if (typeof error === 'function') {
            error(message, "Main");
        } else {
            console.error(message);
        }
    } else {
        console.error(message);
        if (errorObj.stack) {
            console.error(errorObj.stack);
        }
    }
    if (getEnvironmentMode() === "development") {
        setTimeout(() => process.exit(1), 100);
    } else {
        process.exit(1);
    }
}

main().catch((e: Error) => {
    const errorObj = e as Error;
    if (loggerAvailable()) {
        error(`Excepción en el proceso principal: ${errorObj.name}: ${errorObj.message}`, "Main");
    } else {
        console.error(`Unhandled exception: ${errorObj.name}: ${errorObj.message}`);
    }
    process.exit(1);
});
