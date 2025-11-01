// src/index.ts 
import dotenv from "dotenv";
import { info, initLogger, error } from "./logging";
import { getEnvironmentMode } from "./environment";
import { ShardingManager, Client } from "discord.js";

dotenv.config();

async function start() {
    const environmentMode = getEnvironmentMode();
    initLogger(environmentMode);

    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
        error("❌ Falta Token en \"DISCORD_BOT_TOKEN=\", checa tu archivo .env o docker-compose > environment:", "startup");
        process.exit(1);
    }

    try {
        info("🔐 Validando token...", "startup");
        const testClient = new Client({ intents: [] });
        await testClient.login(token);
        await testClient.destroy();
        info("✅ Token válido.", "startup");

    } catch (err: unknown) {
        const errMessage = err instanceof Error ? err.message : String(err);
        if (errMessage.includes("An invalid token was provided")) {
            error("❌ EL TOKEN PROPORCIONADO ES INVÁLIDO!!", "startup");
            error("📋 \"Revisa https://discord.com/developers/applications/ > App > Bot: Token\" Revisa o Genera un nuevo Token", "startup");
        } else if (errMessage.includes("Privileged Gateway Intents")) {
            error("❌ LOS 'PRIVILEGED GATEWAY INTENTS' NO ESTÁN HABILITADOS!!", "startup");
            error("📋 \"Revisa https://discord.com/developers/applications/ > App > Bot: Presence Intent\" Habilita los 'Privileged Gateway Intents'.", "startup");
        } else {
            error(`❌ HUBO UN PROBLEMA CON EL TOKEN!! ERROR CODE: ${errMessage}`, "startup");
        }
        process.exit(1);
    }

    info(`🚀 Iniciando bot en modo: ${environmentMode}`, "startup");   
    const manager = new ShardingManager("./comp/client/index.js", {
        token: token,
    });

    manager.on("shardCreate", (shard) => {
        info(`Shard ${shard.id} lanzado`, "sharding");
    });

    try {
        await manager.spawn();
    } catch (spawnError) {
        error("💥 Error al intentar iniciar los shards.", "startup");
        process.exit(1);
    }
}
start();