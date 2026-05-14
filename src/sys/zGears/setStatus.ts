// src/sys/setStatus.ts
import { Client, ActivityType, EmbedBuilder, ChatInputCommandInteraction, PresenceStatusData } from "discord.js";
import { info, error } from "../logging";
import getPool from "../DB-Engine/database";

let statusList: { id: number, name: string }[] = [];
let iClient: Client | null = null;
let inter: NodeJS.Timeout | null = null;
let tempTimeout: NodeJS.Timeout | null = null;
let timmer = Number(process.env.STATUS_TIME_MINUTOS) * 60 * 1000 || 30 * 60 * 1000;
let defaultList = false;
let countStatus = 0;

const setRandom = () => {
  if (!iClient) { error("Fallo iniciar status por falta de cliente!! (setRandom)", "setStatus"); return }
  if (statusList.length === 0) { error("Fallo iniciar status por falta de estados!! (setRandom)", "setStatus"); return }

  const randomIndex = Math.floor(Math.random() * statusList.length);
  const randomStatus = statusList[randomIndex];
  iClient.user?.setActivity({
    name: "custom",
    type: ActivityType.Custom,
    state: randomStatus.name,
  });
  info(`Estado establecido: ${randomStatus.name}`, "setStatus");
};

export async function startStatusRotation(client: Client): Promise<void> {
  try {
    iClient = client;
    const pool = await getPool();
    const [list]: any = await pool.query("SELECT * FROM status_configs");
    if (!list || list.length === 0) {
      statusList.push(
        { id: 1, name: "⌨️ Jugando Minecraft con los amigos" },
        { id: 2, name: "🎮 Guns and Nuns: Storming Hell" },
        { id: 3, name: "Usa /help <COMANDO>" },
      );
      defaultList = true;
      info("Usando lista de estados por defecto", "setStatus");
    } else {
      for (const status of list) {
        statusList.push({
          id: status.id,
          name: status.name,
        });
        countStatus++;
      }
      info(`Lista de estados generada con: ${countStatus} estados y cambia cada ${timmer / 60000} minutos.`, "setStatus");
    }
    setRandom();
    if (inter) clearInterval(inter);
    inter = setInterval(setRandom, timmer);
  } catch (e) {
    error(`Error al inciar servicio de estados!!: ${e}`, "setStatus");
  }
}

export function addTempStatus(name: string, duracion: number): boolean {
  try {
    if (!iClient) return false;
    iClient.user?.setActivity({
      name: "custom",
      type: ActivityType.Custom,
      state: name
    });
    if (inter) clearInterval(inter);
    if (tempTimeout) clearTimeout(tempTimeout);

    tempTimeout = setTimeout(() => {
      setRandom();
      inter = setInterval(setRandom, timmer);
      tempTimeout = null;
    }, duracion * 60 * 1000);

    return true;
  } catch (e) {
    error(`Error setting temp status: ${e}`);
    return false;
  }
}

export async function clerTempStatus(): Promise<boolean> {
  try {
    if (!iClient) return false;
    if (tempTimeout) {
      clearTimeout(tempTimeout);
      tempTimeout = null;
    }
    setRandom();
    if (inter) clearInterval(inter);
    inter = setInterval(setRandom, timmer);
    info("Estado temporal limpiado, regresando a rotación normal.", "setStatus");
    return true;
  } catch (e) {
    error(`Error al limpiar el estado temporal: ${e}`, "setStatus");
    return false;
  }
}

export async function addStatusBD(name: string): Promise<boolean> {
  if (!iClient) return false;
  try {
    const pool = await getPool();
    const [status]: any = await pool.query(
      "INSERT INTO status_configs (name) VALUES (?)",
      [name]
    );
    const id = status.insertId;
    if (id === undefined) return false;
    if (defaultList === true) statusList = [];
    statusList.push({ id, name });
    defaultList = false;
    return true;
  } catch (e) {
    error(`Error al añadir estado: ${e}`, "setStatus");
    return false;
  }
}

export async function changeTimmer(newTimmer: number): Promise<number | null> {
  try {
    timmer = newTimmer * 60 * 1000;
    if (inter) clearInterval(inter);
    if (!tempTimeout) { setRandom(); inter = setInterval(setRandom, timmer); }
    return timmer;
  } catch (e) {
    error(`Error al cambiar el timer: ${e}`, "setStatus");
    return null;
  }
}

export async function listStatus(interaccion: ChatInputCommandInteraction): Promise<void> {
  const list = statusList;
  if (!list || list.length === 0) {
    await interaccion.editReply({ content: "No hay estados establecidos" });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("Lista de estados")
    .setDescription(list.map((s: any) => `**ID:** ${s.id} | **Estado:** ${s.name}`).join("\n"))
    .setColor(0x0000FF);

  await interaccion.editReply({ embeds: [embed] });
}

export async function deleteStatusBD(id: number): Promise<boolean> {
  try {
    const pool = await getPool();
    const [status]: any = await pool.query(
      "DELETE FROM status_configs WHERE id = ?",
      [id]
    );
    if (status.affectedRows === 0) return false;
    statusList = statusList.filter((x) => x.id !== (id));
    return true;
  } catch (e) {
    error(`Error al borrar el estado: ${e}`, "setStatus");
    return false;
  }
}

export async function setiState(stat: PresenceStatusData, time: number): Promise<boolean> {
  if (!iClient) return false;
  iClient.user?.setStatus(stat);
  if (time !== 0) {
    setTimeout(() => {
      if (iClient) iClient.user?.setStatus('online');
    }, time * 60 * 1000);
  }
  return true;
}
