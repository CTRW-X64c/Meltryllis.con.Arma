import { debug, error } from "../../logging";
import getPool from "../database";

interface buttonsLinks {
    guildId: string;
    idButton: string;
    messageText: string;
}

const buttonConfigCache = new Map<string, buttonsLinks[]>();

export async function addButton(guildId: string, idButton: string, messageText: string): Promise<void> {
  try {
    const pool = await getPool();
    await pool.query(
      "INSERT INTO buttonMsg_configs (guild_id, id_Button, msgButton_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE msgButton_id = VALUES(msgButton_id)",
      [guildId, idButton, messageText]
    );

    buttonConfigCache.delete(idButton);
    debug(`[BD.roleButton] Invalidando caché del botón: ${idButton}`, "Database");
  } catch (err) {
    error(`[BD.roleButton] Error al guardar configuración: ${err}`, "Database");
    throw err;
  }
}

export async function getButton(idButton: string): Promise<buttonsLinks[]> {
  if (buttonConfigCache.has(idButton)) {
    debug(`[BD.roleButton] Cache HIT para botón: ${idButton}`, "Database");
    return [...buttonConfigCache.get(idButton)!];
  }

  debug(`[BD.roleButton] Cache MISS para botón: ${idButton}, consultando BD`, "Database");
  
  try {
    const pool = await getPool();
    const [tip] = await pool.query(
      "SELECT guild_id, id_Button, msgButton_id FROM buttonMsg_configs WHERE id_Button = ?",
      [idButton]
    );

    const buttons = (tip as any[]).map(row => ({
      guildId: row.guild_id,
      idButton: row.id_Button,
      messageText: row.msgButton_id
    }));

    buttonConfigCache.set(idButton, buttons);

    debug(`[BD.roleButton] Caché actualizada para botón: ${idButton}`, "Database");
    return buttons;
  } catch (err) {
    error(`[BD.roleButton] Error al cargar botón: ${err}`, "Database");
    throw err;
  }
}

export async function removButton(guildId: string): Promise<boolean> {
  try {
    const pool = await getPool();
    await pool.query("DELETE FROM buttonMsg_configs WHERE guild_id = ?", [guildId]);
        
    for (const [key, val] of buttonConfigCache.entries()) {
        if (val.some(b => b.guildId === guildId)) {
            buttonConfigCache.delete(key);
        }
    }

    debug(`[BD.roleButton] Configuración eliminada para guild: ${guildId}`, "Database");
    return true; 
  } catch (err) {
    error(`[BD.roleButton] Error al eliminar configuración: ${err}`, "Database");
    throw err;
  }
}