// src/index.ts 
import dotenv from "dotenv";
import { info, initLogger, error } from "./sys/logging";
import { getEnvironmentMode } from "./sys/environment";
import { ShardingManager, Client } from "discord.js";

dotenv.config();

async function start() {
    const environmentMode = getEnvironmentMode();
    initLogger(environmentMode);

    const token = process.env.DISCORD_BOT_TOKEN;
    const ownerId = process.env.HOST_DISCORD_USER_ID;
    
    if (!token) {
        error("❌ Falta Token en \"DISCORD_BOT_TOKEN=\", checa tu archivo .env o docker-compose > environment:", "startup");
        process.exit(1);
    } else if (!ownerId)  {
        error("❌ Falta ID de dueño en \"HOST_DISCORD_USER_ID=\", checa tu archivo .env o docker-compose > environment:", "startup");
        process.exit(1);
    }

    try {
        info("🔐 Validando token e Id de usuario...", "startup");
        const testClient = new Client({ intents: [] });
        await testClient.login(token);
        const owner = await testClient.users.fetch(ownerId);
        await testClient.destroy();
        info(`✅ Token e Id válidos | 🆔 OwnerName: ${owner.username}`, "startup") 

    } catch (err: unknown) {
        const errMessage = err instanceof Error ? err.message : String(err);
        if (errMessage.includes("An invalid token was provided")) {
            error("❌ EL TOKEN PROPORCIONADO ES INVÁLIDO!!", "startup");
            error("📋 \"Revisa https://discord.com/developers/applications/ > App > Bot: Token\" Revisa o Genera un nuevo Token", "startup");
        } else if (errMessage.includes("Privileged Gateway Intents")) {
            error("❌ LOS 'PRIVILEGED GATEWAY INTENTS' NO ESTÁN HABILITADOS!!", "startup");
            error("📋 \"Revisa https://discord.com/developers/applications/ > App > Bot: Presence Intent\" Habilita los 'Privileged Gateway Intents'.", "startup");
        } else if (errMessage.includes("Unknown User") || errMessage.includes("NUMBER_TYPE_MAX")) {
            error("El ID user es incorrecto!!")
        } else {
            error(`❌ HUBO UN PROBLEMA CON EL TOKEN & ID DE USUARIO!! ERROR CODE: ${errMessage}`, "startup");
        }
        process.exit(1);
    }

    info(`🚀 Iniciando bot en modo: ${environmentMode}`, "startup");   
    const manager = new ShardingManager("./comp/sys/core.js", {
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