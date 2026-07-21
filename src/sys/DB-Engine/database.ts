// src/sys/DB-Engine/database.ts
import { createPool, Pool } from "mysql2/promise";
import { error, debug, info } from "../logging";
import { getEnvironmentMode } from "../environment";

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

  // Tabla de comando /replybots
  await pool.query(`
    CREATE TABLE IF NOT EXISTS channel_configs (
      guild_id VARCHAR(30) NOT NULL,
      channel_id VARCHAR(30) NOT NULL,
      enabled BOOLEAN DEFAULT TRUE,
      reply_bots BOOLEAN DEFAULT TRUE,
      PRIMARY KEY (guild_id, channel_id)
    )
  `);

  // Tabla de comando /embed
  await pool.query(`
    CREATE TABLE IF NOT EXISTS guild_replacements (
      guild_id VARCHAR(30) NOT NULL,
      replacement_type VARCHAR(50) NOT NULL,
      custom_url VARCHAR(255),
      enabled BOOLEAN DEFAULT TRUE,
      user_id VARCHAR(30),
      PRIMARY KEY (guild_id, replacement_type)
    )
  `);

  // Tabla de comandos /welcome
  await pool.query(`
    CREATE TABLE IF NOT EXISTS welcome_banner (
      guild_id VARCHAR(30) NOT NULL,
      channel_id VARCHAR(30),
      custom_message TEXT,
      fText TEXT,
      sText TEXT,
      tText TEXT,
      background VARCHAR(255),
      ringcolor VARCHAR(7),
      exitmesseng BOOLEAN DEFAULT FALSE,
      PRIMARY KEY (guild_id)
    )
  `);

  // Tabla de comandos /rolemoji
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_assignments (
      id INT AUTO_INCREMENT,
      guild_id VARCHAR(30) NOT NULL,
      message_id VARCHAR(30) NOT NULL,
      channel_id VARCHAR(30) NOT NULL,
      emoji VARCHAR(50) NOT NULL,
      role_id VARCHAR(30) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY unique_assignment (guild_id, message_id, emoji)
    )
  `);

  // Tabla de comandos /youtube
  await pool.query(`
    CREATE TABLE IF NOT EXISTS youtube_feeds (
      id INT AUTO_INCREMENT PRIMARY KEY,
      guild_id VARCHAR(50) NOT NULL,
      channel_id VARCHAR(50) NOT NULL,
      youtube_channel_id VARCHAR(250) NOT NULL,
      youtube_channel_name VARCHAR(250) NOT NULL,
      rss_url VARCHAR(255) NOT NULL,
      last_video_id VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_guild_youtube (guild_id, youtube_channel_id)
    )
  `);

  // Tabla de comandos /reddit
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reddit_feeds (
      id INT AUTO_INCREMENT PRIMARY KEY,
      guild_id VARCHAR(50) NOT NULL,
      channel_id VARCHAR(50) NOT NULL,
      subreddit_url VARCHAR(250) NOT NULL,
      subreddit_name VARCHAR(250) NOT NULL,
      last_post_id VARCHAR(100),
      filter_mode VARCHAR(50) NOT NULL DEFAULT 'all',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      nsfw_protect BOOLEAN DEFAULT FALSE,
      UNIQUE KEY unique_guild_subreddit (guild_id, subreddit_name)
    )
  `);

  // Tabla de JoinCreate /giveChannel (voice_configs)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS voice_configs (
      guild_id VARCHAR(30) PRIMARY KEY,
      channel_id VARCHAR(30),
      enabled BOOLEAN DEFAULT TRUE
    )
  `);

  // Tabla de canales temporales de voz
  await pool.query(`
    CREATE TABLE IF NOT EXISTS temp_voice_channels (
      channel_id VARCHAR(30) PRIMARY KEY,
      guild_id VARCHAR(30) NOT NULL,
      owner_id VARCHAR(30),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de Mangadex /mangadex
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mangadex_feeds ( 
      id INT AUTO_INCREMENT PRIMARY KEY,
      guild_id VARCHAR(50) NOT NULL,
      channel_id VARCHAR(50) NOT NULL,
      RSS_manga VARCHAR(250) NOT NULL,
      mangaUrl VARCHAR(250) NOT NULL,
      language VARCHAR(250),
      manga_title VARCHAR(250) NOT NULL,
      last_chapter VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE INDEX idx_unique_manga_channel (guild_id, channel_id, mangaUrl)
    )
  `);

  // Tabla de permisos /permission
  await pool.query(`
    CREATE TABLE IF NOT EXISTS command_permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      guild_id VARCHAR(50) NOT NULL,
      target_id VARCHAR(50) NOT NULL,
      target_type ENUM('USER', 'ROLE') NOT NULL,
      command_name VARCHAR(50) NOT NULL,
      user_give_perm VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_perm (guild_id, target_id, command_name)
    )
  `);

  // Tabla de msgCustom /buttonRole
  await pool.query(`
    CREATE TABLE IF NOT EXISTS buttonMsg_configs (
      guild_id VARCHAR(50) NOT NULL,
      id_Button VARCHAR(50) NOT NULL,
      msgButton_id TEXT,
      PRIMARY KEY (id_Button)
    )
  `);

  // Tabla de /cronpost
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cronpost_config (
      id INT AUTO_INCREMENT PRIMARY KEY,
      guild_id VARCHAR(50) NOT NULL,
      channel_id VARCHAR(50) NOT NULL,
      cron VARCHAR(25) NOT NULL,
      mensaje_data TEXT NOT NULL,
      exec_date TEXT NOT NULL,
      stop_after INT DEFAULT 0,
      count_exec INT DEFAULT 0,
      dlt_msg INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de deltMsg
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cron_timeout (
      message_id VARCHAR(50) PRIMARY KEY,
      channel_id VARCHAR(50) NOT NULL,
      delete_at BIGINT(20) NOT NULL
    )
  `);

  // Tabla de limites
  await pool.query(`
    CREATE TABLE IF NOT EXISTS guild_limits (
      guild_id VARCHAR(50) PRIMARY KEY,
      cron_limited INT DEFAULT 5,
      chk_domain BOOLEAN DEFAULT FALSE,
      no_wait_node BOOLEAN DEFAULT FALSE,
      dex_max INT DEFAULT 10,
      red_max INT DEFAULT 10,
      yt_max INT DEFAULT 10
    )
  `);

  // Tabla de estados
  await pool.query(`
    CREATE TABLE IF NOT EXISTS status_configs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL
    )
  `);

  // Tabla de Dominios
  await pool.query(`
    CREATE TABLE IF NOT EXISTS domains (
      site VARCHAR(255) PRIMARY KEY,
      domains VARCHAR(255) NOT NULL
    )
  `);

  //Tabla lavalink
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lavalinks (
      name VARCHAR(255) PRIMARY KEY,
      host VARCHAR(255) NOT NULL,
      password VARCHAR(255) NOT NULL
    )
  `);

  //Tabla noeveryone
  await pool.query(`
    CREATE TABLE IF NOT EXISTS noeveryone (
      guild_id VARCHAR(50) PRIMARY KEY,
      state BOOLEAN DEFAULT FALSE,
      penality BOOLEAN DEFAULT FALSE,
      role VARCHAR(50)
    )
  `);

  //Tabla TimmerServices
  await pool.query(`
    CREATE TABLE IF NOT EXISTS timmersServices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      service VARCHAR(255) NOT NULL,
      timmer INT NOT NULL
    )
  `);

  //Tabla kancolle
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kc_conf (
      guild_id VARCHAR(50) NOT NULL,
      role VARCHAR(50),
      channel VARCHAR(50) NOT NULL,
      pvp BOOLEAN DEFAULT TRUE,
      quest BOOLEAN DEFAULT TRUE,
      oem BOOLEAN DEFAULT TRUE,
      UNIQUE KEY unique_guild_kancolle (guild_id)
    )
  `);

  //Tabla KCMantenimiento
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kc_maint(
      lastMaintStart DATETIME NOT NULL,
      maintNotified BOOLEAN DEFAULT FALSE,
      lastNotificationTime DATETIME
    )
  `);

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
type FeedTables = 'mangadex_feeds' | 'reddit_feeds' | 'youtube_feeds' | 'cronpost_config';
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