// src/sys/environment.ts
export type EnvironmentMode = "production" | "development";

export function getEnvironmentMode(): EnvironmentMode {
  const debugFlag = process.env.DEBUG_MODE ?? "OFF";
  const isDebugMode = debugFlag === "ON" || debugFlag === "on" || debugFlag === "1" || debugFlag === "TRUE" || debugFlag === "true";
  return isDebugMode ? "development" : "production";
}

export function isDevelopment(): boolean {
  return getEnvironmentMode() === "development";
}