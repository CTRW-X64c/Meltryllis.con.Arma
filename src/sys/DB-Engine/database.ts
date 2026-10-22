// src/sys/DB-Engine/database.ts
import { createPool, Pool } from "mysql2/promise";
import { error, debug, info } from "../logging";
import { getEnvironmentMode } from "../environment";
import { mngrTables } from "./dbTables";

let pool: Pool | null = null;
let initializationPromise: Promise<void> | null = null;

// Inicializador BD
export async function initializeDatabase(): Promise<void> {
  if (pool) return;
  if (initializationPromise) return initializationPromise;

  const maxRetries = 3;
  const retryDelay = 5000;

  initializationPromise = (async () => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        info(`Intentando conectar a la base de datos (Intento ${attempt}/${maxRetries})...`, "Database");

        const InitPools = createPool({
          host: process.env.DB_HOST,
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_DATABASE,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
        });

        const connection = await InitPools.getConnection();
        await connection.ping();
        connection.release();
        pool = InitPools;
        info(`✅ Conectado a la base de datos: ${process.env.DB_DATABASE}`, "Database");

        await poolManager();

        return;
      } catch (err) {
        if (attempt < maxRetries) {
          info(`🔄 Reintentando conexión...`, "Database");
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          error(`⚡🔌 No se pudo conectar a la base de datos!!`, "Database");
          error(`📋 Revisa que tu APP/Docker BD se está ejecutando y tu configuración de conexión es correcta`, "Database");
          process.exit(1);
        }
      }
    }
  })();

  return initializationPromise;
}

// Generador de Tablas
async function poolManager(): Promise<void> {
  if (!pool) throw new Error("Pool no inicializado");
  info("🔧 Verificando/Creando todas las tablas necesarias...", "Database");

  await mngrTables(pool);

  const [tables] = await pool.query(`SHOW TABLES`);
  const tableCount = Array.isArray(tables) ? tables.length : 0;
  info(`✅ ${tableCount} tablas verificadas / creadas exitosamente`, "Database");
  if (getEnvironmentMode() === "development") {
    debug(`📊 Tablas disponibles: ${JSON.stringify(tables)}`, "Database");
  }
}

// Intermedio BD <=> Code
export default async function getPool(): Promise<Pool> {
  if (pool) {
    try {
      const testConn = await pool.getConnection();
      testConn.release();
      return pool;
    } catch (err) {
      debug("⚠️ Pool existente pero conexión muerta, reinicializando...", "Database");
      pool = null;
      initializationPromise = null;
      return getPool(); // Reintentar con nueva inicialización
    }
  }

  if (initializationPromise) {
    debug("⏳ Solicitud de DB recibida durante inicialización, esperando...", "Database");
    await initializationPromise;
    if (pool) return pool;
  }

  throw new Error("❌ La base de datos no está inicializada y no se está inicializando.");
}

// ChkUp
export async function isBdReady(): Promise<boolean> {
  if (!pool) return false;
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    return true;
  } catch {
    return false;
  }
}

// Close BD
export async function closeBD(): Promise<boolean> {
  try {
    if (pool) {
      info("🔌 Cerrando conexiones de base de datos...", "Database");
      await pool.end();
      pool = null;
      initializationPromise = null;
      info("✅ Conexiones de base de datos cerradas", "Database");
    }
    return true
  } catch {
    error("❌ Error al cerrar conexiones de base de datos", "Database");
    return false
  }

}

// Otros
type FeedTables = 'mangadex_feeds' | 'reddit_feeds' | 'youtube_feeds' | 'cronpost_config' | 'followTweetX' | 'pixivData' | `blueskya`;
export async function countItems(guildId: string, table: FeedTables): Promise<number> {
  try {
    const pool = await getPool();
    const [result] = await pool.query(
      `SELECT COUNT(id) as count FROM ${table} WHERE guild_id = ?`,
      [guildId]
    );
    return Number((result as any[])[0].count) || 0;
  } catch (err) {
    error(`[BD.Counts] Error al contar en la tabla ${table}: ${err}`, "Database");
    return 0;
  }
}