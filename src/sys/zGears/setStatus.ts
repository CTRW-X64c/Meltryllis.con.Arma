// src/sys/setStatus.ts
import { Client, ActivityType } from "discord.js";
import { info, error } from "../logging";

interface Status {
  name: string;
  type: ActivityType;
}

const parseStatuses = (statusString: string | undefined): Status[] => {
  if (!statusString) {
    info("No se definieron estados en BOT_STATUS, usando estado predeterminado", "Status.Parse");
    return [{ name: "Bot Simulator", type: ActivityType.Playing}];
  }

  try {
    return statusString.split("|").map((status) => {
      const [type, name] = status.split(";").map(part => part.trim());
      if (!name || !type) {
        throw new Error(`Formato inválido en estado: ${status}`);
      }
      if (!["Playing", "Watching", "Listening", "Streaming", "Competing"].includes(type)) {
        throw new Error(`Tipo de actividad inválido: ${type} en estado: ${status}`);
      }
      return {
        name,
        type: ActivityType[type as keyof typeof ActivityType],
      };
    });
  } catch (err) {
    error(`Error al parsear BOT_STATUS: ${err}`, "Status.Parse");
    return [{ name: "Bot Simulator", type: ActivityType.Playing}];
  }
};

  const getStatusRotationInterval = (): number => {
  const statusTime = process.env.STATUS_TIME_MINUTOS;
  const defaultInterval = 1_800_000; 

  if (!statusTime) {
    info("No se definió STATUS_TIME_SEGUNDOS en .env, usando intervalo predeterminado (30 minutos)", "Status.Interval");
    return defaultInterval;
  }

  try {
    const minuts = parseInt(statusTime, 10);
    if (isNaN(minuts) || minuts <= 0) {
      throw new Error(`Valor inválido para STATUS_TIME_SEGUNDOS: ${statusTime}`);
    }
    const milliseconds = minuts * 60000;
    info(`Intervalo de rotación configurado: ${minuts} Minutos (${milliseconds} ms)`, "Status.Interval");
    return milliseconds;
  } catch (err) {
    error(`Error al parsear STATUS_TIME_SEGUNDOS: ${err}, usando intervalo predeterminado (30 minutos)`, "Status.Interval");
    return defaultInterval;
  }
};

const setupStatusRotation = (client: Client, statusList: Status[]): void => {
  const updateStatus = () => {
    const status = statusList[Math.floor(Math.random() * statusList.length)];
    client.user?.setActivity(`${status.name}`, { type: status.type});
    info(`Estado actualizado: ${status.name}`, "Status.Update");
  };

  updateStatus();

  const interval = getStatusRotationInterval();
  setInterval(updateStatus, interval);
};

export const startStatusRotation = (client: Client): void => {
  setupStatusRotation(client, parseStatuses(process.env.BOT_STATUS));
}