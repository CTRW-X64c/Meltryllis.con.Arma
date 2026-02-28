// src/sys/logging.ts
import winston, { Logger } from "winston";
import { EnvironmentMode } from "./environment";

const now = new Date();
const fixHour = String(now.getHours()).padStart(2, '0');
const logDir = `logs/${now.toLocaleDateString('en-CA')} [${fixHour}hrs]`;

let logger: Logger | null = null;

export function initLogger( environmentMode: EnvironmentMode ): void {
  const logLevel = environmentMode === "development" ? "debug" : "info";
  const clientFormat = winston.format.cli();
  const fileFormat = winston.format.combine(
    winston.format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
    winston.format.printf(({ timestamp, label, level, message }) => {
      return `[${timestamp}] ${label} - ${level}: ${message}`;
    }),
  );

  logger = winston.createLogger({
    level: logLevel,
    transports: [
      new winston.transports.Console({level: logLevel,  format: clientFormat,}),
      new winston.transports.File({level: logLevel, format: fileFormat, filename: `${logDir}/combined.log`,}),
      new winston.transports.File({level: "error", format: fileFormat, filename: `${logDir}/error.log`,}),
      new winston.transports.File({level: "info", format: fileFormat, filename: `${logDir}/info.log`,}),
      new winston.transports.File({level: "debug", format: fileFormat, filename: `${logDir}/debug.log`,}),
      new winston.transports.File({level: "warn", format: fileFormat, filename: `${logDir}/warn.log`,}),
    ],
  });
}

export function loggerAvailable(): boolean {
  return logger !== null;
}

export function log(level: string, msg: string, label?: string): void {
  if (!logger) {
    throw new Error("Logger no inicializado, alguien lo llamo antes de estar listo!!");
  }

  logger.log(level, msg, {
    label: label ?? "default",
  });
}

export function error(msg: string, label?: string): void {
  log("error", msg, label);
}

export function warn(msg: string, label?: string): void {
  log("warn", msg, label);
}

export function info(msg: string, label?: string): void {
  log("info", msg, label);
}

export function debug(msg: string, label?: string): void {
  log("debug", msg, label);
}
