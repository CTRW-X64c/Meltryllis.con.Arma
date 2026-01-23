// src/commands/resources.ts

/* =================== Interfaces =================== */

export interface ChannelConfig {
  enabled: boolean;
  replyBots: boolean;
}

/* =================== UTILIDADES DE EMBEDS =================== */

export function randomcolorembed(): string {
  const color = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase();
  return `0x${color.padStart(6, '0')}`;
}
