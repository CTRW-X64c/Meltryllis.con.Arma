// src/sys/DB-Engine/database.ts
import { createPool, Pool } from "mysql2/promise";
import { error, debug, info } from "../logging";

let pool: Pool | null = null;
let initializationPromise: Promise<void> | null = null;

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
          CREATE TABLE IF NOT EXISTS welcome_configs (
            guild_id VARCHAR(30) NOT NULL,
            channel_id VARCHAR(30),
            enabled BOOLEAN DEFAULT FALSE,
            custom_message TEXT,
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
          nsfw_protect Boolean DEFAULT FALSE,
          UNIQUE KEY unique_guild_subreddit (guild_id, subreddit_name)
          )
        `);

// Tabla de JoinCreate /giveChannel 
        await pool.query(`
          CREATE TABLE IF NOT EXISTS voice_configs (
            guild_id VARCHAR(30) PRIMARY KEY,
            channel_id VARCHAR(30),
            enabled BOOLEAN DEFAULT TRUE
          )
        `);
        
    // Canales temporales
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
            language VARCHAR(10),
            manga_title VARCHAR(250) NOT NULL,
            last_chapter VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE INDEX idx_unique_rss_guild_channel (guild_id, channel_id, RSS_manga)
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_perm (guild_id, target_id, command_name)
          )
        `);
        
        return;
      } catch (err) {
        if (attempt < maxRetries) {
          info(`🔄 Reintentando...`, "Database");
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

export async function getPool(): Promise<Pool> {
  if (pool) return pool;
  if (initializationPromise) {
      debug("⚠️ Solicitud de DB recibida durante inicialización, esperando...", "Database");
      await initializationPromise;
      if (pool) return pool;
  }
  throw new Error("❌ La base de datos no está inicializada y no se está conectando.");
}
