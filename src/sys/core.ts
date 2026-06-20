// src/sys/core.ts
import { Client, Events, GatewayIntentBits, Interaction } from "discord.js";
import { sysUpRegister, sysUpCommands, sysUpAutoComplete, sysUpModals, sysUpButtons } from "../commands/upCommands";
import { getEnvironmentMode } from "./environment";
import { error, info, initLogger, loggerAvailable } from "./logging";
import { initializeDatabase, isBdReady } from "./DB-Engine/database";
import startEmbedService from "./embedding/embedService";
import { startStatusRotation } from "./zGears/setStatus";
import { startUrlStatusManager, startListDomains } from "./embedding/domainChecker";
import { initI18n } from "./i18n";
import { validateAllTranslations } from "./i18n/nsKeyCheck";
import { startWelcomeEvents } from "../bgProcess/welcomeEvents";
import { registerRolemojiEvents, preloadRolemojiMessages } from "../bgProcess/rolemojiEvents";
import { startVoiceChannelService } from "../bgProcess/voicEvent";
import { startCronpost } from "../bgProcess/exeCron";
import lavalinkManager, { loadNodes } from "../bgProcess/lavalinkConnect";
import registerIOevent from "./zGears/IO-Server";
import { initNoEveryone } from "../bgProcess/noEvery";
import { startServices } from "./zGears/_managerServices";


/*========= Inicializadores =========*/

async function main(): Promise<void> {
    const locale = (process.env.LOCALE ?? "es");
    const client = createClient();
    try {
        initLogger(getEnvironmentMode());
        await initI18n(locale);
        await initializeDatabase();
        const BDready = await isBdReady();
        await validateAllTranslations();
        if (lavalinkManager) { lavalinkManager.init(client); }
        await client.login(process.env.DISCORD_BOT_TOKEN); /* Algunos ocupan ir antes del login, como lavalink */
        sysUpRegister(client);
        await registerIOevent(client);
        registerRolemojiEvents(client);
        if (BDready) {
            info("💽​ Base de datos lista, iniciando servicios...")
            const sld = await startListDomains()
            if (sld) {
                startUrlStatusManager();
                startEmbedService(client);
                info("Servicio de embed inicializado")
            } else { error("❌ ERROR AL INICIAR EL SISTEMA DE EMBEDDING!!") }
            loadNodes()
            startVoiceChannelService(client);
            startServices(client)
            await startWelcomeEvents(client);
            startCronpost(client);
            startStatusRotation(client);
            initNoEveryone(client);
        } else {
            error("❌ La BD no arranco, bye bye~");
            process.exit(1);
        }
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
            await sysUpCommands(interaction);
            return;
        }
        if (interaction.isAutocomplete()) {
            await sysUpAutoComplete(interaction);
            return;
        }
        if (interaction.isModalSubmit()) {
            await sysUpModals(interaction);
            return;
        }
        if (interaction.isButton()) {
            await sysUpButtons(interaction);
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
