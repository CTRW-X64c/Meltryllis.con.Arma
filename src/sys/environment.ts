// src/sys/environment.ts
export type EnvironmentMode = "production" | "development";

export function getEnvironmentMode(): EnvironmentMode {
  const debugFlag = process.env.DEBUG_MODE ?? "0";
  const isDebugMode = debugFlag !== "0";
  return isDebugMode ? "development" : "production";
}

export function isDevelopment(): boolean {
  return getEnvironmentMode() === "development";
}