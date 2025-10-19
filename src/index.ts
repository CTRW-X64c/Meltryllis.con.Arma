import dotenv from "dotenv";
import { info, initLogger, error } from "./logging";
import { getEnvironmentMode } from "./environment";
import { ShardingManager, Client } from "discord.js";

dotenv.config();

const environmentMode = getEnvironmentMode();
initLogger(environmentMode);

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  error("❌ Falta \"DISCORD_BOT_TOKEN\" checa tu .env o docker-compose", "startup");
  process.exit(1);
}

info("🔐 Validando token...", "startup");

const testClient = new Client({ intents: [] });

testClient.login(token)
  .then(() => {
    testClient.destroy();
    info("✅ Token válido", "startup");
        info(`🚀 Iniciando bot en modo: ${environmentMode}`, "startup");
    
    const manager = new ShardingManager("./comp/client/index.js", {
      token: token,
    });

    manager.on("shardCreate", (shard) => {
      info(`Shard ${shard.id} lanzado`, "sharding");
    });

    void manager.spawn();
  })
  .catch((err) => {
    error(`❌ Token inválido: "${err.message}"`, "startup");
    error(`Revisa en https://discord.com/developers/applications/ > App > Bot > Token `, "startup");

    process.exit(1);
  });