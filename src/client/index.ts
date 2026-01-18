// src/client/core.ts
import { Client, Events, GatewayIntentBits, Interaction } from "discord.js";
import { getEnvironmentMode } from "../sys/environment";
import { error, info, initLogger, loggerAvailable } from "../sys/logging";
import { initializeDatabase } from "../sys/DB-Engine/database";
import { startEmbedService } from "../sys/embedding/embedService";
import { startStatusRotation } from "../sys/setStatus";
import i18next from "i18next";
import { initI18n } from "../sys/i18n";
import { validateAllTranslations } from "../sys/i18n/langCmndVal";
import { registerCommands, handleCommandInteraction } from "./eventGear/upCommands";
import { startWelcomeEvents } from "./eventGear/welcomeEvents";
import { registerRolemojiEvents } from "./eventGear/rolemojiEvents";
import { startYoutubeService } from "./eventGear/youtubeCheck";
import { startRedditChecker } from "./eventGear/redditCheck";
import { autoCleanupService } from "./eventGear/youtubeTools";
import { startVoiceChannelService } from "./eventGear/voicEvent";
import { preloadRolemojiMessages } from "./eventGear/rolemojiEvents";
import { handleEmbedAutocomplete } from "./commands/embed";

/*========= Inicializadores =========*/

async function main(): Promise<void> {
const locale = (process.env.LOCALE ?? "es");
const client = createClient();
    try {
        if (!process.env.DISCORD_BOT_TOKEN) {
            throw new Error("DISCORD_BOT_TOKEN no está definido")};
        initLogger(getEnvironmentMode());
        await initI18n(locale);
        await initializeDatabase();     
        await validateAllTranslations();
        await client.login(process.env.DISCORD_BOT_TOKEN);   
        await startWelcomeEvents(client);     
        registerCommands(client);
        registerRolemojiEvents(client);
        startYoutubeService(client); // by nep  
        startRedditChecker(client);  // by nowa
        startVoiceChannelService(client);
        startStatusRotation(client);
        startEmbedService(client);
        autoCleanupService.start();
        logInfo(`✅ Inicializacion completada!!`);
        logInfo(`Idioma por default de los comandos: ${locale}`);
        
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
        info(i18next.t("login_success", {ns: "core", userTag: eventClient.user.tag }), "Events.ClientReady");
        const guildCount = eventClient.guilds.cache.size;
        info(i18next.t("guilds_count", {ns: "core", guildCount: guildCount, pluralGuilds: guildCount === 1 ? "guild" : "guilds"}), "Events.ClientReady");
        const guildNames = eventClient.guilds.cache.map(guild => guild.name).join(", ");
        info(i18next.t("servers_list", {ns: "core", guildNames:guildNames}));
        const replyToOtherBots = process.env.REPLY_OTHER_BOTS === "true";
        info(i18next.t("reply_to_bots_config", {ns: "core", config:replyToOtherBots}), "Events.MessageCreate");
        preloadRolemojiMessages(client);        
    });
    
    client.on(Events.InteractionCreate, async (interaction: Interaction) => {
        if (interaction.isChatInputCommand()) {
            await handleCommandInteraction(interaction);
        }
        if (interaction.isAutocomplete()) {
            const commandName = interaction.commandName;
            if (commandName === "embedmanager") {
                await handleEmbedAutocomplete(interaction);
            }
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
        error(i18next.t("main_exception", {ns: "core", errorName: errorObj.name, errorMessage: errorObj.message }), "Main");
    } else {
        console.error(`Unhandled exception: ${errorObj.name}: ${errorObj.message}`);
    }
    process.exit(1);
});
